import { useEffect, useMemo, useState } from "react";
import Icon from "../components/Icon";
import { api } from "../lib/api";
import type { Customer, Product, StoreSettings, WorkshopService } from "../types";

type BudgetItem = { id: string; description: string; quantity: number; unitPrice: number };

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const newItem = (): BudgetItem => ({ id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0 });

export default function Orcamentos() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<WorkshopService[]>([]);
  const [store, setStore] = useState<StoreSettings | null>(null);
  const [customerId, setCustomerId] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [validity, setValidity] = useState("7 dias");
  const [payment, setPayment] = useState("A combinar");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState<BudgetItem[]>([newItem()]);
  const [catalogItem, setCatalogItem] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([api.listCustomers(""), api.listProducts(""), api.listWorkshopServices(""), api.getStoreSettings()])
      .then(([loadedCustomers, loadedProducts, loadedServices, loadedStore]) => {
        setCustomers(loadedCustomers); setProducts(loadedProducts); setServices(loadedServices); setStore(loadedStore);
      })
      .catch((reason) => setError(`Não foi possível carregar todos os cadastros: ${String(reason)}`));
  }, []);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0), [items]);
  const total = Math.max(0, subtotal - discount);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);

  const message = useMemo(() => {
    const client = customerName.trim() || selectedCustomer?.name || "cliente";
    const company = store?.name?.trim() || "nossa oficina";
    const itemLines = items.filter((item) => item.description.trim()).map((item, index) =>
      `${index + 1}. ${item.description.trim()}\n   ${item.quantity}x ${money(item.unitPrice)} = *${money(item.quantity * item.unitPrice)}*`
    );
    return [
      `Olá, ${client}! Tudo bem?`, "",
      `Segue o orçamento preparado pela *${company}*${vehicle.trim() ? ` para o veículo *${vehicle.trim()}*` : ""}:`, "",
      itemLines.length ? "*Itens do orçamento*" : "*Itens do orçamento ainda não informados*", ...itemLines, "",
      `Subtotal: ${money(subtotal)}`, discount > 0 ? `Desconto: -${money(discount)}` : "", `*Total: ${money(total)}*`, "",
      `Forma de pagamento: ${payment}`, `Validade do orçamento: ${validity}`,
      notes.trim() ? `Observações: ${notes.trim()}` : "", "",
      "Ficamos à disposição para tirar qualquer dúvida. Podemos confirmar o serviço?",
    ].filter(Boolean).join("\n");
  }, [customerName, selectedCustomer, store, vehicle, items, subtotal, discount, total, payment, validity, notes]);

  const updateItem = (id: string, changes: Partial<BudgetItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
    setCopied(false);
  };

  const addCatalogItem = () => {
    if (!catalogItem) return;
    const [kind, rawId] = catalogItem.split(":");
    const id = Number(rawId);
    const source = kind === "service" ? services.find((item) => item.id === id) : products.find((item) => item.id === id);
    if (!source) return;
    const item = { id: crypto.randomUUID(), description: source.name, quantity: 1, unitPrice: source.price };
    setItems((current) => current.length === 1 && !current[0].description ? [item] : [...current, item]);
    setCatalogItem(""); setCopied(false);
  };

  const copyMessage = async () => {
    if (!items.some((item) => item.description.trim())) { setError("Adicione pelo menos um item ao orçamento antes de copiar."); return; }
    setError("");
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione o texto da prévia e copie manualmente.");
    }
  };

  const clearForm = () => {
    setCustomerId(0); setCustomerName(""); setVehicle(""); setValidity("7 dias"); setPayment("A combinar");
    setNotes(""); setDiscount(0); setItems([newItem()]); setCatalogItem(""); setCopied(false); setError("");
  };

  return <div className="page-enter budget-page">
    <div className="section-heading">
      <div><h2>Criar orçamento</h2><p>Monte uma proposta e copie a mensagem pronta para enviar pelo WhatsApp</p></div>
      <button className="secondary-action" onClick={clearForm}>Limpar orçamento</button>
    </div>

    <div className="budget-layout">
      <section className="budget-editor">
        <div className="budget-card">
          <div className="budget-card-head"><span>1</span><div><h3>Cliente e veículo</h3><p>Identifique para quem será enviado o orçamento</p></div></div>
          <div className="budget-fields two-columns">
            <label>Cliente cadastrado<select value={customerId} onChange={(event) => { setCustomerId(Number(event.target.value)); setCustomerName(""); }}><option value={0}>Selecionar cliente...</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select></label>
            <label>Ou informe o nome<input disabled={customerId > 0} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Nome do cliente"/></label>
            <label className="full">Veículo<input value={vehicle} onChange={(event) => setVehicle(event.target.value)} placeholder="Ex.: Honda Civic 2020 · ABC-1D23"/></label>
          </div>
        </div>

        <div className="budget-card">
          <div className="budget-card-head"><span>2</span><div><h3>Itens do orçamento</h3><p>Use o catálogo ou adicione itens manualmente</p></div></div>
          <div className="budget-catalog-picker">
            <select value={catalogItem} onChange={(event) => setCatalogItem(event.target.value)}>
              <option value="">Selecionar serviço ou peça...</option>
              {services.length > 0 && <optgroup label="Serviços">{services.map((service) => <option key={`service-${service.id}`} value={`service:${service.id}`}>{service.name} · {money(service.price)}</option>)}</optgroup>}
              {products.some((product) => product.active) && <optgroup label="Peças e produtos">{products.filter((product) => product.active).map((product) => <option key={`product-${product.id}`} value={`product:${product.id}`}>{product.name} · {money(product.price)}</option>)}</optgroup>}
            </select>
            <button type="button" onClick={addCatalogItem} disabled={!catalogItem}>Adicionar do catálogo</button>
          </div>
          <div className="budget-items">
            <div className="budget-item-labels"><span>Descrição</span><span>Qtd.</span><span>Valor unitário</span><span>Total</span><i/></div>
            {items.map((item) => <div className="budget-item-row" key={item.id}>
              <input aria-label="Descrição do item" value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} placeholder="Serviço ou peça"/>
              <input aria-label="Quantidade" type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Math.max(0, Number(event.target.value)) })}/>
              <input aria-label="Valor unitário" type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: Math.max(0, Number(event.target.value)) })}/>
              <strong>{money(item.quantity * item.unitPrice)}</strong>
              <button aria-label="Remover item" type="button" onClick={() => setItems((current) => current.length === 1 ? [newItem()] : current.filter((currentItem) => currentItem.id !== item.id))}><Icon name="x" size={15}/></button>
            </div>)}
          </div>
          <button className="budget-add-line" type="button" onClick={() => setItems((current) => [...current, newItem()])}><Icon name="plus" size={15}/>Adicionar item manualmente</button>
          <div className="budget-totals"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><label>Desconto<input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(Math.max(0, Number(event.target.value)))}/></label><div className="grand-total"><span>Total do orçamento</span><strong>{money(total)}</strong></div></div>
        </div>

        <div className="budget-card">
          <div className="budget-card-head"><span>3</span><div><h3>Condições</h3><p>Complete as informações finais da proposta</p></div></div>
          <div className="budget-fields two-columns">
            <label>Forma de pagamento<input value={payment} onChange={(event) => setPayment(event.target.value)} placeholder="Ex.: PIX ou cartão"/></label>
            <label>Validade<input value={validity} onChange={(event) => setValidity(event.target.value)} placeholder="Ex.: 7 dias"/></label>
            <label className="full">Observações<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Garantia, prazo de execução ou outra informação importante"/></label>
          </div>
        </div>
      </section>

      <aside className="budget-preview-card">
        <div className="budget-preview-head"><div className="whatsapp-mark">W</div><div><h3>Mensagem para WhatsApp</h3><p>Confira antes de copiar</p></div></div>
        <pre>{message}</pre>
        {error && <div className="budget-feedback error">{error}</div>}
        {copied && <div className="budget-feedback success"><Icon name="check" size={15}/>Mensagem copiada. Agora é só colar no WhatsApp.</div>}
        <button className="whatsapp-copy" type="button" onClick={() => void copyMessage()}><Icon name={copied ? "check" : "clipboard"} size={18}/>{copied ? "Mensagem copiada" : "Copiar mensagem"}</button>
        <small>A mensagem será copiada para a área de transferência do computador.</small>
      </aside>
    </div>
  </div>;
}
