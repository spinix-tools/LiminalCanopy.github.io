/* KANSUI SHIRABE — deterministic aquarium nitrate planning engine (MIT). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KansuiEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DEFAULT = Object.freeze({
    name: 'リビングの淡水水槽', volume: 54, current: 30, tap: 3,
    dailyRise: 1.15, limit: 25, horizon: 42, selectedDay: 14,
    measurements: { start: 12, end: 19, days: 7 },
    plans: [
      { id: 'a', name: 'A · 週1回じっくり', interval: 7, percent: 35, firstDay: 7 },
      { id: 'b', name: 'B · 小分けでこまめに', interval: 3, percent: 18, firstDay: 3 }
    ]
  });
  const deepCopy = (v) => JSON.parse(JSON.stringify(v));
  const finite = (v, label, min, max) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
      throw new Error(label + 'は ' + min + '〜' + max + ' の数値を指定してください');
    }
    return v;
  };
  const safeName = (v, field) => {
    if (typeof v !== 'string' || !v.trim() || v.length > 60) throw new Error(field + 'は1〜60文字で指定してください');
    return v.trim();
  };
  function validate(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('設定データが不正です');
    const p = {
      name: safeName(raw.name, '水槽名'),
      volume: finite(raw.volume, '水量', 1, 10000),
      current: finite(raw.current, '現在のNO₃', 0, 1000),
      tap: finite(raw.tap, '換水用水のNO₃', 0, 1000),
      dailyRise: finite(raw.dailyRise, '1日の正味変化', -20, 50),
      limit: finite(raw.limit, '管理目安', 0.1, 500),
      horizon: finite(raw.horizon, '表示期間', 7, 90),
      selectedDay: finite(raw.selectedDay, '確認日', 0, 90)
    };
    if (!Number.isInteger(p.horizon) || !Number.isInteger(p.selectedDay) || p.selectedDay > p.horizon) throw new Error('表示日数が不正です');
    if (!raw.measurements || typeof raw.measurements !== 'object') throw new Error('測定値が不正です');
    p.measurements = {
      start: finite(raw.measurements.start, '測定1', 0, 1000),
      end: finite(raw.measurements.end, '測定2', 0, 1000),
      days: finite(raw.measurements.days, '測定間隔', 1, 60)
    };
    if (!Number.isInteger(p.measurements.days)) throw new Error('測定間隔は整数日です');
    if (!Array.isArray(raw.plans) || raw.plans.length !== 2) throw new Error('比較プランは2件必要です');
    p.plans = raw.plans.map((x, i) => {
      if (!x || typeof x !== 'object' || x.id !== (i === 0 ? 'a' : 'b')) throw new Error('プラン識別子が不正です');
      const plan = {
        id: x.id, name: safeName(x.name, 'プラン名'),
        interval: finite(x.interval, '換水間隔', 1, 30),
        percent: finite(x.percent, '換水率', 0, 80),
        firstDay: finite(x.firstDay, '初回換水日', 1, 30)
      };
      if (![plan.interval, plan.firstDay].every(Number.isInteger)) throw new Error('日数は整数で指定してください');
      return plan;
    });
    return p;
  }
  function dilute(current, replacement, fraction) {
    finite(current, '濃度', 0, 10000);
    finite(replacement, '換水用水', 0, 10000);
    finite(fraction, '交換率', 0, 1);
    return current * (1 - fraction) + replacement * fraction;
  }
  function isChangeDay(day, plan) {
    return day >= plan.firstDay && (day - plan.firstDay) % plan.interval === 0;
  }
  function simulate(raw, plan, rateOverride) {
    const p = validate(raw);
    const q = plan || p.plans[0];
    const rate = rateOverride === undefined ? p.dailyRise : finite(rateOverride, '変化量', -30, 100);
    const timeline = [{ day: 0, before: p.current, after: p.current, changed: false, liters: 0 }];
    let concentration = p.current;
    let totalLiters = 0, changes = 0, overDays = 0, maxBefore = p.current;
    for (let day = 1; day <= p.horizon; day++) {
      const before = Math.max(0, concentration + rate);
      const changed = isChangeDay(day, q) && q.percent > 0;
      const after = changed ? dilute(before, p.tap, q.percent / 100) : before;
      const liters = changed ? p.volume * q.percent / 100 : 0;
      if (before > p.limit + 1e-9) overDays++;
      maxBefore = Math.max(maxBefore, before);
      changes += changed ? 1 : 0;
      totalLiters += liters;
      timeline.push({ day, before, after, changed, liters });
      concentration = after;
    }
    return { timeline, totalLiters, changes, overDays, maxBefore, end: concentration,
      last: timeline.at(-1), plan: q };
  }
  function steadyPeak(p, plan, rate = p.dailyRise) {
    if (rate <= 0) return p.tap;
    if (plan.percent <= 0) return Infinity;
    return p.tap + rate * plan.interval / (plan.percent / 100);
  }
  function steadyLow(p, plan, rate = p.dailyRise) {
    const peak = steadyPeak(p, plan, rate);
    return Number.isFinite(peak) ? Math.max(0, peak - Math.max(0, rate) * plan.interval) : Infinity;
  }
  // Algebraic long-run estimate; not a guarantee that the first cycle is under target.
  function requiredPercent(p, interval) {
    finite(p.tap, '換水用水', 0, 1000);
    finite(p.dailyRise, '変化率', -20, 50);
    finite(p.limit, '目安', 0.1, 500);
    finite(interval, '間隔', 1, 30);
    if (p.dailyRise <= 0) return { possible: true, value: 0, note: '正味増加がない仮定では定常増加なし' };
    if (p.limit <= p.tap) return { possible: false, value: null, note: '換水用水の濃度が管理目安以上です' };
    const value = 100 * p.dailyRise * interval / (p.limit - p.tap);
    if (value > 80 + 1e-9) return { possible: false, value, note: 'この換水間隔では80%の上限を超えます' };
    return { possible: true, value, note: '定常状態の換水直前ピークに基づく概算' };
  }
  function estimateRate(m) {
    if (!m || typeof m !== 'object') throw new Error('測定値が不正です');
    const start = finite(m.start, '初回測定', 0, 1000);
    const end = finite(m.end, '最終測定', 0, 1000);
    const days = finite(m.days, '測定日数', 1, 60);
    return (end - start) / days;
  }
  function sensitivity(p, plan, proportion = 0.30) {
    finite(proportion, '変動幅', 0, 1);
    const low = Math.max(-20, p.dailyRise - Math.abs(p.dailyRise) * proportion - (p.dailyRise === 0 ? 0.2 : 0));
    const high = Math.min(100, p.dailyRise + Math.abs(p.dailyRise) * proportion + (p.dailyRise === 0 ? 0.2 : 0));
    return { low, high, lowResult: simulate(p, plan, low), highResult: simulate(p, plan, high) };
  }
  function compare(p) {
    const a = simulate(p, p.plans[0]), b = simulate(p, p.plans[1]);
    const score = x => [x.overDays, x.maxBefore, x.totalLiters];
    const as = score(a), bs = score(b);
    let preferred = null;
    for (let i = 0; i < as.length; i++) {
      if (Math.abs(as[i] - bs[i]) > 1e-7) { preferred = as[i] < bs[i] ? 'a' : 'b'; break; }
    }
    return { a, b, preferred };
  }
  function toCSV(p) {
    const c = compare(p);
    const quote = x => '"' + String(x).replace(/"/g, '""') + '"';
    const rows = [['day','A_before_ppm','A_after_ppm','A_changed_l','B_before_ppm','B_after_ppm','B_changed_l']];
    for (let d = 0; d <= p.horizon; d++) {
      const a = c.a.timeline[d], b = c.b.timeline[d];
      rows.push([d,a.before,a.after,a.liters,b.before,b.after,b.liters].map(v=>typeof v === 'number' ? Number(v.toFixed(4)) : v));
    }
    return '\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
  }
  return { DEFAULT, deepCopy, validate, dilute, isChangeDay, simulate, steadyPeak, steadyLow,
    requiredPercent, estimateRate, sensitivity, compare, toCSV };
});
