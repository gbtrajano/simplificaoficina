use crate::db::DbState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug)]
pub struct CashRegister {
    pub id: i64,
    pub opened_at: String,
    pub closed_at: Option<String>,
    pub opening_amount: f64,
    pub closing_amount: Option<f64>,
    pub expected_amount: Option<f64>,
    pub operator_name: String,
    pub status: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CashMovement {
    pub id: i64,
    pub register_id: i64,
    pub movement_type: String,
    pub amount: f64,
    pub description: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ClosingReport {
    pub register: CashRegister,
    pub movements: Vec<CashMovement>,
    pub sales_by_payment: Vec<PaymentSummary>,
    pub total_sales: f64,
    pub total_supplies: f64,
    pub total_withdrawals: f64,
    pub expected_in_drawer: f64,
    pub actual_in_drawer: f64,
    pub difference: f64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PaymentSummary {
    pub payment_method: String,
    pub total: f64,
    pub count: i64,
}

/// Abre um novo caixa
#[tauri::command]
pub fn open_cash_register(
    state: State<DbState>,
    opening_amount: f64,
    operator_name: String,
) -> Result<CashRegister, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Verificar se já existe caixa aberto
    let open_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM cash_registers WHERE status = 'open'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    if open_count > 0 {
        return Err("Já existe um caixa aberto. Feche o caixa atual antes de abrir um novo.".into());
    }

    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO cash_registers (opened_at, opening_amount, operator_name, status) VALUES (?1, ?2, ?3, 'open')",
        rusqlite::params![now, opening_amount, operator_name],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(CashRegister {
        id,
        opened_at: now,
        closed_at: None,
        opening_amount,
        closing_amount: None,
        expected_amount: None,
        operator_name,
        status: "open".into(),
    })
}

/// Registra suprimento (entrada de dinheiro)
#[tauri::command]
pub fn supply_cash(
    state: State<DbState>,
    register_id: i64,
    amount: f64,
    description: String,
) -> Result<CashMovement, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO cash_movements (register_id, type, amount, description, created_at) VALUES (?1, 'supply', ?2, ?3, ?4)",
        rusqlite::params![register_id, amount, description, now],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(CashMovement {
        id,
        register_id,
        movement_type: "supply".into(),
        amount,
        description,
        created_at: now,
    })
}

/// Registra sangria (retirada de dinheiro)
#[tauri::command]
pub fn withdraw_cash(
    state: State<DbState>,
    register_id: i64,
    amount: f64,
    description: String,
) -> Result<CashMovement, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO cash_movements (register_id, type, amount, description, created_at) VALUES (?1, 'withdrawal', ?2, ?3, ?4)",
        rusqlite::params![register_id, amount, description, now],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(CashMovement {
        id,
        register_id,
        movement_type: "withdrawal".into(),
        amount,
        description,
        created_at: now,
    })
}

