import { Product, InventoryBatch, Transaction } from '../types/inventory';
import { calculateShelfLifeStatus } from './shelfLife';

export interface ProductForecast {
  productId: string;
  productCode: string;
  productName: string;
  category: string;
  storageType: string;
  unitOfMeasure: string;
  unitCost: number;
  totalCurrentStock: number;
  reorderLevel: number;
  activeBatchesCount: number;
  
  // Consumption & Demand Velocity
  dailyRunRate: number; // units consumed per day
  daysOfSupply: number; // days until stockout at current velocity
  projectedStockoutDate: string; // ISO date string
  
  // Reorder Analytics
  reorderStatus: 'HEALTHY' | 'REORDER_SOON' | 'CRITICAL_STOCKOUT' | 'OVERSTOCKED';
  suggestedReorderQuantity: number;
  reorderCostEstimateINR: number;
  
  // Expiry & Waste Risk
  earliestExpiryDate: string;
  earliestBatchNumber: string;
  daysToEarliestExpiry: number;
  atRiskExpiringUnits: number; // Units that will likely expire before consumed
  projectedWasteLossINR: number; // Financial loss in INR
  fifoRiskLevel: 'NONE' | 'MODERATE' | 'HIGH' | 'CRITICAL';
}

/**
 * Calculates unified inventory forecasting and demand velocity for all products
 */
export function calculateInventoryForecasts(
  products: Product[],
  batches: InventoryBatch[],
  transactions: Transaction[]
): ProductForecast[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Look back at past 30 days OUT transactions to calculate real consumption velocity
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const outTxLast30Days = transactions.filter(
    (t) => t.transaction_type === 'OUT' && new Date(t.transaction_date) >= thirtyDaysAgo
  );

  return products.map((prod) => {
    const prodBatches = batches.filter(
      (b) => b.product_id === prod.product_id && b.status === 'active' && b.quantity_current > 0
    );

    const totalCurrentStock = prodBatches.reduce((sum, b) => sum + b.quantity_current, 0);

    // Calculate real consumption or fall back to realistic velocity based on reorder level
    const prodOutUnits = outTxLast30Days
      .filter((t) => t.product_id === prod.product_id)
      .reduce((sum, t) => sum + t.quantity, 0);

    // Baseline daily run rate: minimum 1 unit/day or real consumption
    const estimatedDailyConsumption = Math.max(
      0.5,
      prodOutUnits > 0 ? prodOutUnits / 30 : (prod.reorder_level || 50) / 25
    );

    const dailyRunRate = Number(estimatedDailyConsumption.toFixed(1));
    const daysOfSupply = Math.round(totalCurrentStock / dailyRunRate);

    const stockoutDate = new Date(today);
    stockoutDate.setDate(stockoutDate.getDate() + daysOfSupply);
    const projectedStockoutDate = stockoutDate.toISOString().split('T')[0];

    // Reorder Status
    let reorderStatus: ProductForecast['reorderStatus'] = 'HEALTHY';
    if (totalCurrentStock === 0 || daysOfSupply <= 7 || totalCurrentStock <= prod.reorder_level * 0.5) {
      reorderStatus = 'CRITICAL_STOCKOUT';
    } else if (daysOfSupply <= 20 || totalCurrentStock <= prod.reorder_level) {
      reorderStatus = 'REORDER_SOON';
    } else if (daysOfSupply > 120 && totalCurrentStock > prod.reorder_level * 4) {
      reorderStatus = 'OVERSTOCKED';
    }

    // Suggested Reorder Quantity to achieve healthy 45-day inventory buffer
    const targetBufferQty = Math.max(prod.reorder_level * 2, Math.round(dailyRunRate * 45));
    const suggestedReorderQuantity = Math.max(0, targetBufferQty - totalCurrentStock);
    const reorderCostEstimateINR = suggestedReorderQuantity * prod.unit_cost;

    // Expiry Risk Calculation
    let earliestExpiryDate = 'N/A';
    let earliestBatchNumber = 'N/A';
    let daysToEarliestExpiry = 9999;
    let atRiskExpiringUnits = 0;
    let projectedWasteLossINR = 0;
    let fifoRiskLevel: ProductForecast['fifoRiskLevel'] = 'NONE';

    if (prodBatches.length > 0) {
      // Sort batches by expiry date
      const sortedBatches = [...prodBatches].sort(
        (a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
      );

      const oldest = sortedBatches[0];
      earliestExpiryDate = oldest.expiry_date;
      earliestBatchNumber = oldest.batch_number;

      const shelfStatus = calculateShelfLifeStatus(oldest.expiry_date, oldest.manufacturing_date);
      daysToEarliestExpiry = shelfStatus.daysRemaining;

      // Cumulative consumption vs batch expiry
      let availableDays = 0;
      sortedBatches.forEach((b) => {
        const bStatus = calculateShelfLifeStatus(b.expiry_date, b.manufacturing_date);
        const daysUntilExpired = bStatus.daysRemaining;
        const unitsThatCanBeSoldBeforeExpiry = Math.max(0, daysUntilExpired * dailyRunRate);

        if (b.quantity_current > unitsThatCanBeSoldBeforeExpiry && daysUntilExpired > 0) {
          const surplusRiskUnits = Math.round(b.quantity_current - unitsThatCanBeSoldBeforeExpiry);
          atRiskExpiringUnits += surplusRiskUnits;
          projectedWasteLossINR += surplusRiskUnits * b.unit_cost;
        } else if (daysUntilExpired <= 0) {
          atRiskExpiringUnits += b.quantity_current;
          projectedWasteLossINR += b.quantity_current * b.unit_cost;
        }
      });

      if (daysToEarliestExpiry <= 0 || atRiskExpiringUnits > 50) {
        fifoRiskLevel = 'CRITICAL';
      } else if (daysToEarliestExpiry <= 15 || atRiskExpiringUnits > 20) {
        fifoRiskLevel = 'HIGH';
      } else if (daysToEarliestExpiry <= 30 || atRiskExpiringUnits > 0) {
        fifoRiskLevel = 'MODERATE';
      }
    }

    return {
      productId: prod.product_id,
      productCode: prod.product_code,
      productName: prod.product_name,
      category: prod.category,
      storageType: prod.storage_requirements,
      unitOfMeasure: prod.unit_of_measure,
      unitCost: prod.unit_cost,
      totalCurrentStock,
      reorderLevel: prod.reorder_level,
      activeBatchesCount: prodBatches.length,
      dailyRunRate,
      daysOfSupply,
      projectedStockoutDate,
      reorderStatus,
      suggestedReorderQuantity,
      reorderCostEstimateINR,
      earliestExpiryDate,
      earliestBatchNumber,
      daysToEarliestExpiry,
      atRiskExpiringUnits,
      projectedWasteLossINR,
      fifoRiskLevel,
    };
  });
}
