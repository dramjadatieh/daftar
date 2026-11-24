// Pure money logic for دفتر شغلي (tested by build/test.mjs). No DOM, no Firebase.
// Pay rule (his contract with Art of Teeth, confirmed by him 21-11-2026):
//  - Fixed salary every month (5,000).
//  - The target (20,000) counts ALL his eligible income, before any lab or materials. Up to it (inclusive): salary
//    only, and lab + materials of that income do not concern him.
//  - Above it: % (30) of (income above the target − lab + materials of the cases above the target).
//    A case that crosses the line counts for the part above it, with the same share of its lab.
//  - Insurance cases (pay:'ins') count only when the insurer has paid the clinic: in the month of paidDate, for
//    paidAmount (default = amount). Pending or rejected insurance counts nowhere. Cash cases count in their own month.
// Clinic (24-11): no materials deduction once he reaches the target, only the lab. Lab: PFM 80, zirconia 150.
// An empty lab field = no lab (0). estPct is only the default lab % for the scenarios tab.
export const DEF = { target: 20000, percent: 30, salary: 5000, estPct: 5, labPfm: 80, labZr: 150 };

export const num = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v);
export const settingsOf = s => {
  const o = Object.assign({}, DEF);
  for (const k in DEF) if (s && num(s[k]) !== null) o[k] = num(s[k]);
  return o;
};
export const monthOf = d => String(d || '').slice(0, 7);
export const isIns = e => e && e.pay === 'ins';
export const insState = e => !isIns(e) ? null : (e.insStatus === 'paid' && e.paidDate) ? 'paid' : e.insStatus === 'rejected' ? 'rejected' : 'pending';

// Lab fee of one case (empty = no lab).
export function labOf(e, s) {
  return { v: num(e.lab) || 0, est: false };
}

// What a case adds to month <ym>'s eligible income: { amt, when } or null.
export function counted(e, ym) {
  if (!isIns(e)) return monthOf(e.date) === ym ? { amt: num(e.amount) || 0, when: e.date } : null;
  if (insState(e) !== 'paid' || monthOf(e.paidDate) !== ym) return null;
  const pa = num(e.paidAmount);
  return { amt: pa === null ? (num(e.amount) || 0) : pa, when: e.paidDate };
}

// gross = eligible income; labAbove = lab + materials of the income above the target.
export function payFor(gross, labAbove, s) {
  const over = Math.max(0, gross - s.target);
  const lab = over > 0 ? Math.min(over, Math.max(0, labAbove)) : 0;
  const base = over - lab;
  const comm = base * s.percent / 100;
  return { gross, over, labAbove: lab, base, comm, pay: s.salary + comm, remaining: Math.max(0, s.target - gross) };
}

// entries = ALL his cases (any month); ym = 'YYYY-MM'.
export function calcMonth(entries, ym, s) {
  const items = [];
  for (const e of entries) { const c = counted(e, ym); if (c) items.push({ e, amt: c.amt, when: c.when }); }
  items.sort((a, b) => String(a.when).localeCompare(String(b.when)) || String(a.e.created || '').localeCompare(String(b.e.created || '')));
  let gross = 0, labAbove = 0, labEst = 0, estCases = 0, insIn = 0, insInCases = 0;
  const frac = {};
  for (const { e, amt } of items) {
    const before = gross;
    gross += amt;
    if (isIns(e)) { insIn += amt; insInCases++; }
    const above = Math.max(0, gross - Math.max(before, s.target));
    const f = amt > 0 ? above / amt : 0;
    frac[e.id] = f;
    if (f > 0) {
      const l = labOf(e, s), part = l.v * f;
      labAbove += part;
      if (l.est) { labEst += part; estCases++; }
    }
  }
  const done = entries.filter(e => monthOf(e.date) === ym);
  const work = done.reduce((t, e) => t + (num(e.amount) || 0), 0);
  const insWaitThis = done.filter(e => insState(e) === 'pending').reduce((t, e) => t + (num(e.amount) || 0), 0);
  return Object.assign({ days: new Set(done.map(e => e.date)).size, cases: done.length, work, insWaitThis,
    insIn, insInCases, labEst, estCases, frac }, payFor(gross, labAbove, s));
}

// All insurance still waiting for the insurer, oldest first.
export function pendingIns(entries) {
  const list = entries.filter(e => insState(e) === 'pending').sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { list, total: list.reduce((t, e) => t + (num(e.amount) || 0), 0) };
}

// "What if I work <gross> and lab + materials are <labPct>% of the work above the target?"
export function scenario(gross, labPct, s) {
  const over = Math.max(0, gross - s.target);
  return payFor(gross, over * labPct / 100, s);
}

// "How much must I work to take home <pay>?"  null = the salary alone already covers it.
export function grossFor(pay, labPct, s) {
  if (pay <= s.salary) return null;
  if (s.percent <= 0 || labPct >= 100) return Infinity;
  return s.target + (pay - s.salary) / (s.percent / 100) / (1 - labPct / 100);
}
