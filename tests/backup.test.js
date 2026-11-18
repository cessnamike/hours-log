import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, saveEntry, saveSettings, saveIncome, saveEducation, startTimer, loadAll } from '../src/db.js';
import { exportBackup, importBackup, entriesToCsv } from '../src/backup.js';

beforeEach(async () => {
  await Promise.all([db.kv.clear(), db.entries.clear(), db.income.clear(), db.education.clear()]);
});

describe('JSON backup', () => {
  it('restoring an older backup keeps terms accepted on this device', async () => {
    await saveSettings({ memberName: 'Old' });
    const json = JSON.stringify(await exportBackup()); // backup made before terms existed
    await saveSettings({ acceptedTermsVersion: '2026-11-18', memberName: 'New' });
    await importBackup(JSON.parse(json));
    const { settings } = await loadAll();
    expect(settings.memberName).toBe('Old');
    expect(settings.acceptedTermsVersion).toBe('2026-11-18');
  });

  it('round-trips every table without loss', async () => {
    await saveSettings({ memberName: 'Test Member', careRecipients: [{ id: 'r1', name: 'Mom', relationship: 'Mother' }] });
    await saveEntry({ date: '2027-01-02', category: 'caregiving', activity: 'Meds, "lunch", rides\nline 2', durationMinutes: 185, careRecipientId: 'r1', source: 'manual' });
    await saveEntry({ date: '2027-01-03', category: 'self_employment', activity: 'Business prep', durationMinutes: 240, source: 'timer', startTime: '2027-01-03T13:00:00.000Z', endTime: '2027-01-03T17:00:00.000Z' });
    await saveIncome({ month: '2027-01', netIncome: 412.5, source: 'P&L report', isSeasonal: false, attachmentNote: 'Drive' });
    await saveEducation({ month: '2027-01', enrolledHalfTimeOrMore: false, creditHours: 3, schoolName: 'College' });
    await startTimer({ category: 'work', activity: 'Shift' });

    const before = await loadAll();
    const json = JSON.stringify(await exportBackup());

    await Promise.all([db.kv.clear(), db.entries.clear(), db.income.clear(), db.education.clear()]);
    expect((await loadAll()).entries).toHaveLength(0);

    await importBackup(JSON.parse(json));
    expect(await loadAll()).toEqual(before);
  });

  it('rejects a foreign file and leaves data untouched', async () => {
    await saveEntry({ date: '2027-01-02', category: 'work', activity: 'a', durationMinutes: 60 });
    await expect(importBackup({ hello: 1 })).rejects.toThrow(/not a backup/);
    await expect(importBackup({ app: 'ce-tracker', version: 1, kv: [], income: [], education: [], entries: [{ id: 'x', date: 'bad', category: 'work' }] })).rejects.toThrow();
    expect((await loadAll()).entries).toHaveLength(1);
  });
});

describe('CSV', () => {
  it('quotes commas, quotes and newlines and neutralizes formulas', () => {
    const csv = entriesToCsv(
      [{ date: '2027-01-02', category: 'caregiving', activity: 'Meds, "lunch"\nrides', durationMinutes: 90, careRecipientId: 'r1' },
       { date: '2027-01-01', category: 'work', activity: '=HYPERLINK("x")', durationMinutes: 60 }],
      { careRecipients: [{ id: 'r1', name: 'Mom' }], organizations: [] },
    );
    const lines = csv.split('\r\n');
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(lines[2]).toContain('"Meds, ""lunch""\nrides"');
    expect(lines[2]).toContain('Mom');
    expect(lines[2]).toContain(',1.5,');
  });
});
