import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Supplier } from "../types";

export default function Fornecedores() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", company_name: "", document: "", phone: "", email: "", address: "", notes: "" });

  const load = () => api.listSuppliers(search).then(setSuppliers);
  useEffect(() => { load(); }, [search]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    await api.createSupplier(form);
    setForm({ name: "", company_name: "", document: "", phone: "", email: "", address: "", notes: "" });
    setShowForm(false);
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div><h1>Fornecedores</h1><p>Gerencie empresas parceiras e contatos comerciais.</p></div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Novo Fornecedor</button>
      </div>

      <div className="card-elevated p-4 flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm">🔍</span>
          <input className="input pl-9" placeholder="Buscar fornecedor..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {showForm && (
        <div className="card-elevated p-5 animate-slide-up space-y-3">
          <h2 className="font-bold text-ink-900">Novo Fornecedor</h2>
          <div className="grid grid-cols-3 gap-3">
            <input className="input" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Razão Social" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            <input className="input" placeholder="CNPJ/CPF" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
            <input className="input" placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="input" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="input" placeholder="Endereço" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <input className="input" placeholder="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-2">
            <button className="btn-primary" onClick={handleCreate}>Salvar</button>
            <button className="btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="card-elevated overflow-hidden">
        <table className="table-modern">
          <thead><tr><th>Fornecedor</th><th>CNPJ/CPF</th><th>Telefone</th><th>E-mail</th><th className="text-right">Ação</th></tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="font-semibold text-ink-900">{s.name}</div>
                  {s.company_name && <div className="text-xs text-ink-500">{s.company_name}</div>}
                </td>
                <td className="font-mono text-xs">{s.document || "—"}</td>
                <td>{s.phone || "—"}</td>
                <td className="text-xs">{s.email || "—"}</td>
                <td className="text-right">
                  <button onClick={() => { if (confirm("Excluir?")) api.deleteSupplier(s.id).then(load); }} className="text-xs text-red-500 hover:text-red-600">Excluir</button>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-ink-400">Nenhum fornecedor cadastrado</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
