import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Customer } from "../types";

const empty: Omit<Customer, "id"> = { name: "", phone: "", document: "", notes: "" };

export default function Clientes() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(empty);

  const load = () => api.listCustomers(search).then(setCustomers);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const submit = async () => {
    if (!form.name.trim()) return;
    await api.createCustomer({
      ...form,
      name: form.name.trim(),
      phone: form.phone?.trim() || undefined,
      document: form.document?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    });
    setForm(empty);
    load();
  };

  return (
    <div className="grid grid-cols-3 gap-6 animate-fade-in">
      <div className="col-span-2">
        <div className="page-header flex items-center justify-between">
          <div>
            <h1>Clientes</h1>
            <p>Gerencie os clientes e o histórico de relacionamento da oficina.</p>
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
                <th>Nome</th>
                <th>Telefone</th>
                <th>CPF/CNPJ</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={3}>
                    <div className="text-center py-12">
                      <div className="text-3xl mb-2">👤</div>
                      <div className="text-ink-500 font-medium">Nenhum cliente cadastrado</div>
                      <div className="text-ink-400 text-xs mt-1">Adicione um cliente usando o formulário ao lado</div>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((c, idx) => (
                  <tr key={c.id} style={{ animationDelay: `${idx * 20}ms` }}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center text-sm border border-brand-200/30 text-brand-600">
                          👤
                        </div>
                        <span className="font-semibold text-ink-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="text-ink-600">{c.phone || "—"}</td>
                    <td className="text-ink-600 font-mono text-xs">{c.document || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form */}
      <div className="card-elevated p-5 h-fit sticky top-6 animate-slide-up">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm shadow-brand">
            ➕
          </div>
          <h2 className="font-bold text-ink-900">Novo Cliente</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Nome *</label>
            <input
              className="input"
              placeholder="Nome completo"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Telefone</label>
            <input
              className="input"
              placeholder="(00) 00000-0000"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">CPF/CNPJ <span className="normal-case font-medium text-ink-300">(opcional)</span></label>
            <input
              className="input"
              placeholder="Pode deixar em branco"
              value={form.document}
              onChange={(e) => setForm({ ...form, document: e.target.value })}
            />
            <p className="text-[10px] text-ink-400 mt-1.5">Solicite somente quando for necessário para nota fiscal ou outro documento.</p>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">Observações</label>
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder="Notas sobre o cliente..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <button className="btn-primary w-full" onClick={submit}>
            Adicionar Cliente
          </button>
        </div>
      </div>
    </div>
  );
}
