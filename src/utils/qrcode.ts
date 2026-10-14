import QRCode from 'qrcode';
import { InventoryBatch } from '../types/inventory';

export type QRPayloadMode = 'json' | 'gs1' | 'compact' | 'custom_url';
export type QRErrorCorrection = 'L' | 'M' | 'Q' | 'H';

/**
 * Builds standard structured payload string for an inventory batch
 */
export function buildBatchQRPayload(
  batch: InventoryBatch,
  mode: QRPayloadMode,
  customText?: string
): string {
  if (mode === 'custom_url' && customText?.trim()) {
    return customText.trim();
  }

  if (mode === 'compact') {
    return `${batch.batch_number}|${batch.product_code}|${batch.location_code}|${batch.expiry_date}`;
  }

  if (mode === 'gs1') {
    // GS1 Application Identifiers:
    // (01) GTIN / EAN: pad or extract from barcode
    // (10) Batch / Lot Number
    // (17) Expiration Date (YYMMDD)
    // (240) Additional Product Identification / Location
    let expYYMMDD = '991231';
    try {
      const d = new Date(batch.expiry_date);
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      expYYMMDD = `${yy}${mm}${dd}`;
    } catch {
      // fallback
    }

    const gtin = (batch.barcode || '').replace(/[^0-9]/g, '').padStart(14, '0').slice(-14);
    return `(01)${gtin}(10)${batch.batch_number}(17)${expYYMMDD}(240)${batch.location_code}`;
  }

  // Default: Smart WMS JSON format
  return JSON.stringify({
    system: 'FIFO-WMS',
    lot: batch.batch_number,
    sku: batch.product_code,
    name: batch.product_name,
    bin: batch.location_code,
    exp: batch.expiry_date,
    mfg: batch.manufacturing_date,
    qty: batch.quantity_current,
    uom: batch.unit_of_measure,
    cost: batch.unit_cost,
    barcode: batch.barcode,
  });
}

/**
 * Generates Base64 Data URL for a QR Code
 */
export async function generateQRCodeDataUrl(
  text: string,
  options?: {
    errorCorrectionLevel?: QRErrorCorrection;
    width?: number;
    margin?: number;
    darkColor?: string;
    lightColor?: string;
  }
): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: options?.errorCorrectionLevel || 'H',
      width: options?.width || 360,
      margin: options?.margin ?? 2,
      color: {
        dark: options?.darkColor || '#000000',
        light: options?.lightColor || '#FFFFFF',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR Code Data URL:', err);
    return '';
  }
}

/**
 * Downloads high resolution PNG of the QR Code
 */
export async function downloadQRCodePng(
  text: string,
  filename: string = 'batch_qr_code'
) {
  try {
    const dataUrl = await generateQRCodeDataUrl(text, {
      width: 1024,
      margin: 3,
      errorCorrectionLevel: 'H',
    });
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('Failed to download QR code image:', err);
  }
}
