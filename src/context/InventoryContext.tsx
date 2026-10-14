import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  Product,
  InventoryBatch,
  Location,
  Transaction,
  TransactionType,
  Supplier,
  User,
  Company,
  SystemSettings,
  AlertItem,
  UserRole,
  BatchStatus,
} from '../types/inventory';
import {
  INITIAL_PRODUCTS,
  INITIAL_BATCHES,
  INITIAL_LOCATIONS,
  INITIAL_TRANSACTIONS,
  INITIAL_SUPPLIERS,
  INITIAL_USERS,
  INITIAL_COMPANIES,
  INITIAL_SETTINGS,
} from '../data/initialData';
import { calculateShelfLifeStatus } from '../utils/shelfLife';
import { formatBarcodeString } from '../utils/barcode';
import { soundFx } from '../utils/sound';
import { sanitizeInput, sanitizeNotes, SecurityEventLog } from '../utils/security';

interface FIFOValidationResult {
  isCompliant: boolean;
  recommendedBatch: InventoryBatch | null;
  selectedBatch: InventoryBatch | null;
  violationMessage?: string;
  daysDifference?: number;
}

export interface HoldHistoryItem {
  id: string;
  batchId: string;
  batchNumber: string;
  productName: string;
  action: 'HOLD' | 'RELEASE';
  previousStatus: BatchStatus;
  newStatus: BatchStatus;
  timestamp: string;
  notes?: string;
}

interface InventoryContextType {
  products: Product[];
  batches: InventoryBatch[];
  locations: Location[];
  transactions: Transaction[];
  suppliers: Supplier[];
  users: User[];
  companies: Company[];
  currentUser: User;
  settings: SystemSettings;
  alerts: AlertItem[];
  securityLogs: SecurityEventLog[];
  activeTab: string;
  scannerOpen: boolean;
  selectedBatchForDetail: InventoryBatch | null;
  prefilledReceiptProduct: Product | null;
  prefilledReorderQty: number;
  writeOffTargetBatch: InventoryBatch | null;
  
  // Hold Undo / Redo
  holdHistory: HoldHistoryItem[];
  canUndoHold: boolean;
  canRedoHold: boolean;
  lastHoldAction: HoldHistoryItem | null;
  undoHold: () => { success: boolean; message: string };
  redoHold: () => { success: boolean; message: string };
  
  // Actions
  setActiveTab: (tab: string) => void;
  setCurrentUser: (user: User) => void;
  setScannerOpen: (open: boolean) => void;
  setSelectedBatchForDetail: (batch: InventoryBatch | null) => void;
  setPrefilledReceiptProduct: (product: Product | null, reorderQty?: number) => void;
  setWriteOffTargetBatch: (batch: InventoryBatch | null) => void;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  logSecurityEvent: (event: Omit<SecurityEventLog, 'id' | 'timestamp'>) => void;
  clearSecurityLogs: () => void;
  
  // User & Company Management
  addUser: (user: Omit<User, 'user_id'>) => User;
  updateUser: (user: User) => void;
  deleteUser: (userId: string) => { success: boolean; message?: string };
  addCompany: (company: Omit<Company, 'company_id'>) => Company;
  updateCompany: (company: Company) => void;
  deleteCompany: (companyId: string) => { success: boolean; message?: string };
  setActiveCompany: (companyId: string) => void;
  
  // Inventory ops
  receiveGoods: (batchData: Omit<InventoryBatch, 'batch_id' | 'barcode' | 'status' | 'qc_passed'> & {
    qc_passed: boolean;
    reference_document?: string;
  }) => { success: boolean; batch: InventoryBatch; error?: string };
  
  validateFIFOPick: (productId: string, batchId: string) => FIFOValidationResult;
  
  pickGoods: (params: {
    batchId: string;
    quantity: number;
    referenceDocument?: string;
    salesOrderRef?: string;
    purpose?: string;
    customerDestination?: string;
    transporterName?: string;
    vehicleNumber?: string;
    waybillNumber?: string;
    driverPhone?: string;
    notes?: string;
    isOverride?: boolean;
    overrideReason?: string;
    overrideBy?: string;
    supervisorOverrideBy?: string;
  }) => { success: boolean; error?: string; transaction?: Transaction };
  
  adjustStock: (params: {
    batchId: string;
    newQuantity: number;
    reason: 'DAMAGE' | 'ADJUST' | 'EXPIRE';
    referenceDocument?: string;
    notes?: string;
  }) => { success: boolean; error?: string };

  quarantineBatch: (batchId: string, notes?: string) => { success: boolean; newStatus?: BatchStatus; error?: string };
  toggleHoldBatch: (batchId: string, notes?: string) => { success: boolean; newStatus?: BatchStatus; error?: string };
  writeOffBatch: (params: {
    batchId: string;
    quantity?: number;
    reason: string;
    dispositionType?: 'EXPIRED_LOSS' | 'DAMAGED_SCRAP' | 'QA_REJECTED' | 'OBSOLETE_WRITE_OFF' | 'TEMP_EXCURSION' | 'PILFERAGE';
    salvageRecoveryInr?: number;
    witnessName?: string;
    referenceDoc?: string;
  }) => { success: boolean; writeOffQty?: number; lossInr?: number; message?: string; error?: string };
  relocateBatch: (batchId: string, newLocationCode: string) => { success: boolean; error?: string };
  splitBatch: (params: {
    batchId: string;
    splitQuantity: number;
    newLocationCode?: string;
    notes?: string;
  }) => { success: boolean; newBatch?: InventoryBatch; error?: string };
  performCycleCount: (items: {
    batchId: string;
    physicalQty: number;
    notes?: string;
  }[]) => { success: boolean; adjustedCount: number; varianceUnits: number };
  disposeOrRtvBatch: (params: {
    batchId: string;
    quantity: number;
    dispositionType: 'RTV_RETURN' | 'SCRAP_DESTRUCTION' | 'SALVAGE_CLEARANCE';
    referenceDocument: string;
    reason: string;
    vendorId?: string;
    salvageRecoveryInr?: number;
    witnessName?: string;
  }) => { success: boolean; error?: string };
  
  addProduct: (product: Omit<Product, 'product_id' | 'created_at'>) => Product;
  updateProduct: (product: Product) => void;
  deleteProduct: (productId: string) => { success: boolean; message?: string };
  addSupplier: (supplier: Omit<Supplier, 'supplier_id'>) => Supplier;
  updateSupplier: (supplier: Supplier) => void;
  deleteSupplier: (supplierId: string) => { success: boolean; message?: string };
  addLocation: (location: Omit<Location, 'location_id' | 'current_occupancy'>) => Location;
  updateLocation: (location: Location) => void;
  deleteLocation: (locationId: string) => { success: boolean; message?: string };
  deleteBatch: (batchId: string, reason?: string) => { success: boolean; message?: string };
  reverseTransaction: (transactionId: string, reason?: string) => { success: boolean; message?: string };
  
  findBatchByBarcode: (barcode: string) => InventoryBatch | null;
  findProductByBarcodeOrCode: (code: string) => Product | null;
  
  acknowledgeAlert: (alertId: string) => void;
  exportDatabaseBackup: () => void;
  restoreDatabaseBackup: (jsonString: string) => { success: boolean; message: string };
  resetToDefaultData: () => void;
  purgeExpiredBatches: () => { success: boolean; count: number; totalLossInr: number };
  purgeDepletedBatches: () => { success: boolean; count: number };
  clearTransactions: () => { success: boolean; message: string };
  
  // Helper queries
  getBatchesForProductFIFO: (productId: string) => InventoryBatch[];
  allocateFIFOBatches: (productId: string, requestedQuantity: number) => {
    allocations: { batch: InventoryBatch; pickQty: number; isOldest: boolean }[];
    isFullFulfillment: boolean;
    allocatedQty: number;
    unfulfilledQty: number;
  };
  
  // Security PIN Verification
  verifyUserPin: (params: {
    pin: string;
    userId?: string;
    requiredRole?: UserRole;
    requiredPermission?: 'can_override_fifo' | 'can_delete_records' | 'can_adjust_stock' | 'can_manage_settings';
  }) => { success: boolean; user?: User; error?: string };
}

const STORAGE_KEY = 'FIFO_WMS_DATABASE_V2';

