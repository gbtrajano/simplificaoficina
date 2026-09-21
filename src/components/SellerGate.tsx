import { createContext, useContext, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "./SessionGate";

interface SellerSession { sellerPassword: string; logoutSeller: () => void; }
const SellerContext = createContext<SellerSession | null>(null);

export function useSeller(): SellerSession {
  const session = useContext(SellerContext);
  if (!session) throw new Error("Acesso exclusivo do administrador do sistema.");
  return session;
}

export default function SellerGate({ children }: { children: ReactNode }) {
  const { user, logout } = useSession();
  const navigate = useNavigate();
  if (user?.role !== "seller_admin") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-mint-bg">
        <div className="card-elevated max-w-sm w-full p-8 text-center space-y-4">
          <h1 className="text-xl font-bold text-ink-900">Acesso restrito</h1>
          <p className="text-sm text-ink-500">Esta conta não tem permissão para administrar licenças.</p>
          <Link to="/" className="btn-outline block">Voltar para a oficina</Link>
        </div>
      </div>
    );
  }
  const leaveAdmin = () => {
    void logout();
    navigate("/", { replace: true });
  };
  return <SellerContext.Provider value={{ sellerPassword: "", logoutSeller: leaveAdmin }}>{children}</SellerContext.Provider>;
}
