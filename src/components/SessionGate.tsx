import { createContext, useContext, useState, type ReactNode } from "react";
import { supabaseApi, supabaseConfigured } from "../lib/supabase";
import { ROLE_RANK, type SessionUser } from "../types";
import Icon from "./Icon";

interface SessionContextValue {
  user: SessionUser | null;
  logout: () => void;
  rank: (role?: string) => number;
}

const SessionContext = createContext<SessionContextValue>({ user: null, logout: () => {}, rank: () => 0 });

export function useSession() { return useContext(SessionContext); }

// A conta autenticada é a responsável pela licença da loja.
export function canAccess(user: SessionUser | null, requiredRole: string): boolean {
  return Boolean(user && ROLE_RANK[user.role] >= (ROLE_RANK[requiredRole] ?? 99));
}

export default function SessionGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [licenseKey, setLicenseKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const enterWithAccount = async (account: { email: string }) => {
    const isLicenseAdmin = await supabaseApi.isLicenseAdmin();
    if (isLicenseAdmin) {
      setUser({ id: 0, name: account.email, login: account.email, role: "seller_admin" });
      return;
    }
    // Licenças vencidas também entram na sessão, mas ficam restritas à
    // tela de regularização exibida pelo LicenseGate.
    const license = await supabaseApi.getMyLicense();
    setUser({ id: 0, name: license.customer_name || account.email, login: account.email, role: license.access_role === "owner" ? "admin" : license.access_role });
  };

  const doLogin = async () => {
    if (busy) return;
    setError("");
    setNotice("");
    if (!email.trim() || !password) return setError("Informe e-mail e senha.");
    setBusy(true);
    try {
      const account = await supabaseApi.signInWithEmail(email.trim(), password);
      await enterWithAccount(account);
    } catch (e) {
      await supabaseApi.signOut();
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const doRegister = async () => {
    if (busy) return;
    setError("");
    setNotice("");
    if (!licenseKey.trim() || !email.trim() || !password) {
      return setError("Informe a chave, o e-mail e a senha.");
    }
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== passwordConfirmation) return setError("As senhas não coincidem.");

    setBusy(true);
    try {
      const result = await supabaseApi.signUpWithLicense(licenseKey, email, password);
      if (result.needsEmailConfirmation) {
        setMode("login");
        setPassword("");
        setPasswordConfirmation("");
        setNotice("Conta criada. Confirme o e-mail recebido e depois entre com sua senha.");
      } else {
        await enterWithAccount(result.user);
      }
    } catch (e) {
      await supabaseApi.signOut();
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await supabaseApi.signOut();
    setUser(null);
    setPassword("");
  };

  if (!user) return (
    <div className="h-screen w-screen flex items-center justify-center p-6 bg-gradient-to-br from-ink-50 via-mint-bg to-brand-50/30">
      <div className="card-elevated max-w-sm w-full p-8 space-y-5 animate-scale-in">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 mx-auto flex items-center justify-center text-white shadow-brand">
            <Icon name="tool" size={28} />
          </div>
          <h1 className="text-lg font-bold text-ink-900 mt-3">{mode === "login" ? "Entrar no Simplifica Oficina" : "Ativar e criar conta"}</h1>
          <p className="text-xs text-ink-500 mt-1">
            {mode === "login" ? "Use o e-mail e a senha da sua conta." : "Informe a chave recebida na compra e crie sua senha."}
          </p>
        </div>
        {!supabaseConfigured && <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-xl text-sm text-amber-800">Supabase não configurado neste instalador.</div>}
        <div className="space-y-3">
          {mode === "register" && <input className="input font-mono uppercase tracking-wider" placeholder="Chave de ativação" value={licenseKey} onChange={(e) => setLicenseKey(e.target.value.toUpperCase())} autoFocus />}
          <input className="input" type="email" autoComplete="email" placeholder="seuemail@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          <input className="input" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "login" ? "Senha" : "Crie uma senha (mín. 8 caracteres)"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && mode === "login" && doLogin()} />
          {mode === "register" && <input className="input" type="password" autoComplete="new-password" placeholder="Confirme a senha" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doRegister()} />}
          {notice && <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded-xl text-sm text-emerald-700 font-medium">✓ {notice}</div>}
          {error && <div className="p-3 bg-red-50 border border-red-200/60 rounded-xl text-sm text-red-700 font-medium animate-slide-up">✕ {error}</div>}
          <button onClick={mode === "login" ? doLogin : doRegister} disabled={busy || !supabaseConfigured} className="btn-primary w-full py-3">
            {busy ? (mode === "login" ? "Entrando..." : "Criando conta...") : (mode === "login" ? "Entrar" : "Ativar e criar conta")}
          </button>
          <button
            type="button"
            className="w-full text-sm font-semibold text-brand-700 hover:text-brand-800"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setNotice(""); }}
          >
            {mode === "login" ? "Primeiro acesso — usar chave de ativação" : "Já tenho uma conta — entrar"}
          </button>
        </div>
      </div>
    </div>
  );

  return <SessionContext.Provider value={{ user, logout, rank: (r) => ROLE_RANK[r ?? user.role] ?? 0 }}>{children}</SessionContext.Provider>;
}
