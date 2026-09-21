import { useState } from "react";

interface FiscalNote {
  id: number;
  type: "NFC-e" | "NFE" | "SAT";
  number: string;
  series: string;
  customer: string;
  cpf_cnpj: string;
  total: number;
  status: "emitida" | "cancelada" | "inutilizada";
  date: string;
}

const currency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const sampleNotes: FiscalNote[] = [
  { id: 1, type: "NFC-e", number: "000123", series: "1", customer: "Consumidor Final", cpf_cnpj: "", total: 45.90, status: "emitida", date: "2026-04-03 14:32:10" },
  { id: 2, type: "NFC-e", number: "000124", series: "1", customer: "Maria Silva", cpf_cnpj: "123.456.789-00", total: 128.50, status: "emitida", date: "2026-04-03 15:10:45" },
  { id: 3, type: "SAT", number: "SAT-000045", series: "1", customer: "João Souza", cpf_cnpj: "987.654.321-00", total: 67.00, status: "cancelada", date: "2026-04-02 10:05:00" },
  { id: 4, type: "NFE", number: "000008", series: "1", customer: "Loja ABC Ltda", cpf_cnpj: "12.345.678/0001-90", total: 3200.00, status: "emitida", date: "2026-04-01 09:20:00" },
];

export default function NotasFiscais() {
  const [notes] = useState<FiscalNote[]>(sampleNotes);
  const [filterType, setFilterType] = useState<string>("TODOS");
  const [filterStatus, setFilterStatus] = useState<string>("TODOS");
  const [activeTab, setActiveTab] = useState<"notas" | "emitir" | "inutilizar">("notas");
  const [emitForm, setEmitForm] = useState({ type: "NFC-e", customer: "", cpf_cnpj: "", description: "", amount: 0 });
  const [inutilizeStart, setInutilizeStart] = useState("");
  const [inutilizeEnd, setInutilizeEnd] = useState("");
  const [inutilizeReason, setInutilizeReason] = useState("");

  const filtered = notes.filter((n) => {
    const matchType = filterType === "TODOS" || n.type === filterType;
    const matchStatus = filterStatus === "TODOS" || n.status === filterStatus;
    return matchType && matchStatus;
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "emitida": return <span className="badge text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200/50">✓ Emitida</span>;
      case "cancelada": return <span className="badge text-[10px] bg-red-50 text-red-700 border border-red-200/50">✕ Cancelada</span>;
      case "inutilizada": return <span className="badge text-[10px] bg-amber-50 text-amber-700 border border-amber-200/50">⚠ Inutilizada</span>;
      default: return null;
    }
  };

  const typeBadge = (type: string) => {
    switch (type) {
      case "NFC-e": return <span className="badge text-[10px] bg-blue-50 text-blue-700 border border-blue-200/50">NFC-e</span>;
      case "NFE": return <span className="badge text-[10px] bg-purple-50 text-purple-700 border border-purple-200/50">NFE</span>;
      case "SAT": return <span className="badge text-[10px] bg-amber-50 text-amber-700 border border-amber-200/50">SAT</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1>Fiscal & Emissão de Notas</h1>
        <p>Emissão de NFC-e, NFE, SAT, consulta de notas e inutilização de numeração.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-ink-50/60 rounded-xl p-1 border border-ink-200/30">
        {[
          { key: "notas", label: "📋 Notas Emitidas" },
          { key: "emitir", label: "🧾 Emitir Nota" },
          { key: "inutilizar", label: "⚠️ Inutilizar Numeração" },
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

      {/* Notas Emitidas */}
      {activeTab === "notas" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="stat-card group hover:border-blue-200/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg border border-blue-200/30 group-hover:scale-110 transition-transform">📋</div>
                <div>
                  <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Total Notas</div>
                  <div className="text-xl font-extrabold text-blue-600">{notes.length}</div>
                </div>
              </div>
            </div>
            <div className="stat-card group hover:border-emerald-200/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg border border-emerald-200/30 group-hover:scale-110 transition-transform">✅</div>
                <div>
                  <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Emitidas</div>
                  <div className="text-xl font-extrabold text-emerald-600">{notes.filter((n) => n.status === "emitida").length}</div>
                </div>
              </div>
            </div>
            <div className="stat-card group hover:border-red-200/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-lg border border-red-200/30 group-hover:scale-110 transition-transform">❌</div>
                <div>
                  <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Canceladas</div>
                  <div className="text-xl font-extrabold text-red-600">{notes.filter((n) => n.status === "cancelada").length}</div>
                </div>
              </div>
            </div>
            <div className="stat-card group hover:border-brand-200/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-lg border border-brand-200/30 group-hover:scale-110 transition-transform">💰</div>
                <div>
                  <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Valor Total</div>
                  <div className="text-xl font-extrabold gradient-text">{currency(notes.filter((n) => n.status === "emitida").reduce((s, n) => s + n.total, 0))}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="card-elevated p-4 flex gap-3 items-center">
            <select className="input max-w-[160px]" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="TODOS">Todos os Tipos</option>
              <option value="NFC-e">NFC-e</option>
              <option value="NFE">NFE</option>
              <option value="SAT">SAT</option>
            </select>
            <select className="input max-w-[160px]" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="TODOS">Todos os Status</option>
              <option value="emitida">Emitidas</option>
              <option value="cancelada">Canceladas</option>
              <option value="inutilizada">Inutilizadas</option>
            </select>
          </div>

          {/* Table */}
          <div className="card-elevated overflow-hidden">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Tipo</th>
                  <th>Destinatário</th>
                  <th>CPF/CNPJ</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th className="text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((note) => (
                  <tr key={note.id} className={note.status !== "emitida" ? "opacity-50" : ""}>
                    <td className="font-bold text-ink-900 bg-ink-50 px-2 py-0.5 rounded-lg text-xs inline-block">#{note.number}</td>
                    <td>{typeBadge(note.type)}</td>
                    <td className="font-medium text-sm">{note.customer}</td>
                    <td className="text-xs text-ink-500">{note.cpf_cnpj || "— • Consumidor Final"}</td>
                    <td className="font-bold gradient-text">{currency(note.total)}</td>
                    <td>{statusBadge(note.status)}</td>
                    <td className="text-xs text-ink-500">{note.date}</td>
                    <td className="text-right">
                      {note.status === "emitida" && (
                        <div className="flex items-center justify-end gap-1">
                          <button className="btn-outline py-1 px-2 text-xs">📄 DANFE</button>
                          <button className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors">✕ Cancelar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Emitir Nota */}
      {activeTab === "emitir" && (
        <div className="card-elevated p-6 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg border border-blue-200/30">🧾</div>
            <div>
              <h2 className="font-bold text-ink-900">Emitir Nova Nota Fiscal</h2>
              <p className="text-xs text-ink-500">Preencha os dados para emissão do documento fiscal</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Tipo de Documento</label>
              <select className="input" value={emitForm.type} onChange={(e) => setEmitForm({ ...emitForm, type: e.target.value })}>
                <option value="NFC-e">NFC-e (Nota Fiscal de Consumidor Eletrônica)</option>
                <option value="NFE">NFE (Nota Fiscal Eletrônica)</option>
                <option value="SAT">SAT (Cupom Fiscal Eletrônico)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Destinatário</label>
              <input className="input" placeholder="Nome do cliente" value={emitForm.customer} onChange={(e) => setEmitForm({ ...emitForm, customer: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">CPF/CNPJ</label>
              <input className="input" placeholder="000.000.000-00" value={emitForm.cpf_cnpj} onChange={(e) => setEmitForm({ ...emitForm, cpf_cnpj: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Descrição do Produto/Serviço</label>
              <input className="input" placeholder="Descrição" value={emitForm.description} onChange={(e) => setEmitForm({ ...emitForm, description: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Valor Total (R$)</label>
              <input className="input" type="number" step="0.01" placeholder="0,00" value={emitForm.amount || ""} onChange={(e) => setEmitForm({ ...emitForm, amount: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button className="btn-primary">🧾 Emitir {emitForm.type}</button>
            <button className="btn-outline" onClick={() => setEmitForm({ type: "NFC-e", customer: "", cpf_cnpj: "", description: "", amount: 0 })}>Limpar</button>
          </div>
        </div>
      )}

      {/* Inutilizar Numeração */}
      {activeTab === "inutilizar" && (
        <div className="card-elevated p-6 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-lg border border-amber-200/30">⚠️</div>
            <div>
              <h2 className="font-bold text-ink-900">Inutilização de Numeração</h2>
              <p className="text-xs text-ink-500">Marcar faixa de numeração como inutilizada (obrigatório comunicar à SEFAZ)</p>
            </div>
          </div>

          <div className="bg-amber-50/60 border border-amber-200/50 rounded-xl p-4 text-xs text-amber-800 leading-relaxed">
            <strong>⚠️ Atenção:</strong> A inutilização de numeração é irreversível. Utilize este recurso quando houver numeração sequencial que não será utilizada (ex: notas de numeração incorreta, notas que não serão emitidas).
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Número Inicial</label>
              <input className="input" placeholder="Ex: 000001" value={inutilizeStart} onChange={(e) => setInutilizeStart(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Número Final</label>
              <input className="input" placeholder="Ex: 000100" value={inutilizeEnd} onChange={(e) => setInutilizeEnd(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1.5">Motivo</label>
              <input className="input" placeholder="Ex: Numeração incorreta" value={inutilizeReason} onChange={(e) => setInutilizeReason(e.target.value)} />
            </div>
          </div>

          <button className="btn-primary bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700">
            ⚠️ Inutilizar Faixa de Numeração
          </button>
        </div>
      )}
    </div>
  );
}
