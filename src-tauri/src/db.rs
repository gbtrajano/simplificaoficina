use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};

pub struct DbState(pub Arc<Mutex<Connection>>);

/// Retorna o caminho do arquivo .db dentro da pasta de dados do app
/// (ex: %APPDATA%/com.simplificapdv.app/ no Windows,
/// ~/.local/share/com.simplificapdv.app/ no Linux,
/// ~/Library/Application Support/com.simplificapdv.app/ no macOS).
pub fn db_path(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("nÃƒÂ£o foi possÃƒÂ­vel resolver o diretÃƒÂ³rio de dados do app");
    std::fs::create_dir_all(&dir).expect("falha ao criar diretÃƒÂ³rio de dados");
    dir.join("simplificaoficina.db")
}

pub fn init_db(app: &AppHandle) -> Connection {
    let path = db_path(app);
    let conn = Connection::open(path).expect("falha ao abrir banco de dados local");

    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT '',
            price REAL NOT NULL DEFAULT 0,
            cost REAL NOT NULL DEFAULT 0,
            stock INTEGER NOT NULL DEFAULT 0,
            min_stock INTEGER NOT NULL DEFAULT 5,
            barcode TEXT DEFAULT '',
            active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT DEFAULT '',
            document TEXT DEFAULT '',
            notes TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            total REAL NOT NULL,
            payment_method TEXT NOT NULL,
            customer_id INTEGER,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        );

        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            unit_price REAL NOT NULL,
            quantity INTEGER NOT NULL,
            FOREIGN KEY (sale_id) REFERENCES sales(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS stock_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            delta INTEGER NOT NULL,
            reason TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS label_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            width_mm REAL NOT NULL DEFAULT 70,
            height_mm REAL NOT NULL DEFAULT 40,
            show_name INTEGER NOT NULL DEFAULT 1,
            show_price INTEGER NOT NULL DEFAULT 1,
            show_barcode INTEGER NOT NULL DEFAULT 1,
            show_category INTEGER NOT NULL DEFAULT 0,
            show_unit INTEGER NOT NULL DEFAULT 0,
            font_size_price INTEGER NOT NULL DEFAULT 24,
            font_size_name INTEGER NOT NULL DEFAULT 10,
            unit_text TEXT NOT NULL DEFAULT 'UN',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cash_registers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            opened_at TEXT NOT NULL,
            closed_at TEXT,
            opening_amount REAL NOT NULL DEFAULT 0,
            closing_amount REAL,
            expected_amount REAL,
            operator_name TEXT NOT NULL DEFAULT 'Operador',
            status TEXT NOT NULL DEFAULT 'open'
        );

        CREATE TABLE IF NOT EXISTS cash_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            register_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY (register_id) REFERENCES cash_registers(id)
        );

        CREATE TABLE IF NOT EXISTS product_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            batch_code TEXT NOT NULL DEFAULT '',
            quantity INTEGER NOT NULL DEFAULT 0,
            expiry_date TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS promotions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'quantity_discount',
            product_id INTEGER,
            min_quantity INTEGER NOT NULL DEFAULT 1,
            discount_percent REAL NOT NULL DEFAULT 0,
            discount_amount REAL NOT NULL DEFAULT 0,
            buy_quantity INTEGER NOT NULL DEFAULT 0,
            pay_quantity INTEGER NOT NULL DEFAULT 0,
            wholesale_price REAL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            company_name TEXT DEFAULT '',
            document TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            email TEXT DEFAULT '',
            address TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS purchase_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id INTEGER,
            total REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        );

        CREATE TABLE IF NOT EXISTS purchase_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 0,
            unit_cost REAL NOT NULL DEFAULT 0,
            FOREIGN KEY (order_id) REFERENCES purchase_orders(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS losses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 0,
            reason TEXT NOT NULL DEFAULT 'damage',
            description TEXT DEFAULT '',
            value REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS quotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT DEFAULT '',
            customer_document TEXT DEFAULT '',
            total REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            converted_sale_id INTEGER,
            FOREIGN KEY (converted_sale_id) REFERENCES sales(id)
        );

        CREATE TABLE IF NOT EXISTS quote_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quote_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            unit_price REAL NOT NULL DEFAULT 0,
            quantity INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (quote_id) REFERENCES quotes(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL DEFAULT 'payable',
            description TEXT NOT NULL,
            amount REAL NOT NULL DEFAULT 0,
            due_date TEXT NOT NULL,
            paid INTEGER NOT NULL DEFAULT 0,
            paid_date TEXT,
            supplier_id INTEGER,
            customer_id INTEGER,
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            login TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL DEFAULT '',
            role TEXT NOT NULL DEFAULT 'operator',
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            user_name TEXT NOT NULL DEFAULT 'Sistema',
            action TEXT NOT NULL,
            details TEXT DEFAULT '',
            terminal TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS store_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            name TEXT NOT NULL DEFAULT '',
            cnpj TEXT NOT NULL DEFAULT '',
            phone TEXT NOT NULL DEFAULT '',
            email TEXT NOT NULL DEFAULT '',
            address TEXT NOT NULL DEFAULT '',
            city TEXT NOT NULL DEFAULT '',
            state TEXT NOT NULL DEFAULT '',
            cep TEXT NOT NULL DEFAULT '',
            inscription TEXT NOT NULL DEFAULT '',
            display_message TEXT NOT NULL DEFAULT '',
            logo TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS display_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            cashier_open INTEGER NOT NULL DEFAULT 0,
            called_number INTEGER NOT NULL DEFAULT 0,
            waiting INTEGER NOT NULL DEFAULT 0,
            last_ticket INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS local_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER,
            plate TEXT NOT NULL UNIQUE COLLATE NOCASE,
            brand TEXT NOT NULL DEFAULT '',
            model TEXT NOT NULL DEFAULT '',
            year TEXT NOT NULL DEFAULT '',
            color TEXT NOT NULL DEFAULT '',
            mileage INTEGER NOT NULL DEFAULT 0,
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        );

        CREATE TABLE IF NOT EXISTS service_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_id INTEGER NOT NULL,
            customer_id INTEGER,
            status TEXT NOT NULL DEFAULT 'draft',
            priority TEXT NOT NULL DEFAULT 'normal',
            complaint TEXT NOT NULL DEFAULT '',
            diagnosis TEXT NOT NULL DEFAULT '',
            services TEXT NOT NULL DEFAULT '',
            parts TEXT NOT NULL DEFAULT '',
            labor_total REAL NOT NULL DEFAULT 0,
            parts_total REAL NOT NULL DEFAULT 0,
            discount REAL NOT NULL DEFAULT 0,
            promised_at TEXT,
            mechanic TEXT NOT NULL DEFAULT '',
            payment_method TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        );

        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            phone TEXT NOT NULL DEFAULT '',
            vehicle TEXT NOT NULL DEFAULT '',
            plate TEXT NOT NULL DEFAULT '',
            service TEXT NOT NULL DEFAULT '',
            scheduled_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'scheduled',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS workshop_services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            price REAL NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);
        CREATE INDEX IF NOT EXISTS idx_service_orders_vehicle ON service_orders(vehicle_id);
        CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(scheduled_at);

        "#,
    )
    .expect("falha ao rodar migraÃƒÂ§ÃƒÂµes");

    // MigraÃƒÂ§ÃƒÂµes graciosas para bancos criados em versÃƒÂµes anteriores
    conn.execute("ALTER TABLE products ADD COLUMN min_stock INTEGER NOT NULL DEFAULT 5", []).ok();
    conn.execute("ALTER TABLE products ADD COLUMN unit_type TEXT NOT NULL DEFAULT 'UN'", []).ok();
    conn.execute("ALTER TABLE products ADD COLUMN scale_prefix TEXT NOT NULL DEFAULT ''", []).ok();
    conn.execute("ALTER TABLE sales ADD COLUMN customer_document TEXT DEFAULT ''", []).ok();
    conn.execute("ALTER TABLE sales ADD COLUMN operator_name TEXT NOT NULL DEFAULT 'Operador'", []).ok();
    conn.execute("ALTER TABLE sales ADD COLUMN canceled INTEGER NOT NULL DEFAULT 0", []).ok();
    // MigraÃƒÂ§ÃƒÂ£o graciosa para a logo da loja (bancos criados antes desta versÃƒÂ£o)
    conn.execute("ALTER TABLE store_settings ADD COLUMN logo TEXT NOT NULL DEFAULT ''", []).ok();

    // Corrige os produtos de demonstração criados por versões antigas com o
    // texto UTF-8 codificado duas vezes. As condições atingem apenas os seeds.
    conn.execute(
        "UPDATE products SET name = ?1 WHERE name LIKE 'P%Franc%' AND category = 'Padaria'",
        ["Pão Francês (6un)"],
    ).ok();
    conn.execute(
        "UPDATE products SET category = ?1 WHERE name = 'Leite Integral 1L' AND category LIKE 'Latic%'",
        ["Laticínios"],
    ).ok();

    // Remove a tabela local de comissÃƒÂµes das versÃƒÂµes que continham afiliaÃƒÂ§ÃƒÂµes.
    conn.execute("DROP TABLE IF EXISTS affiliate_commissions", []).ok();

    seed_if_empty(&conn);
    conn
}

