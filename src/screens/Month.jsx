import { useState } from 'preact/hooks';
import { saveIncome, deleteIncome, saveEducation, deleteEducation } from '../db.js';
import {
  summarizeMonth, thisMonth, daysLeftInMonth, fmtMoney, fmtHours, creditHoursToMonthly, round2, incomeCeiling,
} from '../rules.js';
import { MonthNav, StatusBanner, Breakdown, go } from '../ui.jsx';

export function MonthScreen({ data, refresh, notify, month: routeMonth }) {
  const month = /^\d{4}-\d{2}$/.test(routeMonth || '') ? routeMonth : thisMonth();
  const { settings, entries, incomeByMonth, educationByMonth } = data;
  const sum = summarizeMonth(month, entries, incomeByMonth, educationByMonth, settings);
  const isCurrent = month === thisMonth();

  return (
    <>
      <h1>Income and school</h1>
      <MonthNav month={month} max={thisMonth()} onChange={(m) => go(`#/month/${m}`)} />
      <div class="card">
        <StatusBanner sum={sum} daysLeft={daysLeftInMonth(month)} isCurrent={isCurrent} />
        <Breakdown sum={sum} />
      </div>
      <IncomeCard key={`i-${month}`} month={month} data={data} sum={sum} refresh={refresh} notify={notify} />
      <SchoolCard key={`s-${month}`} month={month} data={data} refresh={refresh} notify={notify} />
    </>
  );
}

function lastIncomeSource(incomeByMonth) {
  const recs = Object.values(incomeByMonth).sort((a, b) => b.month.localeCompare(a.month));
  return recs[0]?.source || '';
}

function IncomeCard({ month, data, sum, refresh, notify }) {
  const { settings, incomeByMonth } = data;
  const rec = incomeByMonth[month];
  const [form, setForm] = useState(() => ({
    netIncome: rec ? String(rec.netIncome) : '',
    source: rec?.source ?? lastIncomeSource(incomeByMonth),
    isSeasonal: rec?.isSeasonal ?? false,
    attachmentNote: rec?.attachmentNote ?? '',
  }));
  const [error, setError] = useState(null);
  const set = (p) => setForm((f) => ({ ...f, ...p }));

  const business = form.netIncome === '' ? null : Number(form.netIncome);
  const gig = sum.gig;
  // Total shown live while typing: business (as typed) + gigs logged with time entries.
  const value = business === null && gig.count === 0 ? null : round2((business || 0) + gig.net);
  const threshold = sum.threshold;
  const ceiling = incomeCeiling(settings);

  const save = async () => {
    if (form.netIncome === '' || Number.isNaN(business)) return setError('Enter your business net profit for the month. Enter 0 if none.');
    await saveIncome({
      month,
      netIncome: round2(business),
      source: form.source.trim(),
      isSeasonal: form.isSeasonal,
      attachmentNote: form.attachmentNote.trim(),
    });
    setError(null);
    await refresh();
    notify('Income saved');
  };
  const remove = async () => {
    if (!confirm('Remove the business income for this month? Gig pay stays with your time entries.')) return;
    await deleteIncome(month);
    set({ netIncome: '' });
    await refresh();
    notify('Income removed');
  };

  return (
    <form class="card" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <h2>Income this month</h2>

      <h3>My business</h3>
      <p class="help" style="margin-bottom:12px">
        Enter your <b>net profit</b> for this month (money in minus business costs), not total sales. A Profit and Loss report from your bookkeeping app or ledger shows it.
        Money you take out of the business for yourself does not count as income.
        Do not include gig pay you already entered with your Paid job time.
      </p>
      <label class="field">
        <span>Business net profit ($)</span>
        <input type="number" inputMode="decimal" step="0.01" value={form.netIncome}
          onInput={(e) => set({ netIncome: e.currentTarget.value })} placeholder="0.00" />
      </label>

      <h3>Paid gigs (from your Paid job time)</h3>
      {gig.count === 0 ? (
        <p class="muted small">None this month. Add pay when you log Paid job time.</p>
      ) : (
        <dl class="kv" style="margin:0 0 14px">
          <dt>{gig.count} paid {gig.count === 1 ? 'gig' : 'gigs'}: you were paid</dt><dd>{fmtMoney(gig.gross)}</dd>
          <dt>You paid out</dt><dd>− {fmtMoney(gig.expenses)}</dd>
          <dt>Gig net</dt><dd>{fmtMoney(gig.net)}</dd>
        </dl>
      )}

      {value !== null && !Number.isNaN(value) && (
        <dl class="kv total-kv" style="margin:0 0 14px">
          <dt>Total net income</dt><dd>{fmtMoney(value)}</dd>
          <dt>Needed to meet the month</dt><dd>{fmtMoney(threshold)}</dd>
          <dt>Met by income?</dt><dd>{value >= threshold ? 'Yes' : 'No'}</dd>
          {value < threshold && value > 0 && (<><dt>Counts as hours</dt><dd>{fmtHours(value / settings.minWage)} hr</dd></>)}
        </dl>
      )}
      {value !== null && value < threshold && value > 0 && (
        <p class="help">Income under {fmtMoney(threshold)} can count as hours: {fmtMoney(value)} ÷ ${settings.minWage} an hour. The state may use this when it has no record of your hours.</p>
      )}
      {ceiling > 0 && value > ceiling && (
        <div class="banner warn">Over {fmtMoney(ceiling)}. This may affect Medicaid. Only the state decides.</div>
      )}

      <label class="field">
        <span>Where the business number came from</span>
        <input value={form.source} onInput={(e) => set({ source: e.currentTarget.value })} placeholder="Like: Profit and Loss report from my bookkeeping app" />
      </label>
      <label class="field">
        <span>Where the proof is saved (optional)</span>
        <input value={form.attachmentNote} onInput={(e) => set({ attachmentNote: e.currentTarget.value })} placeholder="Like: Profit and Loss PDF in Google Drive" />
      </label>
      <label class="check">
        <input type="checkbox" checked={form.isSeasonal} onChange={(e) => set({ isSeasonal: e.currentTarget.checked })} />
        My work is seasonal
      </label>
      <p class="muted small">
        Average of the 6 months before this one: <b>{fmtMoney(sum.sixMonthAvg)}</b>
        {sum.sixMonthKnown < 6 && ` (${sum.sixMonthKnown} of 6 months entered; missing months count as $0)`}
      </p>

      {error && <p class="error" role="alert">{error}</p>}
      <div class="row">
        <button type="submit" class="primary">Save income</button>
        {rec && <button type="button" class="danger" onClick={remove}>Remove</button>}
      </div>
    </form>
  );
}

