use crate::db::DbState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug)]
pub struct Promotion {
    pub id: i64,
    pub name: String,
    pub promotion_type: String,
    pub product_id: Option<i64>,
    pub product_name: Option<String>,
    pub min_quantity: i64,
    pub discount_percent: f64,
    pub discount_amount: f64,
    pub buy_quantity: i64,
    pub pay_quantity: i64,
    pub wholesale_price: Option<f64>,
    pub start_date: String,
    pub end_date: String,
    pub active: bool,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct NewPromotion {
    pub name: String,
    pub promotion_type: String,
    pub product_id: Option<i64>,
    pub min_quantity: i64,
    pub discount_percent: f64,
    pub discount_amount: f64,
    pub buy_quantity: i64,
    pub pay_quantity: i64,
    pub wholesale_price: Option<f64>,
    pub start_date: String,
    pub end_date: String,
}

#[tauri::command]
pub fn list_promotions(state: State<DbState>) -> Result<Vec<Promotion>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().format("%Y-%m-%d").to_string();

    let mut stmt = conn
        .prepare(
            "SELECT pr.id, pr.name, pr.type, pr.product_id, p.name, pr.min_quantity,
                    pr.discount_percent, pr.discount_amount, pr.buy_quantity, pr.pay_quantity,
                    pr.wholesale_price, pr.start_date, pr.end_date, pr.active, pr.created_at
             FROM promotions pr
             LEFT JOIN products p ON pr.product_id = p.id
             WHERE pr.active = 1 AND pr.end_date >= ?1
             ORDER BY pr.name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([now], |row| {
            Ok(Promotion {
                id: row.get(0)?,
                name: row.get(1)?,
                promotion_type: row.get(2)?,
                product_id: row.get(3)?,
                product_name: row.get(4)?,
                min_quantity: row.get(5)?,
                discount_percent: row.get(6)?,
                discount_amount: row.get(7)?,
                buy_quantity: row.get(8)?,
                pay_quantity: row.get(9)?,
                wholesale_price: row.get(10)?,
                start_date: row.get(11)?,
                end_date: row.get(12)?,
                active: row.get::<_, i64>(13)? != 0,
                created_at: row.get(14)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_promotion(
    state: State<DbState>,
    promotion: NewPromotion,
    id: Option<i64>,
) -> Result<Promotion, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    if let Some(promo_id) = id {
        conn.execute(
            "UPDATE promotions SET name=?1, type=?2, product_id=?3, min_quantity=?4,
             discount_percent=?5, discount_amount=?6, buy_quantity=?7, pay_quantity=?8,
             wholesale_price=?9, start_date=?10, end_date=?11 WHERE id=?12",
            rusqlite::params![
                promotion.name, promotion.promotion_type, promotion.product_id,
                promotion.min_quantity, promotion.discount_percent, promotion.discount_amount,
                promotion.buy_quantity, promotion.pay_quantity, promotion.wholesale_price,
                promotion.start_date, promotion.end_date, promo_id,
            ],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "INSERT INTO promotions (name, type, product_id, min_quantity, discount_percent,
             discount_amount, buy_quantity, pay_quantity, wholesale_price, start_date, end_date, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            rusqlite::params![
                promotion.name, promotion.promotion_type, promotion.product_id,
                promotion.min_quantity, promotion.discount_percent, promotion.discount_amount,
                promotion.buy_quantity, promotion.pay_quantity, promotion.wholesale_price,
                promotion.start_date, promotion.end_date, now,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    let row_id = id.unwrap_or_else(|| conn.last_insert_rowid());
    let product_name: Option<String> = promotion
        .product_id
        .and_then(|pid| conn.query_row("SELECT name FROM products WHERE id = ?1", [pid], |r| r.get(0)).ok());

    Ok(Promotion {
        id: row_id,
        name: promotion.name,
        promotion_type: promotion.promotion_type,
        product_id: promotion.product_id,
        product_name,
        min_quantity: promotion.min_quantity,
        discount_percent: promotion.discount_percent,
        discount_amount: promotion.discount_amount,
        buy_quantity: promotion.buy_quantity,
        pay_quantity: promotion.pay_quantity,
        wholesale_price: promotion.wholesale_price,
        start_date: promotion.start_date,
        end_date: promotion.end_date,
        active: true,
        created_at: now,
    })
}

#[tauri::command]
pub fn delete_promotion(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM promotions WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn toggle_promotion(state: State<DbState>, id: i64, active: bool) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE promotions SET active = ?1 WHERE id = ?2", [active as i64, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
