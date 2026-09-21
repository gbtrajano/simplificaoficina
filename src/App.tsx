import { type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LicenseGate from "./components/LicenseGate";
import SellerGate from "./components/SellerGate";
import SessionGate, { canAccess, useSession } from "./components/SessionGate";
import WorkshopShell from "./components/WorkshopShell";
import Dashboard from "./pages/Dashboard";
import OrdensServico from "./pages/OrdensServico";
import AgendaOficina from "./pages/AgendaOficina";
import Veiculos from "./pages/Veiculos";
import Clientes from "./pages/Clientes";
import Produtos from "./pages/Produtos";
import Contas from "./pages/Contas";
import Relatorios from "./pages/RelatoriosOficina";
import Equipe from "./pages/Equipe";
import Configuracoes from "./pages/Configuracoes";
import Suporte from "./pages/Suporte";
import Licencas from "./pages/Licencas";
import RedeLocal from "./pages/RedeLocal";
import ConfiguracaoImpressora from "./pages/ConfiguracaoImpressora";
import Servicos from "./pages/Servicos";

export default function App(){
 return <SessionGate><LicenseBoundary><WorkshopShell><Routes>
  <Route path="/" element={<Dashboard/>}/>
  <Route path="/ordens" element={<OrdensServico/>}/>
  <Route path="/agenda" element={<AgendaOficina/>}/>
  <Route path="/veiculos" element={<Veiculos/>}/>
  <Route path="/clientes" element={<Clientes/>}/>
  <Route path="/pecas" element={<Produtos/>}/>
  <Route path="/servicos" element={<Servicos/>}/>
  <Route path="/financeiro" element={<Contas/>}/>
  <Route path="/relatorios" element={<Relatorios/>}/>
  <Route path="/equipe" element={<AdminOnly><Equipe/></AdminOnly>}/>
  <Route path="/oficina-movel" element={<AdminOnly><RedeLocal/></AdminOnly>}/>
  <Route path="/impressora" element={<AdminOnly><ConfiguracaoImpressora/></AdminOnly>}/>
  <Route path="/configuracoes" element={<AdminOnly><Configuracoes/></AdminOnly>}/>
  <Route path="/suporte" element={<Suporte/>}/>
  <Route path="/licencas" element={<SellerGate><Licencas/></SellerGate>}/>
  <Route path="/vendedor" element={<Navigate to="/licencas" replace/>}/>
  <Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes></WorkshopShell></LicenseBoundary></SessionGate>
}

function LicenseBoundary({children}:{children:ReactNode}){
 const{user}=useSession();
 // O administrador da plataforma entra na aplicação normalmente e acessa o
 // gerenciamento de licenças pela sidebar. Clientes continuam no LicenseGate.
 if(user?.role==="seller_admin")return <>{children}</>;
 return <LicenseGate>{children}</LicenseGate>;
}

function AdminOnly({children}:{children:ReactNode}){
 const{user}=useSession();
 if(canAccess(user,"admin"))return <>{children}</>;
 return <div className="large-empty"><span>🔒</span><h3>Acesso restrito</h3><p>Seu perfil não possui permissão para acessar esta área.</p></div>;
}
