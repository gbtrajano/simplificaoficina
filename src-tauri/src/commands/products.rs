use crate::db::DbState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug)]
pub struct Product {
    pub id: i64,
    pub name: String,
    pub category: String,
    pub price: f64,
    pub cost: f64,
    pub stock: i64,
    pub min_stock: i64,
    pub barcode: Option<String>,
    pub active: bool,
    pub unit_type: String,
    pub scale_prefix: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct NewProduct {
    pub name: String,
    pub category: String,
    pub price: f64,
    pub cost: f64,
    pub stock: i64,
    pub min_stock: i64,
    pub barcode: Option<String>,
    pub active: bool,
    pub unit_type: String,
    pub scale_prefix: String,
}

#[tauri::command]
pub fn list_products(state: State<DbState>, search: String) -> Result<Vec<Product>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", search);
    let mut stmt = conn
        .prepare(
            "SELECT id, name, category, price, cost, stock, min_stock, barcode, active, unit_type, scale_prefix
             FROM products
             WHERE active = 1 AND (name LIKE ?1 OR barcode LIKE ?1 OR scale_prefix LIKE ?1)
             ORDER BY name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([pattern], |row| {
            Ok(Product {
                id: row.get(0)?,
                name: row.get(1)?,
                category: row.get(2)?,
                price: row.get(3)?,
                cost: row.get(4)?,
                stock: row.get(5)?,
                min_stock: row.get(6)?,
                barcode: row.get(7)?,
                active: row.get::<_, i64>(8)? != 0,
                unit_type: row.get(9)?,
                scale_prefix: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_product(state: State<DbState>, product: NewProduct) -> Result<Product, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO products (name, category, price, cost, stock, min_stock, barcode, active, unit_type, scale_prefix)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            product.name,
            product.category,
            product.price,
            product.cost,
            product.stock,
            product.min_stock,
            product.barcode,
            product.active as i64,
            product.unit_type,
            product.scale_prefix,
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(Product {
        id,
        name: product.name,
        category: product.category,
        price: product.price,
        cost: product.cost,
        stock: product.stock,
        min_stock: product.min_stock,
        barcode: product.barcode,
        active: product.active,
        unit_type: product.unit_type,
        scale_prefix: product.scale_prefix,
    })
}

#[tauri::command]
pub fn update_product(state: State<DbState>, product: Product) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE products SET name=?1, category=?2, price=?3, cost=?4, stock=?5, min_stock=?6, barcode=?7, active=?8, unit_type=?9, scale_prefix=?10
         WHERE id=?11",
        rusqlite::params![
            product.name,
            product.category,
            product.price,
            product.cost,
            product.stock,
            product.min_stock,
            product.barcode,
            product.active as i64,
            product.unit_type,
            product.scale_prefix,
            product.id
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_product(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    // Soft delete para preservar histórico de vendas antigas
    conn.execute("UPDATE products SET active = 0 WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn adjust_stock(state: State<DbState>, id: i64, delta: i64, reason: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE products SET stock = stock + ?1 WHERE id = ?2",
        rusqlite::params![delta, id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO stock_movements (product_id, delta, reason, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, delta, reason, Utc::now().to_rfc3339()],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Busca produto por código de barras exato
#[tauri::command]
pub fn find_product_by_barcode(state: State<DbState>, barcode: String) -> Result<Option<Product>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, category, price, cost, stock, min_stock, barcode, active, unit_type, scale_prefix
             FROM products
             WHERE active = 1 AND barcode = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map([barcode], |row| {
            Ok(Product {
                id: row.get(0)?,
                name: row.get(1)?,
                category: row.get(2)?,
                price: row.get(3)?,
                cost: row.get(4)?,
                stock: row.get(5)?,
                min_stock: row.get(6)?,
                barcode: row.get(7)?,
                active: row.get::<_, i64>(8)? != 0,
                unit_type: row.get(9)?,
                scale_prefix: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.next().transpose().map_err(|e| e.to_string())
}

/// Decodifica código de barras de balança (EAN-13 com peso/preço embutido)
/// Formato típico: 2 + prefixo(5) + peso/preço(5) + dígito(1)
#[tauri::command]
pub fn decode_scale_barcode(state: State<DbState>, barcode: String) -> Result<Option<Product>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    // Tenta encontrar produto pelo prefixo do código de balança
    let mut stmt = conn
        .prepare(
            "SELECT id, name, category, price, cost, stock, min_stock, barcode, active, unit_type, scale_prefix
             FROM products
             WHERE active = 1 AND scale_prefix != '' AND ?1 LIKE scale_prefix || '%'",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map([barcode], |row| {
            Ok(Product {
                id: row.get(0)?,
                name: row.get(1)?,
                category: row.get(2)?,
                price: row.get(3)?,
                cost: row.get(4)?,
                stock: row.get(5)?,
                min_stock: row.get(6)?,
                barcode: row.get(7)?,
                active: row.get::<_, i64>(8)? != 0,
                unit_type: row.get(9)?,
                scale_prefix: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.next().transpose().map_err(|e| e.to_string())
}
