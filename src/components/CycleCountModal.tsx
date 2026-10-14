import React, { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Search,
  Scan,
  Printer,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  IndianRupee,
  Layers,
  FileText,
  Boxes,
  Plus,
  ArrowRight,
  Filter,
  Check,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { InventoryBatch } from '../types/inventory';
import { soundFx } from '../utils/sound';

export const CycleCountModal: React.FC = () => {
  const { batches, locations, products, performCycleCount, settings } = useInventory();

  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scanInput, setScanInput] = useState<string>('');
  const [countedQuantities, setCountedQuantities] = useState<Record<string, number>>({});
  const [auditorNotes, setAuditorNotes] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [reconciliationReport, setReconciliationReport] = useState<{
    adjustedCount: number;
    varianceUnits: number;
    varianceInr: number;
  } | null>(null);

  // Filter batches for audit
  const activeBatches = useMemo(() => {
    return batches.filter((b) => b.quantity_current > 0);
  }, [batches]);

  const filteredBatches = useMemo(() => {
    let list = activeBatches;
    if (selectedSection !== 'ALL') {
      list = list.filter((b) => b.location_code.startsWith(selectedSection) || b.location_code.includes(selectedSection));
    }
    if (selectedCategory !== 'ALL') {
      list = list.filter((b) => b.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (b) =>
          b.product_name.toLowerCase().includes(q) ||
          b.product_code.toLowerCase().includes(q) ||
          b.batch_number.toLowerCase().includes(q) ||
          b.location_code.toLowerCase().includes(q) ||
          b.barcode.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeBatches, selectedSection, selectedCategory, searchQuery]);

  // Categories
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ['ALL', ...Array.from(set)];
  }, [products]);

  // Quick Barcode Scanning verification
  const handleScanVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    const clean = scanInput.trim();

    const match = activeBatches.find(
      (b) => b.barcode.toLowerCase() === clean.toLowerCase() || b.batch_number.toLowerCase() === clean.toLowerCase()
    );

    if (match) {
      soundFx.playBarcodeBeep();
      // Increment physical count by 1 or initialize
      const currentVal = countedQuantities[match.batch_id] !== undefined ? countedQuantities[match.batch_id] : match.quantity_current;
      setCountedQuantities((prev) => ({
        ...prev,
        [match.batch_id]: currentVal,
      }));
      setStatusMessage(`Scanned lot ${match.batch_number} (${match.product_name}) located in ${match.location_code}.`);
    } else {
      soundFx.playWarningAlert();
      setStatusMessage(`No active lot found matching barcode: ${clean}`);
    }
    setScanInput('');
    setTimeout(() => setStatusMessage(''), 4000);
  };

  // Compute live variance metrics
  const auditSummary = useMemo(() => {
    let itemsCounted = 0;
    let totalVarianceUnits = 0;
    let totalVarianceInr = 0;

    Object.keys(countedQuantities).forEach((batchId) => {
      const batch = batches.find((b) => b.batch_id === batchId);
      if (!batch) return;
      itemsCounted += 1;
      const physical = countedQuantities[batchId];
      const book = batch.quantity_current;
      const diff = physical - book;
      totalVarianceUnits += diff;
      totalVarianceInr += diff * batch.unit_cost;
    });

    return { itemsCounted, totalVarianceUnits, totalVarianceInr };
  }, [countedQuantities, batches]);

  // Execute reconciliation adjustment
  const handleReconcile = () => {
    const countItems = Object.keys(countedQuantities).map((batchId) => ({
      batchId,
      physicalQty: countedQuantities[batchId],
      notes: auditorNotes[batchId] || 'Physical Cycle Count Audit Reconciliation',
    }));

    if (countItems.length === 0) {
      setStatusMessage('Please record at least one physical count before posting reconciliation.');
      return;
    }

    const res = performCycleCount(countItems);
    if (res.success) {
      setReconciliationReport({
        adjustedCount: res.adjustedCount,
        varianceUnits: res.varianceUnits,
        varianceInr: auditSummary.totalVarianceInr,
      });
      setCountedQuantities({});
      setAuditorNotes({});
      soundFx.playSuccessChime();
    }
  };

  // Print Blind Count Work Sheet
  const handlePrintCountSheet = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              Audit & Compliance
            </span>
            <span className="text-xs text-slate-400 font-mono-code">AUDIT-CC-01</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Cycle Count & Stock Audit Station
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Physical inventory verification, variance discrepancy resolution, and automated book-to-floor reconciliation.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrintCountSheet}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Blind Count Sheet</span>
          </button>
        </div>
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

      {/* KPI Audit Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block">Batches In Scope</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono-code">{filteredBatches.length}</span>
            <span className="text-xs text-slate-500">{auditSummary.itemsCounted} counted</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block">Physical Unit Variance</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-2xl font-bold font-mono-code ${
              auditSummary.totalVarianceUnits < 0 ? 'text-rose-600' : auditSummary.totalVarianceUnits > 0 ? 'text-emerald-600' : 'text-slate-900'
            }`}>
              {auditSummary.totalVarianceUnits > 0 ? `+${auditSummary.totalVarianceUnits}` : auditSummary.totalVarianceUnits} units
            </span>
            <span className="text-xs text-slate-400 font-mono-code">Floor vs Book</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block">Financial Variance (INR)</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-2xl font-bold font-mono-code ${
              auditSummary.totalVarianceInr < 0 ? 'text-rose-600' : auditSummary.totalVarianceInr > 0 ? 'text-emerald-600' : 'text-slate-900'
            }`}>
              ₹{Math.abs(auditSummary.totalVarianceInr).toLocaleString('en-IN')}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              auditSummary.totalVarianceInr < 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {auditSummary.totalVarianceInr < 0 ? 'Shrinkage Loss' : 'Surplus Gain'}
            </span>
          </div>
        </div>
      </div>

      {/* Barcode Quick Audit Scanner */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <form onSubmit={handleScanVerify} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center space-x-2 text-slate-700 shrink-0">
            <Scan className="w-5 h-5 text-slate-900" />
            <span className="text-xs font-bold">Fast Gun Barcode Scan:</span>
          </div>
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Scan lot barcode or enter lot number (e.g. ABC-LOT-001)..."
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              className="w-full pl-3 pr-20 py-2 rounded-xl border border-slate-200 text-xs font-mono-code bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
            >
              Verify
            </button>
          </div>
        </form>
      </div>

      {/* Reconciliation Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Table Filters */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 font-semibold"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c === 'ALL' ? 'All SKU Categories' : c}</option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by SKU or lot..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono-code bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono-code text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Bin Code</th>
                <th className="py-2.5 px-3">SKU & Lot Number</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Book Qty</th>
                <th className="py-2.5 px-3 text-right">Physical Count</th>
                <th className="py-2.5 px-3 text-right">Variance</th>
                <th className="py-2.5 px-3">Auditor Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredBatches.map((b) => {
                const physicalVal = countedQuantities[b.batch_id];
                const isCounted = physicalVal !== undefined;
                const variance = isCounted ? physicalVal - b.quantity_current : 0;

                return (
                  <tr key={b.batch_id} className={`hover:bg-slate-50/70 transition-colors ${isCounted ? 'bg-slate-50/30' : ''}`}>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{b.location_code}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-900 block font-sans">{b.product_name}</span>
                      <span className="text-[10px] text-slate-400">{b.batch_number} · {b.barcode}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{b.category}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-700">
                      {b.quantity_current} {b.unit_of_measure}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        placeholder={`${b.quantity_current}`}
                        value={physicalVal !== undefined ? physicalVal : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                          setCountedQuantities((prev) => {
                            const clone = { ...prev };
                            if (val === undefined || isNaN(val)) {
                              delete clone[b.batch_id];
                            } else {
                              clone[b.batch_id] = val;
                            }
                            return clone;
                          });
                        }}
                        className={`w-24 px-2 py-1 rounded border text-right font-mono-code font-bold text-xs focus:ring-1 focus:ring-slate-900 ${
                          isCounted ? 'bg-white border-slate-900' : 'bg-slate-50 border-slate-200'
                        }`}
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {isCounted ? (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          variance === 0
                            ? 'bg-slate-100 text-slate-700'
                            : variance < 0
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {variance > 0 ? `+${variance}` : variance} {b.unit_of_measure}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px]">Uncounted</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        placeholder="e.g. Broken packaging / Verified"
                        value={auditorNotes[b.batch_id] || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAuditorNotes((prev) => ({ ...prev, [b.batch_id]: v }));
                        }}
                        className="w-full px-2 py-1 rounded border border-slate-200 text-xs font-sans bg-white focus:ring-1 focus:ring-slate-900"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Action Bar */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-mono-code">
            <span>{auditSummary.itemsCounted} items recorded for adjustment</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setCountedQuantities({});
                setAuditorNotes({});
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
            >
              Reset Counts
            </button>
            <button
              onClick={handleReconcile}
              disabled={auditSummary.itemsCounted === 0}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-xs font-semibold text-white shadow-xs flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Post Cycle Count Adjustment</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reconciliation Success Summary Modal */}
      {reconciliationReport && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2 text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
              <h3 className="font-bold text-base text-slate-900">Stock Reconciliation Posted</h3>
            </div>
            <p className="text-xs text-slate-600">
              Physical inventory count has been posted to the database ledger. Transaction records and bin occupancies have been adjusted automatically.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl space-y-2 font-mono-code text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Lots Adjusted:</span>
                <span className="font-bold text-slate-900">{reconciliationReport.adjustedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Net Quantity Variance:</span>
                <span className="font-bold text-slate-900">{reconciliationReport.varianceUnits} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Financial Impact:</span>
                <span className="font-bold text-slate-900">₹{Math.abs(reconciliationReport.varianceInr).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setReconciliationReport(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
