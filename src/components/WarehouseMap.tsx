import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Layers,
  Boxes,
  Thermometer,
  ShieldAlert,
  ArrowUpFromLine,
  RefreshCw,
  Search,
  Filter,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  Package,
  Calendar,
  IndianRupee,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Grid,
  Trash2,
  Edit2,
  Building,
  Sparkles,
  LayoutGrid,
  Sliders,
  Printer,
  Truck,
  ArrowDownToLine,
  Flame,
  Snowflake,
  ShieldCheck,
  Check,
  Download,
  Info,
  HelpCircle,
  Wand2,
  Compass,
  CheckCheck,
  X,
  ArrowRight,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Location, InventoryBatch, StorageType } from '../types/inventory';
import { calculateShelfLifeStatus } from '../utils/shelfLife';
import { soundFx } from '../utils/sound';

type HeatmapMode = 'expiry' | 'occupancy' | 'climate';
type LayoutViewMode = 'floor_plan' | 'rack_elevation' | 'labels_studio';

export const WarehouseMap: React.FC = () => {
  const {
    locations,
    batches,
    addLocation,
    updateLocation,
    deleteLocation,
    setSelectedBatchForDetail,
    setActiveTab,
    relocateBatch,
    toggleHoldBatch,
    setWriteOffTargetBatch,
    settings,
  } = useInventory();

  // Layout View Mode
  const [viewMode, setViewMode] = useState<LayoutViewMode>('floor_plan');
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('expiry');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedRackLevel, setSelectedRackLevel] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Elevation View state
  const [elevationAisle, setElevationAisle] = useState<string>('01');
  const [elevationSection, setElevationSection] = useState<string>('A');

  // Selected Bin Detail Drawer
  const [activeBinDetail, setActiveBinDetail] = useState<Location | null>(null);
  const [quickRelocateBatch, setQuickRelocateBatch] = useState<InventoryBatch | null>(null);
  const [targetBinCode, setTargetBinCode] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');

  // Modals for Layman & Expert Plant Layout Customization
  const [showAddBinModal, setShowAddBinModal] = useState<boolean>(false);
  const [showBulkRackModal, setShowBulkRackModal] = useState<boolean>(false);
  const [showFunctionalAreaModal, setShowFunctionalAreaModal] = useState<boolean>(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState<boolean>(false);
  const [showPrintLabelModal, setShowPrintLabelModal] = useState<boolean>(false);
  const [showHelpGuide, setShowHelpGuide] = useState<boolean>(false);
  const [labelPrintTarget, setLabelPrintTarget] = useState<Location | null>(null);
  const [editingBin, setEditingBin] = useState<Location | null>(null);

  // Form states for Single Custom Bin (Simple & Layman Friendly)
  const [formBinCode, setFormBinCode] = useState<string>('');
  const [formSection, setFormSection] = useState<string>('A');
  const [formAisle, setFormAisle] = useState<string>('01');
  const [formRackLevel, setFormRackLevel] = useState<number>(1);
  const [formPosition, setFormPosition] = useState<number>(1);
  const [formStorageType, setFormStorageType] = useState<StorageType>('ambient');
  const [formAreaType, setFormAreaType] = useState<Location['area_type']>('rack');
  const [formCapacity, setFormCapacity] = useState<number>(100);
  const [formMaxWeight, setFormMaxWeight] = useState<number>(1000);
  const [formDescription, setFormDescription] = useState<string>('');

  // Form states for Bulk Multi-Tier Rack Generator
  const [bulkZoneName, setBulkZoneName] = useState<string>('A');
  const [bulkAisle, setBulkAisle] = useState<string>('01');
  const [bulkLevelsCount, setBulkLevelsCount] = useState<number>(4);
  const [bulkBinsPerLevel, setBulkBinsPerLevel] = useState<number>(6);
  const [bulkStorageType, setBulkStorageType] = useState<StorageType>('ambient');
  const [bulkBinCapacity, setBulkBinCapacity] = useState<number>(100);

  // Extract unique sections & rack levels
  const sections = useMemo(() => {
    const s = new Set(locations.map((l) => l.section));
    return ['ALL', ...Array.from(s)];
  }, [locations]);

  const aisles = useMemo(() => {
    const a = new Set(locations.map((l) => l.aisle));
    return Array.from(a).sort();
  }, [locations]);

  // Overall Facility Capacity Metrics
  const metrics = useMemo(() => {
    const totalBins = locations.length;
    const totalCapacity = locations.reduce((acc, l) => acc + (l.capacity_units || 100), 0);
    const totalOccupied = locations.reduce((acc, l) => acc + (l.current_occupancy || 0), 0);
    const occupancyPct = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;
    const coldChainBins = locations.filter((l) => l.storage_type === 'refrigerated' || l.storage_type === 'frozen').length;
    const activeLotsCount = batches.filter((b) => b.quantity_current > 0).length;

    return {
      totalBins,
      totalCapacity,
      totalOccupied,
      occupancyPct,
      coldChainBins,
      activeLotsCount,
    };
  }, [locations, batches]);

  // Filtered locations
  const filteredLocations = useMemo(() => {
    let list = locations;
    if (selectedSection !== 'ALL') {
      list = list.filter((l) => l.section === selectedSection);
    }
    if (selectedRackLevel !== 'ALL') {
      list = list.filter((l) => (l.rack || 1) === selectedRackLevel);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          l.location_code.toLowerCase().includes(q) ||
          l.section.toLowerCase().includes(q) ||
          l.aisle.toLowerCase().includes(q) ||
          l.storage_type.toLowerCase().includes(q) ||
          (l.description && l.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [locations, selectedSection, selectedRackLevel, searchQuery]);

  const groupedBySection = useMemo(() => {
    const map: Record<string, Location[]> = {};
    filteredLocations.forEach((l) => {
      const sec = l.section || 'General';
      if (!map[sec]) map[sec] = [];
      map[sec].push(l);
    });
    return map;
  }, [filteredLocations]);

  // Determine cell color and status based on heatmap mode (Simple & Clear for Layman)
  const getBinVisual = (loc: Location) => {
    const locBatches = batches.filter((b) => b.location_code === loc.location_code && b.quantity_current > 0);
    const capacity = loc.capacity_units || 100;
    const occupancy = loc.current_occupancy || 0;
    const occPct = capacity > 0 ? Math.round((occupancy / capacity) * 100) : 0;

    if (heatmapMode === 'occupancy') {
      if (occupancy === 0) return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-400', badge: 'Empty (0%)', color: 'slate' };
      if (occPct > 90) return { bg: 'bg-rose-500 text-white', border: 'border-rose-600', text: 'text-white', badge: `Full (${occPct}%)`, color: 'rose' };
      if (occPct > 60) return { bg: 'bg-amber-400 text-slate-900', border: 'border-amber-500', text: 'text-slate-900', badge: `${occPct}% Full`, color: 'amber' };
      return { bg: 'bg-emerald-100 text-emerald-900', border: 'border-emerald-300', text: 'text-emerald-900', badge: `${occPct}% Space Used`, color: 'emerald' };
    }

    if (heatmapMode === 'climate') {
      if (loc.storage_type === 'refrigerated') {
        return { bg: 'bg-sky-100 text-sky-950', border: 'border-sky-300', text: 'text-sky-900', badge: 'Cold (+4°C)', color: 'sky' };
      }
      if (loc.storage_type === 'frozen') {
        return { bg: 'bg-blue-200 text-blue-950', border: 'border-blue-400', text: 'text-blue-900', badge: 'Freezer (-18°C)', color: 'blue' };
      }
      if (loc.storage_type === 'hazardous') {
        return { bg: 'bg-purple-100 text-purple-950', border: 'border-purple-300', text: 'text-purple-900', badge: 'Hazmat / Secure', color: 'purple' };
      }
      return { bg: 'bg-slate-100 text-slate-800', border: 'border-slate-300', text: 'text-slate-700', badge: 'Room Temp (Ambient)', color: 'slate' };
    }

    // Default: Expiry Risk (Traffic Light Rules)
    if (locBatches.length === 0) {
      return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-400', badge: 'Empty Shelf', color: 'slate' };
    }

    const hasExpired = locBatches.some((b) => b.status === 'expired' || calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date).daysRemaining <= 0);
    if (hasExpired) {
      return { bg: 'bg-rose-600 text-white animate-pulse', border: 'border-rose-700', text: 'text-white', badge: '⚠️ EXPIRED LOT', color: 'rose' };
    }

    const hasCritical = locBatches.some((b) => {
      const s = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
      return s.daysRemaining > 0 && s.daysRemaining <= 7;
    });
    if (hasCritical) {
      return { bg: 'bg-amber-400 text-slate-950', border: 'border-amber-500', text: 'text-slate-900', badge: '⚡ Urgent (≤7d left)', color: 'amber' };
    }

    const hasWarning = locBatches.some((b) => {
      const s = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
      return s.daysRemaining > 7 && s.daysRemaining <= 30;
    });
    if (hasWarning) {
      return { bg: 'bg-yellow-100 text-yellow-950', border: 'border-yellow-300', text: 'text-yellow-900', badge: 'Warning (≤30d)', color: 'yellow' };
    }

    return { bg: 'bg-emerald-50 text-emerald-950', border: 'border-emerald-300', text: 'text-emerald-900', badge: '✅ Fresh Stock', color: 'emerald' };
  };

  // Helper: Open Modal to Create Single Bin
  const handleOpenAddBin = (zone?: string) => {
    setEditingBin(null);
    const sec = zone || (sections.length > 1 && sections[1] !== 'ALL' ? sections[1] : 'A');
    setFormSection(sec);
    setFormAisle('01');
    setFormRackLevel(1);
    setFormPosition(1);
    setFormStorageType('ambient');
    setFormAreaType('rack');
    setFormCapacity(100);
    setFormMaxWeight(1000);
    setFormDescription('');
    setFormBinCode(`${sec}-01-1-01`);
    setShowAddBinModal(true);
  };

  // Helper: Open Modal to Edit Existing Bin
  const handleOpenEditBin = (bin: Location) => {
    setEditingBin(bin);
    setFormBinCode(bin.location_code);
    setFormSection(bin.section);
    setFormAisle(bin.aisle);
    setFormRackLevel(bin.rack || 1);
    setFormPosition(bin.position || 1);
    setFormStorageType(bin.storage_type);
    setFormAreaType(bin.area_type || 'rack');
    setFormCapacity(bin.capacity_units || 100);
    setFormMaxWeight(bin.max_weight_kg || 1000);
    setFormDescription(bin.description || '');
    setShowAddBinModal(true);
  };

  // Auto-generate code when typing section, aisle, tier, pos in layman form
  const handleAutoFillBinCode = (sec: string, ais: string, tier: number, pos: number) => {
    const cleanSec = sec.trim().toUpperCase() || 'A';
    const cleanAis = ais.trim().padStart(2, '0') || '01';
    const cleanTier = tier || 1;
    const cleanPos = String(pos || 1).padStart(2, '0');
    setFormBinCode(`${cleanSec}-${cleanAis}-${cleanTier}-${cleanPos}`);
  };

  // Save Single Bin (Create / Update)
  const handleSaveBin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBinCode.trim()) return;

    if (editingBin) {
      updateLocation({
        ...editingBin,
        location_code: formBinCode.trim().toUpperCase(),
        section: formSection.trim().toUpperCase(),
        aisle: formAisle.trim(),
        rack: formRackLevel,
        position: formPosition,
        storage_type: formStorageType,
        area_type: formAreaType,
        capacity_units: formCapacity,
        max_weight_kg: formMaxWeight,
        description: formDescription.trim(),
      });
      setFeedbackMessage(`Shelf location ${formBinCode} updated successfully.`);
    } else {
      if (locations.some((l) => l.location_code.toUpperCase() === formBinCode.trim().toUpperCase())) {
        alert(`A shelf with code "${formBinCode}" already exists! Please use a different number.`);
        return;
      }
      addLocation({
        location_code: formBinCode.trim().toUpperCase(),
        section: formSection.trim().toUpperCase(),
        aisle: formAisle.trim(),
        rack: formRackLevel,
        position: formPosition,
        storage_type: formStorageType,
        area_type: formAreaType,
        capacity_units: formCapacity,
        max_weight_kg: formMaxWeight,
        description: formDescription.trim(),
      });
      setFeedbackMessage(`New shelf ${formBinCode} added to your warehouse!`);
    }

    soundFx.playBarcodeBeep();
    setShowAddBinModal(false);
    setTimeout(() => setFeedbackMessage(''), 4000);
  };

  // Bulk Generator for Multi-Tier Racks
  const handleGenerateBulkRack = (e: React.FormEvent) => {
    e.preventDefault();
    const createdCodes: string[] = [];

    for (let level = 1; level <= bulkLevelsCount; level++) {
      for (let pos = 1; pos <= bulkBinsPerLevel; pos++) {
        const code = `${bulkZoneName.toUpperCase()}-${bulkAisle}-${level}-${String(pos).padStart(2, '0')}`;
        if (!locations.some((l) => l.location_code === code)) {
          addLocation({
            location_code: code,
            section: bulkZoneName.toUpperCase(),
            aisle: bulkAisle,
            rack: level,
            position: pos,
            storage_type: bulkStorageType,
            area_type: 'rack',
            capacity_units: bulkBinCapacity,
            max_weight_kg: bulkBinCapacity * 10,
          });
          createdCodes.push(code);
        }
      }
    }

    soundFx.playBarcodeBeep();
    setShowBulkRackModal(false);
    setFeedbackMessage(`Successfully created ${createdCodes.length} storage shelves across ${bulkLevelsCount} levels in Zone ${bulkZoneName}!`);
    setTimeout(() => setFeedbackMessage(''), 5000);
  };

  // Quick Add Standard Functional Areas (Docks, Packing, QA, Cold Rooms)
  const handleAddStandardArea = (type: 'dock_in' | 'dock_out' | 'packing' | 'quarantine' | 'cold_room') => {
    if (type === 'dock_in') {
      const nextNum = locations.filter((l) => l.section === 'DOCK-IN').length + 1;
      const code = `DOCK-IN-${String(nextNum).padStart(2, '0')}`;
      addLocation({
        location_code: code,
        section: 'DOCK-IN',
        aisle: 'INBOUND',
        rack: 1,
        position: nextNum,
        storage_type: 'ambient',
        area_type: 'dock_in',
        capacity_units: 500,
        description: 'Where delivery trucks unload incoming goods',
      });
      setFeedbackMessage(`Added Inbound Truck Receiving Door ${code}`);
    } else if (type === 'dock_out') {
      const nextNum = locations.filter((l) => l.section === 'DOCK-OUT').length + 1;
      const code = `DOCK-OUT-${String(nextNum).padStart(2, '0')}`;
      addLocation({
        location_code: code,
        section: 'DOCK-OUT',
        aisle: 'SHIPPING',
        rack: 1,
        position: nextNum,
        storage_type: 'ambient',
        area_type: 'dock_out',
        capacity_units: 500,
        description: 'Where trucks load orders for customer dispatch',
      });
      setFeedbackMessage(`Added Outbound Dispatch Dock ${code}`);
    } else if (type === 'packing') {
      const nextNum = locations.filter((l) => l.section === 'PACK').length + 1;
      const code = `PACK-STN-${String(nextNum).padStart(2, '0')}`;
      addLocation({
        location_code: code,
        section: 'PACK',
        aisle: 'PACKING',
        rack: 1,
        position: nextNum,
        storage_type: 'ambient',
        area_type: 'packing',
        capacity_units: 200,
        description: 'Work station where orders are boxed, taped, and labeled',
      });
      setFeedbackMessage(`Added Packing & Labeling Station ${code}`);
    } else if (type === 'quarantine') {
      const nextNum = locations.filter((l) => l.section === 'QUARANTINE').length + 1;
      const code = `QA-HOLD-${String(nextNum).padStart(2, '0')}`;
      addLocation({
        location_code: code,
        section: 'QUARANTINE',
        aisle: 'QA-CAGE',
        rack: 1,
        position: nextNum,
        storage_type: 'hazardous',
        area_type: 'quarantine',
        capacity_units: 300,
        description: 'Locked safety cage for damaged, suspicious, or expired goods',
      });
      setFeedbackMessage(`Added QA Quarantine Hold Cage ${code}`);
    } else if (type === 'cold_room') {
      const nextNum = locations.filter((l) => l.section === 'COLD-VAULT').length + 1;
      const code = `COLD-VLT-${String(nextNum).padStart(2, '0')}`;
      addLocation({
        location_code: code,
        section: 'COLD-VAULT',
        aisle: 'CHILLER',
        rack: 1,
        position: nextNum,
        storage_type: 'refrigerated',
        area_type: 'chiller',
        capacity_units: 400,
        description: 'Refrigerated walk-in cold room (+2°C to +8°C)',
      });
      setFeedbackMessage(`Added Cold Storage Room ${code}`);
    }

    soundFx.playBarcodeBeep();
    setShowFunctionalAreaModal(false);
    setTimeout(() => setFeedbackMessage(''), 4000);
  };

  // 1-Click Warehouse Presets / Templates (for Instant Setup by Laymen)
  const handleApplyPresetTemplate = (templateType: 'fmcg' | 'pharma' | 'ecommerce' | 'mini') => {
    if (!window.confirm(`Add standard layout racks for "${templateType.toUpperCase()} Warehouse"? (Existing inventory will be kept)`)) {
      return;
    }

    if (templateType === 'fmcg') {
      // Create Fast Moving Aisle B and Inbound/Outbound Docks
      ['A', 'B'].forEach((sec) => {
        for (let l = 1; l <= 3; l++) {
          for (let p = 1; p <= 4; p++) {
            const c = `${sec}-01-${l}-${String(p).padStart(2, '0')}`;
            if (!locations.some((loc) => loc.location_code === c)) {
              addLocation({
                location_code: c,
                section: sec,
                aisle: '01',
                rack: l,
                position: p,
                storage_type: 'ambient',
                area_type: 'rack',
                capacity_units: 100,
              });
            }
          }
        }
      });
      handleAddStandardArea('dock_in');
      handleAddStandardArea('dock_out');
      handleAddStandardArea('packing');
    } else if (templateType === 'pharma') {
      // Create Cold Rooms + Quarantine
      ['COLD-1', 'COLD-2'].forEach((sec) => {
        for (let l = 1; l <= 2; l++) {
          for (let p = 1; p <= 4; p++) {
            const c = `${sec}-01-${l}-${String(p).padStart(2, '0')}`;
            if (!locations.some((loc) => loc.location_code === c)) {
              addLocation({
                location_code: c,
                section: sec,
                aisle: 'CHILLER',
                rack: l,
                position: p,
                storage_type: 'refrigerated',
                area_type: 'chiller',
                capacity_units: 80,
              });
            }
          }
        }
      });
      handleAddStandardArea('quarantine');
    } else if (templateType === 'ecommerce') {
      ['PICK-1', 'PICK-2'].forEach((sec) => {
        for (let l = 1; l <= 4; l++) {
          for (let p = 1; p <= 5; p++) {
            const c = `${sec}-01-${l}-${String(p).padStart(2, '0')}`;
            if (!locations.some((loc) => loc.location_code === c)) {
              addLocation({
                location_code: c,
                section: sec,
                aisle: '01',
                rack: l,
                position: p,
                storage_type: 'ambient',
                area_type: 'rack',
                capacity_units: 50,
              });
            }
          }
        }
      });
      handleAddStandardArea('packing');
      handleAddStandardArea('dock_out');
    }

    setShowTemplatesModal(false);
    setFeedbackMessage(`Template applied! Standard warehouse layout ready.`);
    setTimeout(() => setFeedbackMessage(''), 5000);
  };

  // Delete Bin with safety check
  const handleDeleteBin = (loc: Location) => {
    const hasStock = batches.some((b) => b.location_code === loc.location_code && b.quantity_current > 0);
    if (hasStock) {
      alert(`⚠️ Cannot delete shelf "${loc.location_code}" because items are currently stored here. Please move or dispatch the items first!`);
      return;
    }
    if (window.confirm(`Are you sure you want to remove shelf "${loc.location_code}" from your warehouse layout?`)) {
      deleteLocation(loc.location_id);
      setActiveBinDetail(null);
      setFeedbackMessage(`Shelf ${loc.location_code} removed.`);
      setTimeout(() => setFeedbackMessage(''), 3000);
    }
  };

  // Relocate Stock Execution
  const handleExecuteRelocate = () => {
    if (!quickRelocateBatch || !targetBinCode) return;
    const res = relocateBatch(quickRelocateBatch.batch_id, targetBinCode);
    if (res.success) {
      setFeedbackMessage(`Moved ${quickRelocateBatch.quantity_current} boxes of Lot ${quickRelocateBatch.batch_number} to ${targetBinCode}`);
      setQuickRelocateBatch(null);
      setTargetBinCode('');
    } else {
      alert(res.error || 'Failed to move items');
    }
  };

  // Export Layout Manifest
  const handleExportLayoutCSV = () => {
    const headers = ['Shelf Code', 'Zone', 'Aisle', 'Tier Level', 'Position', 'Area Type', 'Temperature', 'Total Capacity (Units)', 'Current Occupancy', 'Occupancy %', 'Boxes Stored'];
    const rows = locations.map((loc) => {
      const locBatches = batches.filter((b) => b.location_code === loc.location_code && b.quantity_current > 0);
      const cap = loc.capacity_units || 100;
      const occ = loc.current_occupancy || 0;
      const pct = cap > 0 ? Math.round((occ / cap) * 100) : 0;
      return [
        loc.location_code,
        loc.section,
        loc.aisle,
        loc.rack || 1,
        loc.position || 1,
        loc.area_type || 'rack',
        loc.storage_type,
        cap,
        occ,
        `${pct}%`,
        locBatches.length,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Warehouse_Floor_Map_Layout_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 text-xs font-mono-code border border-slate-700 animate-slideUp">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Top Layman-Friendly Header & Simple Action Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <Building className="w-5 h-5 text-slate-900" />
              <h2 className="text-lg font-bold text-slate-900">2D Warehouse Floor Map & Shelf Designer</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Interactive 2D Visuals
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Easily view where every box is stored, add new shelves, customize zones, and find items on the floor map.
            </p>
          </div>

          {/* Quick Setup & Layman Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowTemplatesModal(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center space-x-1.5 shadow-2xs transition-transform active:scale-95"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>1-Click Warehouse Templates</span>
            </button>

            <button
              onClick={() => handleOpenAddBin()}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Single Shelf</span>
            </button>

            <button
              onClick={() => setShowBulkRackModal(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Build Multi-Shelf Rack</span>
            </button>

            <button
              onClick={() => setShowFunctionalAreaModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center space-x-1.5"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>+ Docks & Cold Rooms</span>
            </button>

            <button
              onClick={() => setShowHelpGuide(true)}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs"
              title="How to read this floor map"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Layman Friendly Capacity Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-0.5">
            <span className="text-[11px] text-slate-500 block font-medium">📦 Total Shelves / Bins</span>
            <span className="text-lg font-bold text-slate-900">{metrics.totalBins}</span>
            <span className="text-[10px] text-slate-400 block font-mono-code">{locations.length} configured slots</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-0.5">
            <span className="text-[11px] text-slate-500 block font-medium">🏢 Total Storage Space</span>
            <span className="text-lg font-bold text-slate-900">{metrics.totalCapacity.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 block">units max capacity</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-0.5">
            <span className="text-[11px] text-slate-500 block font-medium">📊 How Full is Warehouse?</span>
            <span className={`text-lg font-bold ${metrics.occupancyPct > 85 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {metrics.occupancyPct}% Full
            </span>
            <span className="text-[10px] text-slate-400 block">{metrics.totalOccupied} units stored</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-0.5">
            <span className="text-[11px] text-slate-500 block font-medium">🏷️ Active Batches</span>
            <span className="text-lg font-bold text-slate-900">{metrics.activeLotsCount} Lots</span>
            <span className="text-[10px] text-slate-400 block">stored across shelves</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-0.5">
            <span className="text-[11px] text-slate-500 block font-medium">❄️ Cold Storage</span>
            <span className="text-lg font-bold text-sky-700">{metrics.coldChainBins} Units</span>
            <span className="text-[10px] text-slate-400 block">refrigerated / frozen</span>
          </div>
        </div>

        {/* View Mode & Visual Heatmap Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {/* Layout Mode Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('floor_plan')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                viewMode === 'floor_plan'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>🗺️ 2D Top Floor Plan</span>
            </button>
            <button
              onClick={() => setViewMode('rack_elevation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                viewMode === 'rack_elevation'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>📐 Vertical Rack Elevation</span>
            </button>
            <button
              onClick={() => setViewMode('labels_studio')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                viewMode === 'labels_studio'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>🏷️ Print Shelf Labels</span>
            </button>
          </div>

          {/* Easy Color Highlights (Traffic Light Heatmap) */}
          {viewMode !== 'labels_studio' && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 font-medium">Highlight By:</span>
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setHeatmapMode('expiry')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    heatmapMode === 'expiry'
                      ? 'bg-white text-rose-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Shows fresh vs expiring items with colors"
                >
                  🟢 Expiry Date
                </button>
                <button
                  onClick={() => setHeatmapMode('occupancy')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    heatmapMode === 'occupancy'
                      ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Shows how full each shelf is"
                >
                  📊 Empty vs Full
                </button>
                <button
                  onClick={() => setHeatmapMode('climate')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    heatmapMode === 'climate'
                      ? 'bg-white text-sky-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Shows room temp vs cold room vs freezer"
                >
                  ❄️ Cold vs Room Temp
                </button>
              </div>
            </div>
          )}

          {/* Quick Filters & Search */}
          <div className="flex items-center space-x-2">
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none"
            >
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s === 'ALL' ? 'All Warehouse Zones' : `Zone ${s}`}
                </option>
              ))}
            </select>

            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Find any shelf or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 rounded-xl border border-slate-200 text-xs font-mono-code bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          VIEW 1: 2D TOP FLOOR PLAN
          ═══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'floor_plan' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Warehouse Racks Map */}
          <div className="lg:col-span-2 space-y-6">
            {/* Simple Color Key Banner */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span className="font-bold text-slate-900">Color Guide:</span>
              {heatmapMode === 'expiry' && (
                <div className="flex items-center space-x-3 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-rose-600 inline-block animate-pulse"></span> 🔴 Expired
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-amber-400 inline-block"></span> 🟡 Soon (≤7d)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block"></span> 🟢 Fresh
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-slate-100 border border-slate-200 inline-block"></span> ⚪ Empty Shelf
                  </span>
                </div>
              )}
              {heatmapMode === 'occupancy' && (
                <div className="flex items-center space-x-3 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-rose-500 inline-block"></span> 🔴 90-100% Full
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-amber-400 inline-block"></span> 🟡 60-90% Full
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block"></span> 🟢 Under 60%
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-slate-50 border border-slate-200 inline-block"></span> ⚪ Completely Empty
                  </span>
                </div>
              )}
              {heatmapMode === 'climate' && (
                <div className="flex items-center space-x-3 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-sky-100 border border-sky-300 inline-block"></span> ❄️ Cold Room (+4°C)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-blue-200 border border-blue-400 inline-block"></span> 🧊 Freezer (-18°C)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300 inline-block"></span> 🏢 Room Temperature
                  </span>
                </div>
              )}
            </div>

            {/* Warehouse Sections Matrix */}
            {Object.keys(groupedBySection).length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
                <MapPin className="w-10 h-10 mx-auto text-slate-300" />
                <h3 className="font-bold text-slate-800 text-sm">No Storage Shelves Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click "1-Click Warehouse Templates" to auto-create a standard layout, or click "+ Add Single Shelf".
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <button
                    onClick={() => setShowTemplatesModal(true)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl"
                  >
                    Use Standard Template
                  </button>
                  <button
                    onClick={() => handleOpenAddBin()}
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl"
                  >
                    + Add Single Shelf
                  </button>
                </div>
              </div>
            ) : (
              Object.keys(groupedBySection).map((sectionKey) => {
                const locList = groupedBySection[sectionKey];
                const totalCap = locList.reduce((acc, l) => acc + (l.capacity_units || 100), 0);
                const totalOcc = locList.reduce((acc, l) => acc + (l.current_occupancy || 0), 0);
                const pct = totalCap > 0 ? Math.round((totalOcc / totalCap) * 100) : 0;
                const storageType = locList[0]?.storage_type || 'ambient';
                const areaType = locList[0]?.area_type || 'rack';

                return (
                  <div key={sectionKey} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                    <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
                      <div className="flex items-center space-x-2.5">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 text-white font-mono-code">
                          ZONE {sectionKey}
                        </span>
                        <div className="text-xs">
                          <span className="font-semibold text-slate-800">
                            {areaType === 'dock_in'
                              ? '🚚 Inbound Receiving Dock Doors'
                              : areaType === 'dock_out'
                              ? '🚛 Outbound Shipping & Dispatch Docks'
                              : areaType === 'quarantine'
                              ? '🔒 QA Quarantine Hold Cage'
                              : areaType === 'packing'
                              ? '🏷️ Packing & Order Boxing Tables'
                              : areaType === 'chiller'
                              ? '❄️ Cold-Chain Vault'
                              : `📦 Storage Racks (${locList.length} Shelves)`}
                          </span>
                          <span className="text-slate-400 font-mono-code block text-[11px]">
                            {storageType.toUpperCase()} · Occupancy: {totalOcc} / {totalCap} units ({pct}% Full)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setElevationSection(sectionKey);
                            setElevationAisle(locList[0]?.aisle || '01');
                            setViewMode('rack_elevation');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center space-x-1"
                          title="View vertical shelves"
                        >
                          <Layers className="w-3 h-3" />
                          <span>View Shelf Levels</span>
                        </button>
                        <button
                          onClick={() => handleOpenAddBin(sectionKey)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center space-x-1 shadow-2xs"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Shelf Here</span>
                        </button>
                      </div>
                    </div>

                    {/* Bins Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {locList.map((loc) => {
                        const visual = getBinVisual(loc);
                        const isSelected = activeBinDetail?.location_id === loc.location_id;
                        const storedLots = batches.filter((b) => b.location_code === loc.location_code && b.quantity_current > 0);
                        const isSearchMatch = searchQuery.trim().length > 0 && (
                          loc.location_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          storedLots.some((b) => b.product_name.toLowerCase().includes(searchQuery.toLowerCase()) || b.batch_number.toLowerCase().includes(searchQuery.toLowerCase()))
                        );

                        return (
                          <button
                            key={loc.location_id}
                            type="button"
                            onClick={() => setActiveBinDetail(loc)}
                            className={`p-3 rounded-xl border text-left transition-all relative group flex flex-col justify-between min-h-[105px] ${
                              visual.bg
                            } ${visual.border} ${
                              isSelected
                                ? 'ring-2 ring-slate-900 ring-offset-2 shadow-md scale-[1.02]'
                                : isSearchMatch
                                ? 'ring-2 ring-indigo-500 ring-offset-1 shadow-md animate-pulse'
                                : 'hover:shadow-xs'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <span className={`font-mono-code font-bold text-xs tracking-tight ${visual.text}`}>
                                  {loc.location_code}
                                </span>
                                <span className="text-[10px] opacity-80 block">
                                  Level {loc.rack || 1} · Slot {loc.position || 1}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold opacity-90 text-right">
                                {visual.badge}
                              </span>
                            </div>

                            <div className="mt-2 space-y-1">
                              <div className="flex justify-between text-[10px] opacity-90 font-mono-code">
                                <span>{loc.current_occupancy} / {loc.capacity_units || 100} units</span>
                                <span>{storedLots.length} lot(s)</span>
                              </div>
                              <div className="w-full bg-black/10 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-full bg-current rounded-full"
                                  style={{
                                    width: `${Math.min(100, Math.round(((loc.current_occupancy || 0) / (loc.capacity_units || 100)) * 100))}%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right 1 Col: Selected Bin Inspection & Actions Drawer */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 sticky top-20">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-slate-700" />
                  <h3 className="font-bold text-sm text-slate-900">Shelf Details & Stored Boxes</h3>
                </div>
                {activeBinDetail && (
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => {
                        setLabelPrintTarget(activeBinDetail);
                        setShowPrintLabelModal(true);
                      }}
                      className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                      title="Print Shelf Barcode Sticker"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenEditBin(activeBinDetail)}
                      className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                      title="Edit Shelf Properties"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteBin(activeBinDetail)}
                      className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                      title="Remove this Shelf"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {!activeBinDetail ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <MapPin className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                  <p className="text-xs">
                    Click any shelf box on the map to see stored products, days until expiration, move items, or print barcodes.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  {/* Bin Summary Card in Plain English */}
                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl font-mono-code text-[11px] border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Shelf Code:</span>
                      <span className="font-bold text-slate-900 text-sm">{activeBinDetail.location_code}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Temperature:</span>
                      <span className="font-semibold text-slate-800 capitalize">{activeBinDetail.storage_type}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Zone & Aisle:</span>
                      <span className="font-semibold text-slate-800">Zone {activeBinDetail.section} · Aisle {activeBinDetail.aisle}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Level / Height:</span>
                      <span className="font-semibold text-slate-800">Level {activeBinDetail.rack || 1} {activeBinDetail.rack === 1 ? '(Floor)' : ''}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[10px]">Space Utilization:</span>
                      <span className="font-bold text-slate-900">
                        {activeBinDetail.current_occupancy} / {activeBinDetail.capacity_units || 100} units stored ({Math.round(((activeBinDetail.current_occupancy || 0) / (activeBinDetail.capacity_units || 100)) * 100)}% Full)
                      </span>
                    </div>
                    {activeBinDetail.description && (
                      <div className="col-span-2 pt-1 border-t border-slate-200/60 font-sans text-slate-600">
                        <span className="text-slate-400 block text-[10px] font-mono-code">Notes:</span>
                        {activeBinDetail.description}
                      </div>
                    )}
                  </div>

                  {/* Stored Batches in this Bin */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-700">Items Stored On This Shelf</span>
                      <span className="text-slate-400 font-mono-code text-[11px]">
                        {batches.filter((b) => b.location_code === activeBinDetail.location_code && b.quantity_current > 0).length} batch(es)
                      </span>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {batches.filter((b) => b.location_code === activeBinDetail.location_code && b.quantity_current > 0).length === 0 ? (
                        <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-400 text-xs">
                          ✨ This shelf is currently empty and ready for new goods!
                        </div>
                      ) : (
                        batches
                          .filter((b) => b.location_code === activeBinDetail.location_code && b.quantity_current > 0)
                          .map((batch) => {
                            const status = calculateShelfLifeStatus(batch.expiry_date, batch.manufacturing_date);
                            return (
                              <div
                                key={batch.batch_id}
                                className="p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 space-y-2 shadow-2xs"
                              >
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="font-bold text-slate-900 text-xs">{batch.product_name}</h4>
                                    <span className="text-[10px] text-slate-500 font-mono-code">
                                      Lot: {batch.batch_number} · SKU: {batch.product_code}
                                    </span>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${status.badgeClass}`}>
                                    {status.daysRemaining <= 0 ? 'EXPIRED' : `${status.daysRemaining}d left`}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-[11px] font-mono-code text-slate-600 pt-1 border-t border-slate-100">
                                  <span>Quantity: <strong className="text-slate-900">{batch.quantity_current} {batch.unit_of_measure}</strong></span>
                                  <span>₹{(batch.quantity_current * batch.unit_cost).toLocaleString('en-IN')}</span>
                                </div>

                                {/* Easy Action Buttons */}
                                <div className="flex items-center space-x-1.5 pt-1">
                                  <button
                                    onClick={() => {
                                      setSelectedBatchForDetail(batch);
                                      setActiveTab('picking');
                                    }}
                                    className="flex-1 py-1 px-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-semibold text-center flex items-center justify-center space-x-1"
                                  >
                                    <ArrowUpFromLine className="w-3 h-3" />
                                    <span>Pick</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setQuickRelocateBatch(batch);
                                      setTargetBinCode('');
                                    }}
                                    className="py-1 px-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold text-center flex items-center justify-center space-x-1"
                                    title="Relocate Shelf"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Move</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      const res = toggleHoldBatch(
                                        batch.batch_id,
                                        batch.status === 'quarantine' ? 'Released from hold' : 'Placed on hold from map'
                                      );
                                      if (res.success) {
                                        setFeedbackMessage(
                                          batch.status === 'quarantine'
                                            ? `Lot ${batch.batch_number} released to active.`
                                            : `Lot ${batch.batch_number} placed on QA Hold.`
                                        );
                                        setTimeout(() => setFeedbackMessage(''), 3000);
                                      }
                                    }}
                                    className={`py-1 px-2 rounded-md text-[10px] font-semibold text-center border transition-colors ${
                                      batch.status === 'quarantine'
                                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                                        : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                    }`}
                                    title={batch.status === 'quarantine' ? 'Release Hold' : 'Place on Hold'}
                                  >
                                    {batch.status === 'quarantine' ? 'Held' : 'Hold'}
                                  </button>
                                  <button
                                    onClick={() => setWriteOffTargetBatch(batch)}
                                    className="py-1 px-2 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-semibold text-center flex items-center justify-center"
                                    title="Material Write-Off & Scrap"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>

                  {/* Shelf Quick Tools */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('receipt')}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center justify-center space-x-1"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Inward Stock</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('cycle_count')}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center justify-center space-x-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Audit Shelf</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          VIEW 2: VERTICAL RACK ELEVATION (TIER VIEW)
          ═══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'rack_elevation' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-900" />
                <span>Vertical Rack Elevation (Side-by-Side Shelves)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Look at the rack from the front: view bottom floor pallets up to top high shelves.
              </p>
            </div>

            {/* Aisle & Zone Selector */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <label className="text-xs font-semibold text-slate-600">Zone:</label>
                <select
                  value={elevationSection}
                  onChange={(e) => setElevationSection(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900"
                >
                  {sections.filter((s) => s !== 'ALL').map((s) => (
                    <option key={s} value={s}>
                      Zone {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <label className="text-xs font-semibold text-slate-600">Aisle:</label>
                <select
                  value={elevationAisle}
                  onChange={(e) => setElevationAisle(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900"
                >
                  {aisles.map((a) => (
                    <option key={a} value={a}>
                      Aisle {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Elevation Rack Frame */}
          <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 text-white space-y-4">
            <div className="flex justify-between items-center text-xs font-mono-code text-slate-400">
              <span>RACK STRUCTURE: ZONE {elevationSection} - AISLE {elevationAisle}</span>
              <span>TOP SHELF &darr; TO GROUND PALLET LEVEL</span>
            </div>

            {/* Render Tiers from Top down to Tier 1 */}
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((tierLevel) => {
                const tierBins = locations.filter(
                  (l) => l.section === elevationSection && l.aisle === elevationAisle && (l.rack || 1) === tierLevel
                );

                if (tierBins.length === 0 && tierLevel > 3) return null;

                return (
                  <div key={tierLevel} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono-code text-slate-400 px-1">
                      <span className="font-bold text-slate-200">
                        LEVEL {tierLevel} {tierLevel === 1 ? '— FLOOR PALLET' : tierLevel === 2 ? '— EYE LEVEL' : '— UPPER BEAM'}
                      </span>
                      <span>{tierBins.length} Shelves</span>
                    </div>

                    {/* Shelf Beam */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 p-2 bg-slate-800/80 rounded-xl border border-slate-700">
                      {tierBins.length === 0 ? (
                        <div className="col-span-full py-3 text-center text-slate-500 text-xs font-mono-code">
                          No shelves configured on Level {tierLevel}.
                        </div>
                      ) : (
                        tierBins.map((bin) => {
                          const visual = getBinVisual(bin);
                          const storedLots = batches.filter((b) => b.location_code === bin.location_code && b.quantity_current > 0);
                          const occPct = bin.capacity_units > 0 ? Math.round(((bin.current_occupancy || 0) / bin.capacity_units) * 100) : 0;

                          return (
                            <div
                              key={bin.location_id}
                              onClick={() => {
                                setActiveBinDetail(bin);
                                setViewMode('floor_plan');
                              }}
                              className="p-3 bg-slate-900/90 border border-slate-700 rounded-lg hover:border-indigo-400 cursor-pointer transition-all space-y-2 group"
                            >
                              <div className="flex justify-between items-start font-mono-code">
                                <span className="text-xs font-bold text-white group-hover:text-indigo-300">
                                  {bin.location_code}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                  Slot {bin.position || 1}
                                </span>
                              </div>

                              <div className="space-y-1 text-[10px] font-mono-code">
                                <div className="flex justify-between text-slate-400">
                                  <span>Occ:</span>
                                  <span className="text-white font-bold">{bin.current_occupancy}/{bin.capacity_units || 100}</span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${occPct > 80 ? 'bg-rose-500' : 'bg-emerald-400'}`}
                                    style={{ width: `${Math.min(100, occPct)}%` }}
                                  ></div>
                                </div>
                                <div className="text-[9px] text-slate-400 pt-0.5 flex justify-between">
                                  <span>{storedLots.length} lot(s)</span>
                                  <span className="text-indigo-300 font-semibold">{visual.badge}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          VIEW 3: SHELF LABEL STUDIO (PRINTABLE BARCODES)
          ═══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'labels_studio' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Printer className="w-4 h-4 text-slate-900" />
                <span>Warehouse Shelf Barcode Studio</span>
              </h3>
              <p className="text-xs text-slate-500">
                Print physical barcode stickers to stick on racks and bins so warehouse staff can scan with a barcode gun.
              </p>
            </div>

            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print All Shelf Labels</span>
            </button>
          </div>

          {/* Label Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredLocations.map((loc) => (
              <div
                key={loc.location_id}
                className="p-4 rounded-xl border-2 border-dashed border-slate-300 bg-white space-y-3 font-mono-code text-slate-900 shadow-xs"
              >
                <div className="flex justify-between items-start border-b border-slate-200 pb-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block">ABC LOGISTICS & SUPPLY CHAIN</span>
                    <span className="font-bold text-sm">{loc.location_code}</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] uppercase font-bold">
                    {loc.storage_type}
                  </span>
                </div>

                {/* Simulated Barcode */}
                <div className="py-2 text-center space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <div className="flex justify-center space-x-0.5 h-8 items-end">
                    {[...loc.location_code].map((char, i) => (
                      <div
                        key={i}
                        className="bg-slate-900 w-1"
                        style={{ height: `${((char.charCodeAt(0) * 7) % 24) + 12}px` }}
                      ></div>
                    ))}
                  </div>
                  <span className="text-[11px] font-bold tracking-widest">{loc.location_code}</span>
                </div>

                <div className="grid grid-cols-3 text-[10px] text-slate-600 pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[9px]">ZONE</span>
                    <strong>{loc.section}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">AISLE</span>
                    <strong>{loc.aisle}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">LEVEL</span>
                    <strong>{loc.rack || 1}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 1: 1-CLICK WAREHOUSE TEMPLATES (LAYMAN MAGIC)
          ═══════════════════════════════════════════════════════════════════ */}
      {showTemplatesModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Wand2 className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Choose a Warehouse Preset Layout</h3>
                  <p className="text-[11px] text-slate-500">Pick what kind of warehouse you have, and we'll build all the shelves for you!</p>
                </div>
              </div>
              <button
                onClick={() => setShowTemplatesModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div
                onClick={() => handleApplyPresetTemplate('fmcg')}
                className="p-4 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 cursor-pointer transition-all flex items-start space-x-3 group"
              >
                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 group-hover:bg-amber-500 group-hover:text-white transition-colors shrink-0">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">🏬 Standard FMCG & Retail Distribution Center</h4>
                  <p className="text-slate-500 mt-0.5">
                    Includes Inbound Unloading Docks, Fast-Moving Pallet Racks (Zones A & B), Packing Tables, and Shipping Doors.
                  </p>
                </div>
              </div>

              <div
                onClick={() => handleApplyPresetTemplate('pharma')}
                className="p-4 rounded-xl border border-slate-200 hover:border-sky-400 hover:bg-sky-50/40 cursor-pointer transition-all flex items-start space-x-3 group"
              >
                <div className="p-2.5 rounded-xl bg-sky-100 text-sky-800 group-hover:bg-sky-500 group-hover:text-white transition-colors shrink-0">
                  <Snowflake className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">💊 Pharmaceutical & Cold-Chain Warehouse</h4>
                  <p className="text-slate-500 mt-0.5">
                    Includes +2°C to +8°C Chilled Vaults, Locked Quality Assurance (QA) Quarantine, and Temperature Logged Shelves.
                  </p>
                </div>
              </div>

              <div
                onClick={() => handleApplyPresetTemplate('ecommerce')}
                className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 cursor-pointer transition-all flex items-start space-x-3 group"
              >
                <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-800 group-hover:bg-indigo-500 group-hover:text-white transition-colors shrink-0">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">📦 E-Commerce Express Fulfillment Center</h4>
                  <p className="text-slate-500 mt-0.5">
                    High-density picking shelves, multiple order-packing benches, and fast courier dispatch staging.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTemplatesModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 2: ADD / EDIT SINGLE SHELF (LAYMAN FRIENDLY)
          ═══════════════════════════════════════════════════════════════════ */}
      {showAddBinModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-slate-900" />
                <h3 className="font-bold text-sm text-slate-900">
                  {editingBin ? `Edit Shelf ${editingBin.location_code}` : 'Add a New Storage Shelf'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddBinModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBin} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Zone / Area Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A, B, Cold-Room"
                    value={formSection}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase();
                      setFormSection(v);
                      handleAutoFillBinCode(v, formAisle, formRackLevel, formPosition);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-xs bg-white focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Aisle Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 01"
                    value={formAisle}
                    onChange={(e) => {
                      setFormAisle(e.target.value);
                      handleAutoFillBinCode(formSection, e.target.value, formRackLevel, formPosition);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Shelf Height Level (1 = Floor)</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={formRackLevel}
                    onChange={(e) => {
                      const num = parseInt(e.target.value, 10) || 1;
                      setFormRackLevel(num);
                      handleAutoFillBinCode(formSection, formAisle, num, formPosition);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Slot Position (1, 2, 3...)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formPosition}
                    onChange={(e) => {
                      const num = parseInt(e.target.value, 10) || 1;
                      setFormPosition(num);
                      handleAutoFillBinCode(formSection, formAisle, formRackLevel, num);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Generated Shelf Barcode ID</label>
                <input
                  type="text"
                  required
                  value={formBinCode}
                  onChange={(e) => setFormBinCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono-code font-bold text-xs bg-slate-50 focus:bg-white focus:ring-1 focus:ring-slate-900"
                />
                <span className="text-[10px] text-slate-400">This code will be printed on the shelf sticker.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Storage Temperature</label>
                  <select
                    value={formStorageType}
                    onChange={(e) => setFormStorageType(e.target.value as StorageType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="ambient">Room Temperature (Ambient)</option>
                    <option value="refrigerated">Refrigerator (+2°C to +8°C)</option>
                    <option value="frozen">Deep Freezer (-18°C)</option>
                    <option value="hazardous">Hazardous / Chemicals</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">How many units fit?</label>
                  <input
                    type="number"
                    min="10"
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(parseInt(e.target.value, 10) || 100)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description / Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Near front entrance, for medicines"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddBinModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white shadow-xs"
                >
                  {editingBin ? 'Save Changes' : 'Create Shelf'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 3: BULK MULTI-SHELF RACK BUILDER
          ═══════════════════════════════════════════════════════════════════ */}
      {showBulkRackModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Build a Complete Multi-Level Rack</h3>
                  <p className="text-[11px] text-slate-500">Automatically generate 10–50 shelves in 1 click!</p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkRackModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateBulkRack} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Zone / Area Letter</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. C or West-Wing"
                    value={bulkZoneName}
                    onChange={(e) => setBulkZoneName(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Aisle Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 01"
                    value={bulkAisle}
                    onChange={(e) => setBulkAisle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">How many Shelf Levels high? (1–8)</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={bulkLevelsCount}
                    onChange={(e) => setBulkLevelsCount(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Shelves per Level</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={bulkBinsPerLevel}
                    onChange={(e) => setBulkBinsPerLevel(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Storage Temperature</label>
                  <select
                    value={bulkStorageType}
                    onChange={(e) => setBulkStorageType(e.target.value as StorageType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="ambient">Room Temp (Ambient)</option>
                    <option value="refrigerated">Refrigerator (+2°C to +8°C)</option>
                    <option value="frozen">Deep Freezer (-18°C)</option>
                    <option value="hazardous">Hazardous Chemicals</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Capacity per Shelf (Units)</label>
                  <input
                    type="number"
                    min="10"
                    value={bulkBinCapacity}
                    onChange={(e) => setBulkBinCapacity(parseInt(e.target.value, 10) || 100)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-[11px] text-indigo-900">
                ✨ <strong>Ready to build:</strong> This will create {bulkLevelsCount * bulkBinsPerLevel} new shelves (named {bulkZoneName}-{bulkAisle}-1-01 to {bulkZoneName}-{bulkAisle}-{bulkLevelsCount}-{String(bulkBinsPerLevel).padStart(2, '0')}).
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBulkRackModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-xs flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Build All {bulkLevelsCount * bulkBinsPerLevel} Shelves</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 4: FUNCTIONAL AREAS (DOCKS, PACKING, QA CAGES)
          ═══════════════════════════════════════════════════════════════════ */}
      {showFunctionalAreaModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Truck className="w-5 h-5 text-slate-900" />
                <h3 className="font-bold text-sm text-slate-900">Add Work Area or Dock Door</h3>
              </div>
              <button
                onClick={() => setShowFunctionalAreaModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Click any of the standard warehouse areas below to add it to your floor map:
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => handleAddStandardArea('dock_in')}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-left flex items-start space-x-3 transition-colors"
              >
                <ArrowDownToLine className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-slate-900">🚚 Inbound Receiving Dock Door</h4>
                  <p className="text-[11px] text-slate-500">Where delivery trucks arrive and goods are checked.</p>
                </div>
              </button>

              <button
                onClick={() => handleAddStandardArea('dock_out')}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-left flex items-start space-x-3 transition-colors"
              >
                <Truck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-slate-900">🚛 Outbound Shipping & Dispatch Dock</h4>
                  <p className="text-[11px] text-slate-500">Where courier trucks are loaded for customer delivery.</p>
                </div>
              </button>

              <button
                onClick={() => handleAddStandardArea('packing')}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-left flex items-start space-x-3 transition-colors"
              >
                <Boxes className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-slate-900">🏷️ Packing & Order Boxing Table</h4>
                  <p className="text-[11px] text-slate-500">Where items are checked, boxed, taped, and labeled.</p>
                </div>
              </button>

              <button
                onClick={() => handleAddStandardArea('quarantine')}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-left flex items-start space-x-3 transition-colors"
              >
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-slate-900">🔒 QA Quarantine & Damage Isolation Cage</h4>
                  <p className="text-[11px] text-slate-500">Locked area for damaged, non-compliant, or expired items.</p>
                </div>
              </button>

              <button
                onClick={() => handleAddStandardArea('cold_room')}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-left flex items-start space-x-3 transition-colors"
              >
                <Snowflake className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-slate-900">❄️ Walk-In Cold Room (+2°C to +8°C)</h4>
                  <p className="text-[11px] text-slate-500">Chilled storage room for medicines, dairy, and perishables.</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 5: HELP GUIDE FOR BEGINNERS
          ═══════════════════════════════════════════════════════════════════ */}
      {showHelpGuide && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs text-slate-700 leading-relaxed">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">How to Use the Warehouse Floor Map</h3>
              </div>
              <button
                onClick={() => setShowHelpGuide(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900 text-xs block">1. How Shelf Codes Work</span>
                <p className="text-slate-600">
                  Every code like <strong>A-01-2-03</strong> means:
                  <br />• <strong>A:</strong> Zone A
                  <br />• <strong>01:</strong> Aisle 1
                  <br />• <strong>2:</strong> Shelf Level 2 (Eye level)
                  <br />• <strong>03:</strong> Box Slot 3
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900 text-xs block">2. What the Colors Mean</span>
                <p className="text-slate-600">
                  • 🟢 <strong>Green:</strong> Fresh products with plenty of shelf life remaining.
                  <br />• 🟡 <strong>Yellow/Orange:</strong> Expiring in less than 30 days. Priority for shipping.
                  <br />• 🔴 <strong>Red Pulse:</strong> Expired! Must be held or written off.
                  <br />• ⚪ <strong>White/Gray:</strong> Empty shelf ready for new stock.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900 text-xs block">3. One-Click Actions</span>
                <p className="text-slate-600">
                  Simply click any shelf on the map to see what is inside, move boxes to another shelf, or print barcode stickers.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowHelpGuide(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
              >
                Got It!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 6: PRINT INDIVIDUAL SHELF LABEL
          ═══════════════════════════════════════════════════════════════════ */}
      {showPrintLabelModal && labelPrintTarget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-slate-900" />
                <h3 className="font-bold text-sm text-slate-900">Print Shelf Sticker: {labelPrintTarget.location_code}</h3>
              </div>
              <button
                onClick={() => setShowPrintLabelModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Label Preview */}
            <div className="p-6 rounded-2xl border-2 border-slate-900 bg-white font-mono-code text-slate-900 space-y-4">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-2">
                <div>
                  <span className="text-[10px] font-bold block text-slate-500">ABC LOGISTICS & SUPPLY CHAIN</span>
                  <span className="font-black text-xl tracking-tight">{labelPrintTarget.location_code}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold uppercase">
                  {labelPrintTarget.storage_type}
                </span>
              </div>

              {/* Barcode Lines */}
              <div className="py-3 text-center space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex justify-center space-x-1 h-12 items-end">
                  {[...labelPrintTarget.location_code].map((char, i) => (
                    <div
                      key={i}
                      className="bg-slate-900 w-1.5"
                      style={{ height: `${((char.charCodeAt(0) * 11) % 36) + 12}px` }}
                    ></div>
                  ))}
                </div>
                <span className="text-sm font-bold tracking-widest block">{labelPrintTarget.location_code}</span>
              </div>

              <div className="grid grid-cols-4 text-xs font-mono-code pt-1">
                <div>
                  <span className="text-[10px] text-slate-400 block">ZONE</span>
                  <strong>{labelPrintTarget.section}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">AISLE</span>
                  <strong>{labelPrintTarget.aisle}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">LEVEL</span>
                  <strong>{labelPrintTarget.rack || 1}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">CAPACITY</span>
                  <strong>{labelPrintTarget.capacity_units || 100}</strong>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPrintLabelModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                  setShowPrintLabelModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white shadow-xs flex items-center space-x-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Sticker</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 7: QUICK MOVE BOX TO ANOTHER SHELF
          ═══════════════════════════════════════════════════════════════════ */}
      {quickRelocateBatch && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-5 h-5 text-slate-800" />
                <h3 className="font-bold text-sm text-slate-900">Move Lot {quickRelocateBatch.batch_number} to Another Shelf</h3>
              </div>
              <button
                onClick={() => setQuickRelocateBatch(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1 font-mono-code">
                <div className="flex justify-between text-slate-600">
                  <span>Product Name:</span>
                  <span className="font-bold text-slate-900">{quickRelocateBatch.product_name}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Current Shelf:</span>
                  <span className="font-bold text-slate-900">{quickRelocateBatch.location_code}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Quantity:</span>
                  <span className="font-bold text-slate-900">{quickRelocateBatch.quantity_current} {quickRelocateBatch.unit_of_measure}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Destination Shelf</label>
                <select
                  value={targetBinCode}
                  onChange={(e) => setTargetBinCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono-code bg-white focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">-- Choose target shelf --</option>
                  {locations
                    .filter((l) => l.location_code !== quickRelocateBatch.location_code)
                    .map((l) => (
                      <option key={l.location_id} value={l.location_code}>
                        {l.location_code} (Zone {l.section}) - Occ: {l.current_occupancy}/{l.capacity_units || 100} [{l.storage_type}]
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setQuickRelocateBatch(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!targetBinCode}
                onClick={handleExecuteRelocate}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-xs font-semibold text-white shadow-xs"
              >
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
