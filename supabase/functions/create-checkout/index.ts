// Cria um pedido pendente e uma assinatura mensal hospedada pelo Mercado Pago.
// Precos e status do pedido sao controlados no backend.
// Nunca coloque MP_ACCESS_TOKEN ou SUPABASE_SERVICE_ROLE_KEY no frontend.

const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("BACKEND_SERVICE_ROLE_KEY") || "";
const mercadoPagoToken = Deno.env.get("MP_ACCESS_TOKEN") || "";
const mercadoPagoBase = (Deno.env.get("MP_API_BASE_URL") || "https://api.mercadopago.com").replace(/\/$/, "");
const backUrl = (Deno.env.get("MP_BACK_URL") || Deno.env.get("PUBLIC_APP_URL") || "").trim();
const webhookUrl = (Deno.env.get("MP_WEBHOOK_URL") || "").trim();

const cors = {
  "access-control-allow-origin": Deno.env.get("PUBLIC_APP_ORIGIN") || "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "content-type": "application/json" },
});

const plans = {
  // A conta proprietaria nao consome uma vaga: este plano libera dez
  // subcontas para a equipe da oficina, alem da conta proprietaria.
  store_10: { name: "Simplifica Oficina Completa", value: 29.99, maxUsers: 10 },
} as const;

type PlanName = keyof typeof plans;

function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function supabase(path: string, method: string, body?: unknown) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  const raw = await response.text();
  return raw ? JSON.parse(raw) : null;
}

async function authenticatedRpc(request: Request, fn: string, body: Record<string, unknown>) {
  const authorization = request.headers.get("authorization") || "";
  // Chamadas publicas usam a anon key como Bearer. Renovacao exige um JWT de
  // usuario autenticado, que possui tres segmentos separados por ponto.
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (token.split(".").length !== 3) throw new Error("Faca login para renovar a mensalidade.");
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Licenca ${response.status}: ${await response.text()}`);
  return response.json();
}

async function mercadoPago(path: string, body: unknown) {
  const response = await fetch(`${mercadoPagoBase}${path}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${mercadoPagoToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Registra o corpo devolvido pelo Mercado Pago para diagnóstico. Tokens e
    // demais credenciais nunca fazem parte desse objeto de resposta.
    console.error("Mercado Pago API error", { path, status: response.status, data });
    throw new Error(data?.message || data?.error || `Mercado Pago ${response.status}`);
  }
  return data;
}

async function mercadoPagoGet(path: string) {
  const response = await fetch(`${mercadoPagoBase}${path}`, {
    headers: { accept: "application/json", authorization: `Bearer ${mercadoPagoToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Mercado Pago API error", { path, status: response.status, data });
    throw new Error(data?.message || data?.error || `Mercado Pago ${response.status}`);
  }
  return data;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceKey || !mercadoPagoToken || !webhookUrl || !backUrl) {
    return json({ error: "checkout_not_configured" }, 500);
  }

  let orderId: string | null = null;
  try {
    const body = await request.json();
    const renewal = body?.renewal === true;
    const plan = text(body?.plan, 20).toLowerCase() as PlanName;
    const selectedPlan = plans[plan];
    let name = text(body?.name, 120);
    let email = text(body?.email, 160).toLowerCase();
    let document = text(body?.document, 20);
    let phone = text(body?.phone, 30);
    let renewalLicense: Record<string, any> | null = null;

    if (renewal) {
      const rows = await authenticatedRpc(request, "get_my_license", {});
      renewalLicense = Array.isArray(rows) ? rows[0] : null;
      if (!renewalLicense?.license_id) throw new Error("Licenca nao encontrada para renovacao.");
      if (renewalLicense.access_role !== "owner") throw new Error("Somente o proprietario pode renovar a mensalidade.");
      if (renewalLicense.status === "revoked") throw new Error("Esta licenca foi revogada. Entre em contato com o suporte.");
      name = text(renewalLicense.customer_name, 120);
      email = text(renewalLicense.customer_email, 160).toLowerCase();
      document = "renewal";
      phone = "";
    }

    if (!selectedPlan || !name || name.length < 2 || !validEmail(email) || !document) {
      return json({ error: "invalid_customer_or_plan" }, 400);
    }

    // Diagnóstico seguro: mostra somente a identidade pública associada ao
    // token, nunca o valor do token. Ajuda a conferir a conta coletora.
    const collector = await mercadoPagoGet("/users/me");
    console.log("Mercado Pago collector", {
      id: collector?.id,
      email: collector?.email,
      site_id: collector?.site_id,
      tags: collector?.tags,
    });

    // Nao cria assinaturas duplicadas quando o cliente clica novamente. Se a
    // licenca ja possui uma assinatura utilizavel, reabre o checkout dela.
    if (renewal && renewalLicense?.mercadopago_subscription_id) {
      const existing = await mercadoPagoGet(`/preapproval/${encodeURIComponent(String(renewalLicense.mercadopago_subscription_id))}`)
        .catch(() => null);
      if (existing?.init_point && ["pending", "authorized"].includes(String(existing.status || "").toLowerCase())) {
        const orders = await supabase(
          `orders?select=id&mercadopago_subscription_id=eq.${encodeURIComponent(String(existing.id))}&order=created_at.desc&limit=1`,
          "GET",
        );
        return json({
          ok: true,
          orderId: orders?.[0]?.id || "existing",
          subscriptionId: existing.id,
          checkoutUrl: existing.init_point,
        });
      }
    }

    // O valor vem exclusivamente de plans, nunca do request do navegador.
    const inserted = await supabase("orders", "POST", {
      customer_name: name,
      customer_email: email,
      customer_document: document,
      customer_phone: phone || null,
      plan,
      amount: selectedPlan.value,
      status: "pending",
      license_id: renewalLicense?.license_id || null,
      expires_at: renewalLicense?.expires_at || null,
    });
    orderId = inserted?.[0]?.id;
    if (!orderId) throw new Error("Pedido nao foi criado");

    // Assinatura sem plano associado e com pagamento pendente. O init_point
    // leva o cliente ao checkout hospedado do Mercado Pago.
    const subscriptionInput: Record<string, unknown> = {
      reason: `${selectedPlan.name} - Gestão de oficina`,
      external_reference: orderId,
      payer_email: email,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: selectedPlan.value,
        currency_id: "BRL",
      },
      notification_url: `${webhookUrl}?source_news=webhooks`,
      status: "pending",
    };
    // O Mercado Pago exige uma URL pública de retorno. Ela é apenas visual:
    // a liberação da licença continua dependendo exclusivamente do webhook.
    subscriptionInput.back_url = backUrl;

    const subscription = await mercadoPago("/preapproval", subscriptionInput);

    if (!subscription?.id || !subscription?.init_point) throw new Error("Mercado Pago nao retornou o checkout");

    await supabase(`orders?id=eq.${encodeURIComponent(orderId)}`, "PATCH", {
      mercadopago_subscription_id: subscription.id,
    });

    return json({ ok: true, orderId, subscriptionId: subscription.id, checkoutUrl: subscription.init_point });
  } catch (error) {
    if (orderId) {
      try { await supabase(`orders?id=eq.${encodeURIComponent(orderId)}`, "PATCH", { status: "canceled" }); } catch { /* preserva o erro original */ }
    }
    console.error("create-checkout", error);
    return json({ error: "checkout_creation_failed" }, 400);
  }
});
