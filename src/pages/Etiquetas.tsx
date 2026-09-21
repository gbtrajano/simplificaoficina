import { useEffect, useState, useRef, useCallback } from "react";
import JsBarcode from "jsbarcode";
import { api } from "../lib/api";
import type { Product, LabelTemplate } from "../types";

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const defaultTemplate: Omit<LabelTemplate, "id" | "created_at"> = {
  name: "Etiqueta Padrão",
  width_mm: 70,
  height_mm: 40,
  show_name: true,
  show_price: true,
  show_barcode: true,
  show_category: false,
  show_unit: false,
  font_size_price: 24,
  font_size_name: 10,
  unit_text: "UN",
};

const presetSizes = [
  { label: "70×40mm (Padrão)", width: 70, height: 40 },
  { label: "50×30mm (Pequena)", width: 50, height: 30 },
  { label: "100×50mm (Grande)", width: 100, height: 50 },
  { label: "100×70mm (Jumbo)", width: 100, height: 70 },
];

interface LabelProps {
  product: Product;
  template: Omit<LabelTemplate, "id" | "created_at">;
}

function LabelComponent({ product, template }: LabelProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && template.show_barcode && product.barcode) {
      try {
        JsBarcode(barcodeRef.current, product.barcode, {
          format: "CODE128",
          width: 1.2,
          height: 30,
          displayValue: true,
          fontSize: 10,
          margin: 2,
          textMargin: 1,
        });
      } catch {
        // Invalid barcode value, show placeholder
        if (barcodeRef.current) {
          barcodeRef.current.innerHTML = "";
        }
      }
    }
  }, [product.barcode, template.show_barcode]);

  const widthPx = template.width_mm * 3.7795; // mm to px at 96dpi
  const heightPx = template.height_mm * 3.7795;

  return (
    <div
      className="label-item bg-white border border-gray-300 flex flex-col items-center justify-between p-1.5 overflow-hidden"
      style={{
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        pageBreakInside: "avoid",
        breakInside: "avoid",
        flexShrink: 0,
      }}
    >
      {/* Product Name */}
      {template.show_name && (
        <div
          className="font-bold text-center text-gray-900 leading-tight w-full truncate"
          style={{ fontSize: `${template.font_size_name}px` }}
        >
          {product.name}
        </div>
      )}

      {/* Category */}
      {template.show_category && product.category && (
        <div className="text-[7px] text-gray-500 uppercase tracking-wider">
          {product.category}
        </div>
      )}

      {/* Price */}
      {template.show_price && (
        <div
          className="font-black text-gray-900 text-center leading-none"
          style={{ fontSize: `${template.font_size_price}px` }}
        >
          {currency(product.price)}
        </div>
      )}

      {/* Unit */}
      {template.show_unit && (
        <div className="text-[8px] text-gray-600 font-semibold">
          {template.unit_text}
        </div>
      )}

      {/* Barcode */}
      {template.show_barcode && product.barcode && (
        <div className="w-full flex justify-center">
          <svg ref={barcodeRef} className="max-w-full" />
        </div>
      )}
      {template.show_barcode && !product.barcode && (
        <div className="text-[8px] text-gray-400 italic">Sem código de barras</div>
      )}
    </div>
  );
}

