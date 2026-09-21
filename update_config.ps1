$content = Get-Content -Path "src\pages\Configuracoes.tsx" -Raw -Encoding UTF8

$importStr = "import type { StoreSettings } from `"../types`";"
$newImportStr = "import { StoreSettings, PixSettings, CardMachineSettings, DEFAULT_PIX_SETTINGS, DEFAULT_CARD_SETTINGS, LS_PIX_KEY, LS_CARD_KEY, CardAcquirer } from `"../types`";"
$content = $content.Replace($importStr, $newImportStr)

$stateStr = "const [storeSaved, setStoreSaved] = useState(false);"
$newStateStr = $stateStr + "`n  const [pix, setPix] = useState<PixSettings>(() => { try { const raw = localStorage.getItem(LS_PIX_KEY); return raw ? { ...DEFAULT_PIX_SETTINGS, ...JSON.parse(raw) } : DEFAULT_PIX_SETTINGS; } catch { return DEFAULT_PIX_SETTINGS; } });`n  const [card, setCard] = useState<CardMachineSettings>(() => { try { const raw = localStorage.getItem(LS_CARD_KEY); return raw ? { ...DEFAULT_CARD_SETTINGS, ...JSON.parse(raw) } : DEFAULT_CARD_SETTINGS; } catch { return DEFAULT_CARD_SETTINGS; } });`n  const [paymentSaved, setPaymentSaved] = useState(false);`n  const savePaymentSettings = () => { localStorage.setItem(LS_PIX_KEY, JSON.stringify(pix)); localStorage.setItem(LS_CARD_KEY, JSON.stringify(card)); setPaymentSaved(true); setTimeout(() => setPaymentSaved(false), 3000); };"
$content = $content.Replace($stateStr, $newStateStr)

$jsxStr = "      {/* About card */}"
$newJsxStr = @"
      {/* Payment Settings Card */}
      <div className="card-elevated p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-lg border border-green-200/30">
            💳
          </div>
          <div>
            <h2 className="font-bold text-ink-900">Integrações de Pagamento</h2>
            <p className="text-xs text-ink-500">Configurações de PIX dinâmico e Maquininha de Cartão</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border border-ink-200/50 rounded-xl p-4 bg-ink-50/30">
            <h3 className="font-bold text-sm mb-3">PIX (Mercado Pago)</h3>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Habilitar PIX Dinâmico</span>
              <button
                onClick={() => setPix({ ...pix, enabled: !pix.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${pix.enabled ? "bg-brand-500" : "bg-ink-200"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${pix.enabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            {pix.enabled && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-ink-400 uppercase block mb-1">Access Token de Produção</label>
                  <input className="input text-sm" placeholder="APP_USR-..." value={pix.mp_access_token} onChange={e => setPix({...pix, mp_access_token: e.target.value})} />
                </div>
              </div>
            )}
          </div>

          <div className="border border-ink-200/50 rounded-xl p-4 bg-ink-50/30">
            <h3 className="font-bold text-sm mb-3">Maquininha de Cartão</h3>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Habilitar Maquininha</span>
              <button
                onClick={() => setCard({ ...card, enabled: !card.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${card.enabled ? "bg-brand-500" : "bg-ink-200"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${card.enabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            {card.enabled && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-ink-400 uppercase block mb-1">Adquirente</label>
                  <select className="input text-sm" value={card.acquirer} onChange={e => setCard({...card, acquirer: e.target.value as CardAcquirer})}>
                    <option value="Stone">Stone</option>
                    <option value="Cielo">Cielo</option>
                    <option value="Rede">Rede</option>
                    <option value="PagBank">PagBank</option>
                    <option value="Getnet">Getnet</option>
                    <option value="Mercado Pago">Mercado Pago</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button onClick={savePaymentSettings} className="btn-primary flex items-center gap-2">
              💾 Salvar Integrações
            </button>
            {paymentSaved && (
              <div className="p-2 bg-emerald-50 border border-emerald-200/60 rounded-xl text-sm text-emerald-700 font-medium animate-slide-up">
                ✓ Salvo com sucesso!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* About card */}
"@
$content = $content.Replace($jsxStr, $newJsxStr)

Set-Content -Path "src\pages\Configuracoes.tsx" -Value $content -Encoding UTF8
Write-Output "Updated Configuracoes.tsx"
