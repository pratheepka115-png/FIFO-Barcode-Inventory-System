import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Printer,
  Boxes,
  ArrowUpFromLine,
  ArrowDownToLine,
  SlidersHorizontal,
  Download,
  ShieldAlert,
  ShieldCheck,
  History,
  Tag,
  Plus,
  Trash2,
  Info,
  Calendar,
  Layers,
  AlertTriangle,
  Clock,
  IndianRupee,
  TrendingDown,
  TrendingUp,
  Activity,
  CheckCircle2,
  HelpCircle,
  FileSpreadsheet,
  RotateCcw,
  X,
  MapPin,
  Edit2,
  Check,
  FileText,
  QrCode,
  FileDown,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { calculateShelfLifeStatus, formatDate } from '../utils/shelfLife';
import { formatINR } from '../utils/currency';
import { InventoryBatch, Product, ShelfLifeZone, BatchStatus, StorageType, Location } from '../types/inventory';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { BatchQRModal } from './BatchQRModal';
import { soundFx } from '../utils/sound';

type GridTab = 'batches' | 'sku_master' | 'bin_locations';
type QuickPreset = 'ALL' | 'EXPIRING_7D' | 'FIFO_TOP_PICKS' | 'COLD_CHAIN' | 'QUARANTINE' | 'LOW_STOCK';

