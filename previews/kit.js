/* Meridian design-directions kit.
   Runs v3.html's own logic modules (Parse, Demo, Compute, Household, Report) on the demo data, so every
   preview shows the same real numbers the app would. Nothing is saved: Prefs is an in-memory stub and
   nothing touches localStorage. Serve the repo root over http and load this with a plain <script>.

   Usage:
     const {M, d, vm} = await MeridianKit.load();          // or load({sparse: true}); load({src: '../v3.html'}) when served elsewhere
     vm.* is a ready-made view model (see buildVM below); M.* exposes every logic module for anything else. */
(function(){
  'use strict';
  const START = '/* ============ CORE: constants, formatters, theme, motion ============ */';
  const END = 'const Charts = (() => {';

  async function load(opts = {}){
    const html = await (await fetch(opts.src || '/v3.html', {cache: 'no-store'})).text();
    const a = html.indexOf(START), b = html.indexOf(END);
    if (a < 0 || b < 0) throw new Error('kit: could not find the logic block in v3.html');
    const factory = new Function(`'use strict';
      const Prefs = (() => { const m = new Map();
        return {get: (k, def) => m.has(k) ? m.get(k) : def, set: (k, v) => { if (v == null) m.delete(k); else m.set(k, v); }}; })();
      // defined further down in v3.html (in the views), but Report.badges calls it
      const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({1: 'st', 2: 'nd', 3: 'rd'})[n % 10] || 'th');
      ${html.slice(a, b)}
      return {Prefs, Fmt, dirClass, GROUPS, ACCOUNTS, CONTRIB_GROUPS, BENCH, IRS_401K_LIMITS, MONTH_ABBR, state, rowsInRange,
              Parse, Demo, Compute, Household, Report, esc, sum, monthsBetween, addMonths, monthStart};`);
    const M = factory();
    const d = M.Demo.build(!!opts.sparse);
    M.state.data = d;
    return {M, d, vm: buildVM(M, d, opts.range || 'ALL')};
  }

  /* line data with a null break wherever there's a long stretch of missing weeks (as v3 draws it) */
  function gapSeries(rows, fn){
    const out = [];
    rows.forEach((r, i) => {
      if (i && r.bigGap) out.push([r.date.getTime() - 864e5, null]);
      out.push([r.date.getTime(), fn(r)]);
    });
    return out;
  }
  const sample = (arr, n = 12) => {
    if (arr.length <= n) return arr;
    const out = [];
    for (let i = 0; i < n; i++) out.push(arr[Math.round(i * (arr.length - 1) / (n - 1))]);
    return out;
  };

  function buildVM(M, d, range){
    const {Compute, Household, Report, Fmt} = M;
    const rows = M.rowsInRange(d.rows, range);
    const s = Compute.stats(rows);
    const last = s.last;

    // Pulse: headline numbers
    const tp = Household.targetAt(d, last.date);
    const nw = Household.netWorth(d);
    const miles = Compute.milestones(d.rows);
    const eta = Compute.milestoneETA(d.rows, miles.next, Compute.realizedRate(d.rows), Household.planContrib(d));
    const lo = rows[0].date.getTime(), hi = last.date.getTime() + 8 * 7 * 864e5;
    const target = (d.target || []).filter(p => p.date.getTime() >= lo && p.date.getTime() <= hi)
                                   .map(p => [p.date.getTime(), Math.round(p.value)]);
    const ddSeries = [];
    s.ddSeries.forEach((p, i) => { if (i && rows[i].bigGap) ddSeries.push([p[0] - 864e5, null]); ddSeries.push(p); });
    const roll = [];
    for (let i = Math.max(52, rows.length - 53); i < rows.length; i++)
      roll.push([rows[i].date.getTime(), rows[i].total / rows[i - 52].total - 1]);

    // Report card
    const R = Report.card(d);
    const badges = Report.badges(d, R);
    const counts = {};
    R.graded.forEach(x => { counts[x.tier] = (counts[x.tier] || 0) + 1; });

    return {
      source: 'Demo data',
      asOf: last.date,
      weeksInView: rows.length,
      portfolio: {
        value: last.total,
        week: s.d1,                                   // {delta, pct} vs the previous row
        since: {from: s.first.date, delta: last.total - s.first.total, pct: last.total / s.first.total - 1},
        target: tp ? {value: tp.value, date: tp.date, diff: last.total - tp.value} : null,
        targetPace: Household.targetPace(d, last.date),   // yearly growth the target path assumes from here
      },
      netWorth: {net: nw.net, items: nw.items},        // items: balance-sheet lines (see Household.netWorth)
      tiles: {
        d4: s.d4, d52: s.d52,                          // {delta, pct}
        dd: {now: s.ddNow, athValue: s.ath.v, athDate: s.ath.date},
        growth: {cagr52: s.cagr52, cagrAll: s.cagrAll},
        spark: {
          d4: s.totalSeries.slice(-13),
          d52: sample(s.totalSeries.slice(-53)),
          dd: sample(s.ddSeries.slice(-53)),
          growth: sample(roll),
        },
      },
      series: {
        total: gapSeries(rows, r => r.total),        // [[ms, $|null]]
        target,                                        // [[ms, $]] the sheet's weekly target path (dashed in v3)
        weekly: s.weekly,                              // [[ms, $ change]] (skips jumps across skipped weeks)
        drawdown: ddSeries,                            // [[ms, % below the running high (negative) | null]]
        byGroup: Compute.groupSeries(rows),            // [{ts, retire, broker, cash, crypto}]
      },
      ath: {value: s.ath.v, date: s.ath.date},
      milestones: {crossed: miles.crossed, next: miles.next, toGo: miles.next - d.rows[d.rows.length - 1].total,
                   eta: eta.compound ? eta.compound.date : null},
      notes: (d.notes || []).filter(n => n.date >= rows[0].date && n.date <= last.date),   // [{date, text}] typed beside a week
      scorecard: Compute.scorecard(rows),              // week-by-week stats for the range
      monthGrid: Compute.monthGrid(d.rows),            // [{year, total:{pct,delta}|null, months:[{pct,delta}|null x12]}]
      yearTable: Compute.yearTable(d),                 // [{year, start, end, change, pct, contribs, growth, ret, best, worst, maxDD, isCurrent}]
      allocation: Compute.drift(rows),                 // [{key, label, now, past, nowAbs}] share now vs a year ago
      week: Report.week(d),                            // this week: delta, rank/of, streak, movers, vsTarget, mtd, ytd...
      report: {
        overall: R.overall,                            // {letter, score, exact, tier, cls, gpa}
        verdict: R.overall ? Report.VERDICT[R.overall.tier] : 'Not enough to grade yet',
        comment: Report.comment(R),
        gradeCounts: counts,                           // {a: 3, b: 2, ...}
        subjects: R.subjects,                          // [{key, name, weight, exact, score, letter, tier, cls, value, unit, why, bench, tip}]
        graded: R.graded.length,
        age: R.age ? R.age.age : null,
        badges: {earned: badges.filter(x => x.earned), ahead: badges.filter(x => !x.earned)},
                                                       // [{group, style, token, title, desc, progress 0-1, when}]
        road: Report.roadAhead(d, R).items,            // [{date, kind, title, sub}] nearest first
        moves: Report.moves(d, R),                     // [{title, text}]
        homework: Report.homework(d),                  // [{id, text, sub}]
        peers: Report.peers(d, R),
      },
      R,                                               // the raw report card, for anything not above
    };
  }

  // buildVM(M, d, range) recomputes the view model for another range ('1Y','3Y','5Y','YTD','ALL')
  window.MeridianKit = {load, buildVM, gapSeries, sample};
})();
