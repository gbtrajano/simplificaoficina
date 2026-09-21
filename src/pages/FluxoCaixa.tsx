import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { CashFlowEntry } from "../types";

const currency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function FluxoCaixa() {
  const [entries, setEntries] = useState<CashFlowEntry[]>([]);
  const [days, setDays] = useState(30);

  useEffect(() => { api.cashFlow(days).then(setEntries); }, [days]);

  const totalInflow = entries.reduce((s, e) => s + e.inflow, 0);
  const totalOutflow = entries.reduce((s, e) => s + e.outflow, 0);
  const finalBalance = entries.length > 0 ? entries[entries.length - 1].balance : 0;
  const maxBalance = Math.max(1, ...entries.map((e) => Math.abs(e.balance)));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div><h1>Fluxo de Caixa</h1><p>Visão integrada do saldo e movimentações financeiras.</p></div>
        <select className="input max-w-[160px]" value={days} onChange={(e) => setDays(parseInt(e.target.value))}>
          <option value={7}>Últimos 7 dias</option>
          <option value={15}>Últimos 15 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card border-l-4 border-l-emerald-400">
          <div className="text-xs font-semibold text-emerald-500 uppercase">Entradas</div>
          <div className="text-xl font-extrabold text-emerald-600 mt-1">{currency(totalInflow)}</div>
        </div>
        <div className="stat-card border-l-4 border-l-red-400">
          <div className="text-xs font-semibold text-red-500 uppercase">Saídas</div>
          <div className="text-xl font-extrabold text-red-500 mt-1">{currency(totalOutflow)}</div>
        </div>
        <div className={`stat-card border-l-4 ${finalBalance >= 0 ? "border-l-blue-400" : "border-l-red-400"}`}>
          <div className="text-xs font-semibold text-ink-400 uppercase">Saldo Final</div>
          <div className={`text-xl font-extrabold mt-1 ${finalBalance >= 0 ? "gradient-text" : "text-red-600"}`}>{currency(finalBalance)}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="card-elevated p-6">
        <h2 className="font-bold text-ink-900 mb-5">Evolução do Saldo</h2>
        {entries.length === 0 ? (
          <div className="text-center py-12 text-ink-400">Nenhum dado disponível</div>
        ) : (
          <div className="space-y-1">
            {entries.map((e, idx) => (
              <div key={e.date} className="flex items-center gap-3 py-2 border-b border-ink-100/30 last:border-0">
                <div className="w-20 text-xs text-ink-500 font-mono">{e.date.slice(5)}</div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="h-3 bg-emerald-400/60 rounded-l" style={{ width: `${(e.inflow / maxBalance) * 200}px`, minWidth: e.inflow > 0 ? "4px" : "0" }} title={`Entrada: ${currency(e.inflow)}`} />
                  <div className="h-3 bg-red-400/60 rounded-r" style={{ width: `${(e.outflow / maxBalance) * 200}px`, minWidth: e.outflow > 0 ? "4px" : "0" }} title={`Saída: ${currency(e.outflow)}`} />
                </div>
                <div className="w-24 text-right">
                  <span className={`font-bold text-xs ${e.balance >= 0 ? "text-ink-900" : "text-red-600"}`}>
                    {currency(e.balance)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details table */}
      <div className="card-elevated overflow-hidden">
        <table className="table-modern">
          <thead><tr><th>Data</th><th>Entradas</th><th>Saídas</th><th>Saldo</th></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.date}>
                <td className="font-mono text-xs">{e.date}</td>
                <td className="text-emerald-600 font-semibold">{e.inflow > 0 ? `+${currency(e.inflow)}` : "—"}</td>
                <td className="text-red-500 font-semibold">{e.outflow > 0 ? `-${currency(e.outflow)}` : "—"}</td>
                <td className={`font-bold ${e.balance >= 0 ? "" : "text-red-600"}`}>{currency(e.balance)}</td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-ink-400">Sem dados</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
