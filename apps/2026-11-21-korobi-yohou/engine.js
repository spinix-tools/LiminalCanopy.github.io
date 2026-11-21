/* KOROBI YOHOU — pure probability engine, no dependencies. MIT */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Korobi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MODES = ['normal', 'advantage', 'disadvantage'];
  const DEFAULT = {
    title: '霧の砦：5つの難関', count: 2, sides: 6, modifier: 1,
    assist: 2, streak: 3, riskGoal: 15,
    steps: [
      { id: 's1', name: '迷いの森', dc: 7, repeats: 2, mode: 'normal' },
      { id: 's2', name: '扉の解除', dc: 9, repeats: 2, mode: 'normal' },
      { id: 's3', name: '見張りの目', dc: 10, repeats: 2, mode: 'normal' },
      { id: 's4', name: '橋を渡る', dc: 8, repeats: 2, mode: 'disadvantage' },
      { id: 's5', name: '最後の門', dc: 11, repeats: 2, mode: 'normal' }
    ]
  };
  const integer = (v, lo, hi, label) => {
    if ((typeof v !== 'number' && typeof v !== 'string') || String(v).trim() === '' || !Number.isInteger(Number(v)) || Number(v) < lo || Number(v) > hi) {
      throw Error(`${label}は${lo}〜${hi}の整数にしてください`);
    }
    return Number(v);
  };
  function validate(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('設定の形式が不正です');
    const title = String(value.title ?? '').trim().slice(0, 70);
    const count = integer(value.count, 1, 6, 'ダイス個数');
    const sides = integer(value.sides, 2, 100, '面数');
    const modifier = integer(value.modifier, -100, 100, '修正値');
    const assist = integer(value.assist, 0, 12, '比較補正');
    const streak = integer(value.streak, 1, 10, '連続失敗回数');
    const riskGoal = integer(value.riskGoal, 1, 99, '目標リスク');
    if (!Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 24) throw Error('判定は1〜24行にしてください');
    const steps = value.steps.map((s, i) => {
      if (!s || typeof s !== 'object' || Array.isArray(s)) throw Error(`判定${i + 1}の形式が不正です`);
      const name = String(s.name ?? '').trim().slice(0, 48) || `判定 ${i + 1}`;
      const dc = integer(s.dc, -200, 700, '目標値');
      const repeats = integer(s.repeats, 1, 12, '反復回数');
      const mode = String(s.mode || 'normal');
      if (!MODES.includes(mode)) throw Error('有利／不利の指定が不正です');
      return { id: String(s.id || `step${i}`).slice(0, 30), name, dc, repeats, mode };
    });
    if (steps.reduce((acc, x) => acc + x.repeats, 0) > 120) throw Error('判定の合計回数は120以下にしてください');
    return { title, count, sides, modifier, assist, streak, riskGoal, steps };
  }
  function defaultPlan() { return JSON.parse(JSON.stringify(DEFAULT)); }
  function distribution(count, sides, modifier = 0) {
    count = integer(count, 1, 6, '個数');
    sides = integer(sides, 2, 100, '面数');
    modifier = integer(modifier, -200, 200, '修正値');
    let pmf = new Float64Array(1); pmf[0] = 1;
    for (let die = 0; die < count; die++) {
      const next = new Float64Array(pmf.length + sides);
      for (let x = 0; x < pmf.length; x++) {
        if (!pmf[x]) continue;
        for (let face = 1; face <= sides; face++) next[x + face] += pmf[x] / sides;
      }
      pmf = next;
    }
    return { min: count + modifier, max: count * sides + modifier, pmf: Array.from(pmf.slice(count)) };
  }
  // P(max(X,Y) >= dc) and P(min(X,Y) >= dc) for independent complete roll totals X,Y.
  function successProbability(dist, dc, mode = 'normal') {
    if (!MODES.includes(mode)) throw Error('有利／不利の指定が不正です');
    const p = Math.min(1, Math.max(0, dist.pmf.reduce((sum, v, i) => sum + (dist.min + i >= dc ? v : 0), 0)));
    if (mode === 'advantage') return 1 - (1 - p) ** 2;
    if (mode === 'disadvantage') return p ** 2;
    return Math.min(1, Math.max(0, p));
  }
  function expand(plan, bonus = 0) {
    const parsed = validate(plan);
    const dist = distribution(parsed.count, parsed.sides, parsed.modifier + bonus);
    return parsed.steps.flatMap(step => {
      const p = successProbability(dist, step.dc, step.mode);
      return Array.from({ length: step.repeats }, (_, i) => ({
        id: step.id, name: step.name, occurrence: i + 1, dc: step.dc, mode: step.mode, p
      }));
    });
  }
  // Exact DP: mass for current failure-run lengths 0..k-1; any k-run removed into hit state.
  function streakRisk(successRates, k) {
    k = integer(k, 1, 120, '連続回数');
    let states = new Float64Array(k); states[0] = 1;
    let hit = 0;
    for (const p of successRates) {
      if (!(p >= 0 && p <= 1) || !Number.isFinite(p)) throw Error('確率は0〜1で指定してください');
      const next = new Float64Array(k);
      const survived = states.reduce((a, b) => a + b, 0);
      next[0] = survived * p;
      for (let r = 0; r < k; r++) {
        if (r + 1 >= k) hit += states[r] * (1 - p);
        else next[r + 1] += states[r] * (1 - p);
      }
      states = next;
    }
    return Math.min(1, Math.max(0, hit));
  }
  function successHistogram(successRates) {
    let probs = [1];
    for (const p of successRates) {
      if (!(p >= 0 && p <= 1) || !Number.isFinite(p)) throw Error('確率は0〜1で指定してください');
      const next = Array(probs.length + 1).fill(0);
      for (let i = 0; i < probs.length; i++) {
        next[i] += probs[i] * (1 - p);
        next[i + 1] += probs[i] * p;
      }
      probs = next;
    }
    return probs;
  }
  function analyse(plan, bonus = 0) {
    const config = validate(plan);
    bonus = integer(bonus, 0, 12, '追加補正');
    const expanded = expand(config, bonus);
    const ps = expanded.map(x => x.p);
    const histogram = successHistogram(ps);
    let allSuccess = ps.reduce((a, b) => a * b, 1);
    const expected = ps.reduce((a, b) => a + b, 0);
    const risk = streakRisk(ps, config.streak);
    let cursor = 0;
    const perStep = config.steps.map(step => {
      const p = expanded[cursor].p;
      cursor += step.repeats;
      return { ...step, p };
    });
    return { total: ps.length, risk, expected, allSuccess, histogram, expanded, perStep, bonus };
  }
  function recommendation(plan) {
    const config = validate(plan);
    for (let bonus = 0; bonus <= 12; bonus++) {
      const result = analyse(config, bonus);
      if (result.risk * 100 <= config.riskGoal + 1e-8) return { bonus, risk: result.risk, possible: true };
    }
    const best = analyse(config, 12);
    return { bonus: 12, risk: best.risk, possible: false };
  }
  function randomInt(max, randomBytes) {
    // Uniform cryptographic sampling with rejection, avoiding modulo bias.
    if (!Number.isInteger(max) || max < 1 || max > 65536) throw Error('乱数の範囲が不正です');
    const bytes = randomBytes || (len => { const a = new Uint32Array(len); crypto.getRandomValues(a); return a; });
    const cap = 0x100000000 - (0x100000000 % max);
    for (let n = 0; n < 1000; n++) {
      const r = bytes(1)[0] >>> 0;
      if (r < cap) return r % max;
    }
    throw Error('乱数生成に失敗しました');
  }
  function roll(plan, randomBytes) {
    const config = validate(plan);
    function attempt() {
      const rolls = Array.from({ length: config.count }, () => randomInt(config.sides, randomBytes) + 1);
      return { rolls, total: rolls.reduce((a, b) => a + b, config.modifier) };
    }
    const results = [];
    for (const step of config.steps) {
      for (let i = 0; i < step.repeats; i++) {
        const a = attempt(), b = step.mode === 'normal' ? null : attempt();
        const chosen = !b ? a : (step.mode === 'advantage' ? (a.total >= b.total ? a : b) : (a.total <= b.total ? a : b));
        results.push({ name: step.name, dc: step.dc, occurrence: i + 1, success: chosen.total >= step.dc, total: chosen.total, dice: chosen.rolls, otherTotal: b ? (chosen === a ? b.total : a.total) : null });
      }
    }
    return results;
  }
  function csvCell(value) {
    const text = String(value ?? '');
    // Prevent spreadsheet formula execution; user-editable title/label may be hostile.
    const safe = /^[\s]*[=+@-]/.test(text) ? "'" + text : text;
    return '"' + safe.replace(/"/g, '""') + '"';
  }
  function toCsv(plan) {
    const config = validate(plan);
    const a = analyse(config, 0), b = analyse(config, config.assist);
    const rows = [['判定','回数','目標値','有利/不利','通常成功率(%)',`補正+${config.assist}成功率(%)`]];
    a.perStep.forEach((step, i) => rows.push([step.name, step.repeats, step.dc, step.mode, (100 * step.p).toFixed(2), (100 * b.perStep[i].p).toFixed(2)]));
    rows.push(['全体',a.total,'','',`期待成功回数 ${a.expected.toFixed(3)}`, `期待成功回数 ${b.expected.toFixed(3)}`]);
    rows.push([`${config.streak}連続失敗以上の確率`, '', '', '', (a.risk * 100).toFixed(2), (b.risk * 100).toFixed(2)]);
    return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }
  return { DEFAULT, MODES, defaultPlan, validate, distribution, successProbability, expand, streakRisk, successHistogram, analyse, recommendation, randomInt, roll, toCsv };
});
