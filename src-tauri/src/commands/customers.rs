use crate::db::DbState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug)]
pub struct Customer {
    pub id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub document: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct NewCustomer {
    pub name: String,
    pub phone: Option<String>,
    pub document: Option<String>,
    pub notes: Option<String>,
}

#[tauri::command]
pub fn list_customers(state: State<DbState>, search: String) -> Result<Vec<Customer>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", search);
    let mut stmt = conn
        .prepare(
            "SELECT id, name, phone, document, notes FROM customers
             WHERE name LIKE ?1 ORDER BY name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([pattern], |row| {
            Ok(Customer {
                id: row.get(0)?,
                name: row.get(1)?,
                phone: row.get(2)?,
                document: row.get(3)?,
                notes: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_customer(state: State<DbState>, customer: NewCustomer) -> Result<Customer, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let name = customer.name.trim().to_string();
    if name.is_empty() {
        return Err("Informe o nome do cliente.".into());
    }
    let phone = customer.phone.and_then(|value| {
        let value = value.trim().to_string();
        (!value.is_empty()).then_some(value)
    });
    let document = customer.document.and_then(|value| {
        let value = value.trim().to_string();
        (!value.is_empty()).then_some(value)
    });
    let notes = customer.notes.and_then(|value| {
        let value = value.trim().to_string();
        (!value.is_empty()).then_some(value)
    });
    conn.execute(
        "INSERT INTO customers (name, phone, document, notes) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![name, phone, document, notes],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(Customer {
        id,
        name,
        phone,
        document,
        notes,
    })
}
