import JsBarcode from 'jsbarcode';

export function formatBarcodeString(productCode: string, batchNumber: string, dateStr: string): string {
  // Format: [PRODUCT_CODE]-[BATCH]-[YYMMDD]
  // Sanitize components (alphanumeric + hyphen)
  const cleanProd = productCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const cleanBatch = batchNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  let datePart = '';
  try {
    const d = new Date(dateStr);
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    datePart = `${yy}${mm}${dd}`;
  } catch {
    datePart = '000000';
  }

  return `${cleanProd}-${cleanBatch}-${datePart}`;
}

export function renderBarcodeToSvg(
  svgElement: SVGSVGElement | null,
  text: string,
  options?: {
    width?: number;
    height?: number;
    displayValue?: boolean;
    fontSize?: number;
    background?: string;
    lineColor?: string;
  }
) {
  if (!svgElement || !text) return;
  try {
    JsBarcode(svgElement, text, {
      format: 'CODE128',
      width: options?.width || 2,
      height: options?.height || 50,
      displayValue: options?.displayValue ?? true,
      font: 'monospace',
      fontSize: options?.fontSize || 13,
      textAlign: 'center',
      textPosition: 'bottom',
      textMargin: 4,
      background: options?.background || 'transparent',
      lineColor: options?.lineColor || '#000000',
      margin: 4,
    });
  } catch (err) {
    console.error('Barcode rendering error:', err);
  }
}

export function renderBarcodeToCanvas(
  canvasElement: HTMLCanvasElement | null,
  text: string,
  options?: {
    width?: number;
    height?: number;
    displayValue?: boolean;
    fontSize?: number;
    background?: string;
    lineColor?: string;
  }
) {
  if (!canvasElement || !text) return;
  try {
    JsBarcode(canvasElement, text, {
      format: 'CODE128',
      width: options?.width || 2,
      height: options?.height || 60,
      displayValue: options?.displayValue ?? true,
      font: 'monospace',
      fontSize: options?.fontSize || 14,
      textAlign: 'center',
      textPosition: 'bottom',
      textMargin: 6,
      background: options?.background || '#FFFFFF',
      lineColor: options?.lineColor || '#000000',
      margin: 10,
    });
  } catch (err) {
    console.error('Barcode canvas rendering error:', err);
  }
}

/**
 * Downloads a high-resolution PNG of the barcode
 */
export function downloadBarcodePng(text: string, filename: string = 'barcode') {
  const canvas = document.createElement('canvas');
  renderBarcodeToCanvas(canvas, text, {
    width: 3,
    height: 90,
    fontSize: 16,
    background: '#FFFFFF',
  });

  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function generateBatchNumber(prefix: string = 'BT'): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(100 + Math.random() * 900);
  return `${prefix}${y}${m}${d}-${rand}`;
}
