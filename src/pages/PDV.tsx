import { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import {
  PixSettings, CardMachineSettings, PrinterSettings, StoreSettings,
  LS_PIX_KEY, LS_CARD_KEY, LS_PRINTER_KEY,
  DEFAULT_PIX_SETTINGS, DEFAULT_CARD_SETTINGS, DEFAULT_PRINTER_SETTINGS
} from "../types";
import { createPixPayment, cancelPixPayment, startPixPolling, PixPaymentResult } from "../lib/pix";

import type { Product, CartItem } from "../types";
import { useSession } from "../components/SessionGate";

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PAYMENT_METHODS = [
  { value: "Dinheiro", label: "Dinheiro", icon: "💵" },
  { value: "Cartão de Crédito", label: "Crédito", icon: "💳" },
  { value: "Cartão de Débito", label: "Débito", icon: "💳" },
  { value: "Pix", label: "Pix", icon: "📱" },
  { value: "Vale Alimentação", label: "VA", icon: "🎫" },
  { value: "Vale Refeição", label: "VR", icon: "🍽️" },
];

export default function PDV() {
  const { user } = useSession();
  const [search, setSearch] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Dinheiro");
  const [amountReceived, setAmountReceived] = useState<string>("");
  const [customerDocument, setCustomerDocument] = useState("");
  const [showCpfField, setShowCpfField] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [quickQty, setQuickQty] = useState(1);
  const [saleSuccessData, setSaleSuccessData] = useState<{
    total: number;
    received: number;
    change: number;
    paymentMethod: string;
  } | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<CartItem[][]>([]);

  const barcodeRef = useRef<HTMLInputElement>(null);

  const [pixModal, setPixModal] = useState<PixPaymentResult | null>(null);
  const [pixPollingStop, setPixPollingStop] = useState<(() => void) | null>(null);
  const [pixError, setPixError] = useState("");
  const [cardModal, setCardModal] = useState(false);
  const [store, setStore] = useState<StoreSettings | null>(null);

  useEffect(() => {
    api.getStoreSettings().then(setStore).catch(console.error);
  }, []);


  useEffect(() => {
    api.listProducts(search).then(setProducts).catch(console.error);
  }, [search]);

  // Auto-focus barcode input
  useEffect(() => {
    barcodeRef.current?.focus();
  }, [cart]);

  // Barcode scan handler
  const handleBarcodeScan = async (code: string) => {
    if (!code.trim()) return;

    // Try exact barcode match first
    const found = await api.findProductByBarcode(code.trim()).catch(() => null);
    if (found) {
      for (let i = 0; i < quickQty; i++) {
        addToCart(found);
      }
      setBarcodeInput("");
      setQuickQty(1);
      return;
    }

    // Try scale barcode decode
    const scaleProduct = await api.decodeScaleBarcode(code.trim()).catch(() => null);
    if (scaleProduct) {
      // Scale barcode: extract weight/price from barcode
      // Format: 2 digits prefix + 5 digits weight/price + 1 check digit
      const numericPart = code.replace(/\D/g, "");
      if (numericPart.length >= 7) {
        // Try to extract price (last 5 digits before check digit, divided by 100)
        const priceStr = numericPart.substring(numericPart.length - 6, numericPart.length - 1);
        const extractedPrice = parseInt(priceStr) / 100;
        if (extractedPrice > 0 && extractedPrice < 1000) {
          const qty = extractedPrice / scaleProduct.price;
          if (qty > 0 && qty < 100) {
            for (let i = 0; i < quickQty; i++) {
              setCart((prev) => {
                const existing = prev.find((item) => item.product_id === scaleProduct.id);
                if (existing) {
                  return prev.map((item) =>
                    item.product_id === scaleProduct.id
                      ? { ...item, quantity: item.quantity + 1 }
                      : item
                  );
                }
                return [...prev, {
                  product_id: scaleProduct.id,
                  name: scaleProduct.name,
                  category: scaleProduct.category,
                  unit_price: scaleProduct.price,
                  quantity: parseFloat(qty.toFixed(3)),
                }];
              });
            }
            setBarcodeInput("");
            setQuickQty(1);
            return;
          }
        }
      }
      // Fallback: add at unit price
      for (let i = 0; i < quickQty; i++) {
        addToCart(scaleProduct);
      }
      setBarcodeInput("");
      setQuickQty(1);
      return;
    }

    // Not found — add to search
    setSearch(code.trim());
    setBarcodeInput("");
  };

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === p.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === p.id ? { ...i, quantity: i.quantity + quickQty } : i
        );
      }
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          category: p.category,
          unit_price: p.price,
          quantity: quickQty,
        },
      ];
    });
    setQuickQty(1);
  };

  const updateQuantity = (id: number, qty: number) => {
    if (qty <= 0) {
      removeItem(id);
      return;
    }
    setCart((prev) =>
      prev.map((i) => (i.product_id === id ? { ...i, quantity: qty } : i))
    );
  };

  const removeItem = (id: number) =>
    setCart((prev) => prev.filter((i) => i.product_id !== id));

  const cancelSale = () => {
    if (confirm("Deseja cancelar esta venda?")) {
      setCart([]);
      setAmountReceived("");
      setCustomerDocument("");
      setPaymentMethod("Dinheiro");
    }
  };

  const total = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const numReceived = parseFloat(amountReceived.replace(",", ".")) || 0;
  const change = numReceived - total;

  const finalizeSale = async (overridePayment?: string) => {
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

  const handleQuickMoney = (val: number) => {
    setAmountReceived(val.toString());
  };

  return (
    <div className="grid grid-cols-3 gap-6 h-full relative animate-fade-in">
      {/* Catálogo de produtos */}
      <div className="col-span-2 flex flex-col gap-4">
        {/* Barcode input + quantity shortcuts */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm">📷</span>
            <input
              ref={barcodeRef}
              className="input pl-10 font-mono"
              placeholder="Leia ou digite o código de barras..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleBarcodeScan(barcodeInput);
                }
              }}
            />
          </div>
          <div className="flex items-center gap-1 bg-ink-50 rounded-xl border border-ink-200/60 p-1">
            {[1, 2, 3, 5, 10].map((q) => (
              <button
                key={q}
                onClick={() => setQuickQty(q)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                  quickQty === q
                    ? "bg-brand-500 text-white shadow-brand"
                    : "text-ink-600 hover:bg-white hover:shadow-soft"
                }`}
              >
                {q}x
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm">🔍</span>
          <input
            className="input pl-10"
            placeholder="Buscar produto por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Products grid */}
        {/* Colunas se ajustam ao tamanho do card (mín. 190px): com poucos produtos os cards não esticam pela tela toda */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3 overflow-y-auto pr-1 flex-1 content-start">
          {products.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="card-elevated p-4 text-left group animate-slide-up"
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              <div className="font-semibold text-ink-900 group-hover:text-brand-700 transition-colors truncate">
                {p.name}
              </div>
              <div className="text-xs text-ink-500 mb-2 font-medium">{p.category}</div>
              <div className="flex items-center justify-between">
                <span className="text-brand-600 font-bold">{currency(p.price)}</span>
                {p.unit_type !== "UN" && (
                  <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold border border-blue-200/30">{p.unit_type}</span>
                )}
                {p.stock <= p.min_stock && (
                  <span className="badge-danger text-[10px]">Baixo</span>
                )}
              </div>
            </button>
          ))}
          {products.length === 0 && (
            <div className="col-span-full text-center py-16">
              <div className="text-4xl mb-3">📦</div>
              <div className="text-ink-500 font-medium">Nenhum produto encontrado</div>
            </div>
          )}
        </div>
      </div>

      {/* Carrinho */}
      <div className="card-elevated flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-ink-100/60 bg-gradient-to-r from-ink-50/80 to-white/80">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
          </div>
          <span className="text-xs text-ink-500 ml-2 font-medium">Terminal de Vendas</span>
          <span className="ml-auto badge-brand text-[10px]">
            {cart.length} {cart.length === 1 ? "item" : "itens"}
          </span>
          {offlineQueue.length > 0 && (
            <span className="badge-warning text-[10px] animate-pulse-soft">
              ⚡ {offlineQueue.length} offline
            </span>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto divide-y divide-ink-100/40">
          {cart.map((item, idx) => (
            <div key={item.product_id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-ink-50/50 transition-colors animate-slide-up">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center border border-brand-200/30">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-ink-900 truncate">{item.name}</div>
                <div className="text-xs text-ink-500">{currency(item.unit_price)} un.</div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)} className="w-6 h-6 rounded bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-xs font-bold text-ink-600">−</button>
                <span className="w-8 text-center text-xs font-bold text-ink-900">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)} className="w-6 h-6 rounded bg-brand-100 hover:bg-brand-200 flex items-center justify-center text-xs font-bold text-brand-700">+</button>
              </div>
              <div className="font-bold text-sm text-ink-900 w-20 text-right">{currency(item.unit_price * item.quantity)}</div>
              <button onClick={() => removeItem(item.product_id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-ink-400 hover:text-red-500 hover:bg-red-50 transition-all text-xs">✕</button>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="text-center py-12">
              <div className="text-3xl mb-2">🛒</div>
              <div className="text-ink-500 text-sm font-medium">Carrinho vazio</div>
              <div className="text-ink-400 text-xs mt-1">Leia um código de barras ou toque em um produto</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-ink-100/60 px-5 py-4 space-y-3 bg-gradient-to-b from-white/80 to-white/60">
          <div className="flex justify-between items-center">
            <span className="font-bold text-lg text-ink-900">TOTAL</span>
            <span className="font-extrabold text-xl gradient-text">{currency(total)}</span>
          </div>

          {/* CPF/CNPJ toggle */}
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCpfField(!showCpfField)} className="text-xs text-brand-600 hover:text-brand-700 font-semibold">
              {showCpfField ? "✕ Ocultar CPF" : "📋 Informar CPF/CNPJ"}
            </button>
          </div>
          {showCpfField && (
            <input className="input text-sm" placeholder="CPF ou CNPJ do cliente" value={customerDocument} onChange={(e) => setCustomerDocument(e.target.value)} />
          )}

          {/* Payment method buttons */}
          <div className="grid grid-cols-3 gap-1.5">
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.value}
                onClick={() => { setPaymentMethod(pm.value); if (pm.value !== "Dinheiro") setAmountReceived(""); }}
                className={`flex flex-col items-center gap-0.5 p-2 rounded-xl text-xs font-semibold transition-all border ${
                  paymentMethod === pm.value
                    ? "bg-brand-50 border-brand-300 text-brand-700 shadow-sm"
                    : "border-ink-200/60 text-ink-600 hover:bg-ink-50 hover:border-ink-300"
                }`}
              >
                <span className="text-base">{pm.icon}</span>
                <span>{pm.label}</span>
              </button>
            ))}
          </div>

          {/* Cash input */}
          {paymentMethod === "Dinheiro" && (
            <div className="p-3 bg-ink-50/60 rounded-xl border border-ink-200/40 space-y-2">
              <input
                type="number" step="0.01" min="0"
                className="input font-semibold text-sm"
                placeholder={`Valor entregue (ex: ${total.toFixed(2)})`}
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
              />
              <div className="flex flex-wrap gap-1">
                <button onClick={() => handleQuickMoney(total)} disabled={total === 0} className="text-[10px] bg-white border border-ink-200 hover:border-brand-400 font-medium px-2 py-1 rounded-lg transition-all disabled:opacity-40">
                  Exato ({currency(total)})
                </button>
                {[10, 20, 50, 100].map((v) => (
                  <button key={v} onClick={() => handleQuickMoney(v)} className="text-[10px] bg-white border border-ink-200 hover:border-brand-400 font-medium px-2 py-1 rounded-lg transition-all">
                    R$ {v}
                  </button>
                ))}
              </div>
              {amountReceived !== "" && numReceived > 0 && (
                <div className="animate-slide-up">
                  {change >= 0 ? (
                    <div className="p-2 bg-emerald-50 border border-emerald-200/60 rounded-lg flex justify-between items-center">
                      <span className="text-[10px] font-semibold text-emerald-700">TROCO</span>
                      <span className="font-extrabold text-base text-emerald-600">{currency(change)}</span>
                    </div>
                  ) : (
                    <div className="p-2 bg-amber-50 border border-amber-200/60 rounded-lg flex justify-between items-center">
                      <span className="text-[10px] font-semibold text-amber-700">FALTAM</span>
                      <span className="font-bold text-amber-600">{currency(Math.abs(change))}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Finalize + Cancel */}
          <div className="flex gap-2">
            <button className="btn-primary flex-1 py-3" onClick={() => finalizeSale()}
              disabled={finalizing || cart.length === 0 || (paymentMethod === "Dinheiro" && amountReceived !== "" && numReceived < total)}>
              {finalizing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Finalizando...
                </span>
              ) : "Finalizar Venda"}
            </button>
            <button className="btn-outline px-3 text-red-500 border-red-200 hover:bg-red-50" onClick={cancelSale} disabled={cart.length === 0}>
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Success modal */}
      {saleSuccessData && (
        <div className="glass-overlay animate-fade-in">
          <div className="card-elevated max-w-md w-full p-8 text-center space-y-5 animate-scale-in">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-brand">✓</div>
            <div>
              <h3 className="text-xl font-bold text-ink-900">Venda Concluída!</h3>
              <p className="text-sm text-ink-500 mt-1">Pagamento via {saleSuccessData.paymentMethod}</p>
            </div>
            <div className="bg-ink-50/60 border border-ink-200/40 rounded-xl p-4 space-y-2.5 text-left">
              <div className="flex justify-between text-sm text-ink-700">
                <span>Total:</span><span className="font-semibold">{currency(saleSuccessData.total)}</span>
              </div>
              {saleSuccessData.paymentMethod === "Dinheiro" && (
                <>
                  <div className="flex justify-between text-sm text-ink-700">
                    <span>Recebido:</span><span className="font-semibold">{currency(saleSuccessData.received)}</span>
                  </div>
                  <div className="border-t border-ink-200/60 pt-2 flex justify-between">
                    <span className="font-bold text-emerald-800 text-sm">TROCO:</span>
                    <span className="font-extrabold text-2xl gradient-text">{currency(saleSuccessData.change)}</span>
                  </div>
                </>
              )}
            </div>
            
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

          </div>
        </div>
      )}

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

    </div>
  );
}
