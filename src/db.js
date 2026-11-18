import Dexie from 'dexie';
import { DEFAULT_SETTINGS } from './rules.js';

export const db = new Dexie('ce-tracker');
db.version(1).stores({
  entries: 'id, date, category, updatedAt',
  income: 'month',
  education: 'month',
  kv: 'key', // 'settings', 'activeTimer'
});

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// ---------- settings ----------
export async function getSettings() {
  const row = await db.kv.get('settings');
  return { ...DEFAULT_SETTINGS, ...(row?.value || {}) };
}
export async function saveSettings(patch) {
  const cur = await getSettings();
  const value = { ...cur, ...patch };
  await db.kv.put({ key: 'settings', value });
  return value;
}

// ---------- entries ----------
export async function saveEntry(entry) {
  const now = new Date().toISOString();
  const row = { ...entry, id: entry.id || newId(), createdAt: entry.createdAt || now, updatedAt: now };
  await db.entries.put(row);
  return row;
}
export const deleteEntry = (id) => db.entries.delete(id);

// ---------- monthly records ----------
export const saveIncome = (rec) => db.income.put({ ...rec, updatedAt: new Date().toISOString() });
export const deleteIncome = (month) => db.income.delete(month);
export const saveEducation = (rec) => db.education.put({ ...rec, updatedAt: new Date().toISOString() });
export const deleteEducation = (month) => db.education.delete(month);

// ---------- timer (survives closing the app: only startedAt is stored) ----------
export async function getTimer() {
  return (await db.kv.get('activeTimer'))?.value || null;
}
export async function startTimer(t) {
  if (await getTimer()) throw new Error('A timer is already running.');
  const value = { ...t, startedAt: new Date().toISOString() };
  await db.kv.put({ key: 'activeTimer', value });
  return value;
}
export const clearTimer = () => db.kv.delete('activeTimer');

// ---------- delete everything: records, offline copy and the installed worker ----------
export async function deleteEverything() {
  db.close();
  await Dexie.delete('ce-tracker');
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* storage may be blocked */ }
  if (globalThis.caches) {
    for (const k of await caches.keys()) await caches.delete(k);
  }
  if (navigator.serviceWorker) {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  }
}

// ---------- load everything (data is small: a few thousand rows a year) ----------
export async function loadAll() {
  const [settings, entries, income, education, timer] = await Promise.all([
    getSettings(),
    db.entries.toArray(),
    db.income.toArray(),
    db.education.toArray(),
    getTimer(),
  ]);
  entries.sort((a, b) => (b.date + (b.startTime || b.createdAt)).localeCompare(a.date + (a.startTime || a.createdAt)));
  return {
    settings,
    entries,
    incomeByMonth: Object.fromEntries(income.map((r) => [r.month, r])),
    educationByMonth: Object.fromEntries(education.map((r) => [r.month, r])),
    timer,
  };
}

