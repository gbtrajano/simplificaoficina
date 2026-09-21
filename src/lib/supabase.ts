// Cliente leve do Supabase (REST) — sem dependência externa.
// Configuração via .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export const supabaseConfigured = Boolean(supabaseUrl && anonKey);

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthResponse {
  access_token: string;
  user: { id: string; email?: string | null };
}

export interface SignUpResult {
  user: AuthUser;
  needsEmailConfirmation: boolean;
}

interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

// A sessão fica somente em memória. Assim, ao fechar o sistema, o cliente precisa
// informar a senha novamente e nenhum refresh token fica gravado no computador.
let authSession: AuthSession | null = null;

function authHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: anonKey,
  };
}

function requireAuthSession(): AuthSession {
  if (!authSession) throw new Error("Faça login com seu e-mail para continuar.");
  return authSession;
}

export interface ActivationResult {
  status: "ok" | "invalid" | "revoked" | "expired" | "limit";
  message?: string;
  customerName?: string | null;
  expiresAt?: string | null;
  maxMachines?: number | null;
  registered?: boolean;
}

export interface AdminLicense {
  id: string;
  key: string;
  customer_name: string;
  customer_email: string;
  max_machines: number;
  max_users?: number;
  status: "active" | "revoked";
  expires_at: string | null;
  mercadopago_subscription_id?: string | null;
  mercadopago_payment_id?: string | null;
  billing_status?: "pending" | "paid" | "overdue" | "canceled" | string;
  last_payment_at?: string | null;
  next_due_at?: string | null;
  notes: string;
  created_at: string;
  activation_count: number;
  activations: {
    id: string;
    machine_id: string;
    machine_name: string;
    activated_at: string;
    last_seen_at: string;
  }[];
}

export interface MyLicense {
  license_id: string;
  key: string;
  customer_name: string;
  customer_email: string;
  expires_at: string | null;
  status: "active" | "revoked" | string;
  billing_status: "pending" | "paid" | "overdue" | "canceled" | string;
  next_due_at: string | null;
  mercadopago_subscription_id: string | null;
  access_role: string;
}

type RpcParams = Record<string, unknown>;

async function rpc<T>(fn: string, params: RpcParams): Promise<T> {
  if (!supabaseConfigured) {
    throw new Error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.");
  }
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const data = await res.json();
      msg = data.message || data.msg || data.error || msg;
    } catch {
      /* corpo não-JSON */
    }
    throw new Error(msg);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

