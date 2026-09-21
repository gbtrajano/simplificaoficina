use crate::db::DbState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

pub const DISPLAY_WINDOW_LABEL: &str = "display";
pub const DISPLAY_STATE_EVENT: &str = "display-state";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DisplayState {
    pub cashier_open: bool,
    pub called_number: i64,
    pub waiting: i64,
    pub last_ticket: i64,
}

fn read_state(conn: &rusqlite::Connection) -> Result<DisplayState, String> {
    let mut stmt = conn
        .prepare(
            "SELECT cashier_open, called_number, waiting, last_ticket FROM display_state WHERE id = 1",
        )
        .map_err(|e| e.to_string())?;

    let row = stmt
        .query_row([], |row| {
            Ok(DisplayState {
                cashier_open: row.get::<_, i64>(0)? != 0,
                called_number: row.get(1)?,
                waiting: row.get(2)?,
                last_ticket: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(row)
}

fn update_state(conn: &rusqlite::Connection, st: &DisplayState) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE display_state SET cashier_open = ?1, called_number = ?2, waiting = ?3, last_ticket = ?4, updated_at = ?5 WHERE id = 1",
        rusqlite::params![
            if st.cashier_open { 1 } else { 0 },
            st.called_number,
            st.waiting,
            st.last_ticket,
            now
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn notify_display(app: &AppHandle, st: &DisplayState) {
    // Envia o novo estado para a janela de exibição (se estiver aberta)
    let _ = app.emit_to(DISPLAY_WINDOW_LABEL, DISPLAY_STATE_EVENT, st);
}

fn commit(app: &AppHandle, conn: &rusqlite::Connection, st: &DisplayState) -> Result<DisplayState, String> {
    update_state(conn, st)?;
    notify_display(app, st);
    Ok(st.clone())
}

/// Retorna o estado atual da exibição para clientes
#[tauri::command]
pub fn get_display_state(state: State<DbState>) -> Result<DisplayState, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    read_state(&conn)
}

/// Define se o caixa está aberto ou fechado (exibido para os clientes)
#[tauri::command]
pub fn set_cashier_open(
    app: AppHandle,
    state: State<DbState>,
    open: bool,
) -> Result<DisplayState, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut st = read_state(&conn)?;
    st.cashier_open = open;
    commit(&app, &conn, &st)
}

/// Registra um novo cliente na fila (emite uma senha)
#[tauri::command]
pub fn new_ticket(app: AppHandle, state: State<DbState>) -> Result<DisplayState, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut st = read_state(&conn)?;
    st.last_ticket += 1;
    st.waiting += 1;
    commit(&app, &conn, &st)
}

/// Chama o próximo cliente da fila
#[tauri::command]
pub fn call_next(app: AppHandle, state: State<DbState>) -> Result<DisplayState, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut st = read_state(&conn)?;
    if !st.cashier_open {
        return Err("O caixa está fechado. Abra o caixa antes de chamar clientes.".into());
    }
    if st.waiting > 0 {
        st.waiting -= 1;
        st.called_number = st.last_ticket - st.waiting;
    } else {
        // Fila vazia: mantém o último número chamado
        return Ok(st);
    }
    commit(&app, &conn, &st)
}

/// Rechama o último número chamado (clientes que não compareceram)
#[tauri::command]
pub fn recall_number(app: AppHandle, state: State<DbState>) -> Result<DisplayState, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let st = read_state(&conn)?;
    // Reemite o mesmo estado, para a tela reexibir o último número com destaque
    notify_display(&app, &st);
    Ok(st)
}

/// Zera a fila e o contador de senhas
#[tauri::command]
pub fn reset_display(app: AppHandle, state: State<DbState>) -> Result<DisplayState, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut st = read_state(&conn)?;
    st.called_number = 0;
    st.waiting = 0;
    st.last_ticket = 0;
    commit(&app, &conn, &st)
}

/// Consulta se a janela de exibição está aberta
#[tauri::command]
pub fn is_display_open(app: AppHandle) -> Result<bool, String> {
    Ok(app.get_webview_window(DISPLAY_WINDOW_LABEL).is_some())
}