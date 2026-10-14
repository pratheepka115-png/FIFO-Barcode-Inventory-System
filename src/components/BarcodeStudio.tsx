import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  QrCode,
  Printer,
  Copy,
  Sliders,
  Check,
  Tag,
  Calendar,
  MapPin,
  Building,
  RefreshCw,
  Eye,
  Download,
  IndianRupee,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { renderBarcodeToSvg, downloadBarcodePng } from '../utils/barcode';
import { calculateShelfLifeStatus, formatDate } from '../utils/shelfLife';
import { formatINR } from '../utils/currency';
import { InventoryBatch } from '../types/inventory';
import { soundFx } from '../utils/sound';

type LabelTitleMode = 'product_name' | 'company_name' | 'lot_tag' | 'custom';

export const BarcodeStudio: React.FC = () => {
  const {
    batches,
    settings,
    selectedBatchForDetail,
  } = useInventory();

  // Active lot for label printing
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [labelCopies, setLabelCopies] = useState<number>(4);
  const [labelSize, setLabelSize] = useState<'4x2' | '3x2' | '2x1' | 'sheet'>('4x2');
  const [titleMode, setTitleMode] = useState<LabelTitleMode>('product_name');
  const [customHeaderText, setCustomHeaderText] = useState<string>('');

  // Toggles
  const [includeShelfLifeBadge, setIncludeShelfLifeBadge] = useState<boolean>(true);
  const [includeLocation, setIncludeLocation] = useState<boolean>(true);
  const [includeDates, setIncludeDates] = useState<boolean>(true);
  const [includePriceINR, setIncludePriceINR] = useState<boolean>(true);
  const [includeSupplier, setIncludeSupplier] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // SVG ref for on-screen live preview
  const previewSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (selectedBatchForDetail && selectedBatchForDetail.batch_id) {
      setSelectedBatchId(selectedBatchForDetail.batch_id);
    } else if (batches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(batches[0].batch_id);
    }
  }, [selectedBatchForDetail, batches, selectedBatchId]);

  const activeBatch: InventoryBatch = useMemo(() => {
    return batches.find((b) => b.batch_id === selectedBatchId) || batches[0] || ({} as InventoryBatch);
  }, [batches, selectedBatchId]);

  const resolvedLabelHeader = useMemo(() => {
    if (titleMode === 'custom' && customHeaderText.trim()) {
      return customHeaderText.trim();
    }
    if (titleMode === 'company_name') {
      return settings.company?.name || 'ABC Logistics & Supply Chain';
    }
    if (titleMode === 'lot_tag') {
      return `FIFO LOT: ${activeBatch.batch_number || 'LOT-001'}`;
    }
    return activeBatch.product_name
      ? `${activeBatch.product_name}`
      : (settings.company?.name || 'ABC Logistics & Supply Chain');
  }, [titleMode, customHeaderText, activeBatch, settings.company]);

  // Render on-screen preview barcode
  useEffect(() => {
    if (activeBatch && activeBatch.barcode && previewSvgRef.current) {
      renderBarcodeToSvg(previewSvgRef.current, activeBatch.barcode, {
        width: labelSize === '2x1' ? 1.4 : labelSize === '3x2' ? 1.8 : 2,
        height: labelSize === '2x1' ? 36 : labelSize === '3x2' ? 44 : 52,
        fontSize: labelSize === '2x1' ? 10 : 12,
        displayValue: true,
      });
    }
  }, [activeBatch, labelSize, selectedBatchId]);

  const status = activeBatch?.expiry_date
    ? calculateShelfLifeStatus(activeBatch.expiry_date, activeBatch.manufacturing_date)
    : null;

  const handleCopyBarcode = () => {
    if (!activeBatch?.barcode) return;
    navigator.clipboard.writeText(activeBatch.barcode);
    setCopiedText(true);
    soundFx.playBarcodeBeep();
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleDownloadPng = () => {
    if (!activeBatch?.barcode) return;
    downloadBarcodePng(activeBatch.barcode, `${activeBatch.product_code || 'BARCODE'}_${activeBatch.batch_number}`);
    soundFx.playSuccessChime();
  };

  const handlePrint = () => {
    soundFx.playBarcodeBeep();
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-2xs">
              <QrCode className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                Barcode Generator & Thermal Label Studio
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Generate GS1-compliant Code128 barcodes, thermal adhesive stickers, and warehouse pallet tags.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print {labelCopies} Sticker{labelCopies > 1 ? 's' : ''}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configuration Controls */}
        <div className="lg:col-span-6 space-y-4">
          {/* Batch Selector Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
              Select Batch Lot to Generate Label
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 font-bold focus:outline-none"
            >
              {batches.map((b) => (
                <option key={b.batch_id} value={b.batch_id}>
                  {b.product_name} — Lot: {b.batch_number} ({b.location_code})
                </option>
              ))}
            </select>
          </div>

          {/* Label Dimensions & Settings */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Label Template & Geometry
            </h3>

            {/* Sizes */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: '4x2', label: '4" × 2"', sub: 'Standard Pallet' },
                { id: '3x2', label: '3" × 2"', sub: 'Carton Box' },
                { id: '2x1', label: '2" × 1"', sub: 'Item Sticker' },
                { id: 'sheet', label: 'A4 Sheet', sub: 'Multi-Grid' },
              ].map((sz) => (
                <button
                  key={sz.id}
                  type="button"
                  onClick={() => setLabelSize(sz.id as any)}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    labelSize === sz.id
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-semibold'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold">{sz.label}</div>
                  <div className={`text-[10px] ${labelSize === sz.id ? 'text-slate-300' : 'text-slate-400'}`}>
                    {sz.sub}
                  </div>
                </button>
              ))}
            </div>

            {/* Copies */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Print Quantity (Copies)</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={labelCopies}
                  onChange={(e) => setLabelCopies(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Header Title Mode</label>
                <select
                  value={titleMode}
                  onChange={(e) => setTitleMode(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                >
                  <option value="product_name">Product Name & SKU</option>
                  <option value="company_name">Company Legal Name</option>
                  <option value="lot_tag">Lot Tag & Sequence</option>
                  <option value="custom">Custom Title Text</option>
                </select>
              </div>
            </div>

            {titleMode === 'custom' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Custom Header String</label>
                <input
                  type="text"
                  value={customHeaderText}
                  onChange={(e) => setCustomHeaderText(e.target.value)}
                  placeholder="e.g. ABC LOGISTICS COLD STORAGE VAULT"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
            )}

            {/* Inclusions */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="text-[11px] font-semibold text-slate-700 block">Elements Included on Tag:</span>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDates}
                    onChange={(e) => setIncludeDates(e.target.checked)}
                    className="rounded text-slate-900"
                  />
                  <span>Mfg & Expiry Dates</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeLocation}
                    onChange={(e) => setIncludeLocation(e.target.checked)}
                    className="rounded text-slate-900"
                  />
                  <span>Warehouse Bin Location</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeShelfLifeBadge}
                    onChange={(e) => setIncludeShelfLifeBadge(e.target.checked)}
                    className="rounded text-slate-900"
                  />
                  <span>Shelf-Life Zone Indicator</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePriceINR}
                    onChange={(e) => setIncludePriceINR(e.target.checked)}
                    className="rounded text-slate-900"
                  />
                  <span>Unit Rate & Selling Price (₹)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Thermal Sticker Preview */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Live Thermal Tag Render</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyBarcode}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] flex items-center gap-1"
                >
                  {copiedText ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedText ? 'Copied' : 'Copy Data'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  <span>PNG</span>
                </button>
              </div>
            </div>

            {/* Sticker Preview Box */}
            <div className="bg-slate-100/70 p-6 rounded-xl border border-slate-200/80 flex items-center justify-center">
              <div
                className={`bg-white text-slate-900 p-4 rounded-lg border-2 border-slate-900 shadow-md font-sans text-xs space-y-2 ${
                  labelSize === '2x1' ? 'w-64' : labelSize === '3x2' ? 'w-80' : 'w-96'
                }`}
              >
                {/* Header */}
                <div className="flex justify-between items-start border-b border-slate-900 pb-1.5">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 leading-tight uppercase truncate max-w-[200px]">
                      {resolvedLabelHeader}
                    </h4>
                    <p className="text-[10px] text-slate-600 font-mono-code">
                      SKU: {activeBatch.product_code || 'PR001'} · {activeBatch.category || 'Inventory'}
                    </p>
                  </div>
                  {includeShelfLifeBadge && status && (
                    <span className="px-1.5 py-0.2 rounded border border-slate-900 font-mono-code font-bold text-[9px] uppercase">
                      {status.zone} ({status.daysRemaining}d)
                    </span>
                  )}
                </div>

                {/* Body Meta */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono-code">
                  <div>
                    <span className="text-slate-500 block">LOT / BATCH:</span>
                    <strong className="text-slate-900 text-xs">{activeBatch.batch_number || 'BT-2024'}</strong>
                  </div>
                  {includeLocation && (
                    <div>
                      <span className="text-slate-500 block">BIN LOCATION:</span>
                      <strong className="text-slate-900 text-xs">{activeBatch.location_code || 'A-01-1'}</strong>
                    </div>
                  )}
                </div>

                {includeDates && (
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono-code border-t border-slate-200 pt-1">
                    <div>
                      <span className="text-slate-500 block">MFG:</span>
                      <span>{formatDate(activeBatch.manufacturing_date)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">EXPIRY (FEFO):</span>
                      <strong className="text-slate-900">{formatDate(activeBatch.expiry_date)}</strong>
                    </div>
                  </div>
                )}

                {/* Barcode Render SVG */}
                <div className="pt-2 flex flex-col items-center justify-center">
                  <svg ref={previewSvgRef} className="max-w-full"></svg>
                </div>

                {includePriceINR && (
                  <div className="flex justify-between items-center border-t border-slate-900 pt-1 text-[10px] font-mono-code">
                    <span>MRP / UNIT VALUATION:</span>
                    <strong className="text-xs">{formatINR(activeBatch.unit_cost || 0)}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Printable Area for window.print() */}
      <div id="printable-label-area" className="hidden">
        <div className="grid grid-cols-2 gap-4 p-4">
          {Array.from({ length: labelCopies }).map((_, i) => (
            <div
              key={i}
              className="thermal-label-box p-4 border-2 border-black bg-white text-black font-sans text-xs space-y-2 mb-4"
              style={{ width: '3.8in', height: '1.9in' }}
            >
              <div className="flex justify-between items-start border-b border-black pb-1">
                <div>
                  <h4 className="font-bold text-xs uppercase">{resolvedLabelHeader}</h4>
                  <p className="text-[9px] font-mono">SKU: {activeBatch.product_code}</p>
                </div>
                <span className="font-mono font-bold text-[9px]">LOT: {activeBatch.batch_number}</span>
              </div>
              <div className="flex justify-between text-[9px] font-mono">
                <span>BIN: {activeBatch.location_code}</span>
                <span>EXP: {formatDate(activeBatch.expiry_date)}</span>
                <span>MRP: {formatINR(activeBatch.unit_cost || 0)}</span>
              </div>
              <div className="flex justify-center pt-1">
                <svg
                  ref={(node) => {
                    if (node && activeBatch.barcode) {
                      renderBarcodeToSvg(node, activeBatch.barcode, {
                        width: 1.5,
                        height: 38,
                        fontSize: 10,
                        displayValue: true,
                      });
                    }
                  }}
                ></svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