async function authenticatedRpc<T>(fn: string, params: RpcParams): Promise<T> {
  if (!supabaseConfigured) {
    throw new Error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.");
  }
  const session = requireAuthSession();
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { ...authHeaders(), Authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const data = await res.json();
      msg = data.message || data.msg || data.error || msg;
    } catch { /* corpo não-JSON */ }
    throw new Error(msg);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// ==== Funções do app (cliente) ====

export const supabaseApi = {
  async signUpWithLicense(
    licenseKey: string,
    email: string,
    password: string
  ): Promise<SignUpResult> {
    if (!supabaseConfigured) throw new Error("Supabase não configurado.");

    const normalizedEmail = email.trim().toLowerCase();
    await rpc<{ ok: boolean }>("validate_license_signup", {
      p_key: licenseKey.trim().toUpperCase(),
      p_email: normalizedEmail,
    });

    const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email: normalizedEmail, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.user?.id || !data.user?.email) {
      throw new Error(data.error_description || data.msg || "Não foi possível criar a conta.");
    }

    const user: AuthUser = { id: data.user.id, email: data.user.email };
    if (data.access_token) {
      authSession = { accessToken: data.access_token, user };
      // A função vincula a licença validada à conta autenticada. O get_my_license
      // também mantém o vínculo por e-mail como compatibilidade.
      await authenticatedRpc("claim_license_by_key", {
        p_key: licenseKey.trim().toUpperCase(),
      });
    }

    return { user, needsEmailConfirmation: !data.access_token };
  },

  async signInWithEmail(email: string, password: string): Promise<AuthUser> {
    if (!supabaseConfigured) throw new Error("Supabase não configurado.");
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token || !data.user?.email) {
      throw new Error(data.error_description || data.msg || "E-mail ou senha inválidos.");
    }
    authSession = {
      accessToken: (data as AuthResponse).access_token,
      user: { id: data.user.id, email: data.user.email },
    };
    return authSession.user;
  },

  async signOut(): Promise<void> {
    const session = authSession;
    authSession = null;
    if (!session || !supabaseConfigured) return;
    await fetch(`${supabaseUrl}/auth/v1/logout`, {
      method: "POST",
      headers: { ...authHeaders(), Authorization: `Bearer ${session.accessToken}` },
    }).catch(() => undefined);
  },

  getAuthenticatedUser(): AuthUser | null {
    return authSession?.user ?? null;
  },

  async getMyLicense(): Promise<MyLicense> {
    // Funções SQL que retornam TABLE chegam pelo PostgREST como um array JSON.
    const [license] = await authenticatedRpc<MyLicense[]>("get_my_license", {});
    if (!license?.key) throw new Error("Nenhuma licença foi encontrada para esta conta.");
    return license;
  },

  async createLicenseRenewalCheckout(): Promise<{ ok: boolean; orderId: string; subscriptionId: string; checkoutUrl: string }> {
    if (!supabaseConfigured) throw new Error("Supabase nao configurado");
    const session = requireAuthSession();
    const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, {
      method: "POST",
      headers: { ...authHeaders(), Authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({ plan: "store_10", renewal: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
    return data;
  },

  async manageStoreUsers(method: "GET" | "POST" | "PATCH", body?: Record<string, unknown>): Promise<any> {
    const session = requireAuthSession();
    const res = await fetch(`${supabaseUrl}/functions/v1/manage-store-users`, {
      method,
      headers: { ...authHeaders(), Authorization: `Bearer ${session.accessToken}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
    return data;
  },

  isLicenseAdmin(): Promise<boolean> {
    return authenticatedRpc("is_license_admin", {});
  },

  activateLicense(key: string, machineId: string, machineName: string): Promise<ActivationResult> {
    return rpc("activate_license", {
      p_key: key,
      p_machine_id: machineId,
      p_machine_name: machineName,
    });
  },

  checkLicense(key: string, machineId: string): Promise<ActivationResult> {
    return rpc("check_license", {
      p_key: key,
      p_machine_id: machineId,
    });
  },

  async createMercadoPagoCheckout(input: {
    plan: "store_10";
    name: string;
    email: string;
    document: string;
    phone?: string;
  }): Promise<{ ok: boolean; orderId: string; subscriptionId: string; checkoutUrl: string }> {
    if (!supabaseConfigured) throw new Error("Supabase não configurado");
    const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
    return data;
  },

  sellerPasswordSet(): Promise<boolean> {
    return rpc("seller_password_set", {});
  },

  // ==== Funções do vendedor (exigem a senha do vendedor) ====

  adminListLicenses(_password = ""): Promise<AdminLicense[]> {
    return authenticatedRpc("admin_list_licenses_for_current_user", {});
  },

  adminLicenseDashboard(): Promise<{
    total: number; active: number; expired: number; revoked: number;
    paid: number; overdue: number; pending: number; monthly_revenue: number;
  }> {
    return authenticatedRpc("admin_license_dashboard", {});
  },

  adminCreateLicense(
    _password: string,
    customerName: string,
    customerEmail: string,
    maxMachines: number,
    expiresAt: string | null,
    notes: string
  ): Promise<AdminLicense> {
    return authenticatedRpc("admin_create_license_for_current_user", {
      p_customer_name: customerName,
      p_customer_email: customerEmail,
      p_max_machines: maxMachines,
      p_expires_at: expiresAt,
      p_notes: notes,
    });
  },

  adminSetLicenseStatus(_password: string, id: string, status: "active" | "revoked"): Promise<{ ok: boolean }> {
    return authenticatedRpc("admin_set_license_status_for_current_user", {
      p_license_id: id,
      p_status: status,
    });
  },

  adminExtendLicense(_password: string, id: string, expiresAt: string): Promise<{ ok: boolean }> {
    return authenticatedRpc("admin_extend_license_for_current_user", {
      p_license_id: id,
      p_expires_at: expiresAt,
    });
  },

  adminDeleteActivation(_password: string, activationId: string): Promise<{ ok: boolean }> {
    return authenticatedRpc("admin_delete_activation_for_current_user", {
      p_activation_id: activationId,
    });
  },

  adminDeleteLicense(_password: string, id: string): Promise<{ ok: boolean }> {
    return authenticatedRpc("admin_delete_license_for_current_user", {
      p_license_id: id,
    });
  },

};
