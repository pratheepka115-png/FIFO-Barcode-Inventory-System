import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  QrCode,
  Printer,
  FileDown,
  X,
  Copy,
  Check,
  Download,
  Calendar,
  MapPin,
  Tag,
  Building2,
  Sliders,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  IndianRupee,
  Boxes,
  Maximize2,
  RefreshCw,
  Info,
} from 'lucide-react';
import { InventoryBatch } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import {
  buildBatchQRPayload,
  generateQRCodeDataUrl,
  downloadQRCodePng,
  QRPayloadMode,
  QRErrorCorrection,
} from '../utils/qrcode';
import { generateBatchLabelsPDF, downloadBatchLabelsPDF } from '../utils/pdfLabelGenerator';
import { calculateShelfLifeStatus, formatDate } from '../utils/shelfLife';
import { formatINR } from '../utils/currency';
import { renderBarcodeToSvg } from '../utils/barcode';
import { soundFx } from '../utils/sound';

interface BatchQRModalProps {
  batch: InventoryBatch;
  onClose: () => void;
}

type LabelSize = '4x2' | '3x2' | '2x1' | 'sheet';

export const BatchQRModal: React.FC<BatchQRModalProps> = ({ batch: initialBatch, onClose }) => {
  const { batches, settings } = useInventory();

  // Active batch selector
  const [currentBatchId, setCurrentBatchId] = useState<string>(initialBatch.batch_id);
  const activeBatch = useMemo(() => {
    return batches.find((b) => b.batch_id === currentBatchId) || initialBatch;
  }, [batches, currentBatchId, initialBatch]);

  // Label configuration state
  const [labelSize, setLabelSize] = useState<LabelSize>('4x2');
  const [copies, setCopies] = useState<number>(2);
  const [payloadMode, setPayloadMode] = useState<QRPayloadMode>('json');
  const [customPayloadText, setCustomPayloadText] = useState<string>('');
  const [errorCorrection, setErrorCorrection] = useState<QRErrorCorrection>('H');

  // Label content toggles
  const [includeHeader, setIncludeHeader] = useState<boolean>(true);
  const [includeLocation, setIncludeLocation] = useState<boolean>(true);
  const [includeShelfLife, setIncludeShelfLife] = useState<boolean>(true);
  const [includeDates, setIncludeDates] = useState<boolean>(true);
  const [includeValuation, setIncludeValuation] = useState<boolean>(true);
  const [includeQty, setIncludeQty] = useState<boolean>(true);
  const [includeBarcode1D, setIncludeBarcode1D] = useState<boolean>(false);

  // QR code output state
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);

  // DOM ref for the printable / capture container
  const printableAreaRef = useRef<HTMLDivElement | null>(null);

  // SVG ref for optional 1D barcode preview
  const barcode1dSvgRef = useRef<SVGSVGElement | null>(null);

  // Shelf life calculation
  const shelfLife = useMemo(() => {
    return calculateShelfLifeStatus(activeBatch.expiry_date, activeBatch.manufacturing_date);
  }, [activeBatch.expiry_date, activeBatch.manufacturing_date]);

  // QR Payload text
  const rawPayloadString = useMemo(() => {
    return buildBatchQRPayload(activeBatch, payloadMode, customPayloadText);
  }, [activeBatch, payloadMode, customPayloadText]);

  // Generate QR Code image when parameters change
  useEffect(() => {
    let isCancelled = false;
    setIsGenerating(true);

    generateQRCodeDataUrl(rawPayloadString, {
      errorCorrectionLevel: errorCorrection,
      width: 480,
      margin: 2,
    }).then((url) => {
      if (!isCancelled) {
        setQrDataUrl(url);
        setIsGenerating(false);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [rawPayloadString, errorCorrection]);

  // Render 1D barcode if toggle enabled
  useEffect(() => {
    if (includeBarcode1D && barcode1dSvgRef.current && activeBatch.barcode) {
      renderBarcodeToSvg(barcode1dSvgRef.current, activeBatch.barcode, {
        width: 1.3,
        height: 32,
        fontSize: 10,
        displayValue: true,
      });
    }
  }, [includeBarcode1D, activeBatch.barcode]);

  // PDF Generation handler using html2canvas & jsPDF
  const handleDownloadPDF = async () => {
    if (!qrDataUrl || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    soundFx.playBarcodeBeep();
    try {
      const captureArea =
        printableAreaRef.current || document.getElementById('printable-qr-label-area');

      if (captureArea) {
        // Allow brief tick to guarantee image paint
        await new Promise((r) => setTimeout(r, 60));
        await downloadBatchLabelsPDF(captureArea, activeBatch, labelSize, copies);
        soundFx.playSuccessChime();
      } else {
        // Fallback vector generation
        generateBatchLabelsPDF(activeBatch, qrDataUrl, {
          labelSize,
          copies,
          companyName: settings.company?.name || 'ABC Logistics & Supply Chain',
          includeHeader,
          includeLocation,
          includeShelfLife,
          includeDates,
          includeValuation,
          includeQty,
          shelfLifeDaysRemaining: shelfLife.daysRemaining,
          shelfLifeZone: shelfLife.zone,
        });
        soundFx.playSuccessChime();
      }
    } catch (err) {
      console.error('Failed to capture and download PDF:', err);
      // Fallback
      try {
        generateBatchLabelsPDF(activeBatch, qrDataUrl, {
          labelSize,
          copies,
          companyName: settings.company?.name || 'ABC Logistics & Supply Chain',
          includeHeader,
          includeLocation,
          includeShelfLife,
          includeDates,
          includeValuation,
          includeQty,
          shelfLifeDaysRemaining: shelfLife.daysRemaining,
          shelfLifeZone: shelfLife.zone,
        });
        soundFx.playSuccessChime();
      } catch (fallbackErr) {
        console.error('Fallback PDF generation also failed:', fallbackErr);
      }
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Keyboard shortcut listener (Ctrl+D or Ctrl+S to download PDF, Ctrl+P to print, Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 's')) {
        e.preventDefault();
        handleDownloadPDF();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handleTriggerPrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, qrDataUrl, isDownloadingPdf, labelSize, copies, activeBatch, settings.company, includeHeader, includeLocation, includeShelfLife, includeDates, includeValuation, includeQty, shelfLife]);

  // Print handler
  const handleTriggerPrint = () => {
    soundFx.playBarcodeBeep();
    // Use browser print API
    window.print();
  };

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(rawPayloadString);
    setCopiedPayload(true);
    soundFx.playSuccessChime();
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleDownloadImage = () => {
    const filename = `QR_${activeBatch.product_code}_${activeBatch.batch_number}`;
    downloadQRCodePng(rawPayloadString, filename);
    soundFx.playSuccessChime();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in overflow-y-auto">
      {/* Modal Card (Screen Only) */}
      <div className="no-print bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden font-sans text-xs">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-2xs">
              <QrCode className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Batch QR Code & Thermal Label Studio
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono-code font-bold bg-indigo-50 border border-indigo-200 text-indigo-700">
                  {activeBatch.batch_number}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Generate high-density 2D QR stickers with FEFO traceability, export vector PDF, or print labels.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isDownloadingPdf || !qrDataUrl}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-2xs disabled:opacity-50"
              title="Download formatted labels as PDF document using html2canvas & jsPDF (Ctrl+D / Ctrl+S)"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isDownloadingPdf ? 'Generating PDF...' : `Download PDF (${copies})`}</span>
            </button>
            <button
              type="button"
              onClick={handleTriggerPrint}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors shadow-2xs"
              title="Print via browser dialog (Ctrl+P)"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Configuration Controls (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Batch Quick Switcher */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                Target Inventory Batch Lot
              </label>
              <select
                value={currentBatchId}
                onChange={(e) => setCurrentBatchId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
              >
                {batches.map((b) => (
                  <option key={b.batch_id} value={b.batch_id}>
                    {b.batch_number} - {b.product_name} ({b.quantity_current} {b.unit_of_measure}) - {b.location_code}
                  </option>
                ))}
              </select>
            </div>

            {/* Label Dimensions & Copies */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
              <div>
                <label className="block font-bold text-slate-800 text-[11px] mb-1.5">
                  Label Dimension & Media
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: '4x2', label: '4" × 2" (Pallet/Carton)' },
                    { id: '3x2', label: '3" × 2" (Tote/Bin)' },
                    { id: '2x1', label: '2" × 1" (Item Sticker)' },
                    { id: 'sheet', label: 'A4 Sheet (Multi)' },
                  ].map((sz) => (
                    <button
                      key={sz.id}
                      type="button"
                      onClick={() => setLabelSize(sz.id as LabelSize)}
                      className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] font-medium border transition-colors ${
                        labelSize === sz.id
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-bold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {sz.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-800 text-[11px]">
                    Print Quantity (Copies)
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono-code">
                    {copies} label{copies > 1 ? 's' : ''} queued
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 4, 8].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setCopies(qty)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border ${
                        copies === qty
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {qty}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCopies(Math.max(1, activeBatch.quantity_current))}
                    className="px-2 py-1 rounded text-[10px] font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    title="Print 1 copy per unit in lot"
                  >
                    Lot ({activeBatch.quantity_current})
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-14 px-2 py-1 border border-slate-200 rounded text-center text-xs font-bold text-slate-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* QR Payload Format & Error Correction */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
              <div>
                <label className="block font-bold text-slate-800 text-[11px] mb-1.5">
                  QR Payload Format
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'json', label: 'Smart WMS JSON', desc: 'Auto-sync with camera scanners' },
                    { id: 'compact', label: 'Compact Lot Code', desc: 'Fast handheld laser scanning' },
                    { id: 'gs1', label: 'GS1 Standard AI', desc: 'Supply-chain barcode format' },
                    { id: 'custom_url', label: 'Custom URL / Ref', desc: 'Internal lookup link' },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPayloadMode(pm.id as QRPayloadMode)}
                      className={`p-2 rounded-lg text-left border transition-colors ${
                        payloadMode === pm.id
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-bold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="text-[11px]">{pm.label}</div>
                      <div className="text-[9px] text-slate-400 font-normal leading-tight">{pm.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {payloadMode === 'custom_url' && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                    Custom Payload String or URL
                  </label>
                  <input
                    type="text"
                    value={customPayloadText}
                    onChange={(e) => setCustomPayloadText(e.target.value)}
                    placeholder={`https://wms.abclogistics.internal/lot/${activeBatch.batch_number}`}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono-code focus:outline-none"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-800 text-[11px]">
                    Error Correction Level
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {errorCorrection === 'H' ? 'High (30% recovery)' : errorCorrection === 'Q' ? 'Quartile (25%)' : errorCorrection === 'M' ? 'Medium (15%)' : 'Low (7%)'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {(['L', 'M', 'Q', 'H'] as QRErrorCorrection[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setErrorCorrection(lvl)}
                      className={`py-1 rounded text-center text-[10px] font-bold border ${
                        errorCorrection === lvl
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {lvl} {lvl === 'H' && '★'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content Display Toggles */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
              <span className="block font-bold text-slate-800 text-[11px] mb-1">
                Sticker Content Elements
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeHeader}
                    onChange={(e) => setIncludeHeader(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                  <span>Company Header</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeLocation}
                    onChange={(e) => setIncludeLocation(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                  <span>Bin Location</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeShelfLife}
                    onChange={(e) => setIncludeShelfLife(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                  <span>FEFO Expiry Badge</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDates}
                    onChange={(e) => setIncludeDates(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                  <span>MFG & EXP Dates</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeQty}
                    onChange={(e) => setIncludeQty(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                  <span>Quantity & UOM</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeValuation}
                    onChange={(e) => setIncludeValuation(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                  <span>Unit MRP / Value</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer col-span-2">
                  <input
                    type="checkbox"
                    checked={includeBarcode1D}
                    onChange={(e) => setIncludeBarcode1D(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                  <span>Tandem 1D Barcode (Code128)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Live Label Preview (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                      Live Label Preview
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-mono-code">
                      {labelSize === '4x2' ? '4.0" × 2.0"' : labelSize === '3x2' ? '3.0" × 2.0"' : labelSize === '2x1' ? '2.0" × 1.0"' : 'A4 Sheet'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadPDF}
                      disabled={isDownloadingPdf || !qrDataUrl}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[11px] font-semibold transition-colors disabled:opacity-50"
                      title="Download formatted labels as PDF using html2canvas & jsPDF (Ctrl+D / Ctrl+S)"
                    >
                      <FileDown className="w-3 h-3 text-indigo-600" />
                      <span>{isDownloadingPdf ? 'Generating...' : 'Download PDF'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadImage}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
                      title="Download high-resolution QR PNG"
                    >
                      <Download className="w-3 h-3 text-slate-500" />
                      <span>PNG</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyPayload}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
                      title="Copy QR Payload string"
                    >
                      {copiedPayload ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-500" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* The Physical Sticker Box (Representative on-screen card) */}
                <div className="flex justify-center items-center py-2">
                  <div
                    className={`bg-white border-2 border-slate-900 rounded-lg p-3 text-slate-900 shadow-md font-sans transition-all relative overflow-hidden ${
                      labelSize === '2x1'
                        ? 'w-[260px] min-h-[140px]'
                        : labelSize === '3x2'
                        ? 'w-[340px] min-h-[220px]'
                        : 'w-[420px] min-h-[230px]'
                    }`}
                  >
                    {/* Header */}
                    {includeHeader && (
                      <div className="flex justify-between items-center border-b-2 border-slate-900 pb-1 mb-1.5">
                        <span className="font-extrabold text-[10px] tracking-wider uppercase">
                          {settings.company?.name || 'ABC Logistics & Supply Chain'}
                        </span>
                        <span className="font-mono-code font-bold text-[9px] bg-slate-900 text-white px-1.5 py-0.2 rounded">
                          FIFO WMS
                        </span>
                      </div>
                    )}

                    {/* Main Content Layout */}
                    <div className="flex items-start gap-2.5">
                      {/* Left: QR Code */}
                      <div className="flex flex-col items-center justify-center shrink-0">
                        {isGenerating || !qrDataUrl ? (
                          <div className="w-24 h-24 border border-dashed border-slate-300 rounded flex items-center justify-center">
                            <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
                          </div>
                        ) : (
                          <img
                            src={qrDataUrl}
                            alt={`QR for ${activeBatch.batch_number}`}
                            className={`border border-slate-200 rounded bg-white p-0.5 object-contain ${
                              labelSize === '2x1' ? 'w-20 h-20' : labelSize === '3x2' ? 'w-28 h-28' : 'w-32 h-32'
                            }`}
                          />
                        )}
                        <span className="font-mono-code text-[8px] font-bold text-slate-600 mt-0.5">
                          SCAN FOR FIFO
                        </span>
                      </div>

                      {/* Right: Metadata details */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div>
                          <div className="font-extrabold text-xs text-slate-900 truncate uppercase">
                            {activeBatch.product_name}
                          </div>
                          <div className="flex items-center gap-1 font-mono-code text-[10px] text-slate-600">
                            <span>SKU: {activeBatch.product_code}</span>
                            <span>•</span>
                            <span className="font-bold text-slate-900">{activeBatch.batch_number}</span>
                          </div>
                        </div>

                        {includeLocation && (
                          <div className="flex items-center gap-1 text-[10px] font-mono-code bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            <MapPin className="w-3 h-3 text-slate-600 shrink-0" />
                            <span className="font-bold">BIN: {activeBatch.location_code}</span>
                          </div>
                        )}

                        {includeShelfLife && (
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${shelfLife.badgeClass}`}>
                              {shelfLife.daysRemaining <= 0
                                ? 'EXPIRED'
                                : `${shelfLife.daysRemaining}d REMAINING`}
                            </span>
                            <span className="text-[9px] font-mono-code text-slate-500">
                              Zone: {shelfLife.zone.toUpperCase()}
                            </span>
                          </div>
                        )}

                        {includeDates && (
                          <div className="grid grid-cols-2 gap-1 text-[9px] font-mono-code pt-0.5">
                            <div>
                              <span className="text-slate-400 block text-[8px]">MFG:</span>
                              <span className="font-semibold">{formatDate(activeBatch.manufacturing_date)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[8px]">EXPIRY (FEFO):</span>
                              <strong className="text-slate-900 font-bold">{formatDate(activeBatch.expiry_date)}</strong>
                            </div>
                          </div>
                        )}

                        {(includeQty || includeValuation) && (
                          <div className="flex items-center justify-between border-t border-slate-200 pt-1 text-[9px] font-mono-code">
                            {includeQty && (
                              <span>
                                QTY: <strong>{activeBatch.quantity_current} {activeBatch.unit_of_measure}</strong>
                              </span>
                            )}
                            {includeValuation && (
                              <span className="font-bold text-slate-900">
                                {formatINR(activeBatch.unit_cost || 0)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Optional 1D Barcode at Bottom */}
                    {includeBarcode1D && (
                      <div className="mt-1 pt-1 border-t border-slate-900 flex justify-center">
                        <svg ref={barcode1dSvgRef} className="max-w-full"></svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Encoded Raw Payload Inspector */}
                <div className="mt-4 bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3 text-slate-400" />
                      <span>Encoded Payload Data ({rawPayloadString.length} chars)</span>
                    </span>
                    <span className="font-mono-code text-indigo-600">{payloadMode.toUpperCase()}</span>
                  </div>
                  <pre className="p-2 bg-slate-900 text-emerald-400 rounded-lg font-mono-code text-[10px] overflow-x-auto whitespace-pre-wrap max-h-24 select-all">
                    {rawPayloadString}
                  </pre>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                  <FileDown className="w-4 h-4 text-indigo-500" />
                  <span>
                    Exports vector PDF sized to{' '}
                    <strong>
                      {labelSize === '4x2'
                        ? '4" × 2" (Pallet)'
                        : labelSize === '3x2'
                        ? '3" × 2" (Bin)'
                        : labelSize === '2x1'
                        ? '2" × 1" (Sticker)'
                        : 'A4 Sheet (8 labels/page)'}
                    </strong>
                    .
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white font-semibold transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleTriggerPrint}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors shadow-2xs"
                    title="Print via browser dialog (Ctrl+P)"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    <span>Print Dialog</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    disabled={isDownloadingPdf || !qrDataUrl}
                    className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-md disabled:opacity-50"
                    title="Download labels as PDF document using html2canvas & jsPDF (Ctrl+D / Ctrl+S)"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>
                      {isDownloadingPdf ? 'Generating PDF...' : `Download PDF (${copies} Label${copies > 1 ? 's' : ''})`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PRINTABLE & CAPTURE AREA (Follows exact print layout logic for thermal rolls & A4 sheets)
          ═══════════════════════════════════════════════════════════════════ */}
      <div
        id="printable-qr-label-area"
        ref={printableAreaRef}
        className="fixed top-0 left-0 -z-50 pointer-events-none opacity-100 bg-white print:static print:left-auto print:z-auto print:pointer-events-auto print:block"
        style={{
          width: labelSize === 'sheet' ? '8.27in' : undefined,
        }}
      >
        {labelSize === 'sheet' ? (
          <div className="sheet-container space-y-6 bg-white">
            {Array.from({ length: Math.ceil(copies / 8) }).map((_, pageIdx) => {
              const pageCopies = Math.min(8, copies - pageIdx * 8);
              return (
                <div
                  key={pageIdx}
                  className="sheet-page grid grid-cols-2 gap-4 p-6 bg-white"
                  style={{
                    width: '8.27in',
                    minHeight: '11.69in',
                    boxSizing: 'border-box',
                    backgroundColor: '#ffffff',
                    pageBreakAfter: 'always',
                    breakAfter: 'page',
                  }}
                >
                  {Array.from({ length: pageCopies }).map((_, slotIdx) => (
                    <div
                      key={slotIdx}
                      className="thermal-label-box border-2 border-black bg-white text-black font-sans p-3 space-y-1.5"
                      style={{
                        width: '3.8in',
                        minHeight: '2.0in',
                        boxSizing: 'border-box',
                      }}
                    >
                      {/* Thermal Label Header */}
                      {includeHeader && (
                        <div className="flex justify-between items-center border-b border-black pb-1 mb-1">
                          <h4 className="font-extrabold text-[10px] uppercase">
                            {settings.company?.name || 'ABC Logistics & Supply Chain'}
                          </h4>
                          <span className="font-mono font-bold text-[9px] uppercase">
                            FIFO BATCH
                          </span>
                        </div>
                      )}

                      {/* Main Content: QR & Details */}
                      <div className="flex items-start gap-2">
                        {qrDataUrl && (
                          <div className="shrink-0 flex flex-col items-center">
                            <img
                              src={qrDataUrl}
                              alt="Batch QR"
                              style={{ width: '1.3in', height: '1.3in' }}
                            />
                            <span className="font-mono text-[7px] font-bold">FEFO SCAN</span>
                          </div>
                        )}

                        <div className="flex-1 min-w-0 text-[9px] space-y-0.5">
                          <div className="font-bold text-xs uppercase truncate">
                            {activeBatch.product_name}
                          </div>
                          <div className="font-mono text-[9px] font-bold">
                            SKU: {activeBatch.product_code}
                          </div>
                          <div className="font-mono text-[9px] font-bold">
                            LOT: {activeBatch.batch_number}
                          </div>

                          {includeLocation && (
                            <div className="font-mono text-[9px]">
                              BIN: <strong>{activeBatch.location_code}</strong>
                            </div>
                          )}

                          {includeShelfLife && (
                            <div className="font-mono text-[8px] font-bold">
                              SHELF-LIFE: {shelfLife.daysRemaining}d ({shelfLife.zone.toUpperCase()})
                            </div>
                          )}

                          {includeDates && (
                            <div className="font-mono text-[8px] flex justify-between border-t border-black pt-0.5 mt-0.5">
                              <span>MFG: {formatDate(activeBatch.manufacturing_date)}</span>
                              <span>EXP: <strong>{formatDate(activeBatch.expiry_date)}</strong></span>
                            </div>
                          )}

                          {(includeQty || includeValuation) && (
                            <div className="font-mono text-[8px] flex justify-between pt-0.5">
                              {includeQty && (
                                <span>QTY: <strong>{activeBatch.quantity_current} {activeBatch.unit_of_measure}</strong></span>
                              )}
                              {includeValuation && (
                                <span>MRP: <strong>{formatINR(activeBatch.unit_cost || 0)}</strong></span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-start p-2 bg-white">
            {Array.from({ length: copies }).map((_, idx) => (
              <div
                key={idx}
                className="thermal-label-box border-2 border-black bg-white text-black font-sans p-3 mb-4 space-y-1.5"
                style={{
                  width: labelSize === '2x1' ? '2.2in' : labelSize === '3x2' ? '3.2in' : '3.8in',
                  minHeight: labelSize === '2x1' ? '1.1in' : labelSize === '3x2' ? '2.0in' : '2.0in',
                  boxSizing: 'border-box',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                  pageBreakAfter: 'always',
                }}
              >
                {/* Thermal Label Header */}
                {includeHeader && (
                  <div className="flex justify-between items-center border-b border-black pb-1 mb-1">
                    <h4 className="font-extrabold text-[10px] uppercase">
                      {settings.company?.name || 'ABC Logistics & Supply Chain'}
                    </h4>
                    <span className="font-mono font-bold text-[9px] uppercase">
                      FIFO BATCH
                    </span>
                  </div>
                )}

                {/* Main Content: QR & Details */}
                <div className="flex items-start gap-2">
                  {qrDataUrl && (
                    <div className="shrink-0 flex flex-col items-center">
                      <img
                        src={qrDataUrl}
                        alt="Batch QR"
                        style={{
                          width: labelSize === '2x1' ? '0.8in' : labelSize === '3x2' ? '1.2in' : '1.3in',
                          height: labelSize === '2x1' ? '0.8in' : labelSize === '3x2' ? '1.2in' : '1.3in',
                        }}
                      />
                      <span className="font-mono text-[7px] font-bold">FEFO SCAN</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0 text-[9px] space-y-0.5">
                    <div className="font-bold text-xs uppercase truncate">
                      {activeBatch.product_name}
                    </div>
                    <div className="font-mono text-[9px] font-bold">
                      SKU: {activeBatch.product_code}
                    </div>
                    <div className="font-mono text-[9px] font-bold">
                      LOT: {activeBatch.batch_number}
                    </div>

                    {includeLocation && (
                      <div className="font-mono text-[9px]">
                        BIN: <strong>{activeBatch.location_code}</strong>
                      </div>
                    )}

                    {includeShelfLife && (
                      <div className="font-mono text-[8px] font-bold">
                        SHELF-LIFE: {shelfLife.daysRemaining}d ({shelfLife.zone.toUpperCase()})
                      </div>
                    )}

                    {includeDates && (
                      <div className="font-mono text-[8px] flex justify-between border-t border-black pt-0.5 mt-0.5">
                        <span>MFG: {formatDate(activeBatch.manufacturing_date)}</span>
                        <span>EXP: <strong>{formatDate(activeBatch.expiry_date)}</strong></span>
                      </div>
                    )}

                    {(includeQty || includeValuation) && (
                      <div className="font-mono text-[8px] flex justify-between pt-0.5">
                        {includeQty && (
                          <span>QTY: <strong>{activeBatch.quantity_current} {activeBatch.unit_of_measure}</strong></span>
                        )}
                        {includeValuation && (
                          <span>MRP: <strong>{formatINR(activeBatch.unit_cost || 0)}</strong></span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
