import { useState } from 'preact/hooks';
import { CAT, entryNet, fmtMoney, monthOf, thisMonth, fmtDuration, dateLabel, hrs, fmtHours } from '../rules.js';
import { CategoryChips, MonthNav, go } from '../ui.jsx';

export function History({ data }) {
  const { entries, settings } = data;
  const [month, setMonth] = useState(thisMonth());
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');

  const recips = Object.fromEntries((settings.careRecipients || []).map((r) => [r.id, r.name]));
  const orgs = Object.fromEntries((settings.organizations || []).map((o) => [o.id, o.name]));
  const query = q.trim().toLowerCase();

  // Searching looks across all months; otherwise show the chosen month.
  const list = entries.filter(
    (e) =>
      (query ? true : monthOf(e.date) === month) &&
      (!cat || e.category === cat) &&
      (!query || `${e.activity} ${e.notes || ''}`.toLowerCase().includes(query)),
  );
  const totalMin = list.reduce((a, e) => a + e.durationMinutes, 0);

  const byDay = [];
  for (const e of list) {
    const last = byDay[byDay.length - 1];
    if (last && last.date === e.date) last.items.push(e);
    else byDay.push({ date: e.date, items: [e] });
  }

  return (
    <>
      <h1>History</h1>
      <label class="field">
        <span class="sr">Search</span>
        <input type="search" value={q} placeholder="Search what you did" onInput={(e) => setQ(e.currentTarget.value)} />
      </label>
      {!query && <MonthNav month={month} max={thisMonth()} onChange={setMonth} />}
      <div style="margin-bottom:14px"><CategoryChips value={cat} onChange={setCat} allowAll /></div>

      <div class="card">
        <p class="muted" style="margin:0">
          {list.length} {list.length === 1 ? 'entry' : 'entries'} · {fmtHours(hrs(totalMin))} hours
          {query && ' (all months)'}
        </p>
        {byDay.length === 0 && <p class="muted" style="margin-top:10px">Nothing here yet.</p>}
        {byDay.map((d) => (
          <>
            <div class="day-head">{dateLabel(d.date)}</div>
            <ul class="list">
              {d.items.map((e) => (
                <li>
                  <button class="entry" aria-label={`Edit or delete: ${e.activity}, ${dateLabel(e.date)}`} onClick={() => go(`#/add/${e.id}`)}>
                    <span>
                      <span class="what">{e.activity}</span>
                      {e.notes && <span class="note-line">{e.notes}</span>}
                      <span class="meta" style="display:block">
                        {CAT[e.category]?.label}
                        {recips[e.careRecipientId] ? ` · ${recips[e.careRecipientId]}` : ''}
                        {orgs[e.organizationId] ? ` · ${orgs[e.organizationId]}` : ''}
                        {e.source === 'timer' ? ' · timer' : ''}
                      </span>
                    </span>
                    <span class="dur" style="text-align:right">{fmtDuration(e.durationMinutes)}
                      {entryNet(e) !== null && <span class="meta" style="display:block">{fmtMoney(entryNet(e))}</span>}
                    </span>
                    <span class="pencil" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                      </svg>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ))}
      </div>
    </>
  );
}
