use crate::db::DbState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LabelTemplate {
    pub id: i64,
    pub name: String,
    pub width_mm: f64,
    pub height_mm: f64,
    pub show_name: bool,
    pub show_price: bool,
    pub show_barcode: bool,
    pub show_category: bool,
    pub show_unit: bool,
    pub font_size_price: i64,
    pub font_size_name: i64,
    pub unit_text: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct NewLabelTemplate {
    pub name: String,
    pub width_mm: f64,
    pub height_mm: f64,
    pub show_name: bool,
    pub show_price: bool,
    pub show_barcode: bool,
    pub show_category: bool,
    pub show_unit: bool,
    pub font_size_price: i64,
    pub font_size_name: i64,
    pub unit_text: String,
}

#[tauri::command]
pub fn list_label_templates(state: State<DbState>) -> Result<Vec<LabelTemplate>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, width_mm, height_mm, show_name, show_price, show_barcode,
                    show_category, show_unit, font_size_price, font_size_name, unit_text, created_at
             FROM label_templates
             ORDER BY name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(LabelTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                width_mm: row.get(2)?,
                height_mm: row.get(3)?,
                show_name: row.get::<_, i64>(4)? != 0,
                show_price: row.get::<_, i64>(5)? != 0,
                show_barcode: row.get::<_, i64>(6)? != 0,
                show_category: row.get::<_, i64>(7)? != 0,
                show_unit: row.get::<_, i64>(8)? != 0,
                font_size_price: row.get(9)?,
                font_size_name: row.get(10)?,
                unit_text: row.get(11)?,
                created_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_label_template(
    state: State<DbState>,
    template: NewLabelTemplate,
    id: Option<i64>,
) -> Result<LabelTemplate, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    if let Some(template_id) = id {
        // Update existing
        conn.execute(
            "UPDATE label_templates SET name=?1, width_mm=?2, height_mm=?3, show_name=?4,
             show_price=?5, show_barcode=?6, show_category=?7, show_unit=?8,
             font_size_price=?9, font_size_name=?10, unit_text=?11
             WHERE id=?12",
            rusqlite::params![
                template.name,
                template.width_mm,
                template.height_mm,
                template.show_name as i64,
                template.show_price as i64,
                template.show_barcode as i64,
                template.show_category as i64,
                template.show_unit as i64,
                template.font_size_price,
                template.font_size_name,
                template.unit_text,
                template_id,
            ],
        )
        .map_err(|e| e.to_string())?;

        Ok(LabelTemplate {
            id: template_id,
            name: template.name,
            width_mm: template.width_mm,
            height_mm: template.height_mm,
            show_name: template.show_name,
            show_price: template.show_price,
            show_barcode: template.show_barcode,
            show_category: template.show_category,
            show_unit: template.show_unit,
            font_size_price: template.font_size_price,
            font_size_name: template.font_size_name,
            unit_text: template.unit_text,
            created_at: String::new(),
        })
    } else {
        // Insert new
        conn.execute(
            "INSERT INTO label_templates (name, width_mm, height_mm, show_name, show_price,
             show_barcode, show_category, show_unit, font_size_price, font_size_name, unit_text, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            rusqlite::params![
                template.name,
                template.width_mm,
                template.height_mm,
                template.show_name as i64,
                template.show_price as i64,
                template.show_barcode as i64,
                template.show_category as i64,
                template.show_unit as i64,
                template.font_size_price,
                template.font_size_name,
                template.unit_text,
                Utc::now().to_rfc3339(),
            ],
        )
        .map_err(|e| e.to_string())?;

        let id = conn.last_insert_rowid();
        Ok(LabelTemplate {
            id,
            name: template.name,
            width_mm: template.width_mm,
            height_mm: template.height_mm,
            show_name: template.show_name,
            show_price: template.show_price,
            show_barcode: template.show_barcode,
            show_category: template.show_category,
            show_unit: template.show_unit,
            font_size_price: template.font_size_price,
            font_size_name: template.font_size_name,
            unit_text: template.unit_text,
            created_at: Utc::now().to_rfc3339(),
        })
    }
}

#[tauri::command]
pub fn delete_label_template(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM label_templates WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
