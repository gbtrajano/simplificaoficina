export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  barcode?: string;
  active: boolean;
  unit_type: string; // UN, KG, CX, FD
  scale_prefix: string; // prefixo do codigo de balanca
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  document?: string; // CPF/CNPJ
  notes?: string;
}

export interface CartItem {
  product_id: number;
  name: string;
  category: string;
  unit_price: number;
  quantity: number;
}

export interface SaleRecord {
  id: number;
  created_at: string;
  total: number;
  payment_method: string;
  customer_id: number | null;
  customer_name?: string | null;
  customer_document?: string | null;
  operator_name: string;
  canceled: boolean;
  items_count: number;
}

export interface SaleItemRecord {
  id: number;
  sale_id: number;
  product_id: number;
  product_name: string;
  unit_price: number;
  quantity: number;
}

export interface DailySummary {
  date: string;
  total: number;
  sales_count: number;
}

export interface LabelTemplate {
  id: number;
  name: string;
  width_mm: number;
  height_mm: number;
  show_name: boolean;
  show_price: boolean;
  show_barcode: boolean;
  show_category: boolean;
  show_unit: boolean;
  font_size_price: number;
  font_size_name: number;
  unit_text: string;
  created_at: string;
}

export interface CashRegister {
  id: number;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  closing_amount: number | null;
  expected_amount: number | null;
  operator_name: string;
  status: string;
}

export interface CashMovement {
  id: number;
  register_id: number;
  movement_type: string;
  amount: number;
  description: string;
  created_at: string;
}

export interface ClosingReport {
  register: CashRegister;
  movements: CashMovement[];
  sales_by_payment: PaymentSummary[];
  total_sales: number;
  total_supplies: number;
  total_withdrawals: number;
  expected_in_drawer: number;
  actual_in_drawer: number;
  difference: number;
}

export interface PaymentSummary {
  payment_method: string;
  total: number;
  count: number;
}

export interface AbcProduct {
  name: string;
  qty: number;
  total: number;
  cost_total: number;
  margin: number;
  percentage: number;
  accumulated: number;
  classification: string;
}

export interface PeriodSummary {
  total_sales: number;
  total_cost: number;
  profit: number;
  margin_percent: number;
  sales_count: number;
  avg_ticket: number;
}

// === Batches / Validade ===
export interface ProductBatch {
  id: number;
  product_id: number;
  product_name: string | null;
  batch_code: string;
  quantity: number;
  expiry_date: string;
  created_at: string;
}

export interface ExpiryAlert {
  batch: ProductBatch;
  days_until_expiry: number;
  status: string;
}

// === Promocoes ===
export interface Promotion {
  id: number;
  name: string;
  promotion_type: string;
  product_id: number | null;
  product_name: string | null;
  min_quantity: number;
  discount_percent: number;
  discount_amount: number;
  buy_quantity: number;
  pay_quantity: number;
  wholesale_price: number | null;
  start_date: string;
  end_date: string;
  active: boolean;
  created_at: string;
}

// === Fornecedores ===
export interface Supplier {
  id: number;
  name: string;
  company_name: string;
  document: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  active: boolean;
  created_at: string;
}

// === Compras ===
export interface PurchaseOrder {
  id: number;
  supplier_id: number | null;
  supplier_name: string | null;
  total: number;
  status: string;
  notes: string;
  created_at: string;
}

export interface PurchaseItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_cost: number;
}

// === Perdas ===
export interface LossRecord {
  id: number;
  product_id: number;
  product_name: string | null;
  quantity: number;
  reason: string;
  description: string;
  value: number;
  created_at: string;
}

// === Orcamentos ===
export interface Quote {
  id: number;
  customer_name: string;
  customer_document: string;
  total: number;
  status: string;
  notes: string;
  created_at: string;
}

export interface QuoteItem {
  id: number;
  quote_id: number;
  product_id: number;
  product_name: string;
  unit_price: number;
  quantity: number;
}

// === Contas ===
export interface Account {
  id: number;
  account_type: string;
  description: string;
  amount: number;
  due_date: string;
  paid: boolean;
  paid_date: string | null;
  supplier_id: number | null;
  customer_id: number | null;
  notes: string;
  created_at: string;
}

export interface CashFlowEntry {
  date: string;
  inflow: number;
  outflow: number;
  balance: number;
}

// === Usuarios / Logs ===
export interface User {
  id: number;
  name: string;
  login: string;
  role: string;
  active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  user_name: string;
  action: string;
  details: string;
  terminal: string;
  created_at: string;
}

