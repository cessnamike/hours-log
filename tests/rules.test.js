import { describe, it, expect } from 'vitest';
import {
  summarizeMonth, creditHoursToMonthly, sixMonthAverage, caregivingRegularity,
  daysLeftInMonth, defaultReportRange, noticeStatus, incomeThreshold, DEFAULT_SETTINGS, addMonths,
  entryNet, gigIncome, monthIncome, renewalStatus, incomeCeiling, groupTotals, STATE_GROUPS, CATEGORIES,
} from '../src/rules.js';

const S = { ...DEFAULT_SETTINGS };
const e = (date, category, minutes, extra = {}) => ({ id: `${date}-${category}-${minutes}`, date, category, activity: 'x', durationMinutes: minutes, ...extra });
const sum = (entries, income = {}, edu = {}, s = S, month = '2027-01') => summarizeMonth(month, entries, income, edu, s);

describe('thresholds', () => {
  it('income threshold is min wage x 80', () => expect(incomeThreshold(S)).toBe(580));
  it('follows edited min wage and target', () => expect(incomeThreshold({ minWage: 8, monthlyHourTarget: 80 })).toBe(640));
});

describe('hours', () => {
  it('sums categories; 80 hours meets the month', () => {
    const r = sum([e('2027-01-02', 'caregiving', 50 * 60), e('2027-01-05', 'community_service', 30 * 60)]);
    expect(r.totalHours).toBe(80);
    expect(r.met).toBe(true);
    expect(r.method).toBe('combination');
  });
  it('79.9 hours does not meet', () => {
    const r = sum([e('2027-01-02', 'work', 79 * 60 + 54)]);
    expect(r.met).toBe(false);
    expect(r.method).toBe('none');
    expect(r.hoursToGo).toBeCloseTo(0.1, 5);
  });
  it('single category at 80 is "hours"', () => {
    expect(sum([e('2027-01-02', 'work', 80 * 60)]).method).toBe('hours');
  });
  it('ignores entries from other months', () => {
    const r = sum([e('2026-12-31', 'work', 80 * 60), e('2027-02-01', 'work', 80 * 60)]);
    expect(r.totalHours).toBe(0);
  });
});

describe('income', () => {
  it('income >= threshold meets the month with zero hours', () => {
    const r = sum([], { '2027-01': { month: '2027-01', netIncome: 580 } });
    expect(r.met).toBe(true);
    expect(r.method).toBe('income');
  });
  it('income below threshold converts at $/7.25', () => {
    const r = sum([], { '2027-01': { month: '2027-01', netIncome: 290 } });
    expect(r.incomeHours).toBe(40);
    expect(r.totalHours).toBe(40);
    expect(r.met).toBe(false);
  });
  it('converted income + caregiving reaches 80 as a combination', () => {
    const r = sum([e('2027-01-03', 'caregiving', 40 * 60)], { '2027-01': { month: '2027-01', netIncome: 290 } });
    expect(r.totalHours).toBe(80);
    expect(r.method).toBe('combination');
  });
  it('does not double count: business hours and converted income are alternatives', () => {
    const r = sum([e('2027-01-03', 'self_employment', 30 * 60)], { '2027-01': { month: '2027-01', netIncome: 290 } });
    expect(r.totalHours).toBe(40); // max(30, 40), not 70
    expect(r.usesIncomeHours).toBe(true);
    const r2 = sum([e('2027-01-03', 'self_employment', 50 * 60)], { '2027-01': { month: '2027-01', netIncome: 290 } });
    expect(r2.totalHours).toBe(50);
    expect(r2.usesIncomeHours).toBe(false);
  });
  it('negative net income (a loss) converts to zero hours', () => {
    expect(sum([], { '2027-01': { month: '2027-01', netIncome: -200 } }).incomeHours).toBe(0);
  });
  it('warns above the ceiling', () => {
    expect(sum([], { '2027-01': { month: '2027-01', netIncome: 1900 } }).overCeiling).toBe(true);
    expect(sum([], { '2027-01': { month: '2027-01', netIncome: 1836 } }).overCeiling).toBe(false);
  });
});

describe('seasonal average', () => {
  const inc = {};
  for (let i = 1; i <= 6; i++) inc[addMonths('2027-07', -i)] = { netIncome: i <= 3 ? 1000 : 200 };
  it('averages the six preceding months', () => {
    expect(sixMonthAverage('2027-07', inc)).toEqual({ average: 600, known: 6 });
  });
  it('missing months count as $0', () => {
    expect(sixMonthAverage('2027-07', { '2027-06': { netIncome: 600 } })).toEqual({ average: 100, known: 1 });
  });
  it('meets the month only when flagged seasonal', () => {
    const withMonth = { ...inc, '2027-07': { netIncome: 100, isSeasonal: true } };
    expect(summarizeMonth('2027-07', [], withMonth, {}, S).method).toBe('seasonal');
    const notSeasonal = { ...inc, '2027-07': { netIncome: 100, isSeasonal: false } };
    expect(summarizeMonth('2027-07', [], notSeasonal, {}, S).met).toBe(false);
  });
});

