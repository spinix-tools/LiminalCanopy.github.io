/* SOROITE — exact, independent card categories / hypergeometric engine. MIT. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SoroiteEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const integer = (x) => Number.isInteger(x);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  function choose(n, k) {
    if (!integer(n) || !integer(k) || n < 0 || k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    let value = 1;
    for (let i = 1; i <= k; i++) value *= (n - k + i) / i;
    return value;
  }
  function validate(cfg) {
    if (!cfg || !integer(cfg.deck) || cfg.deck < 1 || cfg.deck > 200) throw new Error('デッキ枚数は1〜200の整数にしてください');
    if (!integer(cfg.hand) || cfg.hand < 1 || cfg.hand > cfg.deck) throw new Error('初手枚数は1〜デッキ枚数の整数にしてください');
    if (!integer(cfg.turns) || cfg.turns < 0 || cfg.turns > 12) throw new Error('ターン数は0〜12の整数にしてください');
    if (!integer(cfg.drawPerTurn) || cfg.drawPerTurn < 0 || cfg.drawPerTurn > 10) throw new Error('毎ターンのドローは0〜10の整数にしてください');
    if (!Array.isArray(cfg.groups) || cfg.groups.length < 1 || cfg.groups.length > 4) throw new Error('カテゴリは1〜4種類にしてください');
    let used = 0;
    for (const [i, g] of cfg.groups.entries()) {
      if (typeof g.name !== 'string' || !g.name.trim() || g.name.length > 50) throw new Error(`カテゴリ${i+1}の名前を確認してください`);
      if (!integer(g.count) || g.count < 0 || g.count > cfg.deck) throw new Error(`${g.name}の枚数が不正です`);
      if (!integer(g.min) || !integer(g.max) || g.min < 0 || g.max < g.min || g.max > 200) throw new Error(`${g.name}の必要枚数の範囲が不正です`);
      used += g.count;
    }
    if (used > cfg.deck) throw new Error(`カテゴリの合計${used}枚がデッキ${cfg.deck}枚を超えています`);
    return cfg.deck - used;
  }
  // An exact sum of multivariate hypergeometric coefficients.  DP avoids enumerating hands.
  // Categories must be mutually exclusive; the unlabelled remainder is unrestricted.
  function probability(cfg, drawn) {
    const remainder = validate(cfg);
    if (!integer(drawn) || drawn < 0 || drawn > cfg.deck) throw new Error('確認枚数が不正です');
    const dp = new Float64Array(drawn + 1);
    dp[0] = 1;
    for (const g of cfg.groups) {
      const next = new Float64Array(drawn + 1);
      const hi = Math.min(g.max, g.count, drawn);
      const lo = g.min;
      for (let taken = 0; taken <= drawn; taken++) {
        if (!dp[taken]) continue;
        for (let k = lo; k <= hi && taken + k <= drawn; k++) {
          next[taken + k] += dp[taken] * choose(g.count, k);
        }
      }
      dp.set(next);
    }
    let favorable = 0;
    for (let t = 0; t <= drawn; t++) {
      favorable += dp[t] * choose(remainder, drawn - t);
    }
    return clamp01(favorable / choose(cfg.deck, drawn));
  }
  function curve(cfg) {
    validate(cfg);
    return Array.from({length: cfg.turns + 1}, (_, turn) => {
      const seen = Math.min(cfg.deck, cfg.hand + turn * cfg.drawPerTurn);
      return {turn, seen, probability: probability(cfg, seen)};
    });
  }
  function fullRedraw(openingProbability) {
    if (!Number.isFinite(openingProbability) || openingProbability < 0 || openingProbability > 1) throw new Error('確率は0〜1で指定してください');
    return clamp01(1 - (1 - openingProbability) ** 2);
  }
  function suggestions(cfg, drawCount = cfg.hand) {
    const rem = validate(cfg);
    const baseline = probability(cfg, drawCount);
    const out = [];
    cfg.groups.forEach((g, index) => {
      for (const step of [1, -1]) {
        if ((step === 1 && rem === 0) || (step === -1 && g.count === 0)) continue;
        const changed = { ...cfg, groups: cfg.groups.map((item, n) => n === index ? {...item, count: item.count + step} : {...item}) };
        const updated = probability(changed, drawCount);
        out.push({index, step, baseline, updated, delta: updated - baseline, name: g.name});
      }
    });
    return out.sort((a, b) => b.delta - a.delta || a.index - b.index || b.step - a.step);
  }
  function drawSample(cfg, drawn, rng = Math.random) {
    const remainder = validate(cfg);
    if (!integer(drawn) || drawn < 0 || drawn > cfg.deck) throw new Error('確認枚数が不正です');
    const cards = [];
    cfg.groups.forEach((g, idx) => { for (let i = 0; i < g.count; i++) cards.push(idx); });
    for (let i = 0; i < remainder; i++) cards.push(-1);
    for (let i = 0; i < drawn; i++) {
      const random = rng();
      if (!(random >= 0 && random < 1)) throw new Error('乱数が不正です');
      const j = i + Math.floor(random * (cards.length - i));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    const counts = cfg.groups.map((g, idx) => cards.slice(0, drawn).filter(v => v === idx).length);
    const accepted = cfg.groups.every((g, idx) => counts[idx] >= g.min && counts[idx] <= g.max);
    return {counts, other: drawn - counts.reduce((a,b)=>a+b,0), accepted};
  }
  function configureDefaults() {
    return {deck:60, hand:7, turns:6, drawPerTurn:1, groups:[
      {name:'初動カード', count:8, min:1, max:200},
      {name:'エネルギー', count:16, min:2, max:4},
      {name:'重いカード', count:6, min:0, max:1}
    ]};
  }
  return {choose, validate, probability, curve, fullRedraw, suggestions, drawSample, configureDefaults};
});
