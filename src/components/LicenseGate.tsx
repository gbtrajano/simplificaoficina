import { useEffect, useRef, useState, type ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "../lib/api";
import { supabaseApi, supabaseConfigured, type ActivationResult, type MyLicense } from "../lib/supabase";
import type { LicenseCache } from "../types";
import { canUseOfflineLicense, GRACE_DAYS } from "../lib/licensePolicy";
import Icon from "./Icon";

// Dias de tolerância sem internet após uma verificação online bem-sucedida
// Batimento cardíaco: revalida a licença e atualiza o last_seen_at no servidor
const CHECK_INTERVAL_MS = 60 * 1000;

type Phase = "loading" | "ready" | "blocked";

interface BlockInfo {
  title: string;
  message: string;
}

const blockMessages: Record<string, BlockInfo> = {
  invalid: { title: "Licença inválida", message: "Esta chave não existe. Verifique com o vendedor." },
  revoked: { title: "Licença revogada", message: "Esta licença foi revogada pelo vendedor." },
  expired: { title: "Licença expirada", message: "O período de uso desta licença terminou. Renove com o vendedor." },
};

function friendlyError(e: unknown): string {
  const raw = String(e);
  const isBrowser =
    raw.includes("TAURI") ||
    raw.includes("__TAURI") ||
    raw.includes("window.__TAURI") ||
    raw.includes("is not defined") ||
    raw.includes("undefined");
  if (isBrowser) {
    return (
      "O app está rodando fora do Tauri (ex.: aberto no navegador). " +
      "Feche e execute com: npm run tauri dev — e abra a janela nativa, não uma aba do navegador."
    );
  }
  const isMissingCommand =
    raw.toLowerCase().includes("not found") ||
    raw.toLowerCase().includes("não encontrad") ||
    raw.toLowerCase().includes("unknown command") ||
    raw.toLowerCase().includes("command") && raw.toLowerCase().includes("not");
  if (isMissingCommand) {
    return (
      `Comando do backend não encontrado (${raw}). O executável está desatualizado: ` +
      "recompile com npm run tauri build (ou npm run tauri dev) para incluir o backend Rust."
    );
  }
  return raw;
}

function isNetworkFailure(error: unknown): boolean {
  const value = String(error).toLowerCase();
  return value.includes("failed to fetch") || value.includes("load failed") || value.includes("networkerror") || value.includes("network request failed");
}

function readCache(local: { cache: string | null } | null): LicenseCache | null {
  if (!local?.cache) return null;
  try {
    const parsed = JSON.parse(local.cache);
    return parsed && parsed.status ? (parsed as LicenseCache) : null;
  } catch {
    return null;
  }
}

export default function LicenseGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [block, setBlock] = useState<BlockInfo | null>(null);
  const [offline, setOffline] = useState(false);
  const [accountLicense, setAccountLicense] = useState<MyLicense | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const keyRef = useRef("");
  const machineIdRef = useRef("");
  const runningRef = useRef(false);

  const persistOk = async (key: string, res: ActivationResult) => {
    const cache: LicenseCache = {
      status: "ok",
      checked_at: new Date().toISOString(),
      expires_at: res.expiresAt ?? null,
      customer_name: res.customerName ?? null,
    };
    await api.saveLocalLicense({
      license_key: key,
      machine_id: machineIdRef.current,
      cache: JSON.stringify(cache),
    });
    keyRef.current = key;
    setOffline(false);
    setPhase("ready");
  };

  const verify = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      // Falha de configuração nunca libera o software sem ativação.
      if (!supabaseConfigured) {
        setBlock({ title: "Ativação indisponível", message: "Esta instalação não foi configurada para ativação. Entre em contato com o vendedor para receber o instalador correto." });
        setPhase("blocked");
        return;
      }

      const local = await api.getLocalLicense();
      const cached = readCache(local);
      if (local?.license_key) keyRef.current = local.license_key;
      // A chave é obtida da licença vinculada ao e-mail autenticado, sem digitá-la.
      let currentLicense: MyLicense;
      try {
        currentLicense = await supabaseApi.getMyLicense();
      } catch (error) {
        if (isNetworkFailure(error) && canUseOfflineLicense(cached)) {
          setOffline(true);
          setPhase("ready");
          return;
        }
        setBlock({
          title: isNetworkFailure(error) ? "Sem conexão com o servidor" : "Não foi possível validar a licença",
          message: isNetworkFailure(error)
            ? `Conecte este computador à internet para validar a licença. A carência offline é de ${GRACE_DAYS} dias e nunca ultrapassa o vencimento.`
            : friendlyError(error),
        });
        setPhase("blocked");
        return;
      }
      setAccountLicense(currentLicense);
      const license = local && local.license_key === currentLicense.key
        ? local
        : { license_key: currentLicense.key, machine_id: machineIdRef.current, cache: null };
      keyRef.current = license.license_key;

      const expired = Boolean(currentLicense.expires_at && Date.parse(currentLicense.expires_at) <= Date.now());
      if (currentLicense.status !== "active") {
        setBlock({ title: "Licença bloqueada", message: "Esta licença foi revogada. Entre em contato com o suporte." });
        setPhase("blocked");
        await api.saveLocalLicense({ ...license, cache: null }).catch(console.error);
        return;
      }
      if (expired) {
        setBlock({
          title: "Mensalidade vencida",
          message: "O período contratado terminou. O Simplifica Oficina será liberado automaticamente assim que o Mercado Pago confirmar o pagamento.",
        });
        setPhase("blocked");
        await api.saveLocalLicense({ ...license, cache: null }).catch(console.error);
        return;
      }

      // A licença pertence à conta autenticada, não ao computador. getMyLicense()
      // já confirmou no servidor que ela está ativa e dentro da validade; portanto
      // não chamamos a rotina legada activate_license, que impunha limite de máquinas.
      await persistOk(license.license_key, {
        status: "ok",
        customerName: currentLicense.customer_name,
        expiresAt: currentLicense.expires_at,
      });
    } catch (e) {
      console.error(e);
      setBlock({ title: "Erro interno", message: friendlyError(e) });
      setPhase("blocked");
    } finally {
      runningRef.current = false;
    }
  };

  useEffect(() => {
    api
      .getMachineId()
      .then((id) => {
        machineIdRef.current = id;
        verify();
      })
      .catch((e) => {
        console.error(e);
        setBlock({ title: "Erro interno", message: friendlyError(e) });
        setPhase("blocked");
      });

    const interval = setInterval(() => {
      if (keyRef.current && supabaseConfigured) {
        verify();
      }
    }, CHECK_INTERVAL_MS);
    const onFocus = () => verify();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renew = async () => {
    if (paying) return;
    setPaying(true);
    setPaymentMessage("");
    try {
      const checkout = await supabaseApi.createLicenseRenewalCheckout();
      await openUrl(checkout.checkoutUrl);
      setPaymentMessage("Checkout aberto. Aguardando a confirmação do Mercado Pago...");
    } catch (error) {
      setPaymentMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPaying(false);
    }
  };

  // ===== Telas =====

  if (phase === "loading") {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-ink-50 via-mint-bg to-brand-50/30">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 animate-pulse-soft" />
        <p className="text-sm text-ink-500 font-medium">Verificando licença...</p>
      </div>
    );
  }

  if (phase === "blocked" && block) {
    return (
      <div className="h-screen w-screen flex items-center justify-center p-6 bg-gradient-to-br from-ink-50 via-mint-bg to-brand-50/30">
        <div className="card-elevated max-w-md w-full p-8 text-center space-y-4 animate-scale-in">
          <div className="text-5xl">🔒</div>
          <h1 className="text-xl font-bold text-ink-900">{block.title}</h1>
          <p className="text-sm text-ink-500 leading-relaxed">{block.message}</p>
          {block.title === "Mensalidade vencida" && accountLicense?.access_role === "owner" && (
            <button onClick={() => void renew()} disabled={paying} className="btn-primary w-full">
              {paying ? "Abrindo pagamento..." : "Pagar mensalidade — R$ 29,99"}
            </button>
          )}
          {block.title === "Mensalidade vencida" && accountLicense?.access_role !== "owner" && (
            <p className="text-xs text-amber-700">Peça ao proprietário da loja para regularizar a mensalidade.</p>
          )}
          {paymentMessage && <p className="text-xs text-brand-700 font-medium">{paymentMessage}</p>}
          <button onClick={verify} className="btn-primary w-full">
            Verificar pagamento
          </button>
          <p className="text-[10px] text-ink-400">Simplifica Oficina</p>
        </div>
      </div>
    );
  }

  // ===== App liberado =====
  return (
    <>
      {offline && (
        <div className="fixed top-0 inset-x-0 z-40 bg-amber-400/95 text-amber-950 text-center text-xs font-semibold py-1.5 px-4">
          ⚠️ Sem internet — licença válida pela última verificação. Conecte para revalidar.
        </div>
      )}
      {children}
    </>
  );
}

