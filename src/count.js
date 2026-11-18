// One anonymous "first open" count per device, if a counter is configured.
// Sends no ID, no name, no records: only that the app was opened for the first time.
import { COUNT_URL } from './config.js';

export function countFirstOpen() {
  if (!COUNT_URL || !navigator.onLine) return;
  try {
    const url = `${COUNT_URL}${COUNT_URL.includes('?') ? '&' : '?'}rnd=${Math.random().toString(36).slice(2)}`;
    fetch(url, { mode: 'no-cors', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true }).catch(() => {});
  } catch {
    // Counting must never get in the way of the app.
  }
}
