use crate::db::DbState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug)]
pub struct PurchaseOrder {
    pub id: i64,
    pub supplier_id: Option<i64>,
    pub supplier_name: Option<String>,
    pub total: f64,
    pub status: String,
    pub notes: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PurchaseItem {
    pub id: i64,
    pub order_id: i64,
    pub product_id: i64,
    pub product_name: String,
    pub quantity: i64,
    pub unit_cost: f64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct LossRecord {
    pub id: i64,
    pub product_id: i64,
    pub product_name: Option<String>,
    pub quantity: i64,
    pub reason: String,
    pub description: String,
    pub value: f64,
    pub created_at: String,
}

// ====== PURCHASE ORDERS ======

#[tauri::command]
pub fn list_purchase_orders(state: State<DbState>) -> Result<Vec<PurchaseOrder>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT po.id, po.supplier_id, s.name, po.total, po.status, po.notes, po.created_at
             FROM purchase_orders po
             LEFT JOIN suppliers s ON po.supplier_id = s.id
             ORDER BY po.id DESC LIMIT 100",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(PurchaseOrder {
                id: row.get(0)?,
                supplier_id: row.get(1)?,
                supplier_name: row.get(2)?,
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
pub fn create_purchase_order(
    state: State<DbState>,
    supplier_id: Option<i64>,
    items: Vec<PurchaseItem>,
    notes: String,
) -> Result<PurchaseOrder, String> {
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    let total: f64 = items.iter().map(|i| i.unit_cost * i.quantity as f64).sum();

    tx.execute(
        "INSERT INTO purchase_orders (supplier_id, total, notes, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![supplier_id, total, notes, now],
    )
    .map_err(|e| e.to_string())?;

    let order_id = tx.last_insert_rowid();

    for item in &items {
        tx.execute(
            "INSERT INTO purchase_items (order_id, product_id, product_name, quantity, unit_cost) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![order_id, item.product_id, item.product_name, item.quantity, item.unit_cost],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(PurchaseOrder {
        id: order_id,
        supplier_id,
        supplier_name: None,
        total,
        status: "pending".into(),
        notes,
        created_at: now,
    })
}

#[tauri::command]
pub fn receive_purchase_order(state: State<DbState>, order_id: i64) -> Result<(), String> {
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    // Get items
    let items: Vec<(i64, i64, i64)> = {
        let mut stmt = tx
            .prepare("SELECT product_id, quantity, unit_cost FROM purchase_items WHERE order_id = ?1")
            .map_err(|e| e.to_string())?;
        let result: Vec<(i64, i64, i64)> = stmt
            .query_map([order_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        result
    };

    for (product_id, quantity, _unit_cost) in &items {
        tx.execute(
            "UPDATE products SET stock = stock + ?1 WHERE id = ?2",
            rusqlite::params![quantity, product_id],
        )
        .map_err(|e| e.to_string())?;

        tx.execute(
            "INSERT INTO stock_movements (product_id, delta, reason, created_at) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![product_id, quantity, format!("Entrada compra #{}", order_id), now],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.execute(
        "UPDATE purchase_orders SET status = 'received' WHERE id = ?1",
        [order_id],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

// ====== LOSSES ======

#[tauri::command]
pub fn list_losses(state: State<DbState>) -> Result<Vec<LossRecord>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT l.id, l.product_id, p.name, l.quantity, l.reason, l.description, l.value, l.created_at
             FROM losses l
             LEFT JOIN products p ON l.product_id = p.id
             ORDER BY l.created_at DESC LIMIT 200",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(LossRecord {
                id: row.get(0)?,
                product_id: row.get(1)?,
                product_name: row.get(2)?,
                quantity: row.get(3)?,
                reason: row.get(4)?,
                description: row.get(5)?,
                value: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn register_loss(
    state: State<DbState>,
    product_id: i64,
    quantity: i64,
    reason: String,
    description: String,
    value: f64,
) -> Result<LossRecord, String> {
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    tx.execute(
        "INSERT INTO losses (product_id, quantity, reason, description, value, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![product_id, quantity, reason, description, value, now],
    )
    .map_err(|e| e.to_string())?;

    let id = tx.last_insert_rowid();

    tx.execute(
        "UPDATE products SET stock = MAX(0, stock - ?1) WHERE id = ?2",
        rusqlite::params![quantity, product_id],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO stock_movements (product_id, delta, reason, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![product_id, -quantity, format!("Perda: {}", reason), now],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    let product_name: Option<String> = {
        let c = state.0.lock().map_err(|e| e.to_string())?;
        c.query_row("SELECT name FROM products WHERE id = ?1", [product_id], |r| r.get(0)).ok()
    };

    Ok(LossRecord {
        id,
        product_id,
        product_name,
        quantity,
        reason,
        description,
        value,
        created_at: now,
    })
}