const InventoryContext = createContext<InventoryContextType | null>(null);

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [batches, setBatches] = useState<InventoryBatch[]>(INITIAL_BATCHES);
  const [locations, setLocations] = useState<Location[]>(INITIAL_LOCATIONS);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [companies, setCompanies] = useState<Company[]>(INITIAL_COMPANIES);
  const [currentUser, setCurrentUser] = useState<User>(INITIAL_USERS[0]); // Staff by default
  const [settings, setSettings] = useState<SystemSettings>(INITIAL_SETTINGS);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);
  const [selectedBatchForDetail, setSelectedBatchForDetail] = useState<InventoryBatch | null>(null);
  const [prefilledReceiptProduct, setPrefilledReceiptProductState] = useState<Product | null>(null);
  const [prefilledReorderQty, setPrefilledReorderQty] = useState<number>(0);
  const [writeOffTargetBatch, setWriteOffTargetBatch] = useState<InventoryBatch | null>(null);

  // Hold Undo / Redo Stacks
  const [holdUndoStack, setHoldUndoStack] = useState<HoldHistoryItem[]>([]);
  const [holdRedoStack, setHoldRedoStack] = useState<HoldHistoryItem[]>([]);

  const setPrefilledReceiptProduct = (product: Product | null, reorderQty: number = 0) => {
    setPrefilledReceiptProductState(product);
    setPrefilledReorderQty(reorderQty);
  };

  // Load from local disk storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.products) setProducts(parsed.products);
        if (parsed.batches) setBatches(parsed.batches);
        if (parsed.locations) setLocations(parsed.locations);
        if (parsed.transactions) setTransactions(parsed.transactions);
        if (parsed.suppliers) setSuppliers(parsed.suppliers);
        if (parsed.users) setUsers(parsed.users);
        if (parsed.companies) setCompanies(parsed.companies);
        if (parsed.settings) {
          setSettings(parsed.settings);
          soundFx.setEnabled(parsed.settings.sound_effects ?? true);
        }
        if (parsed.currentUserId) {
          const u = (parsed.users || INITIAL_USERS).find((x: User) => x.user_id === parsed.currentUserId);
          if (u) setCurrentUser(u);
        }
      }
    } catch (e) {
      console.error('Failed to load database from disk storage:', e);
    }
  }, []);

  // Save to disk storage on state updates
  useEffect(() => {
    try {
      const payload = {
        products,
        batches,
        locations,
        transactions,
        suppliers,
        users,
        companies,
        settings,
        currentUserId: currentUser.user_id,
        saved_at: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to persist database to disk storage:', e);
    }
  }, [products, batches, locations, transactions, suppliers, users, companies, settings, currentUser]);

  // Re-calculate alerts whenever batches or products change
  const recomputeAlerts = useCallback(() => {
    const newAlerts: AlertItem[] = [];

    // Check batch expiry zones
    batches.forEach((b) => {
      if (b.status === 'depleted') return;
      const status = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date, 180);

      if (status.zone === 'BLACK' || status.daysRemaining < 0) {
        newAlerts.push({
          alert_id: `alert-exp-${b.batch_id}`,
          batch_id: b.batch_id,
          product_id: b.product_id,
          product_name: b.product_name,
          batch_number: b.batch_number,
          location_code: b.location_code,
          alert_type: 'expired',
          alert_level: 'BLACK',
          days_remaining: status.daysRemaining,
          quantity: b.quantity_current,
          created_at: new Date().toISOString(),
          acknowledged: false,
        });
      } else if (status.zone === 'RED') {
        newAlerts.push({
          alert_id: `alert-red-${b.batch_id}`,
          batch_id: b.batch_id,
          product_id: b.product_id,
          product_name: b.product_name,
          batch_number: b.batch_number,
          location_code: b.location_code,
          alert_type: 'expiry_warning',
          alert_level: 'RED',
          days_remaining: status.daysRemaining,
          quantity: b.quantity_current,
          created_at: new Date().toISOString(),
          acknowledged: false,
        });
      } else if (status.zone === 'ORANGE') {
        newAlerts.push({
          alert_id: `alert-orange-${b.batch_id}`,
          batch_id: b.batch_id,
          product_id: b.product_id,
          product_name: b.product_name,
          batch_number: b.batch_number,
          location_code: b.location_code,
          alert_type: 'expiry_warning',
          alert_level: 'ORANGE',
          days_remaining: status.daysRemaining,
          quantity: b.quantity_current,
          created_at: new Date().toISOString(),
          acknowledged: false,
        });
      }
    });

    // Check low stock on products
    products.forEach((p) => {
      const totalStock = batches
        .filter((b) => b.product_id === p.product_id && b.status === 'active')
        .reduce((sum, b) => sum + b.quantity_current, 0);

      if (totalStock <= p.reorder_level) {
        newAlerts.push({
          alert_id: `alert-lowstock-${p.product_id}`,
          batch_id: '',
          product_id: p.product_id,
          product_name: p.product_name,
          batch_number: 'N/A',
          location_code: 'Global',
          alert_type: 'low_stock',
          alert_level: 'YELLOW',
          days_remaining: 0,
          quantity: totalStock,
          created_at: new Date().toISOString(),
          acknowledged: false,
        });
      }
    });

    setAlerts(newAlerts);
  }, [batches, products]);

  useEffect(() => {
    recomputeAlerts();
  }, [recomputeAlerts]);

  // Update Settings
  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (updated.sound_effects !== undefined) {
        soundFx.setEnabled(updated.sound_effects);
      }
      
      // If company details are updated via updateSettings, synchronize the active company in companies array
      if (newSettings.company) {
        const targetCompId = prev.activeCompanyId;
        setCompanies((compList) => {
          let found = false;
          const mapped = compList.map((c) => {
            if (c.company_id === targetCompId || (!targetCompId && c.name === prev.company.name)) {
              found = true;
              return {
                ...c,
                name: newSettings.company?.name ?? c.name,
                warehouse_name: newSettings.company?.warehouse_name ?? c.warehouse_name,
                address: newSettings.company?.address ?? c.address,
                logo_text: newSettings.company?.logo_text ?? c.logo_text,
                gstin: newSettings.company?.gstin ?? c.gstin,
                fssai_license: newSettings.company?.fssai_license ?? c.fssai_license,
                contact_phone: newSettings.company?.contact_phone ?? c.contact_phone,
                contact_email: newSettings.company?.contact_email ?? c.contact_email,
              };
            }
            return c;
          });
          if (!found && compList.length > 0) {
            mapped[0] = {
              ...mapped[0],
              name: newSettings.company?.name ?? mapped[0].name,
              warehouse_name: newSettings.company?.warehouse_name ?? mapped[0].warehouse_name,
              address: newSettings.company?.address ?? mapped[0].address,
              logo_text: newSettings.company?.logo_text ?? mapped[0].logo_text,
              gstin: newSettings.company?.gstin ?? mapped[0].gstin,
              fssai_license: newSettings.company?.fssai_license ?? mapped[0].fssai_license,
              contact_phone: newSettings.company?.contact_phone ?? mapped[0].contact_phone,
              contact_email: newSettings.company?.contact_email ?? mapped[0].contact_email,
            };
          }
          return mapped;
        });
      }

      return updated;
    });
    soundFx.playSuccessChime();
  };

  // Helper: Get active batches for a product sorted strictly by FIFO (Oldest expiry first)
  const getBatchesForProductFIFO = useCallback(
    (productId: string): InventoryBatch[] => {
      return batches
        .filter((b) => b.product_id === productId && b.quantity_current > 0 && b.status === 'active')
        .sort((a, b) => {
          const dateA = new Date(a.expiry_date).getTime();
          const dateB = new Date(b.expiry_date).getTime();
          if (dateA !== dateB) return dateA - dateB;
          return new Date(a.received_date).getTime() - new Date(b.received_date).getTime();
        });
    },
    [batches]
  );

  // FIFO Pick Validation: Checks whether the picker is selecting the oldest batch
  const validateFIFOPick = useCallback(
    (productId: string, batchId: string): FIFOValidationResult => {
      const fifoBatches = getBatchesForProductFIFO(productId);
      if (fifoBatches.length === 0) {
        return { isCompliant: true, recommendedBatch: null, selectedBatch: null };
      }

      const recommended = fifoBatches[0];
      const selected = batches.find((b) => b.batch_id === batchId) || null;

      if (!selected) {
        return { isCompliant: false, recommendedBatch: recommended, selectedBatch: null, violationMessage: 'Batch not found.' };
      }

      if (selected.batch_id === recommended.batch_id) {
        return { isCompliant: true, recommendedBatch: recommended, selectedBatch: selected };
      }

      // Check if selected expiry is same as recommended (both equally oldest)
      const recDate = new Date(recommended.expiry_date).getTime();
      const selDate = new Date(selected.expiry_date).getTime();

      if (recDate === selDate) {
        return { isCompliant: true, recommendedBatch: recommended, selectedBatch: selected };
      }

      const diffDays = Math.round((selDate - recDate) / (1000 * 60 * 60 * 24));

      return {
        isCompliant: false,
        recommendedBatch: recommended,
        selectedBatch: selected,
        daysDifference: diffDays,
        violationMessage: `FIFO VIOLATION: Batch #${recommended.batch_number} expires on ${recommended.expiry_date} (${diffDays} days earlier than selected Batch #${selected.batch_number}). System requires picking the oldest batch first!`,
      };
    },
    [getBatchesForProductFIFO, batches]
  );

  // Receive Goods (IN)
  const receiveGoods = (
    batchData: Omit<InventoryBatch, 'batch_id' | 'barcode' | 'status' | 'qc_passed'> & {
      qc_passed: boolean;
      reference_document?: string;
    }
  ) => {
    try {
      const barcode = formatBarcodeString(
        batchData.product_code,
        batchData.batch_number,
        batchData.manufacturing_date || batchData.received_date
      );

      // Check barcode uniqueness
      const existing = batches.find((b) => b.barcode === barcode);
      if (existing) {
        return { success: false, batch: existing, error: `Barcode ${barcode} already exists in database!` };
      }

      const newBatchId = `batch-${Date.now()}`;
      const newBatch: InventoryBatch = {
        ...batchData,
        batch_id: newBatchId,
        barcode,
        status: batchData.qc_passed ? 'active' : 'quarantine',
        qc_passed: batchData.qc_passed,
      };

      // Create transaction
      const newTx: Transaction = {
        transaction_id: `tx-${Date.now()}`,
        batch_id: newBatchId,
        product_id: newBatch.product_id,
        product_name: newBatch.product_name,
        product_code: newBatch.product_code,
        batch_number: newBatch.batch_number,
        transaction_type: 'IN',
        quantity: newBatch.quantity_received,
        previous_quantity: 0,
        new_quantity: newBatch.quantity_received,
        transaction_date: new Date().toISOString(),
        user_id: currentUser.user_id,
        user_name: currentUser.full_name,
        user_role: currentUser.role,
        reference_document: batchData.reference_document || 'PO-DIRECT-RECEIPT',
        location_code: newBatch.location_code,
        notes: `Received from ${newBatch.supplier_name}. QC Status: ${newBatch.qc_passed ? 'PASSED' : 'HELD'}`,
        fifo_compliant: true,
      };

      // Update location occupancy
      setLocations((prev) =>
        prev.map((loc) =>
          loc.location_code === newBatch.location_code
            ? { ...loc, current_occupancy: loc.current_occupancy + newBatch.quantity_received }
            : loc
        )
      );

      setBatches((prev) => [newBatch, ...prev]);
      setTransactions((prev) => [newTx, ...prev]);

      soundFx.playBarcodeBeep();
      return { success: true, batch: newBatch };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error receiving goods';
      return { success: false, batch: {} as InventoryBatch, error: msg };
    }
  };

  // Pick Goods (OUT)
  const pickGoods = (params: {
    batchId: string;
    quantity: number;
    referenceDocument?: string;
    salesOrderRef?: string;
    purpose?: string;
    customerDestination?: string;
    transporterName?: string;
    vehicleNumber?: string;
    waybillNumber?: string;
    driverPhone?: string;
    notes?: string;
    isOverride?: boolean;
    overrideReason?: string;
    overrideBy?: string;
    supervisorOverrideBy?: string;
  }) => {
    const targetBatch = batches.find((b) => b.batch_id === params.batchId);
    if (!targetBatch) {
      return { success: false, error: 'Target batch was not found.' };
    }

    if (targetBatch.status !== 'active') {
      return { success: false, error: `Cannot pick from batch with status: ${targetBatch.status.toUpperCase()}` };
    }

    if (params.quantity <= 0) {
      return { success: false, error: 'Pick quantity must be greater than 0.' };
    }

    if (params.quantity > targetBatch.quantity_current) {
      return {
        success: false,
        error: `Insufficient stock in batch. Available: ${targetBatch.quantity_current}, Requested: ${params.quantity}`,
      };
    }

    // Verify FIFO compliance
    const fifoCheck = validateFIFOPick(targetBatch.product_id, targetBatch.batch_id);
    const isCompliant = fifoCheck.isCompliant;

    if (!isCompliant && !params.isOverride) {
      soundFx.playWarningAlert();
      return {
        success: false,
        error: fifoCheck.violationMessage || 'FIFO violation: please pick from the oldest batch or provide supervisor override.',
      };
    }

    const previousQty = targetBatch.quantity_current;
    const newQty = previousQty - params.quantity;
    const newStatus = newQty === 0 ? 'depleted' : targetBatch.status;

    const effectiveRef = params.referenceDocument || params.salesOrderRef || 'SO-DISPATCH';
    const effectiveOverrideBy = params.supervisorOverrideBy || params.overrideBy || (!isCompliant ? currentUser.full_name : undefined);

    const newTx: Transaction = {
      transaction_id: `tx-${Date.now()}`,
      batch_id: targetBatch.batch_id,
      product_id: targetBatch.product_id,
      product_name: targetBatch.product_name,
      product_code: targetBatch.product_code,
      batch_number: targetBatch.batch_number,
      transaction_type: 'OUT',
      quantity: params.quantity,
      previous_quantity: previousQty,
      new_quantity: newQty,
      transaction_date: new Date().toISOString(),
      user_id: currentUser.user_id,
      user_name: currentUser.full_name,
      user_role: currentUser.role,
      reference_document: effectiveRef,
      location_code: targetBatch.location_code,
      notes: params.notes,
      fifo_compliant: isCompliant,
      override_reason: !isCompliant ? params.overrideReason : undefined,
      override_by: effectiveOverrideBy,
      customer_destination: params.customerDestination,
    };

    // Update batch
    setBatches((prev) =>
      prev.map((b) => (b.batch_id === targetBatch.batch_id ? { ...b, quantity_current: newQty, status: newStatus } : b))
    );

    // Update location occupancy
    setLocations((prev) =>
      prev.map((loc) =>
        loc.location_code === targetBatch.location_code
          ? { ...loc, current_occupancy: Math.max(0, loc.current_occupancy - params.quantity) }
          : loc
      )
    );

    setTransactions((prev) => [newTx, ...prev]);

    if (isCompliant) {
      soundFx.playSuccessChime();
    } else {
      soundFx.playBarcodeBeep();
    }

    return { success: true, transaction: newTx };
  };

  // Adjust Stock (ADJUST, DAMAGE, EXPIRE)
  const adjustStock = (params: {
    batchId: string;
    newQuantity: number;
    reason: 'DAMAGE' | 'ADJUST' | 'EXPIRE';
    referenceDocument?: string;
    notes?: string;
  }) => {
    const targetBatch = batches.find((b) => b.batch_id === params.batchId);
    if (!targetBatch) return { success: false, error: 'Batch not found.' };

    const previousQty = targetBatch.quantity_current;
    const diff = params.newQuantity - previousQty;
    const newQty = Math.max(0, params.newQuantity);
    const newStatus = newQty === 0 ? 'depleted' : targetBatch.status;

    const newTx: Transaction = {
      transaction_id: `tx-${Date.now()}`,
      batch_id: targetBatch.batch_id,
      product_id: targetBatch.product_id,
      product_name: targetBatch.product_name,
      product_code: targetBatch.product_code,
      batch_number: targetBatch.batch_number,
      transaction_type: params.reason,
      quantity: Math.abs(diff),
      previous_quantity: previousQty,
      new_quantity: newQty,
      transaction_date: new Date().toISOString(),
      user_id: currentUser.user_id,
      user_name: currentUser.full_name,
      user_role: currentUser.role,
      reference_document: params.referenceDocument || `AUDIT-${params.reason}`,
      location_code: targetBatch.location_code,
      notes: params.notes || `Stock adjusted from ${previousQty} to ${newQty}`,
      fifo_compliant: true,
    };

    setBatches((prev) =>
      prev.map((b) => (b.batch_id === targetBatch.batch_id ? { ...b, quantity_current: newQty, status: newStatus } : b))
    );

    setLocations((prev) =>
      prev.map((loc) =>
        loc.location_code === targetBatch.location_code
          ? { ...loc, current_occupancy: Math.max(0, loc.current_occupancy + diff) }
          : loc
      )
    );

    setTransactions((prev) => [newTx, ...prev]);
    soundFx.playBarcodeBeep();
    return { success: true };
  };

  // Quarantine Batch & Hold / Release (With full Undo / Redo History)
  const quarantineBatch = (batchId: string, notes?: string) => {
    const targetBatch = batches.find((b) => b.batch_id === batchId);
    if (!targetBatch) return { success: false, error: 'Batch not found.' };

    const isCurrentlyQuarantine = targetBatch.status === 'quarantine';
    const newStatus: BatchStatus = isCurrentlyQuarantine ? 'active' : 'quarantine';

    // Update batch status
    setBatches((prev) =>
      prev.map((b) =>
        b.batch_id === batchId
          ? {
              ...b,
              status: newStatus,
              notes: notes || (isCurrentlyQuarantine ? 'Released from QA quarantine hold back to active stock' : 'Placed on QA quarantine hold'),
            }
          : b
      )
    );

    // Track in Undo Stack & Clear Redo Stack
    const historyItem: HoldHistoryItem = {
      id: `hold-op-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      batchId: targetBatch.batch_id,
      batchNumber: targetBatch.batch_number,
      productName: targetBatch.product_name,
      action: isCurrentlyQuarantine ? 'RELEASE' : 'HOLD',
      previousStatus: targetBatch.status,
      newStatus,
      timestamp: new Date().toISOString(),
      notes,
    };

    setHoldUndoStack((prev) => [historyItem, ...prev.slice(0, 49)]);
    setHoldRedoStack([]); // Clear redo stack on fresh action

    const txType: TransactionType = isCurrentlyQuarantine ? 'ADJUST' : 'QUARANTINE';
    const newTx: Transaction = {
      transaction_id: `tx-hold-${Date.now()}`,
      batch_id: targetBatch.batch_id,
      product_id: targetBatch.product_id,
      product_name: targetBatch.product_name,
      product_code: targetBatch.product_code,
      batch_number: targetBatch.batch_number,
      transaction_type: txType,
      quantity: targetBatch.quantity_current,
      previous_quantity: targetBatch.quantity_current,
      new_quantity: targetBatch.quantity_current,
      transaction_date: new Date().toISOString(),
      user_id: currentUser.user_id,
      user_name: currentUser.full_name,
      user_role: currentUser.role,
      reference_document: isCurrentlyQuarantine ? 'QA-RELEASE-ORDER' : 'QA-HOLD-ORDER',
      location_code: targetBatch.location_code,
      notes: notes || (isCurrentlyQuarantine ? 'Released from QA hold back to active stock (Undo Hold)' : 'Placed on QA quarantine hold (Hold)'),
      fifo_compliant: true,
    };

    setTransactions((prev) => [newTx, ...prev]);
    if (isCurrentlyQuarantine) {
      soundFx.playSuccessChime();
    } else {
      soundFx.playWarningAlert();
    }
    return { success: true, newStatus };
  };

  const toggleHoldBatch = quarantineBatch;

  // Undo Last Hold / Release Operation
  const undoHold = () => {
    if (holdUndoStack.length === 0) {
      return { success: false, message: 'No hold actions to undo.' };
    }

    const [lastOp, ...remainingUndo] = holdUndoStack;
    const targetBatch = batches.find((b) => b.batch_id === lastOp.batchId);
    if (!targetBatch) {
      setHoldUndoStack(remainingUndo);
      return { success: false, message: 'Target batch no longer exists.' };
    }

    const restoredStatus = lastOp.previousStatus;

    setBatches((prev) =>
      prev.map((b) =>
        b.batch_id === lastOp.batchId
          ? { ...b, status: restoredStatus }
          : b
      )
    );

    // Push to Redo Stack
    setHoldRedoStack((prev) => [lastOp, ...prev]);
    setHoldUndoStack(remainingUndo);

    const isReleasing = restoredStatus === 'active';
    const tx: Transaction = {
      transaction_id: `tx-undohold-${Date.now()}`,
      batch_id: targetBatch.batch_id,
      product_id: targetBatch.product_id,
      product_name: targetBatch.product_name,
      product_code: targetBatch.product_code,
      batch_number: targetBatch.batch_number,
      transaction_type: isReleasing ? 'ADJUST' : 'QUARANTINE',
      quantity: targetBatch.quantity_current,
      previous_quantity: targetBatch.quantity_current,
      new_quantity: targetBatch.quantity_current,
      transaction_date: new Date().toISOString(),
      user_id: currentUser.user_id,
      user_name: currentUser.full_name,
      user_role: currentUser.role,
      reference_document: 'UNDO-HOLD-AUDIT',
      location_code: targetBatch.location_code,
      notes: `[UNDO] Reverted hold status of Lot ${targetBatch.batch_number} back to ${restoredStatus.toUpperCase()}`,
      fifo_compliant: true,
    };
    setTransactions((prev) => [tx, ...prev]);
    soundFx.playSuccessChime();

    return {
      success: true,
      message: `Undid hold action on Lot ${targetBatch.batch_number} (Restored to ${restoredStatus.toUpperCase()}).`,
    };
  };

  // Redo Last Undone Hold / Release Operation
  const redoHold = () => {
    if (holdRedoStack.length === 0) {
      return { success: false, message: 'No hold actions to redo.' };
    }

    const [lastUndone, ...remainingRedo] = holdRedoStack;
    const targetBatch = batches.find((b) => b.batch_id === lastUndone.batchId);
    if (!targetBatch) {
      setHoldRedoStack(remainingRedo);
      return { success: false, message: 'Target batch no longer exists.' };
    }

    const reappliedStatus = lastUndone.newStatus;

    setBatches((prev) =>
      prev.map((b) =>
        b.batch_id === lastUndone.batchId
          ? { ...b, status: reappliedStatus }
          : b
      )
    );

    // Push back to Undo Stack
    setHoldUndoStack((prev) => [lastUndone, ...prev]);
    setHoldRedoStack(remainingRedo);

    const isReleasing = reappliedStatus === 'active';
    const tx: Transaction = {
      transaction_id: `tx-redohold-${Date.now()}`,
      batch_id: targetBatch.batch_id,
      product_id: targetBatch.product_id,
      product_name: targetBatch.product_name,
      product_code: targetBatch.product_code,
      batch_number: targetBatch.batch_number,
      transaction_type: isReleasing ? 'ADJUST' : 'QUARANTINE',
      quantity: targetBatch.quantity_current,
      previous_quantity: targetBatch.quantity_current,
      new_quantity: targetBatch.quantity_current,
      transaction_date: new Date().toISOString(),
      user_id: currentUser.user_id,
      user_name: currentUser.full_name,
      user_role: currentUser.role,
      reference_document: 'REDO-HOLD-AUDIT',
      location_code: targetBatch.location_code,
      notes: `[REDO] Re-applied ${lastUndone.action} on Lot ${targetBatch.batch_number} (${reappliedStatus.toUpperCase()})`,
      fifo_compliant: true,
    };
    setTransactions((prev) => [tx, ...prev]);
    soundFx.playSuccessChime();

    return {
      success: true,
      message: `Redid ${lastUndone.action} action on Lot ${targetBatch.batch_number} (${reappliedStatus.toUpperCase()}).`,
    };
  };

  // Dedicated Write-Off & Scrap Disposal
  const writeOffBatch = (params: {
    batchId: string;
    quantity?: number;
    reason: string;
    dispositionType?: 'EXPIRED_LOSS' | 'DAMAGED_SCRAP' | 'QA_REJECTED' | 'OBSOLETE_WRITE_OFF' | 'TEMP_EXCURSION' | 'PILFERAGE';
    salvageRecoveryInr?: number;
    witnessName?: string;
    referenceDoc?: string;
  }) => {
    const target = batches.find((b) => b.batch_id === params.batchId);
    if (!target) return { success: false, message: 'Batch not found in active inventory.' };

    const writeOffQty =
      params.quantity !== undefined && params.quantity > 0
        ? Math.min(params.quantity, target.quantity_current)
        : target.quantity_current;

    if (writeOffQty <= 0) {
      return { success: false, message: 'Invalid write-off quantity.' };
    }

    const remainingQty = target.quantity_current - writeOffQty;
    const grossLoss = writeOffQty * (target.unit_cost || 0);
    const salvage = params.salvageRecoveryInr || 0;
    const netLossInr = Math.max(0, grossLoss - salvage);
    const dispType = params.dispositionType || 'EXPIRED_LOSS';

    // Update location occupancy
    setLocations((prev) =>
      prev.map((l) =>
        l.location_code === target.location_code
          ? { ...l, current_occupancy: Math.max(0, l.current_occupancy - writeOffQty) }
          : l
      )
    );

    if (remainingQty <= 0) {
      // Full write-off: remove batch completely
      setBatches((prev) => prev.filter((b) => b.batch_id !== params.batchId));
      setAlerts((prev) => prev.filter((a) => a.batch_id !== params.batchId));
    } else {
      // Partial write-off: decrement quantity
      setBatches((prev) =>
        prev.map((b) =>
          b.batch_id === params.batchId
            ? { ...b, quantity_current: remainingQty }
            : b
        )
      );
    }

    // Log EXPIRE write-off transaction
    const writeOffTx: Transaction = {
      transaction_id: `tx-writeoff-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      batch_id: target.batch_id,
      product_id: target.product_id,
      product_name: target.product_name,
      product_code: target.product_code,
      batch_number: target.batch_number,
      transaction_type: 'EXPIRE',
      quantity: writeOffQty,
      previous_quantity: target.quantity_current,
      new_quantity: remainingQty,
      transaction_date: new Date().toISOString(),
      user_id: currentUser.user_id,
      user_name: currentUser.full_name,
      user_role: currentUser.role,
      reference_document: params.referenceDoc || `WO-${dispType}`,
      location_code: target.location_code,
      notes: `Write-Off [${dispType}]: ${params.reason} — Net Loss: ₹${netLossInr.toLocaleString('en-IN')}${
        salvage > 0 ? ` (Gross: ₹${grossLoss.toLocaleString('en-IN')}, Salvage: ₹${salvage.toLocaleString('en-IN')})` : ''
      }. Witness: ${params.witnessName || currentUser.full_name}`,
      fifo_compliant: true,
    };

    setTransactions((prev) => [writeOffTx, ...prev]);
    soundFx.playBarcodeBeep();

    logSecurityEvent({
      eventType: 'STOCK_WRITEOFF',
      description: `Material Write-Off: ${writeOffQty} ${target.unit_of_measure} of Lot ${target.batch_number} (${target.product_name}) decommissioned. Net loss: ₹${netLossInr.toLocaleString('en-IN')}`,
      userId: currentUser.user_id,
      userName: currentUser.full_name,
      userRole: currentUser.role,
      severity: 'WARNING',
    });

    return {
      success: true,
      writeOffQty,
      lossInr: netLossInr,
      message: `Successfully wrote off ${writeOffQty} ${target.unit_of_measure} of Lot ${target.batch_number} (Loss: ₹${netLossInr.toLocaleString('en-IN')}).`,
    };
  };

  // Relocate Batch
  const relocateBatch = (batchId: string, newLocationCode: string) => {
    const targetBatch = batches.find((b) => b.batch_id === batchId);
    if (!targetBatch) return { success: false, error: 'Batch not found.' };

    const oldLocation = targetBatch.location_code;
    setBatches((prev) =>
      prev.map((b) => (b.batch_id === batchId ? { ...b, location_code: newLocationCode } : b))
    );

    // Update location occupancies
    setLocations((prev) =>
      prev.map((loc) => {
        if (loc.location_code === oldLocation) {
          return { ...loc, current_occupancy: Math.max(0, loc.current_occupancy - targetBatch.quantity_current) };
        }
        if (loc.location_code === newLocationCode) {
          return { ...loc, current_occupancy: loc.current_occupancy + targetBatch.quantity_current };
        }
        return loc;
      })
    );

    const newTx: Transaction = {
      transaction_id: `tx-${Date.now()}`,
      batch_id: targetBatch.batch_id,
      product_id: targetBatch.product_id,
      product_name: targetBatch.product_name,
      product_code: targetBatch.product_code,
      batch_number: targetBatch.batch_number,
      transaction_type: 'RELOCATE',
      quantity: targetBatch.quantity_current,
      previous_quantity: targetBatch.quantity_current,
      new_quantity: targetBatch.quantity_current,
      transaction_date: new Date().toISOString(),
      user_id: currentUser.user_id,
      user_name: currentUser.full_name,
      user_role: currentUser.role,
      reference_document: 'TRANSFER-ORDER',
      location_code: newLocationCode,
      notes: `Relocated from ${oldLocation} to ${newLocationCode}`,
      fifo_compliant: true,
    };

    setTransactions((prev) => [newTx, ...prev]);
    soundFx.playBarcodeBeep();
    return { success: true };
  };

  // Split Batch / Lot Division
  const splitBatch = (params: {
    batchId: string;
    splitQuantity: number;
    newLocationCode?: string;
    notes?: string;
  }) => {
    const parent = batches.find((b) => b.batch_id === params.batchId);
    if (!parent) return { success: false, error: 'Parent batch lot not found.' };
    if (params.splitQuantity <= 0 || params.splitQuantity >= parent.quantity_current) {
      return { success: false, error: `Split quantity must be between 1 and ${parent.quantity_current - 1} units.` };
    }

    const remainingQty = parent.quantity_current - params.splitQuantity;
    const splitIndex = Math.floor(100 + Math.random() * 900);
    const newBatchNumber = `${parent.batch_number}-S${splitIndex}`;
    const newBarcode = `SPL-${parent.product_code}-${splitIndex}-${Date.now().toString().slice(-4)}`;
    const targetLoc = params.newLocationCode?.trim().toUpperCase() || parent.location_code;

    const childBatch: InventoryBatch = {
      ...parent,
      batch_id: `batch-${Date.now()}-split`,
      batch_number: newBatchNumber,
      barcode: newBarcode,
      quantity_received: params.splitQuantity,
      quantity_current: params.splitQuantity,
      location_code: targetLoc,
      notes: params.notes || `Sub-lot split from parent batch ${parent.batch_number}`,
    };

    // Update parent batch
    setBatches((prev) => [
      childBatch,
      ...prev.map((b) => (b.batch_id === parent.batch_id ? { ...b, quantity_current: remainingQty } : b)),
    ]);

    // If moved to new location, update destination occupancy
    if (targetLoc !== parent.location_code) {
      setLocations((prev) =>
        prev.map((loc) => {
          if (loc.location_code === parent.location_code) {
            return { ...loc, current_occupancy: Math.max(0, loc.current_occupancy - params.splitQuantity) };
          }
          if (loc.location_code === targetLoc) {
            return { ...loc, current_occupancy: loc.current_occupancy + params.splitQuantity };
          }
          return loc;
        })
      );
    }

    const newTx: Transaction = {
      transaction_id: `tx-${Date.now()}-split`,
      batch_id: childBatch.batch_id,
      product_id: childBatch.product_id,
      product_name: childBatch.product_name,
      product_code: childBatch.product_code,
      batch_number: childBatch.batch_number,
      transaction_type: 'ADJUST',
      quantity: params.splitQuantity,
      previous_quantity: parent.quantity_current,
      new_quantity: params.splitQuantity,
      transaction_date: new Date().toISOString(),
      user_id: currentUser.user_id,
      user_name: currentUser.full_name,
      user_role: currentUser.role,
      reference_document: `SPLIT-${parent.batch_number}`,
      location_code: targetLoc,
      notes: `Split ${params.splitQuantity} units from ${parent.batch_number} into new lot ${newBatchNumber}`,
      fifo_compliant: true,
    };

    setTransactions((prev) => [newTx, ...prev]);
    soundFx.playSuccessChime();
    return { success: true, newBatch: childBatch };
  };

  // Perform Cycle Count & Stock Variance Reconciliation
  const performCycleCount = (items: {
    batchId: string;
    physicalQty: number;
    notes?: string;
  }[]) => {
    let adjustedCount = 0;
    let varianceUnits = 0;
    const auditRef = `CYCLE-AUDIT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

    items.forEach((item) => {
      const target = batches.find((b) => b.batch_id === item.batchId);
      if (!target) return;
      const prevQty = target.quantity_current;
      const physical = Math.max(0, item.physicalQty);
      const diff = physical - prevQty;

      if (diff !== 0) {
        adjustedCount += 1;
        varianceUnits += diff;
        adjustStock({
          batchId: target.batch_id,
          newQuantity: physical,
          reason: 'ADJUST',
          referenceDocument: auditRef,
          notes: item.notes || `Cycle count audit variance (${diff > 0 ? '+' : ''}${diff} units physical vs book)`,
        });
      }
    });

    soundFx.playSuccessChime();
    return { success: true, adjustedCount, varianceUnits };
  };

  // Dispose or Return-To-Vendor (RTV) Batch
  const disposeOrRtvBatch = (params: {
    batchId: string;
    quantity: number;
    dispositionType: 'RTV_RETURN' | 'SCRAP_DESTRUCTION' | 'SALVAGE_CLEARANCE';
    referenceDocument: string;
    reason: string;
    vendorId?: string;
    salvageRecoveryInr?: number;
    witnessName?: string;
  }) => {
    const target = batches.find((b) => b.batch_id === params.batchId);
    if (!target) return { success: false, error: 'Batch not found.' };

    const qtyToDispose = Math.min(params.quantity, target.quantity_current);
    if (qtyToDispose <= 0) return { success: false, error: 'Disposition quantity must be greater than 0.' };

    const remaining = target.quantity_current - qtyToDispose;
    const txType: TransactionType = params.dispositionType === 'RTV_RETURN' ? 'OUT' : 'EXPIRE';

    const newTx: Transaction = {
      transaction_id: `tx-${Date.now()}-disp`,
      batch_id: target.batch_id,
      product_id: target.product_id,
      product_name: target.product_name,
      product_code: target.product_code,
      batch_number: target.batch_number,
      transaction_type: txType,
      quantity: qtyToDispose,
      previous_quantity: target.quantity_current,
      new_quantity: remaining,
      transaction_date: new Date().toISOString(),
      user_id: currentUser.user_id,
      user_name: currentUser.full_name,
      user_role: currentUser.role,
      reference_document: params.referenceDocument || `DISP-${params.dispositionType}`,
      location_code: target.location_code,
      notes: `Disposition [${params.dispositionType}]: ${params.reason}. Witness: ${params.witnessName || 'QA Lead'}. Salvage: ₹${params.salvageRecoveryInr || 0}`,
      fifo_compliant: true,
    };

    setBatches((prev) =>
      prev.map((b) =>
        b.batch_id === target.batch_id
          ? { ...b, quantity_current: remaining, status: remaining === 0 ? 'depleted' : b.status }
          : b
      )
    );

    setLocations((prev) =>
      prev.map((loc) =>
        loc.location_code === target.location_code
          ? { ...loc, current_occupancy: Math.max(0, loc.current_occupancy - qtyToDispose) }
          : loc
      )
    );

    setTransactions((prev) => [newTx, ...prev]);
    soundFx.playBarcodeBeep();
    return { success: true };
  };

  // Add Product
  const addProduct = (productData: Omit<Product, 'product_id' | 'created_at'>) => {
    const newProduct: Product = {
      ...productData,
      product_id: `prod-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setProducts((prev) => [...prev, newProduct]);
    return newProduct;
  };

  // Add Supplier
  const addSupplier = (supplierData: Omit<Supplier, 'supplier_id'>) => {
    const newSupplier: Supplier = {
      ...supplierData,
      supplier_id: `sup-${Date.now()}`,
    };
    setSuppliers((prev) => [...prev, newSupplier]);
    return newSupplier;
  };

  // Update Supplier
  const updateSupplier = (supplier: Supplier) => {
    setSuppliers((prev) => prev.map((s) => (s.supplier_id === supplier.supplier_id ? supplier : s)));
  };

  // Add Location
  const addLocation = (locationData: Omit<Location, 'location_id' | 'current_occupancy'>) => {
    const newLoc: Location = {
      ...locationData,
      location_id: `loc-${Date.now()}`,
      current_occupancy: 0,
    };
    setLocations((prev) => {
      // Check if location_code already exists, update or insert
      const exists = prev.some((l) => l.location_code === newLoc.location_code);
      if (exists) return prev;
      return [...prev, newLoc];
    });
    return newLoc;
  };

  // Update Location
  const updateLocation = (location: Location) => {
    setLocations((prev) => prev.map((l) => (l.location_id === location.location_id ? location : l)));
  };

  // Update Product
  const updateProduct = (product: Product) => {
    setProducts((prev) => prev.map((p) => (p.product_id === product.product_id ? product : p)));
  };

  // Delete Product (with safety cleanup)
  const deleteProduct = (productId: string) => {
    const prod = products.find((p) => p.product_id === productId);
    if (!prod) return { success: false, message: 'Product SKU not found.' };

    const hasActiveBatches = batches.some((b) => b.product_id === productId && b.quantity_current > 0);
    if (hasActiveBatches) {
      // Soft deletion / removal: remove SKU and archive batches
      setBatches((prev) => prev.filter((b) => b.product_id !== productId));
    }
    setProducts((prev) => prev.filter((p) => p.product_id !== productId));
    return { success: true, message: `Product "${prod.product_name}" removed successfully.` };
  };

  // Delete Supplier
  const deleteSupplier = (supplierId: string) => {
    const sup = suppliers.find((s) => s.supplier_id === supplierId);
    if (!sup) return { success: false, message: 'Supplier not found.' };

    setSuppliers((prev) => prev.filter((s) => s.supplier_id !== supplierId));
    return { success: true, message: `Supplier "${sup.supplier_name}" deleted.` };
  };

  // Delete Location
  const deleteLocation = (locationId: string) => {
    const loc = locations.find((l) => l.location_id === locationId);
    if (!loc) return { success: false, message: 'Location not found.' };

    setLocations((prev) => prev.filter((l) => l.location_id !== locationId));
    return { success: true, message: `Location "${loc.location_code}" deleted.` };
  };

  // Delete Batch (for reversing, write-off, or removing expired lots)
  const deleteBatch = (batchId: string, reason: string = 'Administrative lot deletion') => {
    const target = batches.find((b) => b.batch_id === batchId);
    if (!target) return { success: false, message: 'Batch not found.' };

    const isExp = target.status === 'expired' || new Date(target.expiry_date) < new Date() || reason.toLowerCase().includes('expire');
    const txType: TransactionType = isExp ? 'EXPIRE' : 'ADJUST';

    // Update location occupancy
    setLocations((prev) =>
      prev.map((l) =>
        l.location_code === target.location_code
          ? { ...l, current_occupancy: Math.max(0, l.current_occupancy - target.quantity_current) }
          : l
      )
    );

    // Remove batch completely
    setBatches((prev) => prev.filter((b) => b.batch_id !== batchId));

    // Clear alerts related to this batch
    setAlerts((prev) => prev.filter((a) => a.batch_id !== batchId));

    // Log deletion transaction
    const delTx: Transaction = {
      transaction_id: `tx-del-${Date.now()}`,
      batch_id: target.batch_id,
      product_id: target.product_id,
      product_name: target.product_name,
      product_code: target.product_code,
      batch_number: target.batch_number,
      transaction_type: txType,
      quantity: target.quantity_current,
      previous_quantity: target.quantity_current,
      new_quantity: 0,
      transaction_date: new Date().toISOString(),
      user_id: currentUser.user_id,
      user_name: currentUser.full_name,
      user_role: currentUser.role,
      reference_document: isExp ? 'EXPIRE-SCRAP-WRITEOFF' : 'ADMIN-LOT-DELETION',
      location_code: target.location_code,
      notes: isExp ? `Expired stock written off: ${reason}` : `Lot removed: ${reason}`,
      fifo_compliant: true,
    };
    setTransactions((prev) => [delTx, ...prev]);

    soundFx.playBarcodeBeep();
    return { success: true, message: `Batch ${target.batch_number} ${isExp ? 'written off as expired loss' : 'deleted'}.` };
  };

  // Reverse / Void a transaction (Restore stock)
  const reverseTransaction = (transactionId: string, reason: string = 'Outbound dispatch reversal / order cancellation') => {
    const tx = transactions.find((t) => t.transaction_id === transactionId);
    if (!tx) return { success: false, message: 'Transaction not found.' };

    if (tx.transaction_type === 'OUT') {
      const targetBatch = batches.find((b) => b.batch_id === tx.batch_id);
      if (targetBatch) {
        const restoredQty = targetBatch.quantity_current + tx.quantity;
        setBatches((prev) =>
          prev.map((b) =>
            b.batch_id === targetBatch.batch_id
              ? { ...b, quantity_current: restoredQty, status: 'active' }
              : b
          )
        );
        // Restore location occupancy
        setLocations((prev) =>
          prev.map((l) =>
            l.location_code === targetBatch.location_code
              ? { ...l, current_occupancy: l.current_occupancy + tx.quantity }
              : l
          )
        );
      } else {
        const prod = products.find((p) => p.product_id === tx.product_id);
        const restoredBatch: InventoryBatch = {
          batch_id: tx.batch_id,
          product_id: tx.product_id,
          product_name: tx.product_name,
          product_code: tx.product_code,
          category: prod?.category || 'General',
          batch_number: tx.batch_number,
          barcode: formatBarcodeString(tx.product_code, tx.batch_number, '2026-01-01'),
          quantity_received: tx.quantity,
          quantity_current: tx.quantity,
          unit_of_measure: prod?.unit_of_measure || 'units',
          manufacturing_date: '2026-01-01',
          expiry_date: '2026-12-31',
          received_date: new Date().toISOString().split('T')[0],
          supplier_id: 'SUP-REVERSED',
          supplier_name: 'Restored from Reversal',
          location_code: tx.location_code || 'A-01-1-01',
          status: 'active',
          unit_cost: prod?.unit_cost || 0,
          storage_type: prod?.storage_requirements || 'ambient',
          qc_passed: true,
        };
        setBatches((prev) => [restoredBatch, ...prev]);
      }

      // Log reversal transaction
      const revTx: Transaction = {
        transaction_id: `tx-rev-${Date.now()}`,
        batch_id: tx.batch_id,
        product_id: tx.product_id,
        product_name: tx.product_name,
        product_code: tx.product_code,
        batch_number: tx.batch_number,
        transaction_type: 'ADJUST',
        quantity: tx.quantity,
        previous_quantity: targetBatch ? targetBatch.quantity_current : 0,
        new_quantity: targetBatch ? targetBatch.quantity_current + tx.quantity : tx.quantity,
        transaction_date: new Date().toISOString(),
        user_id: currentUser.user_id,
        user_name: currentUser.full_name,
        user_role: currentUser.role,
        reference_document: `VOID-${tx.reference_document || tx.transaction_id}`,
        location_code: tx.location_code,
        notes: `Reversed transaction ${tx.transaction_id}. Reason: ${reason}`,
        fifo_compliant: true,
      };
      setTransactions((prev) => [revTx, ...prev]);
      return { success: true, message: `Dispatched quantity of ${tx.quantity} units has been successfully restored to stock.` };
    }

    return { success: false, message: `Cannot reverse transaction type ${tx.transaction_type}` };
  };

  // Smart FIFO Auto-Allocation Engine
  const allocateFIFOBatches = useCallback(
    (productId: string, requestedQuantity: number) => {
      const activeBatches = getBatchesForProductFIFO(productId);
      const allocations: { batch: InventoryBatch; pickQty: number; isOldest: boolean }[] = [];
      let remainingToPick = requestedQuantity;

      for (let i = 0; i < activeBatches.length; i++) {
        if (remainingToPick <= 0) break;
        const b = activeBatches[i];
        if (b.quantity_current <= 0) continue;
        const take = Math.min(b.quantity_current, remainingToPick);
        allocations.push({
          batch: b,
          pickQty: take,
          isOldest: i === 0,
        });
        remainingToPick -= take;
      }

      const allocatedQty = requestedQuantity - Math.max(0, remainingToPick);
      return {
        allocations,
        isFullFulfillment: remainingToPick <= 0,
        allocatedQty,
        unfulfilledQty: Math.max(0, remainingToPick),
      };
    },
    [getBatchesForProductFIFO]
  );

  // Barcode Finders
  const findBatchByBarcode = useCallback(
    (barcodeText: string): InventoryBatch | null => {
      const clean = barcodeText.trim().toUpperCase();
      return (
        batches.find(
          (b) =>
            b.barcode.toUpperCase() === clean ||
            b.batch_number.toUpperCase() === clean ||
            clean.includes(b.batch_number.toUpperCase())
        ) || null
      );
    },
    [batches]
  );

  const findProductByBarcodeOrCode = useCallback(
    (code: string): Product | null => {
      const clean = code.trim().toUpperCase();
      return (
        products.find(
          (p) => p.product_code.toUpperCase() === clean || p.product_name.toUpperCase().includes(clean)
        ) || null
      );
    },
    [products]
  );

  // Alerts
  const acknowledgeAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.alert_id === alertId ? { ...a, acknowledged: true, acknowledged_by: currentUser.full_name } : a))
    );
  };

  // Database Backup to File
  const exportDatabaseBackup = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dump = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      company: settings.company.name,
      products,
      batches,
      locations,
      transactions,
      suppliers,
      users,
      companies,
      settings,
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FIFO_WMS_Backup_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    soundFx.playSuccessChime();
  };

  // Restore Database Backup
  const restoreDatabaseBackup = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.products || !parsed.batches) {
        return { success: false, message: 'Invalid database backup structure.' };
      }
      setProducts(parsed.products);
      setBatches(parsed.batches);
      if (parsed.locations) setLocations(parsed.locations);
      if (parsed.transactions) setTransactions(parsed.transactions);
      if (parsed.suppliers) setSuppliers(parsed.suppliers);
      if (parsed.users) setUsers(parsed.users);
      if (parsed.companies) setCompanies(parsed.companies);
      if (parsed.settings) setSettings(parsed.settings);
      soundFx.playSuccessChime();
      return { success: true, message: 'Database successfully restored from disk snapshot.' };
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : 'Parse error';
      return { success: false, message: `Failed to restore database: ${err}` };
    }
  };

  // Admin Data Purge & Loss Accounting
  const purgeExpiredBatches = () => {
    const now = new Date();
    const expiredBatches = batches.filter(
      (b) => b.quantity_current > 0 && (b.status === 'expired' || new Date(b.expiry_date) < now)
    );

    if (expiredBatches.length === 0) {
      return { success: true, count: 0, totalLossInr: 0 };
    }

    let totalLoss = 0;
    const purgeTransactions: Transaction[] = [];

    expiredBatches.forEach((b) => {
      const loss = b.quantity_current * (b.unit_cost || 0);
      totalLoss += loss;
      purgeTransactions.push({
        transaction_id: `tx-purge-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        batch_id: b.batch_id,
        product_id: b.product_id,
        product_name: b.product_name,
        product_code: b.product_code,
        batch_number: b.batch_number,
        transaction_type: 'EXPIRE',
        quantity: b.quantity_current,
        previous_quantity: b.quantity_current,
        new_quantity: 0,
        transaction_date: new Date().toISOString(),
        user_id: currentUser.user_id,
        user_name: currentUser.full_name,
        user_role: currentUser.role,
        reference_document: 'ADMIN-EXPIRED-PURGE',
        location_code: b.location_code,
        notes: `Administrative purge of expired stock (${b.quantity_current} ${b.unit_of_measure})`,
        fifo_compliant: true,
      });
    });

    // Remove expired batches from active stock
    const expiredIds = new Set(expiredBatches.map((b) => b.batch_id));
    setBatches((prev) => prev.filter((b) => !expiredIds.has(b.batch_id)));

    // Clear location occupancies
    setLocations((prev) =>
      prev.map((loc) => {
        const purgedFromLoc = expiredBatches
          .filter((b) => b.location_code === loc.location_code)
          .reduce((sum, b) => sum + b.quantity_current, 0);
        return {
          ...loc,
          current_occupancy: Math.max(0, loc.current_occupancy - purgedFromLoc),
        };
      })
    );

    // Record EXPIRE transactions so expired loss is accurately preserved in audit ledger
    setTransactions((prev) => [...purgeTransactions, ...prev]);

    soundFx.playBarcodeBeep();
    return { success: true, count: expiredBatches.length, totalLossInr: totalLoss };
  };

  const purgeDepletedBatches = () => {
    const depleted = batches.filter((b) => b.quantity_current <= 0);
    setBatches((prev) => prev.filter((b) => b.quantity_current > 0));
    soundFx.playSuccessChime();
    return { success: true, count: depleted.length };
  };

  const clearTransactions = () => {
    setTransactions([]);
    soundFx.playSuccessChime();
    return { success: true, message: 'Transaction ledger cleared successfully.' };
  };

  // User Management
  const addUser = (userData: Omit<User, 'user_id'>): User => {
    const newUser: User = {
      ...userData,
      user_id: `usr-${Date.now()}`,
    };
    setUsers((prev) => [...prev, newUser]);
    soundFx.playSuccessChime();
    return newUser;
  };

  const updateUser = (updatedUser: User) => {
    setUsers((prev) => prev.map((u) => (u.user_id === updatedUser.user_id ? updatedUser : u)));
    if (currentUser.user_id === updatedUser.user_id) {
      setCurrentUser(updatedUser);
    }
    soundFx.playSuccessChime();
  };

  const deleteUser = (userId: string) => {
    if (users.length <= 1) {
      return { success: false, message: 'Cannot delete the only remaining user in system.' };
    }
    if (currentUser.user_id === userId) {
      return { success: false, message: 'Cannot delete the currently active logged in user.' };
    }
    setUsers((prev) => prev.filter((u) => u.user_id !== userId));
    return { success: true, message: 'User removed successfully.' };
  };

  // Company Management
  const addCompany = (compData: Omit<Company, 'company_id'>): Company => {
    const newComp: Company = {
      ...compData,
      company_id: `comp-${Date.now()}`,
    };
    setCompanies((prev) => [...prev, newComp]);
    soundFx.playSuccessChime();
    return newComp;
  };

  const updateCompany = (updatedCompany: Company) => {
    setCompanies((prev) => prev.map((c) => (c.company_id === updatedCompany.company_id ? updatedCompany : c)));
    
    // Check if this updated company is the current active company
    const isCurrentlyActive =
      settings.activeCompanyId === updatedCompany.company_id ||
      (!settings.activeCompanyId && (companies[0]?.company_id === updatedCompany.company_id || settings.company.name === updatedCompany.name));

    if (isCurrentlyActive) {
      setSettings((prev) => ({
        ...prev,
        activeCompanyId: updatedCompany.company_id,
        company: {
          ...prev.company,
          name: updatedCompany.name,
          warehouse_name: updatedCompany.warehouse_name,
          address: updatedCompany.address,
          gstin: updatedCompany.gstin,
          fssai_license: updatedCompany.fssai_license,
          contact_phone: updatedCompany.contact_phone,
          contact_email: updatedCompany.contact_email,
          logo_text: updatedCompany.logo_text || prev.company.logo_text,
        },
      }));
    }
    soundFx.playSuccessChime();
  };

  const deleteCompany = (companyId: string) => {
    if (companies.length <= 1) {
      return { success: false, message: 'Cannot delete the only registered company organization.' };
    }
    const target = companies.find((c) => c.company_id === companyId);
    const remaining = companies.filter((c) => c.company_id !== companyId);
    setCompanies(remaining);

    // If active company was deleted, automatically switch active company to the first remaining one
    if (settings.activeCompanyId === companyId || settings.company.name === target?.name) {
      const nextActive = remaining[0];
      setSettings((prev) => ({
        ...prev,
        activeCompanyId: nextActive.company_id,
        company: {
          name: nextActive.name,
          warehouse_name: nextActive.warehouse_name,
          address: nextActive.address,
          logo_text: nextActive.logo_text || prev.company.logo_text,
          gstin: nextActive.gstin,
          fssai_license: nextActive.fssai_license,
          contact_phone: nextActive.contact_phone,
          contact_email: nextActive.contact_email,
        },
      }));
    }

    soundFx.playSuccessChime();
    return { success: true, message: `Company "${target?.name || companyId}" deleted successfully.` };
  };

  const setActiveCompany = (companyId: string) => {
    const comp = companies.find((c) => c.company_id === companyId);
    if (!comp) return;
    setSettings((prev) => ({
      ...prev,
      activeCompanyId: comp.company_id,
      company: {
        name: comp.name,
        warehouse_name: comp.warehouse_name,
        address: comp.address,
        logo_text: comp.logo_text || prev.company.logo_text,
        gstin: comp.gstin,
        fssai_license: comp.fssai_license,
        contact_phone: comp.contact_phone,
        contact_email: comp.contact_email,
      },
    }));
    soundFx.playSuccessChime();
  };

  // Cybersecurity PIN Verification Engine with Brute-Force Rate Limiting
  const [pinLockoutUntil, setPinLockoutUntil] = useState<number>(0);
  const [failedPinAttempts, setFailedPinAttempts] = useState<number>(0);

  const [securityLogs, setSecurityLogs] = useState<SecurityEventLog[]>([
    {
      id: 'sec-001',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      eventType: 'AUTH_SUCCESS',
      description: 'System Admin session initialized (Rajesh Sharma)',
      userId: 'usr-1',
      userName: 'Rajesh Sharma (System Admin)',
      userRole: 'manager',
      severity: 'INFO',
    },
    {
      id: 'sec-002',
      timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
      eventType: 'SETTINGS_CHANGED',
      description: 'FIFO strict enforcement rules updated and verified',
      userId: 'usr-1',
      userName: 'Rajesh Sharma',
      userRole: 'manager',
      severity: 'INFO',
    },
  ]);

  const logSecurityEvent = useCallback((event: Omit<SecurityEventLog, 'id' | 'timestamp'>) => {
    const newLog: SecurityEventLog = {
      ...event,
      id: `sec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    };
    setSecurityLogs((prev) => [newLog, ...prev.slice(0, 99)]); // Keep last 100 security events
  }, []);

  const clearSecurityLogs = useCallback(() => {
    setSecurityLogs([]);
    soundFx.playSuccessChime();
  }, []);

  const verifyUserPin = useCallback(
    (params: {
      pin: string;
      userId?: string;
      requiredRole?: UserRole;
      requiredPermission?: 'can_override_fifo' | 'can_delete_records' | 'can_adjust_stock' | 'can_manage_settings';
    }): { success: boolean; user?: User; error?: string } => {
      const now = Date.now();
      if (now < pinLockoutUntil) {
        const secondsLeft = Math.ceil((pinLockoutUntil - now) / 1000);
        soundFx.playWarningAlert();
        logSecurityEvent({
          eventType: 'RATE_LIMIT_LOCKOUT',
          description: `Blocked attempt during active security lockout cooldown (${secondsLeft}s left)`,
          severity: 'CRITICAL',
        });
        return {
          success: false,
          error: `Security Lockout: Too many failed attempts. Please wait ${secondsLeft}s before retrying.`,
        };
      }

      const cleanPin = params.pin ? params.pin.trim() : '';
      if (!cleanPin) {
        return { success: false, error: 'Security PIN code is required.' };
      }

      let candidate: User | undefined;

      if (params.userId) {
        candidate = users.find((u) => u.user_id === params.userId && u.is_active);
        if (!candidate) {
          return { success: false, error: 'Specified user account not found or is inactive.' };
        }
        if ((candidate.pin_code || '1234') !== cleanPin) {
          const newFailed = failedPinAttempts + 1;
          setFailedPinAttempts(newFailed);
          soundFx.playWarningAlert();
          logSecurityEvent({
            eventType: 'AUTH_FAILED',
            description: `Failed PIN verification attempt for user ${candidate.full_name} (${candidate.username})`,
            userId: candidate.user_id,
            userName: candidate.full_name,
            userRole: candidate.role,
            severity: 'WARNING',
          });
          if (newFailed >= 5) {
            setPinLockoutUntil(Date.now() + 30000);
            setFailedPinAttempts(0);
            logSecurityEvent({
              eventType: 'RATE_LIMIT_LOCKOUT',
              description: `5 consecutive failed PIN attempts. Account locked out for 30s.`,
              userId: candidate.user_id,
              userName: candidate.full_name,
              userRole: candidate.role,
              severity: 'CRITICAL',
            });
            return { success: false, error: 'Security Lockout triggered: 5 consecutive failed PIN attempts. Cooldown: 30s.' };
          }
          return { success: false, error: `Invalid Security PIN for ${candidate.full_name}. (${5 - newFailed} attempts left)` };
        }
      } else {
        // Find matching active user with the PIN
        candidate = users.find((u) => u.is_active && (u.pin_code || '1234') === cleanPin);
        if (!candidate) {
          const newFailed = failedPinAttempts + 1;
          setFailedPinAttempts(newFailed);
          soundFx.playWarningAlert();
          logSecurityEvent({
            eventType: 'AUTH_FAILED',
            description: `Unrecognized Security PIN code attempt`,
            severity: 'WARNING',
          });
          if (newFailed >= 5) {
            setPinLockoutUntil(Date.now() + 30000);
            setFailedPinAttempts(0);
            logSecurityEvent({
              eventType: 'RATE_LIMIT_LOCKOUT',
              description: `5 consecutive failed PIN attempts. System entered security cooldown.`,
              severity: 'CRITICAL',
            });
            return { success: false, error: 'Security Lockout triggered: 5 consecutive failed PIN attempts. Cooldown: 30s.' };
          }
          return { success: false, error: `Authentication Failed: Unrecognized Security PIN code. (${5 - newFailed} attempts left)` };
        }
      }

      // Check required role or permission
      if (params.requiredRole && candidate.role !== params.requiredRole && candidate.role !== 'manager') {
        soundFx.playWarningAlert();
        logSecurityEvent({
          eventType: 'AUTH_FAILED',
          description: `Access Denied: ${candidate.full_name} lacks required role ${params.requiredRole.toUpperCase()}`,
          userId: candidate.user_id,
          userName: candidate.full_name,
          userRole: candidate.role,
          severity: 'WARNING',
        });
        return {
          success: false,
          error: `Access Denied: ${candidate.full_name} (${candidate.role.toUpperCase()}) does not hold ${params.requiredRole.toUpperCase()} authority.`,
        };
      }

      if (params.requiredPermission) {
        const isManager = candidate.role === 'manager';
        const hasPerm = Boolean(candidate[params.requiredPermission]);
        if (!isManager && !hasPerm) {
          soundFx.playWarningAlert();
          logSecurityEvent({
            eventType: 'AUTH_FAILED',
            description: `Access Denied: ${candidate.full_name} lacks required privilege ${params.requiredPermission}`,
            userId: candidate.user_id,
            userName: candidate.full_name,
            userRole: candidate.role,
            severity: 'WARNING',
          });
          return {
            success: false,
            error: `Access Denied: ${candidate.full_name} is not authorized for this operation.`,
          };
        }
      }

      // Successful verification
      setFailedPinAttempts(0);
      soundFx.playSuccessChime();
      logSecurityEvent({
        eventType: 'AUTH_SUCCESS',
        description: `PIN Verified for ${candidate.full_name} (${candidate.role.toUpperCase()})`,
        userId: candidate.user_id,
        userName: candidate.full_name,
        userRole: candidate.role,
        severity: 'INFO',
      });
      return { success: true, user: candidate };
    },
    [users, pinLockoutUntil, failedPinAttempts, logSecurityEvent]
  );

  const resetToDefaultData = () => {
    setProducts(INITIAL_PRODUCTS);
    setBatches(INITIAL_BATCHES);
    setLocations(INITIAL_LOCATIONS);
    setTransactions(INITIAL_TRANSACTIONS);
    setSuppliers(INITIAL_SUPPLIERS);
    setUsers(INITIAL_USERS);
    setCompanies(INITIAL_COMPANIES);
    setCurrentUser(INITIAL_USERS[0]);
    setSettings(INITIAL_SETTINGS);
    logSecurityEvent({
      eventType: 'FACTORY_RESET',
      description: 'Database reset to factory default seed data by Administrator',
      severity: 'CRITICAL',
    });
    soundFx.playSuccessChime();
  };

  return (
    <InventoryContext.Provider
      value={{
        products,
        batches,
        locations,
        transactions,
        suppliers,
        users,
        companies,
        currentUser,
        settings,
        alerts,
        securityLogs,
        activeTab,
        scannerOpen,
        selectedBatchForDetail,
        prefilledReceiptProduct,
        prefilledReorderQty,
        writeOffTargetBatch,
        holdHistory: holdUndoStack,
        canUndoHold: holdUndoStack.length > 0,
        canRedoHold: holdRedoStack.length > 0,
        lastHoldAction: holdUndoStack[0] || null,
        undoHold,
        redoHold,
        setActiveTab,
        setCurrentUser,
        setScannerOpen,
        setSelectedBatchForDetail,
        setPrefilledReceiptProduct,
        setWriteOffTargetBatch,
        updateSettings,
        logSecurityEvent,
        clearSecurityLogs,
        addUser,
        updateUser,
        deleteUser,
        addCompany,
        updateCompany,
        deleteCompany,
        setActiveCompany,
        receiveGoods,
        validateFIFOPick,
        pickGoods,
        adjustStock,
        quarantineBatch,
        toggleHoldBatch,
        writeOffBatch,
        relocateBatch,
        splitBatch,
        performCycleCount,
        disposeOrRtvBatch,
        addProduct,
        updateProduct,
        deleteProduct,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        addLocation,
        updateLocation,
        deleteLocation,
        deleteBatch,
        reverseTransaction,
        findBatchByBarcode,
        findProductByBarcodeOrCode,
        acknowledgeAlert,
        exportDatabaseBackup,
        restoreDatabaseBackup,
        resetToDefaultData,
        purgeExpiredBatches,
        purgeDepletedBatches,
        clearTransactions,
        getBatchesForProductFIFO,
        allocateFIFOBatches,
        verifyUserPin,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
