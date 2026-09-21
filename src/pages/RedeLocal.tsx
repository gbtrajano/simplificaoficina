import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import Icon from "../components/Icon";
import { api } from "../lib/api";

export default function RedeLocal() {
  const [pin, setPin] = useState("1234");
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.getLanAccessPin().then(setPin).catch(console.error);
    api.lanServerStatus().then((status) => {
      setRunning(status.running);
      setUrl(status.url ?? "");
    }).catch(console.error);
  }, []);

  const start = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const address = await api.startLanServer(pin);
      setUrl(address);
      setRunning(true);
      setMessage("Painel móvel iniciado. O celular deve estar conectado ao mesmo Wi-Fi deste computador.");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(url);
    setMessage("Endereço copiado.");
  };

  return <div className="page-enter mobile-workshop-page">
    <div className="section-heading">
      <div><h2>Oficina móvel</h2><p>Permita que os mecânicos assumam e atualizem ordens pelo celular</p></div>
    </div>

    {message && <div className="admin-notice success"><Icon name="check" size={16}/>{message}</div>}
    {error && <div className="admin-notice error"><Icon name="alert" size={16}/>{error}</div>}

    <div className="mobile-workshop-grid">
      <section className="data-panel mobile-server-card">
        <div className="panel-head"><div><h3>Acesso pela rede da oficina</h3><p>O computador principal hospeda as OS para os celulares</p></div><span className={`server-state ${running ? "online" : "offline"}`}>{running ? "Ativo" : "Desligado"}</span></div>
        <div className="mobile-server-body">
          <label className="network-field">PIN de acesso
            <input value={pin} inputMode="numeric" maxLength={8} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} placeholder="4 a 8 números" />
          </label>
          <p className="network-help">O mecânico informará o próprio nome e este PIN ao abrir o painel no celular.</p>
          <button className="primary-action" disabled={busy || pin.length < 4} onClick={() => void start()}>
            <Icon name="phone" size={18}/>{busy ? "Iniciando..." : running ? "Salvar PIN" : "Iniciar painel móvel"}
          </button>
          <div className="network-notes">
            <strong>Como funciona</strong>
            <ol><li>Conecte o celular ao mesmo Wi-Fi.</li><li>Inicie o painel e leia o QR Code.</li><li>O mecânico entra com nome e PIN.</li><li>Ao assumir uma OS, ela aparece como “Em execução” no sistema.</li></ol>
          </div>
        </div>
      </section>

      <section className="data-panel mobile-access-card">
        <div className="panel-head"><div><h3>Abrir no celular</h3><p>QR Code e endereço local</p></div></div>
        <div className="mobile-access-body">
          {running && url ? <>
            <div className="network-qr"><QRCode value={url} size={190}/></div>
            <code>{url}</code>
            <button className="secondary-action" onClick={() => void copyUrl()}>Copiar endereço</button>
            <p>Se o celular não abrir, permita o acesso do Simplifica Oficina à porta 8080 no Firewall do Windows.</p>
          </> : <div className="large-empty compact"><span><Icon name="phone" size={28}/></span><h3>Painel ainda desligado</h3><p>Defina um PIN e inicie o acesso móvel.</p></div>}
        </div>
      </section>
    </div>
  </div>;
}
