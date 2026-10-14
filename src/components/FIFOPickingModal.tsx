import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowUpFromLine,
  Scan,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  FileText,
  Printer,
  RotateCcw,
  IndianRupee,
  Search,
  BookOpen,
  Info,
  MapPin,
  Clock,
  ChevronRight,
  Truck,
  Building2,
  Calendar,
  Check,
  X,
  RefreshCw,
  QrCode,
  Tag,
  Lock,
  UserCheck,
  CheckSquare,
  Square,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { calculateShelfLifeStatus, formatDate, formatDateTime } from '../utils/shelfLife';
import { formatINR } from '../utils/currency';
import { InventoryBatch, Product, Transaction } from '../types/inventory';
import confetti from 'canvas-confetti';
import { soundFx } from '../utils/sound';

export type DispatchPurpose = 'CUSTOMER_DISPATCH' | 'BRANCH_TRANSFER' | 'QC_SAMPLE' | 'RTV_RETURN' | 'SCRAP_DISPOSAL';

interface ChallanData {
  challanNumber: string;
  orderRef: string;
  purpose: DispatchPurpose;
  customer: string;
  transporter: string;
  vehicleNo: string;
  waybillNo: string;
  driverPhone: string;
  date: string;
  productCode: string;
  productName: string;
  batchNumber: string;
  locationCode: string;
  expiryDate: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalINR: number;
  fifoCompliant: boolean;
  notes?: string;
  pickedBy: string;
}

