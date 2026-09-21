import { useEffect, useState } from "react";
import { WebviewWindow, getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { availableMonitors, type Monitor } from "@tauri-apps/api/window";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { api } from "../lib/api";
import type { DisplayState } from "../types";

const DISPLAY_LABEL = "display";

export default function Exibicao() {
  const [state, setState] = useState<DisplayState | null>(null);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [selectedMonitor, setSelectedMonitor] = useState(0);
  const [fullscreen, setFullscreen] = useState(true);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const load = async () => {
    try {
      const st = await api.getDisplayState();
      setState(st);
    } catch (e) { console.error(e); }
    try {
      setDisplayOpen(await api.isDisplayOpen());
    } catch (e) { console.error(e); }
    try {
      const mons = await availableMonitors();
      if (mons.length) {
        setMonitors(mons);
      }
    } catch (e) {
      console.error("Erro ao listar monitores:", e);
      setError("Não foi possível listar os monitores. Verifique as permissões do sistema.");
    }
  };

  useEffect(() => {
    load();
    const win = getCurrentWebviewWindow();
    let unlisten: (() => void) | undefined;
    win
      .listen<DisplayState>("display-state", (e) => setState(e.payload))
      .then((fn) => { unlisten = fn; })
      .catch(console.error);
    return () => { unlisten?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 2500);
  };

  const handleError = (e: unknown) => {
    console.error(e);
    setError(e instanceof Error ? e.message : String(e));
    setTimeout(() => setError(""), 4000);
  };

  const run = async (fn: Promise<DisplayState>, msg: string) => {
    setBusy(true);
    try {
      setState(await fn);
      flash(msg);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };

  const openDisplay = async () => {
    setBusy(true);
    try {
      const mon = monitors[selectedMonitor];
      if (!mon) throw new Error("Nenhum monitor selecionado.");

      const pos = mon.position.toLogical(mon.scaleFactor);
      const size = mon.size.toLogical(mon.scaleFactor);

      const existing = await WebviewWindow.getByLabel(DISPLAY_LABEL);
      if (existing) {
        // Reposiciona a janela já existente no monitor escolhido
        await existing.setPosition(new LogicalPosition(pos.x, pos.y));
        await existing.setSize(new LogicalSize(size.width, size.height));
        await existing.setFullscreen(fullscreen);
        await existing.setAlwaysOnTop(alwaysOnTop);
        await existing.show();
        await existing.setFocus();
      } else {
        const win = new WebviewWindow(DISPLAY_LABEL, {
          url: "index.html#/display",
          title: "Exibição para Clientes",
          x: pos.x,
          y: pos.y,
          width: size.width,
          height: size.height,
          fullscreen,
          alwaysOnTop,
          resizable: true,
          decorations: !fullscreen,
        });
        win.once("tauri://error", (e) => {
          console.error("Erro ao criar janela de exibição:", e);
          setError("Falha ao abrir a janela de exibição.");
        });
      }
      setDisplayOpen(true);
      flash("Exibição aberta no monitor selecionado.");
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };

  const closeDisplay = async () => {
    try {
      const win = await WebviewWindow.getByLabel(DISPLAY_LABEL);
      if (win) await win.close();
      setDisplayOpen(false);
      flash("Exibição fechada.");
    } catch (e) {
      handleError(e);
    }
  };

  const toggleCashier = () => {
    if (!state) return;
    run(
      api.setCashierOpen(!state.cashier_open),
      state.cashier_open ? "Caixa fechado para os clientes." : "Caixa aberto para os clientes!"
    );
  };

  const monitorLabel = (m: Monitor, i: number) => {
    const w = Math.round(m.size.width / m.scaleFactor);
    const h = Math.round(m.size.height / m.scaleFactor);
    return `${m.name || (i === 0 ? "Monitor principal" : `Monitor ${i + 1}`)} — ${w}×${h}`;
  };

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Exibição para Clientes</h1>
          <p>Controle o caixa visível para os clientes no segundo monitor e a fila de atendimento.</p>
        </div>
        {feedback && (
          <div className="px-4 py-2 bg-emerald-50 border border-emerald-200/60 rounded-xl text-sm text-emerald-700 font-medium animate-slide-up">
            ✓ {feedback}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200/60 rounded-xl flex items-center gap-2 animate-slide-up">
          <span className="text-red-500">✕</span>
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status do Caixa */}
        <div className="card-elevated p-6 space-y-4">
          <h2 className="font-bold text-ink-900 flex items-center gap-2">
            <span className="text-lg">💳</span> Status do Caixa
          </h2>

          <div
            className={`rounded-2xl p-5 text-center transition-colors ${
              state?.cashier_open
                ? "bg-emerald-50 border border-emerald-200/60"
                : "bg-slate-100 border border-ink-200/60"
            }`}
          >
            <div className={`text-5xl mb-2 ${state?.cashier_open ? "" : "grayscale"}`}>
              {state?.cashier_open ? "🟢" : "🔴"}
            </div>
            <div
              className={`text-2xl font-extrabold ${
                state?.cashier_open ? "text-emerald-700" : "text-slate-600"
              }`}
            >
              {state?.cashier_open ? "CAIXA ABERTO" : "CAIXA FECHADO"}
            </div>
            <div className="text-xs text-ink-500 mt-1">
              {state?.cashier_open
                ? "Os clientes veem o caixa aberto na tela"
                : "A tela mostra que o caixa está fechado"}
            </div>
          </div>

          <button
            onClick={toggleCashier}
            disabled={busy}
            className={`w-full py-3 rounded-xl font-bold text-white transition-all disabled:opacity-60 ${
              state?.cashier_open
                ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
            }`}
          >
            {state?.cashier_open ? "🔴 Fechar Caixa" : "🟢 Abrir Caixa"}
          </button>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="stat-card py-3">
              <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Chamando</div>
              <div className="text-2xl font-extrabold text-ink-900 tabular-nums">
                {String(state?.called_number ?? 0).padStart(2, "0")}
              </div>
            </div>
            <div className="stat-card py-3">
              <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Aguardando</div>
              <div className="text-2xl font-extrabold text-ink-900 tabular-nums">{state?.waiting ?? 0}</div>
            </div>
            <div className="stat-card py-3">
              <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Próxima</div>
              <div className="text-2xl font-extrabold text-ink-900 tabular-nums">
                {String((state?.last_ticket ?? 0) + 1).padStart(2, "0")}
              </div>
            </div>
          </div>
        </div>

        {/* Fila de Atendimento */}
        <div className="card-elevated p-6 space-y-4">
          <h2 className="font-bold text-ink-900 flex items-center gap-2">
            <span className="text-lg">📟</span> Fila de Atendimento
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => run(api.newTicket(), "Novo cliente registrado na fila.")}
              disabled={busy}
              className="btn-primary flex items-center justify-center gap-2"
            >
              🎫 Nova Senha
            </button>
            <button
              onClick={() => run(api.callNext(), "Próximo cliente chamado!")}
              disabled={busy || !state?.cashier_open}
              className="btn-primary flex items-center justify-center gap-2 !from-blue-500 !to-blue-600 hover:!from-blue-600 hover:!to-blue-700"
              style={{ boxShadow: "0 4px 14px rgba(59, 130, 246, 0.25)" }}
            >
              📢 Chamar Próximo
            </button>
            <button
              onClick={() => run(api.recallNumber(), "Senha rechamada.")}
              disabled={busy || !state?.called_number}
              className="btn-outline flex items-center justify-center gap-2"
            >
              🔁 Rechamar
            </button>
            <button
              onClick={() => {
                if (confirm("Zerar a fila e o contador de senhas?")) {
                  run(api.resetDisplay(), "Fila zerada.");
                }
              }}
              disabled={busy}
              className="btn-outline flex items-center justify-center gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              🔄 Zerar Fila
            </button>
          </div>

          {!state?.cashier_open && (
            <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3 text-xs text-amber-700">
              Abra o caixa para chamar clientes na fila.
            </div>
          )}
        </div>
      </div>

      {/* Janela de Exibição */}
      <div className="card-elevated p-6 space-y-4">
        <h2 className="font-bold text-ink-900 flex items-center gap-2">
          <span className="text-lg">🖥️</span> Janela de Exibição (2º Monitor)
        </h2>

        {monitors.length === 0 ? (
          <div className="text-sm text-ink-500">Carregando monitores... Se nada aparecer, verifique as permissões.</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">
                Monitor de exibição
              </label>
              <select
                className="input"
                value={selectedMonitor}
                onChange={(e) => setSelectedMonitor(Number(e.target.value))}
              >
                {monitors.map((m, i) => (
                  <option key={i} value={i}>
                    {monitorLabel(m, i)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-ink-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fullscreen}
                  onChange={(e) => setFullscreen(e.target.checked)}
                  className="accent-brand-500 w-4 h-4"
                />
                Tela cheia
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-ink-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alwaysOnTop}
                  onChange={(e) => setAlwaysOnTop(e.target.checked)}
                  className="accent-brand-500 w-4 h-4"
                />
                Manter por cima
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              {displayOpen ? (
                <button onClick={closeDisplay} disabled={busy} className="btn-outline flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300">
                  ⏹️ Fechar Exibição
                </button>
              ) : (
                <button onClick={openDisplay} disabled={busy || !state} className="btn-primary flex items-center gap-2">
                  ▶️ Abrir Exibição
                </button>
              )}
              <button onClick={openDisplay} disabled={busy || !displayOpen || monitors.length === 0} className="btn-outline flex items-center gap-2">
                📍 Mover para Monitor Selecionado
              </button>
            </div>

            <div className="bg-blue-50/60 border border-blue-200/50 rounded-xl p-4 text-xs text-blue-800 leading-relaxed">
              <strong>💡 Dica:</strong> A tela exibida para os clientes abre no monitor selecionado.
              O estado (caixa aberto/fechado e fila) é atualizado em tempo real a partir deste painel.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}