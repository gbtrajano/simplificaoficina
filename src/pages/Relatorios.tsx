import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { DailySummary, AbcProduct, PeriodSummary } from "../types";

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Relatorios() {
  const [summary, setSummary] = useState<DailySummary[]>([]);
  const [top, setTop] = useState<{ name: string; qty: number; total: number }[]>([]);
  const [abc, setAbc] = useState<AbcProduct[]>([]);
  const [period, setPeriod] = useState<PeriodSummary | null>(null);
  const [days, setDays] = useState(7);
  const [activeTab, setActiveTab] = useState<"vendas" | "abc" | "margem" | "dre">("vendas");

  useEffect(() => {
    api.dailySummary(days).then(setSummary);
    api.topProducts(10).then(setTop);
    api.abcCurve(days).then(setAbc);
    api.periodSummary(days).then(setPeriod);
  }, [days]);

  const maxTotal = Math.max(1, ...summary.map((s) => s.total));
  const totalRevenue = summary.reduce((sum, s) => sum + s.total, 0);
  const totalSales = summary.reduce((sum, s) => sum + s.sales_count, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Relatórios</h1>
          <p>Visão geral das vendas, curva ABC e análise de margens.</p>
        </div>
        <select className="input max-w-[160px]" value={days} onChange={(e) => setDays(parseInt(e.target.value))}>
          <option value={7}>Últimos 7 dias</option>
          <option value={15}>Últimos 15 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card group hover:border-brand-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-lg border border-brand-200/30 group-hover:scale-110 transition-transform">💵</div>
            <div>
              <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Receita</div>
              <div className="text-xl font-extrabold gradient-text">{currency(totalRevenue)}</div>
            </div>
          </div>
        </div>
        <div className="stat-card group hover:border-blue-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg border border-blue-200/30 group-hover:scale-110 transition-transform">🧾</div>
            <div>
              <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Vendas</div>
              <div className="text-xl font-extrabold text-blue-600">{totalSales}</div>
            </div>
          </div>
        </div>
        <div className="stat-card group hover:border-emerald-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg border border-emerald-200/30 group-hover:scale-110 transition-transform">📊</div>
            <div>
              <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Ticket Médio</div>
              <div className="text-xl font-extrabold text-emerald-600">
                {currency(totalSales > 0 ? totalRevenue / totalSales : 0)}
              </div>
            </div>
          </div>
        </div>
        <div className="stat-card group hover:border-purple-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-lg border border-purple-200/30 group-hover:scale-110 transition-transform">💰</div>
            <div>
              <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Margem</div>
              <div className="text-xl font-extrabold text-purple-600">
                {period ? `${period.margin_percent.toFixed(1)}%` : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Period summary */}
      {period && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card-elevated p-4">
            <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Lucro Líquido</div>
            <div className="text-lg font-extrabold text-emerald-600 mt-1">{currency(period.profit)}</div>
          </div>
          <div className="card-elevated p-4">
            <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Custo Total</div>
            <div className="text-lg font-extrabold text-red-500 mt-1">{currency(period.total_cost)}</div>
          </div>
          <div className="card-elevated p-4">
            <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Lucro por Venda</div>
            <div className="text-lg font-extrabold text-blue-600 mt-1">
              {currency(period.sales_count > 0 ? period.profit / period.sales_count : 0)}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-ink-50/60 rounded-xl p-1 border border-ink-200/30">
        {[
          { key: "vendas", label: "📈 Vendas" },
          { key: "abc", label: "🅰️ Curva ABC" },
          { key: "margem", label: "💰 Margens" },
          { key: "dre", label: "📊 DRE" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.key
                ? "bg-white shadow-soft text-ink-900"
                : "text-ink-500 hover:text-ink-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Vendas Tab */}
      {activeTab === "vendas" && (
        <>
          <div className="card-elevated p-6">
            <h2 className="font-bold text-ink-900 mb-5">Vendas por Dia</h2>
            <div className="flex items-end gap-3 h-48">
              {summary.map((s, idx) => (
                <div key={s.date} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="text-[10px] font-semibold text-ink-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    {currency(s.total)}
                  </div>
                  <div className="w-full relative">
                    <div
                      className="w-full bg-gradient-to-t from-brand-500 to-brand-400 rounded-xl transition-all duration-500 ease-out group-hover:from-brand-600 group-hover:to-brand-500"
                      style={{ height: `${Math.max(8, (s.total / maxTotal) * 140)}px` }}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] text-ink-500 font-medium">{s.date.slice(5)}</span>
                    <span className="text-[10px] text-ink-400">{s.sales_count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-elevated p-6">
            <h2 className="font-bold text-ink-900 mb-5">Top Produtos</h2>
            <div className="space-y-3">
              {top.map((t, idx) => {
                const maxQty = Math.max(1, ...top.map((x) => x.qty));
                const pct = (t.qty / maxQty) * 100;
                return (
                  <div key={t.name} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 border border-brand-200/30">
                          {idx + 1}
                        </div>
                        <span className="font-semibold text-sm text-ink-900">{t.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-ink-500 font-medium">{t.qty} un.</span>
                        <span className="font-bold text-ink-900">{currency(t.total)}</span>
                      </div>
                    </div>
                    <div className="ml-10 h-2 bg-ink-100/60 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-brand-400 to-brand-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ABC Tab */}
      {activeTab === "abc" && (
        <div className="card-elevated p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-ink-900">Curva ABC — Análise de Receita</h2>
            <div className="flex gap-2 text-xs">
              <span className="badge bg-red-50 text-red-700 border border-red-200/50">A = 80%</span>
              <span className="badge bg-amber-50 text-amber-700 border border-amber-200/50">B = 15%</span>
              <span className="badge bg-ink-50 text-ink-700 border border-ink-200/50">C = 5%</span>
            </div>
          </div>
          {abc.length === 0 ? (
            <div className="text-center py-12 text-ink-400">Nenhum dado disponível</div>
          ) : (
            <div className="space-y-2">
              {abc.map((p, idx) => {
                const colors = p.classification === "A" ? "bg-red-50 border-red-200/30 text-red-700"
                  : p.classification === "B" ? "bg-amber-50 border-amber-200/30 text-amber-700"
                  : "bg-ink-50 border-ink-200/30 text-ink-600";
                return (
                  <div key={p.name} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${colors} ${idx === 0 ? "ring-1 ring-red-200/50" : ""}`}>
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${colors}`}>
                      {p.classification}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{p.name}</div>
                      <div className="text-[10px] opacity-70">
                        {p.qty} un. · {p.percentage.toFixed(1)}% · Acum: {p.accumulated.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">{currency(p.total)}</div>
                      <div className="text-[10px] opacity-70">Margem: {p.margin.toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Margem Tab */}
      {activeTab === "margem" && (
        <div className="card-elevated p-6">
          <h2 className="font-bold text-ink-900 mb-5">Margem de Lucro por Produto</h2>
          {abc.length === 0 ? (
            <div className="text-center py-12 text-ink-400">Nenhum dado disponível</div>
          ) : (
            <div className="space-y-3">
              {abc.sort((a, b) => b.margin - a.margin).map((p, idx) => (
                <div key={p.name} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 border border-brand-200/30">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-ink-900 truncate">{p.name}</span>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-ink-500">{currency(p.total)} receita</span>
                        <span className="text-ink-500">{currency(p.cost_total)} custo</span>
                        <span className={`font-bold ${p.margin >= 30 ? "text-emerald-600" : p.margin >= 15 ? "text-amber-600" : "text-red-600"}`}>
                          {p.margin.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-ink-100/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          p.margin >= 30 ? "bg-emerald-500" : p.margin >= 15 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(100, p.margin)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DRE Tab */}
      {activeTab === "dre" && (
        <div className="space-y-5">
          <div className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-lg border border-purple-200/30">📊</div>
              <div>
                <h2 className="font-bold text-ink-900">DRE — Demonstrativo do Resultado do Exercício</h2>
                <p className="text-xs text-ink-500">Visão consolidada da performance financeira do período</p>
              </div>
            </div>

            {period ? (
              <div className="space-y-4">
                {/* Receita Bruta */}
                <div className="bg-brand-50/60 rounded-xl p-4 border border-brand-200/30">
                  <div className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">(+) Receita Bruta de Vendas</div>
                  <div className="text-xl font-extrabold gradient-text">{currency(period.total_sales)}</div>
                  <div className="text-[10px] text-ink-500 mt-1">{period.sales_count} vendas no período</div>
                </div>

                {/* (-) Custo dos Produtos */}
                <div className="bg-red-50/60 rounded-xl p-4 border border-red-200/30">
                  <div className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">(-) Custo dos Produtos Vendidos</div>
                  <div className="text-xl font-extrabold text-red-600">({currency(period.total_cost)})</div>
                </div>

                {/* (=) Lucro Bruto */}
                <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-200/30">
                  <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">(=) Lucro Bruto</div>
                  <div className="text-xl font-extrabold text-amber-700">{currency(period.total_sales - period.total_cost)}</div>
                </div>

                {/* Margem */}
                <div className="bg-emerald-50/60 rounded-xl p-4 border border-emerald-200/30">
                  <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">(=) Lucro Líquido</div>
                  <div className="text-xl font-extrabold text-emerald-700">{currency(period.profit)}</div>
                  <div className="text-[10px] text-ink-500 mt-1">Margem de {period.margin_percent.toFixed(1)}% · Ticket médio {currency(period.avg_ticket)}</div>
                </div>

                {/* Resumo visual */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-ink-50/60 rounded-xl border border-ink-200/30">
                    <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Receita</div>
                    <div className="font-bold text-ink-900 text-sm mt-1">100%</div>
                  </div>
                  <div className="text-center p-3 bg-ink-50/60 rounded-xl border border-ink-200/30">
                    <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Custo</div>
                    <div className="font-bold text-red-600 text-sm mt-1">{period.total_sales > 0 ? ((period.total_cost / period.total_sales) * 100).toFixed(1) : 0}%</div>
                  </div>
                  <div className="text-center p-3 bg-ink-50/60 rounded-xl border border-ink-200/30">
                    <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Lucro</div>
                    <div className="font-bold text-emerald-600 text-sm mt-1">{period.margin_percent.toFixed(1)}%</div>
                  </div>
                </div>

                {/* Barra visual */}
                <div className="h-6 rounded-full overflow-hidden flex bg-ink-100/60">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700"
                    style={{ width: `${Math.max(2, period.margin_percent)}%` }}
                  />
                  <div
                    className="h-full bg-gradient-to-r from-red-400 to-red-500 transition-all duration-700"
                    style={{ width: `${period.total_sales > 0 ? (period.total_cost / period.total_sales) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-ink-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Lucro</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Custo</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-ink-400">Nenhum dado disponível para o DRE</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
