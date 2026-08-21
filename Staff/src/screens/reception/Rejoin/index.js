// Rejoin / In Duration Feature (Staff App)
// Shared utility for computing and checking "In Duration" status.

/**
 * Parse a prescriptionDuration string into milliseconds.
 */
export function parseDurationToMs(durationStr) {
  if (!durationStr) return 0;
  const str = durationStr.trim().toLowerCase();
  const num = parseInt(str, 10);
  if (isNaN(num)) return 0;
  if (str.includes('day')) return num * 24 * 60 * 60 * 1000;
  if (str.includes('month')) return num * 30 * 24 * 60 * 60 * 1000;
  return 0;
}

/**
 * Compute the duration end ISO string from a start date and duration string.
 */
export function computeDurationEnd(startDate, durationStr) {
  const ms = parseDurationToMs(durationStr);
  if (!ms) return null;
  const start = startDate ? new Date(startDate) : new Date();
  return new Date(start.getTime() + ms).toISOString();
}

/**
 * Check if a patient is currently "In Duration".
 */
export function checkIsInDuration(followUpDate) {
  if (!followUpDate) return false;
  let dateStr = '';
  if (typeof followUpDate === 'string') {
    dateStr = followUpDate.split('T')[0];
  } else if (followUpDate && typeof followUpDate.toDate === 'function') {
    dateStr = followUpDate.toDate().toISOString().split('T')[0];
  } else if (followUpDate instanceof Date) {
    dateStr = followUpDate.toISOString().split('T')[0];
  }
  
  if (!dateStr) return false;

  // Robustly handle DD/MM/YYYY or DD-MM-YYYY format
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      if (y.length === 4) {
        dateStr = `${y}-${m}-${d}`;
      } else if (d.length === 4) {
        dateStr = `${d}-${m}-${y}`;
      }
    }
  } else if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[2].length === 4) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      dateStr = `${y}-${m}-${d}`;
    }
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  
  return todayStr <= dateStr;
}

export const DURATION_OPTIONS = [
  '7 Days',
  '15 Days',
  '1 Month',
  '2 Months',
  '3 Months',
  '6 Months',
];
