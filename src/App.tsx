/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { InventoryGrid } from './components/InventoryGrid';
import { WarehouseMap } from './components/WarehouseMap';
import { GoodsReceiptModal } from './components/GoodsReceiptModal';
import { FIFOPickingModal } from './components/FIFOPickingModal';
import { CycleCountModal } from './components/CycleCountModal';
import { BarcodeStudio } from './components/BarcodeStudio';
import { TransactionLedger } from './components/TransactionLedger';
import { ReportsView } from './components/ReportsView';
import { SettingsModal } from './components/SettingsModal';
import { ScannerModal } from './components/ScannerModal';
import { WriteOffModal } from './components/WriteOffModal';
import { HoldUndoRedoBar } from './components/HoldUndoRedoBar';

const MainContent: React.FC = () => {
  const { activeTab, writeOffTargetBatch, setWriteOffTargetBatch } = useInventory();

  return (
    <main className="min-h-[calc(100vh-70px)] pb-16">
      {activeTab === 'dashboard' && <Dashboard />}
      {activeTab === 'inventory' && <InventoryGrid />}
      {activeTab === 'warehouse_map' && <WarehouseMap />}
      {activeTab === 'receipt' && <GoodsReceiptModal />}
      {activeTab === 'picking' && <FIFOPickingModal />}
      {activeTab === 'cycle_count' && <CycleCountModal />}
      {activeTab === 'barcode_studio' && <BarcodeStudio />}
      {activeTab === 'transactions' && <TransactionLedger />}
      {activeTab === 'reports' && <ReportsView />}
      {activeTab === 'settings' && <SettingsModal />}

      {/* Global Scanner Terminal Modal */}
      <ScannerModal />

      {/* Global Material Write-Off & Scrap Modal */}
      {writeOffTargetBatch && (
        <WriteOffModal
          batch={writeOffTargetBatch}
          onClose={() => setWriteOffTargetBatch(null)}
        />
      )}

      {/* Floating Hold / Release Undo-Redo Controller */}
      <HoldUndoRedoBar />
    </main>
  );
};

export default function App() {
  return (
    <InventoryProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white antialiased">
        <Navbar />
        <MainContent />
      </div>
    </InventoryProvider>
  );
}
