use crate::db::DbState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug)]
pub struct CartItem {
    pub product_id: i64,
    pub name: String,
    pub category: String,
    pub unit_price: f64,
    pub quantity: i64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SaleItemRecord {
    pub id: i64,
    pub sale_id: i64,
    pub product_id: i64,
    pub product_name: String,
    pub unit_price: f64,
    pub quantity: i64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SaleRecord {
    pub id: i64,
    pub created_at: String,
    pub total: f64,
    pub payment_method: String,
    pub customer_id: Option<i64>,
    pub customer_name: Option<String>,
    pub customer_document: Option<String>,
    pub operator_name: String,
    pub canceled: bool,
    pub items_count: i64,
}

#[tauri::command]
pub fn finalize_sale(
    state: State<DbState>,
    items: Vec<CartItem>,
    payment_method: String,
    customer_id: Option<i64>,
    customer_document: Option<String>,
    operator_name: Option<String>,
) -> Result<SaleRecord, String> {
    if items.is_empty() {
        return Err("O carrinho está vazio".into());
    }

    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let total: f64 = items.iter().map(|i| i.unit_price * i.quantity as f64).sum();
    let now = Utc::now().to_rfc3339();
    let operator = operator_name.unwrap_or_else(|| "Operador".into());

    tx.execute(
        "INSERT INTO sales (created_at, total, payment_method, customer_id, customer_document, operator_name) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![now, total, payment_method, customer_id, customer_document, operator],
    )
    .map_err(|e| e.to_string())?;

    let sale_id = tx.last_insert_rowid();

    for item in &items {
        tx.execute(
            "INSERT INTO sale_items (sale_id, product_id, product_name, unit_price, quantity)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![sale_id, item.product_id, item.name, item.unit_price, item.quantity],
        )
        .map_err(|e| e.to_string())?;

        // Baixa automática de estoque
        tx.execute(
            "UPDATE products SET stock = stock - ?1 WHERE id = ?2",
            rusqlite::params![item.quantity, item.product_id],
        )
        .map_err(|e| e.to_string())?;

        tx.execute(
            "INSERT INTO stock_movements (product_id, delta, reason, created_at)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![item.product_id, -item.quantity, "Venda", now],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(SaleRecord {
        id: sale_id,
        created_at: now,
        total,
        payment_method,
        customer_id,
        customer_name: None,
        customer_document,
        operator_name: operator,
        canceled: false,
        items_count: items.len() as i64,
    })
}

#[tauri::command]
pub fn list_sales(state: State<DbState>, limit: i64) -> Result<Vec<SaleRecord>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT s.id, s.created_at, s.total, s.payment_method, s.customer_id, c.name,
                    s.customer_document, s.operator_name, s.canceled,
                    (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as items_count
             FROM sales s
             LEFT JOIN customers c ON s.customer_id = c.id
             ORDER BY s.id DESC
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([limit], |row| {
            Ok(SaleRecord {
                id: row.get(0)?,
                created_at: row.get(1)?,
                total: row.get(2)?,
                payment_method: row.get(3)?,
                customer_id: row.get(4)?,
                customer_name: row.get(5)?,
                customer_document: row.get(6)?,
                operator_name: row.get(7)?,
                canceled: row.get::<_, i64>(8)? != 0,
                items_count: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_sale_items(state: State<DbState>, sale_id: i64) -> Result<Vec<SaleItemRecord>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, sale_id, product_id, product_name, unit_price, quantity
             FROM sale_items
             WHERE sale_id = ?1
             ORDER BY id ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([sale_id], |row| {
            Ok(SaleItemRecord {
                id: row.get(0)?,
                sale_id: row.get(1)?,
                product_id: row.get(2)?,
                product_name: row.get(3)?,
                unit_price: row.get(4)?,
                quantity: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Cancela uma venda (estorna estoque)
#[tauri::command]
pub fn cancel_sale(state: State<DbState>, sale_id: i64) -> Result<(), String> {
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Verificar se já foi cancelada
    let canceled: i64 = tx
        .query_row(
            "SELECT canceled FROM sales WHERE id = ?1",
            [sale_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    if canceled != 0 {
        return Err("Esta venda já foi cancelada.".into());
    }

    // Marcar como cancelada
    tx.execute("UPDATE sales SET canceled = 1 WHERE id = ?1", [sale_id])
        .map_err(|e| e.to_string())?;

    // Estornar estoque
    let now = Utc::now().to_rfc3339();
    let mut stmt = tx
        .prepare("SELECT product_id, quantity FROM sale_items WHERE sale_id = ?1")
        .map_err(|e| e.to_string())?;

    let items: Vec<(i64, i64)> = stmt
        .query_map([sale_id], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    drop(stmt);

    for (product_id, quantity) in items {
        tx.execute(
            "UPDATE products SET stock = stock + ?1 WHERE id = ?2",
            rusqlite::params![quantity, product_id],
        )
        .map_err(|e| e.to_string())?;

        tx.execute(
            "INSERT INTO stock_movements (product_id, delta, reason, created_at) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![product_id, quantity, format!("Cancelamento venda #{}", sale_id), now],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
