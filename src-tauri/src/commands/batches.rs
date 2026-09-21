use crate::db::DbState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug)]
pub struct ProductBatch {
    pub id: i64,
    pub product_id: i64,
    pub product_name: Option<String>,
    pub batch_code: String,
    pub quantity: i64,
    pub expiry_date: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ExpiryAlert {
    pub batch: ProductBatch,
    pub days_until_expiry: i64,
    pub status: String, // "expired", "critical", "warning", "ok"
}

#[tauri::command]
pub fn list_batches(state: State<DbState>) -> Result<Vec<ProductBatch>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT pb.id, pb.product_id, p.name, pb.batch_code, pb.quantity, pb.expiry_date, pb.created_at
             FROM product_batches pb
             JOIN products p ON pb.product_id = p.id
             WHERE pb.quantity > 0
             ORDER BY pb.expiry_date ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ProductBatch {
                id: row.get(0)?,
                product_id: row.get(1)?,
                product_name: row.get(2)?,
                batch_code: row.get(3)?,
                quantity: row.get(4)?,
                expiry_date: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_batch(
    state: State<DbState>,
    product_id: i64,
    batch_code: String,
    quantity: i64,
    expiry_date: String,
) -> Result<ProductBatch, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO product_batches (product_id, batch_code, quantity, expiry_date, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![product_id, batch_code, quantity, expiry_date, now],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    let name: Option<String> = conn
        .query_row("SELECT name FROM products WHERE id = ?1", [product_id], |r| r.get(0))
        .ok();

    Ok(ProductBatch {
        id,
        product_id,
        product_name: name,
        batch_code,
        quantity,
        expiry_date,
        created_at: now,
    })
}

#[tauri::command]
pub fn get_expiry_alerts(state: State<DbState>) -> Result<Vec<ExpiryAlert>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().format("%Y-%m-%d").to_string();

    let mut stmt = conn
        .prepare(
            "SELECT pb.id, pb.product_id, p.name, pb.batch_code, pb.quantity, pb.expiry_date, pb.created_at,
                    CAST(julianday(pb.expiry_date) - julianday(?1) AS INTEGER) as days_left
             FROM product_batches pb
             JOIN products p ON pb.product_id = p.id
             WHERE pb.quantity > 0 AND pb.expiry_date <= date(?1, '+90 days')
             ORDER BY pb.expiry_date ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([now], |row| {
            let days_left: i64 = row.get(7)?;
            let status = if days_left < 0 {
                "expired"
            } else if days_left <= 7 {
                "critical"
            } else if days_left <= 30 {
                "warning"
            } else {
                "ok"
            };
            Ok(ExpiryAlert {
                batch: ProductBatch {
                    id: row.get(0)?,
                    product_id: row.get(1)?,
                    product_name: row.get(2)?,
                    batch_code: row.get(3)?,
                    quantity: row.get(4)?,
                    expiry_date: row.get(5)?,
                    created_at: row.get(6)?,
                },
                days_until_expiry: days_left,
                status: status.into(),
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_batch(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM product_batches WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
