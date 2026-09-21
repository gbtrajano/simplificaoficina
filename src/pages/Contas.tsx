import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Account } from "../types";

const currency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (d: string) => { try { return new Date(d + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return d; } };

export default function Contas() {
  const [tab, setTab] = useState<"payable" | "receivable">("payable");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ description: "", amount: 0, due_date: "", notes: "" });

  const load = () => api.listAccounts(tab).then(setAccounts);
  useEffect(() => { load(); }, [tab]);

  const handleCreate = async () => {
    if (!form.description.trim() || form.amount <= 0) return;
    await api.createAccount(tab, form.description, form.amount, form.due_date, null, null, form.notes);
    setForm({ description: "", amount: 0, due_date: "", notes: "" });
    setShowForm(false);
    load();
  };

  const pending = accounts.filter((a) => !a.paid);
  const paid = accounts.filter((a) => a.paid);
  const totalPending = pending.reduce((s, a) => s + a.amount, 0);
  const totalPaid = paid.reduce((s, a) => s + a.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Contas a {tab === "payable" ? "Pagar" : "Receber"}</h1>
          <p>Gerencie compromissos financeiros e pendências.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Nova Conta</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-ink-50/60 rounded-xl p-1 border border-ink-200/30">
        <button onClick={() => setTab("payable")} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "payable" ? "bg-white shadow-soft text-ink-900" : "text-ink-500"}`}>
          📤 Contas a Pagar
        </button>
        <button onClick={() => setTab("receivable")} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "receivable" ? "bg-white shadow-soft text-ink-900" : "text-ink-500"}`}>
          📥 Contas a Receber
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card"><div className="text-xs font-semibold text-ink-400 uppercase">Pendente</div><div className="text-xl font-extrabold text-amber-600 mt-1">{currency(totalPending)}</div></div>
        <div className="stat-card"><div className="text-xs font-semibold text-ink-400 uppercase">Pago</div><div className="text-xl font-extrabold text-emerald-600 mt-1">{currency(totalPaid)}</div></div>
      </div>

      {showForm && (
        <div className="card-elevated p-5 animate-slide-up space-y-3">
          <h2 className="font-bold text-ink-900">Nova Conta</h2>
          <div className="grid grid-cols-3 gap-3">
            <input className="input" placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <input className="input" type="number" step="0.01" placeholder="Valor (R$)" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
            <input className="input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <input className="input" placeholder="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-2">
            <button className="btn-primary" onClick={handleCreate}>Salvar</button>
            <button className="btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Pending */}
      <div className="card-elevated overflow-hidden">
        <div className="px-5 py-3 border-b border-ink-100/60 bg-amber-50/30">
          <h3 className="font-bold text-sm text-amber-800">⏳ Pendentes ({pending.length})</h3>
        </div>
        <table className="table-modern">
          <thead><tr><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Observações</th><th className="text-right">Ação</th></tr></thead>
          <tbody>
            {pending.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">{a.description}</td>
                <td className="font-bold text-amber-600">{currency(a.amount)}</td>
                <td className="text-xs">{formatDate(a.due_date)}</td>
                <td className="text-xs text-ink-500">{a.notes || "—"}</td>
                <td className="text-right space-x-2">
                  <button onClick={() => api.payAccount(a.id).then(load)} className="btn-outline text-xs px-2 py-1">✅ Pagar</button>
                  <button onClick={() => { if (confirm("Excluir?")) api.deleteAccount(a.id).then(load); }} className="text-xs text-red-400 hover:text-red-600">✕</button>
                </td>
              </tr>
            ))}
            {pending.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-ink-400">Nenhuma conta pendente</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Paid */}
      {paid.length > 0 && (
        <div className="card-elevated overflow-hidden">
          <div className="px-5 py-3 border-b border-ink-100/60 bg-emerald-50/30">
            <h3 className="font-bold text-sm text-emerald-800">✅ Pagas ({paid.length})</h3>
          </div>
          <table className="table-modern">
            <thead><tr><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Pago em</th></tr></thead>
            <tbody>
              {paid.map((a) => (
                <tr key={a.id} className="opacity-60">
                  <td className="font-medium line-through">{a.description}</td>
                  <td className="font-bold text-emerald-600">{currency(a.amount)}</td>
                  <td className="text-xs">{formatDate(a.due_date)}</td>
                  <td className="text-xs text-ink-500">{a.paid_date ? formatDate(a.paid_date) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
