import { useState, useEffect } from "react";

const FISCAL_CONFIG_KEY = "simplificapdv_fiscal_config";

interface FiscalConfig {
  // Dados da empresa
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  regime_tributario: string;
  // Endereço
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
  // API
  provedor: string;
  api_key: string;
  ambiente: string; // homologacao ou producao
  // Certificado
  certificado_nome: string;
  certificado_senha: string;
  // Configurações fiscais padrão
  cfop_padrao: string;
  cst_icms_padrao: string;
  csosn_padrao: string;
  ncm_padrao: string;
  cest_padrao: string;
  // Status
  configurado: boolean;
  ultima_nota_numero: string;
  ultima_nota_data: string;
}

const defaultConfig: FiscalConfig = {
  cnpj: "",
  razao_social: "",
  nome_fantasia: "",
  inscricao_estadual: "",
  inscricao_municipal: "",
  regime_tributario: "simples_nacional",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "SP",
  telefone: "",
  email: "",
  provedor: "nfeio",
  api_key: "",
  ambiente: "homologacao",
  certificado_nome: "",
  certificado_senha: "",
  cfop_padrao: "5102",
  cst_icms_padrao: "00",
  csosn_padrao: "102",
  ncm_padrao: "",
  cest_padrao: "",
  configurado: false,
  ultima_nota_numero: "0",
  ultima_nota_data: "",
};

const ufs = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const provedores = [
  { id: "nfeio", name: "NFe.io", url: "https://nfe.io", price: "~R$0,30/nota", desc: "API moderna e developer-friendly" },
  { id: "focus", name: "Focus NFe", url: "https://focusnfe.com.br", price: "~R$0,25/nota", desc: "API robusta com boa documentação" },
  { id: "webmaniabr", name: "WebmaniaBR", url: "https://webmaniabr.com", price: "~R$0,39/nota", desc: "API com suporte completo" },
  { id: "enotas", name: "Enotas", url: "https://www.enotas.com.br", price: "~R$0,29/nota", desc: "Simples e rápido de integrar" },
  { id: "tiny", name: "Tiny ERP", url: "https://www.tiny.com.br", price: "~R$59+/mês", desc: "ERP completo com emissão integrada" },
  { id: "bling", name: "Bling", url: "https://www.bling.com.br", price: "~R$49+/mês", desc: "ERP + emissão de notas" },
];

const regimesTributarios = [
  { id: "simples_nacional", label: "Simples Nacional", desc: "Microempresa (ME) e Empresa de Pequeno Porte (EPP) — faturamento até R$4,8 milhões/ano" },
  { id: "lucro_presumido", label: "Lucro Presumido", desc: "Empresas com faturamento até R$78 milhões/ano — tributação sobre base presumida" },
  { id: "lucro_real", label: "Lucro Real", desc: "Empresas com faturamento acima de R$78 milhões/ano — tributação sobre lucro efetivo" },
];

const cfops = [
  { code: "5102", desc: "Venda de mercadoria adquirida de terceiros (interna)" },
  { code: "5405", desc: "Venda de mercadoria sujeita a ST (interna)" },
  { code: "6102", desc: "Venda de mercadoria adquirida de terceiros (interestadual)" },
  { code: "6405", desc: "Venda de mercadoria sujeita a ST (interestadual)" },
  { code: "1102", desc: "Venda de produção (interna)" },
  { code: "2102", desc: "Venda de produção (interestadual)" },
];

const cstIcms = [
  { code: "00", desc: "Tributado integralmente" },
  { code: "10", desc: "Tributado e com ST" },
  { code: "20", desc: "Com redução de base de cálculo" },
  { code: "40", desc: "Isento" },
  { code: "41", desc: "Não tributado" },
  { code: "50", desc: "Suspensão" },
  { code: "60", desc: "Anteriormente tributado por ST" },
  { code: "90", desc: "Outros" },
];

