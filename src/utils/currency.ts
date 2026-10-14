/**
 * Currency utility configured for INR (Indian Rupee - ₹) standard formatting
 */

export const CURRENCY_CODE = 'INR';
export const CURRENCY_SYMBOL = '₹';

/**
 * Formats a number into Indian Rupee (INR - ₹) standard format (e.g. ₹1,50,000.00)
 */
export function formatINR(
  amount: number | undefined | null,
  options?: {
    showSymbol?: boolean;
    decimals?: number;
    compact?: boolean;
  }
): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return options?.showSymbol !== false ? '₹0.00' : '0.00';
  }

  const decimals = options?.decimals !== undefined ? options.decimals : 2;
  const showSymbol = options?.showSymbol !== false;

  if (options?.compact && Math.abs(amount) >= 10000000) {
    const crores = (amount / 10000000).toFixed(2);
    return showSymbol ? `₹${crores} Cr` : `${crores} Cr`;
  }

  if (options?.compact && Math.abs(amount) >= 100000) {
    const lakhs = (amount / 100000).toFixed(2);
    return showSymbol ? `₹${lakhs} L` : `${lakhs} L`;
  }

  try {
    const formatted = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);

    return showSymbol ? `₹${formatted}` : formatted;
  } catch {
    return showSymbol ? `₹${amount.toFixed(decimals)}` : amount.toFixed(decimals);
  }
}

/**
 * Generic alias for standard currency formatting
 */
export const formatCurrency = formatINR;
