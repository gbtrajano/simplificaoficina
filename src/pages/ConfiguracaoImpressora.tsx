import { useState, useEffect, useRef } from "react";
import {
  PrinterSettings,
  DEFAULT_PRINTER_SETTINGS,
  LS_PRINTER_KEY,
  PaperSize,
  StoreSettings,
} from "../types";
import { api } from "../lib/api";

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PAPER_OPTIONS: { value: PaperSize; label: string; desc: string }[] = [
  { value: "58mm", label: "Termica 58mm", desc: "Impressoras compactas (Bematech, Elgin...)" },
  { value: "80mm", label: "Termica 80mm", desc: "Ordens e comprovantes compactos" },
  { value: "a4", label: "A4 / Folha comum", desc: "Impressoras laser ou jato de tinta" },
];

function loadSettings(): PrinterSettings {
  try {
    const raw = localStorage.getItem(LS_PRINTER_KEY);
    return raw ? { ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_PRINTER_SETTINGS };
  } catch {
    return { ...DEFAULT_PRINTER_SETTINGS };
  }
}

function saveSettings(s: PrinterSettings) {
  localStorage.setItem(LS_PRINTER_KEY, JSON.stringify(s));
}

// Cupom de exemplo para preview/teste
function CupomPreview({ settings, store }: { settings: PrinterSettings; store: StoreSettings }) {
  const widthClass =
    settings.paper_size === "58mm" ? "w-[200px]" :
    settings.paper_size === "80mm" ? "w-[280px]" : "w-full max-w-sm";

  const now = new Date();
  const dateStr = now.toLocaleString("pt-BR");

  return (
    <div className={`${widthClass} cupom border border-dashed border-ink-300 text-[10px] leading-relaxed mx-auto`}>
      {/* Header */}
      <div className="cupom-header">
        {settings.show_logo && store.logo && (
          <img src={store.logo} alt="Logo" className="store-logo" />
        )}
        <div className="store-name">{store.name || "NOME DA LOJA"}</div>
        {settings.show_cnpj && (
          <div className="store-info">
            {store.cnpj ? `CNPJ: ${store.cnpj}` : ""}
            {settings.show_address && store.address ? (
              <><br />{store.address}<br />{store.city}{store.state ? ` - ${store.state}` : ""}</>
            ) : null}
            {store.phone ? <><br />Tel: {store.phone}</> : ""}
          </div>
        )}
        <div className="store-info mt-1">{dateStr}</div>
        <div className="store-info font-bold">ORDEM DE SERVICO #0001</div>
      </div>

      {/* Itens */}
      <table className="cupom-items w-full">
        <thead>
          <tr>
            <th className="text-left">Servico / peca</th>
            <th className="text-right w-8">Qtd</th>
            <th className="text-right w-16">VlUnit</th>
            <th className="text-right w-16">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Troca de oleo</td>
            <td className="text-right">1</td>
            <td className="text-right">R$ 80,00</td>
            <td className="text-right">R$ 80,00</td>
          </tr>
          <tr>
            <td>Filtro de oleo</td>
            <td className="text-right">1</td>
            <td className="text-right">R$ 35,00</td>
            <td className="text-right">R$ 35,00</td>
          </tr>
        </tbody>
      </table>

      {/* Totais */}
      <div className="cupom-totals">
        <div className="total-row"><span>Subtotal:</span><span>R$ 115,00</span></div>
        <div className="total-row grand-total"><span>TOTAL:</span><span>R$ 115,00</span></div>
        <div className="total-row"><span>Veiculo:</span><span>ABC1D23</span></div>
      </div>

      {/* Rodape */}
      <div className="cupom-footer">
        <div className="footer-msg">{settings.footer_message}</div>
        <div className="sale-id">Responsavel: Mecanico exemplo</div>
      </div>
    </div>
  );
}

