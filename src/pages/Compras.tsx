import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Supplier, Product, PurchaseOrder } from "../types";

const currency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Compras() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ supplier_id: null as number | null, notes: "" });
  const [items, setItems] = useState<{ product_id: number; product_name: string; quantity: number; unit_cost: number }[]>([]);

  const load = async () => {
    const [o, s, p] = await Promise.all([api.listPurchaseOrders(), api.listSuppliers(""), api.listProducts("")]);
    setOrders(o); setSuppliers(s); setProducts(p);
  };
  useEffect(() => { load(); }, []);

  const addItem = () => setItems([...items, { product_id: 0, product_name: "", quantity: 1, unit_cost: 0 }]);

  const handleCreate = async () => {
    if (items.length === 0) return;
    await api.createPurchaseOrder(form.supplier_id, items as any, form.notes);
    setShowForm(false); setItems([]); setForm({ supplier_id: null, notes: "" });
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div><h1>Compras / Entradas</h1><p>Registre pedidos de compra e importe notas fiscais.</p></div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Nova Compra</button>
      </div>

      {showForm && (
        <div className="card-elevated p-5 animate-slide-up space-y-4">
          <h2 className="font-bold text-ink-900">Nova Compra</h2>
          <div className="grid grid-cols-3 gap-3">
            <select className="input" value={form.supplier_id ?? 0} onChange={(e) => setForm({ ...form, supplier_id: parseInt(e.target.value) || null })}>
              <option value={0}>Selecione o fornecedor</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input className="input" placeholder="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <button className="btn-outline" onClick={addItem}>+ Adicionar Item</button>
          </div>
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-ink-50/60 rounded-lg">
                  <select className="input flex-1 text-sm" value={item.product_id} onChange={(e) => {
                    const p = products.find((x) => x.id === parseInt(e.target.value));
                    const newItems = [...items]; newItems[idx] = { ...newItems[idx], product_id: parseInt(e.target.value), product_name: p?.name || "", unit_cost: p?.cost || 0 }; setItems(newItems);
                  }}>
                    <option value={0}>Produto</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input className="input w-20 text-center text-sm" type="number" min="1" placeholder="Qtd" value={item.quantity} onChange={(e) => { const newItems = [...items]; newItems[idx] = { ...newItems[idx], quantity: parseInt(e.target.value) || 1 }; setItems(newItems); }} />
                  <input className="input w-28 text-sm" type="number" step="0.01" placeholder="Custo" value={item.unit_cost} onChange={(e) => { const newItems = [...items]; newItems[idx] = { ...newItems[idx], unit_cost: parseFloat(e.target.value) || 0 }; setItems(newItems); }} />
                  <span className="text-xs font-bold text-ink-900 w-24 text-right">{currency(item.unit_cost * item.quantity)}</span>
                  <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                </div>
              ))}
              <div className="text-right font-bold text-ink-900">Total: {currency(items.reduce((s, i) => s + i.unit_cost * i.quantity, 0))}</div>
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn-primary" onClick={handleCreate}>Salvar Compra</button>
            <button className="btn-outline" onClick={() => { setShowForm(false); setItems([]); }}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="card-elevated overflow-hidden">
        <table className="table-modern">
          <thead><tr><th>#</th><th>Fornecedor</th><th>Total</th><th>Status</th><th>Data</th><th className="text-right">Ação</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="font-bold">#{o.id}</td>
                <td>{o.supplier_name || "—"}</td>
                <td className="font-bold gradient-text">{currency(o.total)}</td>
                <td><span className={o.status === "received" ? "badge-success" : "badge-warning"}>{o.status === "received" ? "Recebido" : "Pendente"}</span></td>
                <td className="text-xs text-ink-500">{o.created_at.slice(0, 10)}</td>
                <td className="text-right">
                  {o.status === "pending" && (
                    <button onClick={() => api.receivePurchaseOrder(o.id).then(load)} className="btn-outline text-xs px-3 py-1">📥 Receber</button>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-ink-400">Nenhuma compra registrada</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