export const FIFOPickingModal: React.FC = () => {
  const {
    products,
    batches,
    transactions,
    users,
    currentUser,
    settings,
    getBatchesForProductFIFO,
    validateFIFOPick,
    pickGoods,
    reverseTransaction,
    quarantineBatch,
    toggleHoldBatch,
    deleteBatch,
    setWriteOffTargetBatch,
    selectedBatchForDetail,
    setSelectedBatchForDetail,
    setActiveTab,
  } = useInventory();

  // Active View Tab: 'picking' | 'clearance' | 'history' | 'guide'
  const [currentTab, setCurrentTab] = useState<'picking' | 'clearance' | 'history' | 'guide'>('picking');
  const [clearanceFilter, setClearanceFilter] = useState<'ALL' | 'CRITICAL' | 'EXPIRED' | 'QUARANTINE'>('ALL');
  const [clearanceSearch, setClearanceSearch] = useState<string>('');

  // Single-stream FIFO picking state
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [verificationBarcode, setVerificationBarcode] = useState<string>('');
  const [isBarcodeVerified, setIsBarcodeVerified] = useState<boolean>(false);
  const [pickQuantity, setPickQuantity] = useState<number>(1);
  const [dispatchPurpose, setDispatchPurpose] = useState<DispatchPurpose>('CUSTOMER_DISPATCH');
  const [salesOrderRef, setSalesOrderRef] = useState<string>('');
  const [customerDestination, setCustomerDestination] = useState<string>('Apollo Health Distribution Hub');
  const [transporterName, setTransporterName] = useState<string>('BlueDart Express Cargo');
  const [vehicleNumber, setVehicleNumber] = useState<string>('MH-04-AX-8912');
  const [waybillNumber, setWaybillNumber] = useState<string>('WB-IND-881902');
  const [driverPhone, setDriverPhone] = useState<string>('+91 98200 87654');
  const [pickNotes, setPickNotes] = useState<string>('');

  // QC Verification Checkpoints
  const [qcBoxSealed, setQcBoxSealed] = useState<boolean>(true);
  const [qcLabelChecked, setQcLabelChecked] = useState<boolean>(true);
  const [qcColdPackAdded, setQcColdPackAdded] = useState<boolean>(true);
  const [qcInvoiceEnclosed, setQcInvoiceEnclosed] = useState<boolean>(true);

  // Supervisor Override State
  const eligibleSupervisors = useMemo(() => {
    return users.filter((u) => u.is_active && (u.can_override_fifo || u.role === 'manager' || u.role === 'supervisor'));
  }, [users]);

  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('Customer contractually mandated latest production batch');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>(
    currentUser.can_override_fifo || currentUser.role === 'manager' || currentUser.role === 'supervisor'
      ? currentUser.user_id
      : eligibleSupervisors[0]?.user_id || currentUser.user_id
  );
  const [customReasonText, setCustomReasonText] = useState<string>('');
  const [overrideModalError, setOverrideModalError] = useState<string>('');

  // Reversal State
  const [reversalSupervisorId, setReversalSupervisorId] = useState<string>(currentUser.user_id);
  const [reversalModalError, setReversalModalError] = useState<string>('');

  // Status & Feedback
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [challanData, setChallanData] = useState<ChallanData | null>(null);

  // History Filter State
  const [historySearch, setHistorySearch] = useState<string>('');
  const [reversalTargetTx, setReversalTargetTx] = useState<Transaction | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('Customer order cancelled prior to truck departure');
  const [reversalSuccessMsg, setReversalSuccessMsg] = useState<string>('');

  // Pickable Products (Only SKUs with active, non-quarantined stock > 0)
  const pickableProducts = useMemo(() => {
    return products.filter((p) => {
      const activeQty = batches
        .filter((b) => b.product_id === p.product_id && b.status === 'active' && b.quantity_current > 0)
        .reduce((sum, b) => sum + b.quantity_current, 0);
      return activeQty > 0;
    });
  }, [products, batches]);

  // Sync with global preselection if navigating from dashboard/inventory
  useEffect(() => {
    if (selectedBatchForDetail && selectedBatchForDetail.status === 'active' && selectedBatchForDetail.quantity_current > 0) {
      setSelectedProductId(selectedBatchForDetail.product_id);
      setSelectedBatchId(selectedBatchForDetail.batch_id);
      setPickQuantity(1);
    } else if (pickableProducts.length > 0) {
      if (!selectedProductId || !pickableProducts.some((p) => p.product_id === selectedProductId)) {
        setSelectedProductId(pickableProducts[0].product_id);
      }
    } else {
      setSelectedProductId('');
    }
  }, [selectedBatchForDetail, pickableProducts, selectedProductId]);

  // Selected Product & its FIFO Batches pipeline
  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return pickableProducts[0] || null;
    return pickableProducts.find((p) => p.product_id === selectedProductId) || pickableProducts[0] || null;
  }, [pickableProducts, selectedProductId]);

  const activeFifoBatches = useMemo(() => {
    if (!selectedProduct) return [];
    return getBatchesForProductFIFO(selectedProduct.product_id);
  }, [selectedProduct, getBatchesForProductFIFO]);

  // Recommended oldest batch
  const recommendedBatch = useMemo(() => {
    return activeFifoBatches.length > 0 ? activeFifoBatches[0] : null;
  }, [activeFifoBatches]);

  // Currently selected batch
  const selectedBatch = useMemo(() => {
    if (!selectedBatchId && recommendedBatch) {
      return recommendedBatch;
    }
    return batches.find((b) => b.batch_id === selectedBatchId) || recommendedBatch || null;
  }, [batches, selectedBatchId, recommendedBatch]);

  // Reset selected batch when product changes
  useEffect(() => {
    if (recommendedBatch && (!selectedBatchId || !activeFifoBatches.some((b) => b.batch_id === selectedBatchId))) {
      setSelectedBatchId(recommendedBatch.batch_id);
      setIsBarcodeVerified(false);
      setVerificationBarcode('');
    }
  }, [recommendedBatch, selectedBatchId, activeFifoBatches]);

  // Compliance check
  const complianceCheck = useMemo(() => {
    if (!selectedProduct || !selectedBatch) {
      return { isCompliant: true, recommendedBatch: null };
    }
    return validateFIFOPick(selectedProduct.product_id, selectedBatch.batch_id);
  }, [selectedProduct, selectedBatch, validateFIFOPick]);

  // Barcode verification handler
  const handleVerifyBarcode = (inputCode: string) => {
    setVerificationBarcode(inputCode);
    if (!selectedBatch) return;

    const trimmed = inputCode.trim();
    if (
      trimmed === selectedBatch.barcode ||
      trimmed === selectedBatch.batch_number ||
      trimmed === selectedBatch.batch_id
    ) {
      setIsBarcodeVerified(true);
      soundFx.playBarcodeBeep();
    } else {
      setIsBarcodeVerified(false);
    }
  };

  // Execution
  const handleExecutePick = (e?: React.FormEvent, isOverrideAuth: boolean = false) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!selectedBatch) {
      setErrorMessage('Please select an active lot.');
      return;
    }

    if (pickQuantity <= 0 || pickQuantity > selectedBatch.quantity_current) {
      setErrorMessage(`Quantity must be between 1 and ${selectedBatch.quantity_current}.`);
      return;
    }

    // Check FIFO compliance
    if (!complianceCheck.isCompliant && !isOverrideAuth) {
      setShowOverrideModal(true);
      return;
    }

    const effectiveReason = customReasonText.trim() ? `${overrideReason}: ${customReasonText}` : overrideReason;
    const supervisor = users.find((u) => u.user_id === selectedSupervisorId);
    const supervisorName = isOverrideAuth ? supervisor?.full_name || currentUser.full_name : undefined;

    const result = pickGoods({
      batchId: selectedBatch.batch_id,
      quantity: pickQuantity,
      purpose: dispatchPurpose,
      salesOrderRef: salesOrderRef || `SO-${Date.now().toString().slice(-6)}`,
      customerDestination,
      transporterName,
      vehicleNumber,
      waybillNumber,
      driverPhone,
      notes: pickNotes,
      overrideReason: isOverrideAuth ? effectiveReason : undefined,
      supervisorOverrideBy: supervisorName,
    });

    if (result.success) {
      soundFx.playSuccessChime();
      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      } catch (err) {}

      const totalValue = pickQuantity * (selectedBatch.unit_cost || selectedProduct?.unit_cost || 0);
      const newChallan: ChallanData = {
        challanNumber: `DC-FIFO-${Date.now().toString().slice(-6)}`,
        orderRef: salesOrderRef || `SO-${Date.now().toString().slice(-6)}`,
        purpose: dispatchPurpose,
        customer: customerDestination,
        transporter: transporterName,
        vehicleNo: vehicleNumber,
        waybillNo: waybillNumber,
        driverPhone: driverPhone,
        date: new Date().toISOString(),
        productCode: selectedBatch.product_code,
        productName: selectedBatch.product_name,
        batchNumber: selectedBatch.batch_number,
        locationCode: selectedBatch.location_code,
        expiryDate: selectedBatch.expiry_date,
        quantity: pickQuantity,
        unit: selectedBatch.unit_of_measure,
        unitCost: selectedBatch.unit_cost || selectedProduct?.unit_cost || 0,
        totalINR: totalValue,
        fifoCompliant: complianceCheck.isCompliant,
        notes: pickNotes,
        pickedBy: currentUser.full_name,
      };

      setChallanData(newChallan);
      setSuccessMessage(`Successfully dispatched ${pickQuantity} ${selectedBatch.unit_of_measure} of Lot ${selectedBatch.batch_number}.`);
      setShowOverrideModal(false);
      setOverrideModalError('');
      setCustomReasonText('');
      setPickQuantity(1);
      setIsBarcodeVerified(false);
      setVerificationBarcode('');
      setSalesOrderRef(`SO-IND-${Math.floor(100000 + Math.random() * 900000)}`);
    } else {
      setErrorMessage(result.error || 'Failed to execute FIFO dispatch.');
    }
  };

  // Reversal Execution
  const handleConfirmReversal = () => {
    if (!reversalTargetTx) return;
    setReversalModalError('');

    const supervisor = users.find((u) => u.user_id === reversalSupervisorId);
    const authorizedName = supervisor?.full_name || currentUser.full_name;
    const fullReversalReason = `${reversalReason} · Authorized by ${authorizedName}`;

    const res = reverseTransaction(reversalTargetTx.transaction_id, fullReversalReason);
    if (res.success) {
      setReversalSuccessMsg(res.message || 'Dispatched stock successfully restored.');
      setReversalTargetTx(null);
      setReversalModalError('');
      setTimeout(() => setReversalSuccessMsg(''), 4000);
      soundFx.playSuccessChime();
    } else {
      setErrorMessage(res.message || 'Reversal failed.');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans text-xs">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-2xs">
              <ArrowUpFromLine className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <span>FIFO Outbound Picking & Dispatch Station</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono-code bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                  FEFO / FIFO Active
                </span>
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Strict oldest-expiry stock allocation, live barcode scanning, supervisor authorization, and instant GST Delivery Challan in INR (₹).
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0">
          <button
            type="button"
            onClick={() => setCurrentTab('picking')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === 'picking'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpFromLine className="w-3.5 h-3.5" />
            <span>Outbound Pick Station</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('clearance')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === 'clearance'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Clearance & Hold Queue</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('history')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === 'history'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Dispatch Ledger</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('guide')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === 'guide'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>FIFO Floor SOP</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
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

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-400 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {reversalSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center space-x-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span className="font-semibold">{reversalSuccessMsg}</span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: OUTBOUND PICK STATION
          ═══════════════════════════════════════════════════════════════════ */}
      {currentTab === 'picking' && (
        <div className="space-y-4">
          {/* Step 1: Product Selector */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-slate-500" />
                <span>1. Select Product SKU for Outbound Picking</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono-code">
                {pickableProducts.length} items with active stock
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {pickableProducts.map((p) => {
                const isSelected = selectedProductId === p.product_id;
                const pBatches = batches.filter((b) => b.product_id === p.product_id && b.status === 'active' && b.quantity_current > 0);
                const totalStock = pBatches.reduce((sum, b) => sum + b.quantity_current, 0);

                return (
                  <button
                    key={p.product_id}
                    type="button"
                    onClick={() => {
                      setSelectedProductId(p.product_id);
                      setSelectedBatchId('');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className={`text-[10px] font-mono-code font-bold ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                      {p.product_code}
                    </div>
                    <div className="font-semibold text-xs truncate mt-0.5">{p.product_name}</div>
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/30 text-[11px] font-mono-code">
                      <span className={isSelected ? 'text-slate-300' : 'text-slate-500'}>{pBatches.length} lots</span>
                      <span className={`font-bold ${isSelected ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        {totalStock} {p.unit_of_measure}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2 & 3: FIFO Lot Pipeline & Dispatch Form */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Column: FIFO Sequence */}
            <div className="lg:col-span-7 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>2. FIFO Rotational Batch Sequence (Oldest Expiry First)</span>
                </h3>
              </div>

              {activeFifoBatches.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 font-sans">
                  No active lots available for the selected product.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeFifoBatches.map((b, idx) => {
                    const shelfLife = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
                    const isOldest = idx === 0;
                    const isSelected = selectedBatch?.batch_id === b.batch_id;
                    const totalLotValue = b.quantity_current * (b.unit_cost || selectedProduct?.unit_cost || 0);

                    return (
                      <div
                        key={b.batch_id}
                        onClick={() => setSelectedBatchId(b.batch_id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? isOldest
                              ? 'bg-emerald-50/50 border-emerald-400 shadow-xs'
                              : 'bg-amber-50/50 border-amber-400 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              {isOldest ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
                                  ★ Priority #1 Pick (FIFO Compliant)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                  #{idx + 1} Later Batch
                                </span>
                              )}
                              <span className="font-mono-code font-bold text-sm text-slate-900">{b.batch_number}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${shelfLife.badgeClass}`}>
                                {shelfLife.daysRemaining}d left ({shelfLife.percentageRemaining}%)
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 font-mono-code">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-600" />
                                Custom Bin: <strong className="text-slate-800">{b.location_code}</strong>
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                Exp: <strong className="text-slate-700">{formatDate(b.expiry_date)}</strong>
                              </span>
                              <span>
                                Supplier: <span className="text-slate-700">{b.supplier_name}</span>
                              </span>
                            </div>
                          </div>

                          <div className="text-right sm:border-l sm:border-slate-100 sm:pl-4">
                            <div className="text-[10px] text-slate-400">Available</div>
                            <div className="font-mono-code font-bold text-sm text-slate-900">
                              {b.quantity_current} <span className="text-xs font-normal text-slate-500">{b.unit_of_measure}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono-code mt-0.5">
                              {formatINR(totalLotValue)}
                            </div>
                          </div>
                        </div>

                        {isSelected && !isOldest && (
                          <div className="mt-2.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Non-FIFO Selection. Oldest batch is <strong>{recommendedBatch?.batch_number}</strong>. Supervisor approval required.</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowOverrideModal(true);
                              }}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold shrink-0 ml-2 shadow-2xs"
                            >
                              Authorize
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Outbound Dispatch Parameters */}
            <div className="lg:col-span-5 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-slate-500" />
                  <span>3. Dispatch & Order Parameters</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Consignee, carrier details, and physical barcode check.
                </p>
              </div>

              {selectedBatch ? (
                <form onSubmit={(e) => handleExecutePick(e, false)} className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Target Dispatch Lot</span>
                      <span className="font-mono-code text-xs font-bold text-slate-900">{selectedBatch.batch_number}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-code">
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 block">Bin Location</span>
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {selectedBatch.location_code}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 block">Expiry Date</span>
                        <span className="font-bold text-slate-800">{formatDate(selectedBatch.expiry_date)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dispatch Purpose */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Dispatch Purpose</label>
                    <select
                      value={dispatchPurpose}
                      onChange={(e) => setDispatchPurpose(e.target.value as DispatchPurpose)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 font-medium focus:outline-none"
                    >
                      <option value="CUSTOMER_DISPATCH">Customer Sales Order Outbound Dispatch</option>
                      <option value="BRANCH_TRANSFER">Inter-Facility / Branch Transfer</option>
                      <option value="QC_SAMPLE">Sample QC / Laboratory Testing</option>
                      <option value="RTV_RETURN">Return to Vendor (RTV Reject)</option>
                      <option value="SCRAP_DISPOSAL">Damaged / Expired Scrap Disposal</option>
                    </select>
                  </div>

                  {/* Quantity */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-700">
                        Dispatch Quantity ({selectedBatch.unit_of_measure}) *
                      </label>
                      <button
                        type="button"
                        onClick={() => setPickQuantity(selectedBatch.quantity_current)}
                        className="text-[10px] font-mono-code text-slate-700 hover:text-slate-900 font-bold"
                      >
                        MAX ({selectedBatch.quantity_current} units)
                      </button>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={selectedBatch.quantity_current}
                      value={pickQuantity || ''}
                      onChange={(e) => setPickQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 font-mono-code font-bold focus:outline-none"
                    />
                  </div>

                  {/* Order Details */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Sales Order #</label>
                      <input
                        type="text"
                        value={salesOrderRef}
                        onChange={(e) => setSalesOrderRef(e.target.value)}
                        placeholder="e.g. SO-IND-88190"
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono-code focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Consignee Customer</label>
                      <input
                        type="text"
                        value={customerDestination}
                        onChange={(e) => setCustomerDestination(e.target.value)}
                        placeholder="e.g. Apollo Hub"
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Carrier */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Transporter</label>
                      <input
                        type="text"
                        value={transporterName}
                        onChange={(e) => setTransporterName(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Vehicle No.</label>
                      <input
                        type="text"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono-code focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Physical Floor Barcode Check */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-600 flex items-center gap-1">
                        <Scan className="w-3.5 h-3.5 text-slate-600" />
                        <span>Floor Barcode Check</span>
                      </span>
                      {isBarcodeVerified ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> VERIFIED
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono-code">Optional</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Scan lot barcode..."
                        value={verificationBarcode}
                        onChange={(e) => handleVerifyBarcode(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono-code text-slate-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleVerifyBarcode(selectedBatch.barcode)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[11px] font-semibold shrink-0"
                      >
                        Auto-Verify
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm shadow-xs transition-colors flex items-center justify-center gap-2"
                    >
                      <ArrowUpFromLine className="w-4 h-4" />
                      <span>Confirm Outbound Pick & Generate Challan</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-8 text-center text-slate-400">
                  Select a product and batch lot on the left to begin outbound dispatch.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB: CLEARANCE & HOLD QUEUE
          ═══════════════════════════════════════════════════════════════════ */}
      {currentTab === 'clearance' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-700">Filter Queue:</span>
              <div className="flex items-center space-x-1">
                {(['ALL', 'CRITICAL', 'EXPIRED', 'QUARANTINE'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setClearanceFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      clearanceFilter === f
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {f === 'ALL' ? 'All Expiring Lots' : f === 'CRITICAL' ? 'Critical (≤7d)' : f === 'EXPIRED' ? 'Expired Lots' : 'On QA Hold'}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search SKU, lot, or bin..."
                value={clearanceSearch}
                onChange={(e) => setClearanceSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono-code bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Clearance Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono-code text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Bin Location</th>
                    <th className="py-2.5 px-3">Product Description & SKU</th>
                    <th className="py-2.5 px-3">Lot Number</th>
                    <th className="py-2.5 px-3 text-right">Available Qty</th>
                    <th className="py-2.5 px-3">Expiry Date</th>
                    <th className="py-2.5 px-3">Shelf-Life Status</th>
                    <th className="py-2.5 px-3 text-right">Clearance Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {batches
                    .filter((b) => b.quantity_current > 0)
                    .filter((b) => {
                      const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
                      const isExp = st.daysRemaining <= 0 || b.status === 'expired';
                      const isCrit = st.daysRemaining > 0 && st.daysRemaining <= 7;
                      const isQuar = b.status === 'quarantine';

                      if (clearanceFilter === 'EXPIRED') return isExp;
                      if (clearanceFilter === 'CRITICAL') return isCrit;
                      if (clearanceFilter === 'QUARANTINE') return isQuar;
                      return isExp || isCrit || isQuar || st.daysRemaining <= 30;
                    })
                    .filter((b) => {
                      if (!clearanceSearch.trim()) return true;
                      const q = clearanceSearch.toLowerCase();
                      return (
                        b.product_name.toLowerCase().includes(q) ||
                        b.product_code.toLowerCase().includes(q) ||
                        b.batch_number.toLowerCase().includes(q) ||
                        b.location_code.toLowerCase().includes(q)
                      );
                    })
                    .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())
                    .map((b) => {
                      const st = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
                      const isExp = st.daysRemaining <= 0 || b.status === 'expired';
                      const isQuar = b.status === 'quarantine';

                      return (
                        <tr key={b.batch_id} className={`hover:bg-slate-50/70 transition-colors ${isExp ? 'bg-rose-50/30' : isQuar ? 'bg-amber-50/30' : ''}`}>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{b.location_code}</td>
                          <td className="py-2.5 px-3 font-sans">
                            <span className="font-bold text-slate-900 block text-xs">{b.product_name}</span>
                            <span className="text-[10px] text-slate-400 font-mono-code">{b.product_code} · {b.category}</span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">{b.batch_number}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {b.quantity_current} {b.unit_of_measure}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{formatDate(b.expiry_date)}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${st.badgeClass}`}>
                              {isExp ? 'EXPIRED' : isQuar ? 'ON QA HOLD' : `${st.daysRemaining}d remaining`}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {!isExp && !isQuar && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedProductId(b.product_id);
                                    setSelectedBatchId(b.batch_id);
                                    setCurrentTab('picking');
                                  }}
                                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold shadow-2xs"
                                >
                                  Stage Pick
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const res = toggleHoldBatch(
                                    b.batch_id,
                                    isQuar ? 'Released from QA hold back to active stock' : 'Placed on QA hold from Clearance Queue'
                                  );
                                  if (res.success) {
                                    setSuccessMessage(
                                      isQuar
                                        ? `Lot ${b.batch_number} released from hold (Active).`
                                        : `Lot ${b.batch_number} placed on QA Quarantine Hold.`
                                    );
                                    setTimeout(() => setSuccessMessage(''), 3000);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                                  isQuar
                                    ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                }`}
                                title={isQuar ? 'Click to Release / Undo Hold' : 'Place on QA Quarantine Hold'}
                              >
                                {isQuar ? 'Release Hold' : 'Hold'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setWriteOffTargetBatch(b)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors"
                                title="Write-Off & Scrap Material"
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
          TAB 2: DISPATCH LEDGER & REVERSALS
          ═══════════════════════════════════════════════════════════════════ */}
      {currentTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Outbound Dispatch Transactions & Reversal Log</span>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by ref, lot, or product..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none"
                />
              </div>
            </div>

            <table className="w-full text-left font-mono-code text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Reference Doc</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Lot Number</th>
                  <th className="py-2.5 px-3 text-right">Picked Qty</th>
                  <th className="py-2.5 px-3">FIFO Status</th>
                  <th className="py-2.5 px-3">Operator</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {transactions
                  .filter((t) => t.transaction_type === 'OUT')
                  .filter((t) => {
                    if (!historySearch) return true;
                    const q = historySearch.toLowerCase();
                    return (
                      t.product_name.toLowerCase().includes(q) ||
                      t.batch_number.toLowerCase().includes(q) ||
                      (t.reference_document && t.reference_document.toLowerCase().includes(q))
                    );
                  })
                  .map((t) => (
                    <tr key={t.transaction_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 text-slate-500">{formatDateTime(t.transaction_date)}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{t.reference_document || t.transaction_id}</td>
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-800">{t.product_name}</td>
                      <td className="py-2.5 px-3">{t.batch_number}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">{t.quantity} units</td>
                      <td className="py-2.5 px-3">
                        {t.fifo_compliant !== false ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
                            100% FIFO
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-800">
                            OVERRIDE
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-sans">{t.user_name}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setReversalTargetTx(t)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200 text-[11px] font-semibold transition-colors"
                        >
                          Void & Restock
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 3: FIFO FLOOR SOP
          ═══════════════════════════════════════════════════════════════════ */}
      {currentTab === 'guide' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 text-slate-700 leading-relaxed text-xs">
          <h3 className="text-base font-bold text-slate-900">Standard Operating Procedure: FIFO & FEFO Rotation</h3>
          <p>
            This warehouse strictly operates under First-In, First-Out (FIFO) and First-Expired, First-Out (FEFO) rules to minimize inventory obsolescence and ensure maximum customer shelf-life satisfaction.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <span className="font-bold text-slate-900 text-sm block">1. Oldest Lot Mandate</span>
              <p className="text-slate-600">The software always recommends the batch with the earliest expiration date. Operators must pick this batch first.</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <span className="font-bold text-slate-900 text-sm block">2. Supervisor Overrides</span>
              <p className="text-slate-600">When picking later lots due to contractual client mandates, a supervisor must authorize the bypass with a recorded reason.</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <span className="font-bold text-slate-900 text-sm block">3. Barcode Verification</span>
              <p className="text-slate-600">Scan physical pallet/box labels on the floor to verify correct lot selection before loading trucks.</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SUPERVISOR OVERRIDE MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white border border-amber-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl text-xs">
            <div className="flex items-center space-x-2 text-amber-600 pb-2 border-b border-amber-100">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 text-sm">Authorize Non-FIFO Outbound Pick</h3>
            </div>
            <p className="text-slate-600">
              You are picking a newer lot when older stock is available. Please select a reason for supervisor audit authorization.
            </p>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Override Reason *</label>
              <select
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 font-medium focus:outline-none"
              >
                <option value="Customer contractually mandated latest production batch">Customer contractually mandated latest production batch</option>
                <option value="Packaging variation requested for export consignment">Packaging variation requested for export consignment</option>
                <option value="Bulk pallet full clearance requirement">Bulk pallet full clearance requirement</option>
                <option value="Other audited operational justification">Other audited operational justification</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Authorizing Supervisor</label>
              <select
                value={selectedSupervisorId}
                onChange={(e) => setSelectedSupervisorId(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 font-medium focus:outline-none"
              >
                {eligibleSupervisors.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.full_name} ({u.role.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExecutePick(undefined, true)}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow-2xs"
              >
                Authorize & Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          REVERSAL CONFIRMATION MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {reversalTargetTx && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white border border-rose-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl text-xs">
            <div className="flex items-center space-x-2 text-rose-600 pb-2 border-b border-rose-100">
              <RotateCcw className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 text-sm">Void & Restock Dispatch</h3>
            </div>
            <p className="text-slate-600">
              Are you sure you want to void transaction <strong>{reversalTargetTx.reference_document || reversalTargetTx.transaction_id}</strong> and return <strong>+{reversalTargetTx.quantity} units</strong> to bin <strong>{reversalTargetTx.location_code}</strong>?
            </p>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reason for Reversal</label>
              <input
                type="text"
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReversalTargetTx(null)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReversal}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-2xs"
              >
                Confirm Restock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          PRINTABLE GST DELIVERY CHALLAN MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {challanData && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-2xl w-full space-y-4 shadow-xl text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Outbound Delivery Challan / Gate Pass</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Challan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChallanData(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Body */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4 font-sans text-slate-800">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <h4 className="font-bold text-base text-slate-900 uppercase tracking-wide">{settings.company?.name || 'ABC Logistics & Supply Chain'}</h4>
                  <p className="text-[11px] text-slate-600">{settings.company?.address}</p>
                  <p className="text-[10px] text-slate-500 font-mono-code">
                    GSTIN: {settings.company?.gstin || '27AABCU9603R1ZM'} | FSSAI: {settings.company?.fssai_license || '10019022009876'}
                  </p>
                </div>
                <div className="text-right font-mono-code">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs block">
                    DELIVERY CHALLAN
                  </span>
                  <span className="text-[11px] text-slate-600 mt-1 block">Challan: {challanData.challanNumber}</span>
                  <span className="text-[10px] text-slate-500 block">Date: {formatDateTime(challanData.date)}</span>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-4 text-xs font-mono-code bg-white p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-sans font-bold">Consignee Customer:</span>
                  <strong className="text-slate-900 font-sans text-xs">{challanData.customer}</strong>
                  <div className="text-slate-500 text-[10px] mt-1">Order Ref: {challanData.orderRef}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-sans font-bold">Logistics & Vehicle:</span>
                  <div className="text-slate-800 font-sans">{challanData.transporter}</div>
                  <div className="text-slate-500 text-[10px]">Vehicle: {challanData.vehicleNo} · Waybill: {challanData.waybillNo}</div>
                </div>
              </div>

              {/* Items */}
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                    <th className="py-2">Product Description</th>
                    <th className="py-2">Lot Number</th>
                    <th className="py-2">Bin Location</th>
                    <th className="py-2">Expiry</th>
                    <th className="py-2 text-right">Quantity</th>
                    <th className="py-2 text-right">Rate (₹)</th>
                    <th className="py-2 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono-code text-[11px]">
                  <tr>
                    <td className="py-2.5 font-sans font-semibold text-slate-900">{challanData.productName}</td>
                    <td className="py-2.5 font-bold text-slate-800">{challanData.batchNumber}</td>
                    <td className="py-2.5 text-slate-700">{challanData.locationCode}</td>
                    <td className="py-2.5 text-slate-600">{formatDate(challanData.expiryDate)}</td>
                    <td className="py-2.5 text-right font-bold text-slate-900">{challanData.quantity} {challanData.unit}</td>
                    <td className="py-2.5 text-right text-slate-700">{formatINR(challanData.unitCost)}</td>
                    <td className="py-2.5 text-right font-bold text-emerald-700">{formatINR(challanData.totalINR)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 font-mono-code font-bold">
                    <td colSpan={4} className="py-2 text-slate-700 font-sans">TOTAL DISPATCH VALUATION</td>
                    <td className="py-2 text-right text-slate-900">{challanData.quantity} {challanData.unit}</td>
                    <td></td>
                    <td className="py-2 text-right text-emerald-700 text-sm">{formatINR(challanData.totalINR)}</td>
                  </tr>
                </tfoot>
              </table>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-500 font-sans">
                <div className="border-t border-slate-300 pt-2 font-medium">
                  <div>{challanData.pickedBy}</div>
                  <div>Warehouse Dispatcher</div>
                </div>
                <div className="border-t border-slate-300 pt-2 font-medium">
                  <div>{challanData.transporter}</div>
                  <div>Carrier / Driver Sign</div>
                </div>
                <div className="border-t border-slate-300 pt-2 font-medium">
                  <div>Security Gate</div>
                  <div>Exit Stamp</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
