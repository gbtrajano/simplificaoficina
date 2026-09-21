import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { supabaseApi } from "../lib/supabase";
import { useSession } from "../components/SessionGate";

type Plan = { key: "store_10"; name: string; price: string; description: string; features: string[] };
type Pending = { planName: string; orderId: string; checkoutUrl: string };

const plans: Plan[] = [
  { key: "store_10", name: "Oficina Completa", price: "R$ 29,99", description: "Gestão completa para a oficina e toda a sua equipe", features: ["Ordens de serviço ilimitadas", "Agenda, clientes e veículos", "Controle de peças e financeiro", "Conta proprietária da oficina", "Até 10 contas para a equipe", "Atualizações e suporte técnico"] },
];

export default function Suporte() {
  const { user } = useSession();
  const isOwner = user?.role === "admin";
  const checkoutStorageKey = "simplificapdv_checkout";
  const [pending, setPending] = useState<Pending | null>(() => { try { return JSON.parse(localStorage.getItem(checkoutStorageKey) || "null"); } catch { return null; } });
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("checkout");
    if (result === "retorno") setMessage("O retorno do Mercado Pago foi recebido. A licença será liberada após a confirmação do pagamento.");
  }, []);

  const startPayment = async (plan: Plan) => {
    if (!isOwner || paying) return;
    setError("");
    setPaying(true);
    try {
      const result = await supabaseApi.createLicenseRenewalCheckout();
      const next = { planName: plan.name, orderId: result.orderId, checkoutUrl: result.checkoutUrl };
      localStorage.setItem(checkoutStorageKey, JSON.stringify(next));
      setPending(next); setMessage("Abrindo o Checkout do Mercado Pago...");
      await openUrl(result.checkoutUrl);
    } catch (value) { setError(value instanceof Error ? value.message : String(value)); }
    finally { setPaying(false); }
  };
  const cancelPending = () => { setPending(null); localStorage.removeItem(checkoutStorageKey); };
  const continuePayment = async () => { if (pending) await openUrl(pending.checkoutUrl); };

  return <div className="space-y-6 animate-fade-in">
    <div className="page-header"><h1>Mensalidade</h1><p>Consulte ou regularize a mensalidade do seu plano.</p></div>
    {message && <div className="card-elevated p-4 border-l-4 border-l-brand-400 text-sm text-ink-700">{message}</div>}
    {pending && <div className="card-elevated p-5 border-l-4 border-l-amber-400 bg-amber-50/30"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-ink-900">Pagamento pendente — plano {pending.planName}</h2><p className="text-sm text-ink-600 mt-1">Conclua o pagamento no ambiente seguro do Mercado Pago.</p></div><div className="flex gap-2"><button onClick={() => void continuePayment()} className="btn-primary text-xs">Continuar pagamento</button><button onClick={cancelPending} className="btn-outline text-xs text-red-600 border-red-200">Cancelar</button></div></div><p className="mt-3 text-xs text-amber-800">A licença só será criada ou renovada após o webhook confirmar o pagamento aprovado.</p></div>}
    {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700" role="alert">{error}</div>}
    <div className="grid grid-cols-1 max-w-xl gap-5">{plans.map((plan) => <div key={plan.key} className="card-elevated p-6">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold border mb-4 bg-brand-50 text-brand-700 border-brand-200/50">✦</div><h3 className="font-bold text-ink-900 text-lg">{plan.name}</h3><p className="text-xs text-ink-500 mb-4">{plan.description}</p><div className="flex items-baseline gap-1 mb-5"><span className="text-3xl font-extrabold text-brand-700">{plan.price}</span><span className="text-sm text-ink-400">/mês</span></div><ul className="space-y-2.5 mb-6">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm text-ink-600"><span className="text-brand-700">✓</span>{feature}</li>)}</ul><button disabled={Boolean(pending) || paying || !isOwner} onClick={() => void startPayment(plan)} className="w-full py-2.5 rounded-xl font-semibold text-sm btn-primary">{!isOwner ? "Somente o proprietário pode pagar" : paying ? "Abrindo Mercado Pago..." : pending ? "Pagamento pendente" : "Pagar mensalidade — R$ 29,99"}</button>
    </div>)}</div>
    {!isOwner && <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">Peça ao proprietário da oficina para acessar esta tela e regularizar a mensalidade.</div>}
    <div className="card-elevated p-5 text-sm text-ink-600"><strong className="text-ink-900">Pagamento seguro:</strong> você será direcionado ao Checkout hospedado do Mercado Pago. O Simplifica Oficina não recebe nem armazena dados de cartão.</div>
  </div>;
}
