// Evita abrir um console no Windows em builds de release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;

use db::DbState;
use std::sync::Mutex;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .manage(commands::users::UserSessionState::default())
        .manage(commands::lan::LanServerState::default())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Define o ícone da janela em tempo de execução. Isso evita que o
            // modo `tauri dev` reutilize o ícone embutido no executável antigo
            // pelo cache do Cargo/Windows.
            let window_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))?;
            if let Some(window) = app.get_webview_window("main") {
                window.set_icon(window_icon)?;
            }

            let handle = app.handle();
            let conn = db::init_db(handle);
            let db = std::sync::Arc::new(Mutex::new(conn));
            app.manage(DbState(db.clone()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::products::list_products,
            commands::products::create_product,
            commands::products::update_product,
            commands::products::delete_product,
            commands::products::adjust_stock,
            commands::products::find_product_by_barcode,
            commands::products::decode_scale_barcode,
            commands::customers::list_customers,
            commands::customers::create_customer,
            commands::sales::finalize_sale,
            commands::sales::list_sales,
            commands::sales::get_sale_items,
            commands::sales::cancel_sale,
            commands::cash::open_cash_register,
            commands::cash::supply_cash,
            commands::cash::withdraw_cash,
            commands::cash::close_cash_register,
            commands::cash::get_open_register,
            commands::cash::list_cash_movements,
            commands::cash::list_cash_registers,
            commands::reports::daily_summary,
            commands::reports::top_products,
            commands::reports::abc_curve,
            commands::reports::period_summary,
            commands::labels::list_label_templates,
            commands::labels::save_label_template,
            commands::labels::delete_label_template,
            commands::batches::list_batches,
            commands::batches::create_batch,
            commands::batches::get_expiry_alerts,
            commands::batches::delete_batch,
            commands::promotions::list_promotions,
            commands::promotions::save_promotion,
            commands::promotions::delete_promotion,
            commands::promotions::toggle_promotion,
            commands::suppliers::list_suppliers,
            commands::suppliers::create_supplier,
            commands::suppliers::delete_supplier,
            commands::purchases::list_purchase_orders,
            commands::purchases::create_purchase_order,
            commands::purchases::receive_purchase_order,
            commands::purchases::list_losses,
            commands::purchases::register_loss,
            commands::quotes::list_quotes,
            commands::quotes::create_quote,
            commands::quotes::delete_quote,
            commands::accounts::list_accounts,
            commands::accounts::create_account,
            commands::accounts::pay_account,
            commands::accounts::delete_account,
            commands::accounts::cash_flow,
            commands::users::list_users,
            commands::users::create_user,
            commands::users::authenticate_user,
            commands::users::get_current_user,
            commands::users::logout_user,
            commands::users::delete_user,
            commands::users::list_audit_logs,
            commands::users::create_audit_log,
            commands::settings::get_store_settings,
            commands::settings::save_store_settings,
            commands::settings::upload_store_logo,
            commands::settings::remove_store_logo,
            commands::display::get_display_state,
            commands::display::set_cashier_open,
            commands::display::new_ticket,
            commands::display::call_next,
            commands::display::recall_number,
            commands::display::reset_display,
            commands::display::is_display_open,
            commands::license::get_machine_id,
            commands::license::get_local_license,
            commands::license::save_local_license,
            commands::license::clear_local_license,
            commands::lan::start_lan_server,
            commands::lan::lan_server_status,
            commands::lan::get_lan_access_pin,
            commands::workshop::list_vehicles,
            commands::workshop::save_vehicle,
            commands::workshop::list_workshop_services,
            commands::workshop::save_workshop_service,
            commands::workshop::delete_workshop_service,
            commands::workshop::list_service_orders,
            commands::workshop::save_service_order,
            commands::workshop::update_service_order_status,
            commands::workshop::list_appointments,
            commands::workshop::save_appointment,
            commands::workshop::workshop_dashboard,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Simplifica Oficina");
}
