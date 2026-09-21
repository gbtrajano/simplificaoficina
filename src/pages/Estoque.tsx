import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Product } from "../types";

export default function Estoque() {
  const [products, setProducts] = useState<Product[]>([]);
  const [reason, setReason] = useState<Record<number, string>>({});
  const [delta, setDelta] = useState<Record<number, number>>({});

  const load = () => api.listProducts("").then(setProducts);
  useEffect(() => {
    load();
  }, []);

  const apply = async (id: number) => {
    const d = delta[id] || 0;
    if (d === 0) return;
    await api.adjustStock(id, d, reason[id] || "Ajuste manual");
    setDelta({ ...delta, [id]: 0 });
    setReason({ ...reason, [id]: "" });
    load();
  };

  const lowStock = products.filter((p) => p.stock <= p.min_stock);
  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>Gestão de Estoque</h1>
            <p>Monitore o nível de estoque e faça ajustes de movimentação.</p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Total de Produtos</div>
          <div className="text-2xl font-extrabold text-ink-900 mt-1">{totalProducts}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Itens em Estoque</div>
          <div className="text-2xl font-extrabold gradient-text mt-1">{totalStock.toLocaleString("pt-BR")}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Estoque Baixo</div>
          <div className="text-2xl font-extrabold text-red-500 mt-1">{lowStock.length}</div>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="card-elevated p-5 border-l-4 border-l-amber-400 bg-gradient-to-r from-amber-50/80 to-white/80 animate-slide-up">
          <div className="flex items-center gap-2 font-bold text-amber-800 text-sm mb-3">
            <span className="text-lg">🚨</span>
            Alerta de Estoque Mínimo
            <span className="badge-warning">{lowStock.length} produto(s)</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {lowStock.map((p) => (
              <div
                key={p.id}
                className="bg-white/80 p-3 rounded-xl border border-amber-200/40 text-xs flex justify-between items-center shadow-soft"
              >
                <span className="font-semibold text-ink-900 truncate max-w-[140px]">{p.name}</span>
                <span className="font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg">
                  {p.stock} / {p.min_stock}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stock table */}
      <div className="card-elevated overflow-hidden">
        <table className="table-modern">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Estoque Atual</th>
              <th>Estoque Mínimo</th>
              <th>Ajuste (+/-)</th>
              <th>Motivo</th>
              <th className="text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, idx) => {
              const isLow = p.stock <= p.min_stock;
              return (
                <tr key={p.id} className={isLow ? "bg-red-50/30" : ""} style={{ animationDelay: `${idx * 20}ms` }}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm border ${
                        isLow
                          ? "bg-red-50 border-red-200/50 text-red-500"
                          : "bg-brand-50 border-brand-200/30 text-brand-600"
                      }`}>
                        {isLow ? "⚠️" : "📦"}
                      </div>
                      <div>
                        <div className="font-semibold text-ink-900">{p.name}</div>
                        {isLow && (
                          <span className="badge-danger text-[10px] mt-0.5">
                            Abaixo do Mínimo
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={isLow ? "text-red-600 font-extrabold text-lg" : "font-semibold text-ink-900"}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="text-ink-500 font-medium">{p.min_stock}</td>
                  <td>
                    <input
                      type="number"
                      className="input w-24 text-center font-semibold text-sm"
                      value={delta[p.id] ?? ""}
                      placeholder="0"
                      onChange={(e) =>
                        setDelta({ ...delta, [p.id]: parseInt(e.target.value) || 0 })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="input max-w-xs text-sm"
                      placeholder="Ex: Recebimento, avaria..."
                      value={reason[p.id] ?? ""}
                      onChange={(e) =>
                        setReason({ ...reason, [p.id]: e.target.value })
                      }
                    />
                  </td>
                  <td className="text-right">
                    <button
                      className="btn-outline text-xs px-3 py-1.5"
                      onClick={() => apply(p.id)}
                    >
                      Aplicar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
