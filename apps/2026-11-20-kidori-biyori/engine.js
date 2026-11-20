/* 木取り日和 — deterministic, conservative guillotine-style panel layout heuristic.
   No network or external dependencies. All units mm. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Kidori = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const sample = {
    title: '小さな本棚づくり', kerf: 3, margin: 5, minReuse: 180,
    stocks: [
      { name: '手持ち端材 A', w: 680, h: 450, qty: 1, kind: 'offcut', price: 0 },
      { name: '手持ち端材 B', w: 500, h: 320, qty: 1, kind: 'offcut', price: 0 },
      { name: 'ラワン合板 3×6', w: 910, h: 1820, qty: 2, kind: 'new', price: 2400 }
    ],
    parts: [
      { name: '側板', w: 280, h: 900, qty: 2, grain: true },
      { name: '天板・底板', w: 640, h: 280, qty: 2, grain: false },
      { name: '棚板', w: 620, h: 260, qty: 2, grain: false },
      { name: '背面補強', w: 400, h: 160, qty: 1, grain: false }
    ]
  };
  const copy = x => JSON.parse(JSON.stringify(x));
  const number = (v, d = 0) => Number.isFinite(Number(v)) && v !== '' ? Number(v) : d;
  function validate(p) {
    const issues = [];
    if (!p || !Array.isArray(p.stocks) || !Array.isArray(p.parts)) return ['入力データが不正です'];
    if (p.stocks.length < 1 || p.stocks.length > 30 || p.parts.length < 1 || p.parts.length > 60) issues.push('材料・部品はそれぞれ1〜30件、1〜60件にしてください');
    if (number(p.kerf, -1) < 0 || number(p.kerf, -1) > 20 || number(p.margin, -1) < 0 || number(p.margin, -1) > 100) issues.push('刃幅は0〜20mm、四辺余白は0〜100mmにしてください');
    if (number(p.minReuse, -1) < 0 || number(p.minReuse, -1) > 3000) issues.push('再利用基準は0〜3000mmにしてください');
    let sq = 0, pq = 0;
    for (const s of p.stocks) {
      sq += number(s.qty);
      if (![s.w, s.h].every(v => number(v) >= 1 && number(v) <= 5000) || !Number.isInteger(number(s.qty)) || number(s.qty) < 1 || number(s.qty) > 20 || number(s.price) < 0 || number(s.price) > 10000000 || !['new', 'offcut'].includes(s.kind)) issues.push('材料の寸法・数量・価格・種別に不正があります');
    }
    for (const part of p.parts) {
      pq += number(part.qty);
      if (![part.w, part.h].every(v => number(v) >= 1 && number(v) <= 5000) || !Number.isInteger(number(part.qty)) || number(part.qty) < 1 || number(part.qty) > 50) issues.push('部品の寸法または数量に不正があります');
    }
    if (sq > 50 || pq > 150) issues.push('計算上限は材料50枚・部品150個です');
    return [...new Set(issues)];
  }
  const area = r => r.w * r.h;
  function splitFree(rect, w, h, k) {
    const rw = rect.w - w, bh = rect.h - h;
    let out;
    // Each strip can be reached by an axis-aligned full guillotine cut.
    if (rw >= bh) {
      out = [
        { x: rect.x + w + k, y: rect.y, w: rw - k, h: rect.h },
        { x: rect.x, y: rect.y + h + k, w, h: bh - k }
      ];
    } else {
      out = [
        { x: rect.x, y: rect.y + h + k, w: rect.w, h: bh - k },
        { x: rect.x + w + k, y: rect.y, w: rw - k, h }
      ];
    }
    return out.filter(r => r.w > 0.000001 && r.h > 0.000001);
  }
  function plan(project, mode = 'offcut') {
    const problems = validate(project);
    if (problems.length) return { error: problems.join(' / '), stocks: [], unplaced: [], placed: [], cost: 0 };
    const p = copy(project), k = number(p.kerf), margin = number(p.margin), min = number(p.minReuse);
    const stocks = [];
    p.stocks.forEach((s, si) => {
      for (let n = 0; n < number(s.qty); n++) {
        stocks.push({ ...s, instanceIndex: stocks.length, sourceIndex: si, copyNumber: n + 1, used: false, pieces: [], free: [
          { x: margin, y: margin, w: number(s.w) - 2 * margin, h: number(s.h) - 2 * margin }
        ].filter(r => r.w > 0 && r.h > 0) });
      }
    });
    const pieces = [];
    p.parts.forEach((part, pi) => { for (let n = 0; n < number(part.qty); n++) pieces.push({ ...part, partIndex: pi, serial: n + 1, w: number(part.w), h: number(part.h) }); });
    // Large-first heuristic. Fixed grain pieces may not be rotated.
    pieces.sort((a, b) => area(b) - area(a) || Math.max(b.w, b.h) - Math.max(a.w, a.h) || a.partIndex - b.partIndex);
    const unplaced = [], placed = [];
    for (const part of pieces) {
      let best = null;
      stocks.forEach((s, si) => s.free.forEach((r, ri) => {
        const choices = [{ w: part.w, h: part.h, rotated: false }];
        if (!part.grain && part.w !== part.h) choices.push({ w: part.h, h: part.w, rotated: true });
        for (const candidate of choices) {
          if (candidate.w > r.w + 1e-7 || candidate.h > r.h + 1e-7) continue;
          const waste = area(r) - candidate.w * candidate.h;
          const rank = mode === 'offcut'
            ? (s.kind === 'offcut' ? 0 : s.used ? 1 : 2) * 1e10 + waste
            : (s.used ? 0 : 1) * 1e10 + waste + (s.kind === 'new' ? 0.01 : 0);
          const option = { si, ri, rank, ...candidate };
          if (!best || rank < best.rank - 1e-8) best = option;
        }
      }));
      if (!best) { unplaced.push({ name: part.name, w: part.w, h: part.h, grain: !!part.grain, serial: part.serial }); continue; }
      const s = stocks[best.si], r = s.free.splice(best.ri, 1)[0];
      const located = { name: part.name, w: best.w, h: best.h, x: r.x, y: r.y, rotated: best.rotated, partIndex: part.partIndex, serial: part.serial };
      s.used = true; s.pieces.push(located); placed.push({ ...located, stockIndex: best.si });
      s.free.push(...splitFree(r, best.w, best.h, k));
    }
    const used = stocks.filter(s => s.used);
    const remainders = used.flatMap(s => s.free.filter(r => r.w >= min && r.h >= min).map(r => ({ name: s.name, w: r.w, h: r.h, kind: s.kind, sourceIndex: s.sourceIndex })));
    const usedArea = used.reduce((t, s) => t + area(s), 0), partArea = placed.reduce((t, v) => t + area(v), 0);
    return { mode, stocks: used, available: stocks.length, placed, unplaced, remainders,
      cost: used.reduce((t, s) => t + (s.kind === 'new' ? number(s.price) : 0), 0),
      newCount: used.filter(s => s.kind === 'new').length, offcutCount: used.filter(s => s.kind === 'offcut').length,
      usedArea, partArea, utilization: usedArea ? partArea / usedArea : 0,
      reusableArea: remainders.reduce((t, r) => t + area(r), 0),
      success: unplaced.length === 0 };
  }
  return { sample, copy, validate, plan, splitFree };
});
