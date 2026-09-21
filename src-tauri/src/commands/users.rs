use crate::db::DbState;
use chrono::Utc;
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use tauri::State;

#[derive(Default)]
pub struct UserSessionState(pub Mutex<Option<i64>>);

fn require_store_admin(conn: &rusqlite::Connection, user_id: Option<i64>) -> Result<(), String> {
    let allowed: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM users WHERE id = ?1 AND active = 1 AND role = 'admin')",
            [user_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if allowed {
        Ok(())
    } else {
        Err("Entre como responsável da loja para gerenciar usuários.".into())
    }
}

fn authorize_user_creation(
    conn: &rusqlite::Connection,
    user_id: Option<i64>,
    role: &str,
) -> Result<bool, String> {
    let total: i64 = conn
        .query_row("SELECT count(*) FROM users", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    if total == 0 {
        if role != "admin" {
            return Err("O primeiro usuário deve ser o responsável da loja.".into());
        }
        return Ok(true);
    }
    require_store_admin(conn, user_id)?;
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn database() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE users(id INTEGER PRIMARY KEY, role TEXT, active INTEGER);",
        )
        .unwrap();
        conn
    }

    #[test]
    fn first_access_creates_only_a_store_admin() {
        let conn = database();
        assert!(authorize_user_creation(&conn, None, "admin").unwrap());
        assert!(authorize_user_creation(&conn, None, "operator").is_err());
    }

    #[test]
    fn existing_store_requires_an_authenticated_admin() {
        let conn = database();
        conn.execute("INSERT INTO users VALUES(1, 'admin', 1)", [])
            .unwrap();
        assert!(authorize_user_creation(&conn, None, "admin").is_err());
        assert!(!authorize_user_creation(&conn, Some(1), "operator").unwrap());
    }

    #[test]
    fn disabled_users_do_not_reopen_first_access() {
        let conn = database();
        conn.execute("INSERT INTO users VALUES(1, 'admin', 0)", [])
            .unwrap();
        assert!(authorize_user_creation(&conn, None, "admin").is_err());
        assert!(authorize_user_creation(&conn, Some(1), "admin").is_err());
    }

    #[test]
    fn operator_cannot_create_an_admin() {
        let conn = database();
        conn.execute("INSERT INTO users VALUES(1, 'operator', 1)", [])
            .unwrap();
        assert!(authorize_user_creation(&conn, Some(1), "admin").is_err());
    }
}

// Iterações do hash de senha (PBKDF2-like com SHA-256)
const HASH_ITERATIONS: u32 = 10_000;

#[derive(Serialize, Deserialize, Debug)]
pub struct User {
    pub id: i64,
    pub name: String,
    pub login: String,
    pub role: String,
    pub active: bool,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AuditLog {
    pub id: i64,
    pub user_id: Option<i64>,
    pub user_name: String,
    pub action: String,
    pub details: String,
    pub terminal: String,
    pub created_at: String,
}

fn random_salt_hex(conn: &rusqlite::Connection) -> Result<String, String> {
    conn.query_row("SELECT hex(randomblob(16))", [], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())
}

/// Deriva o hash de uma senha: iter = sha256(salt || senha) repetido N vezes
fn hash_password(password: &str, salt_hex: &str, iterations: u32) -> String {
    let mut hasher = Sha256::new();
    hasher.update(salt_hex.as_bytes());
    hasher.update(password.as_bytes());
    let mut h = hasher.finalize();

    for _ in 0..iterations.saturating_sub(1) {
        let mut next = Sha256::new();
        next.update(h);
        h = next.finalize();
    }
    hex_string(&h)
}

fn hex_string(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn verify_password(password: &str, stored: &str) -> bool {
    // formato: iterações$salt$hash
    let parts: Vec<&str> = stored.split('$').collect();
    if parts.len() != 3 {
        return false;
    }
    let iterations: u32 = match parts[0].parse() {
        Ok(n) => n,
        Err(_) => return false,
    };
    let salt = parts[1];
    let expected = parts[2];
    hash_password(password, salt, iterations) == expected
}

#[tauri::command]
pub fn list_users(state: State<DbState>) -> Result<Vec<User>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, login, role, active, created_at FROM users WHERE active = 1 ORDER BY name ASC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(User {
                id: row.get(0)?,
                name: row.get(1)?,
                login: row.get(2)?,
                role: row.get(3)?,
                active: row.get::<_, i64>(4)? != 0,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_user(
    state: State<DbState>,
    session: State<UserSessionState>,
    name: String,
    login: String,
    password: String,
    role: String,
) -> Result<User, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut authenticated = session.0.lock().map_err(|e| e.to_string())?;
    let first_access = authorize_user_creation(&conn, *authenticated, &role)?;
    let now = Utc::now().to_rfc3339();
    let salt = random_salt_hex(&conn)?;
    let hash = hash_password(&password, &salt, HASH_ITERATIONS);
    let stored = format!("{HASH_ITERATIONS}${salt}${hash}");

    // Validação básica
    if name.trim().is_empty() || login.trim().is_empty() {
        return Err("Nome e login são obrigatórios.".into());
    }
    if password.len() < 4 {
        return Err("A senha deve ter pelo menos 4 caracteres.".into());
    }
    if role != "operator" && role != "supervisor" && role != "manager" && role != "admin" {
        return Err("Perfil inválido.".into());
    }

    // Reativa um cadastro desativado quando o mesmo login Ã© informado novamente.
    if let Some((existing_id, active)) = conn
        .query_row(
            "SELECT id, active FROM users WHERE login = ?1",
            [&login],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)? != 0)),
        )
        .optional()
        .map_err(|e| e.to_string())?
    {
        if active {
            return Err("JÃ¡ existe um usuÃ¡rio com este login.".into());
        }

        conn.execute(
            "UPDATE users
             SET name = ?1, password_hash = ?2, role = ?3, active = 1
             WHERE id = ?4",
            rusqlite::params![name, stored, role, existing_id],
        )
        .map_err(|e| e.to_string())?;

        return Ok(User {
            id: existing_id,
            name,
            login,
            role,
            active: true,
            created_at: now,
        });
    }