export const InventoryGrid: React.FC = () => {
  const {
    batches,
    products,
    locations,
    transactions,
    settings,
    currentUser,
    setActiveTab,
    setSelectedBatchForDetail,
    setPrefilledReceiptProduct,
    quarantineBatch,
    toggleHoldBatch,
    relocateBatch,
    deleteBatch,
    setWriteOffTargetBatch,
    deleteProduct,
    addProduct,
    updateProduct,
    addLocation,
    updateLocation,
    deleteLocation,
    pickGoods,
  } = useInventory();

  // Active View Tab
  const [activeTab, setGridTab] = useState<GridTab>('batches');
  const [activePreset, setActivePreset] = useState<QuickPreset>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedZone, setSelectedZone] = useState<ShelfLifeZone | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<BatchStatus | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStorage, setSelectedStorage] = useState<StorageType | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'expiry_asc' | 'expiry_desc' | 'qty_desc' | 'name_asc' | 'value_desc'>('expiry_asc');

  // Modals & Popovers
  const [qrModalBatch, setQrModalBatch] = useState<InventoryBatch | null>(null);
  const [adjustBatch, setAdjustBatch] = useState<InventoryBatch | null>(null);
  const [deleteConfirmBatch, setDeleteConfirmBatch] = useState<InventoryBatch | null>(null);
  const [deleteConfirmSku, setDeleteConfirmSku] = useState<Product | null>(null);
  const [deleteConfirmLocation, setDeleteConfirmLocation] = useState<Location | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Relocation Modal State
  const [relocateTargetBatch, setRelocateTargetBatch] = useState<InventoryBatch | null>(null);
  const [customRelocateBin, setCustomRelocateBin] = useState<string>('');

  // Add/Edit Custom Location Modal
  const [showAddLocationModal, setShowAddLocationModal] = useState<boolean>(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locCode, setLocCode] = useState<string>('');
  const [locSection, setLocSection] = useState<string>('A');
  const [locAisle, setLocAisle] = useState<string>('01');
  const [locStorageType, setLocStorageType] = useState<StorageType>('ambient');
  const [locMaxCapacity, setLocMaxCapacity] = useState<number>(100);

  // Add/Edit SKU Modal
  const [showAddSkuModal, setShowAddSkuModal] = useState<boolean>(false);
  const [editingSku, setEditingSku] = useState<Product | null>(null);
  const [skuCode, setSkuCode] = useState<string>('');
  const [skuName, setSkuName] = useState<string>('');
  const [skuCategory, setSkuCategory] = useState<string>('Grains & Baking');
  const [skuShelfLifeDays, setSkuShelfLifeDays] = useState<number>(180);
  const [skuUom, setSkuUom] = useState<string>('bags');
  const [skuReorderLevel, setSkuReorderLevel] = useState<number>(25);
  const [skuStorage, setSkuStorage] = useState<StorageType>('ambient');
  const [skuUnitCost, setSkuUnitCost] = useState<number>(500);
  const [skuSellingPrice, setSkuSellingPrice] = useState<number>(650);

  // Quick Pick Modal
  const [quickPickBatch, setQuickPickBatch] = useState<InventoryBatch | null>(null);
  const [quickPickQty, setQuickPickQty] = useState<number>(1);
  const [quickPickCustomer, setQuickPickCustomer] = useState<string>('Standard Customer Dispatch');

  // Categories list
  const categories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.category)));
  }, [products]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalQty = 0;
    let totalGrossVal = 0;
    let activeSaleableVal = 0;
    let quarantineVal = 0;
    let expiredVal = 0;
    let expiredCount = 0;
    let quarantineCount = 0;
    let criticalCount = 0;

    batches.forEach((b) => {
      if (b.quantity_current > 0) {
        totalQty += b.quantity_current;
        const val = b.quantity_current * (b.unit_cost || 0);
        totalGrossVal += val;

        const shelfLife = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
        const isExp = shelfLife.daysRemaining <= 0 || b.status === 'expired' || shelfLife.zone === 'BLACK';
        const isQuar = b.status === 'quarantine';

        if (isExp) {
          expiredCount++;
          expiredVal += val;
        } else if (isQuar) {
          quarantineCount++;
          quarantineVal += val;
        } else {
          activeSaleableVal += val;
          if (shelfLife.daysRemaining <= 7) criticalCount++;
        }
      }
    });

    return {
      totalQty,
      totalGrossVal,
      activeSaleableVal,
      quarantineVal,
      expiredVal,
      expiredCount,
      quarantineCount,
      criticalCount,
    };
  }, [batches]);

  // Filtered batches
  const filteredBatches = useMemo(() => {
    return batches
      .filter((b) => {
        // Quick Presets
        if (activePreset === 'EXPIRING_7D') {
          const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
          if (st.daysRemaining > 7 || b.quantity_current <= 0) return false;
        } else if (activePreset === 'COLD_CHAIN') {
          if (b.storage_type !== 'refrigerated' && b.storage_type !== 'frozen') return false;
        } else if (activePreset === 'QUARANTINE') {
          if (b.status !== 'quarantine') return false;
        } else if (activePreset === 'LOW_STOCK') {
          const prod = products.find((p) => p.product_id === b.product_id);
          if (!prod) return false;
          const totalProdQty = batches
            .filter((x) => x.product_id === prod.product_id && x.status === 'active')
            .reduce((s, x) => s + x.quantity_current, 0);
          if (totalProdQty > prod.reorder_level) return false;
        }

        // Zone filter
        if (selectedZone !== 'ALL') {
          const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
          if (st.zone !== selectedZone) return false;
        }

        // Status filter
        if (selectedStatus !== 'ALL' && b.status !== selectedStatus) return false;

        // Category filter
        if (selectedCategory !== 'ALL' && b.category !== selectedCategory) return false;

        // Storage filter
        if (selectedStorage !== 'ALL' && b.storage_type !== selectedStorage) return false;

        // Search term
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const matches =
            b.product_name.toLowerCase().includes(q) ||
            b.product_code.toLowerCase().includes(q) ||
            b.batch_number.toLowerCase().includes(q) ||
            b.location_code.toLowerCase().includes(q) ||
            b.supplier_name.toLowerCase().includes(q);
          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'expiry_asc') {
          return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
        }
        if (sortBy === 'expiry_desc') {
          return new Date(b.expiry_date).getTime() - new Date(a.expiry_date).getTime();
        }
        if (sortBy === 'qty_desc') {
          return b.quantity_current - a.quantity_current;
        }
        if (sortBy === 'value_desc') {
          return b.quantity_current * (b.unit_cost || 0) - a.quantity_current * (a.unit_cost || 0);
        }
        if (sortBy === 'name_asc') {
          return a.product_name.localeCompare(b.product_name);
        }
        return 0;
      });
  }, [batches, activePreset, selectedZone, selectedStatus, selectedCategory, selectedStorage, searchTerm, sortBy, products]);

  // Actions
  const handleConfirmDeleteBatch = () => {
    if (!deleteConfirmBatch) return;
    deleteBatch(deleteConfirmBatch.batch_id, 'Administrative lot deletion');
    setDeleteConfirmBatch(null);
    setStatusMessage('Batch lot deleted successfully.');
    setTimeout(() => setStatusMessage(''), 3000);
    soundFx.playSuccessChime();
  };

  const handleConfirmDeleteSku = () => {
    if (!deleteConfirmSku) return;
    deleteProduct(deleteConfirmSku.product_id);
    setDeleteConfirmSku(null);
    setStatusMessage('Product SKU deleted successfully.');
    setTimeout(() => setStatusMessage(''), 3000);
    soundFx.playSuccessChime();
  };

  const handleConfirmDeleteLocation = () => {
    if (!deleteConfirmLocation) return;
    deleteLocation(deleteConfirmLocation.location_id);
    setDeleteConfirmLocation(null);
    setStatusMessage('Location bin deleted successfully.');
    setTimeout(() => setStatusMessage(''), 3000);
    soundFx.playSuccessChime();
  };

  const handleSaveLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locCode.trim()) return;

    if (editingLocation) {
      updateLocation({
        ...editingLocation,
        location_code: locCode.trim().toUpperCase(),
        section: locSection,
        aisle: locAisle,
        storage_type: locStorageType,
        capacity_units: locMaxCapacity,
      });
      setStatusMessage(`Location ${locCode} updated.`);
    } else {
      addLocation({
        location_code: locCode.trim().toUpperCase(),
        section: locSection,
        aisle: locAisle,
        rack: 1,
        position: 1,
        storage_type: locStorageType,
        capacity_units: locMaxCapacity,
      });
      setStatusMessage(`Location ${locCode} created.`);
    }

    setShowAddLocationModal(false);
    setEditingLocation(null);
    setTimeout(() => setStatusMessage(''), 3000);
    soundFx.playSuccessChime();
  };

  const handleSaveSku = (e: React.FormEvent) => {
    e.preventDefault();
    if (!skuCode.trim() || !skuName.trim()) return;

    if (editingSku) {
      updateProduct({
        ...editingSku,
        product_code: skuCode.trim().toUpperCase(),
        product_name: skuName.trim(),
        category: skuCategory,
        default_shelf_life_days: skuShelfLifeDays,
        unit_of_measure: skuUom,
        reorder_level: skuReorderLevel,
        storage_requirements: skuStorage,
        unit_cost: skuUnitCost,
        selling_price: skuSellingPrice,
      });
      setStatusMessage(`SKU ${skuCode} updated.`);
    } else {
      addProduct({
        product_code: skuCode.trim().toUpperCase(),
        product_name: skuName.trim(),
        category: skuCategory,
        default_shelf_life_days: skuShelfLifeDays,
        unit_of_measure: skuUom,
        reorder_level: skuReorderLevel,
        storage_requirements: skuStorage,
        unit_cost: skuUnitCost,
        selling_price: skuSellingPrice,
      });
      setStatusMessage(`SKU ${skuCode} created.`);
    }

    setShowAddSkuModal(false);
    setEditingSku(null);
    setTimeout(() => setStatusMessage(''), 3000);
    soundFx.playSuccessChime();
  };

  const handleExecuteRelocate = () => {
    if (!relocateTargetBatch || !customRelocateBin.trim()) return;
    relocateBatch(relocateTargetBatch.batch_id, customRelocateBin.trim().toUpperCase());
    setRelocateTargetBatch(null);
    setStatusMessage(`Batch ${relocateTargetBatch.batch_number} relocated to ${customRelocateBin}.`);
    setTimeout(() => setStatusMessage(''), 3000);
    soundFx.playSuccessChime();
  };

  const handleExecuteQuickPick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPickBatch) return;

    const res = pickGoods({
      batchId: quickPickBatch.batch_id,
      quantity: quickPickQty,
      purpose: 'CUSTOMER_DISPATCH',
      salesOrderRef: `SO-QUICK-${Date.now().toString().slice(-5)}`,
      customerDestination: quickPickCustomer,
      transporterName: 'Standard Logistics Carrier',
      vehicleNumber: 'NA',
      waybillNumber: `WB-${Date.now().toString().slice(-6)}`,
      driverPhone: '+91 98000 00000',
      notes: 'Quick pick direct from inventory grid',
    });

    if (res.success) {
      setQuickPickBatch(null);
      setStatusMessage(`Dispatched ${quickPickQty} units of Lot ${quickPickBatch.batch_number}.`);
      setTimeout(() => setStatusMessage(''), 3000);
      soundFx.playSuccessChime();
    } else {
      alert(res.error || 'Failed to dispatch.');
    }
  };

  const handleExportCSV = () => {
    const headers = ['Lot Number', 'Product Code', 'Product Name', 'Location', 'Quantity', 'UOM', 'Expiry Date', 'Status', 'Unit Cost (INR)', 'Total Value (INR)'];
    const rows = filteredBatches.map((b) => [
      b.batch_number,
      b.product_code,
      `"${b.product_name}"`,
      b.location_code,
      b.quantity_current,
      b.unit_of_measure,
      b.expiry_date,
      b.status,
      b.unit_cost || 0,
      ((b.unit_cost || 0) * b.quantity_current).toFixed(2),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Inventory_Lots_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    soundFx.playSuccessChime();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans text-xs">
      {/* Toast Notification */}
      {statusMessage && (
        <div className="fixed bottom-5 right-5 z-50 p-3.5 rounded-xl bg-slate-900 text-white shadow-xl flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-xs">{statusMessage}</span>
        </div>
      )}

      {/* Header & Primary Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
            Inventory & Lot Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Batch-level FEFO/FIFO tracking, dynamic bin locations, SKU catalog, and shelf-life monitoring.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setGridTab('batches')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'batches'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Active Batches & Lots ({batches.filter((b) => b.quantity_current > 0).length})</span>
          </button>
          <button
            onClick={() => setGridTab('sku_master')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'sku_master'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>SKU Master Catalog ({products.length})</span>
          </button>
          <button
            onClick={() => setGridTab('bin_locations')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'bin_locations'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Warehouse Bins ({locations.length})</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: ACTIVE BATCHES & LOTS
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          {/* Executive Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-slate-500 text-[11px] font-semibold block uppercase">Active Saleable Value</span>
              <span className="text-lg font-bold text-slate-900">{formatINR(stats.activeSaleableVal)}</span>
              <span className="text-[11px] text-emerald-600 font-medium block">Ready for FIFO dispatch</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-slate-500 text-[11px] font-semibold block uppercase">Quarantined Stock Value</span>
              <span className="text-lg font-bold text-amber-600">{formatINR(stats.quarantineVal)}</span>
              <span className="text-[11px] text-slate-500 block">{stats.quarantineCount} batches in QC hold</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-slate-500 text-[11px] font-semibold block uppercase">Expired Loss (Write-off)</span>
              <span className="text-lg font-bold text-rose-600">{formatINR(stats.expiredVal)}</span>
              <span className="text-[11px] text-slate-500 block">{stats.expiredCount} expired lots</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-slate-500 text-[11px] font-semibold block uppercase">Total Physical Units</span>
              <span className="text-lg font-bold text-slate-900">{stats.totalQty.toLocaleString()} units</span>
              <span className="text-[11px] text-slate-500 block">Across {batches.length} recorded lots</span>
            </div>
          </div>

          {/* Filter Bar & Quick Presets */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL', label: 'All Lots' },
                  { id: 'EXPIRING_7D', label: 'Expiring in ≤7d' },
                  { id: 'COLD_CHAIN', label: 'Cold Storage' },
                  { id: 'QUARANTINE', label: 'Quarantine' },
                  { id: 'LOW_STOCK', label: 'Low Stock SKUs' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setActivePreset(p.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      activePreset === p.id
                        ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = filteredBatches[0] || batches[0];
                    if (target) setQrModalBatch(target);
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100/80 text-indigo-800 text-xs font-semibold shadow-2xs transition-colors"
                  title="Generate, download PDF (via html2canvas & jsPDF), or print QR code labels for inventory batches"
                >
                  <FileDown className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Download PDF</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Inputs & Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-2 border-t border-slate-100">
              <div className="relative lg:col-span-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search lot #, SKU, bin location, supplier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 shadow-2xs"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none shadow-2xs"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value as any)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none shadow-2xs"
              >
                <option value="ALL">All Shelf-Life Zones</option>
                <option value="GREEN">Green Fresh (&gt;30%)</option>
                <option value="YELLOW">Yellow Warning (15-30%)</option>
                <option value="ORANGE">Orange Alert (5-15%)</option>
                <option value="RED">Red Critical (&lt;5%)</option>
                <option value="BLACK">Black Expired (&lt;0d)</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none shadow-2xs"
              >
                <option value="expiry_asc">Sort: Oldest Expiry (FIFO)</option>
                <option value="expiry_desc">Sort: Latest Expiry</option>
                <option value="qty_desc">Sort: Highest Quantity</option>
                <option value="value_desc">Sort: Highest Valuation (₹)</option>
                <option value="name_asc">Sort: Product Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Lots Data Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono-code text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Lot Number</th>
                    <th className="py-2.5 px-3">SKU & Product Name</th>
                    <th className="py-2.5 px-3">Bin Location</th>
                    <th className="py-2.5 px-3">Shelf-Life Status</th>
                    <th className="py-2.5 px-3 text-right">Available Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Cost (₹)</th>
                    <th className="py-2.5 px-3 text-right">Valuation (₹)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 font-sans">
                        No lots match the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((b) => {
                      const shelfLife = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
                      const totalVal = b.quantity_current * (b.unit_cost || 0);
                      const isExp = shelfLife.daysRemaining <= 0 || b.status === 'expired';

                      return (
                        <tr key={b.batch_id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {b.batch_number}
                            <span className="block text-[10px] text-slate-400 font-sans font-normal">{b.supplier_name}</span>
                          </td>

                          <td className="py-2.5 px-3 font-sans">
                            <div className="font-semibold text-slate-900">{b.product_name}</div>
                            <div className="text-[11px] text-slate-400 font-mono-code">{b.product_code} · {b.category}</div>
                          </td>

                          <td className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={() => {
                                setRelocateTargetBatch(b);
                                setCustomRelocateBin(b.location_code);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-semibold text-[11px] transition-colors"
                              title="Click to relocate bin"
                            >
                              <MapPin className="w-3 h-3 text-slate-500" />
                              <span>{b.location_code}</span>
                              <Edit2 className="w-2.5 h-2.5 text-slate-400" />
                            </button>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${shelfLife.badgeClass}`}>
                                {isExp ? 'EXPIRED' : `${shelfLife.daysRemaining}d (${shelfLife.percentageRemaining}%)`}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {formatDate(b.expiry_date)}
                              </span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {b.quantity_current} <span className="text-[10px] font-normal text-slate-400">{b.unit_of_measure}</span>
                          </td>

                          <td className="py-2.5 px-3 text-right text-slate-700">
                            {formatINR(b.unit_cost || 0)}
                          </td>

                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {formatINR(totalVal)}
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            {b.status === 'quarantine' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-800">
                                QUARANTINE
                              </span>
                            ) : isExp ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 border border-rose-200 text-rose-800">
                                EXPIRED
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ACTIVE
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-1.5 font-sans">
                              {b.quantity_current > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickPickBatch(b);
                                    setQuickPickQty(Math.min(10, b.quantity_current));
                                  }}
                                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium shadow-2xs"
                                >
                                  Pick
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setQrModalBatch(b)}
                                className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                title={`QR Code Studio for Lot ${b.batch_number}`}
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setQrModalBatch(b)}
                                className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors"
                                title={`Download PDF Labels for Lot ${b.batch_number}`}
                              >
                                <FileDown className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setAdjustBatch(b)}
                                className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                                title="Adjust Stock / Audit"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const res = toggleHoldBatch(
                                    b.batch_id,
                                    b.status === 'quarantine' ? 'Released from hold' : 'Placed on hold from inventory grid'
                                  );
                                  if (res.success) {
                                    setStatusMessage(
                                      b.status === 'quarantine'
                                        ? `Lot ${b.batch_number} released to active stock.`
                                        : `Lot ${b.batch_number} placed on QA Quarantine Hold.`
                                    );
                                    setTimeout(() => setStatusMessage(''), 3000);
                                  }
                                }}
                                className={`p-1 rounded transition-colors ${
                                  b.status === 'quarantine'
                                    ? 'text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100'
                                    : 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                                }`}
                                title={b.status === 'quarantine' ? 'Release / Undo QA Hold' : 'Place on QA Quarantine Hold'}
                              >
                                {b.status === 'quarantine' ? (
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => setWriteOffTargetBatch(b)}
                                className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors"
                                title="Material Write-Off & Scrap"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
          TAB 2: SKU MASTER CATALOG
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sku_master' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Product Catalog, Reorder Thresholds & Unit Costs
            </span>
            <button
              onClick={() => {
                setEditingSku(null);
                setSkuCode(`PR00${products.length + 1}`);
                setSkuName('');
                setShowAddSkuModal(true);
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Product SKU</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left font-mono-code text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">SKU Code</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Storage Type</th>
                  <th className="py-2.5 px-3 text-right">Current On-Hand</th>
                  <th className="py-2.5 px-3 text-right">Reorder Level</th>
                  <th className="py-2.5 px-3 text-right">Unit Cost (₹)</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {products.map((p) => {
                  const pBatches = batches.filter((b) => b.product_id === p.product_id && b.status === 'active');
                  const onHand = pBatches.reduce((sum, b) => sum + b.quantity_current, 0);
                  const isLow = onHand <= p.reorder_level;

                  return (
                    <tr key={p.product_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{p.product_code}</td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">{p.product_name}</td>
                      <td className="py-2.5 px-3 text-slate-600 font-sans">{p.category}</td>
                      <td className="py-2.5 px-3 capitalize text-slate-600 font-sans">{p.storage_requirements}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {onHand} {p.unit_of_measure}
                        {isLow && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-800">
                            LOW
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{p.reorder_level} {p.unit_of_measure}</td>
                      <td className="py-2.5 px-3 text-right text-slate-800 font-bold">{formatINR(p.unit_cost)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSku(p);
                              setSkuCode(p.product_code);
                              setSkuName(p.product_name);
                              setSkuCategory(p.category);
                              setSkuShelfLifeDays(p.default_shelf_life_days);
                              setSkuUom(p.unit_of_measure);
                              setSkuReorderLevel(p.reorder_level);
                              setSkuStorage(p.storage_requirements);
                              setSkuUnitCost(p.unit_cost);
                              setSkuSellingPrice(p.selling_price);
                              setShowAddSkuModal(true);
                            }}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                            title="Edit SKU"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmSku(p)}
                            className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded"
                            title="Delete SKU"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 3: WAREHOUSE BINS & LOCATIONS
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'bin_locations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Warehouse Rack, Shelf, and Custom Bins Layout
            </span>
            <button
              onClick={() => {
                setEditingLocation(null);
                setLocCode(`A-${Math.floor(10 + Math.random() * 90)}-1-01`);
                setShowAddLocationModal(true);
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Location Bin</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {locations.map((loc) => {
              const cap = loc.capacity_units || 100;
              const occPct = cap > 0 ? Math.round((loc.current_occupancy / cap) * 100) : 0;
              const locBatches = batches.filter((b) => b.location_code === loc.location_code && b.quantity_current > 0);

              return (
                <div key={loc.location_id} className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-800 font-mono-code">
                        {loc.section}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 font-mono-code">{loc.location_code}</h4>
                        <span className="text-[10px] text-slate-400 capitalize">{loc.storage_type} storage</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          setEditingLocation(loc);
                          setLocCode(loc.location_code);
                          setLocSection(loc.section);
                          setLocAisle(loc.aisle);
                          setLocStorageType(loc.storage_type);
                          setLocMaxCapacity(loc.capacity_units || 100);
                          setShowAddLocationModal(true);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700"
                        title="Edit Location"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmLocation(loc)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                        title="Delete Location"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Capacity Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-600 font-mono-code">
                      <span>Occupancy:</span>
                      <span className="font-bold">{loc.current_occupancy} / {cap} units ({occPct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          occPct > 90 ? 'bg-rose-500' : occPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, occPct)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Stored Lots Preview */}
                  <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    {locBatches.length === 0 ? (
                      <span className="text-slate-400 italic">Bin is currently empty</span>
                    ) : (
                      <div className="space-y-1">
                        {locBatches.map((b) => (
                          <div key={b.batch_id} className="flex justify-between font-mono-code">
                            <span className="truncate max-w-[160px] text-slate-800">{b.product_name}</span>
                            <span className="font-bold text-slate-900">{b.quantity_current}u</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODALS
          ═══════════════════════════════════════════════════════════════════ */}

      {/* Relocate Modal */}
      {relocateTargetBatch && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Relocate Batch Lot</h3>
              <button onClick={() => setRelocateTargetBatch(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-600">
              Moving Lot <strong>{relocateTargetBatch.batch_number}</strong> ({relocateTargetBatch.product_name}).
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Target Bin Location *</label>
              <input
                type="text"
                value={customRelocateBin}
                onChange={(e) => setCustomRelocateBin(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-mono-code font-bold uppercase focus:outline-none"
                placeholder="e.g. A-14-1-01"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setRelocateTargetBatch(null)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRelocate}
                className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800"
              >
                Update Bin Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Pick Modal */}
      {quickPickBatch && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <form onSubmit={handleExecuteQuickPick} className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Direct FIFO Outbound Pick</h3>
              <button type="button" onClick={() => setQuickPickBatch(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 font-mono-code text-[11px]">
              <div>Product: <strong>{quickPickBatch.product_name}</strong></div>
              <div>Lot: <strong>{quickPickBatch.batch_number}</strong> ({quickPickBatch.location_code})</div>
              <div>Available: <strong>{quickPickBatch.quantity_current} {quickPickBatch.unit_of_measure}</strong></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pick Quantity *</label>
                <input
                  type="number"
                  min={1}
                  max={quickPickBatch.quantity_current}
                  value={quickPickQty}
                  onChange={(e) => setQuickPickQty(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer / Consignee</label>
                <input
                  type="text"
                  value={quickPickCustomer}
                  onChange={(e) => setQuickPickCustomer(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setQuickPickBatch(null)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-2xs"
              >
                Confirm Dispatch
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Batch Modal */}
      {deleteConfirmBatch && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white border border-rose-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl text-xs">
            <div className="flex items-center space-x-2 text-rose-600 pb-2 border-b border-rose-100">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 text-sm">Delete Inventory Batch Lot</h3>
            </div>
            <p className="text-slate-600">
              Are you sure you want to permanently delete Lot <strong>{deleteConfirmBatch.batch_number}</strong> of <strong>{deleteConfirmBatch.product_name}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeleteConfirmBatch(null)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteBatch}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-2xs"
              >
                Permanently Delete Lot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete SKU Modal */}
      {deleteConfirmSku && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white border border-rose-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl text-xs">
            <div className="flex items-center space-x-2 text-rose-600 pb-2 border-b border-rose-100">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 text-sm">Delete Product SKU</h3>
            </div>
            <p className="text-slate-600">
              Are you sure you want to delete Product SKU <strong>[{deleteConfirmSku.product_code}] {deleteConfirmSku.product_name}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeleteConfirmSku(null)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteSku}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-2xs"
              >
                Delete SKU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Location Modal */}
      {deleteConfirmLocation && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white border border-rose-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl text-xs">
            <div className="flex items-center space-x-2 text-rose-600 pb-2 border-b border-rose-100">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 text-sm">Delete Storage Bin</h3>
            </div>
            <p className="text-slate-600">
              Are you sure you want to delete Bin Location <strong>{deleteConfirmLocation.location_code}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeleteConfirmLocation(null)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteLocation}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-2xs"
              >
                Delete Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit SKU Modal */}
      {showAddSkuModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <form onSubmit={handleSaveSku} className="bg-white border border-slate-200 rounded-2xl p-5 max-w-lg w-full space-y-4 shadow-xl text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">{editingSku ? 'Edit Product SKU' : 'Create Product SKU'}</h3>
              <button type="button" onClick={() => setShowAddSkuModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">SKU Code *</label>
                <input
                  type="text"
                  required
                  value={skuCode}
                  onChange={(e) => setSkuCode(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-mono-code font-bold uppercase focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                <input
                  type="text"
                  required
                  value={skuCategory}
                  onChange={(e) => setSkuCategory(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Product Description *</label>
              <input
                type="text"
                required
                value={skuName}
                onChange={(e) => setSkuName(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Shelf Life (Days)</label>
                <input
                  type="number"
                  min={1}
                  value={skuShelfLifeDays}
                  onChange={(e) => setSkuShelfLifeDays(parseInt(e.target.value) || 180)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">UOM</label>
                <input
                  type="text"
                  value={skuUom}
                  onChange={(e) => setSkuUom(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reorder Level</label>
                <input
                  type="number"
                  min={0}
                  value={skuReorderLevel}
                  onChange={(e) => setSkuReorderLevel(parseInt(e.target.value) || 20)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Storage Type</label>
                <select
                  value={skuStorage}
                  onChange={(e) => setSkuStorage(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                >
                  <option value="ambient">Ambient</option>
                  <option value="refrigerated">Refrigerated</option>
                  <option value="frozen">Frozen</option>
                  <option value="hazardous">Hazardous</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Unit Cost (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={skuUnitCost}
                  onChange={(e) => setSkuUnitCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Selling Price (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={skuSellingPrice}
                  onChange={(e) => setSkuSellingPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddSkuModal(false)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 shadow-2xs"
              >
                Save Product SKU
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add / Edit Location Modal */}
      {showAddLocationModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <form onSubmit={handleSaveLocation} className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">{editingLocation ? 'Edit Bin Location' : 'Add Custom Bin Location'}</h3>
              <button type="button" onClick={() => setShowAddLocationModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Bin Location Code *</label>
              <input
                type="text"
                required
                value={locCode}
                onChange={(e) => setLocCode(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-mono-code font-bold uppercase focus:outline-none"
                placeholder="e.g. A-14-1-01"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Section</label>
                <input
                  type="text"
                  value={locSection}
                  onChange={(e) => setLocSection(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Aisle</label>
                <input
                  type="text"
                  value={locAisle}
                  onChange={(e) => setLocAisle(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Storage Type</label>
                <select
                  value={locStorageType}
                  onChange={(e) => setLocStorageType(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                >
                  <option value="ambient">Ambient</option>
                  <option value="refrigerated">Refrigerated</option>
                  <option value="frozen">Frozen</option>
                  <option value="hazardous">Hazardous</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Max Capacity (Units)</label>
                <input
                  type="number"
                  min={1}
                  value={locMaxCapacity}
                  onChange={(e) => setLocMaxCapacity(parseInt(e.target.value) || 100)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddLocationModal(false)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 shadow-2xs"
              >
                Save Location
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustBatch && (
        <StockAdjustmentModal batch={adjustBatch} onClose={() => setAdjustBatch(null)} />
      )}

      {/* Batch QR Code Label Modal */}
      {qrModalBatch && (
        <BatchQRModal batch={qrModalBatch} onClose={() => setQrModalBatch(null)} />
      )}
    </div>
  );
};
