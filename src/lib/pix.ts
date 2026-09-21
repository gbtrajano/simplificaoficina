/**
 * lib/pix.ts — Integracao com a API de Pagamentos PIX do Mercado Pago
 *
 * O Access Token usado aqui e o da CONTA DO DONO DA LOJA (nao o do sistema de
 * licenciamento). Cada cliente que compra o SimplificaPDV configura o proprio
 * token em Configuracoes > PIX para receber os pagamentos das suas vendas.
 *
 * Fluxo:
 *   1. createPixPayment()  — cria a cobranca e retorna QR code + ID
 *   2. pollPixPayment()    — verifica a cada 3s se foi pago (retorna status)
 *   3. cancelPixPayment()  — cancela a cobranca se o operador fechar o modal
 */

const MP_API = "https://api.mercadopago.com";

export interface PixPaymentResult {
  id: number;
  status: string; // "pending", "approved", "rejected", "cancelled"
  qr_code: string;        // string "copia e cola"
  qr_code_base64: string; // imagem PNG em base64 para exibir diretamente
  ticket_url: string;     // URL para pagina de pagamento (fallback)
}

export interface PixPaymentStatus {
  id: number;
  status: string;
  status_detail: string;
}

/**
 * Cria uma cobranca PIX no Mercado Pago e retorna o QR Code.
 */
export async function createPixPayment(
  accessToken: string,
  amount: number,
  description: string,
  payerEmail: string,
  expirationMinutes = 10
): Promise<PixPaymentResult> {
  if (!accessToken) throw new Error("Token MP nao configurado. Va em Configuracoes > PIX.");
  if (amount <= 0) throw new Error("Valor invalido para cobranca PIX.");

  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000)
    .toISOString()
    .replace("Z", "-03:00");

  const body = {
    transaction_amount: parseFloat(amount.toFixed(2)),
    description: description || "Venda SimplificaPDV",
    payment_method_id: "pix",
    date_of_expiration: expiresAt,
    payer: {
      email: payerEmail || "cliente@loja.com.br",
    },
  };

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Idempotency-Key": `pdv-pix-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.message || data?.cause?.[0]?.description || `Erro MP ${res.status}`;
    throw new Error(msg);
  }

  const txData = data?.point_of_interaction?.transaction_data;
  if (!txData?.qr_code) {
    throw new Error("Mercado Pago nao retornou o QR Code PIX.");
  }

  return {
    id: data.id,
    status: data.status,
    qr_code: txData.qr_code,
    qr_code_base64: txData.qr_code_base64 || "",
    ticket_url: txData.ticket_url || "",
  };
}

/**
 * Consulta o status de um pagamento PIX.
 * Chame em loop (a cada 3s) ate status === "approved" ou cancelamento.
 */
export async function getPixPaymentStatus(
  accessToken: string,
  paymentId: number
): Promise<PixPaymentStatus> {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Erro ao consultar pagamento ${paymentId}`);

  return {
    id: data.id,
    status: data.status,
    status_detail: data.status_detail,
  };
}

/**
 * Cancela um pagamento PIX pendente (o QR nao podera mais ser usado).
 */
export async function cancelPixPayment(
  accessToken: string,
  paymentId: number
): Promise<void> {
  await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ status: "cancelled" }),
  }).catch(() => {
    // Ignorar erro de cancelamento — o pagamento vai expirar naturalmente
  });
}

/**
 * Inicia um polling que verifica o status do pagamento a cada 3 segundos.
 * Chame a funcao retornada (stopPolling) para parar.
 */
export function startPixPolling(
  accessToken: string,
  paymentId: number,
  onApproved: () => void,
  onError: (err: string) => void,
  intervalMs = 3000
): () => void {
  let active = true;
  let consecutiveErrors = 0;

  const poll = async () => {
    if (!active) return;
    try {
      const { status } = await getPixPaymentStatus(accessToken, paymentId);
      consecutiveErrors = 0;
      if (status === "approved") {
        active = false;
        onApproved();
        return;
      }
      if (status === "cancelled" || status === "rejected") {
        active = false;
        onError(`Pagamento ${status}`);
        return;
      }
    } catch (e) {
      consecutiveErrors++;
      if (consecutiveErrors >= 5) {
        active = false;
        onError("Sem conexao com o Mercado Pago. Verifique a internet.");
        return;
      }
    }
    if (active) setTimeout(poll, intervalMs);
  };

  setTimeout(poll, intervalMs);

  return () => { active = false; };
}
