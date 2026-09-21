import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Product, LossRecord } from "../types";

const currency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const REASONS = [
  { value: "damage", label: "💥 Quebra / Avaria", color: "badge-danger" },
  { value: "theft", label: "🚨 Furto / Roubo", color: "badge-danger" },
  { value: "expiry", label: "⏰ Vencimento", color: "badge-warning" },
  { value: "internal", label: "🍽️ Consumo Interno", color: "badge-brand" },
  { value: "other", label: "📋 Outro", color: "badge-success" },
];

export default function Perdas() {
  const [losses, setLosses] = useState<LossRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ product_id: 0, quantity: 1, reason: "damage", description: "", value: 0 });

  const load = async () => {
    const [l, p] = await Promise.all([api.listLosses(), api.listProducts("")]);
    setLosses(l); setProducts(p);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.product_id || form.quantity <= 0) return;
    const prod = products.find((p) => p.id === form.product_id);
    const value = form.value || (prod ? prod.cost * form.quantity : 0);
    await api.registerLoss(form.product_id, form.quantity, form.reason, form.description, value);
    setForm({ product_id: 0, quantity: 1, reason: "damage", description: "", value: 0 });
    setShowForm(false);
    load();
  };

  const totalLosses = losses.reduce((s, l) => s + l.value, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Perdas e Avarias</h1>
          <p>Registre quebras, furtos, vencimentos e consumos internos.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Registrar Perda</button>
      </div>

      <div className="stat-card">
        <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Total de Perdas</div>
        <div className="text-2xl font-extrabold text-red-500 mt-1">{currency(totalLosses)}</div>
      </div>

      {showForm && (
        <div className="card-elevated p-5 animate-slide-up space-y-3">
          <h2 className="font-bold text-ink-900">Registrar Perda</h2>
          <div className="grid grid-cols-2 gap-3">
            <select className="input" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: parseInt(e.target.value) })}>
              <option value={0}>Selecione o produto</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} (Estoque: {p.stock})</option>)}
            </select>
            <select className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
              {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <input className="input" type="number" min="1" placeholder="Quantidade" value={form.quantity || ""} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} />
            <input className="input" type="number" step="0.01" placeholder="Valor (R$) - opcional" value={form.value || ""} onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })} />
          </div>
          <input className="input" placeholder="Descrição / Observação" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2">
            <button className="btn-primary" onClick={handleCreate}>Registrar</button>
            <button className="btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="card-elevated overflow-hidden">
        <table className="table-modern">
          <thead><tr><th>Produto</th><th>Qtd</th><th>Motivo</th><th>Descrição</th><th>Valor</th><th>Data</th></tr></thead>
          <tbody>
            {losses.map((l) => {
              const reasonInfo = REASONS.find((r) => r.value === l.reason) || REASONS[4];
              return (
                <tr key={l.id}>
                  <td className="font-medium">{l.product_name}</td>
                  <td>{l.quantity}</td>
                  <td><span className={reasonInfo.color}>{reasonInfo.label}</span></td>
                  <td className="text-xs text-ink-500">{l.description || "—"}</td>
                  <td className="font-bold text-red-500">{currency(l.value)}</td>
                  <td className="text-xs text-ink-500">{l.created_at.slice(0, 10)}</td>
                </tr>
              );
            })}
            {losses.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-ink-400">Nenhuma perda registrada</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