function SchoolCard({ month, data, refresh, notify }) {
  const rec = data.educationByMonth[month];
  const [open, setOpen] = useState(!!rec);
  const [form, setForm] = useState(() => ({
    enrolledHalfTimeOrMore: rec?.enrolledHalfTimeOrMore ?? false,
    creditHours: rec?.creditHours ? String(rec.creditHours) : '',
    schoolName: rec?.schoolName ?? '',
  }));
  const set = (p) => setForm((f) => ({ ...f, ...p }));

  if (!open) {
    return (
      <div class="card">
        <h2>School this month</h2>
        <button class="block" onClick={() => setOpen(true)}>I was in school this month</button>
      </div>
    );
  }

  const save = async () => {
    await saveEducation({
      month,
      enrolledHalfTimeOrMore: form.enrolledHalfTimeOrMore,
      creditHours: form.enrolledHalfTimeOrMore ? 0 : Number(form.creditHours) || 0,
      schoolName: form.schoolName.trim(),
    });
    await refresh();
    notify('School saved');
  };
  const remove = async () => {
    await deleteEducation(month);
    await refresh();
    setOpen(false);
    notify('School removed');
  };

  return (
    <form class="card" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <h2>School this month</h2>
      <label class="field">
        <span>School name</span>
        <input value={form.schoolName} onInput={(e) => set({ schoolName: e.currentTarget.value })} />
      </label>
      <label class="check">
        <input type="checkbox" checked={form.enrolledHalfTimeOrMore} onChange={(e) => set({ enrolledHalfTimeOrMore: e.currentTarget.checked })} />
        I am in school half-time or more
      </label>
      <p class="help" style="margin:-6px 0 12px">Your school decides if you are half-time. Being half-time or more meets the whole month.</p>
      {!form.enrolledHalfTimeOrMore && (
        <label class="field">
          <span>Credit hours this term</span>
          <input type="number" inputMode="decimal" step="0.5" min="0" value={form.creditHours} onInput={(e) => set({ creditHours: e.currentTarget.value })} />
          {Number(form.creditHours) > 0 && (
            <span class="help">Counts as {fmtHours(creditHoursToMonthly(form.creditHours))} hours this month ({form.creditHours} × 3 × 4.33).</span>
          )}
          <span class="help">No credit hours? Log your class time with Add Time → School instead.</span>
        </label>
      )}
      <div class="row">
        <button type="submit" class="primary">Save school</button>
        {rec ? <button type="button" class="danger" onClick={remove}>Remove</button> : <button type="button" onClick={() => setOpen(false)}>Cancel</button>}
      </div>
    </form>
  );
}
