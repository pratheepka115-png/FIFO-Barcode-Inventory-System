import React from 'react';
import { Keyboard, X, Sparkles } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Shift + D', description: 'Open Executive Dashboard & Expiry Radar' },
    { key: 'Shift + I', description: 'Open Inbound Intake / Goods Receipt Station' },
    { key: 'Shift + O', description: 'Open FIFO Outbound Dispatch Station' },
    { key: 'Shift + M', description: 'Open Warehouse 2D Map & Heatmap Visualizer' },
    { key: 'Shift + C', description: 'Open Cycle Count & Physical Stock Audit Station' },
    { key: 'Shift + B', description: 'Open Thermal Barcode Studio' },
    { key: 'Shift + L', description: 'Open Transaction Audit Ledger' },
    { key: 'Shift + R', description: 'Open Reports, Aging & Trends' },
    { key: 'Shift + S', description: 'Trigger Quick Barcode Scanner HUD' },
    { key: 'Ctrl + Z', description: 'Undo Last QA Quarantine Hold / Release' },
    { key: 'Ctrl + Y', description: 'Redo Last QA Quarantine Hold / Release' },
    { key: 'Ctrl + S', description: 'Save & Download Vector PDF in QR Label Studio' },
    { key: 'Shift + ,', description: 'Open System Settings & Company Profile' },
    { key: 'Esc', description: 'Dismiss any open dialog or scanner HUD' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Warehouse Keyboard Shortcuts</h3>
              <p className="text-[11px] text-slate-500">Fast terminal access for barcode gun operators</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {shortcuts.map((sc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors text-xs"
            >
              <span className="text-slate-600 font-medium">{sc.description}</span>
              <kbd className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-300 font-mono-code font-bold text-slate-800 text-[11px] shadow-2xs">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-mono-code text-[10px]">Press any shortcut key anywhere in the software</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
