import React, { useState, useMemo } from 'react';
import {
  Scissors,
  Trash2,
  RefreshCw,
  Printer,
  CheckCircle2,
  AlertTriangle,
  FileText,
  IndianRupee,
  Layers,
  MapPin,
  Building,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { InventoryBatch, Location } from '../types/inventory';
import { soundFx } from '../utils/sound';

export const OperationsHubModal: React.FC = () => {
  const {
    batches,
    locations,
    suppliers,
    splitBatch,
    disposeOrRtvBatch,
    relocateBatch,
    settings,
  } = useInventory();

  const [activeSubTab, setActiveSubTab] = useState<'split' | 'rtv_disposal' | 'relocate'>('split');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Split state
  const [splitQty, setSplitQty] = useState<number>(10);
  const [splitTargetBin, setSplitTargetBin] = useState<string>('');
  const [splitNotes, setSplitNotes] = useState<string>('');
  const [newSplitResult, setNewSplitResult] = useState<InventoryBatch | null>(null);

  // Disposal / RTV state
  const [dispositionType, setDispositionType] = useState<'RTV_RETURN' | 'SCRAP_DESTRUCTION' | 'SALVAGE_CLEARANCE'>('SCRAP_DESTRUCTION');
  const [disposeQty, setDisposeQty] = useState<number>(1);
  const [disposalReason, setDisposalReason] = useState<string>('Expired beyond permissible shelf life threshold');
  const [debitNoteRef, setDebitNoteRef] = useState<string>('');
  const [salvageRecovery, setSalvageRecovery] = useState<number>(0);
  const [witnessName, setWitnessName] = useState<string>('QA Compliance Officer');

  // Relocate state
  const [relocateTargetBin, setRelocateTargetBin] = useState<string>('');

  const activeBatches = useMemo(() => {
    return batches.filter((b) => b.quantity_current > 0);
  }, [batches]);

  const selectedBatch = useMemo(() => {
    return activeBatches.find((b) => b.batch_id === selectedBatchId) || activeBatches[0] || null;
  }, [activeBatches, selectedBatchId]);

  // Handle Split
  const handleExecuteSplit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    if (splitQty <= 0 || splitQty >= selectedBatch.quantity_current) {
      setStatusMessage(`Split quantity must be between 1 and ${selectedBatch.quantity_current - 1}`);
      return;
    }

    const res = splitBatch({
      batchId: selectedBatch.batch_id,
      splitQuantity: splitQty,
      newLocationCode: splitTargetBin || selectedBatch.location_code,
      notes: splitNotes || `Split ${splitQty} units from parent ${selectedBatch.batch_number}`,
    });

    if (res.success && res.newBatch) {
      setNewSplitResult(res.newBatch);
      setStatusMessage(`Successfully split lot ${selectedBatch.batch_number}. New sub-lot: ${res.newBatch.batch_number}`);
    } else {
      setStatusMessage(res.error || 'Failed to split batch.');
    }
  };

  // Handle Disposal / RTV
  const handleExecuteDisposition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    const ref = debitNoteRef.trim() || `${dispositionType}-${Date.now().toString().slice(-6)}`;

    const res = disposeOrRtvBatch({
      batchId: selectedBatch.batch_id,
      quantity: disposeQty,
      dispositionType,
      referenceDocument: ref,
      reason: disposalReason,
      salvageRecoveryInr: salvageRecovery,
      witnessName,
    });

    if (res.success) {
      setStatusMessage(`Disposition [${dispositionType}] recorded successfully for lot ${selectedBatch.batch_number}.`);
      soundFx.playSuccessChime();
    } else {
      setStatusMessage(res.error || 'Failed to execute disposition.');
    }
  };

  // Handle Relocate
  const handleExecuteRelocate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch || !relocateTargetBin) return;

    const res = relocateBatch(selectedBatch.batch_id, relocateTargetBin);
    if (res.success) {
      setStatusMessage(`Batch ${selectedBatch.batch_number} relocated to ${relocateTargetBin}.`);
      soundFx.playSuccessChime();
    } else {
      setStatusMessage(res.error || 'Failed to relocate batch.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div>
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Advanced Operations
          </span>
          <span className="text-xs text-slate-400 font-mono-code">WMS-OPS-01</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
          Warehouse Operations & Lot Division
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Execute pallet splitting into case lots, Return-To-Vendor (RTV) debit notes, scrap write-offs, and bin-to-bin transfers.
        </p>
      </div>

      {statusMessage && (
        <div className="p-3 bg-slate-900 text-white rounded-xl text-xs font-medium flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('split')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'split'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>Lot Splitting & Division</span>
        </button>

        <button
          onClick={() => setActiveSubTab('rtv_disposal')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'rtv_disposal'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>RTV & Scrap Write-Off</span>
        </button>

        <button
          onClick={() => setActiveSubTab('relocate')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'relocate'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Bin-to-Bin Relocation</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Lot Selector */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <span className="text-xs font-bold text-slate-700 block">Select Target Inventory Lot</span>
          
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Active Batches ({activeBatches.length})</label>
            <select
              value={selectedBatch?.batch_id || ''}
              onChange={(e) => {
                setSelectedBatchId(e.target.value);
                setNewSplitResult(null);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono-code bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              {activeBatches.map((b) => (
                <option key={b.batch_id} value={b.batch_id}>
                  {b.batch_number} - {b.product_name} ({b.quantity_current} {b.unit_of_measure}) [{b.location_code}]
                </option>
              ))}
            </select>
          </div>

          {selectedBatch && (
            <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-xs font-mono-code border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Product Code:</span>
                <span className="font-bold text-slate-900">{selectedBatch.product_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Available Qty:</span>
                <span className="font-bold text-slate-900">{selectedBatch.quantity_current} {selectedBatch.unit_of_measure}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Location:</span>
                <span className="font-bold text-slate-900">{selectedBatch.location_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expiry Date:</span>
                <span className="font-bold text-slate-900">{selectedBatch.expiry_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Unit Cost (INR):</span>
                <span className="font-bold text-slate-900">₹{selectedBatch.unit_cost.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Barcode:</span>
                <span className="text-[10px] text-slate-600 truncate">{selectedBatch.barcode}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right 2 Columns: Action Execution Panel */}
        <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
          {/* TAB 1: BATCH SPLIT */}
          {activeSubTab === 'split' && (
            <form onSubmit={handleExecuteSplit} className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm text-slate-900">Lot Splitting & Sub-Batch Generation</h3>
                <p className="text-xs text-slate-500 mt-0.5">Divide bulk inventory lots into smaller case packs with newly generated sub-batch barcodes.</p>
              </div>

              {selectedBatch && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Quantity to Split into New Lot (Max: {selectedBatch.quantity_current - 1})
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={selectedBatch.quantity_current - 1}
                      value={splitQty}
                      onChange={(e) => setSplitQty(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono-code font-bold text-sm bg-white focus:ring-1 focus:ring-slate-900"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Remaining in parent lot: {selectedBatch.quantity_current - splitQty} {selectedBatch.unit_of_measure}
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Destination Bin for New Sub-Lot</label>
                    <select
                      value={splitTargetBin}
                      onChange={(e) => setSplitTargetBin(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono-code text-xs bg-white focus:ring-1 focus:ring-slate-900"
                    >
                      <option value="">Same Bin ({selectedBatch.location_code})</option>
                      {locations.map((loc) => (
                        <option key={loc.location_id} value={loc.location_code}>
                          {loc.location_code} ({loc.section}) - Occ: {loc.current_occupancy}/{loc.capacity_units || 100}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">Reason / Splitting Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Broken down for retail packaging / Sample inspection"
                      value={splitNotes}
                      onChange={(e) => setSplitNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={!selectedBatch || splitQty <= 0 || splitQty >= (selectedBatch?.quantity_current || 0)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-xs font-semibold text-white shadow-xs flex items-center space-x-2"
                >
                  <Scissors className="w-4 h-4" />
                  <span>Execute Batch Split</span>
                </button>
              </div>

              {/* Split Result Preview & Print */}
              {newSplitResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>New Sub-Lot Created: {newSplitResult.batch_number}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-2.5 py-1 bg-white rounded-lg border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center space-x-1"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Split Sticker</span>
                    </button>
                  </div>
                  <div className="font-mono-code text-[11px] text-emerald-900 space-y-1">
                    <div>Barcode: <strong>{newSplitResult.barcode}</strong></div>
                    <div>Quantity: <strong>{newSplitResult.quantity_current} {newSplitResult.unit_of_measure}</strong></div>
                    <div>Bin Location: <strong>{newSplitResult.location_code}</strong></div>
                  </div>
                </div>
              )}
            </form>
          )}

          {/* TAB 2: RTV / DISPOSAL */}
          {activeSubTab === 'rtv_disposal' && (
            <form onSubmit={handleExecuteDisposition} className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm text-slate-900">Return-To-Vendor (RTV) & Scrap Write-Off</h3>
                <p className="text-xs text-slate-500 mt-0.5">Formal write-off workflow with destruction certification and supplier debit note tracking.</p>
              </div>

              {selectedBatch && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Disposition Type</label>
                    <select
                      value={dispositionType}
                      onChange={(e) => setDispositionType(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold text-xs bg-white focus:ring-1 focus:ring-slate-900"
                    >
                      <option value="SCRAP_DESTRUCTION">Scrap & Destruction (Total Write-Off)</option>
                      <option value="RTV_RETURN">Return to Vendor (Supplier Debit Note)</option>
                      <option value="SALVAGE_CLEARANCE">Salvage & Discount Clearance</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Quantity to Dispose / Return</label>
                    <input
                      type="number"
                      min="1"
                      max={selectedBatch.quantity_current}
                      value={disposeQty}
                      onChange={(e) => setDisposeQty(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono-code font-bold text-sm bg-white focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Debit Note / Destruction Cert Ref</label>
                    <input
                      type="text"
                      placeholder={`DN-${Date.now().toString().slice(-6)}`}
                      value={debitNoteRef}
                      onChange={(e) => setDebitNoteRef(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono-code text-xs bg-white focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Salvage Recovery Value (₹ INR)</label>
                    <input
                      type="number"
                      min="0"
                      value={salvageRecovery}
                      onChange={(e) => setSalvageRecovery(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono-code text-xs bg-white focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">Formal Reason / Destruction Cause</label>
                    <input
                      type="text"
                      value={disposalReason}
                      onChange={(e) => setDisposalReason(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">Witness / QA Authorized Signatory</label>
                    <input
                      type="text"
                      value={witnessName}
                      onChange={(e) => setWitnessName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={!selectedBatch || disposeQty <= 0}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-xs font-semibold text-white shadow-xs flex items-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Execute Stock Disposition</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: RELOCATE */}
          {activeSubTab === 'relocate' && (
            <form onSubmit={handleExecuteRelocate} className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm text-slate-900">Bin-to-Bin Relocation Assistant</h3>
                <p className="text-xs text-slate-500 mt-0.5">Move inventory lot to a new storage rack or staging bay with automated occupancy transfer.</p>
              </div>

              {selectedBatch && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Target Destination Bin</label>
                    <select
                      value={relocateTargetBin}
                      onChange={(e) => setRelocateTargetBin(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono-code text-xs bg-white focus:ring-1 focus:ring-slate-900"
                    >
                      <option value="">-- Select destination location --</option>
                      {locations
                        .filter((l) => l.location_code !== selectedBatch.location_code)
                        .map((l) => (
                          <option key={l.location_id} value={l.location_code}>
                            {l.location_code} ({l.section}) - Occ: {l.current_occupancy}/{l.capacity_units || 100} [{l.storage_type}]
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={!selectedBatch || !relocateTargetBin}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-xs font-semibold text-white shadow-xs flex items-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Confirm Relocation</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