export default function Etiquetas() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [template, setTemplate] = useState<Omit<LabelTemplate, "id" | "created_at">>(defaultTemplate);
  const [quantityPerProduct, setQuantityPerProduct] = useState<Record<number, number>>({});
  const [savedTemplates, setSavedTemplates] = useState<LabelTemplate[]>([]);
  const [templateName, setTemplateName] = useState("Etiqueta Padrão");
  const [printMode, setPrintMode] = useState<"preview" | "print">("preview");

  const loadProducts = () => api.listProducts(search).then(setProducts);
  const loadTemplates = () => api.listLabelTemplates().then(setSavedTemplates).catch(console.error);

  useEffect(() => {
    loadProducts();
    loadTemplates();
  }, [search]);

  const toggleProduct = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  const setQty = (id: number, qty: number) => {
    setQuantityPerProduct((prev) => ({ ...prev, [id]: Math.max(1, qty) }));
  };

  const getSelectedProducts = useCallback(() => {
    const result: Product[] = [];
    products.forEach((p) => {
      if (selectedIds.has(p.id)) {
        const qty = quantityPerProduct[p.id] || 1;
        for (let i = 0; i < qty; i++) {
          result.push(p);
        }
      }
    });
    return result;
  }, [products, selectedIds, quantityPerProduct]);

  const labelsToPrint = getSelectedProducts();

  const handlePrint = () => {
    setPrintMode("print");
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintMode("preview"), 500);
    }, 100);
  };

  const saveTemplate = async () => {
    const t = await api.saveLabelTemplate({ ...template, name: templateName });
    loadTemplates();
    alert("Modelo salvo com sucesso!");
  };

  const loadTemplate = (t: LabelTemplate) => {
    setTemplate({
      name: t.name,
      width_mm: t.width_mm,
      height_mm: t.height_mm,
      show_name: t.show_name,
      show_price: t.show_price,
      show_barcode: t.show_barcode,
      show_category: t.show_category,
      show_unit: t.show_unit,
      font_size_price: t.font_size_price,
      font_size_name: t.font_size_name,
      unit_text: t.unit_text,
    });
    setTemplateName(t.name);
  };

  const deleteTemplate = async (id: number) => {
    if (!confirm("Remover este modelo?")) return;
    await api.deleteLabelTemplate(id);
    loadTemplates();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 5mm;
          }
          .label-grid {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 2mm !important;
            justify-content: flex-start !important;
          }
          .label-item {
            border: 0.5pt solid #000 !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Etiquetas</h1>
          <p>Configure e imprima etiquetas de produtos para o mercado.</p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={handlePrint}
          disabled={labelsToPrint.length === 0}
        >
          🖨️ Imprimir ({labelsToPrint.length} etiquetas)
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left panel - Product selection + Config */}
        <div className="col-span-5 space-y-4 no-print">
          {/* Product selection */}
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-ink-900">Produtos</h2>
              <button
                onClick={selectAll}
                className="text-xs text-brand-600 hover:text-brand-700 font-semibold"
              >
                {selectedIds.size === products.length ? "Desmarcar tudo" : "Selecionar tudo"}
              </button>
            </div>
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm">🔍</span>
              <input
                className="input pl-9 text-sm"
                placeholder="Buscar produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {products.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedIds.has(p.id)
                      ? "bg-brand-50 border border-brand-200/50"
                      : "hover:bg-ink-50 border border-transparent"
                  }`}
                  onClick={() => toggleProduct(p.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleProduct(p.id)}
                    className="w-4 h-4 rounded border-ink-300 text-brand-500 focus:ring-brand-400"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-900 truncate">{p.name}</div>
                    <div className="text-xs text-ink-500">
                      {p.category} · {currency(p.price)}
                    </div>
                  </div>
                  {selectedIds.has(p.id) && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setQty(p.id, (quantityPerProduct[p.id] || 1) - 1)}
                        className="w-6 h-6 rounded bg-ink-200 hover:bg-ink-300 flex items-center justify-center text-xs font-bold text-ink-700 transition-colors"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-ink-900">
                        {quantityPerProduct[p.id] || 1}
                      </span>
                      <button
                        onClick={() => setQty(p.id, (quantityPerProduct[p.id] || 1) + 1)}
                        className="w-6 h-6 rounded bg-brand-100 hover:bg-brand-200 flex items-center justify-center text-xs font-bold text-brand-700 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Template configuration */}
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm shadow-brand">
                ⚙️
              </div>
              <h2 className="font-bold text-ink-900">Configuração da Etiqueta</h2>
            </div>

            {/* Template name & size */}
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">
                  Nome do Modelo
                </label>
                <input
                  className="input text-sm"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">
                  Tamanho da Etiqueta
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {presetSizes.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setTemplate({ ...template, width_mm: s.width, height_mm: s.height })}
                      className={`text-xs p-2 rounded-lg border transition-all ${
                        template.width_mm === s.width && template.height_mm === s.height
                          ? "bg-brand-50 border-brand-300 text-brand-700 font-semibold"
                          : "border-ink-200 hover:border-ink-300 text-ink-700"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <div className="flex-1">
                    <label className="text-[9px] text-ink-400 block mb-0.5">Largura (mm)</label>
                    <input
                      type="number"
                      className="input text-sm text-center"
                      value={template.width_mm}
                      onChange={(e) => setTemplate({ ...template, width_mm: parseFloat(e.target.value) || 70 })}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] text-ink-400 block mb-0.5">Altura (mm)</label>
                    <input
                      type="number"
                      className="input text-sm text-center"
                      value={template.height_mm}
                      onChange={(e) => setTemplate({ ...template, height_mm: parseFloat(e.target.value) || 40 })}
                    />
                  </div>
                </div>
              </div>

              {/* Fields to show */}
              <div>
                <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">
                  Campos Visíveis
                </label>
                <div className="space-y-2">
                  {[
                    { key: "show_name", label: "Nome do Produto" },
                    { key: "show_price", label: "Preço" },
                    { key: "show_barcode", label: "Código de Barras" },
                    { key: "show_category", label: "Categoria" },
                    { key: "show_unit", label: "Unidade de Medida" },
                  ].map((f) => (
                    <label key={f.key} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={(template as any)[f.key]}
                        onChange={(e) => setTemplate({ ...template, [f.key]: e.target.checked })}
                        className="w-4 h-4 rounded border-ink-300 text-brand-500 focus:ring-brand-400"
                      />
                      <span className="text-sm text-ink-700 group-hover:text-ink-900 transition-colors">
                        {f.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Font sizes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">
                    Tamanho Preço
                  </label>
                  <input
                    type="range"
                    min="12"
                    max="40"
                    value={template.font_size_price}
                    onChange={(e) => setTemplate({ ...template, font_size_price: parseInt(e.target.value) })}
                    className="w-full accent-brand-500"
                  />
                  <div className="text-center text-xs text-ink-500 font-mono">{template.font_size_price}px</div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">
                    Tamanho Nome
                  </label>
                  <input
                    type="range"
                    min="6"
                    max="16"
                    value={template.font_size_name}
                    onChange={(e) => setTemplate({ ...template, font_size_name: parseInt(e.target.value) })}
                    className="w-full accent-brand-500"
                  />
                  <div className="text-center text-xs text-ink-500 font-mono">{template.font_size_name}px</div>
                </div>
              </div>

              {/* Unit text */}
              {template.show_unit && (
                <div>
                  <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5 block">
                    Texto da Unidade
                  </label>
                  <input
                    className="input text-sm"
                    placeholder="Ex: UN, KG, LT"
                    value={template.unit_text}
                    onChange={(e) => setTemplate({ ...template, unit_text: e.target.value })}
                  />
                </div>
              )}

              {/* Save/Load templates */}
              <div className="pt-2 border-t border-ink-100/60 space-y-2">
                <button className="btn-primary w-full text-sm" onClick={saveTemplate}>
                  💾 Salvar Modelo
                </button>
                {savedTemplates.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
                      Modelos Salvos
                    </div>
                    {savedTemplates.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 p-2 bg-ink-50/60 rounded-lg border border-ink-200/30">
                        <button
                          onClick={() => loadTemplate(t)}
                          className="flex-1 text-left text-xs font-medium text-ink-700 hover:text-brand-600 transition-colors"
                        >
                          {t.name} ({t.width_mm}×{t.height_mm}mm)
                        </button>
                        <button
                          onClick={() => deleteTemplate(t.id)}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right panel - Preview */}
        <div className="col-span-7">
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-ink-900">
                Pré-visualização
                <span className="text-sm font-normal text-ink-500 ml-2">
                  ({labelsToPrint.length} etiquetas)
                </span>
              </h2>
              <button
                className="btn-primary text-sm flex items-center gap-1.5"
                onClick={handlePrint}
                disabled={labelsToPrint.length === 0}
              >
                🖨️ Imprimir
              </button>
            </div>

            {labelsToPrint.length === 0 ? (
              <div className="text-center py-16 bg-ink-50/30 rounded-xl border border-dashed border-ink-200">
                <div className="text-4xl mb-3">🏷️</div>
                <div className="text-ink-500 font-medium">Nenhuma etiqueta para imprimir</div>
                <div className="text-ink-400 text-xs mt-1">
                  Selecione produtos no painel ao lado e configure a etiqueta
                </div>
              </div>
            ) : (
              <div className={printMode === "print" ? "print-area" : ""}>
                <div className="label-grid flex flex-wrap gap-3">
                  {labelsToPrint.map((p, idx) => (
                    <LabelComponent key={`${p.id}-${idx}`} product={p} template={template} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
