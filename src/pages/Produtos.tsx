import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Product } from "../types";

const empty: Omit<Product, "id"> = {
  name: "",
  category: "",
  price: 0,
  cost: 0,
  stock: 0,
  min_stock: 5,
  barcode: "",
  active: true,
  unit_type: "UN",
  scale_prefix: "",
};

export default function Produtos() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Omit<Product, "id">>(empty);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = () => api.listProducts(search).then(setProducts);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const submit = async () => {
    if (!form.name.trim()) return;
    if (editingId) {
      await api.updateProduct({ ...form, id: editingId });
    } else {
      await api.createProduct(form);
    }
    setForm(empty);
    setEditingId(null);
    load();
  };

  const edit = (p: Product) => {
    setEditingId(p.id);
    setForm({ ...p });
  };

  const remove = async (id: number) => {
    if (!confirm("Remover esta peça?")) return;
    await api.deleteProduct(id);
    load();
  };

  return (
    <div className="grid grid-cols-3 gap-6 animate-fade-in">
      <div className="col-span-2">
        <div className="page-header flex items-center justify-between">
          <div>
            <h1>Peças e estoque</h1>
            <p>Gerencie peças, lubrificantes e materiais da oficina.</p>
          </div>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm">🔍</span>
            <input
              className="input pl-10 max-w-xs"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="card-elevated overflow-hidden">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Preço</th>
                <th>Unidade</th>
                <th>Estoque</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, idx) => {
                const isLow = p.stock <= p.min_stock;
                return (
                  <tr key={p.id} className={isLow ? "bg-red-50/30" : ""} style={{ animationDelay: `${idx * 20}ms` }}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center text-sm border border-brand-200/30">
                          📦
                        </div>
                        <div>
                          <div className="font-semibold text-ink-900">{p.name}</div>
                          {isLow && (
                            <span className="badge-danger text-[10px] mt-0.5">
                              ⚠️ Estoque baixo
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-ink-600">{p.category}</td>
                    <td className="font-semibold text-ink-900">
                      {p.price.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td>
                      <span className="text-xs bg-ink-50 text-ink-600 px-2 py-0.5 rounded font-semibold border border-ink-200/30">
                        {p.unit_type}
                      </span>
                    </td>
                    <td>
                      <span className={isLow ? "font-bold text-red-600" : "font-medium text-ink-900"}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="text-ink-500 font-medium">{p.min_stock}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => edit(p)}
                          className="px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => remove(p.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form sidebar */}
      <div className="card-elevated p-5 h-fit sticky top-6 animate-slide-up">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm shadow-brand">
            {editingId ? "✏️" : "➕"}
          </div>
          <h2 className="font-bold text-ink-900">
            {editingId ? "Editar Produto" : "Novo Produto"}
          </h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Nome</label>
            <input
              className="input"
              placeholder="Nome da peça ou material"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Categoria</label>
            <input
              className="input"
              placeholder="Ex: Bebidas, Laticínios..."
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Código de barras</label>
            <input
              className="input"
              placeholder="Código EAN-13"
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Tipo de Unidade</label>
            <select
              className="input"
              value={form.unit_type}
              onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
            >
              <option value="UN">UN — Unidade</option>
              <option value="KG">KG — Quilograma</option>
              <option value="LT">LT — Litro</option>
              <option value="MT">MT — Metro</option>
              <option value="CX">CX — Caixa</option>
              <option value="FD">FD — Fardo</option>
            </select>
          </div>
          {(form.unit_type === "KG" || form.unit_type === "LT") && (
            <div>
              <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Prefixo Balança</label>
              <input
                className="input"
                placeholder="Ex: 2 (código do produto na balança)"
                value={form.scale_prefix}
                onChange={(e) => setForm({ ...form, scale_prefix: e.target.value })}
              />
              <p className="text-[9px] text-ink-400 mt-0.5">Código interno ou referência do fabricante</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Preço aplicado</label>
              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="R$ 0,00"
                value={form.price || ""}
                onChange={(e) =>
                  setForm({ ...form, price: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Custo</label>
              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="R$ 0,00"
                value={form.cost || ""}
                onChange={(e) =>
                  setForm({ ...form, cost: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Estoque Atual</label>
              <input
                type="number"
                className="input"
                placeholder="Ex: 20"
                value={form.stock || ""}
                onChange={(e) =>
                  setForm({ ...form, stock: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Est. Mínimo</label>
              <input
                type="number"
                className="input"
                placeholder="Ex: 5"
                value={form.min_stock || ""}
                onChange={(e) =>
                  setForm({ ...form, min_stock: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button className="btn-primary flex-1" onClick={submit}>
              {editingId ? "Salvar Alterações" : "Adicionar Produto"}
            </button>
            {editingId && (
              <button
                className="btn-outline"
                onClick={() => {
                  setEditingId(null);
                  setForm(empty);
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
