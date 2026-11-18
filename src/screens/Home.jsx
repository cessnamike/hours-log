import { saveEntry, deleteEntry } from '../db.js';
import {
  entryNet, fmtMoney,
  summarizeMonth, thisMonth, today, daysLeftInMonth, CAT, fmtDuration, noticeStatus, dateLabel, renewalStatus, monthLabel,
} from '../rules.js';
import { Ring, StatusBanner, Breakdown, go, useNow, fmtElapsed } from '../ui.jsx';

function repeatCandidates(entries, limit = 3) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    const k = [e.category, e.activity.trim().toLowerCase(), e.careRecipientId, e.organizationId, e.durationMinutes, e.grossPay, e.payExpenses].join('|');
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

export function Home({ data, refresh, notify }) {
  const { settings, entries, incomeByMonth, educationByMonth, timer } = data;
  const month = thisMonth();
  const sum = summarizeMonth(month, entries, incomeByMonth, educationByMonth, settings);
  const daysLeft = daysLeftInMonth(month);
  const notice = noticeStatus(settings.notice);
  const recips = Object.fromEntries((settings.careRecipients || []).map((r) => [r.id, r.name]));

  // Never backed up: start reminding once the oldest record is a week old.
  const oldest = entries.length ? entries[entries.length - 1].createdAt : null;
  const daysSince = (iso) => (Date.now() - new Date(iso)) / 86400000;
  const backupDue =
    entries.length > 0 &&
    (settings.lastBackupAt
      ? daysSince(settings.lastBackupAt) >= (Number(settings.backupReminderDays) || 30)
      : daysSince(oldest) >= 7);

  const repeat = async (e) => {
    const row = await saveEntry({
      date: today(),
      category: e.category,
      activity: e.activity,
      durationMinutes: e.durationMinutes,
      careRecipientId: e.careRecipientId || null,
      organizationId: e.organizationId || null,
      source: 'manual',
      notes: '',
      grossPay: e.grossPay ?? null,
      payExpenses: e.payExpenses ?? null,
      payExpenseNote: e.payExpenseNote || '',
    });
    await refresh();
    notify(`Added ${fmtDuration(e.durationMinutes)}${entryNet(e) !== null ? ` and ${fmtMoney(entryNet(e))}` : ''} for today`, {
      label: 'Undo',
      run: async () => { await deleteEntry(row.id); await refresh(); },
    });
  };

  return (
    <>
      {!settings.memberName && (
        <div class="banner info">
          Welcome! Start by adding your name and the people you care for.
          <span class="sub"><a href="#/settings">Go to Settings</a></span>
        </div>
      )}

      {notice && (
        <div class={`banner ${notice.daysLeft <= 7 ? 'bad' : 'warn'}`}>
          {notice.daysLeft >= 0
            ? `Answer the Medicaid notice by ${dateLabel(notice.due)} (${notice.daysLeft} ${notice.daysLeft === 1 ? 'day' : 'days'} left)`
            : `The reply date for the Medicaid notice (${dateLabel(notice.due)}) has passed`}
          <span class="sub"><a href="#/reports">Make your report</a></span>
        </div>
      )}

      {backupDue && (
        <div class="banner warn">
          Time to save a backup copy of your records.
          <span class="sub"><a href="#/reports">Save a backup</a></span>
        </div>
      )}

      {timer && <RunningTimerCard timer={timer} />}

      <div class="card">
        <h2 class="center">This month</h2>
        <Ring value={sum.totalHours} target={sum.target} full={sum.met} />
        <StatusBanner sum={sum} daysLeft={daysLeft} isCurrent />
        {sum.overCeiling && (
          <div class="banner warn">
            Your net income this month is over {fmtMoney(sum.ceiling)}, the limit for a household of {settings.householdSize || 1}. This may affect Medicaid.
            <span class="sub">Only the state decides. Ask them if you are not sure.</span>
          </div>
        )}
        <Breakdown sum={sum} />
      </div>

      <div class="btn-grid" style="margin-bottom:14px">
        {!timer && <a class="btn primary big" href="#/timer">Start Timer</a>}
        <a class={`btn big${timer ? ' primary' : ''}`} href="#/add">Add Time</a>
        <a class={`btn big${timer ? '' : ' full'}`} href="#/month">Enter Income</a>
      </div>

      {repeatCandidates(entries).length > 0 && (
        <div class="card">
          <h2>Add again for today</h2>
          {repeatCandidates(entries).map((e) => (
            <button class="repeat" onClick={() => repeat(e)}>
              <span>
                <b>{e.activity}</b>
                <span class="muted small" style="display:block">
                  {CAT[e.category]?.label}{recips[e.careRecipientId] ? ` · ${recips[e.careRecipientId]}` : ''}
                </span>
              </span>
              <span style="text-align:right">+ {fmtDuration(e.durationMinutes)}
                {entryNet(e) !== null && <span class="muted small" style="display:block">{fmtMoney(entryNet(e))} kept</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      <RenewalCard data={data} />
    </>
  );
}

function RunningTimerCard({ timer }) {
  const now = useNow();
  return (
    <div class="card timer-card">
      <div class="between">
        <div>
          <div class="small">Timer · {CAT[timer.category]?.label}</div>
          <div class="elapsed">{fmtElapsed(now - new Date(timer.startedAt))}</div>
          <div class="small">{timer.activity}</div>
        </div>
        <button style="flex:none" onClick={() => go('#/timer/stop')}>Stop</button>
      </div>
    </div>
  );
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortMonth = (m) => `${MON[Number(m.slice(5, 7)) - 1]} '${m.slice(2, 4)}`;

function RenewalCard({ data }) {
  const { settings, entries, incomeByMonth, educationByMonth } = data;
  if (!settings.memberName) return null;
  const r = renewalStatus(settings, entries, incomeByMonth, educationByMonth);
  if (!r) {
    return (
      <p class="muted center small">
        Add your next Medicaid renewal date in <a href="#/settings">Settings</a> to see a countdown.
      </p>
    );
  }
  const passed = r.daysLeft < 0;
  const n = r.metMonths.length;
  return (
    <div class="card renewal">
      <h2>Medicaid renewal</h2>
      <p class="renewal-when">
        {dateLabel(r.renewalDate)}
        <span class="muted">{passed ? ' (passed)' : r.daysLeft === 0 ? ' (today)' : ` · ${r.daysLeft} ${r.daysLeft === 1 ? 'day' : 'days'}`}</span>
      </p>
      {passed ? (
        <p class="help">Enter your new renewal date in <a href="#/settings">Settings</a>.</p>
      ) : (
        <>
          <div class={`banner ${r.onTrack ? 'good' : 'warn'}`}>
            {r.onTrack
              ? `${n} ${n === 1 ? 'month' : 'months'} met the rule since your last renewal. You need at least ${r.needed}.`
              : `No month has met the rule yet. You need at least ${r.needed} before ${dateLabel(r.renewalDate)}.`}
            {r.beforeRuleStarts && (
              <span class="sub">The state says the rule starts with renewals due March 2027 or later. Keep logging. Your next renewal after this one will count.</span>
            )}
          </div>
          {r.months.length > 0 && (
            <div class="month-dots" aria-label="Months since your last renewal">
              {r.months.map((m) => (
                <a href={`#/month/${m.month}`} class={`mdot ${m.met ? 'met' : m.inProgress ? 'now' : 'miss'}`}
                  title={`${monthLabel(m.month)}: ${m.met ? 'met' : m.inProgress ? 'in progress' : 'not met'}`}>
                  {shortMonth(m.month)}
                  <span class="mark">{m.met ? '✓' : m.inProgress ? '…' : '–'}</span>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
