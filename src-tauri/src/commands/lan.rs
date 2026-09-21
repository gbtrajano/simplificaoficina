use crate::db::DbState;
use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream, UdpSocket};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::State;

pub struct LanServerState {
    pub running: AtomicBool,
    pub bind: Mutex<Option<String>>,
}

impl Default for LanServerState {
    fn default() -> Self {
        Self {
            running: AtomicBool::new(false),
            bind: Mutex::new(None),
        }
    }
}

#[derive(Serialize)]
pub struct LanStatus {
    pub running: bool,
    pub url: Option<String>,
}

#[derive(Serialize)]
struct MobileOrder {
    id: i64,
    plate: String,
    vehicle_name: String,
    customer_name: Option<String>,
    status: String,
    priority: String,
    complaint: String,
    diagnosis: String,
    services: String,
    parts: String,
    mechanic: String,
    promised_at: Option<String>,
    updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MechanicAction {
    mechanic: String,
    status: Option<String>,
}

fn local_ip() -> String {
    UdpSocket::bind("0.0.0.0:0")
        .and_then(|socket| {
            socket.connect("8.8.8.8:80")?;
            socket.local_addr()
        })
        .map(|address| address.ip().to_string())
        .unwrap_or_else(|_| "127.0.0.1".into())
}

fn reply(stream: &mut TcpStream, status: &str, content_type: &str, body: &str) {
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: Content-Type, X-Workshop-Pin\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nCache-Control: no-store\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.as_bytes().len()
    );
    let _ = stream.write_all(response.as_bytes());
}

fn json_reply(stream: &mut TcpStream, status: &str, value: serde_json::Value) {
    reply(stream, status, "application/json", &value.to_string());
}

fn configured_pin(db: &Arc<Mutex<rusqlite::Connection>>) -> Result<String, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT value FROM local_meta WHERE key='workshop_lan_pin'",
        [],
        |row| row.get(0),
    )
    .map_err(|_| "PIN da oficina nao configurado".to_string())
}

fn header_value(headers: &str, wanted: &str) -> String {
    headers
        .lines()
        .skip(1)
        .filter_map(|line| line.split_once(':'))
        .find(|(name, _)| name.trim().eq_ignore_ascii_case(wanted))
        .map(|(_, value)| value.trim().to_string())
        .unwrap_or_default()
}

fn authorize(db: &Arc<Mutex<rusqlite::Connection>>, headers: &str) -> Result<(), String> {
    if header_value(headers, "X-Workshop-Pin") == configured_pin(db)? {
        Ok(())
    } else {
        Err("PIN incorreto".into())
    }
}

