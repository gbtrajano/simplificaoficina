use crate::db::DbState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug)]
pub struct DailySummary {
    pub date: String,
    pub total: f64,
    pub sales_count: i64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TopProduct {
    pub name: String,
    pub qty: i64,
    pub total: f64,
}

#[tauri::command]
pub fn daily_summary(state: State<DbState>, days: i64) -> Result<Vec<DailySummary>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT date(created_at) as d, SUM(total), COUNT(*)
             FROM sales
             WHERE date(created_at) >= date('now', ?1)
             GROUP BY d
             ORDER BY d ASC",
        )
        .map_err(|e| e.to_string())?;

    let modifier = format!("-{} days", days);
    let rows = stmt
        .query_map([modifier], |row| {
            Ok(DailySummary {
                date: row.get(0)?,
                total: row.get(1)?,
                sales_count: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn top_products(state: State<DbState>, limit: i64) -> Result<Vec<TopProduct>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT product_name, SUM(quantity) as qty, SUM(quantity * unit_price) as total
             FROM sale_items si
             JOIN sales s ON si.sale_id = s.id
             WHERE s.canceled = 0
             GROUP BY product_name
             ORDER BY qty DESC
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([limit], |row| {
            Ok(TopProduct {
                name: row.get(0)?,
                qty: row.get(1)?,
                total: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Curva ABC: produtos ordenados por receita, com % acumulado
#[derive(Serialize, Deserialize, Debug)]
pub struct AbcProduct {
    pub name: String,
    pub qty: i64,
    pub total: f64,
    pub cost_total: f64,
    pub margin: f64,
    pub percentage: f64,
    pub accumulated: f64,
    pub classification: String,
}

#[tauri::command]
pub fn abc_curve(state: State<DbState>, days: i64) -> Result<Vec<AbcProduct>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let modifier = format!("-{} days", days);

    let mut stmt = conn
        .prepare(
            "SELECT si.product_name, SUM(si.quantity) as qty, SUM(si.quantity * si.unit_price) as total,
                    SUM(si.quantity * p.cost) as cost_total
             FROM sale_items si
             JOIN sales s ON si.sale_id = s.id
             JOIN products p ON si.product_id = p.id
             WHERE s.canceled = 0 AND s.created_at >= date('now', ?1)
             GROUP BY si.product_name
             ORDER BY total DESC",
        )
        .map_err(|e| e.to_string())?;

    let products: Vec<AbcProduct> = stmt
        .query_map([&modifier], |row| {
            let total: f64 = row.get(2)?;
            let cost_total: f64 = row.get(3)?;
            let margin = if total > 0.0 { ((total - cost_total) / total) * 100.0 } else { 0.0 };
            Ok(AbcProduct {
                name: row.get(0)?,
                qty: row.get(1)?,
                total,
                cost_total,
                margin,
                percentage: 0.0,
                accumulated: 0.0,
                classification: String::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let grand_total: f64 = products.iter().map(|p| p.total).sum();

    let mut result = Vec::new();
    let mut accumulated = 0.0;

    for mut p in products {
        p.percentage = if grand_total > 0.0 { (p.total / grand_total) * 100.0 } else { 0.0 };
        accumulated += p.percentage;
        p.accumulated = accumulated;

        p.classification = if accumulated <= 80.0 {
            "A".into()
        } else if accumulated <= 95.0 {
            "B".into()
        } else {
            "C".into()
        };

        result.push(p);
    }

    Ok(result)
}

/// Resumo por período com margem de lucro
#[derive(Serialize, Deserialize, Debug)]
pub struct PeriodSummary {
    pub total_sales: f64,
    pub total_cost: f64,
    pub profit: f64,
    pub margin_percent: f64,
    pub sales_count: i64,
    pub avg_ticket: f64,
}

#[tauri::command]
pub fn period_summary(state: State<DbState>, days: i64) -> Result<PeriodSummary, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let modifier = format!("-{} days", days);

    let result = conn
        .query_row(
            "SELECT COALESCE(SUM(s.total), 0),
                    COALESCE((SELECT SUM(si.quantity * p.cost) FROM sale_items si JOIN products p ON si.product_id = p.id JOIN sales s2 ON si.sale_id = s2.id WHERE s2.canceled = 0 AND s2.created_at >= date('now', ?1)), 0),
                    COUNT(*)
             FROM sales s
             WHERE s.canceled = 0 AND s.created_at >= date('now', ?1)",
            [&modifier],
            |row| {
                let total_sales: f64 = row.get(0)?;
                let total_cost: f64 = row.get(1)?;
                let sales_count: i64 = row.get(2)?;
                let profit = total_sales - total_cost;
                let margin = if total_sales > 0.0 { (profit / total_sales) * 100.0 } else { 0.0 };
                let avg_ticket = if sales_count > 0 { total_sales / sales_count as f64 } else { 0.0 };
                Ok(PeriodSummary {
                    total_sales,
                    total_cost,
                    profit,
                    margin_percent: margin,
                    sales_count,
                    avg_ticket,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(result)
}
