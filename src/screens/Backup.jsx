import { useState } from 'preact/hooks';
import { saveSettings } from '../db.js';
import { exportBackup, importBackup, downloadFile, canShareFiles } from '../backup.js';
import { today, dateLabel, localDay } from '../rules.js';
import { platform } from '../install.js';
import { go } from '../ui.jsx';

const BASE = () => `Medicaid-hours-backup_${today()}`;

// Where a downloaded file ends up, in words people can follow.
export function whereDownloadsGo() {
  const p = platform();
  if (p === 'ios') return 'in the Files app, in the Downloads folder';
  if (p === 'android') return 'in your Downloads folder (open the Files app, or in Chrome tap ⋮ then Downloads)';
  return 'in your Downloads folder';
}

async function backupBlob(type) {
  const json = JSON.stringify(await exportBackup(), null, 1);
  return new Blob([json], { type });
}

export function BackupCard({ data, refresh }) {
  const { settings } = data;
  const [saved, setSaved] = useState(null); // { how: 'download' | 'share', name }
  const [error, setError] = useState(null);
  // Phones' share menus take plain-text files but often refuse .json, so the shared copy is a .txt.
  const canShare = canShareFiles();

  const mark = async () => {
    await saveSettings({ lastBackupAt: new Date().toISOString() });
    await refresh();
  };

  const download = async () => {
    setError(null);
    const name = `${BASE()}.json`;
    downloadFile(await backupBlob('application/json'), name);
    await mark();
    setSaved({ how: 'download', name });
  };

  const share = async () => {
    setError(null);
    const name = `${BASE()}.txt`;
    const file = new File([await backupBlob('text/plain')], name, { type: 'text/plain' });
    try {
      await navigator.share({ files: [file], title: 'Hours Log backup' });
      await mark();
      setSaved({ how: 'share', name });
    } catch (e) {
      if (e?.name === 'AbortError') return; // closed the share menu
      setError('This phone would not share the file. Use "Save a backup" instead.');
    }
  };

  return (
    <div class="card">
      <h2>Backup</h2>
      <p>Your records are saved only on this phone. A backup is a copy you can put back if your phone breaks, gets lost, or you get a new one.</p>
      <p class="muted small">Last backup: {settings.lastBackupAt ? dateLabel(localDay(settings.lastBackupAt)) : 'never'}</p>
      <div class="stack">
        <button class="primary block big" onClick={download}>Save a backup</button>
        {canShare && <button class="block" onClick={share}>Email or text a backup to myself</button>}
      </div>
      {saved && (
        <div class="banner good saved" role="status">
          Backup saved.
          <span class="sub">
            {saved.how === 'download'
              ? <>It is {whereDownloadsGo()}, named <b class="fname">{saved.name}</b>.{canShare && ' To keep a copy off this phone, also email or text it to yourself.'}</>
              : <>You sent <b class="fname">{saved.name}</b>. Keep that message: it is your backup.</>}
          </span>
        </div>
      )}
      {error && <p class="error" role="alert">{error}</p>}
      <p class="help"><a href="#/restore">Put back a backup</a> (new phone, or moving from another copy of the app)</p>
    </div>
  );
}

export function RestoreScreen({ data, refresh, notify }) {
  const [error, setError] = useState(null);
  const empty = !data.entries.length;
  const ios = platform() === 'ios';

  const restore = async (file) => {
    if (!file) return;
    setError(null);
    try {
      let parsed;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new Error('That file is not an Hours Log backup. Pick the file whose name starts with Medicaid-hours-backup.');
      }
      const count = parsed?.entries?.length ?? 0;
      if (!empty && !confirm(`Replace everything in the app with this backup (${count} entries)? What is in the app now will be gone.`)) return;
      await importBackup(parsed);
      await refresh();
      notify(`Backup put back: ${count} ${count === 1 ? 'entry' : 'entries'}`);
      go('#/');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <h1>Put back a backup</h1>
      <div class="card">
        <ol class="steps">
          <li>
            <b>If the backup is in an email or text:</b> open it, tap the file, and choose <b>Download</b> or <b>Save</b>. (If it is already in Downloads, skip this.)
          </li>
          <li>Tap <b>Choose my backup file</b> below.</li>
          <li>
            {ios
              ? <>Tap <b>Browse</b>, then <b>Downloads</b>.</>
              : <>Tap <b>Downloads</b>. (If you don't see it, tap <b>☰</b> first.)</>}
          </li>
          <li>Tap the file whose name starts with <b>Medicaid-hours-backup</b>. Pick the newest one.</li>
        </ol>
        <label class="btn primary block big">
          Choose my backup file
          {/* No file-type filter: some phones grey out backup files when one is set. The content is checked instead. */}
          <input type="file" style="display:none" onChange={(e) => { restore(e.currentTarget.files[0]); e.currentTarget.value = ''; }} />
        </label>
        {!empty && <p class="help">This replaces what is in the app now with what is in the backup.</p>}
        {error && <p class="error" role="alert">{error}</p>}
      </div>
    </>
  );
}
