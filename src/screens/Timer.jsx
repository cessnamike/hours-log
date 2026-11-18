import { useState } from 'preact/hooks';
import { startTimer } from '../db.js';
import { CAT } from '../rules.js';
import { CategoryChips, go, useNow, fmtElapsed } from '../ui.jsx';
import { DetailFields, validateDetails } from '../fields.jsx';
import { EntryForm } from './EntryForm.jsx';

export function TimerScreen(props) {
  const { data, refresh, stopping } = props;
  const timer = data.timer;

  if (timer && stopping) return <EntryForm {...props} timer={timer} />;
  if (timer) return <Running timer={timer} data={data} />;
  return <StartTimer data={data} refresh={refresh} />;
}

function Running({ timer, data }) {
  const now = useNow();
  const recip = data.settings.careRecipients?.find((r) => r.id === timer.careRecipientId);
  const org = data.settings.organizations?.find((o) => o.id === timer.organizationId);
  const started = new Date(timer.startedAt);
  return (
    <>
      <h1>Timer running</h1>
      <div class="card center">
        <p class="muted">{CAT[timer.category]?.label}{recip ? ` · ${recip.name}` : ''}{org ? ` · ${org.name}` : ''}</p>
        <p><b>{timer.activity}</b></p>
        {timer.notes && <p class="muted small">{timer.notes}</p>}
        <p class="muted small">You can add or change the description when you stop.</p>
        <div class="big-elapsed" aria-live="off">{fmtElapsed(now - started)}</div>
        <p class="muted small">
          Started {started.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.
          It keeps counting even if you close the app.
        </p>
        <button class="primary block big" onClick={() => go('#/timer/stop')}>Stop</button>
      </div>
    </>
  );
}

function StartTimer({ data, refresh }) {
  const [form, setForm] = useState({ category: '', activity: '', notes: '', careRecipientId: '', organizationId: '' });
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const start = async () => {
    const msg = validateDetails(form, data.settings);
    if (msg) return setError(msg);
    try {
      await startTimer({
        category: form.category,
        activity: form.activity.trim(),
        notes: form.notes.trim(),
        careRecipientId: form.careRecipientId || null,
        organizationId: form.organizationId || null,
      });
    } catch (e) {
      return setError(e.message);
    }
    await refresh();
    go('#/');
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); start(); }}>
      <a class="btn ghost back" href="#/">‹ Back</a>
      <h1>Start a timer</h1>
      <div class="card">
        <span class="field-label">What kind of time?</span>
        <CategoryChips value={form.category} onChange={(c) => set({ category: c })} />
      </div>
      {form.category && (
        <div class="card">
          <DetailFields form={form} set={set} data={data} refresh={refresh} />
        </div>
      )}
      {error && <p class="error" role="alert">{error}</p>}
      <button type="submit" class="primary block big">Start</button>
    </form>
  );
}
