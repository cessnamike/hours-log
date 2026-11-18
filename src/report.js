// PDF report (loaded on demand so the main bundle stays small).
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import {
  summarizeMonth, caregivingRegularity, entryNet, CAT, monthLabel, dateLabel, fmtMoney, fmtHours, fmtDuration, hrs, round2, today, groupTotals,
} from './rules.js';

const APP_NAME = 'Medicaid Hours Tracker';
const DISCLAIMER =
  'This report was prepared by the member using a personal record-keeping tool. It is not affiliated with or approved by the WV Department of Human Services and does not determine eligibility.';
const ATTEST = 'I certify that the information in this report is true and accurate to the best of my knowledge.';

const M = 54; // page margin (0.75 in)
const W = 612; // letter width in points
const H = 792;

// Standard PDF fonts only cover Latin-1. Map common typographic characters, drop the rest.
const clean = (s) =>
  String(s ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');

const timeOf = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '');
const hm = (min) => fmtDuration(min);

class Doc {
  constructor() {
    this.pdf = new jsPDF({ unit: 'pt', format: 'letter' });
    this.y = M;
  }
  ensure(space) {
    if (this.y + space > H - M - 30) {
      this.pdf.addPage();
      this.y = M;
    }
  }
  text(str, { size = 10, bold = false, gap = 4, indent = 0 } = {}) {
    const p = this.pdf;
    p.setFont('helvetica', bold ? 'bold' : 'normal');
    p.setFontSize(size);
    const lines = p.splitTextToSize(clean(str), W - 2 * M - indent);
    for (const line of lines) {
      this.ensure(size + 2);
      p.text(line, M + indent, this.y + size);
      this.y += size + 3;
    }
    this.y += gap;
  }
  heading(str) {
    this.ensure(130); // never leave a heading alone at the bottom of a page
    this.y += 6;
    this.text(str, { size: 12.5, bold: true, gap: 2 });
    this.pdf.setDrawColor(120);
    this.pdf.setLineWidth(0.6);
    this.pdf.line(M, this.y, W - M, this.y);
    this.y += 8;
  }
  table(head, body, opts = {}) {
    if (!body.length) return;
    autoTable(this.pdf, {
      startY: this.y,
      head: [head.map(clean)],
      body: body.map((r) => r.map((c) => clean(c))),
      margin: { left: M, right: M, bottom: M + 30 },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 4, textColor: 20, lineColor: 150, lineWidth: 0.5, overflow: 'linebreak' },
      headStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: 'bold' },
      ...opts,
    });
    this.y = this.pdf.lastAutoTable.finalY + 12;
  }
  signatureLine(label, { indent = 0 } = {}) {
    this.ensure(40);
    const p = this.pdf;
    this.y += 22;
    p.setDrawColor(0);
    p.setLineWidth(0.6);
    const x = M + indent;
    p.line(x, this.y, x + 260, this.y);
    p.line(x + 300, this.y, x + 420, this.y);
    p.setFont('helvetica', 'normal');
    p.setFontSize(8.5);
    p.text(clean(label), x, this.y + 11);
    p.text('Date', x + 300, this.y + 11);
    this.y += 22;
  }
  box(lines) {
    const p = this.pdf;
    const lineH = 15;
    const h = lines.length * lineH + 16;
    this.ensure(h + 10);
    p.setDrawColor(0);
    p.setLineWidth(1);
    p.rect(M, this.y, W - 2 * M, h);
    let y = this.y + 8;
    for (const [label, value] of lines) {
      p.setFont('helvetica', 'bold');
      p.setFontSize(10);
      p.text(clean(label), M + 10, y + 10);
      p.setFont('helvetica', 'normal');
      p.text(clean(value), M + 230, y + 10);
      y += lineH;
    }
    this.y += h + 12;
  }
  footers() {
    const p = this.pdf;
    const n = p.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      p.setPage(i);
      p.setFont('helvetica', 'normal');
      p.setFontSize(7.5);
      p.setTextColor(80);
      const lines = p.splitTextToSize(DISCLAIMER, W - 2 * M - 70);
      p.text(lines, M, H - M + 6);
      p.text(`Page ${i} of ${n}`, W - M, H - M + 6, { align: 'right' });
      p.setTextColor(0);
    }
  }
}