describe('education', () => {
  it('credit hours x 3 x 4.33', () => expect(creditHoursToMonthly(3)).toBe(38.97));
  it('half-time satisfies the month', () => {
    const r = sum([], {}, { '2027-01': { enrolledHalfTimeOrMore: true } });
    expect(r.method).toBe('school');
  });
  it('credit hours combine with other hours', () => {
    const r = sum([e('2027-01-03', 'caregiving', 42 * 60)], {}, { '2027-01': { creditHours: 3 } });
    expect(r.totalHours).toBe(80.97);
    expect(r.met).toBe(true);
  });
  it('without credit hours, logged class time counts', () => {
    expect(sum([e('2027-01-03', 'education', 120)]).educationHours).toBe(2);
  });
});

describe('caregiving regularity', () => {
  it('counts days and weeks with care', () => {
    // Jan 2027 starts on a Friday: weeks are 1-2, 3-9, 10-16, 17-23, 24-30, 31 => 6 weeks
    const r = caregivingRegularity('2027-01', [{ date: '2027-01-01' }, { date: '2027-01-04' }, { date: '2027-01-04' }, { date: '2027-01-31' }]);
    expect(r).toEqual({ daysWithCare: 3, daysInMonth: 31, weeksWithCare: 3, weeksInMonth: 6 });
  });
});

describe('dates', () => {
  it('days left in month', () => {
    expect(daysLeftInMonth('2027-01', '2027-01-19')).toBe(12);
    expect(daysLeftInMonth('2026-12', '2027-01-19')).toBe(0);
  });
  it('notice reply date is day 30 counting the day received', () => {
    expect(noticeStatus({ receivedDate: '2027-03-01' }, '2027-03-01')).toEqual({ due: '2027-03-30', daysLeft: 29 });
  });
  it('report range defaults to six months before the renewal', () => {
    expect(defaultReportRange({ nextRenewalDate: '2027-03-15' }, '2027-02-10')).toEqual({ from: '2026-08', to: '2027-01' });
    expect(defaultReportRange({}, '2027-02-10')).toEqual({ from: '2026-08', to: '2027-01' });
    expect(defaultReportRange({ notice: { months: ['2027-02', '2027-01'] } })).toEqual({ from: '2027-01', to: '2027-02' });
  });
});

describe('gig pay on entries', () => {
  const gigEntry = (date, gross, exp) => e(date, 'work', 60, { grossPay: gross, payExpenses: exp });
  it('net = gross - paid out; no pay entered = null', () => {
    expect(entryNet(gigEntry('2027-01-02', 40, 12))).toBe(28);
    expect(entryNet(gigEntry('2027-01-02', 40, ''))).toBe(40);
    expect(entryNet(e('2027-01-02', 'work', 60))).toBe(null);
  });
  it('sums gigs for the month only', () => {
    const g = gigIncome('2027-01', [gigEntry('2027-01-02', 40, 12), gigEntry('2027-01-09', 40, 12), gigEntry('2027-02-01', 40, 12), e('2027-01-03', 'work', 60)]);
    expect(g).toEqual({ gross: 80, expenses: 24, net: 56, count: 2 });
  });
  it('month income = business net + gig net, tracked side by side', () => {
    const m = monthIncome('2027-01', [gigEntry('2027-01-02', 40, 12)], { '2027-01': { netIncome: 500 } });
    expect(m.business).toBe(500);
    expect(m.gig.net).toBe(28);
    expect(m.total).toBe(528);
    expect(monthIncome('2027-01', [], {}).total).toBe(null);
    expect(monthIncome('2027-01', [gigEntry('2027-01-02', 40, 12)], {}).total).toBe(28);
  });
  it('business + gigs together can meet the month by income', () => {
    const entries = [];
    for (let d = 1; d <= 4; d++) entries.push(gigEntry(`2027-01-0${d}`, 40, 12)); // $112 net
    const r = sum(entries, { '2027-01': { month: '2027-01', netIncome: 470 } });
    expect(r.netIncome).toBe(582);
    expect(r.method).toBe('income');
  });
  it('combined income below threshold converts to hours, compared with logged paid hours', () => {
    const r = sum([gigEntry('2027-01-02', 40, 11)], { '2027-01': { netIncome: 261 } }); // 290 net -> 40 hr vs 1 hr logged
    expect(r.incomeHours).toBe(40);
    expect(r.totalHours).toBe(40);
  });
  it('seasonal average includes gig income', () => {
    const entries = [];
    for (let i = 1; i <= 6; i++) entries.push(gigEntry(`${addMonths('2027-07', -i)}-05`, 700, 100));
    expect(sixMonthAverage('2027-07', {}, entries)).toEqual({ average: 600, known: 6 });
  });
});

