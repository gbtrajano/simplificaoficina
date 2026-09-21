use crate::db::DbState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::State;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StoreSettings {
    pub name: String,
    pub cnpj: String,
    pub phone: String,
    pub email: String,
    pub address: String,
    pub city: String,
    pub state: String,
    pub cep: String,
    pub inscription: String,
    pub display_message: String,
    pub logo: String, // data URL da logo (ex: data:image/png;base64,...) ou vazio
}

fn read_settings(conn: &rusqlite::Connection) -> Result<StoreSettings, String> {
    let mut stmt = conn
        .prepare(
            "SELECT name, cnpj, phone, email, address, city, state, cep, inscription, display_message, logo
             FROM store_settings WHERE id = 1",
        )
        .map_err(|e| e.to_string())?;

    let row = stmt
        .query_row([], |row| {
            Ok(StoreSettings {
                name: row.get(0)?,
                cnpj: row.get(1)?,
                phone: row.get(2)?,
                email: row.get(3)?,
                address: row.get(4)?,
                city: row.get(5)?,
                state: row.get(6)?,
                cep: row.get(7)?,
                inscription: row.get(8)?,
                display_message: row.get(9)?,
                logo: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(row)
}

/// Retorna as informações da loja (nome, CNPJ, telefone, etc.)
#[tauri::command]
pub fn get_store_settings(state: State<DbState>) -> Result<StoreSettings, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    read_settings(&conn)
}

/// Salva as informações da loja (não altera a logo — use upload_store_logo / remove_store_logo)
#[tauri::command]
pub fn save_store_settings(
    state: State<DbState>,
    settings: StoreSettings,
) -> Result<StoreSettings, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO store_settings (id, name, cnpj, phone, email, address, city, state, cep, inscription, display_message, updated_at)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            cnpj = excluded.cnpj,
            phone = excluded.phone,
            email = excluded.email,
            address = excluded.address,
            city = excluded.city,
            state = excluded.state,
            cep = excluded.cep,
            inscription = excluded.inscription,
            display_message = excluded.display_message,
            updated_at = excluded.updated_at",
        rusqlite::params![
            settings.name,
            settings.cnpj,
            settings.phone,
            settings.email,
            settings.address,
            settings.city,
            settings.state,
            settings.cep,
            settings.inscription,
            settings.display_message,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    read_settings(&conn)
}

const MAX_LOGO_BYTES: usize = 5 * 1024 * 1024; // 5 MB

/// Lê um arquivo de imagem, converte para data URL e salva como logo da loja
#[tauri::command]
pub fn upload_store_logo(state: State<DbState>, path: String) -> Result<StoreSettings, String> {
    let mime = match Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        Some("ico") => "image/x-icon",
        Some("svg") => "image/svg+xml",
        _ => {
            return Err(
                "Formato de imagem não suportado. Use PNG, JPG, GIF, WebP, BMP, ICO ou SVG.".into(),
            )
        }
    };

    let data = std::fs::read(&path).map_err(|e| format!("Não foi possível ler o arquivo: {e}"))?;
    if data.is_empty() {
        return Err("O arquivo de imagem está vazio.".into());
    }
    if data.len() > MAX_LOGO_BYTES {
        return Err("A imagem é muito grande. O tamanho máximo é 5 MB.".into());
    }

    let data_url = format!("data:{mime};base64,{}", base64_encode(&data));

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE store_settings SET logo = ?1 WHERE id = 1",
        rusqlite::params![data_url],
    )
    .map_err(|e| e.to_string())?;

    read_settings(&conn)
}

/// Remove a logo da loja
#[tauri::command]
pub fn remove_store_logo(state: State<DbState>) -> Result<StoreSettings, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE store_settings SET logo = '' WHERE id = 1",
        [],
    )
    .map_err(|e| e.to_string())?;

    read_settings(&conn)
}

/// Codificador base64 simples (padrão RFC 4648) — evita dependência extra no projeto
fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(CHARS[(n >> 18) as usize & 63] as char);
        out.push(CHARS[(n >> 12) as usize & 63] as char);
        if chunk.len() > 1 {
            out.push(CHARS[(n >> 6) as usize & 63] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(CHARS[n as usize & 63] as char);
        } else {
            out.push('=');
        }
    }
    out
}