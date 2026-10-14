import React, { useState } from 'react';
import {
  SlidersHorizontal,
  AlertTriangle,
  X,
  Package,
  FileText,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { InventoryBatch } from '../types/inventory';

interface StockAdjustmentModalProps {
  batch: InventoryBatch;
  onClose: () => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({ batch, onClose }) => {
  const { adjustStock, currentUser } = useInventory();

  const [adjustedQty, setAdjustedQty] = useState<number>(batch.quantity_current);
  const [reason, setReason] = useState<'ADJUST' | 'DAMAGE' | 'EXPIRE'>('ADJUST');
  const [refDoc, setRefDoc] = useState<string>(`AUDIT-${Date.now().toString().slice(-4)}`);
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (adjustedQty < 0) {
      setErrorMsg('Quantity cannot be negative.');
      return;
    }

    const auditNotes = `${notes ? `${notes} • ` : ''}Adjusted by ${currentUser?.full_name} (${currentUser?.role.toUpperCase()})`;

    const res = adjustStock({
      batchId: batch.batch_id,
      newQuantity: adjustedQty,
      reason,
      referenceDocument: refDoc,
      notes: auditNotes,
    });

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to adjust stock.');
      return;
    }

    onClose();
  };

  const diff = adjustedQty - batch.quantity_current;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-5 shadow-xl space-y-4 text-xs">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Stock Adjustment & Write-off Audit</h3>
              <p className="text-[11px] text-slate-500">Record cycle count variance, damaged stock, or write-downs</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Batch Target Context */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono-code space-y-1">
          <div className="flex justify-between items-center text-slate-500">
            <span>Product SKU:</span>
            <span className="font-bold text-slate-900">{batch.product_code} • {batch.product_name}</span>
          </div>
          <div className="flex justify-between items-center text-slate-500">
            <span>Lot Number:</span>
            <span className="text-slate-900 font-bold">{batch.batch_number}</span>
          </div>
          <div className="flex justify-between items-center text-slate-500">
            <span>Bin Location:</span>
            <span className="text-slate-800 font-bold">{batch.location_code}</span>
          </div>
          <div className="flex justify-between items-center text-slate-500">
            <span>System Recorded Stock:</span>
            <span className="font-bold text-slate-900">{batch.quantity_current} {batch.unit_of_measure}</span>
          </div>
        </div>

        {/* Adjustment Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                New Actual Count ({batch.unit_of_measure}) *
              </label>
              <input
                type="number"
                min={0}
                required
                autoFocus
                value={adjustedQty}
                onChange={(e) => setAdjustedQty(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-mono-code font-bold focus:outline-none text-sm"
              />
              <div className="mt-1 text-[11px] font-mono-code">
                {diff === 0 ? (
                  <span className="text-slate-400">No change</span>
                ) : diff > 0 ? (
                  <span className="text-emerald-600">+{diff} units adjustment (Gain)</span>
                ) : (
                  <span className="text-rose-600">{diff} units adjustment (Loss/Shrink)</span>
                )}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reason / Classification *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as any)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none"
              >
                <option value="ADJUST">Cycle Count Variance</option>
                <option value="DAMAGE">Damaged / Seal Broken</option>
                <option value="EXPIRE">Expired Shelf Life Write-off</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center space-x-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Reference Audit Order / Ticket #</span>
            </label>
            <input
              type="text"
              required
              value={refDoc}
              onChange={(e) => setRefDoc(e.target.value.toUpperCase())}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-mono-code focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Audit Justification Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Physical inventory count discrepancy verified by floor auditor"
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors shadow-2xs"
            >
              Apply Stock Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