function header(doc, settings, periodLabel) {
  doc.text('Medicaid Community Engagement Activity Report', { size: 16, bold: true, gap: 6 });
  const rows = [
    ['Member', settings.memberName || '(name not entered)'],
    ...(settings.medicaidId ? [['Medicaid ID', settings.medicaidId]] : []),
    ['Reporting period', periodLabel],
    ['Date prepared', dateLabel(today())],
  ];
  for (const [k, v] of rows) doc.text(`${k}: ${v}`, { size: 10.5, gap: 0 });
  doc.y += 10;
}

function summaryLines(sum) {
  const lines = [
    ['Method used to meet the month', sum.methodLabel],
    ['Total qualifying hours', `${fmtHours(sum.totalHours)} of ${sum.target} required`],
    ['Net income for the month', sum.netIncome === null ? 'Not entered'
      : sum.gig.count && sum.businessNet !== null ? `${fmtMoney(sum.netIncome)} (business ${fmtMoney(sum.businessNet)} + gigs ${fmtMoney(sum.gig.net)})`
      : fmtMoney(sum.netIncome)],
    ['Income needed to meet the month', `${fmtMoney(sum.threshold)} (minimum wage x ${sum.target} hours)`],
  ];
  if (sum.usesIncomeHours) {
    lines.push(['Hours from income', `${fmtHours(sum.incomeHours)} (net income / minimum wage)`]);
  }
  if (sum.halfTime) lines.push(['School', 'Enrolled half-time or more']);
  if (sum.income?.isSeasonal) lines.push(['Seasonal 6-month average', fmtMoney(sum.sixMonthAvg)]);
  return lines;
}

function categoryRows(sum) {
  // Grouped under the state's four kinds of activity; the app's categories are indented underneath.
  const rows = [];
  const paidNote = sum.usesIncomeHours
    ? `Income-based: ${fmtHours(sum.incomeHours)} hr used in place of ${fmtHours(sum.loggedPaidHours)} hr logged`
    : '';
  for (const g of groupTotals(sum)) {
    if (g.id === 'work') {
      rows.push(['Work', '', fmtHours(g.hours), '']);
      rows.push([`   ${CAT.work.formal}`, fmtHours(sum.hoursBy.work), '', '']);
      rows.push([`   ${CAT.self_employment.formal}`, fmtHours(sum.hoursBy.self_employment), '', '']);
      rows.push(['   Paid work and self-employment counted', '', fmtHours(sum.countedBy.paidWork), paidNote]);
      rows.push([`   ${CAT.caregiving.formal}`, fmtHours(sum.hoursBy.caregiving), fmtHours(sum.countedBy.caregiving), '']);
    } else if (g.id === 'school') {
      rows.push([
        g.formal,
        fmtHours(sum.hoursBy.education),
        fmtHours(g.hours),
        sum.halfTime ? 'Half-time or more: meets month' : sum.creditHours > 0 ? `${sum.creditHours} credit hr x 3 x 4.33` : '',
      ]);
    } else {
      const id = g.cats[0];
      rows.push([g.formal, fmtHours(sum.hoursBy[id]), fmtHours(g.hours), '']);
    }
  }
  rows.push(['Total', '', fmtHours(sum.totalHours), '']);
  return rows;
}

