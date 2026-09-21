import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Product, ProductBatch, ExpiryAlert } from "../types";

const formatDate = (d: string) => {
  try { return new Date(d + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
};

export default function Validade() {
  const [alerts, setAlerts] = useState<ExpiryAlert[]>([]);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ product_id: 0, batch_code: "", quantity: 1, expiry_date: "" });

  const load = async () => {
    const [a, b, p] = await Promise.all([api.getExpiryAlerts(), api.listBatches(), api.listProducts("")]);
    setAlerts(a); setBatches(b); setProducts(p);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.product_id || !form.expiry_date) return;
    await api.createBatch(form.product_id, form.batch_code, form.quantity, form.expiry_date);
    setForm({ product_id: 0, batch_code: "", quantity: 1, expiry_date: "" });
    setShowForm(false);
    load();
  };

  const expired = alerts.filter((a) => a.status === "expired");
  const critical = alerts.filter((a) => a.status === "critical");
  const warning = alerts.filter((a) => a.status === "warning");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Controle de Validade</h1>
          <p>Gerencie lotes e acompanhe vencimentos dos produtos.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Novo Lote</button>
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card border-l-4 border-l-red-500">
          <div className="text-xs font-semibold text-red-500 uppercase tracking-wider">Vencidos</div>
          <div className="text-2xl font-extrabold text-red-600 mt-1">{expired.length}</div>
        </div>
        <div className="stat-card border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Crítico (≤7 dias)</div>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">{critical.length}</div>
        </div>
        <div className="stat-card border-l-4 border-l-blue-500">
          <div className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Atenção (≤30 dias)</div>
          <div className="text-2xl font-extrabold text-blue-600 mt-1">{warning.length}</div>
        </div>
      </div>

      {/* New batch form */}
      {showForm && (
        <div className="card-elevated p-5 animate-slide-up">
          <h2 className="font-bold text-ink-900 mb-3">Novo Lote</h2>
          <div className="grid grid-cols-4 gap-3">
            <select className="input" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: parseInt(e.target.value) })}>
              <option value={0}>Selecione o produto</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input className="input" placeholder="Código do lote" value={form.batch_code} onChange={(e) => setForm({ ...form, batch_code: e.target.value })} />
            <input className="input" type="number" min="1" placeholder="Quantidade" value={form.quantity || ""} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} />
            <input className="input" type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
          </div>
          <div className="flex gap-2 mt-3">
            <button className="btn-primary" onClick={handleCreate}>Salvar</button>
            <button className="btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Alerts list */}
      {alerts.length > 0 && (
        <div className="card-elevated p-5">
          <h2 className="font-bold text-ink-900 mb-3">⚠️ Alertas de Validade</h2>
          <div className="space-y-2">
            {alerts.map((a) => {
              const colors = a.status === "expired" ? "border-red-300 bg-red-50/50"
                : a.status === "critical" ? "border-amber-300 bg-amber-50/50"
                : "border-blue-200 bg-blue-50/50";
              return (
                <div key={a.batch.id} className={`flex items-center justify-between p-3 rounded-xl border ${colors}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{a.status === "expired" ? "🔴" : a.status === "critical" ? "🟠" : "🔵"}</span>
                    <div>
                      <div className="font-semibold text-sm text-ink-900">{a.batch.product_name}</div>
                      <div className="text-xs text-ink-500">Lote: {a.batch.batch_code} · {a.batch.quantity} unidades</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-ink-500">Vence em {formatDate(a.batch.expiry_date)}</div>
                    <div className={`font-bold text-xs ${a.days_until_expiry < 0 ? "text-red-600" : a.days_until_expiry <= 7 ? "text-amber-600" : "text-blue-600"}`}>
                      {a.days_until_expiry < 0 ? `Vencido há ${Math.abs(a.days_until_expiry)} dias` : `${a.days_until_expiry} dias restantes`}
                    </div>
                  </div>
                  <button onClick={() => { if (confirm("Excluir este lote?")) { api.deleteBatch(a.batch.id).then(load); } }} className="text-xs text-red-400 hover:text-red-600 px-2">✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All batches */}
      <div className="card-elevated overflow-hidden">
        <table className="table-modern">
          <thead><tr><th>Produto</th><th>Lote</th><th>Quantidade</th><th>Validade</th><th>Status</th><th className="text-right">Ação</th></tr></thead>
          <tbody>
            {batches.map((b) => {
              const daysLeft = Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / 86400000);
              const status = daysLeft < 0 ? "Vencido" : daysLeft <= 7 ? "Crítico" : daysLeft <= 30 ? "Atenção" : "OK";
              const sColor = daysLeft < 0 ? "badge-danger" : daysLeft <= 7 ? "badge-warning" : daysLeft <= 30 ? "badge-brand" : "badge-success";
              return (
                <tr key={b.id}>
                  <td className="font-medium">{b.product_name}</td>
                  <td className="font-mono text-xs">{b.batch_code}</td>
                  <td>{b.quantity}</td>
                  <td className="text-xs">{formatDate(b.expiry_date)}</td>
                  <td><span className={sColor}>{status}</span></td>
                  <td className="text-right">
                    <button onClick={() => { if (confirm("Excluir?")) api.deleteBatch(b.id).then(load); }} className="text-xs text-red-500 hover:text-red-600">Excluir</button>
                  </td>
                </tr>
              );
            })}
            {batches.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-ink-400">Nenhum lote cadastrado</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
