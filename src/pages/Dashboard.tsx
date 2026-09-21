import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import { api } from "../lib/api";
import type { Appointment, ServiceOrder, WorkshopDashboard } from "../types";

const money=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const statusLabel:Record<string,string>={draft:"Orçamento",approved:"Aprovada",in_progress:"Em execução",waiting_parts:"Aguardando peça",ready:"Pronta",delivered:"Entregue",canceled:"Cancelada"};
export default function Dashboard(){
 const nav=useNavigate(); const [stats,setStats]=useState<WorkshopDashboard>({open_orders:0,in_progress:0,ready:0,today_appointments:0,month_revenue:0,vehicles:0}); const [orders,setOrders]=useState<ServiceOrder[]>([]); const [agenda,setAgenda]=useState<Appointment[]>([]);
 useEffect(()=>{api.workshopDashboard().then(setStats).catch(console.error);api.listServiceOrders("","").then(x=>setOrders(x.slice(0,5))).catch(console.error);api.listAppointments(new Date().toISOString().slice(0,10)).then(setAgenda).catch(console.error)},[]);
 return <div className="dashboard-page page-enter">
  <section className="welcome-row"><div><h2>Bom dia! <span>👋</span></h2><p>Acompanhe o movimento da sua oficina hoje.</p></div><button className="primary-action" onClick={()=>nav("/ordens?nova=1")}><Icon name="plus" size={18}/> Nova ordem de serviço</button></section>
  <section className="metric-grid">
   <Metric label="Ordens abertas" value={stats.open_orders} detail={`${stats.in_progress} em execução`} icon="clipboard" tone="blue"/>
   <Metric label="Veículos na oficina" value={stats.in_progress} detail={`${stats.ready} prontos para entrega`} icon="car" tone="orange"/>
   <Metric label="Agendamentos hoje" value={stats.today_appointments} detail={agenda.length?`Próximo às ${agenda[0].scheduled_at.slice(11,16)}`:"Agenda disponível"} icon="calendar" tone="purple"/>
   <Metric label="Faturamento no mês" value={money(stats.month_revenue)} detail="Ordens entregues" icon="chart" tone="green"/>
  </section>
  <section className="dashboard-columns"><div className="panel"><div className="panel-head"><div><h3>Ordens recentes</h3><p>Últimas movimentações da oficina</p></div><button onClick={()=>nav("/ordens")}>Ver todas <Icon name="arrow" size={14}/></button></div>
   {orders.length===0?<Empty icon="clipboard" text="Nenhuma ordem de serviço ainda" action="Criar primeira ordem" onClick={()=>nav("/ordens?nova=1")}/>:<div className="order-list">{orders.map(o=><button className="order-row" key={o.id} onClick={()=>nav(`/ordens?editar=${o.id}`)}><span className="order-id">#{String(o.id).padStart(4,"0")}</span><div className="vehicle-avatar"><Icon name="car" size={18}/></div><div className="order-main"><strong>{o.vehicle_name}</strong><span>{o.plate} · {o.customer_name||"Cliente não informado"}</span></div><span className={`status-chip ${o.status}`}>{statusLabel[o.status]||o.status}</span><strong className="order-value">{money(o.total)}</strong><Icon name="arrow" size={15}/></button>)}</div>}
  </div><div className="panel"><div className="panel-head"><div><h3>Agenda de hoje</h3><p>{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"})}</p></div><button onClick={()=>nav("/agenda")}>Ver agenda <Icon name="arrow" size={14}/></button></div>
   {agenda.length===0?<Empty icon="calendar" text="Nenhum serviço agendado" action="Adicionar agendamento" onClick={()=>nav("/agenda?novo=1")}/>:<div className="agenda-mini">{agenda.slice(0,5).map(a=><div key={a.id}><time>{a.scheduled_at.slice(11,16)}</time><i/><div><strong>{a.customer_name}</strong><span>{a.vehicle} · {a.service}</span></div></div>)}</div>}
  </div></section>
  <section className="quick-panel"><div><span className="quick-icon"><Icon name="tool"/></span><div><h3>Ações rápidas</h3><p>Acesse as tarefas mais usadas no dia a dia</p></div></div><div className="quick-actions"><button onClick={()=>nav("/veiculos?novo=1")}><Icon name="car"/>Cadastrar veículo</button><button onClick={()=>nav("/clientes")}><Icon name="users"/>Novo cliente</button><button onClick={()=>nav("/pecas")}><Icon name="box"/>Entrada de peças</button></div></section>
 </div>
}
function Metric({label,value,detail,icon,tone}:{label:string,value:string|number,detail:string,icon:Parameters<typeof Icon>[0]["name"],tone:string}){return <div className="metric-card"><span className={`metric-icon ${tone}`}><Icon name={icon}/></span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></div>}
function Empty({icon,text,action,onClick}:{icon:Parameters<typeof Icon>[0]["name"],text:string,action:string,onClick:()=>void}){return <div className="empty-state"><span><Icon name={icon} size={25}/></span><p>{text}</p><button onClick={onClick}>{action}</button></div>}
