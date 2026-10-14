import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowDownToLine,
  QrCode,
  Printer,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Package,
  Calendar,
  Layers,
  MapPin,
  Building,
  ShieldCheck,
  Truck,
  FileText,
  Plus,
  Trash2,
  Edit2,
  X,
  IndianRupee,
  Check,
  Info,
  ChevronRight,
  Eye,
  Search,
  AlertTriangle,
  RotateCcw,
  Tag,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { formatBarcodeString, generateBatchNumber } from '../utils/barcode';
import { calculateShelfLifeStatus, formatDate } from '../utils/shelfLife';
import { formatINR } from '../utils/currency';
import { StorageType, Product, InventoryBatch, Supplier, Location } from '../types/inventory';
import { soundFx } from '../utils/sound';
import confetti from 'canvas-confetti';

export interface ReceiptLineItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  category: string;
  batchNumber: string;
  quantityReceived: number;
  unitOfMeasure: string;
  unitCost: number;
  storageType: StorageType;
  mfgDate: string;
  expiryDate: string;
  locationCode: string;
  qcPassed: boolean;
  qcNotes: string;
}

export const GoodsReceiptModal: React.FC = () => {
  const {
    products,
    suppliers,
    locations,
    batches,
    prefilledReceiptProduct,
    prefilledReorderQty,
    setPrefilledReceiptProduct,
    receiveGoods,
    addProduct,
    updateProduct,
    deleteProduct,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addLocation,
    deleteLocation,
    deleteBatch,
    setActiveTab,
  } = useInventory();

  // Primary Station View: 'fulfillment_entry' | 'sku_catalog' | 'supplier_catalog' | 'recent_intakes'
  const [stationTab, setStationTab] = useState<'fulfillment_entry' | 'sku_catalog' | 'supplier_catalog' | 'recent_intakes'>('fulfillment_entry');

  // Supplier & Delivery Note Header Details
  const [supplierId, setSupplierId] = useState<string>('');
  const [deliveryNote, setDeliveryNote] = useState<string>('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState<string>('');
  const [carrierName, setCarrierName] = useState<string>('BlueDart Supply Chain');
  const [vehicleNo, setVehicleNo] = useState<string>('MH-04-DE-8821');

  // Multi-Item Line Fulfillment Queue (Drafts)
  const [lineItems, setLineItems] = useState<ReceiptLineItem[]>([]);

  // Active Line Item Form State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [quantityReceived, setQuantityReceived] = useState<number>(100);
  const [unitOfMeasure, setUnitOfMeasure] = useState<string>('units');
  const [unitCost, setUnitCost] = useState<number>(500.0);
  const [storageType, setStorageType] = useState<StorageType>('ambient');
  const [mfgDate, setMfgDate] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [locationCode, setLocationCode] = useState<string>('');
  const [qcPassed, setQcPassed] = useState<boolean>(true);
  const [qcNotes, setQcNotes] = useState<string>('Standard quality inspection passed. Seal intact.');

  // Modals & Feedback
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState<boolean>(false);
  const [showAddLocationModal, setShowAddLocationModal] = useState<boolean>(false);
  const [newlyReceivedBatches, setNewlyReceivedBatches] = useState<InventoryBatch[]>([]);

  // Initial setup
  useEffect(() => {
    if (suppliers.length > 0 && !supplierId) {
      setSupplierId(suppliers[0].supplier_id);
    }
    if (products.length > 0 && !selectedProductId) {
      handleProductChange(products[0].product_id);
    }
    if (locations.length > 0 && !locationCode) {
      setLocationCode(locations[0].location_code);
    }
    if (!deliveryNote) {
      setDeliveryNote(`PO-IND-${Math.floor(10000 + Math.random() * 90000)}`);
    }
    if (!supplierInvoiceNo) {
      setSupplierInvoiceNo(`INV-${Date.now().toString().slice(-6)}`);
    }
  }, [suppliers, products, locations]);

  // Handle prefilled reorder from dashboard
  useEffect(() => {
    if (prefilledReceiptProduct) {
      handleProductChange(prefilledReceiptProduct.product_id);
      if (prefilledReorderQty) {
        setQuantityReceived(prefilledReorderQty);
      }
      setPrefilledReceiptProduct(null);
    }
  }, [prefilledReceiptProduct]);

  // Handle Product Change
  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.product_id === prodId);
    if (!prod) return;

    setUnitOfMeasure(prod.unit_of_measure);
    setUnitCost(prod.unit_cost);
    setStorageType(prod.storage_requirements);
    setBatchNumber(generateBatchNumber(prod.product_code));

    // Auto-calculate dates
    const today = new Date();
    setMfgDate(today.toISOString().split('T')[0]);

    const exp = new Date(today);
    exp.setDate(exp.getDate() + (prod.default_shelf_life_days || 180));
    setExpiryDate(exp.toISOString().split('T')[0]);

    // Recommend bin
    const matchingLoc = locations.find((l) => l.storage_type === prod.storage_requirements && l.current_occupancy < (l.capacity_units || 9999));
    if (matchingLoc) {
      setLocationCode(matchingLoc.location_code);
    } else if (locations.length > 0) {
      setLocationCode(locations[0].location_code);
    }
  };

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.product_id === selectedProductId) || products[0] || null;
  }, [products, selectedProductId]);

  const selectedSupplier = useMemo(() => {
    return suppliers.find((s) => s.supplier_id === supplierId) || suppliers[0] || null;
  }, [suppliers, supplierId]);

  // Shelf life status of current draft
  const previewShelfLife = useMemo(() => {
    if (!expiryDate) return null;
    return calculateShelfLifeStatus(expiryDate, mfgDate);
  }, [expiryDate, mfgDate]);

  // Add line item to draft queue
  const handleAddLineItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (quantityReceived <= 0) {
      setErrorMessage('Quantity must be greater than 0.');
      return;
    }
    if (!batchNumber.trim()) {
      setErrorMessage('Batch number is required.');
      return;
    }

    const newItem: ReceiptLineItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      productId: selectedProduct.product_id,
      productCode: selectedProduct.product_code,
      productName: selectedProduct.product_name,
      category: selectedProduct.category,
      batchNumber: batchNumber.trim().toUpperCase(),
      quantityReceived,
      unitOfMeasure,
      unitCost,
      storageType,
      mfgDate,
      expiryDate,
      locationCode: locationCode.trim().toUpperCase(),
      qcPassed,
      qcNotes,
    };

    setLineItems([...lineItems, newItem]);
    soundFx.playBarcodeBeep();

    // Reset for next item
    setBatchNumber(generateBatchNumber(selectedProduct.product_code));
    setErrorMessage('');
  };

  // Remove line item
  const handleRemoveLineItem = (id: string) => {
    setLineItems(lineItems.filter((i) => i.id !== id));
  };

  // Commit all line items to inventory
  const handleFinalizeReceipt = () => {
    if (lineItems.length === 0) {
      setErrorMessage('Please add at least one line item before finalizing intake.');
      return;
    }

    const receivedResults: InventoryBatch[] = [];

    lineItems.forEach((item) => {
      const res = receiveGoods({
        product_id: item.productId,
        product_code: item.productCode,
        product_name: item.productName,
        category: item.category,
        batch_number: item.batchNumber,
        quantity_received: item.quantityReceived,
        quantity_current: item.quantityReceived,
        unit_of_measure: item.unitOfMeasure,
        unit_cost: item.unitCost,
        storage_type: item.storageType,
        manufacturing_date: item.mfgDate,
        expiry_date: item.expiryDate,
        received_date: new Date().toISOString().split('T')[0],
        supplier_id: selectedSupplier?.supplier_id || 'sup-001',
        supplier_name: selectedSupplier?.supplier_name || 'Generic Supplier',
        location_code: item.locationCode,
        reference_document: deliveryNote || `PO-${Date.now()}`,
        qc_passed: item.qcPassed,
        qc_notes: item.qcNotes,
        notes: item.qcNotes,
      });

      if (res.success && res.batch) {
        receivedResults.push(res.batch);
      }
    });

    setNewlyReceivedBatches(receivedResults);
    setLineItems([]);
    setStatusMessage(`Successfully received ${receivedResults.length} lots into warehouse inventory.`);
    soundFx.playSuccessChime();
    try {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    } catch (e) {}

    setTimeout(() => setStatusMessage(''), 5000);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans text-xs">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-2xs">
              <ArrowDownToLine className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <span>Inbound PO Receiving & Goods Intake Station</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono-code bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                  QC Automated
                </span>
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Supplier consignment verification, barcode lot generation, shelf-life verification, and custom rack bin allocation.
          </p>
        </div>

        {/* Station Tabs */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0">
          <button
            type="button"
            onClick={() => setStationTab('fulfillment_entry')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              stationTab === 'fulfillment_entry'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Goods Inward Form</span>
          </button>
          <button
            type="button"
            onClick={() => setStationTab('recent_intakes')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              stationTab === 'recent_intakes'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Recent Inbounds ({batches.length})</span>
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-semibold">{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage('')} className="text-emerald-400 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: GOODS INWARD FORM
          ═══════════════════════════════════════════════════════════════════ */}
      {stationTab === 'fulfillment_entry' && (
        <div className="space-y-4">
          {/* Header Shipment Parameters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-slate-500" />
              <span>Inbound Consignment & Supplier Header</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Supplier Vendor</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 font-medium focus:outline-none"
                >
                  {suppliers.map((s) => (
                    <option key={s.supplier_id} value={s.supplier_id}>
                      {s.supplier_name} ({s.supplier_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">PO / Delivery Note Ref</label>
                <input
                  type="text"
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono-code focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Carrier Transporter</label>
                <input
                  type="text"
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Vehicle No.</label>
                <input
                  type="text"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono-code focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Form + Queue Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: Line Item Builder Form */}
            <form onSubmit={handleAddLineItem} className="lg:col-span-7 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-slate-500" />
                  <span>Item & Lot Details</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Specify SKU, bin location, manufacturing & expiry dates, and unit cost.
                </p>
              </div>

              {/* Product SKU */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Product SKU *</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 font-semibold focus:outline-none"
                >
                  {products.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.product_code} — {p.product_name} ({p.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Lot Number & Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-700">Batch / Lot Number *</label>
                    <button
                      type="button"
                      onClick={() => setBatchNumber(generateBatchNumber(selectedProduct?.product_code || 'PR'))}
                      className="text-[10px] text-slate-500 hover:text-slate-800 font-mono-code"
                    >
                      Regenerate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono-code font-bold uppercase focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Received Quantity ({unitOfMeasure}) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quantityReceived}
                    onChange={(e) => setQuantityReceived(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 font-bold focus:outline-none"
                  />
                </div>
              </div>

              {/* Dates & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Mfg Date *</label>
                  <input
                    type="date"
                    required
                    value={mfgDate}
                    onChange={(e) => setMfgDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Target Bin *</label>
                  <input
                    type="text"
                    required
                    value={locationCode}
                    onChange={(e) => setLocationCode(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono-code font-bold uppercase focus:outline-none"
                    placeholder="e.g. A-14-1-01"
                  />
                </div>
              </div>

              {/* Unit Cost & QC Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Unit Inward Cost (₹) *</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    required
                    value={unitCost}
                    onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">QC Inspection Status</label>
                  <select
                    value={qcPassed ? 'PASSED' : 'HOLD'}
                    onChange={(e) => setQcPassed(e.target.value === 'PASSED')}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 font-medium focus:outline-none"
                  >
                    <option value="PASSED">Passed Inspection (Active)</option>
                    <option value="HOLD">Hold in Quarantine</option>
                  </select>
                </div>
              </div>

              {/* Add Item Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs shadow-2xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Line Item to Inward Queue</span>
                </button>
              </div>
            </form>

            {/* Right: Draft Fulfillment Queue */}
            <div className="lg:col-span-5 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span>Staged Inward Queue ({lineItems.length})</span>
                </h3>
              </div>

              {lineItems.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 font-sans">
                  No items staged. Fill out the form on the left to add items to this receiving manifest.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {lineItems.map((item) => (
                    <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-bold text-slate-900">{item.productName}</span>
                          <span className="text-[11px] text-slate-400 font-mono-code block">Lot: {item.batchNumber} · Bin: {item.locationCode}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(item.id)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 font-mono-code text-[11px]">
                        <span className="text-slate-600">Qty: <strong>{item.quantityReceived} {item.unitOfMeasure}</strong></span>
                        <span className="text-emerald-700 font-bold">{formatINR(item.quantityReceived * item.unitCost)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Finalize Button */}
              {lineItems.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleFinalizeReceipt}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Commit & Finalize Inward Intake ({lineItems.length} Lots)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: RECENT INBOUNDS
          ═══════════════════════════════════════════════════════════════════ */}
      {stationTab === 'recent_intakes' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-700">Recent Warehouse Inbound Batches</span>
          </div>

          <table className="w-full text-left font-mono-code text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Lot Number</th>
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3">Supplier</th>
                <th className="py-2.5 px-3">Bin Location</th>
                <th className="py-2.5 px-3 text-right">Received Qty</th>
                <th className="py-2.5 px-3">Expiry Date</th>
                <th className="py-2.5 px-3 text-right">Unit Rate (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {batches.slice(0, 15).map((b) => (
                <tr key={b.batch_id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-slate-900">{b.batch_number}</td>
                  <td className="py-2.5 px-3 font-sans font-medium text-slate-800">{b.product_name}</td>
                  <td className="py-2.5 px-3 text-slate-600 font-sans">{b.supplier_name}</td>
                  <td className="py-2.5 px-3 text-slate-700 font-bold">{b.location_code}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">{b.quantity_received} {b.unit_of_measure}</td>
                  <td className="py-2.5 px-3 text-slate-600">{formatDate(b.expiry_date)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-800">{formatINR(b.unit_cost || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
