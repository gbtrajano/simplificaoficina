use crate::db::DbState;
use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug)]
pub struct Vehicle {
    pub id: i64,
    pub customer_id: Option<i64>,
    pub customer_name: Option<String>,
    pub plate: String,
    pub brand: String,
    pub model: String,
    pub year: String,
    pub color: String,
    pub mileage: i64,
    pub notes: String,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct VehicleInput {
    pub customer_id: Option<i64>, pub plate: String, pub brand: String, pub model: String,
    pub year: String, pub color: String, pub mileage: i64, pub notes: String,
}

#[tauri::command]
pub fn list_vehicles(state: State<DbState>, search: String) -> Result<Vec<Vehicle>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", search);
    let mut stmt = conn.prepare("SELECT v.id,v.customer_id,c.name,v.plate,v.brand,v.model,v.year,v.color,v.mileage,v.notes,v.created_at FROM vehicles v LEFT JOIN customers c ON c.id=v.customer_id WHERE v.plate LIKE ?1 OR v.brand LIKE ?1 OR v.model LIKE ?1 OR c.name LIKE ?1 ORDER BY v.created_at DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([pattern], |r| Ok(Vehicle { id:r.get(0)?, customer_id:r.get(1)?, customer_name:r.get(2)?, plate:r.get(3)?, brand:r.get(4)?, model:r.get(5)?, year:r.get(6)?, color:r.get(7)?, mileage:r.get(8)?, notes:r.get(9)?, created_at:r.get(10)? })).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>,_>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_vehicle(state: State<DbState>, vehicle: VehicleInput, id: Option<i64>) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let plate = vehicle.plate.trim().to_uppercase();
    if plate.is_empty() { return Err("Informe a placa do veículo.".into()); }
    if let Some(id) = id {
        conn.execute("UPDATE vehicles SET customer_id=?1,plate=?2,brand=?3,model=?4,year=?5,color=?6,mileage=?7,notes=?8 WHERE id=?9", params![vehicle.customer_id,plate,vehicle.brand,vehicle.model,vehicle.year,vehicle.color,vehicle.mileage,vehicle.notes,id]).map_err(|e| e.to_string())?;
        Ok(id)
    } else {
        conn.execute("INSERT INTO vehicles(customer_id,plate,brand,model,year,color,mileage,notes,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)", params![vehicle.customer_id,plate,vehicle.brand,vehicle.model,vehicle.year,vehicle.color,vehicle.mileage,vehicle.notes,Utc::now().to_rfc3339()]).map_err(|e| if e.to_string().contains("UNIQUE") { "Esta placa já está cadastrada.".into() } else { e.to_string() })?;
        Ok(conn.last_insert_rowid())
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ServiceOrder {
    pub id:i64, pub vehicle_id:i64, pub customer_id:Option<i64>, pub plate:String, pub vehicle_name:String,
    pub customer_name:Option<String>, pub status:String, pub priority:String, pub complaint:String, pub diagnosis:String,
    pub services:String, pub parts:String, pub labor_total:f64, pub parts_total:f64, pub discount:f64,
    pub total:f64, pub promised_at:Option<String>, pub mechanic:String, pub payment_method:String,
    pub created_at:String, pub updated_at:String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct WorkshopService {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub price: f64,
    pub active: bool,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct WorkshopServiceInput {
    pub name: String,
    pub description: String,
    pub price: f64,
}

#[tauri::command]
pub fn list_workshop_services(state: State<DbState>, search: String) -> Result<Vec<WorkshopService>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", search);
    let mut statement = conn.prepare("SELECT id,name,description,price,active,created_at FROM workshop_services WHERE active=1 AND (name LIKE ?1 OR description LIKE ?1) ORDER BY name").map_err(|e| e.to_string())?;
    let rows = statement.query_map([pattern], |row| Ok(WorkshopService {
        id: row.get(0)?, name: row.get(1)?, description: row.get(2)?, price: row.get(3)?, active: row.get::<_, i64>(4)? != 0, created_at: row.get(5)?,
    })).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_workshop_service(state: State<DbState>, service: WorkshopServiceInput, id: Option<i64>) -> Result<i64, String> {
    let name = service.name.trim();
    if name.is_empty() { return Err("Informe o nome do serviço.".into()); }
    if service.price < 0.0 { return Err("O valor não pode ser negativo.".into()); }
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(id) = id {
        conn.execute("UPDATE workshop_services SET name=?1,description=?2,price=?3 WHERE id=?4", params![name, service.description.trim(), service.price, id]).map_err(|e| e.to_string())?;
        Ok(id)
    } else {
        conn.execute("INSERT INTO workshop_services(name,description,price,created_at) VALUES(?1,?2,?3,?4)", params![name, service.description.trim(), service.price, Utc::now().to_rfc3339()]).map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }
}

#[tauri::command]
pub fn delete_workshop_service(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE workshop_services SET active=0 WHERE id=?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Deserialize)]
pub struct ServiceOrderInput {
    pub vehicle_id:i64, pub customer_id:Option<i64>, pub status:String, pub priority:String, pub complaint:String,
    pub diagnosis:String, pub services:String, pub parts:String, pub labor_total:f64, pub parts_total:f64,
    pub discount:f64, pub promised_at:Option<String>, pub mechanic:String, pub payment_method:String,
}

fn order_select() -> &'static str { "SELECT o.id,o.vehicle_id,o.customer_id,v.plate,TRIM(v.brand || ' ' || v.model),c.name,o.status,o.priority,o.complaint,o.diagnosis,o.services,o.parts,o.labor_total,o.parts_total,o.discount,(o.labor_total+o.parts_total-o.discount),o.promised_at,o.mechanic,o.payment_method,o.created_at,o.updated_at FROM service_orders o JOIN vehicles v ON v.id=o.vehicle_id LEFT JOIN customers c ON c.id=o.customer_id" }
fn row_order(r: &rusqlite::Row<'_>) -> rusqlite::Result<ServiceOrder> { Ok(ServiceOrder { id:r.get(0)?,vehicle_id:r.get(1)?,customer_id:r.get(2)?,plate:r.get(3)?,vehicle_name:r.get(4)?,customer_name:r.get(5)?,status:r.get(6)?,priority:r.get(7)?,complaint:r.get(8)?,diagnosis:r.get(9)?,services:r.get(10)?,parts:r.get(11)?,labor_total:r.get(12)?,parts_total:r.get(13)?,discount:r.get(14)?,total:r.get(15)?,promised_at:r.get(16)?,mechanic:r.get(17)?,payment_method:r.get(18)?,created_at:r.get(19)?,updated_at:r.get(20)? }) }

#[tauri::command]
pub fn list_service_orders(state: State<DbState>, status: String, search: String) -> Result<Vec<ServiceOrder>, String> {
    let conn=state.0.lock().map_err(|e|e.to_string())?; let pattern=format!("%{}%",search);
    let sql=format!("{} WHERE (?1='' OR o.status=?1) AND (v.plate LIKE ?2 OR v.model LIKE ?2 OR c.name LIKE ?2 OR CAST(o.id AS TEXT) LIKE ?2) ORDER BY CASE o.status WHEN 'in_progress' THEN 0 WHEN 'approved' THEN 1 WHEN 'waiting_parts' THEN 2 WHEN 'draft' THEN 3 ELSE 4 END,o.updated_at DESC",order_select());
    let mut stmt=conn.prepare(&sql).map_err(|e|e.to_string())?; let rows=stmt.query_map(params![status,pattern],row_order).map_err(|e|e.to_string())?;
    rows.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())
}

#[tauri::command]
pub fn save_service_order(state: State<DbState>, order: ServiceOrderInput, id: Option<i64>) -> Result<i64,String> {
    let conn=state.0.lock().map_err(|e|e.to_string())?; let now=Utc::now().to_rfc3339();
    if let Some(id)=id { conn.execute("UPDATE service_orders SET vehicle_id=?1,customer_id=?2,status=?3,priority=?4,complaint=?5,diagnosis=?6,services=?7,parts=?8,labor_total=?9,parts_total=?10,discount=?11,promised_at=?12,mechanic=?13,payment_method=?14,updated_at=?15 WHERE id=?16",params![order.vehicle_id,order.customer_id,order.status,order.priority,order.complaint,order.diagnosis,order.services,order.parts,order.labor_total,order.parts_total,order.discount,order.promised_at,order.mechanic,order.payment_method,now,id]).map_err(|e|e.to_string())?; Ok(id) }
    else { conn.execute("INSERT INTO service_orders(vehicle_id,customer_id,status,priority,complaint,diagnosis,services,parts,labor_total,parts_total,discount,promised_at,mechanic,payment_method,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?15)",params![order.vehicle_id,order.customer_id,order.status,order.priority,order.complaint,order.diagnosis,order.services,order.parts,order.labor_total,order.parts_total,order.discount,order.promised_at,order.mechanic,order.payment_method,now]).map_err(|e|e.to_string())?; Ok(conn.last_insert_rowid()) }
}

#[tauri::command]
pub fn update_service_order_status(state: State<DbState>, id:i64, status:String) -> Result<(),String> { let conn=state.0.lock().map_err(|e|e.to_string())?; conn.execute("UPDATE service_orders SET status=?1,updated_at=?2 WHERE id=?3",params![status,Utc::now().to_rfc3339(),id]).map_err(|e|e.to_string())?; Ok(()) }

#[tauri::command]
pub fn assign_service_order_mechanic(state: State<DbState>, id: i64, mechanic: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE service_orders SET mechanic=?1,updated_at=?2 WHERE id=?3",
        params![mechanic.trim(), Utc::now().to_rfc3339(), id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_service_order(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let affected = conn.execute("DELETE FROM service_orders WHERE id=?1", [id]).map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err("Ordem de serviço não encontrada.".into());
    }
    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct Appointment { pub id:i64,pub customer_name:String,pub phone:String,pub vehicle:String,pub plate:String,pub service:String,pub scheduled_at:String,pub status:String,pub notes:String,pub created_at:String }
#[derive(Deserialize)]
pub struct AppointmentInput { pub customer_name:String,pub phone:String,pub vehicle:String,pub plate:String,pub service:String,pub scheduled_at:String,pub status:String,pub notes:String }

#[tauri::command]
pub fn list_appointments(state:State<DbState>, date:String)->Result<Vec<Appointment>,String>{ let conn=state.0.lock().map_err(|e|e.to_string())?; let pattern=format!("{}%",date); let mut s=conn.prepare("SELECT id,customer_name,phone,vehicle,plate,service,scheduled_at,status,notes,created_at FROM appointments WHERE scheduled_at LIKE ?1 ORDER BY scheduled_at").map_err(|e|e.to_string())?; let rows=s.query_map([pattern],|r|Ok(Appointment{id:r.get(0)?,customer_name:r.get(1)?,phone:r.get(2)?,vehicle:r.get(3)?,plate:r.get(4)?,service:r.get(5)?,scheduled_at:r.get(6)?,status:r.get(7)?,notes:r.get(8)?,created_at:r.get(9)?})).map_err(|e|e.to_string())?; rows.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string()) }
#[tauri::command]
pub fn save_appointment(state:State<DbState>,appointment:AppointmentInput,id:Option<i64>)->Result<i64,String>{let conn=state.0.lock().map_err(|e|e.to_string())?;if let Some(id)=id{conn.execute("UPDATE appointments SET customer_name=?1,phone=?2,vehicle=?3,plate=?4,service=?5,scheduled_at=?6,status=?7,notes=?8 WHERE id=?9",params![appointment.customer_name,appointment.phone,appointment.vehicle,appointment.plate.to_uppercase(),appointment.service,appointment.scheduled_at,appointment.status,appointment.notes,id]).map_err(|e|e.to_string())?;Ok(id)}else{conn.execute("INSERT INTO appointments(customer_name,phone,vehicle,plate,service,scheduled_at,status,notes,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)",params![appointment.customer_name,appointment.phone,appointment.vehicle,appointment.plate.to_uppercase(),appointment.service,appointment.scheduled_at,appointment.status,appointment.notes,Utc::now().to_rfc3339()]).map_err(|e|e.to_string())?;Ok(conn.last_insert_rowid())}}

#[derive(Serialize)]
pub struct WorkshopDashboard { pub open_orders:i64,pub in_progress:i64,pub ready:i64,pub today_appointments:i64,pub month_revenue:f64,pub vehicles:i64 }
#[tauri::command]
pub fn workshop_dashboard(state:State<DbState>)->Result<WorkshopDashboard,String>{let conn=state.0.lock().map_err(|e|e.to_string())?;let count=|sql:&str|conn.query_row(sql,[],|r|r.get::<_,i64>(0)).unwrap_or(0);let today=Utc::now().format("%Y-%m-%d").to_string();let month=Utc::now().format("%Y-%m").to_string();let today_appointments=conn.query_row("SELECT COUNT(*) FROM appointments WHERE scheduled_at LIKE ?1",[format!("{}%",today)],|r|r.get(0)).unwrap_or(0);let month_revenue=conn.query_row("SELECT COALESCE(SUM(labor_total+parts_total-discount),0) FROM service_orders WHERE status='delivered' AND updated_at LIKE ?1",[format!("{}%",month)],|r|r.get(0)).unwrap_or(0.0);Ok(WorkshopDashboard{open_orders:count("SELECT COUNT(*) FROM service_orders WHERE status NOT IN ('delivered','canceled')"),in_progress:count("SELECT COUNT(*) FROM service_orders WHERE status='in_progress'"),ready:count("SELECT COUNT(*) FROM service_orders WHERE status='ready'"),today_appointments,month_revenue,vehicles:count("SELECT COUNT(*) FROM vehicles")})}
