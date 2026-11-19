import { useEffect, useState } from 'preact/hooks';
import { saveSettings, newId, deleteEverything } from '../db.js';
import { DEFAULT_SETTINGS, incomeThreshold, incomeCeiling, fmtMoney, addMonths, thisMonth, monthLabel, today, dateLabel, localDay } from '../rules.js';

const ORG_TYPES = [
  ['nonprofit', 'Nonprofit'],
  ['public', 'Public agency'],
  ['employer', 'Employer'],
  ['program', 'Job training program'],
  ['school', 'School'],
];

export function Settings({ data, refresh, notify, onDeleted }) {
  const s = data.settings;
  const save = async (patch, msg = 'Saved') => {
    await saveSettings(patch);
    await refresh();
    notify(msg);
  };

  return (
    <>
      <h1>Settings</h1>
      <MemberCard s={s} save={save} />
      <PeopleCard s={s} save={save} data={data} />
      <OrgsCard s={s} save={save} data={data} />
      <RenewalCard s={s} save={save} />
      <NumbersCard s={s} save={save} />
      <StorageCard s={s} save={save} />
      <a class="btn block" href="#/about" style="margin-bottom:14px">About this app and who the rule affects</a>
      <DeleteCard onDeleted={onDeleted} hasData={data.entries.length > 0} lastBackupAt={s.lastBackupAt} />
      {/* Rules modeled on 42 CFR 435.552 / 435.554 / 435.558 (CMS-2454-IFC, 91 FR 33348). */}
    </>
  );
}

function MemberCard({ s, save }) {
  const [f, setF] = useState({ memberName: s.memberName, medicaidId: s.medicaidId });
  return (
    <form class="card" onSubmit={(e) => { e.preventDefault(); save({ memberName: f.memberName.trim(), medicaidId: f.medicaidId.trim(), setupDone: true }); }}>
      <h2>About you</h2>
      <label class="field"><span>Your name</span>
        <input value={f.memberName} autoComplete="name" onInput={(e) => setF({ ...f, memberName: e.currentTarget.value })} />
      </label>
      <label class="field"><span>Medicaid ID (optional)</span>
        <input value={f.medicaidId} onInput={(e) => setF({ ...f, medicaidId: e.currentTarget.value })} />
        <span class="help">It is printed on your report.</span>
      </label>
      <button type="submit" class="primary">Save</button>
    </form>
  );
}

function ListEditor({ title, intro, items, render, blank, onSave, addLabel }) {
  const [editing, setEditing] = useState(null); // item being edited (copy)
  const commit = async () => {
    if (!editing.name?.trim()) return;
    const exists = items.some((i) => i.id === editing.id);
    const next = exists ? items.map((i) => (i.id === editing.id ? { ...editing, name: editing.name.trim() } : i)) : [...items, { ...editing, name: editing.name.trim() }];
    await onSave(next);
    setEditing(null);
  };
  const remove = async () => {
    if (!confirm(`Remove ${editing.name}? Past entries keep their hours but will no longer show this name.`)) return;
    await onSave(items.filter((i) => i.id !== editing.id));
    setEditing(null);
  };
  return (
    <div class="card">
      <h2>{title}</h2>
      {intro && <p class="help" style="margin-bottom:10px">{intro}</p>}
      {!editing && (
        <>
          <ul class="list">
            {items.map((i) => (
              <li><button class="entry" onClick={() => setEditing({ ...i })}><span class="what">{i.name}</span><span class="muted">Edit</span></button></li>
            ))}
          </ul>
          <button class="block" style="margin-top:8px" onClick={() => setEditing({ ...blank(), id: newId() })}>+ {addLabel}</button>
        </>
      )}
      {editing && (
        <form onSubmit={(e) => { e.preventDefault(); commit(); }}>
          {render(editing, (p) => setEditing({ ...editing, ...p }))}
          <div class="row">
            <button type="submit" class="primary">Save</button>
            <button type="button" onClick={() => setEditing(null)}>Cancel</button>
          </div>
          {items.some((i) => i.id === editing.id) && (
            <button type="button" class="danger block" style="margin-top:10px" onClick={remove}>Remove</button>
          )}
        </form>
      )}
    </div>
  );
}

