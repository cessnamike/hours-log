import { useEffect, useState } from 'preact/hooks';
import { CATEGORIES, addMonths, monthLabel, fmtHours, round1 } from './rules.js';

export const go = (hash) => {
  location.hash = hash;
};

const icon = (d) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const TABS = [
  { id: 'home', href: '#/', label: 'Home', d: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10' },
  { id: 'history', href: '#/history', label: 'History', d: 'M4 6h16M4 12h16M4 18h10' },
  { id: 'month', href: '#/month', label: 'Income', d: 'M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
  { id: 'reports', href: '#/reports', label: 'Reports', d: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8' },
  { id: 'settings', href: '#/settings', label: 'Settings', d: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-2-4-2 .5-1.5-1L15 4h-6l-.5 2.5-1.5 1L5 7 3 11l2 1v0l-2 1 2 4 2-.5 1.5 1L9 20h6l.5-2.5 1.5-1 2 .5 2-4z' },
];

export function Tabs({ current }) {
  return (
    <nav class="tabs" aria-label="Main">
      {TABS.map((t) => (
        <a href={t.href} aria-current={current === t.id ? 'page' : undefined}>
          {icon(t.d)}
          {t.label}
        </a>
      ))}
    </nav>
  );
}

export function Toast({ message, action, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, action ? 6000 : 3000);
    return () => clearTimeout(t);
  }, [message]);
  return (
    <div class="toast" role="status">
      <span>{message}</span>
      {action && (
        <button onClick={() => { action.run(); onClose(); }}>{action.label}</button>
      )}
    </div>
  );
}

export function CategoryChips({ value, onChange, allowAll }) {
  return (
    <div class="chips" role="group" aria-label="Category">
      {allowAll && (
        <button type="button" class="chip sm" aria-pressed={!value} onClick={() => onChange('')}>All</button>
      )}
      {CATEGORIES.map((c) => (
        <button type="button" class={`chip${allowAll ? ' sm' : ''}`} aria-pressed={value === c.id} onClick={() => onChange(c.id)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 999, unit, label }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div class="stepper">
      <button type="button" aria-label={`Less ${label}`} onClick={() => set((Number(value) || 0) - step)}>−</button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onInput={(e) => onChange(e.currentTarget.value === '' ? '' : Math.max(min, Math.min(max, Number(e.currentTarget.value))))}
      />
      <button type="button" aria-label={`More ${label}`} onClick={() => set((Number(value) || 0) + step)}>+</button>
      {unit && <span class="unit">{unit}</span>}
    </div>
  );
}

export function MonthNav({ month, onChange, max }) {
  return (
    <div class="month-nav">
      <button type="button" aria-label="Previous month" onClick={() => onChange(addMonths(month, -1))}>‹</button>
      <div class="name">{monthLabel(month)}</div>
      <button type="button" aria-label="Next month" disabled={max && month >= max} onClick={() => onChange(addMonths(month, 1))}>›</button>
    </div>
  );
}

export function Ring({ value, target, full }) {
  const pct = full ? 1 : Math.min(1, target ? value / target : 0);
  const r = 80;
  const c = 2 * Math.PI * r;
  const color = pct >= 1 ? 'var(--good)' : 'var(--brand)';
  return (
    <div class="ring-wrap">
      <div class="ring" role="img" aria-label={`${fmtHours(value)} of ${target} hours`}>
        <svg viewBox="0 0 190 190">
          <circle cx="95" cy="95" r={r} fill="none" stroke="var(--ring-track)" stroke-width="18" />
          <circle cx="95" cy="95" r={r} fill="none" stroke={color} stroke-width="18" stroke-linecap="round"
            stroke-dasharray={`${c * pct} ${c}`} />
        </svg>
        <div class="label">
          <div class="num">{fmtHours(value)}</div>
          <div class="of">of {target} hours</div>
        </div>
      </div>
    </div>
  );
}

// The plain-language status line used on Home and the Month screen.
export function StatusBanner({ sum, daysLeft, isCurrent }) {
  if (sum.method === 'income') {
    return <div class="banner good">Month met by income<span class="sub">Your net income is at least ${sum.threshold}.</span></div>;
  }
  if (sum.method === 'school') {
    return <div class="banner good">Month met by school<span class="sub">You are in school at least half-time.</span></div>;
  }
  if (sum.method === 'seasonal') {
    return <div class="banner good">Month met by seasonal income<span class="sub">Your 6-month average income is at least ${sum.threshold}.</span></div>;
  }
  if (sum.met) {
    return <div class="banner good">Month met: {fmtHours(sum.totalHours)} of {sum.target} hours</div>;
  }
  const left = round1(sum.hoursToGo);
  return (
    <div class={`banner ${isCurrent ? 'warn' : 'bad'}`}>
      {fmtHours(sum.totalHours)} of {sum.target} hours: {fmtHours(left)} to go
      {isCurrent ? `, ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left` : ''}
      {!isCurrent && <span class="sub">This month is over and was not met by the hours and income entered here.</span>}
    </div>
  );
}

export function Breakdown({ sum }) {
  const rows = [];
  const paid = sum.countedBy.paidWork;
  if (paid > 0) {
    rows.push({
      label: 'Paid work and business',
      hours: paid,
      note: sum.usesIncomeHours
        ? `From income: $${Math.round(sum.netIncome)} ÷ $${sum.threshold / sum.target} = ${fmtHours(sum.incomeHours)} hours. Uses this instead of the ${fmtHours(sum.loggedPaidHours)} ${fmtHours(sum.loggedPaidHours) === '1' ? 'hour' : 'hours'} you logged, because it is more.`
        : sum.incomeHours > 0
          ? `Logged hours. (Income would count as ${fmtHours(sum.incomeHours)} hours.)`
          : null,
    });
  }
  const add = (id, label) => sum.countedBy[id] > 0 && rows.push({ label, hours: sum.countedBy[id] });
  add('caregiving', 'Caring for family');
  add('community_service', 'Volunteer');
  add('work_program', 'Job training');
  if (sum.countedBy.education > 0) {
    rows.push({
      label: 'School',
      hours: sum.countedBy.education,
      note: sum.creditHours > 0 ? `${sum.creditHours} credit hours × 3 × 4.33` : null,
    });
  }
  if (!rows.length) return <p class="muted">No hours yet this month.</p>;
  return (
    <ul class="breakdown">
      {rows.map((r) => (
        <li>
          <span>{r.label}{r.note && <span class="note">{r.note}</span>}</span>
          <b>{fmtHours(r.hours)} hr</b>
        </li>
      ))}
    </ul>
  );
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export const fmtElapsed = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

// Small inline "add a person / place" form used inside entry and timer forms.
export function QuickAdd({ label, placeholder, onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  if (!open) return <button type="button" class="ghost" onClick={() => setOpen(true)}>+ {label}</button>;
  return (
    <div class="row" style="margin-top:8px">
      <input value={name} placeholder={placeholder} onInput={(e) => setName(e.currentTarget.value)} aria-label={placeholder} />
      <button type="button" class="primary" style="flex:none" disabled={!name.trim()}
        onClick={async () => { await onAdd(name.trim()); setName(''); setOpen(false); }}>Add</button>
    </div>
  );
}