/// Popula alguns produtos de exemplo na primeira execuÃƒÂ§ÃƒÂ£o, para facilitar os testes.
fn seed_if_empty(conn: &Connection) {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM products", [], |r| r.get(0))
        .unwrap_or(0);

    if false && count == 0 {
        let seed = [
            ("Coca-Cola 2L", "Bebidas", 8.90, 5.50, 20, 5),
            ("PÃƒÂ£o FrancÃƒÂªs (6un)", "Padaria", 4.50, 2.00, 40, 10),
            ("Leite Integral 1L", "LaticÃƒÂ­nios", 6.20, 4.00, 30, 5),
        ];
        for (name, category, price, cost, stock, min_stock) in seed {
            conn.execute(
                "INSERT INTO products (name, category, price, cost, stock, min_stock) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![name, category, price, cost, stock, min_stock],
            )
            .ok();
        }
    }

    // Garante a linha ÃƒÂºnica de configuraÃƒÂ§ÃƒÂµes da loja
    let settings_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM store_settings", [], |r| r.get(0))
        .unwrap_or(0);
    if settings_count == 0 {
        conn.execute(
            "INSERT INTO store_settings (id, name, updated_at) VALUES (1, '', '')",
            [],
        )
        .ok();
    }

    // Garante a linha ÃƒÂºnica de estado da exibiÃƒÂ§ÃƒÂ£o
    let display_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM display_state", [], |r| r.get(0))
        .unwrap_or(0);
    if display_count == 0 {
        conn.execute(
            "INSERT INTO display_state (id, updated_at) VALUES (1, '')",
            [],
        )
        .ok();
    }
}
