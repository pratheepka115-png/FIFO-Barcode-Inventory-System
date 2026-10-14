import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Settings,
  Building,
  Users,
  ShieldCheck,
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  VolumeX,
  Printer,
  QrCode,
  Tag,
  IndianRupee,
  Layers,
  Check,
  X,
  MapPin,
  FileText,
  Sliders,
  Edit2,
  Save,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Company, User, UserRole, StorageType, Location } from '../types/inventory';
import { soundFx } from '../utils/sound';

export const SettingsModal: React.FC = () => {
  const {
    companies,
    users,
    locations,
    batches,
    transactions,
    currentUser,
    setCurrentUser,
    settings,
    updateSettings,
    addUser,
    updateUser,
    deleteUser,
    addCompany,
    updateCompany,
    deleteCompany,
    setActiveCompany,
    addLocation,
    deleteLocation,
    exportDatabaseBackup,
    restoreDatabaseBackup,
    resetToDefaultData,
    purgeExpiredBatches,
    purgeDepletedBatches,
    clearTransactions,
  } = useInventory();

  // Active Navigation Tab
  const [activeTab, setActiveSection] = useState<'company' | 'users' | 'bin_locations' | 'fifo_rules' | 'barcode_challan' | 'backup'>('company');

  // Status feedback
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // 1. ACTIVE COMPANY FORM STATE
  const [companyName, setCompanyName] = useState<string>(settings.company?.name || '');
  const [companyWarehouse, setCompanyWarehouse] = useState<string>(settings.company?.warehouse_name || '');
  const [companyAddress, setCompanyAddress] = useState<string>(settings.company?.address || '');
  const [companyGstin, setCompanyGstin] = useState<string>(settings.company?.gstin || '');
  const [companyFssai, setCompanyFssai] = useState<string>(settings.company?.fssai_license || '');
  const [companyEmail, setCompanyEmail] = useState<string>(settings.company?.contact_email || '');
  const [companyPhone, setCompanyPhone] = useState<string>(settings.company?.contact_phone || '');
  const [companyLogoText, setCompanyLogoText] = useState<string>(settings.company?.logo_text || '');

  // Keep active company form in sync
  useEffect(() => {
    setCompanyName(settings.company?.name || '');
    setCompanyWarehouse(settings.company?.warehouse_name || '');
    setCompanyAddress(settings.company?.address || '');
    setCompanyGstin(settings.company?.gstin || '');
    setCompanyFssai(settings.company?.fssai_license || '');
    setCompanyEmail(settings.company?.contact_email || '');
    setCompanyPhone(settings.company?.contact_phone || '');
    setCompanyLogoText(settings.company?.logo_text || '');
  }, [settings.company, settings.activeCompanyId]);

  // Modals for Company
  const [showAddCompanyModal, setShowAddCompanyModal] = useState<boolean>(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deleteConfirmCompany, setDeleteConfirmCompany] = useState<Company | null>(null);

  const [newCompanyName, setNewCompanyName] = useState<string>('');
  const [newCompanyCode, setNewCompanyCode] = useState<string>('');
  const [newCompanyGstin, setNewCompanyGstin] = useState<string>('');
  const [newCompanyFssai, setNewCompanyFssai] = useState<string>('');
  const [newCompanyWarehouse, setNewCompanyWarehouse] = useState<string>('Main Distribution Hub');
  const [newCompanyAddress, setNewCompanyAddress] = useState<string>('');
  const [newCompanyEmail, setNewCompanyEmail] = useState<string>('');
  const [newCompanyPhone, setNewCompanyPhone] = useState<string>('');

  // 2. USER STATE & MODALS
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);

  const [newFullName, setNewFullName] = useState<string>('');
  const [newUsername, setNewUsername] = useState<string>('');
  const [newRole, setNewRole] = useState<UserRole>('staff');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newDepartment, setNewDepartment] = useState<string>('Outbound Dispatch');
  const [newAssignedZone, setNewAssignedZone] = useState<string>('Section A - Ambient Dry');

  // 3. BIN LOCATIONS STATE & MODALS
  const [showAddLocModal, setShowAddLocModal] = useState<boolean>(false);
  const [deleteConfirmLocation, setDeleteConfirmLocation] = useState<Location | null>(null);
  const [newLocCode, setNewLocCode] = useState<string>('');
  const [newLocSection, setNewLocSection] = useState<string>('A');
  const [newLocAisle, setNewLocAisle] = useState<string>('01');
  const [newLocStorage, setNewLocStorage] = useState<StorageType>('ambient');
  const [newLocCapacity, setNewLocCapacity] = useState<number>(200);

  // 4. FIFO & OPERATIONAL RULES STATE
  const [strictEnforcement, setStrictEnforcement] = useState<boolean>(
    settings.fifo_rules?.strict_enforcement ?? true
  );
  const [allowSupervisorOverride, setAllowSupervisorOverride] = useState<boolean>(
    settings.fifo_rules?.allow_supervisor_override ?? true
  );
  const [autoQuarantineExpired, setAutoQuarantineExpired] = useState<boolean>(
    settings.fifo_rules?.auto_quarantine_expired ?? true
  );
  const [urgentDays, setUrgentDays] = useState<number>(
    settings.fifo_rules?.highlight_urgent_days ?? 7
  );

  // 5. SHELF LIFE THRESHOLDS
  const [greenPct, setGreenPct] = useState<number>(settings.shelf_life_thresholds?.green_percentage ?? 30);
  const [yellowPct, setYellowPct] = useState<number>(settings.shelf_life_thresholds?.yellow_percentage ?? 15);
  const [orangePct, setOrangePct] = useState<number>(settings.shelf_life_thresholds?.orange_percentage ?? 5);

  // 6. BARCODE & CHALLAN TEMPLATES
  const [barcodeFormat, setBarcodeFormat] = useState<string>(settings.barcode?.format || 'CODE128');
  const [labelTitleMode, setLabelTitleMode] = useState<string>(settings.label_template?.label_title_mode || 'product_name');
  const [customTitle, setCustomTitle] = useState<string>(settings.label_template?.custom_title_text || '');
  const [showPriceInr, setShowPriceInr] = useState<boolean>(settings.label_template?.show_price_inr ?? true);
  const [showQr, setShowQr] = useState<boolean>(settings.label_template?.show_qr ?? false);
  const [challanPrefix, setChallanPrefix] = useState<string>(settings.challan_settings?.challan_prefix || 'DC-FIFO-');
  const [challanTerms, setChallanTerms] = useState<string>(settings.challan_settings?.terms_conditions || '');
  const [signatoryTitle, setSignatoryTitle] = useState<string>(settings.challan_settings?.authorized_signatory_title || 'Head of Warehouse Operations');

  // 7. BACKUP & FACTORY RESET
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setErrorMessage('');
    soundFx.playSuccessChime();
    setTimeout(() => setFeedbackMessage(''), 4000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    soundFx.playWarningBuzz();
  };

  // ACTIVE COMPANY SAVE HANDLER
  const handleSaveActiveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      showError('Company Legal Name cannot be empty.');
      return;
    }

    const trimmedName = companyName.trim();
    const trimmedWarehouse = companyWarehouse.trim() || 'Main Distribution Hub';
    const trimmedAddress = companyAddress.trim() || 'Logistics Hub, India';
    const trimmedGstin = companyGstin.trim();
    const trimmedFssai = companyFssai.trim();
    const trimmedEmail = companyEmail.trim();
    const trimmedPhone = companyPhone.trim();
    const trimmedLogoText = companyLogoText.trim() || trimmedName;

    updateSettings({
      company: {
        name: trimmedName,
        warehouse_name: trimmedWarehouse,
        address: trimmedAddress,
        gstin: trimmedGstin,
        fssai_license: trimmedFssai,
        contact_email: trimmedEmail,
        contact_phone: trimmedPhone,
        logo_text: trimmedLogoText,
      },
    });

    const activeComp = companies.find((c) => c.company_id === settings.activeCompanyId) || companies[0];
    if (activeComp) {
      updateCompany({
        ...activeComp,
        name: trimmedName,
        warehouse_name: trimmedWarehouse,
        address: trimmedAddress,
        gstin: trimmedGstin,
        fssai_license: trimmedFssai,
        contact_email: trimmedEmail,
        contact_phone: trimmedPhone,
        logo_text: trimmedLogoText,
      });
    }

    showFeedback('Company Profile and Header Name saved successfully.');
  };

  // ADD / EDIT COMPANY
  const handleSaveCompanyEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) {
      showError('Company Name is required.');
      return;
    }

    if (editingCompany) {
      updateCompany({
        ...editingCompany,
        name: newCompanyName.trim(),
        code: newCompanyCode.trim() || editingCompany.code,
        gstin: newCompanyGstin.trim(),
        fssai_license: newCompanyFssai.trim(),
        warehouse_name: newCompanyWarehouse.trim() || 'Main Distribution Hub',
        address: newCompanyAddress.trim(),
        contact_email: newCompanyEmail.trim(),
        contact_phone: newCompanyPhone.trim(),
      });
      showFeedback(`Company "${newCompanyName}" updated.`);
    } else {
      const created = addCompany({
        name: newCompanyName.trim(),
        code: newCompanyCode.trim() || `COMP-${Date.now().toString().slice(-4)}`,
        gstin: newCompanyGstin.trim(),
        fssai_license: newCompanyFssai.trim(),
        warehouse_name: newCompanyWarehouse.trim() || 'Main Distribution Hub',
        address: newCompanyAddress.trim(),
        contact_email: newCompanyEmail.trim(),
        contact_phone: newCompanyPhone.trim(),
        logo_text: newCompanyName.trim(),
        is_active: true,
      });
      showFeedback(`Company "${created.name}" registered.`);
    }

    setShowAddCompanyModal(false);
    setEditingCompany(null);
  };

  const executeDeleteCompany = () => {
    if (!deleteConfirmCompany) return;
    const res = deleteCompany(deleteConfirmCompany.company_id);
    if (res.success) {
      showFeedback(res.message || 'Company deleted successfully.');
      setDeleteConfirmCompany(null);
    } else {
      showError(res.message || 'Failed to delete company.');
    }
  };

  // USER SAVE HANDLER
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim()) {
      showError('Full Name is required.');
      return;
    }

    if (editingUser) {
      updateUser({
        ...editingUser,
        full_name: newFullName.trim(),
        username: newUsername.trim() || editingUser.username,
        role: newRole,
        email: newEmail.trim(),
        phone: newPhone.trim(),
        department: newDepartment.trim(),
        assigned_zone: newAssignedZone.trim(),
      });
      showFeedback(`User "${newFullName}" updated.`);
    } else {
      addUser({
        username: newUsername.trim() || newFullName.toLowerCase().replace(/\s+/g, '.'),
        full_name: newFullName.trim(),
        role: newRole,
        email: newEmail.trim() || 'user@abclogistics.in',
        phone: newPhone.trim() || '+91 98000 00000',
        is_active: true,
        department: newDepartment.trim(),
        assigned_zone: newAssignedZone.trim(),
        pin_code: '1234',
        can_override_fifo: newRole === 'manager' || newRole === 'supervisor',
        can_delete_records: newRole === 'manager',
        can_adjust_stock: true,
        can_manage_settings: newRole === 'manager',
      });
      showFeedback(`User "${newFullName}" created.`);
    }

    setShowAddUserModal(false);
    setEditingUser(null);
  };

  const executeDeleteUser = () => {
    if (!deleteConfirmUser) return;
    deleteUser(deleteConfirmUser.user_id);
    showFeedback(`User "${deleteConfirmUser.full_name}" deleted.`);
    setDeleteConfirmUser(null);
  };

  // LOCATION SAVE HANDLER
  const handleSaveLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocCode.trim()) return;

    addLocation({
      location_code: newLocCode.trim().toUpperCase(),
      section: newLocSection,
      aisle: newLocAisle,
      rack: 1,
      position: 1,
      storage_type: newLocStorage,
      capacity_units: newLocCapacity,
    });

    showFeedback(`Bin "${newLocCode}" added.`);
    setShowAddLocModal(false);
    setNewLocCode('');
  };

  const executeDeleteLocation = () => {
    if (!deleteConfirmLocation) return;
    deleteLocation(deleteConfirmLocation.location_id);
    showFeedback(`Location "${deleteConfirmLocation.location_code}" deleted.`);
    setDeleteConfirmLocation(null);
  };

  // FIFO RULES SAVE
  const handleSaveFifoRules = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      fifo_rules: {
        strict_enforcement: strictEnforcement,
        allow_supervisor_override: allowSupervisorOverride,
        auto_quarantine_expired: autoQuarantineExpired,
        highlight_urgent_days: urgentDays,
      },
      shelf_life_thresholds: {
        green_percentage: greenPct,
        yellow_percentage: yellowPct,
        orange_percentage: orangePct,
        red_percentage: 0,
      },
    });
    showFeedback('FIFO Operational Rules & Shelf-life thresholds updated.');
  };

  // BARCODE & CHALLAN SAVE
  const handleSaveBarcodeSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      barcode: {
        ...settings.barcode,
        format: barcodeFormat as 'CODE128' | 'EAN13' | 'QR',
      },
      label_template: {
        ...settings.label_template,
        label_title_mode: labelTitleMode as any,
        custom_title_text: customTitle,
        show_price_inr: showPriceInr,
        show_qr: showQr,
      },
      challan_settings: {
        challan_prefix: challanPrefix,
        terms_conditions: challanTerms,
        authorized_signatory_title: signatoryTitle,
        show_gst_breakdown: true,
      },
    });
    showFeedback('Thermal barcode label and Delivery Challan format saved.');
  };

  // Restore file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = restoreDatabaseBackup(content);
      if (res.success) {
        showFeedback(res.message);
      } else {
        showError(res.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const executeFactoryReset = () => {
    resetToDefaultData();
    setShowResetConfirm(false);
    showFeedback('Database has been reset to factory seed data.');
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 text-xs font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-2xs">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              Enterprise Settings & System Administration
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage company profile, organization legal entities, user team, custom bin locations, and FIFO operational policies.
          </p>
        </div>

        {/* Current Active Company Badge */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs flex items-center gap-2 shadow-2xs">
            <Building className="w-3.5 h-3.5 text-slate-600" />
            <div className="text-left">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Active Company</span>
              <span className="font-bold text-slate-900">{settings.company?.name || 'ABC Logistics & Supply Chain'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Toast Messages */}
      {feedbackMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{feedbackMessage}</span>
          </div>
          <button onClick={() => setFeedbackMessage('')} className="text-emerald-400 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section Navigation Tabs */}
      <div className="flex items-center space-x-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSection('company')}
          className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'company'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Company & Facilities ({companies.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('users')}
          className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'users'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Users & Staff ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('bin_locations')}
          className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'bin_locations'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Custom Bin Matrix ({locations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('fifo_rules')}
          className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'fifo_rules'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>FIFO & Shelf-Life Rules</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('barcode_challan')}
          className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'barcode_challan'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Labels & Delivery Challan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('backup')}
          className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'backup'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span>Database & Reset</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: COMPANY & FACILITIES
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'company' && (
        <div className="space-y-6">
          {/* Active Company Edit Form */}
          <form onSubmit={handleSaveActiveCompany} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Active Company Profile & Header Branding</h3>
                <p className="text-[11px] text-slate-500">
                  This company name appears on the top-left navigation bar, Delivery Challans, and barcode tags.
                </p>
              </div>
              <button
                type="submit"
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-2xs transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Company Profile</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Company Legal Name *</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. ABC Logistics & Supply Chain"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Warehouse Facility Name</label>
                <input
                  type="text"
                  value={companyWarehouse}
                  onChange={(e) => setCompanyWarehouse(e.target.value)}
                  placeholder="e.g. Main Distribution Hub"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Warehouse Facility Address</label>
                <input
                  type="text"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="e.g. Plot 42, Logistics Park, Sector 18, Navi Mumbai, Maharashtra 400705"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">GSTIN Number</label>
                <input
                  type="text"
                  value={companyGstin}
                  onChange={(e) => setCompanyGstin(e.target.value)}
                  placeholder="e.g. 27AABCU9603R1ZM"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono-code focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">FSSAI License / Reg No.</label>
                <input
                  type="text"
                  value={companyFssai}
                  onChange={(e) => setCompanyFssai(e.target.value)}
                  placeholder="e.g. 10019022009876"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono-code focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  placeholder="warehouse.ops@abclogistics.in"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  placeholder="+91 98200 12345"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none"
                />
              </div>
            </div>
          </form>

          {/* Registered Company Entities Registry */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Multi-Entity Company Registry</h3>
                <p className="text-[11px] text-slate-500">
                  Switch or manage different operating legal entities and facility profiles.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingCompany(null);
                  setNewCompanyName('');
                  setNewCompanyCode('');
                  setNewCompanyGstin('');
                  setNewCompanyFssai('');
                  setNewCompanyWarehouse('Main Distribution Hub');
                  setNewCompanyAddress('');
                  setNewCompanyEmail('');
                  setNewCompanyPhone('');
                  setShowAddCompanyModal(true);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Legal Entity</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {companies.map((c) => {
                const isActive = (settings.activeCompanyId || companies[0]?.company_id) === c.company_id;
                return (
                  <div
                    key={c.company_id}
                    className={`p-4 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-emerald-50/40 border-emerald-400 shadow-2xs'
                        : 'bg-white border-slate-200'
                    } space-y-2 text-xs`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono-code text-slate-400 block">{c.code}</span>
                        <h4 className="font-bold text-slate-900 text-sm">{c.name}</h4>
                      </div>
                      {isActive ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
                          ACTIVE
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCompany(c.company_id);
                            showFeedback(`Switched active entity to "${c.name}".`);
                          }}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold"
                        >
                          Switch
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">{c.warehouse_name} · {c.address}</p>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono-code">
                      <span>GST: {c.gstin || 'N/A'}</span>
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCompany(c);
                            setNewCompanyName(c.name);
                            setNewCompanyCode(c.code);
                            setNewCompanyGstin(c.gstin || '');
                            setNewCompanyFssai(c.fssai_license || '');
                            setNewCompanyWarehouse(c.warehouse_name || '');
                            setNewCompanyAddress(c.address || '');
                            setNewCompanyEmail(c.contact_email || '');
                            setNewCompanyPhone(c.contact_phone || '');
                            setShowAddCompanyModal(true);
                          }}
                          className="p-1 text-slate-500 hover:text-slate-800"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {companies.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmCompany(c)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: USERS & STAFF
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Warehouse Personnel & Role Assignments</span>
            <button
              onClick={() => {
                setEditingUser(null);
                setNewFullName('');
                setNewUsername('');
                setNewRole('staff');
                setNewEmail('');
                setNewPhone('');
                setShowAddUserModal(true);
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Staff User</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left font-mono-code text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Username</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {users.map((u) => (
                  <tr key={u.user_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">{u.full_name}</td>
                    <td className="py-2.5 px-3 text-slate-600">{u.username}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 capitalize">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-600">{u.department || 'Warehouse'}</td>
                    <td className="py-2.5 px-3 text-slate-500">{u.email}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUser(u);
                            setNewFullName(u.full_name);
                            setNewUsername(u.username);
                            setNewRole(u.role);
                            setNewEmail(u.email || '');
                            setNewPhone(u.phone || '');
                            setNewDepartment(u.department || '');
                            setNewAssignedZone(u.assigned_zone || '');
                            setShowAddUserModal(true);
                          }}
                          className="p-1 text-slate-500 hover:text-slate-800"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {users.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmUser(u)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 3: BIN MATRIX
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'bin_locations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Bin Locations Configuration</span>
            <button
              onClick={() => {
                setNewLocCode(`A-${Math.floor(10 + Math.random() * 90)}-1-01`);
                setShowAddLocModal(true);
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Bin Location</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left font-mono-code text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Bin Code</th>
                  <th className="py-2.5 px-3">Section</th>
                  <th className="py-2.5 px-3">Aisle</th>
                  <th className="py-2.5 px-3">Storage Type</th>
                  <th className="py-2.5 px-3 text-right">Occupancy / Capacity</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {locations.map((l) => (
                  <tr key={l.location_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{l.location_code}</td>
                    <td className="py-2.5 px-3">{l.section}</td>
                    <td className="py-2.5 px-3">{l.aisle}</td>
                    <td className="py-2.5 px-3 capitalize text-slate-600">{l.storage_type}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {l.current_occupancy} / {l.capacity_units || 100} units
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmLocation(l)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
          TAB 4: FIFO RULES
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'fifo_rules' && (
        <form onSubmit={handleSaveFifoRules} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">FIFO Policies & Expiry Threshold Parameters</h3>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-2xs"
            >
              Save Operational Rules
            </button>
          </div>

          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={strictEnforcement}
                onChange={(e) => setStrictEnforcement(e.target.checked)}
                className="mt-1 rounded text-slate-900"
              />
              <div>
                <span className="font-bold text-slate-900 text-xs block">Strict FIFO / FEFO Enforcement</span>
                <span className="text-[11px] text-slate-500">Require floor operators to pick the oldest lot first or trigger supervisor override modal.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowSupervisorOverride}
                onChange={(e) => setAllowSupervisorOverride(e.target.checked)}
                className="mt-1 rounded text-slate-900"
              />
              <div>
                <span className="font-bold text-slate-900 text-xs block">Allow Supervisor Audit Overrides</span>
                <span className="text-[11px] text-slate-500">Enable authorized supervisors to approve non-FIFO dispatches with a reason.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoQuarantineExpired}
                onChange={(e) => setAutoQuarantineExpired(e.target.checked)}
                className="mt-1 rounded text-slate-900"
              />
              <div>
                <span className="font-bold text-slate-900 text-xs block">Auto-Hold Expired Lots in Quarantine</span>
                <span className="text-[11px] text-slate-500">Prevent picking of lots past their expiration date.</span>
              </div>
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h4 className="font-bold text-slate-900 text-xs mb-3">Shelf-Life Percentage Thresholds</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Green Zone (&gt; %)</label>
                <input
                  type="number"
                  value={greenPct}
                  onChange={(e) => setGreenPct(parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Yellow Zone (&lt; %)</label>
                <input
                  type="number"
                  value={yellowPct}
                  onChange={(e) => setYellowPct(parseInt(e.target.value) || 15)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Orange Alert (&lt; %)</label>
                <input
                  type="number"
                  value={orangePct}
                  onChange={(e) => setOrangePct(parseInt(e.target.value) || 5)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 5: LABELS & DELIVERY CHALLAN
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'barcode_challan' && (
        <form onSubmit={handleSaveBarcodeSettings} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Thermal Barcode Tag & Delivery Challan Format</h3>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-2xs"
            >
              Save Template Settings
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Barcode Standard</label>
              <select
                value={barcodeFormat}
                onChange={(e) => setBarcodeFormat(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none"
              >
                <option value="CODE128">Code 128 (High Density 1D)</option>
                <option value="QR">QR Code (2D DataMatrix)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Delivery Challan Prefix</label>
              <input
                type="text"
                value={challanPrefix}
                onChange={(e) => setChallanPrefix(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono-code focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Challan Terms & Conditions</label>
              <textarea
                rows={3}
                value={challanTerms}
                onChange={(e) => setChallanTerms(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none"
              />
            </div>
          </div>
        </form>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 6: DATABASE BACKUP & FACTORY RESET
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'backup' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Database Backup, Migration & Factory Reset</h3>
            <p className="text-[11px] text-slate-500">
              Export complete warehouse inventory snapshot to JSON, restore previous archives, or reset data.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 text-xs">Export JSON Database Backup</h4>
              <p className="text-[11px] text-slate-500">Download entire inventory, transactions, users, and settings snapshot.</p>
              <button
                type="button"
                onClick={exportDatabaseBackup}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Backup</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 text-xs">Restore from Backup File</h4>
              <p className="text-[11px] text-slate-500">Import a previously exported JSON backup file.</p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload JSON Archive</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200 space-y-2">
              <h4 className="font-bold text-rose-900 text-xs">Factory Seed Data Reset</h4>
              <p className="text-[11px] text-rose-700">Restore factory sample products, batches, and locations.</p>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Database</span>
              </button>
            </div>
          </div>

          {/* Admin Clean Up & Purge Tools */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-slate-700" />
              <span>Admin Data Purge & Loss Accounting</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-xs">Purge Expired Stock</span>
                  <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                    {batches.filter((b) => b.quantity_current > 0 && (b.status === 'expired' || new Date(b.expiry_date) < new Date())).length} Lots
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Permanently deletes all expired lots, frees bin space, and posts financial write-off loss to audit ledger.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const res = purgeExpiredBatches();
                    if (res.count > 0) {
                      showFeedback(`Purged ${res.count} expired lots. Total ₹${res.totalLossInr.toLocaleString('en-IN')} written off.`);
                    } else {
                      showFeedback('No expired lots found to purge.');
                    }
                  }}
                  className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-semibold text-xs transition-colors"
                >
                  Purge Expired Lots
                </button>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-xs">Clean Depleted Lots</span>
                  <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {batches.filter((b) => b.quantity_current <= 0).length} Empty
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Removes finished and zero-quantity inventory lots to optimize system database performance.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const res = purgeDepletedBatches();
                    showFeedback(`Cleaned ${res.count} depleted batches from master.`);
                  }}
                  className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors"
                >
                  Clear Depleted Records
                </button>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-xs">Reset Transactions</span>
                  <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {transactions.length} Logs
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Clears transaction ledger history for fresh cycle audits while keeping existing inventory stock intact.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear transaction history logs? Current stock levels will remain unchanged.')) {
                      clearTransactions();
                      showFeedback('Transaction history reset.');
                    }
                  }}
                  className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors"
                >
                  Clear Audit Logs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODALS
          ═══════════════════════════════════════════════════════════════════ */}

      {/* Add / Edit Company Modal */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <form onSubmit={handleSaveCompanyEntity} className="bg-white border border-slate-200 rounded-2xl p-5 max-w-lg w-full space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">{editingCompany ? 'Edit Legal Entity' : 'Register New Company Entity'}</h3>
              <button type="button" onClick={() => setShowAddCompanyModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Legal Name *</label>
                <input
                  type="text"
                  required
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Entity Code</label>
                <input
                  type="text"
                  value={newCompanyCode}
                  onChange={(e) => setNewCompanyCode(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-mono-code uppercase focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Facility Name</label>
                <input
                  type="text"
                  value={newCompanyWarehouse}
                  onChange={(e) => setNewCompanyWarehouse(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">GSTIN Number</label>
                <input
                  type="text"
                  value={newCompanyGstin}
                  onChange={(e) => setNewCompanyGstin(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-mono-code focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Address</label>
              <input
                type="text"
                value={newCompanyAddress}
                onChange={(e) => setNewCompanyAddress(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddCompanyModal(false)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 shadow-2xs"
              >
                Save Entity
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Company Modal */}
      {deleteConfirmCompany && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white border border-rose-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl text-xs">
            <div className="flex items-center space-x-2 text-rose-600 pb-2 border-b border-rose-100">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 text-sm">Delete Company Entity</h3>
            </div>
            <p className="text-slate-600">
              Are you sure you want to delete <strong>{deleteConfirmCompany.name}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeleteConfirmCompany(null)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteCompany}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-2xs"
              >
                Delete Company
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <form onSubmit={handleSaveUser} className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">{editingUser ? 'Edit User Profile' : 'Add Staff User'}</h3>
              <button type="button" onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-mono-code focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                >
                  <option value="staff">Staff Picker</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="manager">Warehouse Manager</option>
                  <option value="auditor">Auditor</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 shadow-2xs"
              >
                Save User
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete User Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white border border-rose-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl text-xs">
            <div className="flex items-center space-x-2 text-rose-600 pb-2 border-b border-rose-100">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 text-sm">Delete User</h3>
            </div>
            <p className="text-slate-600">
              Are you sure you want to delete user <strong>{deleteConfirmUser.full_name}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteUser}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-2xs"
              >
                Delete User
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
              <h3 className="font-bold text-slate-900 text-sm">Delete Bin Location</h3>
            </div>
            <p className="text-slate-600">
              Are you sure you want to delete bin <strong>{deleteConfirmLocation.location_code}</strong> (Zone {deleteConfirmLocation.section}, Aisle {deleteConfirmLocation.aisle})?
            </p>
            {batches.some((b) => b.location_code === deleteConfirmLocation.location_code && b.quantity_current > 0) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px]">
                ⚠️ <strong>Warning:</strong> Active inventory stock is currently stored in this bin. Please relocate items before deletion.
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmLocation(null)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const hasStock = batches.some(
                    (b) => b.location_code === deleteConfirmLocation.location_code && b.quantity_current > 0
                  );
                  if (hasStock) {
                    showError(`Cannot delete bin ${deleteConfirmLocation.location_code} with active stock inside.`);
                    setDeleteConfirmLocation(null);
                    return;
                  }
                  executeDeleteLocation();
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-2xs"
              >
                Delete Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Factory Reset Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white border border-rose-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl text-xs">
            <div className="flex items-center space-x-2 text-rose-600 pb-2 border-b border-rose-100">
              <RotateCcw className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 text-sm">Confirm Factory Database Reset</h3>
            </div>
            <p className="text-slate-600">
              This will overwrite all custom inventory batches, transaction audit history, and locations back to factory defaults.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={executeFactoryReset}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-2xs"
              >
                Confirm Factory Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
