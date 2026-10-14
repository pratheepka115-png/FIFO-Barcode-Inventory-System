import React, { useState, useMemo } from 'react';
import {
  Boxes,
  PackageCheck,
  AlertOctagon,
  AlertTriangle,
  IndianRupee,
  ArrowDownToLine,
  ArrowUpFromLine,
  Scan,
  Printer,
  ShieldCheck,
  ShieldAlert,
  Clock,
  ArrowRight,
  Search,
  CheckCircle2,
  CheckSquare,
  Square,
  Layers,
  FileText,
  Plus,
  X,
  Tag,
  Info,
  RotateCcw,
  Check,
  MapPin,
  Calendar,
  Flame,
  Snowflake,
  Download,
  Bell,
  BellRing,
  Sparkles,
  Filter,
  ExternalLink,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { calculateShelfLifeStatus, formatDate, formatDateTime } from '../utils/shelfLife';
import { formatINR } from '../utils/currency';
import { ShelfLifeZone, InventoryBatch, WarehouseTask, StorageType } from '../types/inventory';
import { soundFx } from '../utils/sound';
import confetti from 'canvas-confetti';

type CenterTab = 'fifo_queue' | 'expiry_radar' | 'recent_activity' | 'shift_tasks';
type ExpiryFilterType = 'ALL_AT_RISK' | 'CRITICAL_7D' | 'URGENT_15D' | 'WARNING_30D' | 'EXPIRED';

export const Dashboard: React.FC = () => {
  const {
    products,
    batches,
    transactions,
    locations,
    settings,
    currentUser,
    setActiveTab,
    setScannerOpen,
    setSelectedBatchForDetail,
    setPrefilledReceiptProduct,
    quarantineBatch,
    toggleHoldBatch,
    deleteBatch,
    setWriteOffTargetBatch,
  } = useInventory();

  // Dashboard State
  const [criticalBannerExpanded, setCriticalBannerExpanded] = useState<boolean>(true);
  const [activeCenterTab, setActiveCenterTab] = useState<CenterTab>('fifo_queue');
  const [queueSearchTerm, setQueueSearchTerm] = useState<string>('');
  const [queueZoneFilter, setQueueZoneFilter] = useState<string>('ALL');
  const [queueCategoryFilter, setQueueCategoryFilter] = useState<string>('ALL');
  const [notificationMsg, setNotificationMsg] = useState<string>('');

  // Expiry Warning Radar State
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilterType>('ALL_AT_RISK');
  const [expirySearchTerm, setExpirySearchTerm] = useState<string>('');
  const [expiryCategoryFilter, setExpiryCategoryFilter] = useState<string>('ALL');
  const [expiryStorageFilter, setExpiryStorageFilter] = useState<string>('ALL');

  // Generated Pick List Modal State
  const [showPickListModal, setShowPickListModal] = useState<boolean>(false);

  // Shift Tasks State
  const [tasks, setTasks] = useState<WarehouseTask[]>([
    { id: 'task-1', title: 'Quarantine expired lots in Cold Storage C-01', priority: 'HIGH', dueTime: '10:00 AM', completed: false, category: 'QC' },
    { id: 'task-2', title: 'Stage urgent FIFO clearance for Apollo Pharmacy Hub', priority: 'HIGH', dueTime: '12:00 PM', completed: false, category: 'Picking' },
    { id: 'task-3', title: 'Verify inbound supplier delivery notes (PO-8840)', priority: 'MEDIUM', dueTime: '02:30 PM', completed: true, category: 'Receiving' },
    { id: 'task-4', title: 'Audit cycle count on Hazmat Zone H-01', priority: 'MEDIUM', dueTime: 'Tomorrow', completed: false, category: 'Audit' },
    { id: 'task-5', title: 'Print replacement thermal barcode tags for Bay 2', priority: 'LOW', dueTime: 'This week', completed: false, category: 'Maintenance' },
  ]);

  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskPriority, setNewTaskPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [showNewTaskForm, setShowNewTaskForm] = useState<boolean>(false);

  // Active batches
  const activeBatches = useMemo(() => batches.filter((b) => b.quantity_current > 0), [batches]);

  // Inventory value & units breakdown (Accurate calculation distinguishing active, quarantine, and expired)
  const {
    totalValuation,
    activeSaleableValuation,
    quarantineValuation,
    expiredLossValuation,
    totalStockUnits,
    activeStockUnits,
    quarantineUnits,
    expiredUnits,
  } = useMemo(() => {
    let totalVal = 0;
    let activeVal = 0;
    let quarVal = 0;
    let expVal = 0;
    let totalUnits = 0;
    let activeUnits = 0;
    let qUnits = 0;
    let eUnits = 0;

    activeBatches.forEach((b) => {
      const val = b.quantity_current * (b.unit_cost || 0);
      const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
      const isExp = st.zone === 'BLACK' || st.daysRemaining <= 0 || b.status === 'expired';
      const isQuar = b.status === 'quarantine';

      totalVal += val;
      totalUnits += b.quantity_current;

      if (isExp) {
        expVal += val;
        eUnits += b.quantity_current;
      } else if (isQuar) {
        quarVal += val;
        qUnits += b.quantity_current;
      } else {
        activeVal += val;
        activeUnits += b.quantity_current;
      }
    });

    // Include historical written-off expired losses from transactions ledger
    let writtenOffExpiredLoss = 0;
    let writtenOffExpiredUnits = 0;
    transactions.forEach((t) => {
      if (t.transaction_type === 'EXPIRE') {
        const prod = products.find((p) => p.product_id === t.product_id);
        const cost = prod?.unit_cost || 0;
        writtenOffExpiredLoss += t.quantity * cost;
        writtenOffExpiredUnits += t.quantity;
      }
    });

    const combinedExpiredLoss = expVal + writtenOffExpiredLoss;

    return {
      totalValuation: totalVal,
      activeSaleableValuation: activeVal,
      quarantineValuation: quarVal,
      expiredLossValuation: combinedExpiredLoss,
      totalStockUnits: totalUnits,
      activeStockUnits: activeUnits,
      quarantineUnits: qUnits,
      expiredUnits: eUnits + writtenOffExpiredUnits,
    };
  }, [activeBatches, transactions, products]);

  // Category list
  const categories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.category)));
  }, [products]);

  // Low stock products
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => {
      const stock = batches
        .filter((b) => b.product_id === p.product_id && b.status === 'active')
        .reduce((sum, b) => sum + b.quantity_current, 0);
      return stock <= p.reorder_level;
    });
  }, [products, batches]);

  // FIFO Compliance calculation
  const outboundTransactions = useMemo(() => {
    return transactions.filter((t) => t.transaction_type === 'OUT');
  }, [transactions]);

  const compliantPicks = useMemo(() => {
    return outboundTransactions.filter((t) => t.fifo_compliant !== false);
  }, [outboundTransactions]);

  const fifoComplianceRate = outboundTransactions.length > 0
    ? Math.round((compliantPicks.length / outboundTransactions.length) * 100)
    : 100;

  // Shelf-life status counts
  const shelfLifeCounts = useMemo(() => {
    const counts = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0, BLACK: 0 };
    activeBatches.forEach((b) => {
      const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
      counts[st.zone]++;
    });
    return counts;
  }, [activeBatches]);

  // FIFO Clearance Queue: Sorted by FIFO sequence
  const fifoClearanceQueue = useMemo(() => {
    return [...activeBatches]
      .filter((b) => {
        if (queueCategoryFilter !== 'ALL' && b.category !== queueCategoryFilter) return false;
        if (queueSearchTerm) {
          const q = queueSearchTerm.toLowerCase();
          return (
            b.product_name.toLowerCase().includes(q) ||
            b.product_code.toLowerCase().includes(q) ||
            b.batch_number.toLowerCase().includes(q) ||
            b.location_code.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .filter((b) => {
        if (queueZoneFilter === 'ALL') return true;
        const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
        return st.zone === queueZoneFilter;
      })
      .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
  }, [activeBatches, queueSearchTerm, queueZoneFilter, queueCategoryFilter]);

  // Expiry Warning Radar lots
  const filteredExpiryRadarLots = useMemo(() => {
    return activeBatches
      .filter((b) => {
        const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
        if (expiryFilter === 'EXPIRED') return st.daysRemaining <= 0 || st.zone === 'BLACK' || b.status === 'expired';
        if (expiryFilter === 'CRITICAL_7D') return st.daysRemaining > 0 && st.daysRemaining <= 7;
        if (expiryFilter === 'URGENT_15D') return st.daysRemaining > 7 && st.daysRemaining <= 15;
        if (expiryFilter === 'WARNING_30D') return st.daysRemaining > 15 && st.daysRemaining <= 30;
        return st.daysRemaining <= 30;
      })
      .filter((b) => {
        if (expiryCategoryFilter !== 'ALL' && b.category !== expiryCategoryFilter) return false;
        if (expiryStorageFilter !== 'ALL' && b.storage_type !== expiryStorageFilter) return false;
        if (expirySearchTerm) {
          const q = expirySearchTerm.toLowerCase();
          return (
            b.product_name.toLowerCase().includes(q) ||
            b.product_code.toLowerCase().includes(q) ||
            b.batch_number.toLowerCase().includes(q) ||
            b.location_code.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
  }, [activeBatches, expiryFilter, expirySearchTerm, expiryCategoryFilter, expiryStorageFilter]);

  // Total value at risk (items expiring in <= 30 days)
  const totalValueAtRisk = useMemo(() => {
    return activeBatches
      .filter((b) => {
        const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
        return st.daysRemaining <= 30 && b.status !== 'expired';
      })
      .reduce((sum, b) => sum + b.quantity_current * (b.unit_cost || 0), 0);
  }, [activeBatches]);

  // Critical lots (<= 7 days)
  const criticalLotsCount = useMemo(() => {
    return activeBatches.filter((b) => {
      const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
      return st.daysRemaining > 0 && st.daysRemaining <= 7;
    }).length;
  }, [activeBatches]);

  // Expired lots count
  const expiredLotsCount = useMemo(() => {
    return activeBatches.filter((b) => {
      const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
      return st.daysRemaining <= 0 || b.status === 'expired';
    }).length;
  }, [activeBatches]);

  // Location occupancy metrics
  const locationStats = useMemo(() => {
    const totalCapacity = locations.reduce((sum, l) => sum + (l.capacity_units || 0), 0);
    const totalOccupied = locations.reduce((sum, l) => sum + (l.current_occupancy || 0), 0);
    const pct = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;
    return { totalCapacity, totalOccupied, pct };
  }, [locations]);

  // Action handlers
  const handleQuickPickBatch = (batch: InventoryBatch) => {
    setSelectedBatchForDetail(batch);
    setActiveTab('picking');
  };

  const handleExportExpiryManifest = () => {
    const headers = [
      'Risk Classification',
      'Days Remaining',
      'Expiry Date',
      'Product SKU',
      'Product Description',
      'Lot Number',
      'Bin Location',
      'Storage Type',
      'Quantity Remaining',
      'Unit Cost (INR)',
      'Total Value at Risk (INR)',
      'Status',
    ];

    const rows = filteredExpiryRadarLots.map((b) => {
      const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
      const riskLevel =
        st.daysRemaining <= 0 ? 'EXPIRED' : st.daysRemaining <= 7 ? 'CRITICAL (<=7D)' : st.daysRemaining <= 15 ? 'URGENT (8-15D)' : 'WARNING (16-30D)';
      const totalVal = (b.quantity_current * (b.unit_cost || 0)).toFixed(2);
      return [
        riskLevel,
        st.daysRemaining,
        b.expiry_date,
        b.product_code,
        `"${b.product_name}"`,
        b.batch_number,
        b.location_code,
        b.storage_type,
        b.quantity_current,
        b.unit_cost || 0,
        totalVal,
        b.status,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Warehouse_Expiry_Warning_Manifest_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    soundFx.playSuccessChime();
  };

  const handleReorderClick = (product: any, reorderQty: number = 50) => {
    setPrefilledReceiptProduct(product, reorderQty);
    setActiveTab('receipt');
  };

  const toggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
    soundFx.playBarcodeBeep();
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask: WarehouseTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      dueTime: 'Today',
      completed: false,
      category: 'Floor',
    };
    setTasks([newTask, ...tasks]);
    setNewTaskTitle('');
    setShowNewTaskForm(false);
    soundFx.playSuccessChime();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans text-xs">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              Warehouse Operations Command Center
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono-code font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
              Live Sync
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Facility: <strong className="text-slate-800 font-semibold">{settings.company?.warehouse_name || 'Main Distribution Hub'}</strong> · Legal Entity: <strong className="text-slate-800 font-semibold">{settings.company?.name || 'ABC Logistics & Supply Chain'}</strong>
          </p>
        </div>

        {/* Quick Launch Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('receipt')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Goods In [IN]</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('picking')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors shadow-xs"
          >
            <ArrowUpFromLine className="w-3.5 h-3.5" />
            <span>FIFO Outbound [OUT]</span>
          </button>
        </div>
      </div>

      {/* Critical Expiry Alert Banner (Collapsible) */}
      {(criticalLotsCount > 0 || expiredLotsCount > 0) && criticalBannerExpanded && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-rose-100 border border-rose-300 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div className="font-bold text-sm text-rose-950 flex items-center gap-2">
                <span>Immediate Attention Required</span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-200/80 text-rose-800">
                  {expiredLotsCount} Expired · {criticalLotsCount} Critical (≤7d)
                </span>
              </div>
              <p className="text-xs text-rose-700 mt-0.5">
                Total value at expiration risk: <strong>{formatINR(totalValueAtRisk)}</strong>. Review FIFO clearance queue or execute QC quarantine write-off.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={() => {
                setActiveCenterTab('expiry_radar');
                setExpiryFilter('CRITICAL_7D');
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs transition-colors shadow-2xs"
            >
              Resolve in Expiry Radar →
            </button>
            <button
              onClick={() => setCriticalBannerExpanded(false)}
              className="p-1.5 text-rose-600 hover:text-rose-800 rounded-lg hover:bg-rose-100"
              title="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          EXECUTIVE KPI SUMMARY CARDS (5 Core Cards)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Stock Valuation */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Total Valuation (INR)</span>
            <IndianRupee className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 tracking-tight">
            {formatINR(activeSaleableValuation)}
          </div>
          <div className="space-y-1 text-[11px] font-mono-code pt-1 border-t border-slate-100">
            <div className="flex justify-between text-slate-600">
              <span>Active Saleable:</span>
              <span className="font-semibold text-emerald-600">{formatINR(activeSaleableValuation)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Quarantine Hold:</span>
              <span className="font-semibold text-amber-600">{formatINR(quarantineValuation)}</span>
            </div>
            {expiredLossValuation > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Expired Loss:</span>
                <span className="font-semibold text-rose-600">-{formatINR(expiredLossValuation)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Active Stock Units */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Active Inventory Units</span>
            <Boxes className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 tracking-tight">
            {activeStockUnits.toLocaleString()} <span className="text-xs font-normal text-slate-500">units</span>
          </div>
          <div className="space-y-1 text-[11px] pt-1 border-t border-slate-100">
            <div className="flex justify-between text-slate-600">
              <span>Total Lots / Batches:</span>
              <span className="font-semibold text-slate-800">{activeBatches.length} lots</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Low Stock SKUs:</span>
              <span className={`font-semibold ${lowStockProducts.length > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                {lowStockProducts.length} items
              </span>
            </div>
          </div>
        </div>

        {/* FIFO Picking Compliance */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>FIFO Compliance Rate</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-600 tracking-tight">
            {fifoComplianceRate}%
          </div>
          <div className="space-y-1 text-[11px] pt-1 border-t border-slate-100">
            <div className="flex justify-between text-slate-600">
              <span>Compliant Picks:</span>
              <span className="font-semibold text-slate-800">{compliantPicks.length} of {outboundTransactions.length}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-1">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${fifoComplianceRate}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Expiry Risk Radar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Shelf-Life Aging Radar</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xl font-bold text-slate-900">
              {criticalLotsCount + expiredLotsCount}
            </span>
            <span className="text-xs text-slate-500">lots at immediate risk</span>
          </div>
          <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-mono-code pt-1 border-t border-slate-100">
            <div className="bg-rose-50 border border-rose-200 rounded py-0.5 text-rose-700 font-bold">
              {shelfLifeCounts.RED + shelfLifeCounts.BLACK}d
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded py-0.5 text-amber-700 font-bold">
              {shelfLifeCounts.ORANGE}d
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded py-0.5 text-yellow-700 font-bold">
              {shelfLifeCounts.YELLOW}d
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded py-0.5 text-emerald-700 font-bold">
              {shelfLifeCounts.GREEN}d
            </div>
          </div>
        </div>

        {/* Storage Bin Utilization */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Bin Capacity Utilization</span>
            <MapPin className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 tracking-tight">
            {locationStats.pct}% <span className="text-xs font-normal text-slate-500">occupied</span>
          </div>
          <div className="space-y-1 text-[11px] pt-1 border-t border-slate-100">
            <div className="flex justify-between text-slate-600">
              <span>Active Locations:</span>
              <span className="font-semibold text-slate-800">{locations.length} warehouse bins</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-1">
              <div
                className="bg-slate-800 h-full rounded-full transition-all"
                style={{ width: `${locationStats.pct}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          QUICK ACTION COMMAND STATION
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('receipt')}
          className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all text-left group"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 mb-2 group-hover:scale-105 transition-transform">
            <ArrowDownToLine className="w-4 h-4" />
          </div>
          <div className="font-semibold text-slate-900 text-xs">Inbound PO Receipt</div>
          <div className="text-[11px] text-slate-500">Intake stock & generate barcode</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('picking')}
          className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all text-left group"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 mb-2 group-hover:scale-105 transition-transform">
            <ArrowUpFromLine className="w-4 h-4" />
          </div>
          <div className="font-semibold text-slate-900 text-xs">FIFO Outbound Dispatch</div>
          <div className="text-[11px] text-slate-500">Enforce oldest stock allocation</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('barcode_studio')}
          className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all text-left group"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 mb-2 group-hover:scale-105 transition-transform">
            <Tag className="w-4 h-4" />
          </div>
          <div className="font-semibold text-slate-900 text-xs">Thermal Label Studio</div>
          <div className="text-[11px] text-slate-500">Print Code128 & QR barcodes</div>
        </button>

        <button
          type="button"
          onClick={() => setShowPickListModal(true)}
          className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all text-left group"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 mb-2 group-hover:scale-105 transition-transform">
            <Printer className="w-4 h-4" />
          </div>
          <div className="font-semibold text-slate-900 text-xs">Generate Pick Manifest</div>
          <div className="text-[11px] text-slate-500">Print FIFO floor staging sheet</div>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CENTER OPERATIONAL WORKBENCH (TABBED)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Tab Headers */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 sm:px-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setActiveCenterTab('fifo_queue')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeCenterTab === 'fifo_queue'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ArrowUpFromLine className="w-3.5 h-3.5" />
              <span>FIFO Outbound Clearance Queue</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700">
                {fifoClearanceQueue.length}
              </span>
            </button>

            <button
              onClick={() => setActiveCenterTab('expiry_radar')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeCenterTab === 'expiry_radar'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Expiry Risk Radar</span>
              {(criticalLotsCount > 0 || expiredLotsCount > 0) && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-100 text-rose-700 font-bold">
                  {criticalLotsCount + expiredLotsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveCenterTab('recent_activity')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeCenterTab === 'recent_activity'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Audit Log Feed</span>
            </button>

            <button
              onClick={() => setActiveCenterTab('shift_tasks')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeCenterTab === 'shift_tasks'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Floor Shift Tasks</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700">
                {tasks.filter((t) => !t.completed).length}
              </span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {activeCenterTab === 'expiry_radar' && (
              <button
                onClick={handleExportExpiryManifest}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 1: FIFO CLEARANCE QUEUE
            ═══════════════════════════════════════════════════════════════════ */}
        {activeCenterTab === 'fifo_queue' && (
          <div className="p-4 space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Filter by product name, SKU code, lot number, or bin location..."
                  value={queueSearchTerm}
                  onChange={(e) => setQueueSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 shadow-2xs"
                />
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={queueCategoryFilter}
                  onChange={(e) => setQueueCategoryFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none shadow-2xs"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={queueZoneFilter}
                  onChange={(e) => setQueueZoneFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none shadow-2xs"
                >
                  <option value="ALL">All Shelf-Life Zones</option>
                  <option value="BLACK">Expired Lots (&lt;0d)</option>
                  <option value="RED">Critical Zone (&lt;5% left)</option>
                  <option value="ORANGE">Orange Alert (5-15% left)</option>
                  <option value="YELLOW">Yellow Warning (15-30% left)</option>
                  <option value="GREEN">Green Fresh (&gt;30% left)</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono-code text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">FIFO Pick Rank</th>
                      <th className="py-2.5 px-3">Product Name & SKU</th>
                      <th className="py-2.5 px-3">Lot Number</th>
                      <th className="py-2.5 px-3">Location</th>
                      <th className="py-2.5 px-3 text-right">Available Qty</th>
                      <th className="py-2.5 px-3">Expiry Date</th>
                      <th className="py-2.5 px-3">Shelf-Life Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {fifoClearanceQueue.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                          No active lots found matching the filter criteria.
                        </td>
                      </tr>
                    ) : (
                      fifoClearanceQueue.map((b, idx) => {
                        const shelfLife = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
                        const isFirstForProduct =
                          idx === 0 || fifoClearanceQueue[idx - 1]?.product_id !== b.product_id;

                        return (
                          <tr
                            key={b.batch_id}
                            className={`hover:bg-slate-50/70 transition-colors ${
                              isFirstForProduct ? 'bg-emerald-50/30' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 font-sans">
                              {isFirstForProduct ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  ★ Priority #1 Pick
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono-code text-[11px]">
                                  #{idx + 1} In Rotation
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 font-sans">
                              <div className="font-semibold text-slate-900">{b.product_name}</div>
                              <div className="text-[11px] text-slate-400 font-mono-code">{b.product_code} · {b.category}</div>
                            </td>

                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900">{b.batch_number}</span>
                            </td>

                            <td className="py-2.5 px-3 text-slate-600 font-medium">
                              {b.location_code}
                            </td>

                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              {b.quantity_current} {b.unit_of_measure}
                            </td>

                            <td className="py-2.5 px-3 text-slate-700">
                              {formatDate(b.expiry_date)}
                            </td>

                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${shelfLife.badgeClass}`}
                              >
                                {shelfLife.daysRemaining} days left ({shelfLife.percentageRemaining}%)
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end space-x-1.5">
                                {b.status !== 'quarantine' && shelfLife.daysRemaining > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickPickBatch(b)}
                                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium transition-colors shadow-2xs"
                                  >
                                    Pick FIFO
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const res = toggleHoldBatch(
                                      b.batch_id,
                                      b.status === 'quarantine' ? 'Released from hold' : 'Placed on hold from FIFO queue'
                                    );
                                    if (res.success) {
                                      setNotificationMsg(
                                        b.status === 'quarantine'
                                          ? `Lot ${b.batch_number} released to active stock.`
                                          : `Lot ${b.batch_number} placed on QA Hold.`
                                      );
                                      setTimeout(() => setNotificationMsg(''), 3000);
                                    }
                                  }}
                                  className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                                    b.status === 'quarantine'
                                      ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                      : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                  }`}
                                  title={b.status === 'quarantine' ? 'Click to Release / Undo Hold' : 'Place on QA Hold'}
                                >
                                  {b.status === 'quarantine' ? 'Release Hold' : 'Hold'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setWriteOffTargetBatch(b)}
                                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-medium flex items-center gap-1 transition-colors shadow-2xs"
                                  title="Write-off / Material Scrap"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Write-Off</span>
                                </button>
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
            TAB 2: EXPIRY RISK RADAR
            ═══════════════════════════════════════════════════════════════════ */}
        {activeCenterTab === 'expiry_radar' && (
          <div className="p-4 space-y-4">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setExpiryFilter('ALL_AT_RISK')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  expiryFilter === 'ALL_AT_RISK'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All at Risk (≤30d)
              </button>
              <button
                onClick={() => setExpiryFilter('EXPIRED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  expiryFilter === 'EXPIRED'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                Expired Lots ({expiredLotsCount})
              </button>
              <button
                onClick={() => setExpiryFilter('CRITICAL_7D')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  expiryFilter === 'CRITICAL_7D'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Critical (≤7d) ({criticalLotsCount})
              </button>
              <button
                onClick={() => setExpiryFilter('URGENT_15D')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  expiryFilter === 'URGENT_15D'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Urgent (8-15d)
              </button>
              <button
                onClick={() => setExpiryFilter('WARNING_30D')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  expiryFilter === 'WARNING_30D'
                    ? 'bg-yellow-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Warning (16-30d)
              </button>
            </div>

            {/* Grid of Expiry Radar Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredExpiryRadarLots.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 font-sans">
                  No lots found in this expiry horizon.
                </div>
              ) : (
                filteredExpiryRadarLots.map((b) => {
                  const shelfLife = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
                  const isExp = shelfLife.daysRemaining <= 0 || b.status === 'expired';
                  const isCrit = shelfLife.daysRemaining > 0 && shelfLife.daysRemaining <= 7;
                  const lotValuation = b.quantity_current * (b.unit_cost || 0);

                  return (
                    <div
                      key={b.batch_id}
                      className={`p-4 rounded-xl border transition-all ${
                        isExp
                          ? 'bg-rose-50/40 border-rose-300'
                          : isCrit
                          ? 'bg-amber-50/40 border-amber-300'
                          : 'bg-white border-slate-200'
                      } shadow-2xs space-y-3`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono-code text-slate-400 block">{b.product_code}</span>
                          <h4 className="font-bold text-slate-900 text-sm leading-tight">{b.product_name}</h4>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${shelfLife.badgeClass} shrink-0`}>
                          {isExp ? 'EXPIRED' : `${shelfLife.daysRemaining}d left`}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-code bg-white/80 p-2.5 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Lot Number:</span>
                          <span className="font-bold text-slate-800">{b.batch_number}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Location:</span>
                          <span className="font-semibold text-slate-700">{b.location_code}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Quantity:</span>
                          <span className="font-bold text-slate-900">{b.quantity_current} {b.unit_of_measure}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Value at Risk:</span>
                          <span className={`font-bold ${isExp ? 'text-rose-600' : 'text-amber-600'}`}>
                            {formatINR(lotValuation)}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const res = toggleHoldBatch(
                                b.batch_id,
                                b.status === 'quarantine' ? 'Released from quarantine' : 'Quarantined from Expiry Radar'
                              );
                              if (res.success) {
                                setNotificationMsg(
                                  b.status === 'quarantine'
                                    ? `Lot ${b.batch_number} released to active stock.`
                                    : `Lot ${b.batch_number} placed on QA Quarantine Hold.`
                                );
                                setTimeout(() => setNotificationMsg(''), 3000);
                              }
                            }}
                            className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                              b.status === 'quarantine'
                                ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                            }`}
                            title={b.status === 'quarantine' ? 'Click to Release / Undo Hold' : 'Place on QA Hold'}
                          >
                            {b.status === 'quarantine' ? 'Release Hold' : 'Hold'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setWriteOffTargetBatch(b)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors"
                            title="Write-off / Material Scrap"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Write-Off</span>
                          </button>
                        </div>

                        {!isExp && b.status !== 'quarantine' && (
                          <button
                            type="button"
                            onClick={() => handleQuickPickBatch(b)}
                            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold shadow-2xs flex items-center gap-1"
                          >
                            <span>Stage Pick</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 3: RECENT ACTIVITY / AUDIT LOG
            ═══════════════════════════════════════════════════════════════════ */}
        {activeCenterTab === 'recent_activity' && (
          <div className="p-4 space-y-3">
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left font-mono-code text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Product Name & Lot</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3">Operator</th>
                    <th className="py-2.5 px-3">Ref Doc / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {transactions.slice(0, 10).map((t) => (
                    <tr key={t.transaction_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 text-slate-500">{formatDateTime(t.transaction_date)}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.transaction_type === 'IN'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : t.transaction_type === 'OUT'
                              ? 'bg-slate-100 text-slate-800 border border-slate-200'
                              : t.transaction_type === 'QUARANTINE'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {t.transaction_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <div className="font-semibold text-slate-900">{t.product_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono-code">{t.batch_number} · {t.location_code}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {t.transaction_type === 'IN' ? `+${t.quantity}` : t.transaction_type === 'OUT' ? `-${t.quantity}` : t.quantity} units
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-sans">
                        {t.user_name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-sans truncate max-w-xs">
                        {t.notes || t.reference_document || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 4: SHIFT TASKS
            ═══════════════════════════════════════════════════════════════════ */}
        {activeCenterTab === 'shift_tasks' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 text-xs">
                Warehouse Floor Shift Checklist & Action Tasks
              </span>
              <button
                onClick={() => setShowNewTaskForm(!showNewTaskForm)}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Shift Task</span>
              </button>
            </div>

            {showNewTaskForm && (
              <form onSubmit={handleAddTask} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <input
                  type="text"
                  placeholder="Task description (e.g. Inspect cold room seal, replenish bay 3)..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none"
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500 text-[11px]">Priority:</span>
                    {(['HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setNewTaskPriority(p)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          newTaskPriority === p
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <button type="submit" className="px-3 py-1 bg-emerald-600 text-white font-semibold rounded-lg text-xs">
                    Save Task
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => toggleTask(t.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                    t.completed
                      ? 'bg-slate-50/60 border-slate-200 text-slate-400 line-through'
                      : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {t.completed ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className="text-xs font-medium">{t.title}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.priority === 'HIGH'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : t.priority === 'MEDIUM'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {t.priority}
                    </span>
                    <span className="text-[11px] text-slate-400">{t.dueTime}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PICK LIST PRINTABLE MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {showPickListModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-3xl w-full space-y-4 shadow-xl text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-slate-800" />
                <h3 className="text-sm font-bold text-slate-900">Warehouse Outbound FIFO Pick Staging Sheet</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPickListModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 font-mono-code space-y-3">
              <div className="flex justify-between items-start border-b border-slate-200 pb-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 uppercase font-sans">
                    {settings.company?.name || 'ABC Logistics & Supply Chain'}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Facility: {settings.company?.warehouse_name || 'Main Distribution Hub'}
                  </p>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <div>Date: {new Date().toLocaleDateString('en-GB')}</div>
                  <div>Shift: Day Operations</div>
                </div>
              </div>

              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                    <th className="py-2 px-2">Priority</th>
                    <th className="py-2 px-2">SKU Code</th>
                    <th className="py-2 px-2">Product Description</th>
                    <th className="py-2 px-2">Batch / Lot</th>
                    <th className="py-2 px-2">Location</th>
                    <th className="py-2 px-2 text-right">Pick Qty</th>
                    <th className="py-2 px-2">Expiry Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {fifoClearanceQueue.slice(0, 12).map((b, i) => (
                    <tr key={b.batch_id}>
                      <td className="py-1.5 px-2 font-bold text-slate-900">#{i + 1}</td>
                      <td className="py-1.5 px-2">{b.product_code}</td>
                      <td className="py-1.5 px-2 font-sans font-medium">{b.product_name}</td>
                      <td className="py-1.5 px-2 font-bold">{b.batch_number}</td>
                      <td className="py-1.5 px-2 text-slate-700">{b.location_code}</td>
                      <td className="py-1.5 px-2 text-right font-bold">{b.quantity_current} {b.unit_of_measure}</td>
                      <td className="py-1.5 px-2 text-slate-600">{formatDate(b.expiry_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