describe('renewal countdown', () => {
  const st = (extra) => ({ ...S, lastRenewalDate: '2026-02-01', nextRenewalDate: '2027-08-01', ...extra });
  const full = (month) => e(`${month}-03`, 'work', 80 * 60);
  it('null without a next renewal date', () => {
    expect(renewalStatus({ ...S }, [], {}, {}, '2026-11-18')).toBeNull();
  });
  it('counts days and lists months from last renewal through now', () => {
    const r = renewalStatus(st(), [], {}, {}, '2026-11-18');
    expect(r.daysLeft).toBe(256);
    expect(r.months.map((m) => m.month)).toEqual(['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    expect(r.months.at(-1).inProgress).toBe(true);
    expect(r.onTrack).toBe(false);
    expect(r.beforeRuleStarts).toBe(false);
  });
  it('one met month is on track', () => {
    const r = renewalStatus(st(), [full('2027-01')], {}, {}, '2027-03-10');
    expect(r.metMonths).toEqual(['2027-01']);
    expect(r.onTrack).toBe(true);
  });
  it('stops at the month before renewal', () => {
    const r = renewalStatus(st(), [full('2027-08')], {}, {}, '2027-09-15');
    expect(r.to).toBe('2027-07');
    expect(r.months.at(-1).month).toBe('2027-07');
    expect(r.onTrack).toBe(false);
    expect(r.daysLeft).toBeLessThan(0);
  });
  it('income month counts as met', () => {
    const r = renewalStatus(st(), [], { '2026-12': { month: '2026-12', netIncome: 600 } }, {}, '2027-01-05');
    expect(r.metMonths).toEqual(['2026-12']);
  });
  it('flags renewals due before March 2027', () => {
    expect(renewalStatus(st({ nextRenewalDate: '2027-02-01' }), [], {}, {}, '2026-11-18').beforeRuleStarts).toBe(true);
  });
  it('without a last renewal date looks back 12 months', () => {
    const r = renewalStatus(st({ lastRenewalDate: '' }), [], {}, {}, '2027-07-20');
    expect(r.from).toBe('2026-08');
  });
});

describe('household income limit (138% of 2026 poverty guideline)', () => {
  it('1 person is $1,836 a month', () => expect(incomeCeiling({})).toBe(1836));
  it('2 people', () => expect(incomeCeiling({ householdSize: 2 })).toBe(2489)); // 21640 * 1.38 / 12 = 2488.6
  it('4 people', () => expect(incomeCeiling({ householdSize: 4 })).toBe(3795)); // 33000 * 1.38 / 12 = 3795
  it('bad size falls back to 1', () => expect(incomeCeiling({ householdSize: 0 })).toBe(1836));
  it('summary uses household size', () => {
    const r = sum([], { '2027-01': { month: '2027-01', netIncome: 2000 } }, {}, { ...S, householdSize: 2 });
    expect(r.ceiling).toBe(2489);
    expect(r.overCeiling).toBe(false);
  });
  it('ignores the old stored ceiling field', () => {
    expect(incomeCeiling({ householdIncomeCeiling: 99999 })).toBe(1836);
  });
});

describe("the state's four groups", () => {
  const g = (r) => Object.fromEntries(groupTotals(r).map((x) => [x.id, x]));
  it('every app category belongs to exactly one group', () => {
    const all = STATE_GROUPS.flatMap((x) => x.cats).sort();
    expect(all).toEqual(CATEGORIES.map((c) => c.id).sort());
  });
  it('groups in the state order: work, volunteer, job training, school', () => {
    expect(STATE_GROUPS.map((x) => x.label)).toEqual(['Work', 'Volunteer', 'Job training', 'School']);
  });
  it('work = paid job + business + caring for family; groups add up to the total', () => {
    const r = sum([
      e('2027-01-02', 'work', 30 * 60), e('2027-01-03', 'self_employment', 10 * 60), e('2027-01-04', 'caregiving', 12 * 60),
      e('2027-01-05', 'community_service', 20 * 60), e('2027-01-06', 'education', 8 * 60),
    ]);
    const x = g(r);
    expect(x.work.hours).toBe(52);
    expect(x.work.subs.map((s) => [s.label, s.hours])).toEqual([['Paid job', 30], ['My business', 10], ['Caring for family', 12]]);
    expect(x.volunteer.hours).toBe(20);
    expect(x.training.hours).toBe(0);
    expect(x.school.hours).toBe(8);
    expect(groupTotals(r).reduce((a, y) => a + y.hours, 0)).toBe(r.totalHours);
  });
  it('when income hours replace logged paid hours, work shows one income-based line', () => {
    const r = sum([e('2027-01-02', 'work', 60), e('2027-01-04', 'caregiving', 3 * 60)], { '2027-01': { month: '2027-01', netIncome: 290 } });
    const x = g(r);
    expect(x.work.subs.map((s) => s.id)).toEqual(['paid_income', 'caregiving']);
    expect(x.work.hours).toBe(43); // 290 / 7.25 = 40, + 3 caregiving
  });
  it('empty sub-rows are left out', () => {
    expect(g(sum([e('2027-01-05', 'community_service', 60)])).work.subs).toEqual([]);
  });
});
