import { invoke } from "@tauri-apps/api/core";
import type {
  Product, Customer, CartItem, SaleRecord, SaleItemRecord, DailySummary,
  LabelTemplate, CashRegister, CashMovement, ClosingReport,
  AbcProduct, PeriodSummary,
  ProductBatch, ExpiryAlert, Promotion, Supplier, PurchaseOrder, PurchaseItem,
  LossRecord, Quote, QuoteItem, Account, CashFlowEntry, User, AuditLog,
  StoreSettings, DisplayState, LocalLicense,
  Vehicle, ServiceOrder, Appointment, WorkshopDashboard, WorkshopService,
} from "../types";

// Todas as chamadas ao banco de dados local (SQLite) passam pelos comandos Rust.
// Isso mantém a lógica de negócio e o acesso a dados no backend (mais seguro e rápido).

export const api = {
  // ---------- Oficina ----------
  workshopDashboard: (): Promise<WorkshopDashboard> => invoke("workshop_dashboard"),
  listVehicles: (search = ""): Promise<Vehicle[]> => invoke("list_vehicles", { search }),
  saveVehicle: (vehicle: Omit<Vehicle, "id" | "customer_name" | "created_at">, id?: number): Promise<number> =>
    invoke("save_vehicle", { vehicle, id: id ?? null }),
  listWorkshopServices: (search = ""): Promise<WorkshopService[]> => invoke("list_workshop_services", { search }),
  saveWorkshopService: (service: Omit<WorkshopService, "id" | "active" | "created_at">, id?: number): Promise<number> =>
    invoke("save_workshop_service", { service, id: id ?? null }),
  deleteWorkshopService: (id: number): Promise<void> => invoke("delete_workshop_service", { id }),
  listServiceOrders: (status = "", search = ""): Promise<ServiceOrder[]> =>
    invoke("list_service_orders", { status, search }),
  saveServiceOrder: (order: Omit<ServiceOrder, "id" | "plate" | "vehicle_name" | "customer_name" | "total" | "created_at" | "updated_at">, id?: number): Promise<number> =>
    invoke("save_service_order", { order, id: id ?? null }),
  updateServiceOrderStatus: (id: number, status: string): Promise<void> =>
    invoke("update_service_order_status", { id, status }),
  assignServiceOrderMechanic: (id: number, mechanic: string): Promise<void> =>
    invoke("assign_service_order_mechanic", { id, mechanic }),
  deleteServiceOrder: (id: number): Promise<void> =>
    invoke("delete_service_order", { id }),
  listAppointments: (date: string): Promise<Appointment[]> => invoke("list_appointments", { date }),
  saveAppointment: (appointment: Omit<Appointment, "id" | "created_at">, id?: number): Promise<number> =>
    invoke("save_appointment", { appointment, id: id ?? null }),
  // ---------- Produtos ----------
  listProducts: (search = ""): Promise<Product[]> =>
    invoke("list_products", { search }),

  createProduct: (p: Omit<Product, "id">): Promise<Product> =>
    invoke("create_product", { product: p }),

  updateProduct: (p: Product): Promise<void> =>
    invoke("update_product", { product: p }),

  deleteProduct: (id: number): Promise<void> =>
    invoke("delete_product", { id }),

  adjustStock: (id: number, delta: number, reason: string): Promise<void> =>
    invoke("adjust_stock", { id, delta, reason }),

  // ---------- Clientes ----------
  listCustomers: (search = ""): Promise<Customer[]> =>
    invoke("list_customers", { search }),

  createCustomer: (c: Omit<Customer, "id">): Promise<Customer> =>
    invoke("create_customer", { customer: c }),

  // ---------- Vendas ----------
  finalizeSale: (
    items: CartItem[],
    paymentMethod: string,
    customerId: number | null,
    customerDocument?: string,
    operatorName?: string
  ): Promise<SaleRecord> =>
    invoke("finalize_sale", {
      items,
      paymentMethod,
      customerId,
      customerDocument: customerDocument ?? null,
      operatorName: operatorName ?? null,
    }),

  listSales: (limit = 200): Promise<SaleRecord[]> =>
    invoke("list_sales", { limit }),

  getSaleItems: (saleId: number): Promise<SaleItemRecord[]> =>
    invoke("get_sale_items", { saleId }),

  cancelSale: (saleId: number): Promise<void> =>
    invoke("cancel_sale", { saleId: saleId }),

  // ---------- Relatórios ----------
  dailySummary: (days = 7): Promise<DailySummary[]> =>
    invoke("daily_summary", { days }),

  topProducts: (limit = 5): Promise<{ name: string; qty: number; total: number }[]> =>
    invoke("top_products", { limit }),

  abcCurve: (days = 30): Promise<AbcProduct[]> =>
    invoke("abc_curve", { days }),

  periodSummary: (days = 30): Promise<PeriodSummary> =>
    invoke("period_summary", { days }),

  // ---------- Caixa ----------
  openCashRegister: (openingAmount: number, operatorName: string): Promise<CashRegister> =>
    invoke("open_cash_register", { openingAmount, operatorName }),

  supplyCash: (registerId: number, amount: number, description: string): Promise<CashMovement> =>
    invoke("supply_cash", { registerId, amount, description }),

  withdrawCash: (registerId: number, amount: number, description: string): Promise<CashMovement> =>
    invoke("withdraw_cash", { registerId, amount, description }),

  closeCashRegister: (registerId: number, closingAmount: number): Promise<ClosingReport> =>
    invoke("close_cash_register", { registerId, closingAmount }),

  getOpenRegister: (): Promise<CashRegister | null> =>
    invoke("get_open_register"),

  listCashMovements: (registerId: number): Promise<CashMovement[]> =>
    invoke("list_cash_movements", { registerId }),

  listCashRegisters: (): Promise<CashRegister[]> =>
    invoke("list_cash_registers"),

  // ---------- Etiquetas ----------
  listLabelTemplates: (): Promise<LabelTemplate[]> =>
    invoke("list_label_templates"),

  saveLabelTemplate: (
    template: Omit<LabelTemplate, "id" | "created_at">,
    id?: number
  ): Promise<LabelTemplate> =>
    invoke("save_label_template", { template, id: id ?? null }),

  deleteLabelTemplate: (id: number): Promise<void> =>
    invoke("delete_label_template", { id }),

  // ---------- Produtos (busca) ----------
  findProductByBarcode: (barcode: string): Promise<Product | null> =>
    invoke("find_product_by_barcode", { barcode }),

  decodeScaleBarcode: (barcode: string): Promise<Product | null> =>
    invoke("decode_scale_barcode", { barcode }),

  // ---------- Lotes / Validade ----------
  listBatches: (): Promise<ProductBatch[]> =>
    invoke("list_batches"),
  createBatch: (productId: number, batchCode: string, quantity: number, expiryDate: string): Promise<ProductBatch> =>
    invoke("create_batch", { productId, batchCode, quantity, expiryDate }),
  getExpiryAlerts: (): Promise<ExpiryAlert[]> =>
    invoke("get_expiry_alerts"),
  deleteBatch: (id: number): Promise<void> =>
    invoke("delete_batch", { id }),

  // ---------- Promoções ----------
  listPromotions: (): Promise<Promotion[]> =>
    invoke("list_promotions"),
  savePromotion: (promotion: Omit<Promotion, "id" | "active" | "created_at" | "product_name">, id?: number): Promise<Promotion> =>
    invoke("save_promotion", { promotion, id: id ?? null }),
  deletePromotion: (id: number): Promise<void> =>
    invoke("delete_promotion", { id }),
  togglePromotion: (id: number, active: boolean): Promise<void> =>
    invoke("toggle_promotion", { id, active }),

  // ---------- Fornecedores ----------
  listSuppliers: (search = ""): Promise<Supplier[]> =>
    invoke("list_suppliers", { search }),
  createSupplier: (supplier: Omit<Supplier, "id" | "active" | "created_at">): Promise<Supplier> =>
    invoke("create_supplier", { supplier }),
  deleteSupplier: (id: number): Promise<void> =>
    invoke("delete_supplier", { id }),

  // ---------- Compras ----------
  listPurchaseOrders: (): Promise<PurchaseOrder[]> =>
    invoke("list_purchase_orders"),
  createPurchaseOrder: (supplierId: number | null, items: PurchaseItem[], notes: string): Promise<PurchaseOrder> =>
    invoke("create_purchase_order", { supplierId, items, notes }),
  receivePurchaseOrder: (orderId: number): Promise<void> =>
    invoke("receive_purchase_order", { orderId }),

  // ---------- Perdas ----------
  listLosses: (): Promise<LossRecord[]> =>
    invoke("list_losses"),
  registerLoss: (productId: number, quantity: number, reason: string, description: string, value: number): Promise<LossRecord> =>
    invoke("register_loss", { productId, quantity, reason, description, value }),

  // ---------- Orçamentos ----------
  listQuotes: (): Promise<Quote[]> =>
    invoke("list_quotes"),
  createQuote: (customerName: string, customerDocument: string, items: QuoteItem[], notes: string): Promise<Quote> =>
    invoke("create_quote", { customerName, customerDocument, items, notes }),
  deleteQuote: (id: number): Promise<void> =>
    invoke("delete_quote", { id }),

  // ---------- Contas ----------
  listAccounts: (accountType: string): Promise<Account[]> =>
    invoke("list_accounts", { accountType }),
  createAccount: (accountType: string, description: string, amount: number, dueDate: string, supplierId: number | null, customerId: number | null, notes: string): Promise<Account> =>
    invoke("create_account", { accountType, description, amount, dueDate, supplierId, customerId, notes }),
  payAccount: (id: number): Promise<void> =>
    invoke("pay_account", { id }),
  deleteAccount: (id: number): Promise<void> =>
    invoke("delete_account", { id }),
  cashFlow: (days = 30): Promise<CashFlowEntry[]> =>
    invoke("cash_flow", { days }),

  // ---------- Usuários / Logs ----------
  listUsers: (): Promise<User[]> =>
    invoke("list_users"),
  getCurrentUser: (): Promise<User | null> => invoke("get_current_user"),
  logoutUser: (): Promise<void> => invoke("logout_user"),
  createUser: (name: string, login: string, password: string, role: string): Promise<User> =>
    invoke("create_user", { name, login, password, role }),
  authenticateUser: (login: string, password: string): Promise<User> =>
    invoke("authenticate_user", { login, password }),
  deleteUser: (id: number): Promise<void> =>
    invoke("delete_user", { id }),
  listAuditLogs: (limit = 200): Promise<AuditLog[]> =>
    invoke("list_audit_logs", { limit }),
  createAuditLog: (userId: number | null, userName: string, action: string, details: string, terminal: string): Promise<void> =>
    invoke("create_audit_log", { userId, userName, action, details, terminal }),

  // ---------- Informações da Loja ----------
  getDatabasePath: (): Promise<string> =>
    invoke("get_database_path"),
  getStoreSettings: (): Promise<StoreSettings> =>
    invoke("get_store_settings"),
  saveStoreSettings: (settings: StoreSettings): Promise<StoreSettings> =>
    invoke("save_store_settings", { settings }),
  uploadStoreLogo: (path: string): Promise<StoreSettings> =>
    invoke("upload_store_logo", { path }),
  removeStoreLogo: (): Promise<StoreSettings> =>
    invoke("remove_store_logo"),
  // ---------- Licenciamento local ----------
  getMachineId: (): Promise<string> =>
    invoke("get_machine_id"),
  getLocalLicense: (): Promise<LocalLicense | null> =>
    invoke("get_local_license"),
  saveLocalLicense: (license: LocalLicense): Promise<void> =>
    invoke("save_local_license", { license }),
  clearLocalLicense: (): Promise<void> =>
    invoke("clear_local_license"),

  // ---------- Oficina móvel na rede local ----------
  startLanServer: (pin: string): Promise<string> => invoke("start_lan_server", { pin }),
  lanServerStatus: (): Promise<{ running: boolean; url: string | null }> => invoke("lan_server_status"),
  getLanAccessPin: (): Promise<string> => invoke("get_lan_access_pin"),

  // ---------- Exibição para Clientes ----------
  getDisplayState: (): Promise<DisplayState> =>
    invoke("get_display_state"),
  setCashierOpen: (open: boolean): Promise<DisplayState> =>
    invoke("set_cashier_open", { open }),
  newTicket: (): Promise<DisplayState> =>
    invoke("new_ticket"),
  callNext: (): Promise<DisplayState> =>
    invoke("call_next"),
  recallNumber: (): Promise<DisplayState> =>
    invoke("recall_number"),
  resetDisplay: (): Promise<DisplayState> =>
    invoke("reset_display"),
  isDisplayOpen: (): Promise<boolean> =>
    invoke("is_display_open"),
};
