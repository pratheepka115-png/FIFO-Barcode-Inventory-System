import React, { useState } from 'react';
import {
  Trash2,
  AlertTriangle,
  FileText,
  IndianRupee,
  ShieldAlert,
  Boxes,
  Calendar,
  MapPin,
  CheckCircle2,
  X,
  UserCheck,
  Percent,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { formatINR } from '../utils/currency';
import { calculateShelfLifeStatus, formatDate } from '../utils/shelfLife';
import { InventoryBatch } from '../types/inventory';
import { soundFx } from '../utils/sound';

interface WriteOffModalProps {
  batch: InventoryBatch | null;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export type WriteOffDispositionType =
  | 'EXPIRED_LOSS'
  | 'DAMAGED_SCRAP'
  | 'QA_REJECTED'
  | 'OBSOLETE_WRITE_OFF'
  | 'TEMP_EXCURSION'
  | 'PILFERAGE';

export const WriteOffModal: React.FC<WriteOffModalProps> = ({ batch, onClose, onSuccess }) => {
  const { writeOffBatch, currentUser, users } = useInventory();

  if (!batch) return null;

  const shelfLife = calculateShelfLifeStatus(batch.expiry_date, batch.manufacturing_date);
  const isExpired = shelfLife.daysRemaining <= 0 || batch.status === 'expired';

  const [quantity, setQuantity] = useState<number>(batch.quantity_current);
  const [dispositionType, setDispositionType] = useState<WriteOffDispositionType>(
    isExpired ? 'EXPIRED_LOSS' : batch.status === 'quarantine' ? 'QA_REJECTED' : 'EXPIRED_LOSS'
  );
  const [reasonNotes, setReasonNotes] = useState<string>(
    isExpired
      ? 'Past expiration date - product condemned by QA for commercial scrap'
      : 'Stock decommissioned and written off following warehouse supervisor audit'
  );
  const [referenceDoc, setReferenceDoc] = useState<string>(
    `WO-${Date.now().toString().slice(-6)}`
  );
  const [witnessName, setWitnessName] = useState<string>(currentUser.full_name);
  const [salvageRecovery, setSalvageRecovery] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const unitCost = batch.unit_cost || 0;
  const grossLoss = quantity * unitCost;
  const netLoss = Math.max(0, grossLoss - (salvageRecovery || 0));

  const handleQuickQty = (percent: number) => {
    const qty = Math.max(1, Math.round((batch.quantity_current * percent) / 100));
    setQuantity(qty);
  };

  const handleExecute = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (quantity <= 0 || quantity > batch.quantity_current) {
      setErrorMessage(`Write-off quantity must be between 1 and ${batch.quantity_current} ${batch.unit_of_measure}.`);
      return;
    }

    if (!reasonNotes.trim()) {
      setErrorMessage('Please provide a specific audit reason for this write-off.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = writeOffBatch({
        batchId: batch.batch_id,
        quantity,
        reason: reasonNotes.trim(),
        dispositionType,
        salvageRecoveryInr: salvageRecovery,
        witnessName: witnessName.trim(),
        referenceDoc: referenceDoc.trim(),
      });

      if (res.success) {
        soundFx.playSuccessChime();
        if (onSuccess) {
          onSuccess(res.message || `Successfully wrote off ${quantity} ${batch.unit_of_measure} of Lot ${batch.batch_number}.`);
        }
        onClose();
      } else {
        setErrorMessage(res.error || res.message || 'Write-off execution failed.');
        setIsSubmitting(false);
      }
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : 'Write-off failed';
      setErrorMessage(errText);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl border border-rose-200/80 shadow-2xl max-w-xl w-full my-auto overflow-hidden font-sans text-xs">
        {/* Header Banner */}
        <div className="bg-linear-to-r from-rose-900 via-rose-800 to-slate-900 text-white p-4 sm:p-5 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-200">
              <Trash2 className="w-5 h-5 text-rose-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">Material Write-Off & Scrap Certificate</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/30 text-rose-200 border border-rose-400/30">
                  Financial Loss
                </span>
              </div>
              <p className="text-xs text-rose-200/80 mt-0.5">
                Decommission expired, damaged, or rejected inventory with audited loss ledger accounting.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-rose-200 hover:text-white hover:bg-rose-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Lot Summary Card */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-mono-code text-slate-500 block">{batch.product_code}</span>
              <h4 className="font-bold text-sm text-slate-900 leading-tight">{batch.product_name}</h4>
              <span className="text-xs text-slate-500">{batch.category} · Supplier: {batch.supplier_name}</span>
            </div>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${shelfLife.badgeClass}`}>
              {isExpired ? 'EXPIRED' : `${shelfLife.daysRemaining}d Remaining`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/80 text-[11px] font-mono-code">
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <span className="text-slate-400 block text-[10px]">Lot Number</span>
              <span className="font-bold text-slate-900">{batch.batch_number}</span>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <span className="text-slate-400 block text-[10px]">Bin Location</span>
              <span className="font-bold text-slate-800">{batch.location_code}</span>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <span className="text-slate-400 block text-[10px]">On-Hand Qty</span>
              <span className="font-bold text-slate-900">{batch.quantity_current} {batch.unit_of_measure}</span>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <span className="text-slate-400 block text-[10px]">Unit Cost</span>
              <span className="font-bold text-slate-900">{formatINR(unitCost)}</span>
            </div>
          </div>
        </div>

        {/* Write-Off Form */}
        <form onSubmit={handleExecute} className="p-4 sm:p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-xs block">Write-Off Error</span>
                <span className="text-[11px]">{errorMessage}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quantity selection */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">Scrap / Write-off Quantity *</label>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => handleQuickQty(25)}
                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-700 font-medium"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickQty(50)}
                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-700 font-medium"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickQty(100)}
                    className="px-1.5 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-[10px] text-rose-800 font-bold"
                  >
                    All ({batch.quantity_current})
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={batch.quantity_current}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono-code font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-xs">
                  {batch.unit_of_measure}
                </span>
              </div>
            </div>

            {/* Disposition Type */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Disposal Category *</label>
              <select
                value={dispositionType}
                onChange={(e) => setDispositionType(e.target.value as WriteOffDispositionType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
              >
                <option value="EXPIRED_LOSS">FEFO Expiration (Expired Loss)</option>
                <option value="DAMAGED_SCRAP">Physical Transit / Handling Damage</option>
                <option value="QA_REJECTED">QA QC Inspection Failure & Contamination</option>
                <option value="OBSOLETE_WRITE_OFF">Commercial Obsolescence & SKU Phase-out</option>
                <option value="TEMP_EXCURSION">Cold Chain Temperature Excursion</option>
                <option value="PILFERAGE">Inventory Shrinkage / Physical Discrepancy</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Certificate / Ref #</label>
              <input
                type="text"
                value={referenceDoc}
                onChange={(e) => setReferenceDoc(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono-code text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Authorized Witness / QC</label>
              <input
                type="text"
                value={witnessName}
                onChange={(e) => setWitnessName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Scrap Recovery (₹)</label>
              <input
                type="number"
                min={0}
                value={salvageRecovery}
                onChange={(e) => setSalvageRecovery(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono-code text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason & Audit Explanation *</label>
            <textarea
              rows={2}
              value={reasonNotes}
              onChange={(e) => setReasonNotes(e.target.value)}
              placeholder="Detail reasons for scrapping lot..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              required
            />
          </div>

          {/* Financial Loss Ledger Preview */}
          <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Scrap Quantity:</span>
              <span className="font-bold text-slate-900 font-mono-code">{quantity} of {batch.quantity_current} {batch.unit_of_measure}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Gross Book Value Loss:</span>
              <span className="font-bold text-rose-700 font-mono-code">{formatINR(grossLoss)}</span>
            </div>
            {salvageRecovery > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-700 font-medium">Salvage / Scrap Recovery:</span>
                <span className="font-bold text-emerald-700 font-mono-code">- {formatINR(salvageRecovery)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-rose-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block text-xs">Net Financial Write-Off Loss</span>
                <span className="text-[10px] text-slate-500">Will be recorded in Ledger & Expired Loss report</span>
              </div>
              <span className="text-base font-bold text-rose-700 font-mono-code">
                {formatINR(netLoss)}
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold shadow-md transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Confirm Material Write-Off ({formatINR(netLoss)})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
