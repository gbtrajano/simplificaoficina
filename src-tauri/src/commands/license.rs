use crate::db::DbState;
use serde::{Deserialize, Serialize};
use tauri::State;

const KEY_MACHINE_ID: &str = "machine_id";
const KEY_LICENSE: &str = "license";

/// Estado da licença persistido localmente (chave + cache da última verificação)
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct LocalLicense {
    pub license_key: String,
    pub machine_id: String,
    /// Cache da última verificação online (json: status, expiresAt, lastCheck, etc.)
    pub cache: Option<String>,
}

fn get_meta(conn: &rusqlite::Connection, key: &str) -> Result<String, String> {
    // Sem linha ainda (primeira execução) → valor vazio, não é erro
    match conn.query_row(
        "SELECT value FROM local_meta WHERE key = ?1",
        [key],
        |r| r.get::<_, String>(0),
    ) {
        Ok(v) => Ok(v),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

fn set_meta(conn: &rusqlite::Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO local_meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Retorna (criando se necessário) um identificador persistente desta instalação/máquina.
/// Usado para vincular a ativação da licença a um único computador.
#[tauri::command]
pub fn get_machine_id(state: State<DbState>) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let existing = get_meta(&conn, KEY_MACHINE_ID)?;
    if !existing.is_empty() {
        return Ok(existing);
    }
    // Gera um id aleatório via SQLite (hex de 16 bytes aleatórios)
    let id: String = conn
        .query_row("SELECT lower(hex(randomblob(16)))", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    set_meta(&conn, KEY_MACHINE_ID, &id)?;
    Ok(id)
}

/// Retorna o estado local da licença (chave ativada e cache), se houver.
#[tauri::command]
pub fn get_local_license(state: State<DbState>) -> Result<Option<LocalLicense>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let raw = get_meta(&conn, KEY_LICENSE)?;
    if raw.is_empty() {
        return Ok(None);
    }
    let machine_id = get_meta(&conn, KEY_MACHINE_ID)?;
    let mut lic: LocalLicense = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    lic.machine_id = machine_id;
    Ok(Some(lic))
}

/// Salva o estado local da licença após ativação/verificação.
#[tauri::command]
pub fn save_local_license(
    state: State<DbState>,
    license: LocalLicense,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let machine_id = if license.machine_id.is_empty() {
        get_meta(&conn, KEY_MACHINE_ID)?
    } else {
        license.machine_id.clone()
    };
    let to_store = LocalLicense {
        machine_id: String::new(), // máquina fica em chave própria
        license_key: license.license_key,
        cache: license.cache,
    };
    let raw = serde_json::to_string(&to_store).map_err(|e| e.to_string())?;
    set_meta(&conn, KEY_LICENSE, &raw)?;
    if !machine_id.is_empty() {
        set_meta(&conn, KEY_MACHINE_ID, &machine_id)?;
    }
    Ok(())
}

/// Remove a ativação local (não remove o machine id).
#[tauri::command]
pub fn clear_local_license(state: State<DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    set_meta(&conn, KEY_LICENSE, "")?;
    Ok(())
}