fn list_orders(db: &Arc<Mutex<rusqlite::Connection>>) -> Result<Vec<MobileOrder>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut statement = conn.prepare(
        "SELECT o.id,v.plate,TRIM(v.brand || ' ' || v.model),c.name,o.status,o.priority,o.complaint,o.diagnosis,o.services,o.parts,o.mechanic,o.promised_at,o.updated_at
         FROM service_orders o JOIN vehicles v ON v.id=o.vehicle_id LEFT JOIN customers c ON c.id=o.customer_id
         WHERE o.status NOT IN ('delivered','canceled')
         ORDER BY CASE WHEN TRIM(o.mechanic)='' THEN 0 ELSE 1 END,
                  CASE o.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,o.updated_at DESC"
    ).map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(MobileOrder {
                id: row.get(0)?,
                plate: row.get(1)?,
                vehicle_name: row.get(2)?,
                customer_name: row.get(3)?,
                status: row.get(4)?,
                priority: row.get(5)?,
                complaint: row.get(6)?,
                diagnosis: row.get(7)?,
                services: row.get(8)?,
                parts: row.get(9)?,
                mechanic: row.get(10)?,
                promised_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn claim_order(
    db: &Arc<Mutex<rusqlite::Connection>>,
    id: i64,
    mechanic: &str,
) -> Result<(), String> {
    let mechanic = mechanic.trim();
    if mechanic.len() < 2 || mechanic.len() > 60 {
        return Err("Informe o nome do mecanico".into());
    }
    let conn = db.lock().map_err(|e| e.to_string())?;
    let changed = conn
        .execute(
            "UPDATE service_orders SET mechanic=?1,status='in_progress',updated_at=?2
         WHERE id=?3 AND TRIM(mechanic)='' AND status NOT IN ('delivered','canceled','ready')",
            params![mechanic, Utc::now().to_rfc3339(), id],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        Err("Esta OS ja foi assumida ou nao esta disponivel".into())
    } else {
        Ok(())
    }
}

fn change_order_status(
    db: &Arc<Mutex<rusqlite::Connection>>,
    id: i64,
    mechanic: &str,
    status: &str,
) -> Result<(), String> {
    if !matches!(status, "in_progress" | "waiting_parts" | "ready") {
        return Err("Status nao permitido".into());
    }
    let conn = db.lock().map_err(|e| e.to_string())?;
    let changed = conn.execute(
        "UPDATE service_orders SET status=?1,updated_at=?2
         WHERE id=?3 AND LOWER(TRIM(mechanic))=LOWER(TRIM(?4)) AND status NOT IN ('delivered','canceled')",
        params![status, Utc::now().to_rfc3339(), id, mechanic],
    ).map_err(|e| e.to_string())?;
    if changed == 0 {
        Err("A OS pertence a outro mecanico".into())
    } else {
        Ok(())
    }
}

fn parse_order_route(path: &str) -> Option<(i64, &str)> {
    let parts: Vec<&str> = path.trim_matches('/').split('/').collect();
    if parts.len() == 4 && parts[0] == "api" && parts[1] == "orders" {
        parts[2].parse().ok().map(|id| (id, parts[3]))
    } else {
        None
    }
}

fn handle(mut stream: TcpStream, db: Arc<Mutex<rusqlite::Connection>>) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let mut raw = vec![0u8; 1_048_576];
    let size = match stream.read(&mut raw) {
        Ok(size) => size,
        Err(_) => return,
    };
    let request = String::from_utf8_lossy(&raw[..size]);
    let (headers, body) = request.split_once("\r\n\r\n").unwrap_or((&request, ""));
    let mut first = headers.lines().next().unwrap_or("").split_whitespace();
    let method = first.next().unwrap_or("");
    let path = first.next().unwrap_or("").split('?').next().unwrap_or("");

    if method == "OPTIONS" {
        reply(&mut stream, "204 No Content", "text/plain", "");
        return;
    }
    if method == "GET" && (path == "/" || path == "/mobile") {
        reply(&mut stream, "200 OK", "text/html", MOBILE_APP);
        return;
    }
    if method == "GET" && path == "/health" {
        json_reply(&mut stream, "200 OK", serde_json::json!({"ok": true}));
        return;
    }
    if let Err(message) = authorize(&db, headers) {
        json_reply(
            &mut stream,
            "401 Unauthorized",
            serde_json::json!({"error": message}),
        );
        return;
    }

    let result: Result<serde_json::Value, String> = match (method, path) {
        ("GET", "/api/orders") => list_orders(&db)
            .and_then(|orders| serde_json::to_value(orders).map_err(|e| e.to_string())),
        _ => match parse_order_route(path) {
            Some((id, "claim")) if method == "POST" => serde_json::from_str::<MechanicAction>(body)
                .map_err(|_| "Dados invalidos".to_string())
                .and_then(|input| claim_order(&db, id, &input.mechanic))
                .map(|_| serde_json::json!({"ok": true})),
            Some((id, "status")) if method == "POST" => {
                serde_json::from_str::<MechanicAction>(body)
                    .map_err(|_| "Dados invalidos".to_string())
                    .and_then(|input| {
                        change_order_status(
                            &db,
                            id,
                            &input.mechanic,
                            input.status.as_deref().unwrap_or(""),
                        )
                    })
                    .map(|_| serde_json::json!({"ok": true}))
            }
            _ => Err("Rota nao encontrada".into()),
        },
    };
    match result {
        Ok(value) => json_reply(&mut stream, "200 OK", value),
        Err(message) => json_reply(
            &mut stream,
            "400 Bad Request",
            serde_json::json!({"error": message}),
        ),
    }
}

#[tauri::command]
pub fn start_lan_server(
    state: State<DbState>,
    server: State<LanServerState>,
    pin: String,
) -> Result<String, String> {
    let pin = pin.trim();
    if pin.len() < 4 || pin.len() > 8 || !pin.chars().all(|c| c.is_ascii_digit()) {
        return Err("Use um PIN numerico de 4 a 8 digitos".into());
    }
    {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO local_meta(key,value) VALUES('workshop_lan_pin',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [pin]).map_err(|e| e.to_string())?;
    }
    if server.running.load(Ordering::SeqCst) {
        return Ok(server
            .bind
            .lock()
            .map_err(|e| e.to_string())?
            .clone()
            .unwrap_or_default());
    }
    let listener = TcpListener::bind("0.0.0.0:8080")
        .map_err(|e| format!("Nao foi possivel abrir a porta 8080: {e}"))?;
    let url = format!("http://{}:8080", local_ip());
    let db = state.0.clone();
    server.running.store(true, Ordering::SeqCst);
    *server.bind.lock().map_err(|e| e.to_string())? = Some(url.clone());
    thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let db = db.clone();
            thread::spawn(move || handle(stream, db));
        }
    });
    Ok(url)
}

