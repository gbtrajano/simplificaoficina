import re

with open("src/pages/PDV.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Imports
imports = """import {
  PixSettings, CardMachineSettings, PrinterSettings, StoreSettings,
  LS_PIX_KEY, LS_CARD_KEY, LS_PRINTER_KEY,
  DEFAULT_PIX_SETTINGS, DEFAULT_CARD_SETTINGS, DEFAULT_PRINTER_SETTINGS
} from "../types";
import { createPixPayment, cancelPixPayment, startPixPolling, PixPaymentResult } from "../lib/pix";
"""
content = content.replace('import type { Product, CartItem } from "../types";', imports + '\nimport type { Product, CartItem } from "../types";')

# 2. State Variables
state_vars = """
  const [pixModal, setPixModal] = useState<PixPaymentResult | null>(null);
  const [pixPollingStop, setPixPollingStop] = useState<(() => void) | null>(null);
  const [pixError, setPixError] = useState("");
  const [cardModal, setCardModal] = useState(false);
  const [store, setStore] = useState<StoreSettings | null>(null);

  useEffect(() => {
    api.getStoreSettings().then(setStore).catch(console.error);
  }, []);
"""
content = content.replace('const barcodeRef = useRef<HTMLInputElement>(null);', 'const barcodeRef = useRef<HTMLInputElement>(null);\n' + state_vars)

# 3. Finalize Sale Replacement
old_finalize_start = "  const finalizeSale = async () => {"
old_finalize_regex = re.compile(r'  const finalizeSale = async \(\) => \{.*?\n  \};\n', re.DOTALL)

new_finalize = """  const finalizeSale = async (overridePayment?: string) => {
    if (cart.length === 0) return;

    if (paymentMethod === "Dinheiro" && amountReceived !== "") {
      if (numReceived < total) {
        alert(`O valor entregue (${currency(numReceived)}) é menor que o total (${currency(total)}).`);
        return;
      }
    }

    if (paymentMethod === "Pix" && !overridePayment) {
      try {
        const rawPix = localStorage.getItem(LS_PIX_KEY);
        const pixSettings: PixSettings = rawPix ? { ...DEFAULT_PIX_SETTINGS, ...JSON.parse(rawPix) } : DEFAULT_PIX_SETTINGS;
        
        if (pixSettings.enabled && pixSettings.mp_access_token) {
          setFinalizing(true);
          setPixError("");
          try {
            const charge = await createPixPayment(
              pixSettings.mp_access_token,
              total,
              "Venda PDV",
              pixSettings.payer_email_fallback,
              pixSettings.expiration_minutes
            );
            setPixModal(charge);
            
            if (pixSettings.auto_confirm) {
              const stop = startPixPolling(
                pixSettings.mp_access_token,
                charge.id,
                () => {
                  setPixModal(null);
                  if (pixPollingStop) pixPollingStop();
                  finishSaleRequest(paymentMethod);
                },
                (err) => {
                  setPixError(err);
                }
              );
              setPixPollingStop(() => stop);
            }
          } catch (e: any) {
            alert(e.message || "Erro ao gerar PIX");
          } finally {
            setFinalizing(false);
          }
          return;
        }
      } catch (e) { console.error(e); }
    }

    if ((paymentMethod === "Cartão de Crédito" || paymentMethod === "Cartão de Débito") && !overridePayment) {
      try {
        const rawCard = localStorage.getItem(LS_CARD_KEY);
        const cardSettings: CardMachineSettings = rawCard ? { ...DEFAULT_CARD_SETTINGS, ...JSON.parse(rawCard) } : DEFAULT_CARD_SETTINGS;
        
        if (cardSettings.enabled && cardSettings.ask_confirmation) {
          setCardModal(true);
          return;
        }
      } catch (e) { console.error(e); }
    }

    finishSaleRequest(paymentMethod);
  };

  const finishSaleRequest = async (finalMethod: string) => {
    setFinalizing(true);
    try {
      await api.finalizeSale(
        cart,
        finalMethod,
        null,
        showCpfField && customerDocument ? customerDocument : undefined,
        user?.name ?? "Operador"
      );
      const paidValue = finalMethod === "Dinheiro" && numReceived > 0 ? numReceived : total;
      const changeValue = finalMethod === "Dinheiro" && numReceived > 0 ? Math.max(0, numReceived - total) : 0;

      setSaleSuccessData({ total, received: paidValue, change: changeValue, paymentMethod: finalMethod });
      setCart([]);
      setAmountReceived("");
      setCustomerDocument("");

      // Auto print
      try {
        const rawPrinter = localStorage.getItem(LS_PRINTER_KEY);
        const printer: PrinterSettings = rawPrinter ? { ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(rawPrinter) } : DEFAULT_PRINTER_SETTINGS;
        if (printer.enabled && printer.auto_print) {
          document.body.classList.remove("print-58mm", "print-80mm", "print-a4");
          document.body.classList.add(`print-${printer.paper_size}`);
          setTimeout(() => window.print(), 100);
        }
      } catch(e) {}
    } catch (e) {
      console.error("Erro ao finalizar, salvando para fila offline:", e);
      setOfflineQueue((prev) => [...prev, cart]);
      setCart([]);
      setAmountReceived("");
      alert("Venda salva na fila offline. Sincronizará quando a conexão voltar.");
    } finally {
      setFinalizing(false);
    }
  };
"""
content = old_finalize_regex.sub(new_finalize, content)

# 4. Modals
modals = """
      {/* Pix Modal */}
      {pixModal && (
        <div className="glass-overlay animate-fade-in">
          <div className="card-elevated max-w-sm w-full p-6 text-center space-y-4 animate-scale-in">
            <h3 className="font-bold text-ink-900 text-lg">Aguardando Pagamento PIX</h3>
            {pixError ? (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{pixError}</div>
            ) : (
              <div className="flex justify-center">
                {pixModal.qr_code_base64 ? (
                  <img src={`data:image/png;base64,${pixModal.qr_code_base64}`} alt="QR Code PIX" className="w-48 h-48 rounded-xl shadow-sm" />
                ) : (
                  <div className="w-48 h-48 bg-ink-50 rounded-xl flex items-center justify-center text-ink-400">QR Code</div>
                )}
              </div>
            )}
            <div className="text-2xl font-extrabold gradient-text">{currency(total)}</div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => {
                if (pixPollingStop) pixPollingStop();
                cancelPixPayment(JSON.parse(localStorage.getItem(LS_PIX_KEY) || "{}").mp_access_token, pixModal.id);
                setPixModal(null);
                setPixError("");
              }} className="flex-1 btn-outline">Cancelar</button>
              <button onClick={() => {
                if (pixPollingStop) pixPollingStop();
                setPixModal(null);
                finishSaleRequest(paymentMethod);
              }} className="flex-1 btn-primary">Confirmar Manual</button>
            </div>
          </div>
        </div>
      )}

      {/* Card Modal */}
      {cardModal && (
        <div className="glass-overlay animate-fade-in">
          <div className="card-elevated max-w-sm w-full p-6 text-center space-y-4 animate-scale-in">
            <div className="text-4xl">💳</div>
            <h3 className="font-bold text-ink-900 text-lg">Maquininha de Cartão</h3>
            <p className="text-sm text-ink-600">
              {(() => {
                try {
                  const raw = localStorage.getItem(LS_CARD_KEY);
                  return raw ? JSON.parse(raw).instruction_message : "Passe o cartão na maquininha";
                } catch { return "Passe o cartão na maquininha"; }
              })()}
            </p>
            <div className="text-3xl font-extrabold text-ink-900 bg-ink-50 p-4 rounded-xl border border-ink-200/50">
              {currency(total)}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setCardModal(false)} className="flex-1 btn-outline">Cancelar</button>
              <button onClick={() => { setCardModal(false); finishSaleRequest(paymentMethod); }} className="flex-1 btn-primary">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Cupom Data */}
      <div id="print-cupom" style={{ display: "none" }}>
        {saleSuccessData && store && (
          <div className={`cupom border border-dashed border-ink-300 mx-auto text-[10px] leading-relaxed w-full max-w-sm`}>
            <div className="cupom-header">
              <div className="store-name">{store.name}</div>
              <div className="store-info">Data: {new Date().toLocaleString('pt-BR')}</div>
              <div className="store-info font-bold">CUPOM NÃO FISCAL</div>
            </div>
            <div className="cupom-totals">
              <div className="total-row grand-total"><span>TOTAL:</span><span>{currency(saleSuccessData.total)}</span></div>
              <div className="total-row"><span>Pagamento:</span><span>{saleSuccessData.paymentMethod}</span></div>
            </div>
            <div className="cupom-footer">
              <div className="sale-id">Obrigado pela preferência!</div>
            </div>
          </div>
        )}
      </div>
"""

# add modals right before closing div
content = content.replace("    </div>\n  );\n}", modals + "\n    </div>\n  );\n}")

# add print button to success modal
print_btn = """
            <div className="flex gap-2">
              <button onClick={() => setSaleSuccessData(null)} className="btn-primary flex-1 py-3">Nova Venda</button>
              <button onClick={() => {
                const rawPrinter = localStorage.getItem(LS_PRINTER_KEY);
                const printer = rawPrinter ? { ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(rawPrinter) } : DEFAULT_PRINTER_SETTINGS;
                document.body.classList.remove("print-58mm", "print-80mm", "print-a4");
                document.body.classList.add(`print-${printer.paper_size || "80mm"}`);
                setTimeout(() => window.print(), 100);
              }} className="btn-outline flex-1 py-3 text-brand-600 border-brand-200 hover:bg-brand-50">
                🖨️ Imprimir
              </button>
            </div>
"""
content = content.replace('<button onClick={() => setSaleSuccessData(null)} className="btn-primary w-full py-3">OK / Nova Venda</button>', print_btn)

# replace finalize button call
content = content.replace('onClick={finalizeSale}', 'onClick={() => finalizeSale()}')

with open("src/pages/PDV.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Updated PDV.tsx")