function PeopleCard({ s, save, data }) {
  const used = new Set(data.entries.map((e) => e.careRecipientId));
  return (
    <ListEditor
      title="People you care for"
      intro="Family members you help, like a parent or sister with a disability."
      items={s.careRecipients || []}
      addLabel="Add a person"
      blank={() => ({ name: '', relationship: '' })}
      onSave={(careRecipients) => save({ careRecipients })}
      render={(p, set) => (
        <>
          <label class="field"><span>Name</span><input value={p.name} onInput={(e) => set({ name: e.currentTarget.value })} /></label>
          <label class="field"><span>How they are related to you</span>
            <input value={p.relationship} placeholder="Like: Mother, Sister" onInput={(e) => set({ relationship: e.currentTarget.value })} />
          </label>
          {used.has(p.id) && <p class="help">This person is on past entries.</p>}
        </>
      )}
    />
  );
}

function OrgsCard({ s, save }) {
  return (
    <ListEditor
      title="Places and groups"
      intro="Volunteer groups, employers, job training programs and schools. Volunteer groups need a contact person for your report."
      items={s.organizations || []}
      addLabel="Add a place or group"
      blank={() => ({ name: '', type: 'nonprofit', contactName: '', contactPhone: '', contactEmail: '' })}
      onSave={(organizations) => save({ organizations })}
      render={(o, set) => (
        <>
          <label class="field"><span>Name</span><input value={o.name} onInput={(e) => set({ name: e.currentTarget.value })} /></label>
          <label class="field"><span>Type</span>
            <select value={o.type} onChange={(e) => set({ type: e.currentTarget.value })}>
              {ORG_TYPES.map(([v, l]) => <option value={v}>{l}</option>)}
            </select>
          </label>
          <label class="field"><span>Contact person</span><input value={o.contactName} onInput={(e) => set({ contactName: e.currentTarget.value })} /></label>
          <label class="field"><span>Contact phone</span><input type="tel" value={o.contactPhone} onInput={(e) => set({ contactPhone: e.currentTarget.value })} /></label>
          <label class="field"><span>Contact email</span><input type="email" value={o.contactEmail} onInput={(e) => set({ contactEmail: e.currentTarget.value })} /></label>
        </>
      )}
    />
  );
}

function RenewalCard({ s, save }) {
  const [f, setF] = useState({ lastRenewalDate: s.lastRenewalDate || '', nextRenewalDate: s.nextRenewalDate || '' });
  const [n, setN] = useState(() => ({
    receivedDate: s.notice?.receivedDate || '',
    months: s.notice?.months || [],
  }));
  const choices = [];
  for (let i = 0; i < 12; i++) choices.push(addMonths(thisMonth(), -i));
  const toggle = (m) => setN({ ...n, months: n.months.includes(m) ? n.months.filter((x) => x !== m) : [...n.months, m].sort() });

  return (
    <>
      <form class="card" onSubmit={(e) => { e.preventDefault(); save(f); }}>
        <h2>Medicaid renewal</h2>
        <p class="help" style="margin-bottom:10px">
          Find these on your Medicaid approval or renewal letter, or in your WV PATH account. Home will count down to the next one.
        </p>
        <label class="field"><span>Last renewal or approval date</span>
          <input type="date" value={f.lastRenewalDate} onInput={(e) => setF({ ...f, lastRenewalDate: e.currentTarget.value })} />
        </label>
        <label class="field"><span>Next renewal date</span>
          <input type="date" value={f.nextRenewalDate} onInput={(e) => setF({ ...f, nextRenewalDate: e.currentTarget.value })} />
          <span class="help">Home counts down to this date. Your report for several months covers the months before it.</span>
        </label>
        <button type="submit" class="primary">Save</button>
      </form>

      <form class="card" onSubmit={(e) => {
        e.preventDefault();
        if (!n.receivedDate) return;
        save({ notice: { receivedDate: n.receivedDate, months: n.months } }, 'Notice saved');
      }}>
        <h2>Got a letter from Medicaid?</h2>
        <p class="help" style="margin-bottom:10px">
          If the state asks you to prove your hours, you have 30 days from the day you get the letter. Enter it here and the app will count down.
        </p>
        <label class="field"><span>Day you got the letter</span>
          <input type="date" max={today()} value={n.receivedDate} onInput={(e) => setN({ ...n, receivedDate: e.currentTarget.value })} />
        </label>
        <span class="field-label">Months the letter asks about</span>
        <div class="chips" style="margin-bottom:14px">
          {choices.map((m) => (
            <button type="button" class="chip sm" aria-pressed={n.months.includes(m)} onClick={() => toggle(m)}>{monthLabel(m)}</button>
          ))}
        </div>
        <div class="row">
          <button type="submit" class="primary" disabled={!n.receivedDate}>Save</button>
          {s.notice && (
            <button type="button" onClick={async () => { await save({ notice: null }, 'Notice cleared'); setN({ receivedDate: '', months: [] }); }}>
              Done with it
            </button>
          )}
        </div>
      </form>
    </>
  );
}

