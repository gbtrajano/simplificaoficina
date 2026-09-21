use crate::db::DbState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug)]
pub struct Account {
    pub id: i64,
    pub account_type: String,
    pub description: String,
    pub amount: f64,
    pub due_date: String,
    pub paid: bool,
    pub paid_date: Option<String>,
    pub supplier_id: Option<i64>,
    pub customer_id: Option<i64>,
    pub notes: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CashFlowEntry {
    pub date: String,
    pub inflow: f64,
    pub outflow: f64,
    pub balance: f64,
}

#[tauri::command]
pub fn list_accounts(
    state: State<DbState>,
    account_type: String,
) -> Result<Vec<Account>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, type, description, amount, due_date, paid, paid_date,
                    supplier_id, customer_id, notes, created_at
             FROM accounts WHERE type = ?1
             ORDER BY due_date ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([account_type], |row| {
            Ok(Account {
                id: row.get(0)?,
                account_type: row.get(1)?,
                description: row.get(2)?,
                amount: row.get(3)?,
                due_date: row.get(4)?,
                paid: row.get::<_, i64>(5)? != 0,
                paid_date: row.get(6)?,
                supplier_id: row.get(7)?,
                customer_id: row.get(8)?,
                notes: row.get(9)?,
                created_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_account(
    state: State<DbState>,
    account_type: String,
    description: String,
    amount: f64,
    due_date: String,
    supplier_id: Option<i64>,
    customer_id: Option<i64>,
    notes: String,
) -> Result<Account, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO accounts (type, description, amount, due_date, supplier_id, customer_id, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![account_type, description, amount, due_date, supplier_id, customer_id, notes, now],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(Account {
        id,
        account_type,
        description,
        amount,
        due_date,
        paid: false,
        paid_date: None,
        supplier_id,
        customer_id,
        notes,
        created_at: now,
    })
}

#[tauri::command]
pub fn pay_account(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().format("%Y-%m-%d").to_string();
    conn.execute(
        "UPDATE accounts SET paid = 1, paid_date = ?1 WHERE id = ?2",
        rusqlite::params![now, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_account(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM accounts WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn cash_flow(state: State<DbState>, days: i64) -> Result<Vec<CashFlowEntry>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let modifier = format!("-{} days", days);

    // Sales inflow by day
    let mut inflow_map: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    {
        let mut stmt = conn
            .prepare("SELECT date(created_at), SUM(total) FROM sales WHERE canceled = 0 AND created_at >= date('now', ?1) GROUP BY date(created_at)")
            .map_err(|e| e.to_string())?;
        let rows = stmt.query_map([&modifier], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| e.to_string())?;
        for r in rows {
            let (d, t): (String, f64) = r.map_err(|e| e.to_string())?;
            inflow_map.insert(d, t);
        }
    }

    // Accounts outflow by day
    let mut outflow_map: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    {
        let mut stmt = conn
            .prepare("SELECT due_date, SUM(amount) FROM accounts WHERE type = 'payable' AND paid = 1 AND paid_date >= date('now', ?1) GROUP BY due_date")
            .map_err(|e| e.to_string())?;
        let rows = stmt.query_map([&modifier], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| e.to_string())?;
        for r in rows {
            let (d, t): (String, f64) = r.map_err(|e| e.to_string())?;
            outflow_map.insert(d, t);
        }
    }

    // Merge dates
    let mut all_dates: Vec<String> = inflow_map.keys().chain(outflow_map.keys()).cloned().collect();
    all_dates.sort();
    all_dates.dedup();

    let mut result = Vec::new();
    let mut running_balance = 0.0;
    for date in all_dates {
        let inflow = inflow_map.get(&date).copied().unwrap_or(0.0);
        let outflow = outflow_map.get(&date).copied().unwrap_or(0.0);
        running_balance += inflow - outflow;
        result.push(CashFlowEntry {
            date,
            inflow,
            outflow,
            balance: running_balance,
        });
    }

    Ok(result)
}
