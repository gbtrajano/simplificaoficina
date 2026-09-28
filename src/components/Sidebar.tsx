import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSession } from "./SessionGate";
import Icon from "./Icon";

type IconName = Parameters<typeof Icon>[0]["name"];
type NavEntry = {
  to?: string;
  label: string;
  icon: IconName;
  admin?: boolean;
  sellerOnly?: boolean;
  children?: NavEntry[];
};

const groups: { label: string; links: NavEntry[] }[] = [
  { label: "OPERAÇÃO", links: [
    { to: "/", label: "Visão geral", icon: "grid" },
    { to: "/orcamentos", label: "Criar orçamento", icon: "clipboard" },
    { to: "/ordens", label: "Ordens de serviço", icon: "clipboard" },
    { to: "/agenda", label: "Agenda", icon: "calendar" },
  ] },
  { label: "CADASTROS", links: [
    { to: "/veiculos", label: "Veículos", icon: "car" },
    { to: "/clientes", label: "Clientes", icon: "users" },
    { to: "/fornecedores", label: "Fornecedores", icon: "team" },
    { to: "/pecas", label: "Peças e estoque", icon: "box" },
    { to: "/servicos", label: "Serviços", icon: "tool" },
  ] },
  { label: "GESTÃO", links: [
    { to: "/financeiro", label: "Financeiro", icon: "wallet" },
    { to: "/relatorios", label: "Relatórios", icon: "chart" },
    { to: "/equipe", label: "Equipe", icon: "team", admin: true },
    { to: "/oficina-movel", label: "Oficina móvel", icon: "phone", admin: true },
    { label: "Configurações", icon: "settings", admin: true, children: [
      { to: "/configuracoes/loja", label: "Loja", icon: "settings" },
      { to: "/configuracoes/pagamentos", label: "Pagamentos", icon: "wallet" },
      { to: "/configuracoes/atualizacoes", label: "Atualizações", icon: "arrow" },
      { to: "/configuracoes/dados", label: "Dados do Sistema", icon: "box" },
      { to: "/impressora", label: "Impressora", icon: "printer" },
    ] },
    { to: "/licencas", label: "Licenças do sistema", icon: "clipboard", sellerOnly: true },
  ] },
];

export default function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const { user, logout } = useSession();
  const location = useLocation();
  const admin = user?.role === "admin" || user?.role === "seller_admin";
  const configActive = location.pathname.startsWith("/configuracoes") || location.pathname === "/impressora";
  const [configOpen, setConfigOpen] = useState(configActive);

  useEffect(() => { if (configActive) setConfigOpen(true); }, [configActive]);

  return <>
    <div className={`sidebar-backdrop ${open ? "show" : ""}`} onClick={onClose}/>
    <aside className={`workshop-sidebar ${open ? "open" : ""}`}>
      <div className="workshop-brand">
        <div className="brand-mark"><Icon name="tool" size={23}/></div>
        <div><strong>Simplifica</strong><span>OFICINA</span></div>
        <button className="sidebar-close" onClick={onClose}><Icon name="x"/></button>
      </div>
      <nav>{groups.map((group) => <div className="nav-group" key={group.label}>
        <p>{group.label}</p>
        {group.links
          .filter((link) => (!link.admin || admin) && (!link.sellerOnly || user?.role === "seller_admin"))
          .map((link) => link.children ? <div className="nav-submenu" key={link.label}>
            <button className={`nav-item nav-parent ${configActive ? "active-parent" : ""}`} onClick={() => setConfigOpen((value) => !value)} aria-expanded={configOpen}>
              <Icon name={link.icon} size={19}/><span>{link.label}</span><b>›</b>
            </button>
            {configOpen && <div className="nav-children">{link.children.map((child) =>
              <NavLink key={child.to} to={child.to!} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <Icon name={child.icon} size={16}/><span>{child.label}</span>
              </NavLink>
            )}</div>}
          </div> : <NavLink key={link.to} to={link.to!} end={link.to === "/"} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <Icon name={link.icon} size={19}/><span>{link.label}</span>
          </NavLink>)}
      </div>)}</nav>
      <div className="sidebar-bottom">
        <NavLink to="/suporte" className={({ isActive }) => `plan-card ${isActive ? "active" : ""}`}>
          <div><Icon name="help" size={18}/><strong>Plano ativo</strong></div><p>Gerencie sua mensalidade</p><span>Ver detalhes <Icon name="arrow" size={13}/></span>
        </NavLink>
        <button className="logout-button" onClick={logout}><Icon name="logout" size={18}/> Sair do sistema</button>
      </div>
    </aside>
  </>;
}
