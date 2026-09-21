import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { openUrl } from "@tauri-apps/plugin-opener";
import Icon from "../components/Icon";
import { api } from "../lib/api";
import type { Customer, Product, ServiceOrder, Vehicle, WorkshopService } from "../types";

const labels: Record<string, string> = { draft: "Orçamento", approved: "Aprovada", in_progress: "Em execução", waiting_parts: "Aguardando peça", ready: "Pronta", delivered: "Entregue", canceled: "Cancelada" };
const empty = { vehicle_id: 0, customer_id: null as number | null, status: "draft", priority: "normal", complaint: "", diagnosis: "", services: "", parts: "", labor_total: 0, parts_total: 0, discount: 0, promised_at: null as string | null, mechanic: "", payment_method: "" };
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const appendLine = (current: string, line: string) => [current.trim(), line].filter(Boolean).join("\n");
const whatsappPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
};

export default function OrdensServico() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<ServiceOrder[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalog, setCatalog] = useState<WorkshopService[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(empty);
  const [edit, setEdit] = useState<number | undefined>();
  const [selectedService, setSelectedService] = useState("");
  const [selectedPart, setSelectedPart] = useState("");
  const [partQuantity, setPartQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const modal = params.has("nova") || params.has("editar");

  const load = () => api.listServiceOrders(filter, search).then(setItems).catch((reason) => setError(String(reason)));
  useEffect(() => {
    void load();
    if (modal) return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [filter, search, modal]);
  useEffect(() => {
    void Promise.all([api.listVehicles(""), api.listProducts(""), api.listWorkshopServices(""), api.listCustomers("")])
      .then(([loadedVehicles, loadedProducts, loadedCatalog, loadedCustomers]) => {
        setVehicles(loadedVehicles); setProducts(loadedProducts); setCatalog(loadedCatalog); setCustomers(loadedCustomers);
      }).catch(console.error);
  }, []);
  useEffect(() => {
    const id = Number(params.get("editar"));
    const order = items.find((item) => item.id === id);
    if (order) {
      setEdit(id);
      setForm({ vehicle_id: order.vehicle_id, customer_id: order.customer_id, status: order.status, priority: order.priority, complaint: order.complaint, diagnosis: order.diagnosis, services: order.services, parts: order.parts, labor_total: order.labor_total, parts_total: order.parts_total, discount: order.discount, promised_at: order.promised_at, mechanic: order.mechanic, payment_method: order.payment_method });
    } else if (params.has("nova")) {
      setEdit(undefined); setForm(empty);
    }
  }, [params, items]);

  const total = useMemo(() => Math.max(0, form.labor_total + form.parts_total - form.discount), [form]);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === form.vehicle_id);
  const customer = customers.find((item) => item.id === form.customer_id);

  const close = () => { setParams({}); setError(""); setSelectedService(""); setSelectedPart(""); setPartQuantity(1); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.vehicle_id) { setError("Selecione um veículo."); return; }
    setBusy(true); setError("");
    try { await api.saveServiceOrder(form, edit); close(); load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const changeStatus = async (id: number, status: string) => { await api.updateServiceOrderStatus(id, status); load(); };
  const addService = () => {
    const service = catalog.find((item) => item.id === Number(selectedService));
    if (!service) return;
    setForm({ ...form, services: appendLine(form.services, `${service.name} — ${money(service.price)}`), labor_total: form.labor_total + service.price });
    setSelectedService("");
  };
  const addPart = () => {
    const part = products.find((item) => item.id === Number(selectedPart));
    if (!part || partQuantity <= 0) return;
    if (partQuantity > part.stock) { setError(`Estoque disponível para ${part.name}: ${part.stock}.`); return; }
    const value = part.price * partQuantity;
    setForm({ ...form, parts: appendLine(form.parts, `${partQuantity}x ${part.name} — ${money(value)}`), parts_total: form.parts_total + value });
    setSelectedPart(""); setPartQuantity(1); setError("");
  };
  const sendQuote = async () => {
    if (!customer?.phone) { setError("Cadastre um telefone no cliente vinculado a este veículo para enviar o orçamento."); return; }
    const phone = whatsappPhone(customer.phone);
    if (phone.length < 12) { setError("O telefone do cliente não parece válido para WhatsApp."); return; }
    const vehicle = selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model} (${selectedVehicle.plate})` : "veículo";
    const message = [
      `Olá, ${customer.name}!`,
      "",
      `Segue o orçamento para o veículo ${vehicle}:`,
      form.services ? `\n*Mão de obra*\n${form.services}` : "",
      form.parts ? `\n*Peças e materiais*\n${form.parts}` : "",
      `\nMão de obra: ${money(form.labor_total)}`,
      `Peças: ${money(form.parts_total)}`,
      form.discount ? `Desconto: -${money(form.discount)}` : "",
      `*Total do orçamento: ${money(total)}*`,
      "",
      "Qualquer dúvida, estamos à disposição.",
    ].filter(Boolean).join("\n");
    await openUrl(`https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`);
  };

  return <div className="page-enter">
    <div className="section-heading"><div><h2>Ordens de serviço</h2><p>Controle cada etapa do atendimento, do orçamento à entrega</p></div><button className="primary-action" onClick={() => setParams({ nova: "1" })}><Icon name="plus" size={18}/>Nova ordem</button></div>
    <div className="filter-tabs">{[["", "Todas"], ["draft", "Orçamentos"], ["in_progress", "Em execução"], ["waiting_parts", "Aguardando peças"], ["ready", "Prontas"], ["delivered", "Entregues"]].map(([value, label]) => <button className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{label}</button>)}</div>
    <div className="toolbar-card"><label className="search-field"><Icon name="search" size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por OS, placa, veículo ou cliente..."/></label><span>{items.length} resultado{items.length !== 1 && "s"}</span></div>
    <div className="data-panel">{items.length === 0 ? <div className="large-empty"><span><Icon name="clipboard" size={30}/></span><h3>Nenhuma ordem encontrada</h3><p>Crie uma ordem para registrar o diagnóstico e os serviços do veículo.</p><button className="primary-action" onClick={() => setParams({ nova: "1" })}><Icon name="plus"/>Criar ordem</button></div> : <table className="workshop-table"><thead><tr><th>OS / veículo</th><th>Cliente</th><th>Status</th><th>Responsável</th><th>Previsão</th><th>Total</th><th/></tr></thead><tbody>{items.map((order) => <tr key={order.id}><td><div className="table-entity"><span><Icon name="car" size={18}/></span><div><strong>OS #{String(order.id).padStart(4, "0")} · {order.vehicle_name}</strong><small><b className="plate mini">{order.plate}</b> {order.complaint || "Sem relato"}</small></div></div></td><td>{order.customer_name || "—"}</td><td><select className={`inline-status ${order.status}`} value={order.status} onChange={(event) => void changeStatus(order.id, event.target.value)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td>{order.mechanic || "Não atribuído"}</td><td>{order.promised_at ? new Date(order.promised_at).toLocaleDateString("pt-BR") : "—"}</td><td><strong>{money(order.total)}</strong></td><td><button className="table-action" onClick={() => setParams({ editar: String(order.id) })}>Abrir</button></td></tr>)}</tbody></table>}</div>
    {modal && <div className="modal-backdrop"><form className="workshop-modal wide" onSubmit={submit}>
      <div className="modal-head"><div><h3>{edit ? `Ordem #${String(edit).padStart(4, "0")}` : "Nova ordem de serviço"}</h3><p>Monte o orçamento com serviços e peças do estoque</p></div><button type="button" onClick={close}><Icon name="x"/></button></div>
      <div className="form-grid three">
        <label className="span2">Veículo<select required value={form.vehicle_id || ""} onChange={(event) => { const id = Number(event.target.value); const vehicle = vehicles.find((item) => item.id === id); setForm({ ...form, vehicle_id: id, customer_id: vehicle?.customer_id ?? null }); }}><option value="">Selecione...</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} — {vehicle.brand} {vehicle.model}</option>)}</select></label>
        <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Prioridade<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label>
        <label>Mecânico responsável<input value={form.mechanic} onChange={(event) => setForm({ ...form, mechanic: event.target.value })} placeholder="Nome do responsável"/></label>
        <label>Previsão de entrega<input type="datetime-local" value={form.promised_at?.slice(0, 16) || ""} onChange={(event) => setForm({ ...form, promised_at: event.target.value || null })}/></label>
        <label className="full">Relato do cliente<textarea required rows={2} value={form.complaint} onChange={(event) => setForm({ ...form, complaint: event.target.value })} placeholder="Descreva o problema informado..."/></label>
        <label className="full">Diagnóstico técnico<textarea rows={2} value={form.diagnosis} onChange={(event) => setForm({ ...form, diagnosis: event.target.value })} placeholder="Resultado da avaliação mecânica..."/></label>
      </div>
      <div className="quote-composer">
        <div className="quote-composer-head"><div><h4>Composição do orçamento</h4><p>Adicione serviços cadastrados e peças disponíveis no estoque</p></div><button type="button" className="whatsapp-action" onClick={() => void sendQuote()}>Gerar orçamento no WhatsApp</button></div>
        <div className="quote-picker-grid">
          <div><label>Serviço / mão de obra</label><div className="quote-picker"><select value={selectedService} onChange={(event) => setSelectedService(event.target.value)}><option value="">Selecionar serviço...</option>{catalog.map((service) => <option key={service.id} value={service.id}>{service.name} — {money(service.price)}</option>)}</select><button type="button" onClick={addService} disabled={!selectedService}>Adicionar</button></div></div>
          <div><label>Peça do estoque</label><div className="quote-picker part-picker"><select value={selectedPart} onChange={(event) => setSelectedPart(event.target.value)}><option value="">Selecionar peça...</option>{products.filter((product) => product.active && product.stock > 0).map((product) => <option key={product.id} value={product.id}>{product.name} · {product.stock} em estoque · {money(product.price)}</option>)}</select><input aria-label="Quantidade" type="number" min="1" value={partQuantity} onChange={(event) => setPartQuantity(Number(event.target.value) || 1)}/><button type="button" onClick={addPart} disabled={!selectedPart}>Adicionar</button></div></div>
        </div>
      </div>
      <div className="form-grid three quote-fields">
        <label className="span2">Serviços / mão de obra<textarea rows={3} value={form.services} onChange={(event) => setForm({ ...form, services: event.target.value })} placeholder="Um serviço por linha"/></label>
        <label>Valor da mão de obra<input type="number" step="0.01" min="0" value={form.labor_total} onChange={(event) => setForm({ ...form, labor_total: Number(event.target.value) })}/></label>
        <label className="span2">Peças e materiais<textarea rows={3} value={form.parts} onChange={(event) => setForm({ ...form, parts: event.target.value })} placeholder="Peças aplicadas no serviço"/></label>
        <label>Valor das peças<input type="number" step="0.01" min="0" value={form.parts_total} onChange={(event) => setForm({ ...form, parts_total: Number(event.target.value) })}/></label>
        <label>Desconto<input type="number" step="0.01" min="0" value={form.discount} onChange={(event) => setForm({ ...form, discount: Number(event.target.value) })}/></label>
        <label>Forma de pagamento<select value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value })}><option value="">A definir</option><option>PIX</option><option>Dinheiro</option><option>Cartão de débito</option><option>Cartão de crédito</option></select></label>
        <div className="order-total"><span>Total do orçamento</span><strong>{money(total)}</strong>{customer?.phone ? <small>WhatsApp: {customer.phone}</small> : <small>Cadastre o telefone do cliente para enviar</small>}</div>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary-action" onClick={close}>Cancelar</button><button disabled={busy} className="primary-action">{busy ? "Salvando..." : "Salvar ordem"}</button></div>
    </form></div>}
  </div>;
}
