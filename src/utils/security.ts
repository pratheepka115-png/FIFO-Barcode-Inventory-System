/**
 * Enterprise Cybersecurity & Input Sanitization Utilities
 * Protects against XSS, Injection, and unauthorized operations
 */

export function sanitizeInput(input: string | undefined | null): string {
  if (!input) return '';
  return String(input)
    .replace(/[<>]/g, '') // Strip angle brackets to eliminate HTML/script injection
    .trim();
}

export function sanitizeNotes(notes: string | undefined | null): string {
  if (!notes) return '';
  return String(notes)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/onerror=/gi, '')
    .replace(/onload=/gi, '')
    .trim();
}

export function validatePinCode(pin: string): { isValid: boolean; message?: string } {
  const clean = (pin || '').trim();
  if (!clean) {
    return { isValid: false, message: 'PIN code cannot be empty.' };
  }
  if (!/^\d{4,6}$/.test(clean)) {
    return { isValid: false, message: 'PIN code must be 4 to 6 numeric digits.' };
  }
  return { isValid: true };
}

export interface SecurityEventLog {
  id: string;
  timestamp: string;
  eventType:
    | 'AUTH_SUCCESS'
    | 'AUTH_FAILED'
    | 'FIFO_OVERRIDE'
    | 'DISPATCH_REVERSAL'
    | 'STOCK_ADJUSTMENT'
    | 'STOCK_WRITEOFF'
    | 'RECORD_DELETED'
    | 'SETTINGS_CHANGED'
    | 'FACTORY_RESET'
    | 'RATE_LIMIT_LOCKOUT';
  description: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  ipAddress?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}
