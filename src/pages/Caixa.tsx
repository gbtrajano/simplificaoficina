import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { CashRegister, CashMovement, ClosingReport } from "../types";
import { useSession } from "../components/SessionGate";

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

export default function Caixa() {
  const { user } = useSession();
  const [openRegister, setOpenRegister] = useState<CashRegister | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [closingReport, setClosingReport] = useState<ClosingReport | null>(null);

  // Open form
  const [openingAmount, setOpeningAmount] = useState("");
  const [operatorName, setOperatorName] = useState(user?.name || "Operador");

  // Supply/Withdraw form
  const [movementAmount, setMovementAmount] = useState("");
  const [movementDescription, setMovementDescription] = useState("");

  // Close form
  const [closingAmount, setClosingAmount] = useState("");

  const load = async () => {
    try {
      const reg = await api.getOpenRegister();
      setOpenRegister(reg);
      if (reg) {
        const movs = await api.listCashMovements(reg.id);
        setMovements(movs);
      }
    } catch (e) { console.error(e); }
    try {
      const regs = await api.listCashRegisters();
      setRegisters(regs);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, []);

  const handleOpen = async () => {
    const amt = parseFloat(openingAmount.replace(",", ".")) || 0;
    if (!operatorName.trim()) return;
    await api.openCashRegister(amt, operatorName);
    setOpeningAmount("");
    load();
  };

  const handleSupply = async () => {
    if (!openRegister) return;
    const amt = parseFloat(movementAmount.replace(",", ".")) || 0;
    if (amt <= 0) return;
    await api.supplyCash(openRegister.id, amt, movementDescription || "Suprimento");
    setMovementAmount("");
    setMovementDescription("");
    load();
  };

  const handleWithdraw = async () => {
    if (!openRegister) return;
    const amt = parseFloat(movementAmount.replace(",", ".")) || 0;
    if (amt <= 0) return;
    await api.withdrawCash(openRegister.id, amt, movementDescription || "Sangria");
    setMovementAmount("");
    setMovementDescription("");
    load();
  };

  const handleClose = async () => {
    if (!openRegister) return;
    const amt = parseFloat(closingAmount.replace(",", ".")) || 0;
    const report = await api.closeCashRegister(openRegister.id, amt);
    setClosingReport(report);
    setClosingAmount("");
    load();
  };

  const cashInDrawer = openRegister
    ? openRegister.opening_amount
      + movements.filter((m) => m.movement_type === "supply").reduce((s, m) => s + m.amount, 0)
      - movements.filter((m) => m.movement_type === "withdrawal").reduce((s, m) => s + m.amount, 0)
    : 0;

  // === FECHAMENTO EXIBIDO ===
  if (closingReport) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="page-header flex items-center justify-between">
          <div>
            <h1>Relatório de Fechamento</h1>
            <p>Caixa #{closingReport.register.id} — {closingReport.register.operator_name}</p>
          </div>
          <button className="btn-primary" onClick={() => setClosingReport(null)}>
            Fechar Relatório
          </button>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 gap-4">
          <div className="stat-card">
            <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Abertura</div>
            <div className="text-xl font-extrabold text-ink-900 mt-1">{currency(closingReport.register.opening_amount)}</div>
          </div>
          <div className="stat-card">
            <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Total em Dinheiro</div>
            <div className="text-xl font-extrabold gradient-text mt-1">{currency(closingReport.total_sales)}</div>
          </div>
          <div className="stat-card">
            <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Suprimentos</div>
            <div className="text-xl font-extrabold text-blue-600 mt-1">{currency(closingReport.total_supplies)}</div>
          </div>
          <div className="stat-card">
            <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Sangrias</div>
            <div className="text-xl font-extrabold text-red-500 mt-1">{currency(closingReport.total_withdrawals)}</div>
          </div>
        </div>

        {/* Vendas por pagamento */}
        <div className="card-elevated p-5">
          <h2 className="font-bold text-ink-900 mb-3">Vendas por Forma de Pagamento</h2>
          <div className="space-y-2">
            {closingReport.sales_by_payment.map((s) => (
              <div key={s.payment_method} className="flex items-center justify-between p-3 bg-ink-50/60 rounded-xl border border-ink-200/30">
                <div className="flex items-center gap-2">
                  <span className="badge-success text-xs">{s.payment_method}</span>
                  <span className="text-xs text-ink-500">{s.count} {s.count === 1 ? "venda" : "vendas"}</span>
                </div>
                <span className="font-bold text-ink-900">{currency(s.total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Conciliação */}
        <div className={`card-elevated p-5 border-l-4 ${
          closingReport.difference === 0
            ? "border-l-emerald-400 bg-emerald-50/30"
            : closingReport.difference > 0
            ? "border-l-blue-400 bg-blue-50/30"
            : "border-l-red-400 bg-red-50/30"
        }`}>
          <h2 className="font-bold text-ink-900 mb-3">Conciliação</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-500">Valor Esperado:</span><span className="font-semibold">{currency(closingReport.expected_in_drawer)}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Valor Informado:</span><span className="font-semibold">{currency(closingReport.actual_in_drawer)}</span></div>
            <div className="border-t border-ink-200/60 pt-2 flex justify-between">
              <span className="font-bold">Diferença:</span>
              <span className={`font-extrabold text-lg ${closingReport.difference === 0 ? "text-emerald-600" : closingReport.difference > 0 ? "text-blue-600" : "text-red-600"}`}>
                {closingReport.difference >= 0 ? "+" : ""}{currency(closingReport.difference)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === CAIXA ABERTO ===
  if (openRegister) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="page-header flex items-center justify-between">
          <div>
            <h1>Caixa Aberto</h1>
            <p>Caixa #{openRegister.id} — {openRegister.operator_name} — Aberto em {formatDate(openRegister.opened_at)}</p>
          </div>
          <div className="stat-card py-2 px-4">
            <span className="text-xs text-ink-400">Valor no Caixa:</span>
            <span className="ml-2 font-extrabold text-lg gradient-text">{currency(cashInDrawer)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Suprimento / Sangria */}
          <div className="card-elevated p-5 space-y-4">
            <h2 className="font-bold text-ink-900 flex items-center gap-2">
              <span className="text-lg">💵</span> Movimentação
            </h2>
            <div>
              <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Valor (R$)</label>
              <input className="input" type="number" step="0.01" min="0" placeholder="0,00" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Descrição</label>
              <input className="input" placeholder="Ex: Troco para notas grandes" value={movementDescription} onChange={(e) => setMovementDescription(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={handleSupply}>📥 Suprimento</button>
              <button className="btn-outline flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300" onClick={handleWithdraw}>📤 Sangria</button>
            </div>
          </div>

          {/* Fechar Caixa */}
          <div className="card-elevated p-5 space-y-4">
            <h2 className="font-bold text-ink-900 flex items-center gap-2">
              <span className="text-lg">🔒</span> Fechar Caixa
            </h2>
            <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3 text-xs text-amber-700">
              Informe o valor contado fisicamente no caixa para fechar.
            </div>
            <div>
              <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Valor no Caixa (R$)</label>
              <input className="input" type="number" step="0.01" min="0" placeholder="0,00" value={closingAmount} onChange={(e) => setClosingAmount(e.target.value)} />
            </div>
            <button className="btn-primary w-full" onClick={handleClose}>🔒 Fechar e Conciliar</button>
          </div>
        </div>

        {/* Movimentações */}
        <div className="card-elevated p-5">
          <h2 className="font-bold text-ink-900 mb-3">Movimentações do Caixa</h2>
          {movements.length === 0 ? (
            <div className="text-center py-6 text-ink-400 text-sm">Nenhuma movimentação registrada</div>
          ) : (
            <div className="space-y-2">
              {movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-ink-50/60 rounded-xl border border-ink-200/30">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                      m.movement_type === "supply" ? "bg-blue-50 text-blue-600 border border-blue-200/30" : "bg-red-50 text-red-600 border border-red-200/30"
                    }`}>
                      {m.movement_type === "supply" ? "📥" : "📤"}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-ink-900">{m.description}</div>
                      <div className="text-xs text-ink-500">{formatDate(m.created_at)}</div>
                    </div>
                  </div>
                  <span className={`font-bold ${m.movement_type === "supply" ? "text-blue-600" : "text-red-600"}`}>
                    {m.movement_type === "supply" ? "+" : "-"}{currency(m.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // === CAIXA FECHADO — ABRIR NOVO ===
  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <div className="page-header">
        <h1>Abrir Caixa</h1>
        <p>Informe o valor de abertura e o nome do operador.</p>
      </div>

      <div className="card-elevated p-6 space-y-5">
        <div className="text-center py-4">
          <div className="text-5xl mb-3">💰</div>
          <div className="text-ink-500 font-medium">Nenhum caixa aberto no momento</div>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Operador</label>
          <input className="input" placeholder="Nome do operador" value={operatorName} onChange={(e) => setOperatorName(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Valor de Abertura (R$)</label>
          <input className="input" type="number" step="0.01" min="0" placeholder="0,00" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} />
        </div>
        <button className="btn-primary w-full py-3" onClick={handleOpen}>Abrir Caixa</button>
      </div>

      {/* Histórico de caixas */}
      {registers.length > 0 && (
        <div className="card-elevated p-5">
          <h2 className="font-bold text-ink-900 mb-3">Caixas Anteriores</h2>
          <div className="space-y-2">
            {registers.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-ink-50/60 rounded-xl border border-ink-200/30">
                <div>
                  <div className="font-semibold text-sm text-ink-900">Caixa #{r.id} — {r.operator_name}</div>
                  <div className="text-xs text-ink-500">{formatDate(r.opened_at)}</div>
                </div>
                <div className="text-right">
                  <span className={`badge ${r.status === "open" ? "badge-success" : "badge-warning"}`}>
                    {r.status === "open" ? "Aberto" : "Fechado"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
