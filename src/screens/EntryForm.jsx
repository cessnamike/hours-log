import { useState } from 'preact/hooks';
import { saveEntry, deleteEntry, clearTimer } from '../db.js';
import { today, ymd, fmtDuration, needsOrg, needsRecipient, takesPay, fmtMoney, round2 } from '../rules.js';
import { CategoryChips, Stepper, go } from '../ui.jsx';
import { DetailFields, validateDetails } from '../fields.jsx';

const hhmm = (iso) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const toIso = (date, time) => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
};
const minutesBetween = (start, end) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60; // ended after midnight
  return diff;
};

const money = (v) => (v === null || v === undefined ? '' : String(v));
const blankPay = { grossPay: '', payExpenses: '', payExpenseNote: '' };

function initialForm(existing, timer, params) {
  if (existing) {
    const timed = !!(existing.startTime && existing.endTime);
    return {
      ...existing,
      mode: timed ? 'times' : 'duration',
      hours: Math.floor(existing.durationMinutes / 60),
      minutes: existing.durationMinutes % 60,
      start: timed ? hhmm(existing.startTime) : '',
      end: timed ? hhmm(existing.endTime) : '',
      grossPay: money(existing.grossPay),
      payExpenses: money(existing.payExpenses),
      payExpenseNote: existing.payExpenseNote || '',
      exactStart: timed ? existing.startTime : null,
      exactEnd: timed ? existing.endTime : null,
    };
  }
  if (timer) {
    const startD = new Date(timer.startedAt);
    const now = new Date();
    return {
      category: timer.category,
      activity: timer.activity || '',
      careRecipientId: timer.careRecipientId || '',
      organizationId: timer.organizationId || '',
      notes: timer.notes || '',
      date: ymd(startD),
      mode: 'times',
      hours: 0,
      minutes: 0,
      start: hhmm(timer.startedAt),
      end: hhmm(now.toISOString()),
      source: 'timer',
      ...blankPay,
      // Keep exact seconds-accurate stamps unless the user edits the times.
      exactStart: timer.startedAt,
      exactEnd: now.toISOString(),
    };
  }
  return {
    category: params?.get('cat') || '',
    activity: '',
    careRecipientId: '',
    organizationId: '',
    notes: '',
    date: today(),
    mode: 'duration',
    hours: 1,
    minutes: 0,
    start: '',
    end: '',
    source: 'manual',
    ...blankPay,
  };
}

