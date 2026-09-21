import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { SaleRecord, SaleItemRecord } from "../types";

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function HistoricoVendas() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMethod, setFilterMethod] = useState("TODOS");

  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItemRecord[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const loadSales = () => {
    setLoading(true);
    api
      .listSales(500)
      .then(setSales)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSales();
  }, []);

  const openSaleDetails = (sale: SaleRecord) => {
    setSelectedSale(sale);
    setLoadingItems(true);
    api
      .getSaleItems(sale.id)
      .then(setSaleItems)
      .catch(console.error)
      .finally(() => setLoadingItems(false));
  };

  const filteredSales = sales.filter((s) => {
    const matchSearch =
      s.id.toString().includes(search) ||
      (s.customer_name && s.customer_name.toLowerCase().includes(search.toLowerCase())) ||
      s.payment_method.toLowerCase().includes(search.toLowerCase());

    const matchMethod =
      filterMethod === "TODOS" ||
      s.payment_method.toLowerCase() === filterMethod.toLowerCase();

    return matchSearch && matchMethod;
  });

  const activeSales = filteredSales.filter((s) => !s.canceled);
  const totalAmount = activeSales.reduce((acc, s) => acc + s.total, 0);
  const averageTicket = activeSales.length > 0 ? totalAmount / activeSales.length : 0;

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const getPaymentBadgeClass = (method: string) => {
    switch (method) {
      case "Pix": return "bg-purple-50 text-purple-700 border border-purple-200/50";
      case "Dinheiro": return "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
      case "Cartão de Crédito": return "bg-blue-50 text-blue-700 border border-blue-200/50";
      case "Cartão de Débito": return "bg-amber-50 text-amber-700 border border-amber-200/50";
      default: return "bg-ink-50 text-ink-700 border border-ink-200/50";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Histórico de Vendas</h1>
          <p>Consulte todas as vendas registradas, comprovantes e formas de pagamento.</p>
        </div>
        <button
          onClick={loadSales}
          className="btn-outline text-xs flex items-center gap-1.5"
        >
          🔄 Atualizar
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card group hover:border-brand-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-lg border border-brand-200/30 group-hover:scale-110 transition-transform">
              🧾
            </div>
            <div>
              <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Total de Vendas</div>
              <div className="text-2xl font-extrabold text-ink-900">
                {activeSales.length}
                {filteredSales.length !== activeSales.length && (
                  <span className="text-xs font-normal text-red-400 ml-1.5">
                    ({filteredSales.length - activeSales.length} cancelada{filteredSales.length - activeSales.length !== 1 ? "s" : ""})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="stat-card group hover:border-brand-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-lg border border-brand-200/30 group-hover:scale-110 transition-transform">
              💰
            </div>
            <div>
              <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Faturamento Filtrado</div>
              <div className="text-2xl font-extrabold gradient-text">
                {currency(totalAmount)}
              </div>
            </div>
          </div>
        </div>
        <div className="stat-card group hover:border-emerald-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg border border-emerald-200/30 group-hover:scale-110 transition-transform">
              📊
            </div>
            <div>
              <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Ticket Médio</div>
              <div className="text-2xl font-extrabold text-emerald-600">
                {currency(averageTicket)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card-elevated p-4 flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm">🔍</span>
          <input
            className="input pl-10"
            placeholder="Buscar por código, cliente ou pagamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input max-w-xs"
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
        >
          <option value="TODOS">Todas as Formas de Pagamento</option>
          <option value="Dinheiro">💵 Dinheiro</option>
          <option value="Cartão de Crédito">💳 Cartão de Crédito</option>
          <option value="Cartão de Débito">💳 Cartão de Débito</option>
          <option value="Pix">📱 Pix</option>
          <option value="Vale Alimentação">🎫 Vale Alimentação</option>
          <option value="Vale Refeição">🍽️ Vale Refeição</option>
        </select>
      </div>

      {/* Table */}
      <div className="card-elevated overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
            <div className="text-ink-500 text-sm font-medium">Carregando histórico de vendas...</div>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📜</div>
            <div className="text-ink-500 font-medium">Nenhuma venda encontrada</div>
            <div className="text-ink-400 text-xs mt-1">Tente ajustar os filtros de busca</div>
          </div>
        ) : (
          <table className="table-modern">
            <thead>
              <tr>
                <th>Código</th>
                <th>Data e Hora</th>
                <th>Cliente</th>
                <th>Qtd. Itens</th>
                <th>Pagamento</th>
                <th>Total</th>
                <th className="text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale, idx) => (
                <tr key={sale.id} style={{ animationDelay: `${idx * 15}ms` }} className={sale.canceled ? "opacity-50" : ""}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold px-2 py-0.5 rounded-lg text-xs ${sale.canceled ? "text-red-400 bg-red-50 line-through" : "text-ink-900 bg-ink-50"}`}>
                        #{sale.id}
                      </span>
                      {sale.canceled && (
                        <span className="badge text-[10px] bg-red-50 text-red-600 border border-red-200/50">
                          ❌ Cancelada
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-ink-600 text-xs">{formatDate(sale.created_at)}</td>
                  <td className="text-ink-700 font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-brand-50 flex items-center justify-center text-[10px] text-brand-600 border border-brand-200/30">
                        {sale.customer_name ? sale.customer_name.charAt(0).toUpperCase() : "🏪"}
                      </div>
                      <span className={sale.canceled ? "line-through text-ink-400" : ""}>
                        {sale.customer_name || "Consumidor Final"}
                      </span>
                    </div>
                  </td>
                  <td className="text-ink-600">{sale.items_count} {sale.items_count === 1 ? "item" : "itens"}</td>
                  <td>
                    <span className={`badge text-[11px] ${getPaymentBadgeClass(sale.payment_method)} ${sale.canceled ? "opacity-50" : ""}`}>
                      {sale.payment_method}
                    </span>
                  </td>
                  <td className={`font-bold ${sale.canceled ? "text-red-400 line-through" : "gradient-text"}`}>
                    {currency(sale.total)}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openSaleDetails(sale)}
                        className="btn-outline py-1 px-3 text-xs"
                      >
                        📄 Detalhes
                      </button>
                      {!sale.canceled && (
                        <button
                          onClick={async () => {
                            if (confirm(`Cancelar venda #${sale.id}? O estoque será estornado.`)) {
                              await api.cancelSale(sale.id);
                              loadSales();
                            }
                          }}
                          className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sale detail modal */}
      {selectedSale && (
        <div className="glass-overlay animate-fade-in">
          <div className="card-elevated max-w-lg w-full p-6 space-y-5 animate-scale-in">
            <div className="flex justify-between items-center border-b border-ink-100/60 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink-900 bg-ink-50 px-2 py-0.5 rounded-lg text-sm">
                    #{selectedSale.id}
                  </span>
                  <h3 className="text-lg font-bold text-ink-900">
                    Comprovante de Venda
                  </h3>
                </div>
                <span className="text-xs text-ink-500 mt-1 block">
                  {formatDate(selectedSale.created_at)}
                </span>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-400 hover:text-ink-900 hover:bg-ink-50 transition-all"
              >
                ✕
              </button>
            </div>

            {/* Sale info */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-ink-50/60 p-3 rounded-xl border border-ink-200/30">
                <div className="text-ink-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Cliente</div>
                <div className="font-semibold text-ink-900">
                  {selectedSale.customer_name || "Consumidor Final"}
                </div>
              </div>
              <div className="bg-ink-50/60 p-3 rounded-xl border border-ink-200/30">
                <div className="text-ink-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Pagamento</div>
                <span className={`badge text-[11px] ${getPaymentBadgeClass(selectedSale.payment_method)}`}>
                  {selectedSale.payment_method}
                </span>
              </div>
            </div>

            {/* Items */}
            <div>
              <h4 className="text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-2">
                Itens da Compra
              </h4>
              {loadingItems ? (
                <div className="text-center py-6">
                  <div className="w-6 h-6 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin mx-auto" />
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto border border-ink-100/60 rounded-xl divide-y divide-ink-100/40">
                  {saleItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 flex justify-between items-center text-xs hover:bg-ink-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 text-xs font-bold border border-brand-200/30">
                          {item.quantity}x
                        </div>
                        <div>
                          <div className="font-semibold text-ink-900">
                            {item.product_name}
                          </div>
                          <div className="text-ink-500">
                            {currency(item.unit_price)} un.
                          </div>
                        </div>
                      </div>
                      <div className="font-bold text-ink-900">
                        {currency(item.quantity * item.unit_price)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total */}
            <div className="border-t border-ink-200/60 pt-4 flex justify-between items-center">
              <span className="font-bold text-ink-900 text-sm">TOTAL DA VENDA</span>
              <span className="font-extrabold text-xl gradient-text">
                {currency(selectedSale.total)}
              </span>
            </div>

            <button
              onClick={() => setSelectedSale(null)}
              className="btn-primary w-full py-2.5 text-sm"
            >
              Fechar Comprovante
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
