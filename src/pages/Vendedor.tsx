import SellerGate, { useSeller } from "../components/SellerGate";
import Licencas from "./Licencas";
import Icon from "../components/Icon";

function SellerPanel() {
  const { logoutSeller } = useSeller();
  return (
    <div className="admin-shell">
      <div className="admin-topbar">
        <div className="workshop-brand"><div className="brand-mark"><Icon name="tool" size={23}/></div><div><strong>Simplifica</strong><span>OFICINA ADMIN</span></div></div>
        <button className="admin-logout" onClick={logoutSeller}><Icon name="logout" size={17}/> Encerrar sessão</button>
      </div>
      <div className="admin-content">
        <header className="admin-welcome">
          <div><p>PAINEL MASTER</p><h1>Controle do Simplifica Oficina</h1></div>
          <span>Administrador verificado</span>
        </header>
        <Licencas />
      </div>
    </div>
  );
}

export default function Vendedor() {
  return <SellerGate><SellerPanel /></SellerGate>;
}
