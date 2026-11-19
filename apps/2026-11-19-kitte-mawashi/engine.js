/* KITTE MAWASHI: local exact bounded-inventory batch postage assignment. MIT */
(function (root, make) {
  const api = make();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.KitteEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_STOCK_TYPES = 8, MAX_MAILS = 4, MAX_STAMPS = 5, MAX_STATES = 160000;
  function int(value, min, max, label) {
    const n = Number(value);
    if (value === '' || value === null || value === undefined || !Number.isSafeInteger(n) || n < min || n > max) {
      throw new Error(`${label}は${min}〜${max}の整数で指定してください`);
    }
    return n;
  }
  function normalize(project) {
    if (!project || !Array.isArray(project.stocks) || !Array.isArray(project.mails)) throw new Error('在庫と郵便物が必要です');
    if (project.stocks.length < 1 || project.stocks.length > MAX_STOCK_TYPES) throw new Error('切手の種類は1〜8種類です');
    if (project.mails.length < 1 || project.mails.length > MAX_MAILS) throw new Error('郵便物は1〜4件です');
    const stocks = project.stocks.map((s, i) => ({
      value: int(s.value, 1, 2000, `切手${i + 1}の額面`),
      count: int(s.count, 0, 30, `切手${i + 1}の枚数`)
    }));
    if (new Set(stocks.map(s => s.value)).size !== stocks.length) throw new Error('同じ額面は1行にまとめてください');
    const mails = project.mails.map((m, i) => ({
      label: String(m.label || `郵便物${i + 1}`).slice(0, 40),
      target: int(m.target, 1, 2000, `郵便物${i + 1}の料金`),
      maxStamps: int(m.maxStamps, 1, MAX_STAMPS, `郵便物${i + 1}の貼付上限`)
    }));
    const overLimit = int(project.overLimit, 0, 100, '各通の超過許容額');
    const objective = project.objective === 'pieces' ? 'pieces' : 'excess';
    return { stocks, mails, overLimit, objective };
  }
  function optionsForMail(stocks, mail, overLimit) {
    const out = [], counts = Array(stocks.length).fill(0);
    function dfs(i, sum, used) {
      if (sum > mail.target + overLimit || used > mail.maxStamps) return;
      if (i === stocks.length) {
        if (used && sum >= mail.target) out.push({counts: counts.slice(), total: sum, excess: sum - mail.target, pieces: used});
        return;
      }
      const stock = stocks[i];
      const upper = Math.min(stock.count, mail.maxStamps - used, Math.floor((mail.target + overLimit - sum) / stock.value));
      for (let n = 0; n <= upper; n++) {
        counts[i] = n;
        dfs(i + 1, sum + stock.value * n, used + n);
      }
      counts[i] = 0;
    }
    dfs(0, 0, 0);
    return out;
  }
  function compare(a, b, objective) {
    if (!b) return -1;
    if (objective === 'pieces') return a.pieces - b.pieces || a.excess - b.excess;
    return a.excess - b.excess || a.pieces - b.pieces;
  }
  function buildAssignments(p, picks) {
    const remaining = p.stocks.map(x => x.count);
    const rows = picks.map((opt, j) => {
      const stamps = p.stocks.flatMap((s, i) => {
        remaining[i] -= opt.counts[i];
        return opt.counts[i] ? [{value: s.value, count: opt.counts[i]}] : [];
      });
      return {...p.mails[j], paid: opt.total, excess: opt.excess, pieces: opt.pieces, stamps};
    });
    return {rows, remaining, totalExcess: rows.reduce((s,r)=>s+r.excess,0), totalPieces: rows.reduce((s,r)=>s+r.pieces,0)};
  }
  function plan(raw, cfg = {}) {
    const p = normalize(raw);
    const options = p.mails.map(m => optionsForMail(p.stocks, m, p.overLimit));
    const empty = options.findIndex(o => o.length === 0);
    if (empty !== -1) return {ok:false, reason:`「${p.mails[empty].label}」に使える組合せがありません（枚数上限・超過許容額を確認）`, candidateCounts:options.map(o=>o.length), explored:0};
    for (const o of options) o.sort((a,b)=>compare(a,b,p.objective));
    const initial = p.stocks.map(s => s.count);
    let explored = 0;
    const memo = new Map();
    const limit = cfg.maxStates === undefined ? MAX_STATES : cfg.maxStates;
    function solve(i, remaining) {
      if (i === options.length) return {excess:0,pieces:0,picks:[]};
      const key = `${i}|${remaining.join(',')}`;
      if (memo.has(key)) return memo.get(key);
      explored++;
      if (explored > limit) throw new Error(`探索上限（${limit.toLocaleString()}状態）を超過しました。切手種類・郵便物数・許容超過を減らしてください。最適解は未確定です`);
      let best = null;
      for (const choice of options[i]) {
        if (choice.counts.some((n,j) => n > remaining[j])) continue;
        const next = remaining.map((n,j) => n - choice.counts[j]);
        const tail = solve(i + 1, next);
        if (!tail) continue;
        const proposed = {excess:choice.excess + tail.excess, pieces:choice.pieces + tail.pieces, picks:[choice,...tail.picks]};
        if (compare(proposed,best,p.objective) < 0) best = proposed;
      }
      memo.set(key,best);
      return best;
    }
    const best = solve(0,initial);
    let rem = initial.slice(), greedyPicks = [];
    for (const opts of options) {
      const choice = opts.find(o=>o.counts.every((n,j)=>n<=rem[j]));
      if (!choice) {greedyPicks = null; break; }
      greedyPicks.push(choice);
      rem = rem.map((n,j)=>n-choice.counts[j]);
    }
    const greedy = greedyPicks ? buildAssignments(p,greedyPicks) : null;
    if (!best) return {ok:false,reason:'それぞれの郵便物には候補がありますが、在庫を同時に割り当てる解がありません',candidateCounts:options.map(o=>o.length),explored,greedy};
    return {ok:true, ...buildAssignments(p,best.picks), greedy, explored, candidateCounts:options.map(o=>o.length), objective:p.objective, exact:true};
  }
  function applyPlan(raw, solved) {
    if (!solved || !solved.ok || !solved.exact) throw new Error('確定できる計算結果がありません');
    const p = normalize(raw);
    if (solved.remaining.length !== p.stocks.length) throw new Error('在庫が変更されています');
    const calculated = plan(p);
    if (!calculated.ok || JSON.stringify(calculated.remaining) !== JSON.stringify(solved.remaining) ||
        JSON.stringify(calculated.rows) !== JSON.stringify(solved.rows)) throw new Error('計画が変更されています。再計算してください');
    return {...p, stocks:p.stocks.map((s,i)=>({...s,count:solved.remaining[i]}))};
  }
  return { normalize, optionsForMail, compare, plan, applyPlan };
});