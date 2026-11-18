/* ずらし畑 / ZURASHIBATA — deterministic offline schedule calculations. MIT. */
(function (root, make) {
  const api = make();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ZurashiEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400000;
  const assert = (ok, msg) => { if (!ok) throw new Error(msg); };
  function dateMs(s) {
    assert(typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s), '日付はYYYY-MM-DDで指定してください');
    const [y, m, d] = s.split('-').map(Number);
    const ms = Date.UTC(y, m - 1, d);
    assert(y >= 2000 && y <= 2099 && new Date(ms).toISOString().slice(0, 10) === s, '無効な日付です: ' + s);
    return ms;
  }
  const iso = ms => new Date(ms).toISOString().slice(0, 10);
  const addDays = (date, days) => iso(dateMs(date) + days * DAY);
  const daysBetween = (a, b) => (dateMs(b) - dateMs(a)) / DAY;
  function monday(date) {
    const t = dateMs(date), weekday = new Date(t).getUTCDay();
    return iso(t - ((weekday + 6) % 7) * DAY);
  }
  function integer(v, lo, hi, label) {
    const n = Number(v);
    assert(Number.isInteger(n) && n >= lo && n <= hi, label + 'は' + lo + '〜' + hi + 'の整数で指定してください');
    return n;
  }
  function name(v, max, label) {
    assert(typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= max, label + 'は1〜' + max + '文字で指定してください');
    return v.trim();
  }
  function normalizeProject(p) {
    assert(p && typeof p === 'object' && !Array.isArray(p), 'プロジェクト形式が不正です');
    assert(p.version === 1, '未対応のプロジェクト版です');
    assert(Array.isArray(p.beds) && p.beds.length >= 1 && p.beds.length <= 12, '区画は1〜12個です');
    const beds = p.beds.map(b => name(b, 24, '区画名'));
    assert(new Set(beds).size === beds.length, '区画名が重複しています');
    assert(Array.isArray(p.batches) && p.batches.length <= 300, '作付けは300件以下です');
    const seen = new Set();
    const batches = p.batches.map((b, i) => {
      assert(b && typeof b === 'object' && !Array.isArray(b), '作付けデータが不正です');
      const id = name(b.id, 90, 'ID');
      assert(!seen.has(id), '作付けIDが重複しています'); seen.add(id);
      const bed = name(b.bed, 24, '区画名');
      assert(beds.includes(bed), '存在しない区画です: ' + bed);
      dateMs(b.sow);
      return {
        id, crop: name(b.crop, 48, '作物名'), bed, sow: b.sow,
        maturity: integer(b.maturity, 1, 365, '収穫開始までの日数'),
        window: integer(b.window, 1, 90, '収穫期間'),
        yield: integer(b.yield, 0, 10000, '収穫見込み量'),
        reset: integer(b.reset, 0, 90, '片付け日数')
      };
    });
    return { version: 1, title: name(p.title || 'わたしの菜園', 60, '計画名'),
      beds, target: integer(p.target, 1, 5000, '週間目標'),
      horizon: integer(p.horizon, 4, 52, '表示週数'), batches };
  }
  function harvestStart(b) { return addDays(b.sow, b.maturity); }
  function harvestEnd(b) { return addDays(harvestStart(b), b.window - 1); }
  function occupiedEnd(b) { return addDays(b.sow, b.maturity + b.window + b.reset); } // exclusive
  function detectCollisions(batches) {
    const problems = [];
    const ordered = batches.slice().sort((a,b) => a.bed.localeCompare(b.bed) || a.sow.localeCompare(b.sow));
    for (let i = 0; i < ordered.length; i++) {
      for (let j = i+1; j < ordered.length; j++) {
        const a = ordered[i], b = ordered[j];
        if (a.bed !== b.bed) break;
        if (dateMs(a.sow) < dateMs(occupiedEnd(b)) && dateMs(b.sow) < dateMs(occupiedEnd(a))) {
          problems.push({ a:a.id, b:b.id, bed:a.bed, cropA:a.crop, cropB:b.crop });
        }
      }
    }
    return problems;
  }
  function analyze(p, origin) {
    const project = normalizeProject(p);
    const bs = project.batches;
    const first = bs.length ? bs.map(harvestStart).sort()[0] : '2027-04-01';
    const from = monday(origin || first);
    const startMs = dateMs(from);
    const sums = new Array(project.horizon).fill(0);
    let outside = 0;
    for (const b of bs) {
      const perDay = b.yield / b.window;
      const begin = dateMs(harvestStart(b));
      for (let d=0; d<b.window; d++) {
        const idx = Math.floor((begin + d*DAY - startMs)/(7*DAY));
        if (idx >= 0 && idx < project.horizon) sums[idx] += perDay;
        else outside += perDay;
      }
    }
    const weeks = sums.map((amount, i) => ({
      from:iso(startMs+i*7*DAY), to:iso(startMs+(i*7+6)*DAY), amount,
      delta: amount-project.target
    }));
    const peak = Math.max(0, ...sums);
    const overload = sums.reduce((s,x)=>s+Math.max(0,x-project.target),0);
    const deficit = sums.reduce((s,x)=>s+Math.max(0,project.target-x),0);
    const empty = sums.filter(x=>x<0.0000001).length;
    const collisions = detectCollisions(bs);
    return { from, weeks, peak, overload, deficit, empty, outside,
      collisions, total:sums.reduce((a,b)=>a+b,0),
      score: overload*3 + deficit + outside*3 + collisions.length*10000 };
  }
  function series(config, beds, prefix='plan') {
    assert(Array.isArray(beds) && beds.length >= 1, '区画がありません');
    const crop = name(config.crop, 48, '作物名');
    dateMs(config.first);
    const count = integer(config.count, 1, 24, '回数');
    const spacing = integer(config.spacing, 1, 120, '間隔');
    const maturity = integer(config.maturity, 1, 365, '収穫開始までの日数');
    const window = integer(config.window, 1, 90, '収穫期間');
    const yieldAmount = integer(config.yield, 0, 10000, '収穫見込み量');
    const reset = integer(config.reset, 0, 90, '片付け日数');
    const offset = integer(config.bedOffset ?? 0, 0, beds.length-1, '開始区画');
    return Array.from({length:count}, (_,i) => ({
      id:prefix+'-'+(i+1), crop, bed:beds[(offset+i)%beds.length],
      sow:addDays(config.first, spacing*i), maturity, window, yield:yieldAmount, reset
    }));
  }
  function compare(p, config, intervals=[7,10,14,21,28]) {
    const project = normalizeProject(p);
    const uniq = [...new Set(intervals.map(x=>integer(x,1,120,'間隔')))];
    assert(uniq.length > 0 && uniq.length <= 15, '候補は1〜15種類です');
    const candidates = uniq.map(spacing => {
      const generated = series({...config,spacing}, project.beds, 'preview'+spacing);
      const merged = normalizeProject({...project,batches:project.batches.concat(generated)});
      const result = analyze(merged);
      return { spacing, generated, ...result };
    });
    // Direct, explicit schedule constraints matter more than peak optimization.
    candidates.sort((a,b)=> a.score-b.score || a.collisions.length-b.collisions.length || a.spacing-b.spacing);
    return candidates;
  }
  function csv(rows) {
    const escape = value => {
      const raw = String(value ?? '');
      const safe = /^[=+@\t\r]/.test(raw) || (/^-/.test(raw) && !/^-\d+(?:\.\d+)?$/.test(raw)) ? '\''+raw : raw;
      return '"'+safe.replace(/"/g,'""')+'"';
    };
    return '\uFEFF'+rows.map(row=>row.map(escape).join(',')).join('\r\n')+'\r\n';
  }
  function batchesCsv(p) {
    const project = normalizeProject(p);
    return csv([['作物','区画','種まき','収穫開始','収穫終了','収穫見込み(食分)','片付け日数','作付けID'],
      ...project.batches.map(b=>[b.crop,b.bed,b.sow,harvestStart(b),harvestEnd(b),b.yield,b.reset,b.id])]);
  }
  function weeksCsv(p) {
    const project = normalizeProject(p);
    const m = analyze(project);
    return csv([['週開始','週終了','収穫見込み(食分)','週間目標(食分)','差(食分)'],
      ...m.weeks.map(w=>[w.from,w.to,w.amount.toFixed(2),project.target,w.delta.toFixed(2)])]);
  }
  return {dateMs,iso,addDays,daysBetween,monday,normalizeProject,harvestStart,harvestEnd,occupiedEnd,
    detectCollisions,analyze,series,compare,csv,batchesCsv,weeksCsv};
});
