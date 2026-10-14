import React, { useState, useEffect, useRef } from 'react';
import {
  Scan,
  Camera,
  Keyboard,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowUpFromLine,
  Printer,
  History,
  ShieldAlert,
  Search,
  MapPin,
  Calendar,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { calculateShelfLifeStatus, formatDate } from '../utils/shelfLife';
import { formatINR } from '../utils/currency';
import { InventoryBatch } from '../types/inventory';
import { soundFx } from '../utils/sound';

export const ScannerModal: React.FC = () => {
  const {
    scannerOpen,
    setScannerOpen,
    batches,
    findBatchByBarcode,
    setActiveTab,
    setSelectedBatchForDetail,
    quarantineBatch,
  } = useInventory();

  const [inputCode, setInputCode] = useState<string>('');
  const [matchedBatch, setMatchedBatch] = useState<InventoryBatch | null>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Keyboard wedge global scanner listener
  useEffect(() => {
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setScannerOpen(!scannerOpen);
        return;
      }

      if (!scannerOpen) return;

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) {
        barcodeBuffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter' && barcodeBuffer.length > 3) {
        e.preventDefault();
        processBarcode(barcodeBuffer);
        barcodeBuffer = '';
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scannerOpen, batches]);

  // Camera video stream handling
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (scannerOpen && isCameraActive) {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch((err) => {
          console.warn('Camera access unavailable or declined:', err);
          setIsCameraActive(false);
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [scannerOpen, isCameraActive]);

  const processBarcode = (code: string) => {
    const clean = code.trim();
    if (!clean) return;

    const match = findBatchByBarcode(clean);
    if (match) {
      setMatchedBatch(match);
      setScanStatus('success');
      setErrorMessage('');
      soundFx.playBarcodeBeep();
    } else {
      setMatchedBatch(null);
      setScanStatus('error');
      setErrorMessage(`No inventory batch located with barcode / lot # "${clean}".`);
      soundFx.playWarningBuzz();
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processBarcode(inputCode);
  };

  if (!scannerOpen) return null;

  const status = matchedBatch?.expiry_date
    ? calculateShelfLifeStatus(matchedBatch.expiry_date, matchedBatch.manufacturing_date)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-lg w-full space-y-4 shadow-xl text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white">
              <Scan className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Industrial Barcode Terminal</h3>
              <p className="text-[11px] text-slate-400">USB Wedge Scanner & Camera Scanner</p>
            </div>
          </div>
          <button onClick={() => setScannerOpen(false)} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Feed or Manual Input */}
        {isCameraActive ? (
          <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video border border-slate-800 flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-0 border-2 border-emerald-400/70 pointer-events-none rounded-xl"></div>
            <button
              onClick={() => setIsCameraActive(false)}
              className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white rounded text-[10px]"
            >
              Close Camera
            </button>
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label className="block text-[11px] font-semibold text-slate-700">Scan Barcode / Enter Lot Number</label>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                placeholder="Scan or type barcode string..."
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono-code font-bold focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 shrink-0 shadow-2xs"
              >
                Scan
              </button>
            </div>
          </form>
        )}

        {/* Scan Status & Matched Result */}
        {scanStatus === 'error' && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {scanStatus === 'success' && matchedBatch && status && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-mono-code block">{matchedBatch.product_code}</span>
                <h4 className="font-bold text-slate-900 text-sm">{matchedBatch.product_name}</h4>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${status.badgeClass}`}>
                {status.daysRemaining <= 0 ? 'EXPIRED' : `${status.daysRemaining}d left`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-code bg-white p-2.5 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 text-[10px] block">LOT NUMBER:</span>
                <strong className="text-slate-900">{matchedBatch.batch_number}</strong>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">BIN LOCATION:</span>
                <strong className="text-slate-900">{matchedBatch.location_code}</strong>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">QUANTITY ON-HAND:</span>
                <strong className="text-slate-900">{matchedBatch.quantity_current} {matchedBatch.unit_of_measure}</strong>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">EXPIRY DATE:</span>
                <strong className="text-slate-900">{formatDate(matchedBatch.expiry_date)}</strong>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedBatchForDetail(matchedBatch);
                  setScannerOpen(false);
                  setActiveTab('picking');
                }}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold flex items-center gap-1 shadow-2xs"
              >
                <ArrowUpFromLine className="w-3.5 h-3.5" />
                <span>Stage FIFO Pick</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedBatchForDetail(matchedBatch);
                  setScannerOpen(false);
                  setActiveTab('barcode_studio');
                }}
                className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-semibold flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Tag</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick Sample Barcodes Bar */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Quick Sample Barcodes:</span>
          <div className="flex gap-1.5">
            {batches.slice(0, 3).map((b) => (
              <button
                key={b.batch_id}
                type="button"
                onClick={() => processBarcode(b.barcode)}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-mono-code font-bold text-[10px]"
              >
                {b.batch_number}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
