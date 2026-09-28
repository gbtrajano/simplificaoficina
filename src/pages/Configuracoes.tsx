import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { checkForUpdate, UpdateStatus } from "../lib/updater";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { StoreSettings, PixSettings, CardMachineSettings, DEFAULT_PIX_SETTINGS, DEFAULT_CARD_SETTINGS, LS_PIX_KEY, LS_CARD_KEY, CardAcquirer } from "../types";

const localStorageKeys = [
  { key: "simplificapdv_fiscal_config", label: "Configuração Fiscal" },
];

export default function Configuracoes() {
  const { section: routeSection } = useParams();
  const section = ["loja", "pagamentos", "atualizacoes", "dados"].includes(routeSection || "") ? routeSection : "loja";
  const sectionHeader = {
    loja: ["Loja", "Informações e identidade da sua oficina"],
    pagamentos: ["Pagamentos", "Configure as integrações e formas de recebimento"],
    atualizacoes: ["Atualizações", "Consulte a versão instalada e procure novas versões"],
    dados: ["Dados do Sistema", "Localização, backup e dados armazenados neste computador"],
  }[section as "loja" | "pagamentos" | "atualizacoes" | "dados"];
  const [version, setVersion] = useState("");
  const [status, setStatus] = useState<UpdateStatus>({ state: "idle" });
  const [dbPath, setDbPath] = useState("");
  const [localStorageData, setLocalStorageData] = useState<{ key: string; label: string; size: string; items: number }[]>([]);
  const [store, setStore] = useState<StoreSettings>({
    name: "",
    cnpj: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    cep: "",
    inscription: "",
    display_message: "",
    logo: "",
  });
  const [storeSaved, setStoreSaved] = useState(false);
  const [pix, setPix] = useState<PixSettings>(() => { try { const raw = localStorage.getItem(LS_PIX_KEY); return raw ? { ...DEFAULT_PIX_SETTINGS, ...JSON.parse(raw) } : DEFAULT_PIX_SETTINGS; } catch { return DEFAULT_PIX_SETTINGS; } });
  const [card, setCard] = useState<CardMachineSettings>(() => { try { const raw = localStorage.getItem(LS_CARD_KEY); return raw ? { ...DEFAULT_CARD_SETTINGS, ...JSON.parse(raw) } : DEFAULT_CARD_SETTINGS; } catch { return DEFAULT_CARD_SETTINGS; } });
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [showPixToken, setShowPixToken] = useState(false);
  const savePaymentSettings = () => { localStorage.setItem(LS_PIX_KEY, JSON.stringify(pix)); localStorage.setItem(LS_CARD_KEY, JSON.stringify(card)); setPaymentSaved(true); setTimeout(() => setPaymentSaved(false), 3000); };
  const [logoFeedback, setLogoFeedback] = useState("");
  const [logoError, setLogoError] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [dbLocationError, setDbLocationError] = useState("");

  useEffect(() => {
    getVersion().then(setVersion);
    api.getStoreSettings().then(setStore).catch(console.error);
    api.getDatabasePath().then(setDbPath).catch((error) => {
      console.error(error);
      setDbLocationError("Não foi possível identificar a localização do banco de dados.");
    });
    // Scan localStorage
    const items = localStorageKeys.map(({ key, label }) => {
      const raw = localStorage.getItem(key);
      const size = raw ? new Blob([raw]).size : 0;
      let itemCount = 0;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          itemCount = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
        } catch {}
      }
      return { key, label, size: formatBytes(size), items: itemCount };
    });
    setLocalStorageData(items);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const saveStore = async () => {
    try {
      await api.saveStoreSettings(store);
      setStoreSaved(true);
      setTimeout(() => setStoreSaved(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const flashLogo = (msg: string) => {
    setLogoFeedback(msg);
    setTimeout(() => setLogoFeedback(""), 3000);
  };

  const pickLogo = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          { name: "Imagens", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "svg"] },
        ],
      });
      if (typeof selected !== "string") return;
      const updated = await api.uploadStoreLogo(selected);
      setStore((prev) => ({ ...prev, logo: updated.logo }));
      setLogoError("");
      flashLogo("Logo atualizada!");
    } catch (e) {
      console.error(e);
      setLogoError(e instanceof Error ? e.message : String(e));
      setTimeout(() => setLogoError(""), 4000);
    }
  };

  const removeLogo = async () => {
    try {
      const updated = await api.removeStoreLogo();
      setStore((prev) => ({ ...prev, logo: updated.logo }));
      flashLogo("Logo removida.");
    } catch (e) {
      console.error(e);
      setLogoError(e instanceof Error ? e.message : String(e));
      setTimeout(() => setLogoError(""), 4000);
    }
  };

  const exportLocalStorage = () => {
    const data: Record<string, any> = {};
    localStorageKeys.forEach(({ key }) => {
      const raw = localStorage.getItem(key);
      if (raw) data[key] = JSON.parse(raw);
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simplificaoficina_configuracao_fiscal_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearLocalStorage = () => {
    localStorageKeys.forEach(({ key }) => localStorage.removeItem(key));
    setShowClearConfirm(false);
    setClearConfirmText("");
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
    setLocalStorageData(localStorageKeys.map(({ key, label }) => ({ key, label, size: "0 B", items: 0 })));
  };

  const locateDatabase = async () => {
    if (!dbPath) return;
    setDbLocationError("");
    try {
      await revealItemInDir(dbPath);
    } catch (error) {
      console.error(error);
      setDbLocationError("Não foi possível abrir a pasta do banco de dados.");
    }
  };

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div className="page-header">
        <h1>{sectionHeader[0]}</h1>
        <p>{sectionHeader[1]}</p>
      </div>

      {/* Store info card */}
      {section === "loja" && (
      <div className="card-elevated p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-lg border border-brand-200/30">
            🏪
          </div>
          <div>
            <h2 className="font-bold text-ink-900">Informações da Loja</h2>
            <p className="text-xs text-ink-500">Dados cadastrais exibidos na tela de clientes e nos documentos</p>
          </div>
        </div>

        {/* Logo da oficina */}
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl border border-ink-200/70 bg-white flex items-center justify-center overflow-hidden shrink-0">
            {store.logo ? (
              <img src={store.logo} alt="Logo da oficina" className="w-full h-full object-contain p-1" />
            ) : (
              <span className="text-3xl text-ink-300">🖼️</span>
            )}
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold text-ink-800">Logo da oficina</div>
            <div className="text-xs text-ink-500">Exibida na tela de clientes. PNG, JPG, SVG... (máx. 5 MB)</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={pickLogo} className="btn-outline text-xs flex items-center gap-1.5">
                📁 Escolher imagem...
              </button>
              {store.logo && (
                <button
                  onClick={removeLogo}
                  className="btn-outline text-xs text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center gap-1.5"
                >
                  🗑️ Remover
                </button>
              )}
            </div>
            {logoFeedback && (
              <div className="text-xs text-emerald-700 font-medium animate-slide-up">✓ {logoFeedback}</div>
            )}
            {logoError && (
              <div className="text-xs text-red-700 font-medium animate-slide-up">✕ {logoError}</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Nome da Loja</label>
            <input
              className="input"
              placeholder="Ex: Mercadinho do João"
              value={store.name}
              onChange={(e) => setStore({ ...store, name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">CNPJ</label>
            <input
              className="input"
              placeholder="00.000.000/0000-00"
              value={store.cnpj}
              onChange={(e) => setStore({ ...store, cnpj: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Inscrição Estadual</label>
            <input
              className="input"
              placeholder="Inscrição estadual"
              value={store.inscription}
              onChange={(e) => setStore({ ...store, inscription: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Telefone</label>
            <input
              className="input"
              placeholder="(00) 0000-0000"
              value={store.phone}
              onChange={(e) => setStore({ ...store, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">E-mail</label>
            <input
              className="input"
              type="email"
              placeholder="contato@oficina.com.br"
              value={store.email}
              onChange={(e) => setStore({ ...store, email: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Endereço</label>
            <input
              className="input"
              placeholder="Rua, número, bairro"
              value={store.address}
              onChange={(e) => setStore({ ...store, address: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Cidade</label>
            <input
              className="input"
              placeholder="Cidade"
              value={store.city}
              onChange={(e) => setStore({ ...store, city: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">UF</label>
              <input
                className="input"
                placeholder="UF"
                maxLength={2}
                value={store.state}
                onChange={(e) => setStore({ ...store, state: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">CEP</label>
              <input
                className="input"
                placeholder="00000-000"
                value={store.cep}
                onChange={(e) => setStore({ ...store, cep: e.target.value })}
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">
              Mensagem exibida na tela de clientes
            </label>
            <input
              className="input"
              placeholder="Ex: Seja bem-vindo! Senha apenas para atendimento prioritário."
              value={store.display_message}
              onChange={(e) => setStore({ ...store, display_message: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={saveStore} className="btn-primary flex items-center gap-2">
            💾 Salvar Informações
          </button>
          {storeSaved && (
            <div className="p-2 bg-emerald-50 border border-emerald-200/60 rounded-xl text-sm text-emerald-700 font-medium animate-slide-up">
              ✓ Salvo com sucesso!
            </div>
          )}
        </div>
      </div>
      )}

      {/* Payment Settings Card */}
      {section === "pagamentos" && (
      <div className="card-elevated p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-lg border border-green-200/30">
            💳
          </div>
          <div>
            <h2 className="font-bold text-ink-900">Integrações de Pagamento</h2>
            <p className="text-xs text-ink-500">Configurações de PIX dinâmico e Maquininha de Cartão</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border border-ink-200/50 rounded-xl p-4 bg-ink-50/30">
            <h3 className="font-bold text-sm mb-3">PIX (Mercado Pago)</h3>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Habilitar PIX Dinâmico</span>
              <button
                onClick={() => setPix({ ...pix, enabled: !pix.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${pix.enabled ? "bg-brand-500" : "bg-ink-200"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${pix.enabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            {pix.enabled && (
              <div className="space-y-4">
                <div className="rounded-xl border border-brand-200/70 bg-brand-50/60 p-3.5 text-sm text-ink-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink-900">Configure em 2 passos</p>
                      <p className="mt-0.5 text-xs text-ink-600">O PIX recebido irá direto para a conta Mercado Pago da oficina.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void openUrl("https://www.mercadopago.com.br/developers/panel/app")}
                      className="btn-outline !px-3 !py-1.5 text-xs"
                    >
                      Abrir credenciais ↗
                    </button>
                  </div>
                  <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-ink-600">
                    <li>Entre com a conta Mercado Pago que deve receber os pagamentos.</li>
                    <li>Abra ou crie uma aplicação e vá em <strong>Produção → Credenciais de produção</strong>.</li>
                    <li>Copie somente o <strong>Access Token</strong> — normalmente começa com <code>APP_USR-</code>.</li>
                  </ol>
                  <p className="mt-3 text-[11px] leading-relaxed text-amber-800">Não use o token de teste. Ele não recebe pagamentos reais e este token não deve ser compartilhado com ninguém.</p>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-ink-400 uppercase block mb-1">Access Token de produção</label>
                  <div className="flex gap-2">
                    <input
                      className="input min-w-0 flex-1 text-sm"
                      type={showPixToken ? "text" : "password"}
                      autoComplete="off"
                      placeholder="Cole aqui o token que começa com APP_USR-"
                      value={pix.mp_access_token}
                      onChange={e => setPix({ ...pix, mp_access_token: e.target.value.trim() })}
                    />
                    <button type="button" onClick={() => setShowPixToken(!showPixToken)} className="btn-outline !px-3 text-xs">
                      {showPixToken ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-ink-500">O token fica salvo apenas neste computador para gerar cobranças PIX da sua oficina.</p>
                </div>
              </div>
            )}
          </div>

          <div className="border border-ink-200/50 rounded-xl p-4 bg-ink-50/30">
            <h3 className="font-bold text-sm mb-3">Maquininha de Cartão</h3>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Habilitar Maquininha</span>
              <button
                onClick={() => setCard({ ...card, enabled: !card.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${card.enabled ? "bg-brand-500" : "bg-ink-200"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${card.enabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            {card.enabled && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-ink-400 uppercase block mb-1">Adquirente</label>
                  <select className="input text-sm" value={card.acquirer} onChange={e => setCard({...card, acquirer: e.target.value as CardAcquirer})}>
                    <option value="Stone">Stone</option>
                    <option value="Cielo">Cielo</option>
                    <option value="Rede">Rede</option>
                    <option value="PagBank">PagBank</option>
                    <option value="Getnet">Getnet</option>
                    <option value="Mercado Pago">Mercado Pago</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button onClick={savePaymentSettings} className="btn-primary flex items-center gap-2">
              💾 Salvar Integrações
            </button>
            {paymentSaved && (
              <div className="p-2 bg-emerald-50 border border-emerald-200/60 rounded-xl text-sm text-emerald-700 font-medium animate-slide-up">
                ✓ Salvo com sucesso!
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* About card */}
      {section === "atualizacoes" && (
      <div className="card-elevated p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-2xl shadow-brand">
            🛍️
          </div>
          <div>
            <h2 className="font-bold text-ink-900 text-lg">Simplifica Oficina</h2>
            <p className="text-sm text-ink-500">
              Versão instalada:{" "}
              <span className="font-semibold text-ink-900 bg-ink-50 px-2 py-0.5 rounded-lg">
                {version || "..."}
              </span>
            </p>
            <p className="text-sm text-ink-500">
              Desenvolvido por{" "}
              <span className="font-semibold text-ink-900">Supply Sistemas</span>
            </p>
          </div>
        </div>
        <div className="bg-ink-50/60 rounded-xl p-4 border border-ink-200/30">
          <p className="text-sm text-ink-600 leading-relaxed">
            Gestão completa para ordens de serviço, veículos, peças, clientes e financeiro.
            Desenvolvido com Tauri + React para performance e simplicidade.
          </p>
        </div>
      </div>
      )}

      {/* Database card */}
      {section === "dados" && <>
      <div className="card-elevated p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-lg border border-purple-200/30">
            🗄️
          </div>
          <div>
            <h2 className="font-bold text-ink-900">Banco de Dados</h2>
            <p className="text-xs text-ink-500">SQLite local — dados armazenados nesta máquina</p>
          </div>
        </div>

        {/* DB Path */}
        <div className="bg-ink-50/60 rounded-xl p-4 border border-ink-200/30">
          <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Localização do Arquivo</div>
          <div className="font-mono text-xs text-ink-700 bg-ink-100/60 rounded-lg px-3 py-2 break-all">
            {dbPath || "Localizando arquivo..."}
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">✓</span>
            <div>
              <h3 className="text-sm font-bold text-emerald-900">Dados da oficina salvos neste arquivo DB</h3>
              <p className="mt-1 text-xs leading-relaxed text-emerald-800">O arquivo <code className="rounded bg-emerald-100 px-1">simplificaoficina.db</code> concentra os principais dados cadastrados no sistema:</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {["Clientes", "Veículos", "Serviços", "Ordens de serviço", "Agendamentos", "Peças e estoque", "Financeiro", "Dados da oficina"].map((item) => (
              <div key={item} className="rounded-lg border border-emerald-200/60 bg-white/70 px-2.5 py-2 text-center text-[10px] font-semibold text-emerald-900">{item}</div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-emerald-800"><strong>Importante:</strong> para preservar todos esses cadastros em um backup, feche o sistema e copie o arquivo DB indicado acima.</p>
        </div>

        {/* localStorage data */}
        <div>
          <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Configurações auxiliares deste computador</div>
          <p className="mb-2 text-[10px] text-ink-500">Estas configurações ficam separadas do arquivo DB e não incluem clientes, veículos ou ordens de serviço.</p>
          <div className="space-y-1.5">
            {localStorageData.map((item) => (
              <div key={item.key} className="flex items-center justify-between p-2.5 bg-ink-50/60 rounded-xl border border-ink-200/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs">{item.items > 0 ? "📁" : "📭"}</span>
                  <span className="font-medium text-sm text-ink-900">{item.label}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-ink-500">
                  <span>{item.items} {item.items === 1 ? "item" : "itens"}</span>
                  <span className="font-mono">{item.size}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void locateDatabase()} disabled={!dbPath} className="btn-outline text-xs flex items-center gap-1.5">
            📂 Localizar arquivo DB
          </button>
          <button onClick={exportLocalStorage} className="btn-outline text-xs flex items-center gap-1.5">
            📥 Exportar Configuração Fiscal (JSON)
          </button>
          <button onClick={() => setShowClearConfirm(true)} className="btn-outline text-xs text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center gap-1.5">
            🗑️ Limpar Configuração Fiscal
          </button>
        </div>

        {dbLocationError && (
          <div className="p-3 bg-red-50 border border-red-200/60 rounded-xl text-sm text-red-700 font-medium animate-slide-up">
            ✕ {dbLocationError}
          </div>
        )}

        {cleared && (
          <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded-xl flex items-center gap-2 animate-slide-up">
            <span className="text-emerald-500">✓</span>
            <p className="text-sm text-emerald-700 font-medium">Dados locais limpos com sucesso!</p>
          </div>
        )}

        <div className="bg-blue-50/60 border border-blue-200/50 rounded-xl p-4 text-xs text-blue-800 leading-relaxed">
          <strong>💡 Dois tipos de cópia:</strong> o arquivo <code className="bg-blue-100 px-1 rounded">simplificaoficina.db</code> é o backup completo dos dados da oficina. O arquivo JSON exporta somente a configuração fiscal auxiliar deste computador.
        </div>
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs leading-relaxed text-red-800" role="alert">
          <div className="flex items-start gap-2.5">
            <span className="text-base" aria-hidden>⚠️</span>
            <p><strong className="text-red-900">Atenção: a perda deste arquivo DB é irrecuperável se não houver uma cópia de segurança.</strong><br/>É de extrema importância manter o arquivo <code className="rounded bg-red-100 px-1">simplificaoficina.db</code> guardado em um local seguro, preferencialmente também em outro dispositivo ou serviço de nuvem.</p>
          </div>
        </div>
      </div>

      {/* Clear data confirmation modal */}
      {showClearConfirm && (
        <div className="glass-overlay animate-fade-in">
          <div className="card-elevated max-w-sm w-full p-6 space-y-4 animate-scale-in">
            <div className="text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="font-bold text-ink-900 text-lg">Limpar Configuração Fiscal?</h3>
              <p className="text-sm text-ink-500 mt-2">
                Isso irá apagar a configuração fiscal armazenada neste computador.
                <br /><strong>NÃO</strong> afeta ordens, peças, veículos ou clientes (banco de dados SQLite).
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">
                Digite <span className="text-red-600 font-extrabold">LIMPAR</span> para confirmar
              </label>
              <input
                className="input text-center font-mono text-red-600 font-bold"
                placeholder="LIMPAR"
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={clearLocalStorage}
                disabled={clearConfirmText !== "LIMPAR"}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-red-500 text-white hover:bg-red-600"
              >
                Sim, Limpar Tudo
              </button>
              <button onClick={() => { setShowClearConfirm(false); setClearConfirmText(""); }} className="flex-1 btn-outline">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      </>}

      {/* Updates card */}
      {section === "atualizacoes" && (
      <div className="card-elevated p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg border border-blue-200/30">
            🔄
          </div>
          <div>
            <h2 className="font-bold text-ink-900">Atualizações</h2>
            <p className="text-xs text-ink-500">Verifique e instale as versões mais recentes</p>
          </div>
        </div>

        <div className="bg-ink-50/60 rounded-xl p-4 border border-ink-200/30">
          <p className="text-sm text-ink-600 leading-relaxed">
            O sistema verifica automaticamente se há uma nova versão publicada
            no servidor. Você também pode checar manualmente abaixo.
          </p>
        </div>

        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => checkForUpdate(setStatus)}
          disabled={status.state === "checking" || status.state === "downloading"}
        >
          {status.state === "checking" ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Verificando...
            </>
          ) : status.state === "downloading" ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Baixando... {status.progress}%
            </>
          ) : (
            "Verificar atualizações"
          )}
        </button>

        {status.state === "up-to-date" && (
          <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded-xl flex items-center gap-2 animate-slide-up">
            <span className="text-emerald-500">✓</span>
            <p className="text-sm text-emerald-700 font-medium">
              Você já está usando a versão mais recente.
            </p>
          </div>
        )}
        {status.state === "available" && (
          <div className="p-3 bg-brand-50 border border-brand-200/60 rounded-xl flex items-center gap-2 animate-slide-up">
            <span className="text-brand-500">↓</span>
            <p className="text-sm text-brand-700 font-medium">
              Nova versão {status.version} encontrada, baixando e instalando...
            </p>
          </div>
        )}
        {status.state === "error" && (
          <div className="p-3 bg-red-50 border border-red-200/60 rounded-xl flex items-center gap-2 animate-slide-up">
            <span className="text-red-500">✕</span>
            <p className="text-sm text-red-700 font-medium">Erro: {status.message}</p>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