export default function ConfiguracaoImpressora() {
  const [settings, setSettings] = useState<PrinterSettings>(loadSettings);
  const [store, setStore] = useState<StoreSettings>({
    name: "", cnpj: "", phone: "", email: "", address: "",
    city: "", state: "", cep: "", inscription: "", display_message: "", logo: "",
  });
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getStoreSettings().then(setStore).catch(console.error);
  }, []);

  const update = (patch: Partial<PrinterSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const handleSave = () => {
    saveSettings(settings);
    // Aplica classe de tamanho de papel no body para @media print
    document.body.classList.remove("print-58mm", "print-80mm", "print-a4");
    if (settings.enabled) {
      document.body.classList.add(`print-${settings.paper_size}`);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTestPrint = () => {
    setTesting(true);
    // Aplica classe de papel antes de imprimir
    document.body.classList.remove("print-58mm", "print-80mm", "print-a4");
    document.body.classList.add(`print-${settings.paper_size}`);
    setTimeout(() => {
      window.print();
      setTesting(false);
    }, 100);
  };

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div className="page-header">
        <h1>Impressora</h1>
        <p>Configure a impressão de ordens de serviço e comprovantes da oficina.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna esquerda — configuracoes */}
        <div className="space-y-4">

          {/* Habilitar impressora */}
          <div className="card-elevated p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-lg border border-purple-200/30">
                  🖨️
                </div>
                <div>
                  <div className="font-bold text-ink-900">Impressora da oficina</div>
                  <div className="text-xs text-ink-500">Ativa ou desativa a impressão de documentos</div>
                </div>
              </div>
              <button
                onClick={() => update({ enabled: !settings.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.enabled ? "bg-brand-500" : "bg-ink-200"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  settings.enabled ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>

            {settings.enabled && (
              <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded-xl text-xs text-emerald-700 font-medium">
                ✓ Impressora habilitada para testes e documentos da oficina
              </div>
            )}
          </div>

          {/* Tipo de papel */}
          <div className="card-elevated p-5 space-y-3">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg border border-blue-200/30">
                📄
              </div>
              <div>
                <div className="font-bold text-ink-900">Tamanho do Papel</div>
                <div className="text-xs text-ink-500">Deve corresponder ao papel da sua impressora</div>
              </div>
            </div>
            <div className="space-y-2">
              {PAPER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update({ paper_size: opt.value })}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    settings.paper_size === opt.value
                      ? "bg-brand-50 border-brand-300 text-brand-700"
                      : "border-ink-200/60 hover:bg-ink-50"
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    settings.paper_size === opt.value ? "border-brand-500 bg-brand-500" : "border-ink-300"
                  }`}>
                    {settings.paper_size === opt.value && (
                      <span className="w-2 h-2 rounded-full bg-white block" />
                    )}
                  </span>
                  <div>
                    <div className="font-semibold text-sm">{opt.label}</div>
                    <div className="text-xs text-ink-500">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Nome da impressora */}
          <div className="card-elevated p-5 space-y-3">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-lg border border-amber-200/30">
                🔧
              </div>
              <div>
                <div className="font-bold text-ink-900">Identificação da impressora</div>
                <div className="text-xs text-ink-500">Nome de referência para a configuração</div>
              </div>
            </div>
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider block">
              Nome de referência (opcional)
            </label>
            <input
              className="input font-mono text-sm"
              placeholder="Ex: EPSON TM-T20, Bematech MP-4200 TH..."
              value={settings.printer_name}
              onChange={(e) => update({ printer_name: e.target.value })}
            />
            <div className="text-xs text-ink-400 bg-ink-50/60 rounded-lg p-2.5 border border-ink-200/30">
              A impressão abre o diálogo do Windows, onde você escolhe a impressora. Defina também a impressora padrão nas configurações do Windows.
            </div>
          </div>

          {/* Opcoes de impressao */}
          <div className="card-elevated p-5 space-y-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-lg border border-green-200/30">
                ⚙️
              </div>
              <div>
                <div className="font-bold text-ink-900">Opções do documento</div>
                <div className="text-xs text-ink-500">O que aparece na ordem ou no comprovante</div>
              </div>
            </div>

            {/* Logo */}
            <div className="flex items-center justify-between p-3 bg-ink-50/60 rounded-xl border border-ink-200/30">
              <div>
                <div className="text-sm font-semibold text-ink-800">Exibir logo da loja</div>
                <div className="text-xs text-ink-500">Configurada em Configuracoes &gt; Loja</div>
              </div>
              <button
                onClick={() => update({ show_logo: !settings.show_logo })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.show_logo ? "bg-brand-500" : "bg-ink-200"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  settings.show_logo ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>

            {/* CNPJ */}
            <div className="flex items-center justify-between p-3 bg-ink-50/60 rounded-xl border border-ink-200/30">
              <div>
                <div className="text-sm font-semibold text-ink-800">Exibir CNPJ</div>
                <div className="text-xs text-ink-500">CNPJ e inscricao estadual no cabecalho</div>
              </div>
              <button
                onClick={() => update({ show_cnpj: !settings.show_cnpj })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.show_cnpj ? "bg-brand-500" : "bg-ink-200"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  settings.show_cnpj ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>

            {/* Endereco */}
            <div className="flex items-center justify-between p-3 bg-ink-50/60 rounded-xl border border-ink-200/30">
              <div>
                <div className="text-sm font-semibold text-ink-800">Exibir endereco</div>
                <div className="text-xs text-ink-500">Rua, cidade, telefone no cabecalho</div>
              </div>
              <button
                onClick={() => update({ show_address: !settings.show_address })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.show_address ? "bg-brand-500" : "bg-ink-200"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  settings.show_address ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>

            {/* Numero de copias */}
            <div className="flex items-center justify-between p-3 bg-ink-50/60 rounded-xl border border-ink-200/30">
              <div>
                <div className="text-sm font-semibold text-ink-800">Numero de copias</div>
                <div className="text-xs text-ink-500">Quantidade padrão de vias</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => update({ copies: Math.max(1, settings.copies - 1) })}
                  className="w-7 h-7 rounded-lg bg-ink-100 hover:bg-ink-200 font-bold text-sm flex items-center justify-center"
                >−</button>
                <span className="w-6 text-center font-bold text-ink-900">{settings.copies}</span>
                <button
                  onClick={() => update({ copies: Math.min(5, settings.copies + 1) })}
                  className="w-7 h-7 rounded-lg bg-brand-100 hover:bg-brand-200 font-bold text-sm text-brand-700 flex items-center justify-center"
                >+</button>
              </div>
            </div>

            {/* Mensagem de rodape */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider block">
                Mensagem de rodape
              </label>
              <input
                className="input text-sm"
                placeholder="Ex: Obrigado pela preferencia! Volte sempre!"
                value={settings.footer_message}
                onChange={(e) => update({ footer_message: e.target.value })}
              />
            </div>
          </div>

          {/* Botoes */}
          <div className="flex gap-3">
            <button onClick={handleSave} className="btn-primary flex items-center gap-2 flex-1">
              💾 Salvar Configuracoes
            </button>
            <button
              onClick={handleTestPrint}
              disabled={testing}
              className="btn-outline flex items-center gap-2"
            >
              {testing ? (
                <span className="w-4 h-4 border-2 border-ink-400/30 border-t-ink-600 rounded-full animate-spin" />
              ) : "🖨️"}
              Imprimir Teste
            </button>
          </div>

          {saved && (
            <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded-xl flex items-center gap-2 animate-slide-up">
              <span className="text-emerald-500">✓</span>
              <p className="text-sm text-emerald-700 font-medium">Configuracoes salvas!</p>
            </div>
          )}
        </div>

        {/* Coluna direita — preview */}
        <div className="space-y-4">
          <div className="card-elevated p-5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-ink-50 flex items-center justify-center text-lg border border-ink-200/30">
                👁️
              </div>
              <div>
                <div className="font-bold text-ink-900">Prévia do documento</div>
                <div className="text-xs text-ink-500">Visualização aproximada da impressão</div>
              </div>
            </div>

            <div
              ref={previewRef}
              className="overflow-auto bg-gray-50 border border-ink-200/40 rounded-xl p-4 min-h-[300px] flex items-start justify-center"
            >
              <CupomPreview settings={settings} store={store} />
            </div>

            {/* Elemento oculto na tela mas visivel ao imprimir */}
            <div id="print-cupom" style={{ display: "none" }}>
              <CupomPreview settings={settings} store={store} />
            </div>

            <div className="p-3 bg-blue-50/60 border border-blue-200/50 rounded-xl text-xs text-blue-800 leading-relaxed">
              <strong>💡 Dica:</strong> O botão de teste abre o diálogo de impressão do Windows.
              Para imprimir rapidamente no dia a dia, configure a impressora desejada como padrão no Windows.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
