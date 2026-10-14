import { ShelfLifeStatus, ShelfLifeZone } from '../types/inventory';

export function calculateShelfLifeStatus(
  expiryDateStr: string,
  manufacturingDateStr?: string,
  defaultShelfLifeDays: number = 180
): ShelfLifeStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expDate = new Date(expiryDateStr);
  expDate.setHours(0, 0, 0, 0);

  const mfgDate = manufacturingDateStr ? new Date(manufacturingDateStr) : null;
  if (mfgDate) {
    mfgDate.setHours(0, 0, 0, 0);
  }

  // Calculate days remaining
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysRemaining = Math.round((expDate.getTime() - today.getTime()) / msPerDay);

  // Total shelf life days
  let totalShelfLife = defaultShelfLifeDays || 180;
  if (mfgDate && !isNaN(mfgDate.getTime())) {
    const diff = Math.round((expDate.getTime() - mfgDate.getTime()) / msPerDay);
    if (diff > 0) {
      totalShelfLife = diff;
    }
  }

  // Percentage remaining
  let percentageRemaining = 0;
  if (daysRemaining > 0 && totalShelfLife > 0) {
    percentageRemaining = Math.min(100, Math.max(0, Math.round((daysRemaining / totalShelfLife) * 100)));
  }

  let zone: ShelfLifeZone = 'GREEN';
  let statusLabel = 'GOOD';
  let actionRequired = 'Normal FIFO';
  let bgClass = 'bg-zinc-900/60';
  let textClass = 'text-emerald-400';
  let borderClass = 'border-zinc-800';
  let badgeClass = 'bg-zinc-800/80 text-emerald-400 border border-zinc-700/60';
  let dotColor = '#10b981';

  if (daysRemaining < 0) {
    zone = 'BLACK';
    statusLabel = 'EXPIRED';
    actionRequired = 'Quarantine Required';
    bgClass = 'bg-zinc-950';
    textClass = 'text-zinc-400';
    borderClass = 'border-zinc-800';
    badgeClass = 'bg-zinc-900 text-zinc-400 border border-zinc-700';
    dotColor = '#71717a';
  } else if (daysRemaining === 0 || percentageRemaining < 5) {
    zone = 'RED';
    statusLabel = 'CRITICAL';
    actionRequired = 'Immediate Action';
    bgClass = 'bg-zinc-900/90';
    textClass = 'text-rose-400';
    borderClass = 'border-rose-900/40';
    badgeClass = 'bg-zinc-900 text-rose-400 border border-rose-800/60';
    dotColor = '#f43f5e';
  } else if (percentageRemaining < 15) {
    zone = 'ORANGE';
    statusLabel = 'URGENT';
    actionRequired = 'Clearance Pick';
    bgClass = 'bg-zinc-900/80';
    textClass = 'text-amber-400';
    borderClass = 'border-amber-900/40';
    badgeClass = 'bg-zinc-900 text-amber-400 border border-amber-800/60';
    dotColor = '#f59e0b';
  } else if (percentageRemaining < 30) {
    zone = 'YELLOW';
    statusLabel = 'WARNING';
    actionRequired = 'Priority Pick';
    bgClass = 'bg-zinc-900/70';
    textClass = 'text-yellow-400';
    borderClass = 'border-yellow-900/30';
    badgeClass = 'bg-zinc-900 text-yellow-400 border border-yellow-800/50';
    dotColor = '#eab308';
  } else {
    zone = 'GREEN';
    statusLabel = 'GOOD';
    actionRequired = 'Normal FIFO';
    bgClass = 'bg-zinc-900/60';
    textClass = 'text-emerald-400';
    borderClass = 'border-zinc-800';
    badgeClass = 'bg-zinc-900 text-emerald-400 border border-zinc-800';
    dotColor = '#10b981';
  }

  return {
    zone,
    statusLabel,
    actionRequired,
    daysRemaining,
    percentageRemaining,
    totalShelfLifeDays: totalShelfLife,
    bgClass,
    textClass,
    borderClass,
    badgeClass,
    dotColor,
  };
}

export function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'N/A';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(isoString: string | undefined): string {
  if (!isoString) return 'N/A';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
}