#[tauri::command]
pub fn lan_server_status(server: State<LanServerState>) -> Result<LanStatus, String> {
    Ok(LanStatus {
        running: server.running.load(Ordering::SeqCst),
        url: server.bind.lock().map_err(|e| e.to_string())?.clone(),
    })
}

#[tauri::command]
pub fn get_lan_access_pin(state: State<DbState>) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    Ok(conn
        .query_row(
            "SELECT value FROM local_meta WHERE key='workshop_lan_pin'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "1234".into()))
}

const MOBILE_APP: &str = r##"<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Simplifica Oficina - Mecanico</title><style>
:root{font-family:Inter,system-ui,sans-serif;color:#182239;background:#f3f5f8}*{box-sizing:border-box}body{margin:0}.top{background:#111d35;color:#fff;padding:22px 18px 18px}.brand{display:flex;align-items:center;gap:10px;font-weight:800}.mark{width:38px;height:38px;border-radius:10px;background:#ed681e;display:grid;place-items:center;font-size:21px}.top p{color:#aeb8ca;font-size:12px;margin:10px 0 0}.login,.content{padding:16px}.card{background:#fff;border:1px solid #e5e8ed;border-radius:14px;padding:15px;margin-bottom:12px;box-shadow:0 3px 10px #1018280a}label{font-size:11px;font-weight:700;color:#697386;display:block;margin:8px 0 5px}input{width:100%;height:44px;border:1px solid #d9dee6;border-radius:10px;padding:0 12px;font-size:15px}button{border:0;border-radius:10px;min-height:42px;padding:0 14px;font-weight:800}.primary{width:100%;background:#ed681e;color:#fff;margin-top:12px}.bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.bar h2{font-size:17px;margin:0}.bar button{background:#fff;border:1px solid #dfe3e8;color:#5c6678}.os-head{display:flex;justify-content:space-between;gap:10px}.os-head strong{font-size:15px}.plate{font-size:11px;border:1px solid #cdd3dc;background:#f5f6f8;border-radius:5px;padding:3px 7px}.meta{font-size:11px;color:#808999;margin:5px 0 12px}.label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#939baa;font-weight:800;margin-top:10px}.text{font-size:13px;white-space:pre-wrap;margin:3px 0}.chip{display:inline-block;font-size:10px;border-radius:20px;padding:5px 8px;background:#fff0e7;color:#ce5514;font-weight:800}.owner{background:#eaf2ff;color:#326db7;padding:7px;border-radius:7px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.actions button{background:#eff2f6;color:#425068}.actions .take{grid-column:1/-1;background:#ed681e;color:#fff}.empty{text-align:center;color:#828c9d;padding:45px 15px}.error{background:#fff0f0;color:#a83232;border:1px solid #f1cccc;padding:10px;border-radius:9px;font-size:12px;margin-bottom:10px}.hidden{display:none}@media(min-width:700px){.content,.login{max-width:720px;margin:auto}}
</style></head><body><header class="top"><div class="brand"><div class="mark">🔧</div><div>Simplifica Oficina</div></div><p>Painel do mecânico conectado à oficina</p></header>
<section id="login" class="login"><div class="card"><h2>Acessar ordens</h2><label>SEU NOME</label><input id="name" autocomplete="name" placeholder="Ex.: Carlos"><label>PIN DA OFICINA</label><input id="pin" inputmode="numeric" maxlength="8" type="password" placeholder="4 a 8 dígitos"><button class="primary" onclick="enter()">Entrar</button></div></section>
<main id="app" class="content hidden"><div class="bar"><div><h2>Ordens de serviço</h2><small id="who"></small></div><button onclick="load()">Atualizar</button></div><div id="error"></div><div id="orders"></div></main>
<script>
const $=id=>document.getElementById(id);let mechanic=localStorage.mechanic||'',pin=localStorage.workshopPin||'';$('name').value=mechanic;$('pin').value=pin;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const labels={draft:'Orçamento',approved:'Aprovada',in_progress:'Em execução',waiting_parts:'Aguardando peças',ready:'Pronta'};
async function request(url,options={}){const response=await fetch(url,{...options,headers:{'Content-Type':'application/json','X-Workshop-Pin':pin,...options.headers}});const data=await response.json();if(!response.ok)throw new Error(data.error||'Falha na comunicação');return data}
function enter(){mechanic=$('name').value.trim();pin=$('pin').value.trim();if(mechanic.length<2||pin.length<4)return alert('Informe seu nome e o PIN da oficina.');localStorage.mechanic=mechanic;localStorage.workshopPin=pin;$('who').textContent=mechanic;$('login').classList.add('hidden');$('app').classList.remove('hidden');load()}
async function load(){try{$('error').innerHTML='';const orders=await request('/api/orders');render(orders)}catch(e){$('error').innerHTML='<div class="error">'+esc(e.message)+'</div>'}}
function render(orders){if(!orders.length){$('orders').innerHTML='<div class="empty">Nenhuma OS aberta no momento.</div>';return}$('orders').innerHTML=orders.map(o=>{const mine=o.mechanic.toLowerCase()===mechanic.toLowerCase();const free=!o.mechanic;return `<article class="card"><div class="os-head"><strong>OS #${String(o.id).padStart(4,'0')} · ${esc(o.vehicle_name)}</strong><span class="plate">${esc(o.plate)}</span></div><div class="meta">${esc(o.customer_name||'Cliente não informado')} · <span class="chip">${esc(labels[o.status]||o.status)}</span></div><div class="label">Relato</div><p class="text">${esc(o.complaint||'Sem relato')}</p>${o.diagnosis?`<div class="label">Diagnóstico</div><p class="text">${esc(o.diagnosis)}</p>`:''}${o.services?`<div class="label">Serviços</div><p class="text">${esc(o.services)}</p>`:''}${o.parts?`<div class="label">Peças</div><p class="text">${esc(o.parts)}</p>`:''}<div class="meta ${o.mechanic?'owner':''}">${o.mechanic?'Responsável: '+esc(o.mechanic):'Disponível para assumir'}</div><div class="actions">${free?`<button class="take" onclick="claim(${o.id})">Assumir esta OS</button>`:''}${mine?`<button onclick="status(${o.id},'waiting_parts')">Aguardando peças</button><button onclick="status(${o.id},'ready')">Marcar pronta</button>`:''}</div></article>`}).join('')}
async function claim(id){try{await request(`/api/orders/${id}/claim`,{method:'POST',body:JSON.stringify({mechanic})});await load()}catch(e){alert(e.message)}}async function status(id,value){try{await request(`/api/orders/${id}/status`,{method:'POST',body:JSON.stringify({mechanic,status:value})});await load()}catch(e){alert(e.message)}}
setInterval(()=>{if(!$('app').classList.contains('hidden'))load()},4000);if(mechanic&&pin)enter();
</script></body></html>"##;

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Arc<Mutex<rusqlite::Connection>> {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE local_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
             CREATE TABLE customers(id INTEGER PRIMARY KEY,name TEXT NOT NULL);
             CREATE TABLE vehicles(id INTEGER PRIMARY KEY,plate TEXT NOT NULL,brand TEXT NOT NULL,model TEXT NOT NULL);
             CREATE TABLE service_orders(
               id INTEGER PRIMARY KEY,vehicle_id INTEGER NOT NULL,customer_id INTEGER,status TEXT NOT NULL,
               priority TEXT NOT NULL,complaint TEXT NOT NULL,diagnosis TEXT NOT NULL,services TEXT NOT NULL,
               parts TEXT NOT NULL,mechanic TEXT NOT NULL,promised_at TEXT,updated_at TEXT NOT NULL
             );
             INSERT INTO local_meta VALUES('workshop_lan_pin','4321');
             INSERT INTO customers VALUES(1,'Cliente');
             INSERT INTO vehicles VALUES(1,'ABC1D23','Fiat','Uno');
             INSERT INTO service_orders VALUES(1,1,1,'approved','normal','Barulho','', 'Revisar suspensao','', '',NULL,'2026-09-20T10:00:00Z');"
        ).unwrap();
        Arc::new(Mutex::new(conn))
    }

    #[test]
    fn mechanic_can_claim_and_finish_an_order() {
        let db = test_db();
        assert_eq!(configured_pin(&db).unwrap(), "4321");
        assert_eq!(list_orders(&db).unwrap().len(), 1);
        claim_order(&db, 1, "Carlos").unwrap();
        let claimed = list_orders(&db).unwrap().remove(0);
        assert_eq!(claimed.mechanic, "Carlos");
        assert_eq!(claimed.status, "in_progress");
        change_order_status(&db, 1, "Carlos", "ready").unwrap();
        assert_eq!(list_orders(&db).unwrap().remove(0).status, "ready");
    }

    #[test]
    fn another_mechanic_cannot_take_claimed_order() {
        let db = test_db();
        claim_order(&db, 1, "Carlos").unwrap();
        assert!(claim_order(&db, 1, "Ana").is_err());
        assert!(change_order_status(&db, 1, "Ana", "ready").is_err());
    }
}
