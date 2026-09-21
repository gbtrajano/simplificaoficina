import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Product, Promotion } from "../types";

export default function Promocoes() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", promotion_type: "quantity_discount", product_id: null as number | null,
    min_quantity: 1, discount_percent: 0, discount_amount: 0,
    buy_quantity: 3, pay_quantity: 2, wholesale_price: null as number | null,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  });

  const load = async () => {
    const [p, pr] = await Promise.all([api.listProducts(""), api.listPromotions()]);
    setProducts(p); setPromos(pr);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    await api.savePromotion(form as any);
    setShowForm(false);
    setForm({ ...form, name: "" });
    load();
  };

  const typeLabels: Record<string, string> = {
    quantity_discount: "% Desconto por Qtd",
    buy_x_pay_y: "Leve X Pague Y",
    wholesale: "Preço Atacado",
    fixed_discount: "Desconto Fixo (R$)",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div><h1>Promoções / Ofertas</h1><p>Crie regras dinâmicas de desconto e promoções.</p></div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Nova Promoção</button>
      </div>

      {showForm && (
        <div className="card-elevated p-5 animate-slide-up space-y-3">
          <h2 className="font-bold text-ink-900">Nova Promoção</h2>
          <div className="grid grid-cols-3 gap-3">
            <input className="input" placeholder="Nome da promoção" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="input" value={form.promotion_type} onChange={(e) => setForm({ ...form, promotion_type: e.target.value })}>
              <option value="quantity_discount">% Desconto por Quantidade</option>
              <option value="buy_x_pay_y">Leve X Pague Y</option>
              <option value="wholesale">Preço Atacado/Varejo</option>
              <option value="fixed_discount">Desconto Fixo (R$)</option>
            </select>
            <select className="input" value={form.product_id ?? 0} onChange={(e) => setForm({ ...form, product_id: parseInt(e.target.value) || null })}>
              <option value={0}>Todos os produtos</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {form.promotion_type === "quantity_discount" && (
              <>
                <div><label className="text-[10px] font-semibold text-ink-400 uppercase block mb-1">Qtd. Mínima</label><input className="input" type="number" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: parseInt(e.target.value) || 1 })} /></div>
                <div><label className="text-[10px] font-semibold text-ink-400 uppercase block mb-1">Desconto %</label><input className="input" type="number" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: parseFloat(e.target.value) || 0 })} /></div>
              </>
            )}
            {form.promotion_type === "buy_x_pay_y" && (
              <>
                <div><label className="text-[10px] font-semibold text-ink-400 uppercase block mb-1">Leve</label><input className="input" type="number" value={form.buy_quantity} onChange={(e) => setForm({ ...form, buy_quantity: parseInt(e.target.value) || 3 })} /></div>
                <div><label className="text-[10px] font-semibold text-ink-400 uppercase block mb-1">Pague</label><input className="input" type="number" value={form.pay_quantity} onChange={(e) => setForm({ ...form, pay_quantity: parseInt(e.target.value) || 2 })} /></div>
              </>
            )}
            {form.promotion_type === "wholesale" && (
              <div><label className="text-[10px] font-semibold text-ink-400 uppercase block mb-1">Preço Atacado</label><input className="input" type="number" step="0.01" value={form.wholesale_price ?? ""} onChange={(e) => setForm({ ...form, wholesale_price: parseFloat(e.target.value) || null })} /></div>
            )}
            {form.promotion_type === "fixed_discount" && (
              <div><label className="text-[10px] font-semibold text-ink-400 uppercase block mb-1">Desconto R$</label><input className="input" type="number" step="0.01" value={form.discount_amount} onChange={(e) => setForm({ ...form, discount_amount: parseFloat(e.target.value) || 0 })} /></div>
            )}
            <div><label className="text-[10px] font-semibold text-ink-400 uppercase block mb-1">Início</label><input className="input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><label className="text-[10px] font-semibold text-ink-400 uppercase block mb-1">Fim</label><input className="input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={handleSave}>Salvar</button>
            <button className="btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {promos.map((p) => (
          <div key={p.id} className="card-elevated p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm shadow-brand">🏷️</div>
              <div>
                <div className="font-bold text-ink-900">{p.name}</div>
                <div className="text-xs text-ink-500">
                  {typeLabels[p.promotion_type] || p.promotion_type}
                  {p.product_name && ` · ${p.product_name}`}
                </div>
                <div className="text-[10px] text-ink-400 mt-0.5">
                  Válido: {p.start_date} até {p.end_date}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge ${p.active ? "badge-success" : "badge-warning"}`}>{p.active ? "Ativa" : "Inativa"}</span>
              <button onClick={() => api.togglePromotion(p.id, !p.active).then(load)} className="btn-outline text-xs px-2 py-1">{p.active ? "Desativar" : "Ativar"}</button>
              <button onClick={() => { if (confirm("Excluir?")) api.deletePromotion(p.id).then(load); }} className="text-xs text-red-400 hover:text-red-600">✕</button>
            </div>
          </div>
        ))}
        {promos.length === 0 && <div className="card-elevated p-8 text-center text-ink-400">Nenhuma promoção cadastrada</div>}
      </div>
    </div>
  );
}