// === PIX Dinamico via Mercado Pago ===
// O token aqui e o Access Token de PRODUCAO da conta MP do DONO DA LOJA
// (nao confundir com o token do sistema de licenciamento).
// Cada loja configura o proprio token nas Configuracoes > PIX.
export interface PixSettings {
  enabled: boolean;
  mp_access_token: string;
  payer_email_fallback: string; // email generico quando cliente nao informa CPF
  expiration_minutes: number;   // tempo de expiracao do QR (padrao 10 min)
  auto_confirm: boolean;        // finaliza a venda automaticamente ao detectar pagamento
}

export const DEFAULT_PIX_SETTINGS: PixSettings = {
  enabled: false,
  mp_access_token: "",
  payer_email_fallback: "cliente@loja.com.br",
  expiration_minutes: 10,
  auto_confirm: true,
};

// === Maquininha de Cartao ===
export type CardAcquirer =
  | "Stone" | "Cielo" | "Rede" | "PagBank" | "Getnet"
  | "SumUp" | "InfinitePay" | "Mercado Pago" | "Outro";

export interface CardMachineSettings {
  enabled: boolean;
  acquirer: CardAcquirer;
  model: string;
  instruction_message: string;
  ask_confirmation: boolean;
}

export const DEFAULT_CARD_SETTINGS: CardMachineSettings = {
  enabled: false,
  acquirer: "Stone",
  model: "",
  instruction_message: "Passe o cartao na maquininha e confirme o valor de",
  ask_confirmation: true,
};

// === Impressora Termica ===
export type PaperSize = "58mm" | "80mm" | "a4";

export interface PrinterSettings {
  enabled: boolean;
  paper_size: PaperSize;
  printer_name: string;
  auto_print: boolean;
  copies: number;
  show_logo: boolean;
  show_cnpj: boolean;
  show_address: boolean;
  footer_message: string;
}

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  enabled: false,
  paper_size: "80mm",
  printer_name: "",
  auto_print: false,
  copies: 1,
  show_logo: true,
  show_cnpj: true,
  show_address: true,
  footer_message: "Obrigado pela preferencia!",
};

// Chaves localStorage para configs adicionais (independentes do backend Rust)
export const LS_PIX_KEY = "simplificaoficina_pix_config";
export const LS_CARD_KEY = "simplificaoficina_card_config";
export const LS_PRINTER_KEY = "simplificaoficina_printer_config";

// === Informacoes da Loja ===
export interface StoreSettings {
  name: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  cep: string;
  inscription: string;
  display_message: string;
  logo: string; // data URL da logo (ex: data:image/png;base64,...) ou vazio
}

// === Estado da Exibicao (tela do cliente) ===
export interface DisplayState {
  cashier_open: boolean;
  called_number: number;
  waiting: number;
  last_ticket: number;
}

// === Licenciamento ===
export interface LocalLicense {
  license_key: string;
  machine_id: string;
  cache: string | null;
}

export interface LicenseCache {
  status: "ok" | "blocked";
  checked_at: string;
  expires_at?: string | null;
  customer_name?: string | null;
  message?: string;
}

// === Sessao de operador ===
export interface SessionUser {
  id: number;
  name: string;
  login: string;
  role: string;
}

export const ROLE_RANK: Record<string, number> = {
  operator: 1,
  supervisor: 2,
  manager: 3,
  admin: 4,
  seller_admin: 5,
};

export const ROLE_LABEL: Record<string, string> = {
  operator: "Operador",
  supervisor: "Supervisor",
  manager: "Gerente",
  admin: "Responsavel da loja",
  seller_admin: "Administrador do sistema",
};

// === Oficina mecânica ===
export interface Vehicle {
  id: number; customer_id: number | null; customer_name: string | null;
  plate: string; brand: string; model: string; year: string; color: string;
  mileage: number; notes: string; created_at: string;
}

export interface WorkshopService {
  id: number; name: string; description: string; price: number; active: boolean; created_at: string;
}

export interface ServiceOrder {
  id: number; vehicle_id: number; customer_id: number | null; plate: string;
  vehicle_name: string; customer_name: string | null; status: string; priority: string;
  complaint: string; diagnosis: string; services: string; parts: string;
  labor_total: number; parts_total: number; discount: number; total: number;
  promised_at: string | null; mechanic: string; payment_method: string;
  created_at: string; updated_at: string;
}

export interface Appointment {
  id: number; customer_name: string; phone: string; vehicle: string; plate: string;
  service: string; scheduled_at: string; status: string; notes: string; created_at: string;
}

export interface WorkshopDashboard {
  open_orders: number; in_progress: number; ready: number; today_appointments: number;
  month_revenue: number; vehicles: number;
}
