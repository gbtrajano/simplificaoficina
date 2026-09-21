import { useEffect, useState } from "react";
import { supabaseApi } from "../lib/supabase";

interface Member { id: string; name: string; email: string; role: string; active: boolean; }

export default function Equipe() {
  const [members, setMembers] = useState<Member[]>([]);
  const [maxUsers, setMaxUsers] = useState(0);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const load = async () => {
    try { const data = await supabaseApi.manageStoreUsers("GET"); setMembers(data.members || []); setMaxUsers(data.maxUsers || 0); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  useEffect(() => { void load(); }, []);
  const create = async () => {
    setError("");
    try { await supabaseApi.manageStoreUsers("POST", form); setForm({ name: "", email: "", password: "" }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const toggle = async (member: Member) => {
    try { await supabaseApi.manageStoreUsers("PATCH", { id: member.id, active: !member.active }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const active = members.filter((m) => m.active).length;
  return <div className="space-y-6 animate-fade-in">
    <div className="page-header"><h1>Equipe da oficina</h1><p>{active} de {maxUsers} contas em uso. Cada colaborador pode entrar em qualquer computador.</p></div>
    {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
    <div className="card-elevated p-5 space-y-3"><h2 className="font-bold">Nova subconta</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><input className="input" placeholder="Nome do operador" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input className="input" type="email" placeholder="E-mail do operador" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><input className="input" type="password" placeholder="Senha temporária (mín. 8)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div><button className="btn-primary" onClick={() => void create()}>Criar conta</button></div>
    <div className="card-elevated overflow-hidden"><table className="table-modern"><thead><tr><th>Operador</th><th>E-mail</th><th>Status</th><th className="text-right">Ação</th></tr></thead><tbody>{members.map((m) => <tr key={m.id}><td>{m.name}</td><td>{m.email}</td><td>{m.active ? "Ativa" : "Desativada"}</td><td className="text-right"><button className="text-xs text-brand-600" onClick={() => void toggle(m)}>{m.active ? "Desativar" : "Reativar"}</button></td></tr>)}{members.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-ink-400">Nenhuma subconta criada.</td></tr>}</tbody></table></div>
  </div>;
}
