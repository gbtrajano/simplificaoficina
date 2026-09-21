import { useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { api } from "../lib/api";
import type { DisplayState, StoreSettings } from "../types";

// Tela exibida para os clientes no monitor secundário.
// Rota standalone: /#/display (sem sidebar).

export default function Display() {
  const [state, setState] = useState<DisplayState | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [flash, setFlash] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    api.getDisplayState().then(setState).catch(console.error);
    api.getStoreSettings().then(setSettings).catch(console.error);

    const win = getCurrentWebviewWindow();
    let unlisten: (() => void) | undefined;
    win
      .listen<DisplayState>("display-state", (e) => {
        setState(e.payload);
        setFlash(true);
        setTimeout(() => setFlash(false), 1200);
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(console.error);

    const clock = setInterval(() => setNow(new Date()), 1000);

    return () => {
      unlisten?.();
      clearInterval(clock);
    };
  }, []);

  const open = state?.cashier_open ?? false;
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  // Pulso suave para destacar nova chamada
  const callClass = flash ? "scale-110" : "scale-100";

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex flex-col transition-colors duration-500 ${
        open
          ? "bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-700"
          : "bg-gradient-to-br from-slate-800 via-slate-900 to-ink-900"
      }`}
    >
      {/* Topo */}
      <header className="flex items-center justify-between px-10 py-6 text-white/90">
        <div className="flex items-center gap-3">
          {settings?.logo ? (
            <div className="w-14 h-14 rounded-2xl bg-white/90 backdrop-blur flex items-center justify-center overflow-hidden">
              <img src={settings.logo} alt="Logo" className="w-full h-full object-contain p-1" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-2xl">
              🛍️
            </div>
          )}
          <div>
            <div className="text-2xl font-extrabold tracking-tight">
              {settings?.name || "SimplificaPDV"}
            </div>
            <div className="text-white/60 text-sm capitalize">{dateStr}</div>
          </div>
        </div>
        <div className="text-5xl font-bold tabular-nums tracking-wider">{timeStr}</div>
      </header>

      {/* Conteúdo central */}
      <main className="flex-1 flex flex-col items-center justify-center px-10 text-white">
        {!open ? (
          <div className="text-center animate-fade-in">
            <div className="text-[10rem] leading-none mb-6">🔒</div>
            <h1 className="text-8xl font-black uppercase tracking-tight drop-shadow-lg">
              Caixa Fechado
            </h1>
            <p className="text-3xl text-white/70 font-medium mt-6">Aguardando abertura do caixa</p>
          </div>
        ) : (
          <div className="w-full max-w-5xl flex flex-col items-center gap-10 animate-fade-in">
            {/* Status */}
            <div className="flex items-center gap-4 bg-white/15 backdrop-blur rounded-full px-8 py-3">
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-300" />
              </span>
              <span className="text-3xl font-bold tracking-wide">CAIXA ABERTO</span>
            </div>

            {/* Senha chamada */}
            <div className="text-center">
              <div className="text-2xl text-white/70 font-semibold uppercase tracking-widest mb-2">
                {state && state.called_number > 0 ? "Chamando Senha" : "Nenhuma senha chamada"}
              </div>
              <div
                className={`text-[14rem] leading-none font-black tabular-nums drop-shadow-2xl transition-transform duration-300 ${callClass}`}
              >
                {String(state?.called_number ?? 0).padStart(2, "0")}
              </div>
            </div>

            {/* Fila */}
            <div className="flex items-center gap-8">
              <div className="bg-white/15 backdrop-blur rounded-2xl px-8 py-4 text-center">
                <div className="text-xl text-white/70 font-semibold uppercase tracking-widest">Aguardando</div>
                <div className="text-6xl font-black tabular-nums">{state?.waiting ?? 0}</div>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-2xl px-8 py-4 text-center">
                <div className="text-xl text-white/70 font-semibold uppercase tracking-widest">Próxima senha</div>
                <div className="text-6xl font-black tabular-nums">
                  {String((state?.last_ticket ?? 0) + 1).padStart(2, "0")}
                </div>
              </div>
            </div>

            {settings?.display_message && (
              <p className="text-2xl text-white/80 font-medium text-center max-w-3xl">
                {settings.display_message}
              </p>
            )}
          </div>
        )}
      </main>

      {/* Rodapé */}
      <footer className="px-10 py-5 text-white/50 text-sm text-center">
        {settings ? (
          [settings.name, settings.cnpj && `CNPJ ${settings.cnpj}`, settings.phone].filter(Boolean).join(" • ")
        ) : (
          "SimplificaPDV"
        )}
      </footer>
    </div>
  );
}