/// Fecha o caixa com conciliação
#[tauri::command]
pub fn close_cash_register(
    state: State<DbState>,
    register_id: i64,
    closing_amount: f64,
) -> Result<ClosingReport, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    // Buscar dados do caixa
    let register = {
        let mut stmt = conn
            .prepare(
                "SELECT id, opened_at, closed_at, opening_amount, closing_amount, expected_amount, operator_name, status
                 FROM cash_registers WHERE id = ?1",
            )
            .map_err(|e| e.to_string())?;

        let mut rows = stmt
            .query_map([register_id], |row| {
                Ok(CashRegister {
                    id: row.get(0)?,
                    opened_at: row.get(1)?,
                    closed_at: row.get(2)?,
                    opening_amount: row.get(3)?,
                    closing_amount: row.get(4)?,
                    expected_amount: row.get(5)?,
                    operator_name: row.get(6)?,
                    status: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?;

        rows.next()
            .ok_or("Caixa não encontrado")?
            .map_err(|e| e.to_string())?
    };

    if register.status != "open" {
        return Err("Este caixa já foi fechado.".into());
    }

    // Calcular total de vendas no período
    let total_sales: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total), 0) FROM sales WHERE canceled = 0 AND created_at >= ?1",
            rusqlite::params![register.opened_at],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Calcular suprimentos e sangrias
    let total_supplies: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM cash_movements WHERE register_id = ?1 AND type = 'supply'",
            rusqlite::params![register_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_withdrawals: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM cash_movements WHERE register_id = ?1 AND type = 'withdrawal'",
            rusqlite::params![register_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Vendas por forma de pagamento
    let sales_by_payment = {
        let mut stmt = conn
            .prepare(
                "SELECT payment_method, SUM(total), COUNT(*) FROM sales WHERE canceled = 0 AND created_at >= ?1 GROUP BY payment_method ORDER BY payment_method",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([register.opened_at.clone()], |row| {
                Ok(PaymentSummary {
                    payment_method: row.get(0)?,
                    total: row.get(1)?,
                    count: row.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?;

        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    // Valor esperado no caixa = abertura + vendas dinheiro - sangrias + suprimentos
    let cash_sales: f64 = sales_by_payment
        .iter()
        .filter(|s| s.payment_method == "Dinheiro")
        .map(|s| s.total)
        .sum();

    let expected = register.opening_amount + cash_sales + total_supplies - total_withdrawals;
    let difference = closing_amount - expected;

    // Atualizar caixa
    conn.execute(
        "UPDATE cash_registers SET closed_at = ?1, closing_amount = ?2, expected_amount = ?3, status = 'closed' WHERE id = ?4",
        rusqlite::params![now, closing_amount, expected, register_id],
    )
    .map_err(|e| e.to_string())?;

    // Buscar movimentações
    let movements = {
        let mut stmt = conn
            .prepare(
                "SELECT id, register_id, type, amount, description, created_at FROM cash_movements WHERE register_id = ?1 ORDER BY created_at",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([register_id], |row| {
                Ok(CashMovement {
                    id: row.get(0)?,
                    register_id: row.get(1)?,
                    movement_type: row.get(2)?,
                    amount: row.get(3)?,
                    description: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;

        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    Ok(ClosingReport {
        register: CashRegister {
            id: register.id,
            opened_at: register.opened_at,
            closed_at: Some(now),
            opening_amount: register.opening_amount,
            closing_amount: Some(closing_amount),
            expected_amount: Some(expected),
            operator_name: register.operator_name,
            status: "closed".into(),
        },
        movements,
        sales_by_payment,
        total_sales,
        total_supplies,
        total_withdrawals,
        expected_in_drawer: expected,
        actual_in_drawer: closing_amount,
        difference,
    })
}

/// Retorna o caixa aberto atual
#[tauri::command]
pub fn get_open_register(state: State<DbState>) -> Result<Option<CashRegister>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, opened_at, closed_at, opening_amount, closing_amount, expected_amount, operator_name, status
             FROM cash_registers WHERE status = 'open' ORDER BY id DESC LIMIT 1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map([], |row| {
            Ok(CashRegister {
                id: row.get(0)?,
                opened_at: row.get(1)?,
                closed_at: row.get(2)?,
                opening_amount: row.get(3)?,
                closing_amount: row.get(4)?,
                expected_amount: row.get(5)?,
                operator_name: row.get(6)?,
                status: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(rows.next().transpose().map_err(|e| e.to_string())?)
}

/// Lista movimentações do caixa
#[tauri::command]
pub fn list_cash_movements(
    state: State<DbState>,
    register_id: i64,
) -> Result<Vec<CashMovement>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, register_id, type, amount, description, created_at
             FROM cash_movements WHERE register_id = ?1 ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([register_id], |row| {
            Ok(CashMovement {
                id: row.get(0)?,
                register_id: row.get(1)?,
                movement_type: row.get(2)?,
                amount: row.get(3)?,
                description: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Lista caixas anteriores
#[tauri::command]
pub fn list_cash_registers(state: State<DbState>) -> Result<Vec<CashRegister>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, opened_at, closed_at, opening_amount, closing_amount, expected_amount, operator_name, status
             FROM cash_registers ORDER BY id DESC LIMIT 50",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(CashRegister {
                id: row.get(0)?,
                opened_at: row.get(1)?,
                closed_at: row.get(2)?,
                opening_amount: row.get(3)?,
                closing_amount: row.get(4)?,
                expected_amount: row.get(5)?,
                operator_name: row.get(6)?,
                status: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}