function monthSections(doc, sum, settings, { title }) {
  const recips = Object.fromEntries((settings.careRecipients || []).map((r) => [r.id, r]));
  const orgs = Object.fromEntries((settings.organizations || []).map((o) => [o.id, o]));
  const sorted = [...sum.entries].sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')));
  const byCat = (c) => sorted.filter((e) => e.category === c);
  const timeCol = (e) => (e.startTime ? `${timeOf(e.startTime)} - ${timeOf(e.endTime)}` : '');

  if (title) doc.heading(title);
  doc.box(summaryLines(sum));

  doc.heading('Hours by category');
  doc.table(['Category', 'Hours logged', 'Hours counted', 'Note'], categoryRows(sum), {
    columnStyles: { 1: { halign: 'right', cellWidth: 70 }, 2: { halign: 'right', cellWidth: 75 } },
    didParseCell: (d) => { if (d.section === 'body' && d.row.index === 7) d.cell.styles.fontStyle = 'bold'; },
  });

  // Detail log for categories that don't get their own section below.
  const detailCats = ['work', 'self_employment', 'work_program', 'education'].filter((c) => byCat(c).length);
  if (detailCats.length) {
    doc.heading('Detail log');
    for (const c of detailCats) {
      doc.ensure(70);
      doc.text(CAT[c].formal, { bold: true, size: 10.5, gap: 2 });
      if (c === 'work') {
        const pay = (v) => (v === null || v === undefined ? '' : fmtMoney(v));
        doc.table(
          ['Date', 'Activity', 'Time', 'Paid by / where', 'Paid', 'Paid out', 'Net'],
          byCat(c).map((e) => [
            dateLabel(e.date) + (e.startTime ? `
${timeCol(e)}` : ''),
            e.activity + (e.notes ? ` (${e.notes})` : ''),
            hm(e.durationMinutes),
            orgs[e.organizationId]?.name || '',
            pay(e.grossPay),
            pay(e.payExpenses) + (e.payExpenseNote ? `
${e.payExpenseNote}` : ''),
            pay(entryNet(e)),
          ]),
          { columnStyles: { 0: { cellWidth: 72 }, 2: { cellWidth: 46, halign: 'right' }, 4: { cellWidth: 52, halign: 'right' }, 5: { cellWidth: 62, halign: 'right' }, 6: { cellWidth: 52, halign: 'right' } } },
        );
        continue;
      }
      doc.table(
        ['Date', 'Activity', 'Time', 'Organization', 'Start - End'],
        byCat(c).map((e) => [dateLabel(e.date), e.activity + (e.notes ? ` (${e.notes})` : ''), hm(e.durationMinutes), orgs[e.organizationId]?.name || '', timeCol(e)]),
        { columnStyles: { 0: { cellWidth: 72 }, 2: { cellWidth: 52, halign: 'right' }, 4: { cellWidth: 88 } } },
      );
    }
  }

  const care = byCat('caregiving');
  if (care.length) {
    doc.heading('Caregiving');
    const ids = [...new Set(care.map((e) => e.careRecipientId))];
    for (const id of ids) {
      const r = recips[id];
      const list = care.filter((e) => e.careRecipientId === id);
      const total = list.reduce((a, e) => a + e.durationMinutes, 0);
      const reg = caregivingRegularity(sum.month, list);
      doc.ensure(110);
      doc.text(`Care for: ${r?.name || 'Unnamed'}${r?.relationship ? ` (${r.relationship})` : ''}`, { bold: true, size: 10.5, gap: 0 });
      doc.text(
        `Total ${fmtHours(hrs(total))} hours. Care given on ${reg.daysWithCare} of ${reg.daysInMonth} days, in ${reg.weeksWithCare} of ${reg.weeksInMonth} calendar weeks.`,
        { gap: 2 },
      );
      doc.table(
        ['Date', 'What I did', 'Time', 'Start - End'],
        list.map((e) => [dateLabel(e.date), e.activity + (e.notes ? ` (${e.notes})` : ''), hm(e.durationMinutes), timeCol(e)]),
        { columnStyles: { 0: { cellWidth: 72 }, 2: { cellWidth: 52, halign: 'right' }, 3: { cellWidth: 88 } } },
      );
    }
  }

  const cs = byCat('community_service');
  if (cs.length) {
    doc.heading('Community service');
    const ids = [...new Set(cs.map((e) => e.organizationId))];
    for (const id of ids) {
      const o = orgs[id];
      const list = cs.filter((e) => e.organizationId === id);
      const total = list.reduce((a, e) => a + e.durationMinutes, 0);
      doc.ensure(110);
      doc.text(`Organization: ${o?.name || 'Not entered'}`, { bold: true, size: 10.5, gap: 0 });
      const contact = [o?.contactName, o?.contactPhone, o?.contactEmail].filter(Boolean).join(', ');
      doc.text(`Contact person: ${contact || 'Not entered'}. Total ${fmtHours(hrs(total))} hours.`, { gap: 2 });
      doc.table(
        ['Date', 'Activity', 'Time', 'Start - End'],
        list.map((e) => [dateLabel(e.date), e.activity + (e.notes ? ` (${e.notes})` : ''), hm(e.durationMinutes), timeCol(e)]),
        { columnStyles: { 0: { cellWidth: 72 }, 2: { cellWidth: 52, halign: 'right' }, 3: { cellWidth: 88 } } },
      );
      doc.signatureLine(`Verified by (name and title), ${o?.name || 'organization'}`);
    }
  }

  if (sum.netIncome !== null) {
    doc.heading('Income');
    const rows = [];
    if (sum.businessNet !== null) {
      rows.push([`Business net profit (receipts minus business expenses)${sum.income?.source ? `
Source: ${sum.income.source}` : ''}`, fmtMoney(sum.businessNet)]);
    }
    if (sum.gig.count) {
      rows.push([`Paid work: ${sum.gig.count} paid ${sum.gig.count === 1 ? 'job' : 'jobs'}, amount paid`, fmtMoney(sum.gig.gross)]);
      rows.push(['Paid work: amount paid out (fees, facility share)', `- ${fmtMoney(sum.gig.expenses)}`]);
      rows.push(['Paid work: net', fmtMoney(sum.gig.net)]);
    }
    rows.push(['Total net income for the month', fmtMoney(sum.netIncome)]);
    rows.push(['Income needed to meet the month', fmtMoney(sum.threshold)]);
    if (sum.income?.isSeasonal) rows.push(['Average monthly income, 6 preceding months', `${fmtMoney(sum.sixMonthAvg)} (${sum.sixMonthKnown} of 6 months on record)`]);
    const totalRow = rows.length - (sum.income?.isSeasonal ? 3 : 2);
    doc.table(['Item', 'Amount'], rows, {
      columnStyles: { 1: { cellWidth: 140, halign: 'right' } },
      didParseCell: (d) => { if (d.section === 'body' && d.row.index === totalRow) d.cell.styles.fontStyle = 'bold'; },
    });
    const notes = [];
    if (sum.businessNet !== null) notes.push(`Business records (profit and loss statement) are available on request.${sum.income?.attachmentNote ? ` Kept at: ${sum.income.attachmentNote}.` : ''}`);
    if (sum.gig.count) notes.push('Each paid job is listed with its pay in the Work detail log above.');
    doc.text(notes.join(' '), { size: 9.5 });
  }
}

