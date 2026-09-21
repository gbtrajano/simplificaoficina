import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import { api } from "../lib/api";
import type { WorkshopService } from "../types";

const empty = { name: "", description: "", price: 0 };
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Servicos() {
  const [services, setServices] = useState<WorkshopService[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = () => api.listWorkshopServices(search).then(setServices).catch((reason) => setError(String(reason)));
  useEffect(() => { void load(); }, [search]);

  const save = async () => {
    setError("");
    try {
      await api.saveWorkshopService(form, editing ?? undefined);
      setForm(empty);
      setEditing(null);
      load();
    } catch (reason) { setError(String(reason)); }
  };

  const edit = (service: WorkshopService) => {
    setEditing(service.id);
    setForm({ name: service.name, description: service.description, price: service.price });
  };

  const remove = async (id: number) => {
    if (!confirm("Remover este serviço do catálogo?")) return;
    await api.deleteWorkshopService(id);
    load();
  };

  return <div className="page-enter service-catalog-page">
    <div className="section-heading"><div><h2>Serviços e mão de obra</h2><p>Cadastre os serviços com o valor que será usado nos orçamentos</p></div></div>
    <div className="service-catalog-grid">
      <section className="data-panel">
        <div className="toolbar-card"><label className="search-field"><Icon name="search" size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar serviço..."/></label><span>{services.length} serviço{services.length !== 1 && "s"}</span></div>
        {services.length === 0 ? <div className="large-empty"><span><Icon name="tool" size={28}/></span><h3>Nenhum serviço cadastrado</h3><p>Cadastre os serviços mais comuns da sua oficina.</p></div> : <table className="workshop-table"><thead><tr><th>Serviço</th><th>Descrição</th><th>Valor padrão</th><th/></tr></thead><tbody>{services.map((service) => <tr key={service.id}><td><strong>{service.name}</strong></td><td>{service.description || <em>Sem descrição</em>}</td><td><strong>{money(service.price)}</strong></td><td><div className="table-actions"><button className="table-action" onClick={() => edit(service)}>Editar</button><button className="table-action danger" onClick={() => void remove(service.id)}>Excluir</button></div></td></tr>)}</tbody></table>}
      </section>
      <aside className="service-form-card">
        <div className="panel-head"><div><h3>{editing ? "Editar serviço" : "Novo serviço"}</h3><p>Este valor poderá ser incluído na OS com um clique</p></div></div>
        <div className="service-form-body">
          <label>Nome do serviço<input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Troca de óleo"/></label>
          <label>Descrição (opcional)<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="O que está incluído no serviço"/></label>
          <label>Valor da mão de obra<input type="number" min="0" step="0.01" value={form.price || ""} onChange={(event) => setForm({ ...form, price: Number(event.target.value) || 0 })} placeholder="R$ 0,00"/></label>
          {error && <div className="form-error catalog-error">{error}</div>}
          <div className="service-form-actions"><button className="primary-action" onClick={() => void save()}>{editing ? "Salvar serviço" : "Cadastrar serviço"}</button>{editing && <button className="secondary-action" onClick={() => { setEditing(null); setForm(empty); }}>Cancelar</button>}</div>
        </div>
      </aside>
    </div>
  </div>;
}