function NumbersCard({ s, save }) {
  const KEYS = ['householdSize', 'minWage', 'monthlyHourTarget', 'povertyGuidelineBase', 'povertyGuidelinePerPerson', 'incomeLimitPercent'];
  const pick = (src) => Object.fromEntries(KEYS.map((k) => [k, String(src[k])]));
  const [f, setF] = useState(() => pick(s));
  const nums = Object.fromEntries(KEYS.map((k) => [k, Number(f[k])]));
  const valid = nums.householdSize >= 1 && nums.minWage > 0 && nums.monthlyHourTarget > 0 &&
    nums.povertyGuidelineBase > 0 && nums.povertyGuidelinePerPerson >= 0 && nums.incomeLimitPercent > 0;
  const field = (k, label, extra = {}) => (
    <label class="field"><span>{label}</span>
      <input type="number" inputMode="decimal" step="any" value={f[k]} onInput={(e) => setF({ ...f, [k]: e.currentTarget.value })} {...extra} />
    </label>
  );
  return (
    <form class="card" onSubmit={(e) => {
      e.preventDefault();
      if (!valid) return;
      save({ ...nums, householdSize: Math.floor(nums.householdSize) });
    }}>
      <h2>Household and limits</h2>
      {field('householdSize', 'People in your household', { min: 1, step: 1, inputMode: 'numeric' })}
      <p class="muted small">Income warning level: <b>{fmtMoney(incomeCeiling(nums))}</b> a month.
        You'll see a warning when your net income is above this. It does not decide anything. The state counts
        the whole household's income.</p>
      <details>
        <summary>Rule numbers (change only if the rules change)</summary>
        {field('minWage', 'Federal minimum wage ($ an hour)')}
        {field('monthlyHourTarget', 'Hours needed each month', { inputMode: 'numeric' })}
        <p class="muted small">Income that meets a month: <b>{fmtMoney(incomeThreshold(nums))}</b></p>
        {field('povertyGuidelineBase', 'Poverty guideline, 1 person ($ a year)')}
        {field('povertyGuidelinePerPerson', 'Poverty guideline, each added person ($ a year)')}
        {field('incomeLimitPercent', 'Income limit (% of poverty guideline)')}
      </details>
      <div class="row" style="margin-top:12px">
        <button type="submit" class="primary" disabled={!valid}>Save</button>
        <button type="button" onClick={() => setF({ ...pick(DEFAULT_SETTINGS), householdSize: f.householdSize })}>Use defaults</button>
      </div>
    </form>
  );
}

function StorageCard({ s, save }) {
  const [persisted, setPersisted] = useState(null);
  const [days, setDays] = useState(String(s.backupReminderDays));
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);
  return (
    <form class="card" onSubmit={(e) => { e.preventDefault(); save({ backupReminderDays: Math.max(1, Number(days) || 30) }); }}>
      <h2>Saving your records</h2>
      <p class="small">
        {persisted === true && 'Your records are protected from being cleared by the phone.'}
        {persisted === false && 'Tip: add this app to your home screen so the phone keeps your records safe.'}
        {persisted === null && 'Your records are saved on this phone only.'}
      </p>
      <label class="field"><span>Remind me to back up every (days)</span>
        <input type="number" inputMode="numeric" min="1" value={days} onInput={(e) => setDays(e.currentTarget.value)} />
      </label>
      <button type="submit" class="primary">Save</button>
    </form>
  );
}

function DeleteCard({ onDeleted, hasData, lastBackupAt }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await deleteEverything(); } finally { onDeleted(); }
  };
  return (
    <div class="card">
      <h2>Delete everything</h2>
      {!open ? (
        <>
          <p class="help" style="margin-bottom:10px">Remove all your records and this app's files from this device.</p>
          <button class="danger block" onClick={() => setOpen(true)}>Delete everything…</button>
        </>
      ) : (
        <>
          <div class="banner bad">
            This erases every record on this device. It cannot be undone.
            {hasData && (
              <span class="sub">
                {lastBackupAt ? `Your last backup was ${dateLabel(localDay(lastBackupAt))}. ` : 'You have never saved a backup. '}
                <a href="#/reports">Save a backup first</a>
              </span>
            )}
          </div>
          <div class="row">
            <button class="danger" disabled={busy} onClick={run}>{busy ? 'Deleting…' : 'Yes, delete everything'}</button>
            <button onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
