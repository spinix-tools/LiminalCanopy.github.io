/* NUKIKEN NAVI — Exact finite-lot sampling model. MIT License. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.NukiEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_LOT = 100000;
  const MAX_SAMPLE = 500;
  let cachedN = -1;
  let logFact = null;

  function integer(value, label, min, max) {
    const x = Number(value);
    if (!Number.isSafeInteger(x) || x < min || x > max) throw new Error(`${label}は${min}〜${max}の整数で入力してください。`);
    return x;
  }
  function decimal(value, label, min, max) {
    const x = Number(value);
    if (value === '' || value === null || !Number.isFinite(x) || x < min || x > max) throw new Error(`${label}は${min}〜${max}の数値で入力してください。`);
    return x;
  }
  function validatePlan(plan) {
    const N = integer(plan.N, 'ロット数', 2, MAX_LOT);
    const n = integer(plan.n, '抽出数', 1, Math.min(N, MAX_SAMPLE));
    const c = integer(plan.c, '合格許容不良数', 0, n);
    const good = decimal(plan.good, '良品側の想定不良率', 0, 100);
    const bad = decimal(plan.bad, '不良側の想定不良率', 0, 100);
    if (good >= bad) throw new Error('良品側の不良率は、不良側より小さくしてください。');
    const minutes = decimal(plan.minutes, '1個の検査時間', 0.01, 10000);
    const target = decimal(plan.target, '見逃し確率の目標', 0.1, 99.9);
    return { N, n, c, good, bad, minutes, target };
  }
  function prepare(N) {
    if (N === cachedN) return;
    const table = new Float64Array(N + 1);
    for (let j = 2; j <= N; j++) table[j] = table[j - 1] + Math.log(j);
    cachedN = N;
    logFact = table;
  }
  function logCombination(N, k) {
    if (k < 0 || k > N || !Number.isInteger(k)) return -Infinity;
    return logFact[N] - logFact[k] - logFact[N - k];
  }
  /** P(X<=c) for Hypergeometric(N, D, n), sample without replacement. */
  function acceptProbability(N, D, n, c) {
    N = integer(N, 'ロット数', 2, MAX_LOT);
    D = integer(D, '不良総数', 0, N);
    n = integer(n, '抽出数', 1, Math.min(N, MAX_SAMPLE));
    c = integer(c, '合格許容不良数', 0, n);
    if (c >= Math.min(D, n)) return 1;
    const from = Math.max(0, n - (N - D));
    const to = Math.min(c, n, D);
    if (to < from) return 0;
    prepare(N);
    const denominator = logCombination(N, n);
    let sum = 0;
    for (let k = from; k <= to; k++) {
      sum += Math.exp(logCombination(D, k) + logCombination(N-D, n-k) - denominator);
    }
    return Math.min(1, Math.max(0, sum));
  }
  function defectsForPct(N, percent) {
    return Math.min(N, Math.max(0, Math.round(N * decimal(percent, '想定不良率', 0, 100) / 100)));
  }
  function metrics(plan) {
    const p = validatePlan(plan);
    const goodD = defectsForPct(p.N, p.good), badD = defectsForPct(p.N, p.bad);
    const pGood = acceptProbability(p.N, goodD, p.n, p.c);
    const pBad = acceptProbability(p.N, badD, p.n, p.c);
    return { ...p, goodD, badD, producerRisk: 1 - pGood, consumerRisk: pBad,
      estimatedMinutes: p.n * p.minutes, inspectedPct: p.n / p.N * 100,
      goodAcceptance: pGood, badAcceptance: pBad };
  }
  function curve(plan, points = 31) {
    const p = validatePlan(plan);
    points = integer(points, '描画点数', 2, 101);
    const range = Math.max(10, Math.min(100, Math.ceil(p.bad * 2 / 5) * 5));
    const rows = [];
    for (let i = 0; i < points; i++) {
      const rate = range * i / (points - 1);
      rows.push({ rate, D: defectsForPct(p.N, rate), p: acceptProbability(p.N, defectsForPct(p.N, rate), p.n, p.c) });
    }
    return rows;
  }
  /** Minimum n achieving consumer-risk threshold for a fixed c and integer D. */
  function minimumSample(plan) {
    const p = validatePlan(plan);
    const D = defectsForPct(p.N, p.bad);
    const threshold = p.target / 100;
    for (let n = Math.max(p.c, 1); n <= Math.min(p.N, MAX_SAMPLE); n++) {
      if (acceptProbability(p.N, D, n, p.c) <= threshold + 1e-12) {
        return { n, risk: acceptProbability(p.N, D, n, p.c), D };
      }
    }
    return null;
  }
  /** Uniform [0, upper), using cryptographic randomness if available. */
  function randomBelow(upper) {
    upper = integer(upper, '上限', 1, MAX_LOT);
    const cryptoSource = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (cryptoSource && typeof cryptoSource.getRandomValues === 'function') {
      const m = 4294967296;
      const ceiling = Math.floor(m / upper) * upper;
      const a = new Uint32Array(1);
      do { cryptoSource.getRandomValues(a); } while (a[0] >= ceiling);
      return a[0] % upper;
    }
    return Math.floor(Math.random() * upper);
  }
  function randomMethod() {
    return typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function' ? 'ブラウザの暗号学的乱数' : '標準擬似乱数（フォールバック）';
  }
  /** Floyd's algorithm for unique sample numbers, O(n), no replacement. */
  function pickIds(N, n, rand = randomBelow) {
    N = integer(N, 'ロット数', 2, MAX_LOT);
    n = integer(n, '抽出数', 1, Math.min(N, MAX_SAMPLE));
    const chosen = new Set();
    for (let j = N - n + 1; j <= N; j++) {
      const t = rand(j);
      if (!Number.isInteger(t) || t < 0 || t >= j) throw new Error('乱数ソースが不正です。');
      const number = t + 1;
      chosen.add(chosen.has(number) ? j : number);
    }
    return Array.from(chosen).sort((a, b) => a - b);
  }
  function assessment(statuses, c) {
    if (!Array.isArray(statuses) || statuses.length < 1 || statuses.length > MAX_SAMPLE) throw new Error('検査一覧が無効です。');
    c = integer(c, '合格許容不良数', 0, statuses.length);
    if (statuses.some(x => !['pending','ok','bad'].includes(x))) throw new Error('不正な検査状態です。');
    const bad = statuses.filter(x => x === 'bad').length;
    const ok = statuses.filter(x => x === 'ok').length;
    const pending = statuses.length - bad - ok;
    return { bad, ok, pending, decision: pending ? '未確定' : bad <= c ? '合格' : '不合格' };
  }
  function csvEscape(value) {
    const s = String(value ?? '');
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s;
  }
  function exportCsv(ids, statuses, c) {
    const decision = assessment(statuses, c).decision;
    const lines = ['抽出番号,検査状態,全体判定'];
    for (let i = 0; i < ids.length; i++) lines.push([ids[i], statuses[i] === 'ok' ? '良' : statuses[i] === 'bad' ? '不良' : '未確認', decision].map(csvEscape).join(','));
    return '\uFEFF' + lines.join('\r\n') + '\r\n';
  }
  return { MAX_LOT, MAX_SAMPLE, integer, decimal, validatePlan, acceptProbability, defectsForPct, metrics, curve, minimumSample, randomMethod, pickIds, assessment, exportCsv };
});
