use crate::db::DbState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug)]
pub struct Supplier {
    pub id: i64,
    pub name: String,
    pub company_name: String,
    pub document: String,
    pub phone: String,
    pub email: String,
    pub address: String,
    pub notes: String,
    pub active: bool,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct NewSupplier {
    pub name: String,
    pub company_name: String,
    pub document: String,
    pub phone: String,
    pub email: String,
    pub address: String,
    pub notes: String,
}

#[tauri::command]
pub fn list_suppliers(state: State<DbState>, search: String) -> Result<Vec<Supplier>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", search);
    let mut stmt = conn
        .prepare(
            "SELECT id, name, company_name, document, phone, email, address, notes, active, created_at
             FROM suppliers WHERE active = 1 AND (name LIKE ?1 OR company_name LIKE ?1 OR document LIKE ?1)
             ORDER BY name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([pattern], |row| {
            Ok(Supplier {
                id: row.get(0)?,
                name: row.get(1)?,
                company_name: row.get(2)?,
                document: row.get(3)?,
                phone: row.get(4)?,
                email: row.get(5)?,
                address: row.get(6)?,
                notes: row.get(7)?,
                active: row.get::<_, i64>(8)? != 0,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_supplier(state: State<DbState>, supplier: NewSupplier) -> Result<Supplier, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO suppliers (name, company_name, document, phone, email, address, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            supplier.name, supplier.company_name, supplier.document,
            supplier.phone, supplier.email, supplier.address, supplier.notes, now,
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(Supplier {
        id,
        name: supplier.name,
        company_name: supplier.company_name,
        document: supplier.document,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        notes: supplier.notes,
        active: true,
        created_at: now,
    })
}

#[tauri::command]
pub fn delete_supplier(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE suppliers SET active = 0 WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
