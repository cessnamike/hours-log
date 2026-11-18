import { db } from './db.js';
import { CAT, round2, entryNet } from './rules.js';

const localTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '');

export const BACKUP_APP = 'ce-tracker';
export const BACKUP_VERSION = 1;

export async function exportBackup() {
  const [kv, entries, income, education] = await Promise.all([
    db.kv.toArray(),
    db.entries.toArray(),
    db.income.toArray(),
    db.education.toArray(),
  ]);
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    kv,
    entries,
    income,
    education,
  };
}

export function validateBackup(data) {
  if (!data || data.app !== BACKUP_APP) throw new Error('This file is not a backup from this app.');
  if (data.version > BACKUP_VERSION) throw new Error('This backup is from a newer version of the app. Update the app first.');
  for (const k of ['kv', 'entries', 'income', 'education']) {
    if (!Array.isArray(data[k])) throw new Error(`The backup file is damaged (missing ${k}).`);
  }
  for (const e of data.entries) {
    if (!e.id || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || !CAT[e.category]) {
      throw new Error('The backup file has an entry that does not look right. Nothing was changed.');
    }
  }
  return data;
}

// Replaces everything on this device with the backup, in one transaction.
export async function importBackup(data) {
  validateBackup(data);
  await db.transaction('rw', db.kv, db.entries, db.income, db.education, async () => {
    // Terms accepted on this device stay accepted, even if the backup is older.
    const accepted = (await db.kv.get('settings'))?.value?.acceptedTermsVersion || null;
    await Promise.all([db.kv.clear(), db.entries.clear(), db.income.clear(), db.education.clear()]);
    await db.kv.bulkPut(data.kv);
    if (accepted) {
      const cur = (await db.kv.get('settings'))?.value || {};
      await db.kv.put({ key: 'settings', value: { ...cur, acceptedTermsVersion: accepted } });
    }
    await db.entries.bulkPut(data.entries);
    await db.income.bulkPut(data.income);
    await db.education.bulkPut(data.education);
  });
}

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Guard against spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function entriesToCsv(entries, settings) {
  const recips = Object.fromEntries((settings.careRecipients || []).map((r) => [r.id, r.name]));
  const orgs = Object.fromEntries((settings.organizations || []).map((o) => [o.id, o.name]));
  const header = ['Date', 'Category', 'Activity', 'Minutes', 'Hours', 'Start', 'End', 'Entered by', 'Care recipient', 'Organization', 'Notes', 'Paid', 'Paid out', 'Paid out to', 'Net pay'];
  const rows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => [
      e.date,
      CAT[e.category]?.formal || e.category,
      e.activity,
      e.durationMinutes,
      round2(e.durationMinutes / 60),
      localTime(e.startTime),
      localTime(e.endTime),
      e.source === 'timer' ? 'Timer' : 'Manual',
      recips[e.careRecipientId] || '',
      orgs[e.organizationId] || '',
      e.notes || '',
      e.grossPay ?? '',
      e.payExpenses ?? '',
      e.payExpenseNote || '',
      entryNet(e) ?? '',
    ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// Share through the phone's share menu when possible (email, Drive...), else download.
export async function shareOrDownload(blob, filename, { preferShare = true } = {}) {
  const file = typeof File !== 'undefined' ? new File([blob], filename, { type: blob.type }) : null;
  if (preferShare && file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      // fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

export const canShareFiles = () => {
  try {
    return !!navigator.canShare?.({ files: [new File(['x'], 'x.txt', { type: 'text/plain' })] });
  } catch {
    return false;
  }
};
