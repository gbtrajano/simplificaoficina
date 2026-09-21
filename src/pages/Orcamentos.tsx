import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Product, Quote } from "../types";

const currency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Orcamentos() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customer_name: "", customer_document: "", notes: "" });
  const [items, setItems] = useState<{ product_id: number; product_name: string; unit_price: number; quantity: number }[]>([]);

  const load = async () => {
    const [q, p] = await Promise.all([api.listQuotes(), api.listProducts("")]);
    setQuotes(q); setProducts(p);
  };
  useEffect(() => { load(); }, []);

  const addItem = () => setItems([...items, { product_id: 0, product_name: "", unit_price: 0, quantity: 1 }]);

  const handleCreate = async () => {
    if (items.length === 0) return;
    await api.createQuote(form.customer_name, form.customer_document, items as any, form.notes);
    setShowForm(false); setItems([]); setForm({ customer_name: "", customer_document: "", notes: "" });
    load();
  };

  const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div><h1>Orçamentos / Pré-Vendas</h1><p>Gere cotações para aprovação rápida no caixa.</p></div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Novo Orçamento</button>
      </div>

      {showForm && (
        <div className="card-elevated p-5 animate-slide-up space-y-4">
          <h2 className="font-bold text-ink-900">Novo Orçamento</h2>
          <div className="grid grid-cols-3 gap-3">
            <input className="input" placeholder="Nome do cliente" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            <input className="input" placeholder="CPF/CNPJ" value={form.customer_document} onChange={(e) => setForm({ ...form, customer_document: e.target.value })} />
            <input className="input" placeholder="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex items-center justify-between">
            <button className="btn-outline text-sm" onClick={addItem}>+ Adicionar Item</button>
            <span className="font-bold text-ink-900">Total: {currency(total)}</span>
          </div>
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-ink-50/60 rounded-lg">
                  <select className="input flex-1 text-sm" value={item.product_id} onChange={(e) => {
                    const p = products.find((x) => x.id === parseInt(e.target.value));
                    const newItems = [...items]; newItems[idx] = { ...newItems[idx], product_id: parseInt(e.target.value), product_name: p?.name || "", unit_price: p?.price || 0 }; setItems(newItems);
                  }}>
                    <option value={0}>Produto</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} - {currency(p.price)}</option>)}
                  </select>
                  <input className="input w-20 text-center text-sm" type="number" min="1" value={item.quantity} onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], quantity: parseInt(e.target.value) || 1 }; setItems(n); }} />
                  <input className="input w-28 text-sm" type="number" step="0.01" value={item.unit_price} onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], unit_price: parseFloat(e.target.value) || 0 }; setItems(n); }} />
                  <span className="text-xs font-bold w-24 text-right">{currency(item.unit_price * item.quantity)}</span>
                  <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn-primary" onClick={handleCreate}>Salvar Orçamento</button>
            <button className="btn-outline" onClick={() => { setShowForm(false); setItems([]); }}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="card-elevated overflow-hidden">
        <table className="table-modern">
          <thead><tr><th>#</th><th>Cliente</th><th>Total</th><th>Status</th><th>Data</th><th className="text-right">Ação</th></tr></thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id}>
                <td className="font-bold">#{q.id}</td>
                <td>{q.customer_name || "Consumidor Final"}</td>
                <td className="font-bold gradient-text">{currency(q.total)}</td>
                <td><span className={q.status === "converted" ? "badge-success" : "badge-warning"}>{q.status === "converted" ? "Convertido" : "Pendente"}</span></td>
                <td className="text-xs text-ink-500">{q.created_at.slice(0, 10)}</td>
                <td className="text-right">
                  <button onClick={() => { if (confirm("Excluir?")) api.deleteQuote(q.id).then(load); }} className="text-xs text-red-400 hover:text-red-600">Excluir</button>
                </td>
              </tr>
            ))}
            {quotes.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-ink-400">Nenhum orçamento criado</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
