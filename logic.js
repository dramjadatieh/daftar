// Pure money logic for دفتر شغلي (tested by build/test.mjs). No DOM, no Firebase.
// Pay rule (his contract with Art of Teeth, confirmed by him 21-11-2026):
//  - Fixed salary every month (5,000).
//  - The target (20,000) counts ALL his work, before any lab or materials. Up to it (inclusive): salary only,
//    and lab + materials of that work do not concern him.
//  - Above it: % (30) of (work above the target − lab + materials of the cases above the target).
//    A case that crosses the line counts for the part above it, with the same share of its lab.
export const DEF = { target: 20000, percent: 30, salary: 5000, estPct: 15 };

export const num = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v);
export const settingsOf = s => {
  const o = Object.assign({}, DEF);
  for (const k in DEF) if (s && num(s[k]) !== null) o[k] = num(s[k]);
  return o;
};

// Lab + materials of one case: the real number when he typed one (0 included), otherwise the estimate %.
export function labOf(e, s) {
  const real = num(e.lab);
  if (real !== null) return { v: real, est: false };
  return { v: (num(e.amount) || 0) * s.estPct / 100, est: true };
}

// gross = all his work; labAbove = lab + materials of the work above the target.
export function payFor(gross, labAbove, s) {
  const over = Math.max(0, gross - s.target);
  const lab = over > 0 ? Math.min(over, Math.max(0, labAbove)) : 0;
  const base = over - lab;
  const comm = base * s.percent / 100;
  return { gross, over, labAbove: lab, base, comm, pay: s.salary + comm, remaining: Math.max(0, s.target - gross) };
}

const order = (a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.created || '').localeCompare(String(b.created || ''));

export function calcMonth(list, s) {
  let gross = 0, labAbove = 0, labEst = 0, estCases = 0;
  const frac = {};
  for (const e of [...list].sort(order)) {
    const amt = num(e.amount) || 0, before = gross;
    gross += amt;
    const above = Math.max(0, gross - Math.max(before, s.target));
    const f = amt > 0 ? above / amt : 0;
    frac[e.id] = f;
    if (f > 0) {
      const l = labOf(e, s), part = l.v * f;
      labAbove += part;
      if (l.est) { labEst += part; estCases++; }
    }
  }
  const days = new Set(list.map(e => e.date)).size;
  return Object.assign({ days, cases: list.length, labEst, estCases, frac }, payFor(gross, labAbove, s));
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

export const monthOf = d => String(d || '').slice(0, 7);
