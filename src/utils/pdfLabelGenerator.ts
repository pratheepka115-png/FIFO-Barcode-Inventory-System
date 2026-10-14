import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { InventoryBatch } from '../types/inventory';
import { formatDate } from './shelfLife';
import { formatINR } from './currency';

export interface PDFLabelOptions {
  labelSize: '4x2' | '3x2' | '2x1' | 'sheet';
  copies: number;
  companyName: string;
  includeHeader: boolean;
  includeLocation: boolean;
  includeShelfLife: boolean;
  includeDates: boolean;
  includeValuation: boolean;
  includeQty: boolean;
  shelfLifeDaysRemaining: number;
  shelfLifeZone: string;
}

/**
 * Captures the designated label area element using html2canvas and compiles it into a PDF
 * using jsPDF, strictly adhering to the same layout logic as the existing print styles:
 * - '4x2', '3x2', '2x1': Thermal roll stickers with individual pages per copy.
 * - 'sheet': A4 standard sheet with 2-column grid layout for multi-label sheets.
 * Triggers a local file download directly.
 */
export async function downloadBatchLabelsPDF(
  containerElement: HTMLElement,
  batch: InventoryBatch,
  labelSize: '4x2' | '3x2' | '2x1' | 'sheet',
  copies: number = 1
): Promise<void> {
  const cleanSku = (batch.product_code || 'SKU').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanLot = (batch.batch_number || 'LOT').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${cleanSku}_${cleanLot}_QR_Labels_${labelSize}.pdf`;

  if (labelSize === 'sheet') {
    // Sheet mode: Look for sheet pages (.sheet-page) or capture container directly
    const sheetPages = Array.from(
      containerElement.querySelectorAll<HTMLElement>('.sheet-page')
    );
    const elementsToCapture = sheetPages.length > 0 ? sheetPages : [containerElement];

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: 'a4',
    });

    for (let i = 0; i < elementsToCapture.length; i++) {
      if (i > 0) {
        doc.addPage('a4', 'portrait');
      }
      const pageEl = elementsToCapture[i];
      const canvas = await html2canvas(pageEl, {
        scale: 2.5,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', 0, 0, 8.27, 11.69);
    }

    doc.save(filename);
    return;
  }

  // Thermal Roll sizes (4x2, 3x2, 2x1)
  const [w, h] =
    labelSize === '2x1' ? [2.2, 1.1] :
    labelSize === '3x2' ? [3.0, 2.0] :
    [4.0, 2.0];

  const labelBox =
    (containerElement.querySelector('.thermal-label-box') as HTMLElement) ||
    containerElement;

  const canvas = await html2canvas(labelBox, {
    scale: 3, // High DPI for crisp QR scanability and clean text
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'in',
    format: [w, h],
  });

  const margin = 0.05;
  const contentW = w - margin * 2;
  const contentH = h - margin * 2;

  for (let i = 0; i < copies; i++) {
    if (i > 0) {
      doc.addPage([w, h], 'landscape');
    }
    doc.addImage(imgData, 'PNG', margin, margin, contentW, contentH);
  }

  doc.save(filename);
}

/**
 * Draws a single label onto a jsPDF document at (originX, originY) with width and height in inches.
 */
function drawSingleLabel(
  doc: jsPDF,
  originX: number,
  originY: number,
  width: number,
  height: number,
  batch: InventoryBatch,
  qrDataUrl: string,
  options: PDFLabelOptions
) {
  // Border around label
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.015);
  doc.roundedRect(originX, originY, width, height, 0.05, 0.05, 'S');

  let currentY = originY + 0.12;

  // Header
  if (options.includeHeader && height >= 1.5) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    const headerText = (options.companyName || 'ABC LOGISTICS & SUPPLY CHAIN').toUpperCase();
    doc.text(headerText.slice(0, 32), originX + 0.1, currentY);

    doc.setFontSize(7.5);
    doc.text('FIFO WMS', originX + width - 0.1, currentY, { align: 'right' });

    currentY += 0.06;
    doc.setLineWidth(0.01);
    doc.line(originX + 0.1, currentY, originX + width - 0.1, currentY);
    currentY += 0.08;
  } else if (!options.includeHeader || height < 1.5) {
    currentY = originY + 0.08;
  }

  // QR Code Image dimensions
  const qrSize = height <= 1.2 ? 0.8 : height <= 2.1 && width <= 3.2 ? 1.15 : 1.35;
  const qrX = originX + 0.1;
  const qrY = currentY;

  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch (e) {
      console.warn('Failed to add QR image to PDF:', e);
    }
  }

  // Text next to QR Code
  const textX = qrX + qrSize + 0.1;
  const textWidth = width - (textX - originX) - 0.1;
  let textY = qrY + (height <= 1.2 ? 0.12 : 0.15);

  // Product Name
  doc.setFont('helvetica', 'bold');
  const titleFontSize = height <= 1.2 ? 7.5 : width >= 3.6 ? 10 : 8.5;
  doc.setFontSize(titleFontSize);
  const truncatedName = batch.product_name.length > 24 ? batch.product_name.slice(0, 22) + '...' : batch.product_name;
  doc.text(truncatedName.toUpperCase(), textX, textY);
  textY += height <= 1.2 ? 0.12 : 0.16;

  // SKU & Lot
  doc.setFont('courier', 'bold');
  const codeFontSize = height <= 1.2 ? 6.5 : 8;
  doc.setFontSize(codeFontSize);
  doc.text(`SKU: ${batch.product_code}`, textX, textY);
  textY += height <= 1.2 ? 0.11 : 0.14;
  doc.text(`LOT: ${batch.batch_number}`, textX, textY);
  textY += height <= 1.2 ? 0.11 : 0.14;

  // Bin Location
  if (options.includeLocation) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(height <= 1.2 ? 6.5 : 8);
    doc.text(`BIN: ${batch.location_code}`, textX, textY);
    textY += height <= 1.2 ? 0.11 : 0.14;
  }

  // Shelf-Life / Status
  if (options.includeShelfLife && height >= 1.5) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const lifeText = options.shelfLifeDaysRemaining <= 0
      ? 'STATUS: EXPIRED'
      : `FEFO: ${options.shelfLifeDaysRemaining}d remaining (${options.shelfLifeZone.toUpperCase()})`;
    doc.text(lifeText, textX, textY);
    textY += 0.14;
  }

  // Dates
  if (options.includeDates && height >= 1.5) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.text(`MFG: ${formatDate(batch.manufacturing_date)}`, textX, textY);
    textY += 0.12;
    doc.setFont('courier', 'bold');
    doc.text(`EXP: ${formatDate(batch.expiry_date)}`, textX, textY);
    textY += 0.14;
  }

  // Quantity & Valuation
  if ((options.includeQty || options.includeValuation) && height >= 1.2) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    let qtyStr = '';
    if (options.includeQty) {
      qtyStr += `QTY: ${batch.quantity_current} ${batch.unit_of_measure}`;
    }
    if (options.includeValuation) {
      const valStr = `MRP: ${formatINR(batch.unit_cost || 0)}`;
      qtyStr = qtyStr ? `${qtyStr} | ${valStr}` : valStr;
    }
    doc.text(qtyStr, textX, textY);
  }

  // Subtitle under QR
  if (height >= 1.8) {
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.text('SCAN FOR FIFO', qrX + qrSize / 2, qrY + qrSize + 0.1, { align: 'center' });
  }
}

/**
 * Generates and downloads a PDF file containing formatted labels for an inventory batch.
 */
export function generateBatchLabelsPDF(
  batch: InventoryBatch,
  qrDataUrl: string,
  options: PDFLabelOptions
): void {
  const { labelSize, copies } = options;

  let doc: jsPDF;

  if (labelSize === 'sheet') {
    // A4 sheet: 8.27in x 11.69in
    doc = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: 'a4',
    });

    const labelsPerPage = 8;
    const cols = 2;
    const rows = 4;
    const colWidth = 3.8;
    const rowHeight = 2.4;
    const startX = 0.33;
    const startY = 0.6;
    const gapX = 0.15;
    const gapY = 0.25;

    for (let i = 0; i < copies; i++) {
      const pageIndex = Math.floor(i / labelsPerPage);
      const slotIndex = i % labelsPerPage;

      if (i > 0 && slotIndex === 0) {
        doc.addPage('a4', 'portrait');
      }

      const col = slotIndex % cols;
      const row = Math.floor(slotIndex / cols);
      const x = startX + col * (colWidth + gapX);
      const y = startY + row * (rowHeight + gapY);

      drawSingleLabel(doc, x, y, colWidth, rowHeight, batch, qrDataUrl, options);
    }
  } else {
    // Thermal Roll: 4x2, 3x2, or 2x1
    const [w, h] = labelSize === '2x1' ? [2.0, 1.0] : labelSize === '3x2' ? [3.0, 2.0] : [4.0, 2.0];

    doc = new jsPDF({
      orientation: 'landscape',
      unit: 'in',
      format: [w, h],
    });

    for (let i = 0; i < copies; i++) {
      if (i > 0) {
        doc.addPage([w, h], 'landscape');
      }
      drawSingleLabel(doc, 0.05, 0.05, w - 0.1, h - 0.1, batch, qrDataUrl, options);
    }
  }

  // Generate safe filename and trigger download
  const cleanSku = (batch.product_code || 'SKU').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanLot = (batch.batch_number || 'LOT').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${cleanSku}_${cleanLot}_QR_Labels_${labelSize}.pdf`;

  doc.save(filename);
}
