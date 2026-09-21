use crate::db::DbState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug)]
pub struct Quote {
    pub id: i64,
    pub customer_name: String,
    pub customer_document: String,
    pub total: f64,
    pub status: String,
    pub notes: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct QuoteItem {
    pub id: i64,
    pub quote_id: i64,
    pub product_id: i64,
    pub product_name: String,
    pub unit_price: f64,
    pub quantity: i64,
}

#[tauri::command]
pub fn list_quotes(state: State<DbState>) -> Result<Vec<Quote>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, customer_name, customer_document, total, status, notes, created_at
             FROM quotes ORDER BY id DESC LIMIT 100",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Quote {
                id: row.get(0)?,
                customer_name: row.get(1)?,
                customer_document: row.get(2)?,
                total: row.get(3)?,
                status: row.get(4)?,
                notes: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_quote(
    state: State<DbState>,
    customer_name: String,
    customer_document: String,
    items: Vec<QuoteItem>,
    notes: String,
) -> Result<Quote, String> {
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    let total: f64 = items.iter().map(|i| i.unit_price * i.quantity as f64).sum();

    tx.execute(
        "INSERT INTO quotes (customer_name, customer_document, total, notes, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![customer_name, customer_document, total, notes, now],
    )
    .map_err(|e| e.to_string())?;

    let quote_id = tx.last_insert_rowid();

    for item in &items {
        tx.execute(
            "INSERT INTO quote_items (quote_id, product_id, product_name, unit_price, quantity) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![quote_id, item.product_id, item.product_name, item.unit_price, item.quantity],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(Quote {
        id: quote_id,
        customer_name,
        customer_document,
        total,
        status: "pending".into(),
        notes,
        created_at: now,
    })
}

#[tauri::command]
pub fn delete_quote(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM quote_items WHERE quote_id = ?1", [id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM quotes WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