export function EntryForm({ data, refresh, notify, route, id, timer }) {
  const existing = id ? data.entries.find((e) => e.id === id) : null;
  const [form, setForm] = useState(() => initialForm(existing, timer, route?.params));
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  if (id && !existing) {
    return (
      <>
        <h1>Entry not found</h1>
        <a class="btn" href="#/history">Back to history</a>
      </>
    );
  }

  const duration =
    form.mode === 'times'
      ? form.exactStart && form.exactEnd && form.start === hhmm(form.exactStart) && form.end === hhmm(form.exactEnd)
        ? Math.max(1, Math.round((new Date(form.exactEnd) - new Date(form.exactStart)) / 60000)) // a running timer always records at least 1 minute
        : minutesBetween(form.start, form.end)
      : (Number(form.hours) || 0) * 60 + (Number(form.minutes) || 0);

  const save = async () => {
    const msg = validateDetails(form, data.settings);
    if (msg) return setError(msg);
    if (!form.date) return setError('Pick a date.');
    if (form.date > today()) return setError('The date cannot be in the future.');
    if (form.mode === 'times' && (!form.start || !form.end)) return setError('Enter a start and an end time.');
    if (duration <= 0) return setError('The time must be more than 0 minutes.');
    if (duration > 24 * 60) return setError('One entry cannot be more than 24 hours.');
    const hasPay = takesPay(form.category) && form.grossPay !== '';
    if (hasPay && !(Number(form.grossPay) >= 0)) return setError('The amount you were paid must be a number, 0 or more.');
    if (hasPay && form.payExpenses !== '' && !(Number(form.payExpenses) >= 0)) return setError('The amount you paid out must be a number, 0 or more.');
    if (!hasPay && takesPay(form.category) && form.payExpenses !== '') return setError('Enter the amount you were paid, or clear the amount paid out.');

    let startTime = null;
    let endTime = null;
    if (form.mode === 'times') {
      const untouched = form.exactStart && form.start === hhmm(form.exactStart) && form.end === hhmm(form.exactEnd);
      startTime = untouched ? form.exactStart : toIso(form.date, form.start);
      endTime = untouched ? form.exactEnd : new Date(new Date(startTime).getTime() + duration * 60000).toISOString();
    }

    const row = {
      id: existing?.id,
      createdAt: existing?.createdAt,
      date: form.date,
      category: form.category,
      activity: form.activity.trim(),
      durationMinutes: duration,
      startTime,
      endTime,
      source: form.source || 'manual',
      careRecipientId: needsRecipient(form.category) ? form.careRecipientId : null,
      organizationId: needsOrg(form.category) ? form.organizationId || null : null,
      notes: form.notes?.trim() || '',
      grossPay: hasPay ? round2(Number(form.grossPay)) : null,
      payExpenses: hasPay && form.payExpenses !== '' ? round2(Number(form.payExpenses)) : null,
      payExpenseNote: hasPay ? form.payExpenseNote.trim() : '',
    };
    await saveEntry(row);
    if (timer) await clearTimer();
    await refresh();
    notify(existing ? 'Changes saved' : `Saved ${fmtDuration(duration)}`);
    go(existing ? '#/history' : '#/');
  };

  const remove = async () => {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    await deleteEntry(existing.id);
    await refresh();
    notify('Entry deleted');
    go('#/history');
  };

  const discardTimer = async () => {
    if (!confirm('Throw away this timer without saving?')) return;
    await clearTimer();
    await refresh();
    go('#/');
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }}>
      <a class="btn ghost back" href={existing ? '#/history' : '#/'}>‹ Back</a>
      <h1>{existing ? 'Edit or delete' : timer ? 'Save your time' : 'Add time'}</h1>

      <div class="card">
        <span class="field-label">What kind of time?</span>
        <CategoryChips value={form.category} onChange={(c) => set({ category: c })} />
      </div>

      {form.category && (
        <div class="card">
          <DetailFields form={form} set={set} data={data} refresh={refresh} />

          <label class="field">
            <span>Date</span>
            <input type="date" value={form.date} max={today()} onInput={(e) => set({ date: e.currentTarget.value })} />
          </label>

          <div class="seg" role="group" aria-label="How to enter time">
            <button type="button" aria-pressed={form.mode === 'duration'} onClick={() => set({ mode: 'duration' })}>How long</button>
            <button type="button" aria-pressed={form.mode === 'times'} onClick={() => set({ mode: 'times' })}>Start and end</button>
          </div>

          {form.mode === 'duration' ? (
            <div class="stack" style="margin-bottom:14px">
              <Stepper label="hours" unit="hours" value={form.hours} max={24} onChange={(v) => set({ hours: v })} />
              <Stepper label="minutes" unit="min" step={15} max={59} value={form.minutes} onChange={(v) => set({ minutes: v })} />
            </div>
          ) : (
            <div class="row" style="margin-bottom:14px">
              <label class="field" style="margin:0"><span>Start</span>
                <input type="time" value={form.start} onInput={(e) => set({ start: e.currentTarget.value })} />
              </label>
              <label class="field" style="margin:0"><span>End</span>
                <input type="time" value={form.end} onInput={(e) => set({ end: e.currentTarget.value })} />
              </label>
            </div>
          )}
          <p class="muted">Total: <b>{fmtDuration(duration)}</b></p>
          {duration > 12 * 60 && <p class="error">That is more than 12 hours. Check the times.</p>}

          {takesPay(form.category) && <PayFields form={form} set={set} />}

        </div>
      )}

      {error && <p class="error" role="alert">{error}</p>}
      <div class="stack">
        <button type="submit" class="primary block big">Save</button>
        {existing && <button type="button" class="danger block" onClick={remove}>Delete entry</button>}
        {timer && <button type="button" class="danger block" onClick={discardTimer}>Throw away timer</button>}
      </div>
    </form>
  );
}

function PayFields({ form, set }) {
  const gross = form.grossPay === '' ? null : Number(form.grossPay) || 0;
  const out = Number(form.payExpenses) || 0;
  return (
    <div class="pay-box">
      <h3>Pay for this</h3>
      <label class="field">
        <span>Amount you were paid ($)</span>
        <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
          value={form.grossPay} onInput={(e) => set({ grossPay: e.currentTarget.value })} />
      </label>
      <label class="field">
        <span>Amount you paid out ($)</span>
        <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
          value={form.payExpenses} onInput={(e) => set({ payExpenses: e.currentTarget.value })} />
        <span class="help">Like a share you pay the place where you worked. Leave blank if none.</span>
      </label>
      {form.payExpenses !== '' && (
        <label class="field">
          <span>Paid out to (optional)</span>
          <input value={form.payExpenseNote} placeholder="Like: Venue's share"
            onInput={(e) => set({ payExpenseNote: e.currentTarget.value })} maxLength={120} />
        </label>
      )}
      {gross !== null && (
        <p class="net-line">You kept: <b>{fmtMoney(round2(gross - out))}</b></p>
      )}
    </div>
  );
}