const csosn = [
  { code: "102", desc: "Sem permissão de crédito" },
  { code: "103", desc: "Isenção do ICMS em SF para vendas internas" },
  { code: "202", desc: "Sem permissão de crédito com ST" },
  { code: "400", desc: "Não tributada" },
  { code: "500", desc: "ICMS anteriormente pago por ST" },
  { code: "900", desc: "Outros" },
];

function loadConfig(): FiscalConfig {
  try {
    const stored = localStorage.getItem(FISCAL_CONFIG_KEY);
    if (stored) return { ...defaultConfig, ...JSON.parse(stored) };
  } catch {}
  return defaultConfig;
}

export default function FiscalConfig() {
  const [config, setConfig] = useState<FiscalConfig>(loadConfig);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"empresa" | "api" | "certificado" | "impostos">("empresa");
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

  useEffect(() => {
    localStorage.setItem(FISCAL_CONFIG_KEY, JSON.stringify(config));
  }, [config]);

  const update = (field: keyof FiscalConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const save = () => {
    setConfig((prev) => ({ ...prev, configurado: true }));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const testConnection = () => {
    setTestStatus("testing");
    // Simulate API test
    setTimeout(() => {
      if (config.api_key && config.cnpj) {
        setTestStatus("success");
      } else {
        setTestStatus("error");
      }
      setTimeout(() => setTestStatus("idle"), 4000);
    }, 2000);
  };

  const selectedProvider = provedores.find((p) => p.id === config.provedor);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Configuração Fiscal</h1>
          <p>Configure os dados da empresa, certificado digital e integração com emissão de notas fiscais.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={testConnection} className="btn-outline text-xs" disabled={testStatus === "testing"}>
            {testStatus === "testing" ? (
              <><span className="w-3 h-3 border-2 border-ink-300 border-t-brand-500 rounded-full animate-spin inline-block mr-1" /> Testando...</>
            ) : testStatus === "success" ? "✅ Conectado" : testStatus === "error" ? "❌ Erro" : "🔌 Testar Conexão"}
          </button>
          <button onClick={save} className="btn-primary text-xs">💾 Salvar</button>
        </div>
      </div>

      {/* Status */}
      <div className={`card-elevated p-4 border-l-4 ${config.configurado ? "border-l-emerald-400" : "border-l-amber-400"}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${config.configurado ? "bg-emerald-50 text-emerald-600 border border-emerald-200/30" : "bg-amber-50 text-amber-600 border border-amber-200/30"}`}>
            {config.configurado ? "✓" : "⚠️"}
          </div>
          <div>
            <h3 className="font-bold text-sm text-ink-900">
              {config.configurado ? "Sistema Configurado" : "Configuração Pendente"}
            </h3>
            <p className="text-[10px] text-ink-500">
              {config.configurado
                ? "Os dados fiscais estão configurados. Você pode emitir notas fiscais."
                : "Preencha os dados abaixo para começar a emitir notas fiscais."}
            </p>
          </div>
        </div>
      </div>

      {saved && (
        <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded-xl flex items-center gap-2 animate-slide-up">
          <span className="text-emerald-500">✓</span>
          <p className="text-sm text-emerald-700 font-medium">Configurações salvas com sucesso!</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-ink-50/60 rounded-xl p-1 border border-ink-200/30">
        {[
          { key: "empresa", label: "🏢 Empresa" },
          { key: "api", label: "🔌 API" },
          { key: "certificado", label: "🔑 Certificado" },
          { key: "impostos", label: "📊 Impostos" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.key ? "bg-white shadow-soft text-ink-900" : "text-ink-500 hover:text-ink-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empresa Tab */}
      {activeTab === "empresa" && (
        <div className="space-y-5">
          {/* Dados da Empresa */}
          <div className="card-elevated p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg border border-blue-200/30">🏢</div>
              <div>
                <h2 className="font-bold text-ink-900">Dados da Empresa</h2>
                <p className="text-xs text-ink-500">Informações que aparecerão na nota fiscal</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">CNPJ *</label>
                <input className="input" placeholder="00.000.000/0001-00" value={config.cnpj} onChange={(e) => update("cnpj", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Inscrição Estadual *</label>
                <input className="input" placeholder="000.000.000.000" value={config.inscricao_estadual} onChange={(e) => update("inscricao_estadual", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Razão Social *</label>
                <input className="input" placeholder="Razão social da empresa" value={config.razao_social} onChange={(e) => update("razao_social", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Nome Fantasia</label>
                <input className="input" placeholder="Nome que aparece no DANFE" value={config.nome_fantasia} onChange={(e) => update("nome_fantasia", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Inscrição Municipal</label>
                <input className="input" placeholder="Para emissão de NFSe (serviços)" value={config.inscricao_municipal} onChange={(e) => update("inscricao_municipal", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Telefone</label>
                <input className="input" placeholder="(00) 00000-0000" value={config.telefone} onChange={(e) => update("telefone", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">E-mail</label>
                <input className="input" type="email" placeholder="email@empresa.com.br" value={config.email} onChange={(e) => update("email", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="card-elevated p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-lg border border-amber-200/30">📍</div>
              <h2 className="font-bold text-ink-900">Endereço</h2>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Logradouro *</label>
                <input className="input" placeholder="Rua, Avenida, etc." value={config.logradouro} onChange={(e) => update("logradouro", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Número *</label>
                <input className="input" placeholder="Nº" value={config.numero} onChange={(e) => update("numero", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Complemento</label>
                <input className="input" placeholder="Sala, Andar, etc." value={config.complemento} onChange={(e) => update("complemento", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Bairro *</label>
                <input className="input" placeholder="Bairro" value={config.bairro} onChange={(e) => update("bairro", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">CEP *</label>
                <input className="input" placeholder="00000-000" value={config.cep} onChange={(e) => update("cep", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Cidade *</label>
                <input className="input" placeholder="Cidade" value={config.cidade} onChange={(e) => update("cidade", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">UF *</label>
                <select className="input" value={config.uf} onChange={(e) => update("uf", e.target.value)}>
                  {ufs.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Regime Tributário */}
          <div className="card-elevated p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-lg border border-purple-200/30">📊</div>
              <h2 className="font-bold text-ink-900">Regime Tributário</h2>
            </div>

            <div className="space-y-2">
              {regimesTributarios.map((r) => (
                <button
                  key={r.id}
                  onClick={() => update("regime_tributario", r.id)}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    config.regime_tributario === r.id
                      ? "bg-brand-50 border-brand-300 ring-1 ring-brand-200"
                      : "bg-ink-50/60 border-ink-200/30 hover:border-ink-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm text-ink-900">{r.label}</div>
                      <div className="text-[10px] text-ink-500 mt-0.5">{r.desc}</div>
                    </div>
                    {config.regime_tributario === r.id && <span className="text-brand-500 text-lg">✓</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* API Tab */}
      {activeTab === "api" && (
        <div className="space-y-5">
          <div className="card-elevated p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg border border-blue-200/30">🔌</div>
              <div>
                <h2 className="font-bold text-ink-900">Provedor de Emissão</h2>
                <p className="text-xs text-ink-500">Escolha o serviço que vai emitir suas notas fiscais</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {provedores.map((p) => (
                <button
                  key={p.id}
                  onClick={() => update("provedor", p.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    config.provedor === p.id
                      ? "bg-brand-50 border-brand-300 ring-1 ring-brand-200"
                      : "bg-ink-50/60 border-ink-200/30 hover:border-ink-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-ink-900">{p.name}</span>
                    {config.provedor === p.id && <span className="text-brand-500">✓</span>}
                  </div>
                  <div className="text-[10px] text-ink-500">{p.desc}</div>
                  <div className="text-[10px] font-semibold text-brand-600 mt-1">{p.price}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Configuração da API */}
          <div className="card-elevated p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-lg border border-green-200/30">🔑</div>
              <h2 className="font-bold text-ink-900">Credenciais da API</h2>
            </div>

            <div className="bg-blue-50/60 border border-blue-200/50 rounded-xl p-4 text-xs text-blue-800 leading-relaxed">
              <strong>Como obter:</strong> Acesse o site do provedor escolhido ({selectedProvider?.url}), crie uma conta,
              adicione saldo e gere uma API key. Para testes, use o ambiente de homologação.
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">API Key *</label>
                <div className="relative">
                  <input
                    className="input pr-20"
                    type={showApiKey ? "text" : "password"}
                    placeholder="Sua API key do provedor"
                    value={config.api_key}
                    onChange={(e) => update("api_key", e.target.value)}
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-400 hover:text-ink-600 px-2 py-1"
                  >
                    {showApiKey ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Ambiente *</label>
                <select className="input" value={config.ambiente} onChange={(e) => update("ambiente", e.target.value)}>
                  <option value="homologacao">🧪 Homologação (testes)</option>
                  <option value="producao">🟢 Produção (notas reais)</option>
                </select>
              </div>
            </div>

            <div className="bg-amber-50/60 border border-amber-200/50 rounded-xl p-4 text-xs text-amber-800 leading-relaxed">
              <strong>⚠️ Importante:</strong> Comece sempre em homologação para testar. Mude para produção apenas quando tudo
              estiver funcionando. Notas em produção são válidas e devem ser comunicadas à SEFAZ.
            </div>
          </div>
        </div>
      )}

      {/* Certificado Tab */}
      {activeTab === "certificado" && (
        <div className="space-y-5">
          <div className="card-elevated p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-lg border border-purple-200/30">🔑</div>
              <div>
                <h2 className="font-bold text-ink-900">Certificado Digital</h2>
                <p className="text-xs text-ink-500">O certificado digital é obrigatório para assinar as notas fiscalmente</p>
              </div>
            </div>

            <div className="bg-ink-50/60 rounded-xl p-4 border border-ink-200/30 space-y-3">
              <p className="text-sm text-ink-600 leading-relaxed">
                O <strong>certificado digital e-CNPJ</strong> é o documento que valida sua empresa perante a SEFAZ.
                É ele que assina digitalmente cada nota fiscal emitida.
              </p>
              <div className="text-xs text-ink-500 space-y-1">
                <p><strong>Onde comprar:</strong></p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>Certisign — ~R$180/ano (A1)</li>
                  <li>Qualisect — ~R$150/ano (A1)</li>
                  <li>Sefaz (estado) — variável</li>
                </ul>
                <p className="mt-2"><strong>Tipos:</strong></p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li><strong>A1</strong> — Arquivo digital (validade 1 ano), funciona em qualquer máquina</li>
                  <li><strong>A3</strong> — Cartão/Token (validade 1-3 anos), mais seguro mas limitado a 1 máquina</li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Nome do Certificado (arquivo .pfx)</label>
                <input className="input" placeholder="Ex: empresa_certificado.pfx" value={config.certificado_nome} onChange={(e) => update("certificado_nome", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Senha do Certificado</label>
                <input className="input" type="password" placeholder="Senha do certificado" value={config.certificado_senha} onChange={(e) => update("certificado_senha", e.target.value)} />
              </div>
            </div>

            <div className="bg-amber-50/60 border border-amber-200/50 rounded-xl p-4 text-xs text-amber-800 leading-relaxed">
              <strong>⚠️ Segurança:</strong> O certificado digital é um documento de extrema importância.
              Nunca compartilhe a senha. Ela é armazenada apenas localmente neste computador.
            </div>
          </div>

          {/* Upload area */}
          <div className="card-elevated p-6">
            <div className="border-2 border-dashed border-ink-200 rounded-xl p-8 text-center hover:border-brand-300 transition-colors cursor-pointer">
              <div className="text-4xl mb-3">📁</div>
              <div className="font-semibold text-sm text-ink-700">Arraste o certificado .pfx aqui</div>
              <div className="text-xs text-ink-400 mt-1">ou clique para selecionar</div>
              <div className="text-[10px] text-ink-400 mt-3">Formatos aceitos: .pfx, .p12</div>
            </div>
          </div>
        </div>
      )}

      {/* Impostos Tab */}
      {activeTab === "impostos" && (
        <div className="space-y-5">
          <div className="card-elevated p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-lg border border-red-200/30">📊</div>
              <div>
                <h2 className="font-bold text-ink-900">Configurações Fiscais Padrão</h2>
                <p className="text-xs text-ink-500">Valores padrão que serão usados ao emitir notas (podem ser alterados por produto)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">CFOP Padrão *</label>
                <select className="input" value={config.cfop_padrao} onChange={(e) => update("cfop_padrao", e.target.value)}>
                  {cfops.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.desc}</option>)}
                </select>
                <p className="text-[10px] text-ink-400 mt-1">Código Fiscal de Operações e Prestações</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">NCM Padrão</label>
                <input className="input" placeholder="Ex: 0000.00.00" value={config.ncm_padrao} onChange={(e) => update("ncm_padrao", e.target.value)} />
                <p className="text-[10px] text-ink-400 mt-1">Nomenclatura Comum do Mercosul</p>
              </div>
            </div>
          </div>

          {/* ICMS */}
          <div className="card-elevated p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg border border-blue-200/30">💰</div>
              <h2 className="font-bold text-ink-900">ICMS (Estadual)</h2>
            </div>

            {config.regime_tributario === "simples_nacional" ? (
              <div>
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">CSOSN Padrão *</label>
                <select className="input" value={config.csosn_padrao} onChange={(e) => update("csosn_padrao", e.target.value)}>
                  {csosn.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.desc}</option>)}
                </select>
                <p className="text-[10px] text-ink-400 mt-1">Código de Situação da Operação — Simples Nacional</p>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">CST ICMS Padrão *</label>
                <select className="input" value={config.cst_icms_padrao} onChange={(e) => update("cst_icms_padrao", e.target.value)}>
                  {cstIcms.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.desc}</option>)}
                </select>
                <p className="text-[10px] text-ink-400 mt-1">Código de Situação Tributária — Lucro Presumido/Real</p>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">CEST</label>
              <input className="input" placeholder="Ex: 00.000.00" value={config.cest_padrao} onChange={(e) => update("cest_padrao", e.target.value)} />
              <p className="text-[10px] text-ink-400 mt-1">Código Especificador da Substituição Tributária (quando aplicável)</p>
            </div>
          </div>

          {/* Info about taxes */}
          <div className="card-elevated p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-lg border border-amber-200/30">ℹ️</div>
              <h2 className="font-bold text-ink-900">Entendendo os Impostos</h2>
            </div>

            <div className="space-y-3 text-xs text-ink-600">
              <div className="bg-ink-50/60 rounded-xl p-4 border border-ink-200/30">
                <div className="font-semibold text-ink-900 mb-1">ICMS — Imposto sobre Circulação de Mercadorias</div>
                <p className="leading-relaxed">Estadual. Alíquota varia de 7% a 18% dependendo do estado e tipo de produto. No Simples Nacional, é recolhido junto no DAS.</p>
              </div>
              <div className="bg-ink-50/60 rounded-xl p-4 border border-ink-200/30">
                <div className="font-semibold text-ink-900 mb-1">PIS — Programa de Integração Social</div>
                <p className="leading-relaxed">Federal. Alíquota padrão de 0,65% (cumulativo) ou 1,65% (não cumulativo). Calculado sobre a receita.</p>
              </div>
              <div className="bg-ink-50/60 rounded-xl p-4 border border-ink-200/30">
                <div className="font-semibold text-ink-900 mb-1">COFINS — Contribuição para Financiamento da Seguridade Social</div>
                <p className="leading-relaxed">Federal. Alíquota padrão de 3% (cumulativo) ou 7,6% (não cumulativo). Calculado sobre a receita.</p>
              </div>
              <div className="bg-ink-50/60 rounded-xl p-4 border border-ink-200/30">
                <div className="font-semibold text-ink-900 mb-1">IPI — Imposto sobre Produtos Industrializados</div>
                <p className="leading-relaxed">Federal. Varia por produto (NCM). Não se aplica a produtos não industrializados (comércio varejista).</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
