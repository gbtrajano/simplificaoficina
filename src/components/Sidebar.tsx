import { NavLink } from "react-router-dom";
import { useSession } from "./SessionGate";
import Icon from "./Icon";

type IconName=Parameters<typeof Icon>[0]["name"];
const groups:{label:string;links:{to:string;label:string;icon:IconName;admin?:boolean;sellerOnly?:boolean}[]}[]=[
 {label:"OPERAÇÃO",links:[{to:"/",label:"Visão geral",icon:"grid"},{to:"/ordens",label:"Ordens de serviço",icon:"clipboard"},{to:"/agenda",label:"Agenda",icon:"calendar"}]},
 {label:"CADASTROS",links:[{to:"/veiculos",label:"Veículos",icon:"car"},{to:"/clientes",label:"Clientes",icon:"users"},{to:"/pecas",label:"Peças e estoque",icon:"box"},{to:"/servicos",label:"Serviços",icon:"tool"}]},
 {label:"GESTÃO",links:[{to:"/financeiro",label:"Financeiro",icon:"wallet"},{to:"/relatorios",label:"Relatórios",icon:"chart"},{to:"/equipe",label:"Equipe",icon:"team",admin:true},{to:"/oficina-movel",label:"Oficina móvel",icon:"phone",admin:true},{to:"/impressora",label:"Impressora",icon:"printer",admin:true},{to:"/configuracoes",label:"Configurações",icon:"settings",admin:true},{to:"/licencas",label:"Licenças do sistema",icon:"clipboard",sellerOnly:true}]},
];
export default function Sidebar({open=false,onClose}:{open?:boolean;onClose?:()=>void}){
 const {user,logout}=useSession(); const admin=user?.role==="admin"||user?.role==="seller_admin";
 return <><div className={`sidebar-backdrop ${open?"show":""}`} onClick={onClose}/><aside className={`workshop-sidebar ${open?"open":""}`}>
  <div className="workshop-brand"><div className="brand-mark"><Icon name="tool" size={23}/></div><div><strong>Simplifica</strong><span>OFICINA</span></div><button className="sidebar-close" onClick={onClose}><Icon name="x"/></button></div>
  <nav>{groups.map(g=><div className="nav-group" key={g.label}><p>{g.label}</p>{g.links.filter(l=>(!l.admin||admin)&&(!l.sellerOnly||user?.role==="seller_admin")).map(l=><NavLink key={l.to} to={l.to} end={l.to==="/"} className={({isActive})=>`nav-item ${isActive?"active":""}`}><Icon name={l.icon} size={19}/><span>{l.label}</span></NavLink>)}</div>)}</nav>
  <div className="sidebar-bottom"><NavLink to="/suporte" className={({isActive})=>`plan-card ${isActive?"active":""}`}><div><Icon name="help" size={18}/><strong>Plano ativo</strong></div><p>Gerencie sua mensalidade</p><span>Ver detalhes <Icon name="arrow" size={13}/></span></NavLink><button className="logout-button" onClick={logout}><Icon name="logout" size={18}/> Sair do sistema</button></div>
 </aside></>
}
