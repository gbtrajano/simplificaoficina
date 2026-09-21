import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Icon from "./Icon";
import { useSession } from "./SessionGate";

const titles:Record<string,string>={"/":"Visão geral","/ordens":"Ordens de serviço","/agenda":"Agenda","/veiculos":"Veículos","/clientes":"Clientes","/pecas":"Peças e estoque","/servicos":"Serviços e mão de obra","/financeiro":"Financeiro","/relatorios":"Relatórios","/equipe":"Equipe","/oficina-movel":"Oficina móvel","/impressora":"Impressora","/configuracoes":"Configurações","/suporte":"Plano e mensalidade","/licencas":"Licenças do sistema"};
export default function WorkshopShell({children}:{children:ReactNode}){
 const [open,setOpen]=useState(false); const location=useLocation(); const {user}=useSession();
 useEffect(()=>setOpen(false),[location.pathname]);
 return <div className="workshop-shell">
   <Sidebar open={open} onClose={()=>setOpen(false)}/>
   <section className="workshop-main">
    <header className="topbar"><div className="flex items-center gap-3"><button className="mobile-menu" onClick={()=>setOpen(true)}><Icon name="menu"/></button><div><p className="topbar-eyebrow">Simplifica Oficina</p><h1>{titles[location.pathname]||"Gestão da oficina"}</h1></div></div><div className="flex items-center gap-3"><button className="icon-button"><Icon name="bell" size={18}/><i/></button><div className="topbar-user"><span>{user?.name?.slice(0,1).toUpperCase()||"O"}</span><div><strong>{user?.name||"Operador"}</strong><small>Oficina principal</small></div></div></div></header>
    <main className="workshop-content">{children}</main>
   </section>
 </div>
}
