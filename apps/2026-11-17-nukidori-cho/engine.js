/* ぬきどり帳: finite-lot sampling core. No external packages or network. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Nukidori = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const factorials = new Map();
  function whole(v, min, max, name) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw Error(name + 'は' + min + '〜' + max + 'の整数で入力してください');
    return n;
  }
  function percent(v, name) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) throw Error(name + 'は0〜100%で入力してください');
    return n;
  }
  function logFacts(N) {
    if (factorials.has(N)) return factorials.get(N);
    const a = new Float64Array(N + 1);
    for (let i = 2; i <= N; i++) a[i] = a[i - 1] + Math.log(i);
    factorials.clear(); // avoid unbounded caches when users change N repeatedly
    factorials.set(N, a);
    return a;
  }
  function chooseLog(f, n, k) {
    if (k < 0 || k > n) return -Infinity;
    return f[n] - f[k] - f[n-k];
  }
  function acceptance(N, D, n, c) {
    whole(N, 1, 50000, 'ロット数');
    whole(D, 0, N, '不適合数');
    whole(n, 1, N, '抜取数');
    whole(c, 0, n, '合格許容数');
    const lo = Math.max(0, n - (N-D)), hi = Math.min(n, D, c);
    if (c < lo) return 0;
    if (c >= Math.min(n,D)) return 1;
    const f = logFacts(N);
    let x = lo;
    let p = Math.exp(chooseLog(f, D, x) + chooseLog(f, N-D, n-x) - chooseLog(f, N, n));
    let sum = 0;
    while (x <= hi) {
      sum += p;
      p *= ((D-x) / (x+1)) * ((n-x) / (N-D-n+x+1));
      x++;
    }
    return Math.min(1, Math.max(0, sum));
  }
  function risk(N, n, c, good, bad) {
    const Dgood = Math.round(N * percent(good, '良品側の不適合率') / 100);
    const Dbad = Math.round(N * percent(bad, '不良側の不適合率') / 100);
    const passGood = acceptance(N, Dgood, n, c);
    const passBad = acceptance(N, Dbad, n, c);
    return { Dgood, Dbad, passGood, passBad, alpha: 1-passGood, beta: passBad };
  }
  function search(cfg) {
    const N = whole(cfg.N, 2, 50000, 'ロット数');
    const good = percent(cfg.good,'良品側の不適合率');
    const bad = percent(cfg.bad,'不良側の不適合率');
    const alpha = percent(cfg.alpha,'生産者危険上限') / 100;
    const beta = percent(cfg.beta,'消費者危険上限') / 100;
    const maxN = whole(cfg.maxN,1,Math.min(500,N),'検査数上限');
    if (good >= bad) throw Error('良品側の率は不良側より小さくしてください');
    if (Math.round(N*good/100) >= Math.round(N*bad/100))
      throw Error('このロット数では両方の不適合品数が同じです。閾値の差を広げてください');
    let closest = null;
    for (let n = 1; n <= maxN; n++) {
      for (let c=0; c <= Math.min(n,30); c++) {
        const r = risk(N,n,c,good,bad);
        const score = Math.max(0,r.alpha-alpha) + Math.max(0,r.beta-beta);
        if (!closest || score < closest.score - 1e-12 || (Math.abs(score-closest.score)<1e-12 && n<closest.n))
          closest = {n,c,score,...r};
        if (r.alpha <= alpha+1e-12 && r.beta <= beta+1e-12)
          return {found:true,n,c, ...r, limitN:maxN};
      }
    }
    return {found:false,limitN:maxN,closest};
  }
  function rng(seed) {
    let x = 2166136261;
    const str = String(seed);
    for (let i=0;i<str.length;i++) { x ^= str.charCodeAt(i); x=Math.imul(x,16777619); }
    if (!x) x = 0x6d2b79f5;
    return function () { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0)/4294967296; };
  }
  function pick(N,n,seed) {
    whole(N,1,50000,'ロット数'); whole(n,1,N,'抜取数');
    const random = rng(seed), swaps = new Map(), out=[];
    for (let i=0;i<n;i++) {
      const j = i + Math.floor(random()*(N-i));
      const picked = swaps.has(j) ? swaps.get(j) : j;
      const left = swaps.has(i) ? swaps.get(i) : i;
      swaps.set(j,left);
      out.push(picked+1);
    }
    return out.sort((a,b)=>a-b);
  }
  function decision(statuses,c) {
    const fail=statuses.filter(x=>x==='ng').length;
    const pass=statuses.filter(x=>x==='ok').length;
    const pending=statuses.length-fail-pass;
    return {fail,pass,pending,verdict:fail>c?'reject':pending===0?'accept':'pending'};
  }
  function csv(rows) {
    return '\ufeff' + rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n')+'\r\n';
  }
  return { whole,percent,acceptance,risk,search,pick,decision,csv };
});