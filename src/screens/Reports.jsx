import { useState } from 'preact/hooks';
import { saveSettings } from '../db.js';
import { exportBackup, importBackup, entriesToCsv, shareOrDownload, canShareFiles } from '../backup.js';
import { thisMonth, addMonths, monthRange, monthLabel, monthOf, defaultReportRange, today, dateLabel } from '../rules.js';

const fileSafe = (s) => (s || 'member').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');

function MonthSelect({ value, onChange, label, min, max }) {
  const opts = [];
  for (let m = max; m >= min; m = addMonths(m, -1)) opts.push(m);
  return (
    <label class="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.currentTarget.value)}>
        {opts.map((m) => <option value={m}>{monthLabel(m)}</option>)}
      </select>
    </label>
  );
}

export function Reports({ data, refresh, notify }) {
  const { settings, entries } = data;
  const share = canShareFiles();
  const earliest = entries.reduce((min, e) => (monthOf(e.date) < min ? monthOf(e.date) : min), addMonths(thisMonth(), -12));
  const def = defaultReportRange(settings);
  const [kind, setKind] = useState('one');
  const [one, setOne] = useState(thisMonth());
  const [from, setFrom] = useState(def.from < earliest ? earliest : def.from);
  const [to, setTo] = useState(def.to);
  const [detail, setDetail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const months = kind === 'one' ? [one] : monthRange(from <= to ? from : to, from <= to ? to : from);
  const name = fileSafe(settings.memberName);

  const makePdf = async (preferShare) => {
    setBusy(true);
    setError(null);
    try {
      const { buildReport } = await import('../report.js');
      const blob = buildReport({ months, data, includeDetail: detail });
      const label = months.length === 1 ? months[0] : `${months[0]}_to_${months[months.length - 1]}`;
      await shareOrDownload(blob, `Medicaid-activity-report_${name}_${label}.pdf`, { preferShare });
    } catch (e) {
      setError(`Could not make the report: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const csv = async () => {
    const blob = new Blob([entriesToCsv(entries, settings)], { type: 'text/csv' });
    await shareOrDownload(blob, `Medicaid-hours_${name}_all_${today()}.csv`, { preferShare: false });
  };

  const backup = async () => {
    const json = JSON.stringify(await exportBackup(), null, 1);
    const blob = new Blob([json], { type: 'application/json' });
    const result = await shareOrDownload(blob, `Medicaid-hours-backup_${today()}.json`);
    if (result !== 'cancelled') {
      await saveSettings({ lastBackupAt: new Date().toISOString() });
      await refresh();
      notify('Backup saved');
    }
  };

  const restore = async (file) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const count = parsed?.entries?.length ?? 0;
      if (!confirm(`Replace everything on this phone with this backup (${count} entries)? This cannot be undone.`)) return;
      await importBackup(parsed);
      await refresh();
      notify('Backup restored');
    } catch (e) {
      setError(e instanceof SyntaxError ? 'That file is not a backup from this app.' : e.message);
    }
  };

  return (
    <>
      <h1>Reports</h1>

      <div class="card">
        <h2>Make a report</h2>
        <div class="seg" role="group" aria-label="Report length">
          <button type="button" aria-pressed={kind === 'one'} onClick={() => setKind('one')}>One month</button>
          <button type="button" aria-pressed={kind === 'range'} onClick={() => setKind('range')}>Several months</button>
        </div>
        {kind === 'one' ? (
          <MonthSelect label="Month" value={one} onChange={setOne} min={earliest} max={thisMonth()} />
        ) : (
          <>
            <div class="row">
              <MonthSelect label="From" value={from} onChange={setFrom} min={earliest} max={thisMonth()} />
              <MonthSelect label="To" value={to} onChange={setTo} min={earliest} max={thisMonth()} />
            </div>
            <label class="check">
              <input type="checkbox" checked={detail} onChange={(e) => setDetail(e.currentTarget.checked)} />
              Include every entry, not just the summary
            </label>
            {settings.notice?.months?.length > 0 && (
              <p class="help">Months are set from the notice you entered in Settings.</p>
            )}
          </>
        )}
        <div class="stack">
          {share && <button class="primary block big" disabled={busy} onClick={() => makePdf(true)}>{busy ? 'Making report…' : 'Share report (PDF)'}</button>}
          <button class={`block${share ? '' : ' primary big'}`} disabled={busy} onClick={() => makePdf(false)}>Download report (PDF)</button>
        </div>
        <p class="help">Print the report, sign it, and send it with any proof of income the notice asks for.</p>
      </div>

      <div class="card">
        <h2>Backup</h2>
        <p>
          Your records are saved only on this phone. Save a backup copy to your email or Google Drive so you don't lose them if your phone breaks.
        </p>
        <p class="muted small">
          Last backup: {settings.lastBackupAt ? dateLabel(settings.lastBackupAt.slice(0, 10)) : 'never'}
        </p>
        <div class="stack">
          <button class="primary block" onClick={backup}>{share ? 'Save a backup (share)' : 'Download a backup'}</button>
          <button class="block" onClick={csv}>Download all entries as a spreadsheet (CSV)</button>
          <label class="btn block">
            Restore from a backup file
            <input type="file" accept="application/json,.json" style="display:none" onChange={(e) => { restore(e.currentTarget.files[0]); e.currentTarget.value = ''; }} />
          </label>
        </div>
      </div>

      {error && <p class="error" role="alert">{error}</p>}
    </>
  );
}