function attestation(doc, settings) {
  doc.heading('Attestation');
  doc.text(ATTEST, { size: 10.5 });
  doc.signatureLine(`Signature of member${settings.memberName ? `: ${settings.memberName}` : ''}`);
}

export function buildReport({ months, data, includeDetail = true }) {
  const { settings, entries, incomeByMonth, educationByMonth } = data;
  const sums = months.map((m) => summarizeMonth(m, entries, incomeByMonth, educationByMonth, settings));
  const doc = new Doc();
  const period = months.length === 1 ? monthLabel(months[0]) : `${monthLabel(months[0])} through ${monthLabel(months[months.length - 1])}`;
  header(doc, settings, period);

  if (months.length === 1) {
    monthSections(doc, sums[0], settings, {});
  } else {
    doc.heading('Summary by month');
    doc.table(
      ['Month', 'Met?', 'Method', 'Hours counted', 'Net income'],
      sums.map((s) => [monthLabel(s.month), s.met ? 'Yes' : 'No', s.methodLabel, fmtHours(s.totalHours), s.netIncome === null ? '-' : fmtMoney(s.netIncome)]),
      { columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } } },
    );
    doc.text(
      `Months met: ${sums.filter((s) => s.met).length} of ${sums.length}. Total hours logged in period: ${fmtHours(round2(sums.reduce((a, s) => a + s.entries.reduce((b, e) => b + e.durationMinutes, 0), 0) / 60))}.`,
      { size: 10 },
    );
    if (includeDetail) {
      for (const s of sums) {
        doc.pdf.addPage();
        doc.y = M;
        monthSections(doc, s, settings, { title: monthLabel(s.month) });
      }
    }
  }
  attestation(doc, settings);
  doc.footers();
  doc.pdf.setProperties({ title: `Activity Report - ${period}`, creator: APP_NAME });
  return doc.pdf.output('blob');
}