// ===== Tela de ativação =====

function ActivationScreen({
  onActivated,
}: {
  onActivated: (key: string, res: ActivationResult) => Promise<void>;
}) {
  const [key, setKey] = useState("");
  const [machineLabel, setMachineLabel] = useState("");
  const [machineId, setMachineId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getMachineId().then(setMachineId).catch(console.error);
  }, []);

  const submit = async () => {
    const cleanKey = key.trim().toUpperCase();
    if (!cleanKey) {
      setError("Informe a chave de licença.");
      return;
    }
    if (!machineId) {
      setError("Identificador da máquina ainda não foi gerado. Tente novamente.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await supabaseApi.activateLicense(cleanKey, machineId, machineLabel.trim() || "Caixa");
      if (res.status !== "ok") {
        setError(
          (blockMessages[res.status]?.message) ||
          res.message ||
          "Não foi possível ativar esta licença."
        );
        return;
      }
      await onActivated(cleanKey, res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center p-6 bg-gradient-to-br from-ink-50 via-mint-bg to-brand-50/30">
      <div className="card-elevated max-w-md w-full p-8 space-y-5 animate-scale-in">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 mx-auto flex items-center justify-center text-white shadow-brand">
            <Icon name="tool" size={32} />
          </div>
          <h1 className="text-xl font-bold text-ink-900 mt-4">Ativar Simplifica Oficina</h1>
          <p className="text-sm text-ink-500 mt-1">
            Digite a chave de licença fornecida na compra para ativar este computador.
          </p>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">
            Chave de licença
          </label>
          <input
            className="input font-mono uppercase text-center tracking-widest"
            placeholder="XXXX-XXXX-XXXX-XXXX"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
          />
        </div>

        <div>
          <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">
            Nome desta máquina (opcional)
          </label>
          <input
            className="input"
            placeholder="Ex.: Caixa 1 — Balcão"
            value={machineLabel}
            onChange={(e) => setMachineLabel(e.target.value)}
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200/60 rounded-xl text-sm text-red-700 font-medium animate-slide-up">
            ✕ {error}
          </div>
        )}

        <button onClick={submit} disabled={busy} className="btn-primary w-full py-3">
          {busy ? "Ativando..." : "Ativar Licença"}
        </button>

        <p className="text-[10px] text-ink-400 text-center leading-relaxed">
          Esta máquina: <span className="font-mono">{machineId ? machineId.slice(0, 8) : "..."}…</span>
          <br />O limite de computadores é definido na sua licença.
        </p>
      </div>
    </div>
  );
}
