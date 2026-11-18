// Pure calculation rules. No DOM, no storage — unit tested in tests/rules.test.js.
// Source: 42 CFR 435.552 (CMS-2454-IFC, 91 FR 33348, June 3, 2026).

export const CATEGORIES = [
  { id: 'work', label: 'Paid job', formal: 'Paid work (wages or in-kind)' },
  { id: 'self_employment', label: 'My business', formal: 'Self-employment' },
  { id: 'caregiving', label: 'Caring for family', formal: 'Unpaid work: family caregiving' },
  { id: 'community_service', label: 'Volunteer', formal: 'Community service' },
  { id: 'work_program', label: 'Job training', formal: 'Work program' },
  { id: 'education', label: 'School', formal: 'Educational program' },
];
export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

// The state's four kinds of qualifying activity (42 CFR 435.552(c)); each app category sits under one.
export const STATE_GROUPS = [
  { id: 'work', label: 'Work', formal: 'Work', cats: ['work', 'self_employment', 'caregiving'] },
  { id: 'volunteer', label: 'Volunteer', formal: 'Community service', cats: ['community_service'] },
  { id: 'training', label: 'Job training', formal: 'Work program', cats: ['work_program'] },
  { id: 'school', label: 'School', formal: 'Educational program', cats: ['education'] },
];

// Which categories take an organization, and which a care recipient.
export const ORG_CATEGORIES = ['work', 'community_service', 'work_program', 'education'];
export const needsOrg = (cat) => ORG_CATEGORIES.includes(cat);
export const needsRecipient = (cat) => cat === 'caregiving';

export const DEFAULT_SETTINGS = {
  memberName: '',
  medicaidId: '',
  // Income warning: 138% of the HHS poverty guideline for the household (Medicaid adult expansion).
  // 2026 guidelines, 48 states + DC: $15,960 for one person, + $5,680 each additional person.
  householdSize: 1,
  povertyGuidelineBase: 15960,
  povertyGuidelinePerPerson: 5680,
  incomeLimitPercent: 138,
  minWage: 7.25,
  monthlyHourTarget: 80,
  careRecipients: [],
  organizations: [],
  backupReminderDays: 30,
  lastBackupAt: null,
  lastRenewalDate: '',
  nextRenewalDate: '',
  notice: null, // { receivedDate: 'YYYY-MM-DD', months: ['YYYY-MM', ...] }
  setupDone: false,
  acceptedTermsVersion: null,
};

// Bump when the disclaimer changes in a way people must re-accept (also update public/legal.html).
export const TERMS_VERSION = '2026-11-18';
export const RULES_CHECKED = '2026-11-18';

// Monthly household income limit (rounded up to the dollar).
export function incomeCeiling(settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const size = Math.max(1, Math.floor(Number(s.householdSize) || 1));
  const annual = (Number(s.povertyGuidelineBase) || 0) + (size - 1) * (Number(s.povertyGuidelinePerPerson) || 0);
  return Math.ceil(round2((annual * (Number(s.incomeLimitPercent) || 0)) / 100 / 12));
}

export const incomeThreshold = (s) => round2((s.minWage || 0) * (s.monthlyHourTarget || 0));

