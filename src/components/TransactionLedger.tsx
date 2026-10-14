import React, { useState, useMemo } from 'react';
import {
  History,
  Filter,
  Search,
  Download,
  ShieldCheck,
  ShieldAlert,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  Lock,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Settings,
  RefreshCw,
  Printer,
  Calendar,
  Layers,
  MapPin,
  CheckCircle2,
  FileText,
  IndianRupee,
  Building2,
  Eye,
  X,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { formatDateTime, formatDate } from '../utils/shelfLife';
import { formatINR } from '../utils/currency';
import { Transaction, TransactionType } from '../types/inventory';
import { soundFx } from '../utils/sound';

export const TransactionLedger: React.FC = () => {
  const {
    transactions,
    products,
    batches,
    securityLogs,
    clearSecurityLogs,
    reverseTransaction,
    settings,
  } = useInventory();

  const [activeLedgerTab, setActiveLedgerTab] = useState<'inventory_tx' | 'security_audit'>('inventory_tx');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedType, setSelectedType] = useState<TransactionType | 'ALL'>('ALL');
  const [fifoFilter, setFifoFilter] = useState<'ALL' | 'COMPLIANT' | 'OVERRIDE'>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<'ALL' | 'TODAY' | '7D' | '30D'>('ALL');
  const [securitySeverityFilter, setSecuritySeverityFilter] = useState<'ALL' | 'INFO' | 'WARNING' | 'CRITICAL'>('ALL');

  // Selected Transaction for Audit Certificate Modal
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<Transaction | null>(null);
  const [reversalTargetTx, setReversalTargetTx] = useState<Transaction | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('Operational error / customer order cancelled before transit');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // 1. Filtered Transactions
  const filteredTransactions = useMemo(() => {
    const now = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    return transactions.filter((t) => {
      // Date Range
      if (dateRangeFilter !== 'ALL' && t.transaction_date) {
        const txTime = new Date(t.transaction_date).getTime();
        if (dateRangeFilter === 'TODAY' && now - txTime > oneDay) return false;
        if (dateRangeFilter === '7D' && now - txTime > 7 * oneDay) return false;
        if (dateRangeFilter === '30D' && now - txTime > 30 * oneDay) return false;
      }

      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const match =
          t.product_name.toLowerCase().includes(term) ||
          t.product_code.toLowerCase().includes(term) ||
          t.batch_number.toLowerCase().includes(term) ||
          (t.reference_document && t.reference_document.toLowerCase().includes(term)) ||
          t.user_name.toLowerCase().includes(term) ||
          (t.location_code && t.location_code.toLowerCase().includes(term)) ||
          (t.customer_destination && t.customer_destination.toLowerCase().includes(term));
        if (!match) return false;
      }

      // Type filter
      if (selectedType !== 'ALL' && t.transaction_type !== selectedType) {
        return false;
      }

      // FIFO filter
      if (fifoFilter === 'COMPLIANT' && t.fifo_compliant === false) return false;
      if (fifoFilter === 'OVERRIDE' && t.fifo_compliant !== false) return false;

      return true;
    });
  }, [transactions, searchTerm, selectedType, fifoFilter, dateRangeFilter]);

  // 2. Executive Warehouse Summary KPIs
  const kpis = useMemo(() => {
    let totalInUnits = 0;
    let totalOutUnits = 0;
    let totalScrapUnits = 0;
    let totalScrapLossInr = 0;
    let holdCount = 0;
    let outCount = 0;
    let outCompliantCount = 0;

    transactions.forEach((t) => {
      const prod = products.find((p) => p.product_id === t.product_id);
      const cost = prod?.unit_cost || 0;

      if (t.transaction_type === 'IN') {
        totalInUnits += t.quantity;
      } else if (t.transaction_type === 'OUT') {
        totalOutUnits += t.quantity;
        outCount++;
        if (t.fifo_compliant !== false) outCompliantCount++;
      } else if (t.transaction_type === 'EXPIRE') {
        totalScrapUnits += t.quantity;
        totalScrapLossInr += t.quantity * cost;
      } else if (t.transaction_type === 'QUARANTINE') {
        holdCount++;
      }
    });

    const fifoScore = outCount > 0 ? Math.round((outCompliantCount / outCount) * 100) : 100;

    return {
      totalRecorded: transactions.length,
      totalInUnits,
      totalOutUnits,
      totalScrapUnits,
      totalScrapLossInr,
      holdCount,
      fifoScore,
    };
  }, [transactions, products]);

  // 3. Filtered Security Logs
  const filteredSecurityLogs = useMemo(() => {
    return securityLogs.filter((log) => {
      if (securitySeverityFilter !== 'ALL' && log.severity !== securitySeverityFilter) {
        return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const match =
          log.description.toLowerCase().includes(term) ||
          log.eventType.toLowerCase().includes(term) ||
          (log.userName && log.userName.toLowerCase().includes(term)) ||
          (log.userRole && log.userRole.toLowerCase().includes(term));
        if (!match) return false;
      }
      return true;
    });
  }, [securityLogs, securitySeverityFilter, searchTerm]);

  // Reversal Execution
  const handleExecuteReversal = () => {
    if (!reversalTargetTx) return;
    const res = reverseTransaction(reversalTargetTx.transaction_id, reversalReason);
    if (res.success) {
      setReversalTargetTx(null);
      setStatusMessage(res.message || 'Transaction successfully reversed.');
      setTimeout(() => setStatusMessage(''), 4000);
      soundFx.playSuccessChime();
    } else {
      alert(res.message || 'Failed to reverse transaction.');
    }
  };

  const exportCSV = () => {
    if (activeLedgerTab === 'inventory_tx') {
      const headers = [
        'Transaction ID',
        'Date & Time',
        'Type',
        'Product Code',
        'Product Name',
        'Batch Number',
        'Location',
        'Transacted Qty',
        'Previous Qty',
        'New Balance',
        'Operator',
        'Role',
        'Reference Doc',
        'FIFO Compliant',
        'Override Reason',
        'Customer Destination',
        'Notes',
      ];

      const rows = filteredTransactions.map((t) => [
        t.transaction_id,
        `"${t.transaction_date}"`,
        t.transaction_type,
        t.product_code,
        `"${t.product_name}"`,
        t.batch_number,
        t.location_code || '',
        t.quantity,
        t.previous_quantity,
        t.new_quantity,
        `"${t.user_name}"`,
        t.user_role,
        `"${t.reference_document || ''}"`,
        t.fifo_compliant !== false ? 'YES' : 'NO',
        `"${t.override_reason || ''}"`,
        `"${t.customer_destination || ''}"`,
        `"${(t.notes || '').replace(/"/g, '""')}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Warehouse_Inventory_Ledger_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['Log ID', 'Timestamp', 'Event Type', 'Severity', 'User', 'Role', 'Description', 'IP Address'];
      const rows = filteredSecurityLogs.map((l) => [
        l.id,
        `"${l.timestamp}"`,
        l.eventType,
        l.severity,
        `"${l.userName || 'Anonymous'}"`,
        l.userRole || 'N/A',
        `"${l.description.replace(/"/g, '""')}"`,
        l.ipAddress || 'Internal',
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Security_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
    soundFx.playSuccessChime();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans text-xs">
      {/* Notification Toast */}
      {statusMessage && (
        <div className="fixed bottom-5 right-5 z-50 p-3.5 rounded-xl bg-slate-900 text-white shadow-xl flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-xs">{statusMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-2xs">
              <History className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                Warehouse Audit Ledger & Stock Movements
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Tamper-evident inventory journal recording receipts, FIFO dispatches, QA holds, relocations, and write-offs.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Ledger</span>
          </button>
          <button
            type="button"
            onClick={exportCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Executive Warehouse KPI Cockpit */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 text-[10px] font-bold block uppercase">Total Entries</span>
          <span className="text-lg font-bold text-slate-900 font-mono-code">{kpis.totalRecorded}</span>
          <span className="text-[10px] text-slate-400 block font-mono-code">Audit transactions</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 text-[10px] font-bold block uppercase">Inbound Inward</span>
          <span className="text-lg font-bold text-emerald-600 font-mono-code">+{kpis.totalInUnits}</span>
          <span className="text-[10px] text-emerald-600 font-medium block">Received units</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 text-[10px] font-bold block uppercase">Outbound Dispatched</span>
          <span className="text-lg font-bold text-slate-900 font-mono-code">-{kpis.totalOutUnits}</span>
          <span className="text-[10px] text-slate-500 block">Customer dispatches</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 text-[10px] font-bold block uppercase">FIFO Discipline</span>
          <span className="text-lg font-bold text-emerald-700 font-mono-code">{kpis.fifoScore}%</span>
          <span className="text-[10px] text-emerald-700 font-medium block">Compliance score</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 text-[10px] font-bold block uppercase">QA Hold Actions</span>
          <span className="text-lg font-bold text-amber-600 font-mono-code">{kpis.holdCount}</span>
          <span className="text-[10px] text-slate-500 block">Quarantine events</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 text-[10px] font-bold block uppercase">Scrapped Loss</span>
          <span className="text-lg font-bold text-rose-600 font-mono-code">{formatINR(kpis.totalScrapLossInr)}</span>
          <span className="text-[10px] text-rose-600 font-medium block">{kpis.totalScrapUnits} units written off</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 w-fit">
        <button
          onClick={() => setActiveLedgerTab('inventory_tx')}
          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeLedgerTab === 'inventory_tx'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Stock Movement Ledger ({transactions.length})</span>
        </button>
        <button
          onClick={() => setActiveLedgerTab('security_audit')}
          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeLedgerTab === 'security_audit'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Security & Access Logs ({securityLogs.length})</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: INVENTORY TRANSACTIONS
          ═══════════════════════════════════════════════════════════════════ */}
      {activeLedgerTab === 'inventory_tx' && (
        <div className="space-y-4">
          {/* Multi-Filter Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search transaction ID, SKU code, lot number, operator, bin, customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono-code focus:outline-none focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value as any)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none"
              >
                <option value="ALL">All Time History</option>
                <option value="TODAY">Today Only</option>
                <option value="7D">Last 7 Days</option>
                <option value="30D">Last 30 Days</option>
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as any)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none"
              >
                <option value="ALL">All Movement Types</option>
                <option value="IN">IN (Inbound Intake)</option>
                <option value="OUT">OUT (FIFO Dispatch)</option>
                <option value="QUARANTINE">QUARANTINE (QA Hold / Release)</option>
                <option value="EXPIRE">EXPIRE (Write-Off & Scrap)</option>
                <option value="ADJUST">ADJUST (Stock Variance)</option>
                <option value="DAMAGE">DAMAGE (Physical Damage)</option>
              </select>

              <select
                value={fifoFilter}
                onChange={(e) => setFifoFilter(e.target.value as any)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none"
              >
                <option value="ALL">All FIFO States</option>
                <option value="COMPLIANT">100% FIFO Compliant</option>
                <option value="OVERRIDE">Supervisor Overridden</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono-code text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Product Description & SKU</th>
                    <th className="py-2.5 px-3">Lot Number</th>
                    <th className="py-2.5 px-3">Location</th>
                    <th className="py-2.5 px-3 text-right">Transacted Qty</th>
                    <th className="py-2.5 px-3 text-right">Balance</th>
                    <th className="py-2.5 px-3">Operator</th>
                    <th className="py-2.5 px-3">Reference / FIFO</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-400 font-sans">
                        No transactions found matching the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((t) => {
                      const isPositive = t.transaction_type === 'IN';
                      const isNegative = t.transaction_type === 'OUT' || t.transaction_type === 'EXPIRE';

                      return (
                        <tr
                          key={t.transaction_id}
                          className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                          onClick={() => setSelectedTxForDetail(t)}
                        >
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                            {formatDateTime(t.transaction_date)}
                          </td>

                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                t.transaction_type === 'IN'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : t.transaction_type === 'OUT'
                                  ? 'bg-slate-100 text-slate-800 border-slate-200'
                                  : t.transaction_type === 'QUARANTINE'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : t.transaction_type === 'EXPIRE'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}
                            >
                              {t.transaction_type}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 font-sans">
                            <div className="font-bold text-slate-900 leading-tight">{t.product_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono-code">{t.product_code}</div>
                          </td>

                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {t.batch_number}
                          </td>

                          <td className="py-2.5 px-3 text-slate-600 font-semibold">
                            {t.location_code || '-'}
                          </td>

                          <td className={`py-2.5 px-3 text-right font-bold ${isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-900'}`}>
                            {isPositive ? `+${t.quantity}` : isNegative ? `-${t.quantity}` : t.quantity}
                          </td>

                          <td className="py-2.5 px-3 text-right text-slate-700 font-semibold">
                            {t.new_quantity !== undefined ? `${t.new_quantity}` : '-'}
                          </td>

                          <td className="py-2.5 px-3 font-sans text-slate-700">
                            <span className="font-medium text-slate-900 block leading-tight">{t.user_name}</span>
                            <span className="text-[10px] text-slate-400 uppercase font-mono-code">{t.user_role}</span>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-slate-800 truncate max-w-[140px]" title={t.reference_document}>
                                {t.reference_document || t.transaction_id}
                              </span>
                              {t.transaction_type === 'OUT' && (
                                <span>
                                  {t.fifo_compliant !== false ? (
                                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                                      100% FIFO
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded">
                                      OVERRIDE
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedTxForDetail(t)}
                                className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                title="Inspect Certificate"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {t.transaction_type === 'OUT' && (
                                <button
                                  type="button"
                                  onClick={() => setReversalTargetTx(t)}
                                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200 text-[10px] font-semibold transition-colors"
                                  title="Void & Restock"
                                >
                                  Void
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: SECURITY & ACCESS AUDIT
          ═══════════════════════════════════════════════════════════════════ */}
      {activeLedgerTab === 'security_audit' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Access Control & Security Events Log</span>
              <button
                onClick={clearSecurityLogs}
                className="text-[11px] text-slate-500 hover:text-slate-800 font-medium"
              >
                Clear Audit History
              </button>
            </div>

            <table className="w-full text-left font-mono-code text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Operator</th>
                  <th className="py-2.5 px-3">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredSecurityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                      No security audit events recorded.
                    </td>
                  </tr>
                ) : (
                  filteredSecurityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 text-slate-500">{formatDateTime(log.timestamp)}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{log.eventType}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            log.severity === 'CRITICAL'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : log.severity === 'WARNING'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {log.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-700">{log.userName || 'System'}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600">{log.description}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          AUDIT CERTIFICATE MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {selectedTxForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 border border-slate-200 shadow-2xl space-y-4 font-sans text-xs">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Transaction Audit Certificate</h3>
                  <span className="font-mono-code text-[11px] text-slate-500">{selectedTxForDetail.transaction_id}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedTxForDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono-code text-[11px] bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px]">Product Name:</span>
                <span className="font-bold text-slate-900">{selectedTxForDetail.product_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Product SKU:</span>
                <span className="font-bold text-slate-900">{selectedTxForDetail.product_code}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Lot Number:</span>
                <span className="font-bold text-slate-900">{selectedTxForDetail.batch_number}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Bin Location:</span>
                <span className="font-semibold text-slate-800">{selectedTxForDetail.location_code || 'Unassigned'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Initial Qty:</span>
                <span className="font-semibold text-slate-800">{selectedTxForDetail.previous_quantity} units</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Transacted Delta:</span>
                <span className="font-bold text-slate-900">{selectedTxForDetail.quantity} units</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Final Stock Balance:</span>
                <span className="font-bold text-slate-900">{selectedTxForDetail.new_quantity} units</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Timestamp:</span>
                <span className="font-medium text-slate-700">{formatDateTime(selectedTxForDetail.transaction_date)}</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <span className="font-semibold text-slate-700 block text-[11px]">Audit Trace & Authorization:</span>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1 text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Operator:</span>
                  <strong className="text-slate-900">{selectedTxForDetail.user_name} ({selectedTxForDetail.user_role})</strong>
                </div>
                {selectedTxForDetail.reference_document && (
                  <div className="flex items-center justify-between">
                    <span>Reference Document:</span>
                    <strong className="text-slate-900 font-mono-code">{selectedTxForDetail.reference_document}</strong>
                  </div>
                )}
                {selectedTxForDetail.customer_destination && (
                  <div className="flex items-center justify-between">
                    <span>Customer Destination:</span>
                    <strong className="text-slate-900">{selectedTxForDetail.customer_destination}</strong>
                  </div>
                )}
                {selectedTxForDetail.notes && (
                  <div className="pt-1 border-t border-slate-100 text-slate-600">
                    <span className="text-slate-400 block text-[10px]">Notes:</span>
                    <span>{selectedTxForDetail.notes}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
              >
                Print Certificate
              </button>
              <button
                type="button"
                onClick={() => setSelectedTxForDetail(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TRANSACTION VOID / RESTOCK MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {reversalTargetTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-rose-200 shadow-2xl space-y-4 font-sans text-xs">
            <div className="flex items-center space-x-2 text-rose-600 pb-2 border-b border-rose-100">
              <RotateCcw className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 text-sm">Void Outbound Dispatch & Restock</h3>
            </div>
            <p className="text-slate-600">
              You are reversing dispatch <strong className="text-slate-900 font-mono-code">{reversalTargetTx.reference_document || reversalTargetTx.transaction_id}</strong>. This will return <strong className="text-slate-900">{reversalTargetTx.quantity} units</strong> of Lot <strong className="text-slate-900 font-mono-code">{reversalTargetTx.batch_number}</strong> back into active inventory.
            </p>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Audit Reversal Justification *</label>
              <input
                type="text"
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="Reason for voiding shipment..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReversalTargetTx(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReversal}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-2xs"
              >
                Confirm Restock & Void
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
