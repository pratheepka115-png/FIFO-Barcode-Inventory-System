import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  IndianRupee,
  Clock,
  ShieldCheck,
  TrendingUp,
  Package,
  Layers,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  LineChart as LineChartIcon,
  BarChart3,
  Search,
  Filter,
  ArrowUpDown,
  Printer,
  ChevronRight,
  Info,
  Boxes,
  Trash2,
  ShieldAlert,
  Flame,
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
  Area,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useInventory } from '../context/InventoryContext';
import { calculateShelfLifeStatus, formatDate, formatDateTime } from '../utils/shelfLife';
import { formatINR } from '../utils/currency';
import { InventoryBatch, Product, Transaction } from '../types/inventory';
import { soundFx } from '../utils/sound';

type ReportTab = 'trends' | 'aging' | 'writeoff_losses' | 'velocity_deadstock' | 'compliance';

interface HistoricalDataPoint {
  dateKey: string;
  displayDate: string;
  fullDate: string;
  dayOfWeek: string;
  inboundQty: number;
  outboundQty: number;
  scrapQty: number;
  adjustmentsQty: number;
  netMovement: number;
  inventoryLevel: number;
  valuationINR: number;
}

export const ReportsView: React.FC = () => {
  const {
    products,
    batches,
    transactions,
    locations,
    settings,
    setWriteOffTargetBatch,
    setSelectedBatchForDetail,
    setActiveTab,
  } = useInventory();

  const [activeReportTab, setActiveReportTab] = useState<ReportTab>('trends');
  const [trendTimeframe, setTrendTimeframe] = useState<number>(30); // 7, 14, 30, 90, 180 days
  const [trendProductFilter, setTrendProductFilter] = useState<string>('ALL');
  const [chartMetric, setChartMetric] = useState<'inventory_level' | 'movement_velocity' | 'asset_valuation'>('inventory_level');
  const [agingCategoryFilter, setAgingCategoryFilter] = useState<string>('ALL');
  const [deadstockSearch, setDeadstockSearch] = useState<string>('');

  const activeBatches = useMemo(() => batches.filter((b) => b.quantity_current > 0), [batches]);

  // 1. Shelf-Life Aging Analysis
  const agingBuckets = useMemo(() => {
    return {
      critical_0_30: activeBatches.filter((b) => {
        const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
        return st.daysRemaining >= 0 && st.daysRemaining <= 30;
      }),
      warning_31_60: activeBatches.filter((b) => {
        const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
        return st.daysRemaining > 30 && st.daysRemaining <= 60;
      }),
      medium_61_90: activeBatches.filter((b) => {
        const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
        return st.daysRemaining > 60 && st.daysRemaining <= 90;
      }),
      safe_90_plus: activeBatches.filter((b) => {
        const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
        return st.daysRemaining > 90;
      }),
      expired: activeBatches.filter((b) => {
        const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
        return st.daysRemaining < 0 || b.status === 'expired';
      }),
    };
  }, [activeBatches]);

  // 2. FIFO Compliance Analytics
  const outTx = useMemo(() => transactions.filter((t) => t.transaction_type === 'OUT'), [transactions]);
  const compliantPicks = useMemo(() => outTx.filter((t) => t.fifo_compliant !== false), [outTx]);
  const overridePicks = useMemo(() => outTx.filter((t) => t.fifo_compliant === false), [outTx]);
  const compliancePct = outTx.length > 0 ? Math.round((compliantPicks.length / outTx.length) * 100) : 100;

  // 3. Valuation & Waste (INR)
  const {
    totalStockValuation,
    activeSaleableValuation,
    quarantineValuation,
    expiredLossValuation,
    grossTotalValuation,
    totalPhysicalUnits,
  } = useMemo(() => {
    let grossVal = 0;
    let activeVal = 0;
    let quarVal = 0;
    let expiredVal = 0;
    let units = 0;
    const nowTime = new Date().setHours(0, 0, 0, 0);

    batches.forEach((b) => {
      const isExp = b.status === 'expired' || new Date(b.expiry_date).getTime() < nowTime;
      const isQuar = b.status === 'quarantine';
      const batchCost = Number(b.unit_cost || 0);
      const val = (b.quantity_current || 0) * batchCost;

      if (b.quantity_current > 0) {
        units += b.quantity_current;
        grossVal += val;
        if (isExp) {
          expiredVal += val;
        } else if (isQuar) {
          quarVal += val;
        } else {
          activeVal += val;
        }
      }
    });

    // Include historical written-off expired losses from transactions ledger
    let writtenOffExpiredLoss = 0;
    transactions.forEach((t) => {
      if (t.transaction_type === 'EXPIRE') {
        const prod = products.find((p) => p.product_id === t.product_id);
        const cost = prod?.unit_cost || 0;
        writtenOffExpiredLoss += t.quantity * cost;
      }
    });

    const combinedExpiredLoss = expiredVal + writtenOffExpiredLoss;

    return {
      totalStockValuation: activeVal,
      activeSaleableValuation: activeVal,
      quarantineValuation: quarVal,
      expiredLossValuation: combinedExpiredLoss,
      grossTotalValuation: grossVal,
      totalPhysicalUnits: units,
    };
  }, [batches, transactions, products]);

  // 4. Historical Inventory & Movement Trends (Recharts)
  const { trendData, trendTotals } = useMemo(() => {
    let currentStock = 0;
    let totalCostVal = 0;

    const targetBatches = activeBatches.filter((b) => {
      if (trendProductFilter !== 'ALL' && b.product_id !== trendProductFilter) return false;
      return true;
    });

    targetBatches.forEach((b) => {
      currentStock += b.quantity_current;
      totalCostVal += b.quantity_current * (b.unit_cost || 0);
    });

    let avgUnitCost = currentStock > 0 ? totalCostVal / currentStock : 500;
    if (currentStock === 0 && trendProductFilter !== 'ALL') {
      const p = products.find((x) => x.product_id === trendProductFilter);
      if (p) avgUnitCost = p.unit_cost || 500;
    }

    const relevantTx = transactions.filter((t) => {
      if (trendProductFilter !== 'ALL' && t.product_id !== trendProductFilter) return false;
      return true;
    });

    const daysCount = trendTimeframe;
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    const datesMap: { [dateStr: string]: { inbound: number; outbound: number; scrap: number; adjustments: number } } = {};
    const dateList: { dateObj: Date; dateStr: string; displayDate: string; fullDate: string; dayOfWeek: string }[] = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      const fullDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const dayOfWeek = d.toLocaleDateString('en-GB', { weekday: 'short' });

      datesMap[dateStr] = { inbound: 0, outbound: 0, scrap: 0, adjustments: 0 };
      dateList.push({ dateObj: d, dateStr, displayDate, fullDate, dayOfWeek });
    }

    relevantTx.forEach((tx) => {
      if (!tx.transaction_date) return;
      const txDateStr = tx.transaction_date.split('T')[0];
      if (datesMap[txDateStr]) {
        if (tx.transaction_type === 'IN') {
          datesMap[txDateStr].inbound += tx.quantity || 0;
        } else if (tx.transaction_type === 'OUT') {
          datesMap[txDateStr].outbound += tx.quantity || 0;
        } else if (tx.transaction_type === 'EXPIRE') {
          datesMap[txDateStr].scrap += tx.quantity || 0;
        } else if (tx.transaction_type === 'ADJUST' || tx.transaction_type === 'DAMAGE') {
          datesMap[txDateStr].adjustments += (tx.new_quantity - tx.previous_quantity) || 0;
        }
      }
    });

    const resultReverse: HistoricalDataPoint[] = [];
    let runningClosingStock = currentStock;

    let periodInboundTotal = 0;
    let periodOutboundTotal = 0;
    let periodScrapTotal = 0;

    for (let i = dateList.length - 1; i >= 0; i--) {
      const { dateStr, displayDate, fullDate, dayOfWeek } = dateList[i];
      const bucket = datesMap[dateStr];
      const netChange = bucket.inbound - bucket.outbound - bucket.scrap + bucket.adjustments;

      periodInboundTotal += bucket.inbound;
      periodOutboundTotal += bucket.outbound;
      periodScrapTotal += bucket.scrap;

      resultReverse.push({
        dateKey: dateStr,
        displayDate,
        fullDate,
        dayOfWeek,
        inboundQty: bucket.inbound,
        outboundQty: bucket.outbound,
        scrapQty: bucket.scrap,
        adjustmentsQty: bucket.adjustments,
        netMovement: netChange,
        inventoryLevel: Math.max(0, runningClosingStock),
        valuationINR: Math.max(0, runningClosingStock) * avgUnitCost,
      });

      runningClosingStock = runningClosingStock - netChange;
    }

    const points = resultReverse.reverse();

    return {
      trendData: points,
      trendTotals: {
        currentStock,
        periodInboundTotal,
        periodOutboundTotal,
        periodScrapTotal,
        netMovementPeriod: periodInboundTotal - periodOutboundTotal - periodScrapTotal,
        avgDailyMovement: Math.round((periodInboundTotal + periodOutboundTotal) / daysCount),
        currentValuation: currentStock * avgUnitCost,
      },
    };
  }, [activeBatches, transactions, products, trendTimeframe, trendProductFilter]);

  // 5. Material Write-Off & Scrap Root Cause Analytics
  const scrapAnalytics = useMemo(() => {
    const scrapTx = transactions.filter((t) => t.transaction_type === 'EXPIRE');
    let totalScrapUnits = 0;
    let totalScrapLossInr = 0;
    const reasonMap: { [reason: string]: { units: number; lossInr: number; count: number } } = {};
    const skuMap: { [sku: string]: { name: string; units: number; lossInr: number } } = {};

    scrapTx.forEach((t) => {
      const prod = products.find((p) => p.product_id === t.product_id);
      const cost = prod?.unit_cost || 0;
      const loss = t.quantity * cost;

      totalScrapUnits += t.quantity;
      totalScrapLossInr += loss;

      // Extract reason classification
      const note = t.notes || '';
      let category = 'FEFO Expiry Loss';
      if (note.includes('DAMAGED_SCRAP') || note.toLowerCase().includes('damage')) category = 'Transit / Handling Damage';
      else if (note.includes('QA_REJECTED') || note.toLowerCase().includes('qc') || note.toLowerCase().includes('reject')) category = 'QA / QC Rejection';
      else if (note.includes('OBSOLETE') || note.toLowerCase().includes('obsolete')) category = 'Commercial Obsolescence';
      else if (note.includes('TEMP_EXCURSION') || note.toLowerCase().includes('cold')) category = 'Cold Chain Excursion';
      else if (note.includes('PILFERAGE') || note.toLowerCase().includes('shrinkage')) category = 'Inventory Shrinkage';

      if (!reasonMap[category]) reasonMap[category] = { units: 0, lossInr: 0, count: 0 };
      reasonMap[category].units += t.quantity;
      reasonMap[category].lossInr += loss;
      reasonMap[category].count += 1;

      // Per-SKU map
      const code = t.product_code || 'SKU';
      if (!skuMap[code]) skuMap[code] = { name: t.product_name, units: 0, lossInr: 0 };
      skuMap[code].units += t.quantity;
      skuMap[code].lossInr += loss;
    });

    const categoryBreakdown = Object.entries(reasonMap).map(([cat, val]) => ({
      category: cat,
      units: val.units,
      lossInr: val.lossInr,
      count: val.count,
    }));

    const topLossSkus = Object.entries(skuMap)
      .map(([code, val]) => ({
        product_code: code,
        product_name: val.name,
        units: val.units,
        lossInr: val.lossInr,
      }))
      .sort((a, b) => b.lossInr - a.lossInr);

    return {
      totalScrapUnits,
      totalScrapLossInr,
      categoryBreakdown,
      topLossSkus,
      scrapTx,
    };
  }, [transactions, products]);

  // 6. Fast-Moving vs Dead Stock Analysis
  const velocityAnalysis = useMemo(() => {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const analysis = products.map((p) => {
      const pBatches = batches.filter((b) => b.product_id === p.product_id && b.status === 'active');
      const onHand = pBatches.reduce((s, b) => s + b.quantity_current, 0);
      const stockVal = onHand * (p.unit_cost || 0);

      // Outbound picks in last 60 days
      const pOutTx = transactions.filter(
        (t) => t.product_id === p.product_id && t.transaction_type === 'OUT' && new Date(t.transaction_date) >= sixtyDaysAgo
      );
      const totalDispatched60d = pOutTx.reduce((s, t) => s + t.quantity, 0);
      const pickFrequency = pOutTx.length;

      // Classification
      let classification: 'FAST_MOVING' | 'MEDIUM_VELOCITY' | 'SLOW_MOVING' | 'DEAD_STOCK' = 'DEAD_STOCK';
      if (totalDispatched60d >= 30) {
        classification = 'FAST_MOVING';
      } else if (totalDispatched60d >= 10) {
        classification = 'MEDIUM_VELOCITY';
      } else if (totalDispatched60d > 0) {
        classification = 'SLOW_MOVING';
      } else if (onHand > 0) {
        classification = 'DEAD_STOCK';
      }

      return {
        product_id: p.product_id,
        product_code: p.product_code,
        product_name: p.product_name,
        category: p.category,
        onHand,
        stockVal,
        totalDispatched60d,
        pickFrequency,
        classification,
        unit_cost: p.unit_cost || 0,
      };
    });

    const fastCount = analysis.filter((a) => a.classification === 'FAST_MOVING').length;
    const deadStockItems = analysis.filter((a) => a.classification === 'DEAD_STOCK' && a.onHand > 0);
    const deadStockValuation = deadStockItems.reduce((s, a) => s + a.stockVal, 0);

    return {
      items: analysis,
      fastCount,
      deadStockCount: deadStockItems.length,
      deadStockValuation,
    };
  }, [products, batches, transactions]);

  // Export CSV
  const exportCurrentReport = () => {
    const filename = `Warehouse_${activeReportTab.toUpperCase()}_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    let csvContent = '';

    if (activeReportTab === 'trends') {
      csvContent =
        'Date,Day,Inbound Received (Units),Outbound Dispatched (Units),Scrap Written-Off,Net Movement,Closing Inventory Level (Units),Asset Value (INR)\n' +
        trendData.map((d) => `"${d.fullDate}","${d.dayOfWeek}",${d.inboundQty},${d.outboundQty},${d.scrapQty},${d.netMovement},${d.inventoryLevel},${d.valuationINR.toFixed(2)}`).join('\n');
    } else if (activeReportTab === 'aging') {
      csvContent =
        'Aging Category,Product Name,Batch Number,Location,Current Qty,Unit Cost (INR),Total Value (INR),Expiry Date,Days Left,Shelf Life %\n' +
        activeBatches.map((b) => {
          const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
          const cat = st.daysRemaining < 0 ? 'EXPIRED' : st.daysRemaining <= 30 ? '0-30 Days' : st.daysRemaining <= 60 ? '31-60 Days' : st.daysRemaining <= 90 ? '61-90 Days' : '90+ Days';
          const val = (b.quantity_current || 0) * (b.unit_cost || 0);
          return `"${cat}","${b.product_name}","${b.batch_number}","${b.location_code}",${b.quantity_current},${b.unit_cost || 0},${val.toFixed(2)},"${b.expiry_date}",${st.daysRemaining},${st.percentageRemaining}%`;
        }).join('\n');
    } else if (activeReportTab === 'writeoff_losses') {
      csvContent =
        'Transaction ID,Date,Product Name,Lot Number,Scrap Qty,Unit Cost (INR),Gross Loss (INR),Disposal Category,Notes,Operator\n' +
        scrapAnalytics.scrapTx.map((t) => {
          const prod = products.find((p) => p.product_id === t.product_id);
          const cost = prod?.unit_cost || 0;
          return `"${t.transaction_id}","${t.transaction_date}","${t.product_name}","${t.batch_number}",${t.quantity},${cost},${(t.quantity * cost).toFixed(2)},"${t.reference_document || 'EXPIRE'}","${(t.notes || '').replace(/"/g, '""')}","${t.user_name}"`;
        }).join('\n');
    } else if (activeReportTab === 'velocity_deadstock') {
      csvContent =
        'SKU Code,Product Name,Category,Velocity Classification,On-Hand Qty,Dispatched (60d),Total Value (INR)\n' +
        velocityAnalysis.items.map((v) => `"${v.product_code}","${v.product_name}","${v.category}","${v.classification}",${v.onHand},${v.totalDispatched60d},${v.stockVal.toFixed(2)}`).join('\n');
    } else {
      csvContent =
        'Transaction ID,Date,Product Name,Batch Number,Qty Picked,FIFO Compliant,Reason,Supervisor\n' +
        outTx.map((t) => `"${t.transaction_id}","${t.transaction_date}","${t.product_name}","${t.batch_number}",${t.quantity},${t.fifo_compliant !== false ? 'YES' : 'NO'},"${t.override_reason || 'N/A'}","${t.user_name || 'N/A'}"`).join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    soundFx.playSuccessChime();
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-2xs">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                Warehouse Intelligence, Reports & Movement Trends
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Executive inventory valuation, FEFO shelf degradation, scrap loss analytics, velocity turns, and dead stock audits.
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
            <span>Print Report</span>
          </button>
          <button
            type="button"
            onClick={exportCurrentReport}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Executive Financial Valuation Cockpit */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 text-[10px] font-bold block uppercase">Gross Stock Valuation</span>
          <span className="text-lg font-bold text-slate-900 font-mono-code">{formatINR(grossTotalValuation)}</span>
          <span className="text-[10px] text-slate-500 block">{totalPhysicalUnits.toLocaleString()} units on hand</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 text-[10px] font-bold block uppercase">Active Saleable Value</span>
          <span className="text-lg font-bold text-emerald-600 font-mono-code">{formatINR(activeSaleableValuation)}</span>
          <span className="text-[10px] text-emerald-600 font-medium block">Ready for FIFO dispatch</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 text-[10px] font-bold block uppercase">QA Quarantine Value</span>
          <span className="text-lg font-bold text-amber-600 font-mono-code">{formatINR(quarantineValuation)}</span>
          <span className="text-[10px] text-amber-700 font-medium block">Stock on inspection hold</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 text-[10px] font-bold block uppercase">Total Scrapped & Loss</span>
          <span className="text-lg font-bold text-rose-600 font-mono-code">{formatINR(expiredLossValuation)}</span>
          <span className="text-[10px] text-rose-600 font-medium block">Expired & damaged write-offs</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 text-[10px] font-bold block uppercase">FIFO Pick Compliance</span>
          <span className="text-lg font-bold text-slate-900 font-mono-code">{compliancePct}%</span>
          <span className="text-[10px] text-emerald-700 font-medium block">{compliantPicks.length} of {outTx.length} picks strict FIFO</span>
        </div>
      </div>

      {/* Primary Report Navigation Tabs */}
      <div className="flex flex-wrap items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 w-fit gap-1">
        {[
          { id: 'trends', label: 'Inventory & Movement Trends', icon: TrendingUp },
          { id: 'aging', label: 'FEFO Shelf-Life Aging', icon: Clock },
          { id: 'writeoff_losses', label: 'Scrap & Write-Off Loss Ledger', icon: Trash2 },
          { id: 'velocity_deadstock', label: 'Fast Velocity vs Dead Stock', icon: Flame },
          { id: 'compliance', label: 'FIFO Discipline Auditing', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReportTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReportTab(tab.id as ReportTab)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isActive ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: INVENTORY & MOVEMENT TRENDS
          ═══════════════════════════════════════════════════════════════════ */}
      {activeReportTab === 'trends' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700 text-xs">Time Horizon:</span>
              {[
                { days: 7, label: '7 Days' },
                { days: 14, label: '14 Days' },
                { days: 30, label: '30 Days' },
                { days: 90, label: '90 Days' },
                { days: 180, label: '180 Days' },
              ].map((tf) => (
                <button
                  key={tf.days}
                  onClick={() => setTrendTimeframe(tf.days)}
                  className={`px-2.5 py-1 rounded-lg font-medium text-xs transition-colors ${
                    trendTimeframe === tf.days
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={trendProductFilter}
                onChange={(e) => setTrendProductFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-none"
              >
                <option value="ALL">All Product Catalog SKUs</option>
                {products.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.product_code} — {p.product_name}
                  </option>
                ))}
              </select>

              <select
                value={chartMetric}
                onChange={(e) => setChartMetric(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-none"
              >
                <option value="inventory_level">Stock Level Curve (Units)</option>
                <option value="movement_velocity">Inflow vs Outflow Velocity</option>
                <option value="asset_valuation">Asset Valuation Trend (₹ INR)</option>
              </select>
            </div>
          </div>

          {/* Interactive Chart */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {chartMetric === 'inventory_level'
                    ? 'Historical Inventory Balance & Stock Level Curve'
                    : chartMetric === 'movement_velocity'
                    ? 'Inbound Receipts vs Outbound Dispatches & Scrapped Velocity'
                    : 'Inventory Asset Capital Valuation Curve (₹ INR)'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Daily inventory flow over the last {trendTimeframe} days.
                </p>
              </div>
              <span className="text-xs font-mono-code font-bold text-slate-900">
                Period Total Inward: +{trendTotals.periodInboundTotal} u | Outbound: -{trendTotals.periodOutboundTotal} u
              </span>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {chartMetric === 'inventory_level' ? (
                  <ComposedChart data={trendData}>
                    <defs>
                      <linearGradient id="invGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="displayDate" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    <Area
                      type="monotone"
                      dataKey="inventoryLevel"
                      name="Stock Level (Units)"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#invGradient)"
                    />
                  </ComposedChart>
                ) : chartMetric === 'movement_velocity' ? (
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="displayDate" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    <Bar dataKey="inboundQty" name="Inbound Received (+)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outboundQty" name="Outbound Dispatched (-)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="scrapQty" name="Scrapped Loss (-)" fill="#e11d48" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="displayDate" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    <Line
                      type="monotone"
                      dataKey="valuationINR"
                      name="Asset Value (₹ INR)"
                      stroke="#8b5cf6"
                      strokeWidth={2.5}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: FEFO SHELF-LIFE AGING MATRIX
          ═══════════════════════════════════════════════════════════════════ */}
      {activeReportTab === 'aging' && (
        <div className="space-y-4">
          {/* Aging Buckets Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              {
                id: 'critical_0_30',
                label: 'Critical (≤30d)',
                batches: agingBuckets.critical_0_30,
                color: 'text-rose-600 bg-rose-50 border-rose-200',
              },
              {
                id: 'warning_31_60',
                label: 'Warning (31-60d)',
                batches: agingBuckets.warning_31_60,
                color: 'text-amber-600 bg-amber-50 border-amber-200',
              },
              {
                id: 'medium_61_90',
                label: 'Medium (61-90d)',
                batches: agingBuckets.medium_61_90,
                color: 'text-sky-600 bg-sky-50 border-sky-200',
              },
              {
                id: 'safe_90_plus',
                label: 'Safe Fresh (>90d)',
                batches: agingBuckets.safe_90_plus,
                color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
              },
              {
                id: 'expired',
                label: 'Condemned / Expired',
                batches: agingBuckets.expired,
                color: 'text-slate-800 bg-slate-100 border-slate-300',
              },
            ].map((bucket) => {
              const qty = bucket.batches.reduce((s, b) => s + b.quantity_current, 0);
              const val = bucket.batches.reduce((s, b) => s + b.quantity_current * (b.unit_cost || 0), 0);

              return (
                <div
                  key={bucket.id}
                  onClick={() => setAgingCategoryFilter(agingCategoryFilter === bucket.id ? 'ALL' : bucket.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${bucket.color} ${
                    agingCategoryFilter === bucket.id ? 'ring-2 ring-slate-900 shadow-md' : 'hover:opacity-90'
                  }`}
                >
                  <span className="font-bold block text-xs">{bucket.label}</span>
                  <span className="text-lg font-bold block font-mono-code">{qty} units</span>
                  <span className="text-[10px] opacity-80 block font-mono-code">{formatINR(val)}</span>
                </div>
              );
            })}
          </div>

          {/* Aging Batches Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800">
                FEFO Expiry Timeline & Lot Action Dispatcher
              </span>
              <span className="text-slate-500 font-mono-code text-[11px]">
                Showing {activeBatches.length} active physical lots
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono-code text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Bin Location</th>
                    <th className="py-2.5 px-3">Product Description & SKU</th>
                    <th className="py-2.5 px-3">Lot Number</th>
                    <th className="py-2.5 px-3 text-right">Available Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Cost</th>
                    <th className="py-2.5 px-3 text-right">Book Value</th>
                    <th className="py-2.5 px-3">Expiry Date</th>
                    <th className="py-2.5 px-3">Shelf-Life Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {activeBatches
                    .filter((b) => {
                      if (agingCategoryFilter === 'ALL') return true;
                      const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
                      if (agingCategoryFilter === 'critical_0_30') return st.daysRemaining >= 0 && st.daysRemaining <= 30;
                      if (agingCategoryFilter === 'warning_31_60') return st.daysRemaining > 30 && st.daysRemaining <= 60;
                      if (agingCategoryFilter === 'medium_61_90') return st.daysRemaining > 60 && st.daysRemaining <= 90;
                      if (agingCategoryFilter === 'safe_90_plus') return st.daysRemaining > 90;
                      if (agingCategoryFilter === 'expired') return st.daysRemaining < 0 || b.status === 'expired';
                      return true;
                    })
                    .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())
                    .map((b) => {
                      const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
                      const isExp = st.daysRemaining <= 0 || b.status === 'expired';
                      const val = b.quantity_current * (b.unit_cost || 0);

                      return (
                        <tr key={b.batch_id} className={`hover:bg-slate-50/70 transition-colors ${isExp ? 'bg-rose-50/30' : ''}`}>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{b.location_code}</td>
                          <td className="py-2.5 px-3 font-sans">
                            <span className="font-bold text-slate-900 block">{b.product_name}</span>
                            <span className="text-[10px] text-slate-400 font-mono-code">{b.product_code} · {b.category}</span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">{b.batch_number}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {b.quantity_current} {b.unit_of_measure}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-700">{formatINR(b.unit_cost || 0)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatINR(val)}</td>
                          <td className="py-2.5 px-3 text-slate-700">{formatDate(b.expiry_date)}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${st.badgeClass}`}>
                              {isExp ? 'EXPIRED' : `${st.daysRemaining}d left (${st.percentageRemaining}%)`}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5 font-sans">
                              {!isExp && (
                                <button
                                  onClick={() => {
                                    setSelectedBatchForDetail(b);
                                    setActiveTab('picking');
                                  }}
                                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold shadow-2xs"
                                >
                                  Pick FIFO
                                </button>
                              )}
                              <button
                                onClick={() => setWriteOffTargetBatch(b)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold flex items-center gap-1"
                                title="Material Scrap & Write-Off"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Write-Off</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 3: SCRAP & MATERIAL WRITE-OFF LOSS LEDGER
          ═══════════════════════════════════════════════════════════════════ */}
      {activeReportTab === 'writeoff_losses' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top Scrap Causes Breakdown */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h4 className="font-bold text-slate-900 text-sm">Write-Off Loss by Disposition Category</h4>
              <div className="space-y-2 pt-1">
                {scrapAnalytics.categoryBreakdown.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">No write-offs logged to date.</div>
                ) : (
                  scrapAnalytics.categoryBreakdown.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs">
                      <div>
                        <span className="font-bold text-slate-900 block">{c.category}</span>
                        <span className="text-[10px] text-slate-500 font-mono-code">{c.units} units ({c.count} incident(s))</span>
                      </div>
                      <span className="font-bold text-rose-600 font-mono-code">{formatINR(c.lossInr)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top Loss Generating SKUs */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3 md:col-span-2">
              <h4 className="font-bold text-slate-900 text-sm">Top Loss Impact SKUs (Condemned Stock)</h4>
              <div className="space-y-2 pt-1">
                {scrapAnalytics.topLossSkus.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">Zero material loss recorded.</div>
                ) : (
                  scrapAnalytics.topLossSkus.slice(0, 5).map((sku, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 text-xs">
                      <div>
                        <span className="font-bold text-slate-900 block">{sku.product_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono-code">SKU: {sku.product_code} · {sku.units} units scrapped</span>
                      </div>
                      <span className="font-bold text-rose-700 font-mono-code text-sm">{formatINR(sku.lossInr)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Detailed Scrap Transaction Journal */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800">Audited Material Write-Off Certificates Journal</span>
              <span className="text-slate-500 font-mono-code text-[11px]">
                Total Scrapped Loss: <strong className="text-rose-600 font-bold">{formatINR(scrapAnalytics.totalScrapLossInr)}</strong>
              </span>
            </div>

            <table className="w-full text-left font-mono-code text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Ref Certificate</th>
                  <th className="py-2.5 px-3">Product Name & SKU</th>
                  <th className="py-2.5 px-3">Lot Number</th>
                  <th className="py-2.5 px-3 text-right">Scrapped Qty</th>
                  <th className="py-2.5 px-3 text-right">Financial Loss</th>
                  <th className="py-2.5 px-3">Operator / Witness</th>
                  <th className="py-2.5 px-3">Audit Explanation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {scrapAnalytics.scrapTx.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                      No material scrap transactions recorded.
                    </td>
                  </tr>
                ) : (
                  scrapAnalytics.scrapTx.map((t) => {
                    const prod = products.find((p) => p.product_id === t.product_id);
                    const cost = prod?.unit_cost || 0;
                    const loss = t.quantity * cost;

                    return (
                      <tr key={t.transaction_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 text-slate-500">{formatDateTime(t.transaction_date)}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{t.reference_document || 'SCRAP-CERT'}</td>
                        <td className="py-2.5 px-3 font-sans">
                          <span className="font-semibold text-slate-900 block">{t.product_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono-code">{t.product_code}</span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{t.batch_number}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-rose-600">-{t.quantity} u</td>
                        <td className="py-2.5 px-3 text-right font-bold text-rose-700">{formatINR(loss)}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-700">{t.user_name}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-600 max-w-xs truncate">{t.notes}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 4: FAST VELOCITY VS DEAD STOCK
          ═══════════════════════════════════════════════════════════════════ */}
      {activeReportTab === 'velocity_deadstock' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-slate-500 text-[10px] font-bold block uppercase">Fast-Moving SKUs</span>
              <span className="text-lg font-bold text-emerald-600 font-mono-code">{velocityAnalysis.fastCount} SKUs</span>
              <span className="text-[10px] text-slate-500 block">&ge;30 picks in last 60 days</span>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-slate-500 text-[10px] font-bold block uppercase">Dead Stock SKUs</span>
              <span className="text-lg font-bold text-rose-600 font-mono-code">{velocityAnalysis.deadStockCount} SKUs</span>
              <span className="text-[10px] text-slate-500 block">Zero dispatches in 60d+</span>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1 md:col-span-2">
              <span className="text-slate-500 text-[10px] font-bold block uppercase">Dead Stock Capital Locked</span>
              <span className="text-lg font-bold text-slate-900 font-mono-code">{formatINR(velocityAnalysis.deadStockValuation)}</span>
              <span className="text-[10px] text-amber-700 font-medium block">Action recommended: Clear bin space or return to vendor</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800">SKU Movement Velocity & Turnover Classification</span>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search SKU or category..."
                  value={deadstockSearch}
                  onChange={(e) => setDeadstockSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono-code focus:outline-none"
                />
              </div>
            </div>

            <table className="w-full text-left font-mono-code text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">SKU Code</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Velocity Class</th>
                  <th className="py-2.5 px-3 text-right">On-Hand Qty</th>
                  <th className="py-2.5 px-3 text-right">Dispatched (60d)</th>
                  <th className="py-2.5 px-3 text-right">Capital Value</th>
                  <th className="py-2.5 px-3">Action Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {velocityAnalysis.items
                  .filter((item) => {
                    if (!deadstockSearch) return true;
                    const q = deadstockSearch.toLowerCase();
                    return item.product_name.toLowerCase().includes(q) || item.product_code.toLowerCase().includes(q);
                  })
                  .map((item) => (
                    <tr key={item.product_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{item.product_code}</td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">{item.product_name}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600">{item.category}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            item.classification === 'FAST_MOVING'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : item.classification === 'MEDIUM_VELOCITY'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : item.classification === 'SLOW_MOVING'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {item.classification.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">{item.onHand} u</td>
                      <td className="py-2.5 px-3 text-right text-slate-700">{item.totalDispatched60d} u</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatINR(item.stockVal)}</td>
                      <td className="py-2.5 px-3 font-sans text-[11px] text-slate-600">
                        {item.classification === 'FAST_MOVING'
                          ? 'Maintain safety stock; high replenishment priority'
                          : item.classification === 'DEAD_STOCK' && item.onHand > 0
                          ? 'Decommission lot, offer client discount, or scrap'
                          : 'Standard FIFO rotation active'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 5: FIFO DISCIPLINE AUDITING
          ═══════════════════════════════════════════════════════════════════ */}
      {activeReportTab === 'compliance' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">First-In, First-Out (FIFO) Picking Compliance Scorecard</h3>
                <p className="text-[11px] text-slate-500">
                  Audit record of all outbound shipments ensuring earliest expiry batches are dispatched first.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 rounded-lg text-xs">
                  {compliancePct}% Adherence
                </span>
              </div>
            </div>

            <table className="w-full text-left font-mono-code text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Reference Doc</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Dispatched Lot</th>
                  <th className="py-2.5 px-3 text-right">Picked Qty</th>
                  <th className="py-2.5 px-3">FIFO Audit Result</th>
                  <th className="py-2.5 px-3">Supervisor Override Reason</th>
                  <th className="py-2.5 px-3">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {outTx.map((t) => (
                  <tr key={t.transaction_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 text-slate-500">{formatDateTime(t.transaction_date)}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{t.reference_document || t.transaction_id}</td>
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-800">{t.product_name}</td>
                    <td className="py-2.5 px-3">{t.batch_number}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">{t.quantity} u</td>
                    <td className="py-2.5 px-3">
                      {t.fifo_compliant !== false ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
                          100% COMPLIANT
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-800">
                          OVERRIDDEN
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-600 max-w-xs truncate">
                      {t.override_reason || 'Standard FIFO pick'}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-700">{t.user_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper Tooltip
const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data: HistoricalDataPoint = payload[0].payload;
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xl text-xs font-mono-code space-y-1.5">
        <div className="font-bold text-slate-900 border-b border-slate-100 pb-1 flex items-center justify-between gap-4 font-sans">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{data.fullDate}</span>
          </span>
          <span className="text-[10px] text-slate-400 uppercase font-mono-code font-normal">
            {data.dayOfWeek}
          </span>
        </div>

        <div className="space-y-1 pt-0.5">
          <div className="flex items-center justify-between gap-6 text-emerald-600 font-bold">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Closing Stock Level:</span>
            </span>
            <span>{data.inventoryLevel} units</span>
          </div>

          <div className="flex items-center justify-between gap-6 text-slate-700">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="w-2 h-2 rounded-full bg-sky-500"></span>
              <span>Inbound Putaway (+):</span>
            </span>
            <span>+{data.inboundQty} units</span>
          </div>

          <div className="flex items-center justify-between gap-6 text-rose-600">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>Outbound Dispatched (-):</span>
            </span>
            <span>-{data.outboundQty} units</span>
          </div>

          {data.scrapQty > 0 && (
            <div className="flex items-center justify-between gap-6 text-rose-700 font-bold">
              <span className="flex items-center gap-1.5 font-sans">
                <span className="w-2 h-2 rounded-full bg-rose-700"></span>
                <span>Scrapped Loss (-):</span>
              </span>
              <span>-{data.scrapQty} units</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-6 text-slate-900 font-bold pt-1 border-t border-slate-100 font-sans">
            <span>Asset Valuation:</span>
            <span>{formatINR(data.valuationINR)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};