// ---------- date helpers (local time, never UTC) ----------
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const monthOf = (dateStr) => dateStr.slice(0, 7);
export const thisMonth = () => monthOf(today());
export const parseYmd = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
};
export const daysInMonth = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
export const addMonths = (month, n) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
export const monthRange = (from, to) => {
  const out = [];
  for (let m = from; m <= to && out.length < 120; m = addMonths(m, 1)) out.push(m);
  return out;
};
export const addDays = (dateStr, n) => {
  const d = parseYmd(dateStr);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
export const monthLabel = (month) =>
  parseYmd(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
export const dateLabel = (s) =>
  parseYmd(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ---------- number helpers ----------
export const round2 = (n) => Math.round(n * 100) / 100;
export const round1 = (n) => Math.round(n * 10) / 10;
export const hrs = (minutes) => minutes / 60;
export const fmtHours = (h) => {
  const v = round1(h);
  return `${Number.isInteger(v) ? v : v.toFixed(1)}`;
};
export const fmtDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
};
export const fmtMoney = (n) =>
  `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------- education ----------
// 435.552(d)(1): credit hours x 3 = weekly hours; x 4.33 = monthly hours.
export const creditHoursToMonthly = (credits) => round2((Number(credits) || 0) * 3 * 4.33);

// ---------- income ----------
// Paid gigs (category "work") can carry their own pay: gross, minus what was paid out
// (e.g. a share kept by the venue), equals net. Null when no pay was entered.
export const PAY_CATEGORIES = ['work'];
export const takesPay = (cat) => PAY_CATEGORIES.includes(cat);
export const entryNet = (e) =>
  e.grossPay === null || e.grossPay === undefined || e.grossPay === ''
    ? null
    : round2((Number(e.grossPay) || 0) - (Number(e.payExpenses) || 0));

export function gigIncome(month, entries) {
  let gross = 0, expenses = 0, count = 0;
  for (const e of entries) {
    if (monthOf(e.date) !== month || entryNet(e) === null) continue;
    gross += Number(e.grossPay) || 0;
    expenses += Number(e.payExpenses) || 0;
    count++;
  }
  return { gross: round2(gross), expenses: round2(expenses), net: round2(gross - expenses), count };
}

// Month's net income = business net profit from the member's bookkeeping + net of paid gigs.
// `total` is null when neither exists, so "not entered" stays distinct from $0.
export function monthIncome(month, entries, incomeByMonth) {
  const rec = incomeByMonth[month];
  const business = rec ? Number(rec.netIncome) || 0 : null;
  const gig = gigIncome(month, entries);
  const total = business === null && gig.count === 0 ? null : round2((business || 0) + gig.net);
  return { business, gig, total };
}

// ---------- seasonal average ----------
// 435.552(g): average monthly income over the preceding six months.
// Months with no income count as $0; `known` reports how many had any.
export function sixMonthAverage(month, incomeByMonth, entries = []) {
  let total = 0;
  let known = 0;
  for (let i = 1; i <= 6; i++) {
    const t = monthIncome(addMonths(month, -i), entries, incomeByMonth).total;
    if (t !== null) {
      total += t;
      known++;
    }
  }
  return { average: round2(total / 6), known };
}

// ---------- caregiving regularity ----------
// Relatives who don't live together are excluded under 435.554(c)(3)(i)(B) when care is
// "on a regular basis and is not solely incidental" — so show how regular, not just how much.
export function caregivingRegularity(month, entries) {
  const days = new Set(entries.map((e) => e.date));
  const dim = daysInMonth(month);
  const weeks = new Map(); // week index (Sunday-start) -> had care
  for (let d = 1; d <= dim; d++) {
    const date = `${month}-${pad(d)}`;
    const dt = parseYmd(date);
    const wk = Math.floor((d - 1 + new Date(dt.getFullYear(), dt.getMonth(), 1).getDay()) / 7);
    weeks.set(wk, weeks.get(wk) || days.has(date));
  }
  return {
    daysWithCare: days.size,
    daysInMonth: dim,
    weeksWithCare: [...weeks.values()].filter(Boolean).length,
    weeksInMonth: weeks.size,
  };
}

// ---------- the monthly summary ----------
export const METHOD = {
  income: 'Income',
  seasonal: 'Seasonal income average',
  school: 'School (half-time or more)',
  hours: 'Hours',
  combination: 'Combination',
  none: 'Not met',
};

/**
 * @param month 'YYYY-MM'
 * @param entries all time entries (any month; filtered here)
 * @param incomeByMonth { 'YYYY-MM': IncomeRecord }
 * @param educationByMonth { 'YYYY-MM': EducationRecord }
 * @param settings
 */
export function summarizeMonth(month, entries, incomeByMonth, educationByMonth, settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const target = Number(s.monthlyHourTarget) || 80;
  const threshold = incomeThreshold(s);
  const monthEntries = entries.filter((e) => monthOf(e.date) === month);

  const minutesBy = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0]));
  for (const e of monthEntries) minutesBy[e.category] = (minutesBy[e.category] || 0) + (Number(e.durationMinutes) || 0);
  const hoursBy = Object.fromEntries(Object.entries(minutesBy).map(([k, v]) => [k, hrs(v)]));

  const income = incomeByMonth[month] || null;
  const inc = monthIncome(month, entries, incomeByMonth);
  const netIncome = inc.total;
  const edu = educationByMonth[month] || null;

  // Paid work: logged hours vs. income converted to hours (435.552(e)(2)(i)-(ii)).
  // The conversion is a substitute for documented hours, never an addition to them,
  // so the larger of the two counts.
  const loggedPaidHours = hoursBy.work + hoursBy.self_employment;
  const incomeHours = netIncome && netIncome > 0 && s.minWage > 0 ? round2(netIncome / s.minWage) : 0;
  const usesIncomeHours = incomeHours > loggedPaidHours;
  const paidWorkHours = Math.max(loggedPaidHours, incomeHours);

  // Education: credit-hour formula when credits are entered, else logged class time.
  const halfTime = !!edu?.enrolledHalfTimeOrMore;
  const creditHours = Number(edu?.creditHours) || 0;
  const educationHours = creditHours > 0 ? creditHoursToMonthly(creditHours) : hoursBy.education;

  const countedBy = {
    paidWork: paidWorkHours,
    caregiving: hoursBy.caregiving,
    community_service: hoursBy.community_service,
    work_program: hoursBy.work_program,
    education: educationHours,
  };
  const totalHours = round2(Object.values(countedBy).reduce((a, b) => a + b, 0));

  const { average: sixMonthAvg, known: sixMonthKnown } = sixMonthAverage(month, incomeByMonth, entries);
  const incomeMet = netIncome !== null && netIncome >= threshold;
  const seasonalMet = !!income?.isSeasonal && sixMonthAvg >= threshold;
  const hoursMet = totalHours >= target;
  const contributing = Object.values(countedBy).filter((h) => h > 0).length;

  let method = 'none';
  if (incomeMet) method = 'income';
  else if (halfTime) method = 'school';
  else if (seasonalMet) method = 'seasonal';
  else if (hoursMet) method = contributing > 1 || usesIncomeHours ? 'combination' : 'hours';

  const ceiling = incomeCeiling(s);
  return {
    month,
    target,
    threshold,
    entries: monthEntries,
    minutesBy,
    hoursBy,
    loggedPaidHours,
    incomeHours,
    usesIncomeHours,
    countedBy,
    totalHours,
    hoursToGo: Math.max(0, round2(target - totalHours)),
    netIncome,
    businessNet: inc.business,
    gig: inc.gig,
    income,
    education: edu,
    halfTime,
    creditHours,
    educationHours,
    sixMonthAvg,
    sixMonthKnown,
    met: method !== 'none',
    method,
    methodLabel: METHOD[method],
    ceiling,
    overCeiling: netIncome !== null && ceiling > 0 && netIncome > ceiling,
  };
}

export function daysLeftInMonth(month, now = today()) {
  if (monthOf(now) !== month) return monthOf(now) < month ? daysInMonth(month) : 0;
  return daysInMonth(month) - Number(now.slice(8, 10));
}

// Default range for the multi-month report: from the last renewal (or 6 months back)
// through the last full month before the next renewal (or last month).
export function defaultReportRange(settings, now = today()) {
  const lastFull = addMonths(monthOf(now), -1);
  if (settings.notice?.months?.length) {
    const m = [...settings.notice.months].sort();
    return { from: m[0], to: m[m.length - 1] };
  }
  let to = lastFull;
  if (settings.nextRenewalDate) {
    const beforeRenewal = addMonths(monthOf(settings.nextRenewalDate), -1);
    if (beforeRenewal < to) to = beforeRenewal;
  }
  let from = addMonths(to, -5);
  if (settings.lastRenewalDate && monthOf(settings.lastRenewalDate) > from && monthOf(settings.lastRenewalDate) <= to) {
    from = monthOf(settings.lastRenewalDate);
  }
  return { from, to };
}

export function noticeStatus(notice, now = today()) {
  if (!notice?.receivedDate) return null;
  // 435.558(a)(2): 30 calendar days *beginning on* the day received, so day 30 is
  // received + 29. Using the earlier reading keeps the member on the safe side.
  const due = addDays(notice.receivedDate, 29);
  return { due, daysLeft: daysBetween(now, due) };
}

// ---------- renewal countdown ----------
// WV DoHS (wvmedicaidhelp.org FAQ, Oct 2026): at renewal a current member needs at least
// one month that met the rule since the last renewal. The rule starts with renewals due
// March 2027 or later (bms.wv.gov). The app does not decide which months the state will accept.
export const FIRST_COVERED_RENEWAL = '2027-03';
export const MONTHS_NEEDED = 1;

export function renewalStatus(settings, entries, incomeByMonth, educationByMonth, now = today()) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  if (!s.nextRenewalDate) return null;
  const renewalMonth = monthOf(s.nextRenewalDate);
  const cur = monthOf(now);
  // Months that can count: last renewal month (else 12 months back) through the month before renewal.
  const end = addMonths(renewalMonth, -1);
  let start = s.lastRenewalDate ? monthOf(s.lastRenewalDate) : addMonths(renewalMonth, -12);
  if (start > end) start = end;
  const months = monthRange(start, end < cur ? end : cur).map((m) => {
    const sum = summarizeMonth(m, entries, incomeByMonth, educationByMonth, s);
    return { month: m, met: sum.met, inProgress: m === cur && !sum.met };
  });
  const metMonths = months.filter((m) => m.met).map((m) => m.month);
  return {
    renewalDate: s.nextRenewalDate,
    daysLeft: daysBetween(now, s.nextRenewalDate),
    from: start,
    to: end,
    months,
    metMonths,
    needed: MONTHS_NEEDED,
    onTrack: metMonths.length >= MONTHS_NEEDED,
    beforeRuleStarts: renewalMonth < FIRST_COVERED_RENEWAL,
  };
}

// Counted hours by the state's four groups, with the app categories underneath.
// Paid job + business count as one figure when income hours replace them (435.552(e)(2)).
export function groupTotals(sum) {
  const sub = (id, hours, note = null) => ({ id, label: CAT[id].label, formal: CAT[id].formal, hours, note });
  const work = [];
  if (sum.usesIncomeHours) {
    work.push({ id: 'paid_income', label: 'Paid job and business (from income)', formal: 'Paid work and self-employment, income-based',
      hours: sum.countedBy.paidWork, note: 'income' });
  } else {
    work.push(sub('work', sum.hoursBy.work), sub('self_employment', sum.hoursBy.self_employment));
  }
  work.push(sub('caregiving', sum.countedBy.caregiving));
  const hours = {
    work: round2(sum.countedBy.paidWork + sum.countedBy.caregiving),
    volunteer: sum.countedBy.community_service,
    training: sum.countedBy.work_program,
    school: sum.countedBy.education,
  };
  return STATE_GROUPS.map((g) => ({
    ...g,
    hours: hours[g.id],
    subs: g.id === 'work' ? work.filter((r) => r.hours > 0) : [],
  }));
}
