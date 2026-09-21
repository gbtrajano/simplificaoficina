// Webhook do Mercado Pago.
// O webhook nunca confia apenas no corpo recebido: consulta o recurso na API
// do Mercado Pago antes de alterar pedido ou licenca.

const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("BACKEND_SERVICE_ROLE_KEY") || "";
const mercadoPagoToken = Deno.env.get("MP_ACCESS_TOKEN") || "";
const webhookSecret = Deno.env.get("MP_WEBHOOK_SECRET") || "";
const mercadoPagoBase = (Deno.env.get("MP_API_BASE_URL") || "https://api.mercadopago.com").replace(/\/$/, "");

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

function signatureParts(value: string): { ts: string; v1: string } {
  const parts = value.split(",").map((part) => part.trim().split("=", 2));
  return {
    ts: parts.find(([key]) => key === "ts")?.[1] || "",
    v1: parts.find(([key]) => key === "v1")?.[1] || "",
  };
}

function equalHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function mercadoPago(path: string) {
  const response = await fetch(`${mercadoPagoBase}${path}`, {
    headers: { accept: "application/json", authorization: `Bearer ${mercadoPagoToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.error || `Mercado Pago ${response.status}`);
  return data;
}

async function rpc(fn: string, body: Record<string, unknown>) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Supabase RPC ${fn}: ${await response.text()}`);
  return response.json().catch(() => null);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceKey || !mercadoPagoToken || !webhookSecret) return json({ error: "webhook_not_configured" }, 500);

  const url = new URL(request.url);
  const payload = await request.json().catch(() => null) as Record<string, any> | null;
  if (!payload) return json({ error: "invalid_json" }, 400);

  const signature = signatureParts(request.headers.get("x-signature") || "");
  const requestId = request.headers.get("x-request-id") || "";
  const dataId = url.searchParams.get("data.id") || String(payload.data?.id || "");
  if (!signature.ts || !signature.v1 || !requestId || !dataId) return json({ error: "invalid_signature" }, 401);

  const manifest = `id:${dataId};request-id:${requestId};ts:${signature.ts};`;
  const expected = await hmacHex(webhookSecret, manifest);
  if (!equalHex(expected, signature.v1)) return json({ error: "invalid_signature" }, 401);

  const eventType = String(payload.type || url.searchParams.get("type") || "");
  const dataIdPath = encodeURIComponent(dataId);
  const eventId = String(payload.id || `${eventType}:${dataId}:${payload.action || "updated"}`);

  try {
    if (eventType === "payment") {
      const payment = await mercadoPago(`/v1/payments/${dataIdPath}`);
      await rpc("apply_mercadopago_payment", {
        p_event_id: eventId,
        p_event_type: String(payload.action || "payment.updated"),
        p_payment_id: String(payment.id || dataId),
        p_subscription_id: payment.preapproval_id || payment.subscription_id || null,
        p_external_reference: payment.external_reference || null,
        p_status: payment.status || null,
        p_status_detail: payment.status_detail || null,
        p_amount: payment.transaction_amount ?? null,
        p_payment_date: payment.date_approved || payment.date_created || null,
        p_payload: payment,
      });
    } else if (eventType === "subscription_preapproval") {
      const subscription = await mercadoPago(`/preapproval/${dataIdPath}`);
      await rpc("apply_mercadopago_subscription", {
        p_event_id: eventId,
        p_event_type: String(payload.action || "subscription_preapproval.updated"),
        p_subscription_id: String(subscription.id || dataId),
        p_external_reference: subscription.external_reference || null,
        p_status: subscription.status || null,
        p_payload: subscription,
      });
    }

    // O Mercado Pago considera 200/201 como recebimento confirmado e faz
    // novas tentativas quando a resposta nao chega.
    return json({ ok: true });
  } catch (error) {
    console.error("mercadopago-webhook", error);
    return json({ error: "webhook_processing_failed" }, 500);
  }
});
