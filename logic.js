// Pure money logic for دفتر شغلي (tested by build/test.mjs). No DOM, no Firebase.
// Pay rule (his contract, 21-11-2026): fixed salary every month. Net = what he worked minus lab fees and materials.
// Up to the target (20,000, inclusive) he gets the salary only; the % is paid ONLY on each dirham of net above it.
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

export function payFor(net, s) {
  const over = Math.max(0, net - s.target);
  const comm = over * s.percent / 100;
  return { net, over, comm, pay: s.salary + comm, remaining: Math.max(0, s.target - net) };
}

export function calcMonth(list, s) {
  let gross = 0, labReal = 0, labEst = 0, estCases = 0;
  for (const e of list) {
    gross += num(e.amount) || 0;
    const l = labOf(e, s);
    if (l.est) { labEst += l.v; estCases++; } else labReal += l.v;
  }
  const lab = labReal + labEst;
  const days = new Set(list.map(e => e.date)).size;
  return Object.assign({ gross, lab, labReal, labEst, estCases, days, cases: list.length }, payFor(gross - lab, s));
}

// "What if I work <gross> and lab + materials are <labPct>% of it?"
export function scenario(gross, labPct, s) {
  const lab = gross * labPct / 100;
  return Object.assign({ gross, lab }, payFor(gross - lab, s));
}

// "How much must I work to take home <pay>?"  null = the salary alone already covers it.
export function grossFor(pay, labPct, s) {
  if (pay <= s.salary) return null;
  if (s.percent <= 0 || labPct >= 100) return Infinity;
  const net = s.target + (pay - s.salary) / (s.percent / 100);
  return net / (1 - labPct / 100);
}

export const monthOf = d => String(d || '').slice(0, 7);
