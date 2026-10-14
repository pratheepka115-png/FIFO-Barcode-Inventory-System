import React, { useEffect, useState } from 'react';
import { RotateCcw, RotateCw, ShieldAlert, ShieldCheck, CheckCircle2, X } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

export const HoldUndoRedoBar: React.FC = () => {
  const {
    canUndoHold,
    canRedoHold,
    lastHoldAction,
    undoHold,
    redoHold,
  } = useInventory();

  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastVisible, setToastVisible] = useState<boolean>(false);

  // Keyboard shortcut support: Ctrl+Z (or Cmd+Z) for Undo Hold, Ctrl+Y (or Cmd+Shift+Z) for Redo Hold
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        if (canUndoHold) {
          e.preventDefault();
          const res = undoHold();
          if (res.success) {
            setToastMessage(res.message);
            setToastVisible(true);
            setTimeout(() => setToastVisible(false), 3500);
          }
        }
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        if (canRedoHold) {
          e.preventDefault();
          const res = redoHold();
          if (res.success) {
            setToastMessage(res.message);
            setToastVisible(true);
            setTimeout(() => setToastVisible(false), 3500);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndoHold, canRedoHold, undoHold, redoHold]);

  const handleUndo = () => {
    const res = undoHold();
    if (res.success) {
      setToastMessage(res.message);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 3500);
    }
  };

  const handleRedo = () => {
    const res = redoHold();
    if (res.success) {
      setToastMessage(res.message);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 3500);
    }
  };

  if (!canUndoHold && !canRedoHold && !toastVisible) {
    return null;
  }

  return (
    <>
      {/* Dynamic Feedback Toast */}
      {toastVisible && toastMessage && (
        <div className="fixed top-16 right-5 z-50 p-3 rounded-xl bg-slate-900 text-white shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 border border-slate-700 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Floating Hold Undo / Redo Bar */}
      {(canUndoHold || canRedoHold) && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md border border-slate-300/80 shadow-2xl rounded-2xl px-4 py-2 flex items-center gap-3 text-xs animate-in fade-in slide-in-from-bottom-3">
          <div className="flex items-center space-x-2 border-r border-slate-200 pr-3">
            {lastHoldAction?.action === 'HOLD' ? (
              <ShieldAlert className="w-4 h-4 text-amber-600" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            )}
            <div className="leading-tight">
              <span className="font-bold text-slate-900 block text-[11px]">
                {lastHoldAction?.action === 'HOLD' ? 'Lot Placed on Hold' : 'Lot Released to Active'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono-code">
                {lastHoldAction?.batchNumber}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleUndo}
              disabled={!canUndoHold}
              title="Undo Hold / Release (Ctrl+Z)"
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 text-slate-800 font-semibold text-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>Undo Hold</span>
            </button>

            <button
              onClick={handleRedo}
              disabled={!canRedoHold}
              title="Redo Hold / Release (Ctrl+Y)"
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 text-slate-800 font-semibold text-xs transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5 text-slate-600" />
              <span>Redo</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
