import React, { useState, useEffect } from 'react';
import {
  Boxes,
  QrCode,
  Scan,
  ArrowDownToLine,
  ArrowUpFromLine,
  LayoutDashboard,
  FileSpreadsheet,
  Settings,
  Bell,
  UserCheck,
  ChevronDown,
  Volume2,
  VolumeX,
  History,
  AlertTriangle,
  Building2,
  CheckCircle2,
  MapPin,
  ClipboardCheck,
  Scissors,
  Keyboard,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { UserRole } from '../types/inventory';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';

export const Navbar: React.FC = () => {
  const {
    currentUser,
    users,
    setCurrentUser,
    activeTab,
    setActiveTab,
    alerts,
    setScannerOpen,
    settings,
    updateSettings,
  } = useInventory();

  const [timeStr, setTimeStr] = useState<string>('');
  const [userDropdownOpen, setUserDropdownOpen] = useState<boolean>(false);
  const [alertsDropdownOpen, setAlertsDropdownOpen] = useState<boolean>(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // Global Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when user is typing in an input / textarea / select
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      if (e.shiftKey) {
        switch (e.key.toUpperCase()) {
          case 'D':
            e.preventDefault();
            setActiveTab('dashboard');
            break;
          case 'I':
            e.preventDefault();
            setActiveTab('receipt');
            break;
          case 'O':
            e.preventDefault();
            setActiveTab('picking');
            break;
          case 'M':
            e.preventDefault();
            setActiveTab('warehouse_map');
            break;
          case 'C':
            e.preventDefault();
            setActiveTab('cycle_count');
            break;
          case 'B':
            e.preventDefault();
            setActiveTab('barcode_studio');
            break;
          case 'L':
            e.preventDefault();
            setActiveTab('transactions');
            break;
          case 'R':
            e.preventDefault();
            setActiveTab('reports');
            break;
          case 'S':
            e.preventDefault();
            setScannerOpen(true);
            break;
          case '?':
            e.preventDefault();
            setShortcutsModalOpen(true);
            break;
          case '<':
          case ',':
            e.preventDefault();
            setActiveTab('settings');
            break;
        }
      } else if (e.key === '?') {
        e.preventDefault();
        setShortcutsModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab, setScannerOpen]);

  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory Lots', icon: Boxes },
    { id: 'warehouse_map', label: '2D Floor Map', icon: MapPin },
    { id: 'receipt', label: 'Inbound Intake', icon: ArrowDownToLine },
    { id: 'picking', label: 'FIFO Outbound', icon: ArrowUpFromLine },
    { id: 'cycle_count', label: 'Cycle Audit', icon: ClipboardCheck },
    { id: 'barcode_studio', label: 'Barcode Studio', icon: QrCode },
    { id: 'transactions', label: 'Audit Ledger', icon: History },
    { id: 'reports', label: 'Reports & Trends', icon: FileSpreadsheet },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        {/* Top Header Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          {/* Top Left Company Name & Warehouse Facility */}
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs shrink-0">
              <Building2 className="w-5 h-5 text-slate-100" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 truncate">
                <span className="font-bold text-sm sm:text-base text-slate-900 tracking-tight truncate">
                  {settings.company?.name || 'ABC Logistics & Supply Chain'}
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ₹ INR Active
                </span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-500 font-mono-code">
                <span className="text-slate-700 font-medium truncate">
                  {settings.company?.warehouse_name || 'Main Distribution Hub'}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400 text-[11px]">{timeStr}</span>
              </div>
            </div>
          </div>

          {/* Global Action Toolbar */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Keyboard Shortcuts Trigger */}
            <button
              onClick={() => setShortcutsModalOpen(true)}
              title="Keyboard Shortcuts (Press ?)"
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Keyboard className="w-4 h-4 text-slate-700" />
            </button>

            {/* Audio toggle */}
            <button
              onClick={() => updateSettings({ sound_effects: !settings.sound_effects })}
              title={settings.sound_effects ? 'Sound Effects Enabled' : 'Sound Effects Muted'}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 transition-colors"
            >
              {settings.sound_effects ? (
                <Volume2 className="w-4 h-4 text-slate-800" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* Quick Scanner Launcher */}
            <button
              onClick={() => setScannerOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-xs transition-colors"
            >
              <Scan className="w-3.5 h-3.5 text-slate-200" />
              <span className="hidden sm:inline">Scan (Shift+S)</span>
            </button>

            {/* Alerts Bell */}
            <div className="relative">
              <button
                onClick={() => setAlertsDropdownOpen(!alertsDropdownOpen)}
                className="relative p-2 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 transition-colors"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unacknowledgedAlerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unacknowledgedAlerts.length}
                  </span>
                )}
              </button>

              {/* Alerts Dropdown Drawer */}
              {alertsDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-xl p-3 z-50 animate-in fade-in text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center space-x-1.5 font-bold text-slate-900">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span>
                        Warehouse Alerts ({alerts.length})
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono-code">FIFO Monitor</span>
                  </div>

                  <div className="mt-2 space-y-2 max-h-72 overflow-y-auto pr-1">
                    {alerts.length === 0 ? (
                      <div className="p-4 text-center text-slate-400">
                        All inventory parameters are within normal thresholds.
                      </div>
                    ) : (
                      alerts.slice(0, 5).map((a) => {
                        const isCritical = a.alert_level === 'BLACK' || a.alert_level === 'RED' || a.alert_type === 'expired';
                        return (
                          <div
                            key={a.alert_id}
                            className={`p-2.5 rounded-lg border text-xs ${
                              isCritical
                                ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                                : 'bg-amber-50/70 border-amber-200 text-amber-900'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <span className="font-semibold">{a.product_name}</span>
                              <span className="text-[10px] text-slate-500 font-mono-code">{a.location_code}</span>
                            </div>
                            <p className="text-[11px] mt-0.5 text-slate-600">
                              Batch {a.batch_number}: {a.alert_type === 'expired' ? 'Expired' : `${a.days_remaining}d remaining`} ({a.quantity} units)
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 mt-2 text-right">
                    <button
                      onClick={() => {
                        setActiveTab('dashboard');
                        setAlertsDropdownOpen(false);
                      }}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                    >
                      View Expiry Radar →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs transition-colors shadow-2xs"
              >
                <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">
                  {currentUser?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="text-left hidden md:block">
                  <div className="font-semibold text-slate-900 leading-tight">
                    {currentUser?.full_name || 'Staff User'}
                  </div>
                  <div className="text-[10px] text-slate-500 capitalize leading-none">
                    {currentUser?.role || 'operator'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white border border-slate-200 shadow-xl p-2 z-50 animate-in fade-in text-xs">
                  <div className="px-2 py-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-500">
                    Switch Active Operator
                  </div>
                  <div className="py-1 space-y-1">
                    {users.map((u) => (
                      <button
                        key={u.user_id}
                        onClick={() => {
                          setCurrentUser(u);
                          setUserDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between transition-colors ${
                          currentUser?.user_id === u.user_id
                            ? 'bg-slate-900 text-white'
                            : 'hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-medium text-xs">{u.full_name}</div>
                          <div
                            className={`text-[10px] capitalize ${
                              currentUser?.user_id === u.user_id ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {u.role} · {u.department || 'Warehouse'}
                          </div>
                        </div>
                        {currentUser?.user_id === u.user_id && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="pt-1.5 border-t border-slate-100 px-1">
                    <button
                      onClick={() => {
                        setActiveTab('settings');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-center py-1 text-[11px] text-slate-600 hover:text-slate-900 font-medium"
                    >
                      Manage Users in Settings →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex items-center space-x-1 overflow-x-auto py-2 no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Global Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />
    </>
  );
};