    conn.execute(
        "INSERT INTO users (name, login, password_hash, role, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![name, login, stored, role, now],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Já existe um usuário com este login.".into()
        } else {
            e.to_string()
        }
    })?;

    let id = conn.last_insert_rowid();
    if first_access {
        *authenticated = Some(id);
    }
    Ok(User {
        id,
        name,
        login,
        role,
        active: true,
        created_at: now,
    })
}

/// Autentica um usuário pelo login e senha (papéis locais da loja)
#[tauri::command]
pub fn authenticate_user(
    state: State<DbState>,
    session: State<UserSessionState>,
    login: String,
    password: String,
) -> Result<User, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let user = {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, login, password_hash, role, active, created_at FROM users WHERE login = ?1",
            )
            .map_err(|e| e.to_string())?;

        let mut rows = stmt
            .query_map([login], |row| {
                Ok((
                    User {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        login: row.get(2)?,
                        role: row.get(4)?,
                        active: row.get::<_, i64>(5)? != 0,
                        created_at: row.get(6)?,
                    },
                    row.get::<_, String>(3)?, // password_hash
                ))
            })
            .map_err(|e| e.to_string())?;

        rows.next().transpose().map_err(|e| e.to_string())?
    };

    let (user, stored) = user.ok_or_else(|| "Usuário ou senha inválidos.".to_string())?;
    if !user.active {
        return Err("Este usuário está desativado.".into());
    }

    let is_legacy = !stored.contains('$');
    let valid = if is_legacy {
        // Bancos antigos guardavam a senha em texto puro — aceita e converte para hash
        stored == password
    } else {
        verify_password(&password, &stored)
    };
    if !valid {
        return Err("Usuário ou senha inválidos.".into());
    }

    // Atualiza automaticamente senhas legadas para o formato com hash
    if is_legacy {
        let salt = random_salt_hex(&conn)?;
        let hash = hash_password(&password, &salt, HASH_ITERATIONS);
        let new_stored = format!("{HASH_ITERATIONS}${salt}${hash}");
        conn.execute(
            "UPDATE users SET password_hash = ?1 WHERE id = ?2",
            rusqlite::params![new_stored, user.id],
        )
        .map_err(|e| e.to_string())?;
    }

    *session.0.lock().map_err(|e| e.to_string())? = Some(user.id);
    Ok(user)
}

#[tauri::command]
pub fn get_current_user(
    state: State<DbState>,
    session: State<UserSessionState>,
) -> Result<Option<User>, String> {
    use rusqlite::OptionalExtension;
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let id = *session.0.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, name, login, role, active, created_at FROM users WHERE id = ?1 AND active = 1",
        [id],
        |row| {
            Ok(User {
                id: row.get(0)?,
                name: row.get(1)?,
                login: row.get(2)?,
                role: row.get(3)?,
                active: true,
                created_at: row.get(5)?,
            })
        },
    )
    .optional()
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn logout_user(session: State<UserSessionState>) -> Result<(), String> {
    *session.0.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}

#[tauri::command]
pub fn delete_user(
    state: State<DbState>,
    session: State<UserSessionState>,
    id: i64,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let authenticated = *session.0.lock().map_err(|e| e.to_string())?;
    require_store_admin(&conn, authenticated)?;
    if authenticated == Some(id) {
        return Err("Você não pode desativar seu próprio acesso.".into());
    }
    let changed = conn
        .execute("UPDATE users SET active = 0 WHERE id = ?1 AND active = 1", [id])
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("Usuário não encontrado ou já desativado.".into());
    }
    Ok(())
}

// ====== AUDIT LOGS ======

#[tauri::command]
pub fn list_audit_logs(state: State<DbState>, limit: i64) -> Result<Vec<AuditLog>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, user_id, user_name, action, details, terminal, created_at
             FROM audit_logs ORDER BY id DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([limit], |row| {
            Ok(AuditLog {
                id: row.get(0)?,
                user_id: row.get(1)?,
                user_name: row.get(2)?,
                action: row.get(3)?,
                details: row.get(4)?,
                terminal: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_audit_log(
    state: State<DbState>,
    user_id: Option<i64>,
    user_name: String,
    action: String,
    details: String,
    terminal: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO audit_logs (user_id, user_name, action, details, terminal, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![user_id, user_name, action, details, terminal, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
