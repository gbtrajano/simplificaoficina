import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import Icon from "./Icon";

type IconName = Parameters<typeof Icon>[0]["name"];
type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  to: string;
  icon: IconName;
  tone: "danger" | "warning" | "info";
};

const READ_KEY = "simplificaoficina_read_notifications";
const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const getReadIds = () => {
  try { return new Set<string>(JSON.parse(localStorage.getItem(READ_KEY) || "[]")); }
  catch { return new Set<string>(); }
};

export default function NotificationCenter() {
  const navigate = useNavigate();
  const location = useLocation();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(getReadIds);

  const load = useCallback(async () => {
    try {
      const today = localDate();
      const [products, accounts, appointments, orders] = await Promise.all([
        api.listProducts(""), api.listAccounts("payable"), api.listAppointments(today), api.listServiceOrders("", ""),
      ]);
      const now = Date.now();
      const next: NotificationItem[] = [];

      accounts.filter((account) => !account.paid && account.due_date && account.due_date <= today).forEach((account) => {
        const overdue = account.due_date < today;
        next.push({
          id: `account-${account.id}-${account.due_date}`,
          title: overdue ? "Conta vencida" : "Conta vence hoje",
          detail: `${account.description} · ${money(account.amount)}`,
          to: "/financeiro",
          icon: "wallet",
          tone: overdue ? "danger" : "warning",
        });
      });

      orders.filter((order) => order.promised_at && !["delivered", "canceled"].includes(order.status) && Date.parse(order.promised_at) < now).forEach((order) => {
        next.push({
          id: `order-${order.id}-${order.promised_at}`,
          title: `OS #${String(order.id).padStart(4, "0")} com prazo vencido`,
          detail: `${order.vehicle_name} · ${order.plate}`,
          to: `/ordens?editar=${order.id}`,
          icon: "clipboard",
          tone: "danger",
        });
      });

      products.filter((product) => product.active && product.stock <= product.min_stock).forEach((product) => {
        next.push({
          id: `stock-${product.id}-${product.stock}`,
          title: product.stock <= 0 ? "Produto sem estoque" : "Estoque baixo",
          detail: `${product.name} · ${product.stock} disponível(is), mínimo ${product.min_stock}`,
          to: "/pecas",
          icon: "box",
          tone: product.stock <= 0 ? "danger" : "warning",
        });
      });

      appointments.filter((appointment) => !["canceled", "completed"].includes(appointment.status)).forEach((appointment) => {
        next.push({
          id: `appointment-${appointment.id}-${appointment.scheduled_at}`,
          title: `Agendamento às ${appointment.scheduled_at.slice(11, 16)}`,
          detail: `${appointment.customer_name} · ${appointment.vehicle || appointment.service}`,
          to: "/agenda",
          icon: "calendar",
          tone: "info",
        });
      });

      setItems(next);
      setError(false);
    } catch (reason) {
      console.error("Falha ao carregar notificações", reason);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => { void load(); }, [location.pathname, load]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", closeOnEscape); };
  }, [open]);

  const unread = useMemo(() => items.filter((item) => !readIds.has(item.id)), [items, readIds]);
  const saveReadIds = (ids: Set<string>) => {
    setReadIds(ids);
    localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-300)));
  };
  const markAllRead = () => saveReadIds(new Set([...readIds, ...items.map((item) => item.id)]));
  const openItem = (item: NotificationItem) => {
    saveReadIds(new Set([...readIds, item.id]));
    setOpen(false);
    navigate(item.to);
  };

  return <div className="notification-center" ref={root}>
    <button className={`icon-button ${open ? "selected" : ""}`} aria-label={`Notificações${unread.length ? `: ${unread.length} não lidas` : ""}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <Icon name="bell" size={18}/>
      {unread.length > 0 && <span className="notification-badge">{unread.length > 99 ? "99+" : unread.length}</span>}
    </button>
    {open && <section className="notification-panel">
      <header><div><h3>Notificações</h3><p>{unread.length ? `${unread.length} não lida${unread.length === 1 ? "" : "s"}` : "Tudo em dia"}</p></div>{unread.length > 0 && <button onClick={markAllRead}>Marcar como lidas</button>}</header>
      <div className="notification-list">
        {loading && <div className="notification-empty"><Icon name="clock"/><span>Atualizando notificações...</span></div>}
        {!loading && error && <div className="notification-empty"><Icon name="alert"/><span>Não foi possível atualizar.</span><button onClick={() => void load()}>Tentar novamente</button></div>}
        {!loading && !error && items.length === 0 && <div className="notification-empty"><Icon name="check"/><strong>Nenhuma pendência</strong><span>Não há alertas para mostrar agora.</span></div>}
        {!loading && !error && items.map((item) => <button className={`notification-row ${readIds.has(item.id) ? "read" : ""}`} onClick={() => openItem(item)} key={item.id}>
          <span className={`notification-icon ${item.tone}`}><Icon name={item.icon} size={17}/></span>
          <span><strong>{item.title}</strong><small>{item.detail}</small></span>
          {!readIds.has(item.id) && <i/>}
        </button>)}
      </div>
      <footer><button onClick={() => void load()}><Icon name="clock" size={13}/>Atualizar agora</button></footer>
    </section>}
  </div>;
}
