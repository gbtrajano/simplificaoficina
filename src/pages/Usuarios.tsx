import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { User, AuditLog } from "../types";

const ROLES = [
  { value: "operator", label: "Operador de Caixa", icon: "🛒", color: "badge-brand" },
  { value: "supervisor", label: "Supervisor", icon: "👔", color: "badge-success" },
  { value: "manager", label: "Gerente", icon: "👔", color: "badge-warning" },
  { value: "admin", label: "Responsável da loja", icon: "🔑", color: "badge-danger" },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  operator: ["Realizar vendas", "Consultar produtos"],
  supervisor: ["Realizar vendas", "Cancelar vendas", "Sangria/Suprimento", "Consultar relatórios"],
  manager: ["Realizar vendas", "Cancelar vendas", "Sangria/Suprimento", "Gerenciar preços", "Gerenciar promoções", "Relatórios completos"],
  admin: ["Administrar esta loja", "Cadastrar operadores", "Configurar o PDV"],
};

export default function Usuarios() {
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [tab, setTab] = useState<"users" | "logs">("users");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", login: "", password: "", role: "operator" });

  const load = async () => {
    const [u, l] = await Promise.all([api.listUsers(), api.listAuditLogs(100)]);
    setUsers(u); setLogs(l);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.login.trim()) return;
    setError("");
    try {
      await api.createUser(form.name, form.login, form.password, form.role);
      setForm({ name: "", login: "", password: "", role: "operator" });
      setShowForm(false);
      await load();
    } catch (e) { setError(String(e)); }
  };

  const deactivate = async (id: number) => {
    if (!confirm("Desativar este usuário?")) return;
    setError("");
    try { await api.deleteUser(id); await load(); } catch (e) { setError(String(e)); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="page-header flex items-center justify-between">
        <div><h1>Usuários e Permissões</h1><p>Gerencie operadores, níveis de acesso e histórico de ações.</p></div>
        {tab === "users" && <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Novo Usuário</button>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-ink-50/60 rounded-xl p-1 border border-ink-200/30">
        <button onClick={() => setTab("users")} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "users" ? "bg-white shadow-soft text-ink-900" : "text-ink-500"}`}>
          👥 Usuários
        </button>
        <button onClick={() => setTab("logs")} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "logs" ? "bg-white shadow-soft text-ink-900" : "text-ink-500"}`}>
          📋 Logs de Auditoria
        </button>
      </div>

      {/* Users Tab */}
      {tab === "users" && (
        <>
          {showForm && (
            <div className="card-elevated p-5 animate-slide-up space-y-3">
              <h2 className="font-bold text-ink-900">Novo Usuário</h2>
              <div className="grid grid-cols-4 gap-3">
                <input className="input" placeholder="Nome completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <input className="input" placeholder="Login" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
                <input className="input" type="password" placeholder="Senha" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary" onClick={handleCreate}>Salvar</button>
                <button className="btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Permissions matrix */}
          <div className="card-elevated p-5">
            <h2 className="font-bold text-ink-900 mb-3">Matriz de Permissões</h2>
            <div className="grid grid-cols-4 gap-3">
              {ROLES.map((r) => (
                <div key={r.value} className="p-3 bg-ink-50/60 rounded-xl border border-ink-200/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span>{r.icon}</span>
                    <span className="font-semibold text-sm text-ink-900">{r.label}</span>
                  </div>
                  <ul className="space-y-1">
                    {ROLE_PERMISSIONS[r.value].map((p) => (
                      <li key={p} className="text-[10px] text-ink-500 flex items-center gap-1">
                        <span className="text-emerald-500">✓</span> {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="card-elevated overflow-hidden">
            <table className="table-modern">
              <thead><tr><th>Usuário</th><th>Login</th><th>Perfil</th><th>Cadastro</th><th className="text-right">Ação</th></tr></thead>
              <tbody>
                {users.map((u) => {
                  const roleInfo = ROLES.find((r) => r.value === u.role) || ROLES[0];
                  return (
                    <tr key={u.id}>
                      <td className="font-medium">{u.name}</td>
                      <td className="font-mono text-xs">{u.login}</td>
                      <td><span className={roleInfo.color}>{roleInfo.label}</span></td>
                      <td className="text-xs text-ink-500">{u.created_at.slice(0, 10)}</td>
                      <td className="text-right">
                        <button onClick={() => deactivate(u.id)} className="text-xs text-red-500 hover:text-red-600">Desativar</button>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-ink-400">Nenhum usuário cadastrado</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Logs Tab */}
      {tab === "logs" && (
        <div className="card-elevated overflow-hidden">
          <table className="table-modern">
            <thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Detalhes</th><th>Terminal</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="text-xs text-ink-500">{l.created_at.slice(0, 19).replace("T", " ")}</td>
                  <td className="font-medium">{l.user_name}</td>
                  <td><span className="badge-brand text-[10px]">{l.action}</span></td>
                  <td className="text-xs text-ink-500 max-w-[200px] truncate">{l.details || "—"}</td>
                  <td className="text-xs text-ink-400">{l.terminal || "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-ink-400">Nenhum log registrado</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
