/* AMEDAME | pure, dependency-free rainwater mass-balance engine | MIT */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RainCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SAMPLE = Object.freeze([52, 62, 108, 128, 137, 155, 146, 159, 193, 171, 83, 51]); // synthetic, NOT official normals
  const MODES = Object.freeze([
    {id: 'even', label: '毎日分散'},
    {id: 'weekly', label: '月４回集中'},
    {id: 'burst', label: '月２回集中'}
  ]);
  const DEFAULTS = Object.freeze({
    year: 2026, area: 32, efficiency: 82, capacity: 200, startPercent: 50,
    demand: 18, summerFactor: 1.6, rain: [...SAMPLE], candidates: [100, 200, 400, 800], mode: 'weekly'
  });
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  function checkNumber(value, name, min, max) {
    const n = Number(value);
    if (value === '' || value == null || !Number.isFinite(n) || n < min || n > max) {
      throw new Error(name + 'は' + min + '～' + max + 'の数値にしてください。');
    }
    return n;
  }
  function validateConfig(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('設定が不正です。');
    const year = checkNumber(raw.year, '年', 2000, 2100);
    if (!Number.isInteger(year)) throw new Error('年は整数にしてください。');
    const area = checkNumber(raw.area, '集水面積', 0.1, 100000);
    const efficiency = checkNumber(raw.efficiency, '集水効率', 1, 100);
    const capacity = checkNumber(raw.capacity, 'タンク容量', 1, 10000000);
    const startPercent = checkNumber(raw.startPercent, '初期貯水率', 0, 100);
    const demand = checkNumber(raw.demand, '1日使用量', 0, 1000000);
    const summerFactor = checkNumber(raw.summerFactor, '夏季倍率', 0, 10);
    if (!Array.isArray(raw.rain) || raw.rain.length !== 12) throw new Error('月降水量は12か月分指定してください。');
    const rain = raw.rain.map((n, i) => checkNumber(n, (i + 1) + '月の雨量', 0, 10000));
    if (!Array.isArray(raw.candidates) || !raw.candidates.length || raw.candidates.length > 8) throw new Error('比較容量は1～8個にしてください。');
    const candidates = [...new Set(raw.candidates.map(x => checkNumber(x, '比較容量', 1, 10000000)))].sort((a, b) => a - b);
    const mode = MODES.find(x => x.id === raw.mode) ? raw.mode : 'weekly';
    return {year, area, efficiency, capacity, startPercent, demand, summerFactor, rain, candidates, mode};
  }
  function daysInMonth(year, month) { return new Date(Date.UTC(year, month + 1, 0)).getUTCDate(); }
  function isLeap(year) { return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0); }
  function isoDate(year, month, day) { return String(year) + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0'); }
  function buildSyntheticDays(year, monthlyRain, mode) {
    if (!MODES.some(x => x.id === mode)) throw new Error('配分モードが不正です。');
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('年が不正です。');
    if (!Array.isArray(monthlyRain) || monthlyRain.length !== 12) throw new Error('月降水量が不正です。');
    const days = [];
    monthlyRain.forEach((raw, month) => {
      const amount = checkNumber(raw, (month + 1) + '月の雨量', 0, 10000);
      const length = daysInMonth(year, month);
      let eventDates = [];
      if (mode === 'weekly') eventDates = [4, 11, 18, 25].filter(d => d <= length);
      if (mode === 'burst') eventDates = [5, 20].filter(d => d <= length);
      for (let day = 1; day <= length; day++) {
        const rainfall = mode === 'even' ? amount / length : (eventDates.includes(day) ? amount / eventDates.length : 0);
        days.push({date: isoDate(year, month, day), month: month + 1, rainMm: rainfall});
      }
    });
    return days;
  }
  function parseDailyCSV(content, year) {
    if (typeof content !== 'string' || content.length > 100000) throw new Error('CSVは100KB以内にしてください。');
    const rows = content.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter(x => x.trim());
    if (rows.length < 2 || rows.length > 367) throw new Error('CSVはヘッダーと1～366日の記録が必要です。');
    const header = rows.shift().trim().toLowerCase().replace(/\s+/g, '');
    if (header !== 'date,rain_mm') throw new Error('先頭行は date,rain_mm にしてください。');
    const result = []; const seen = new Set();
    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i].split(',');
      if (cells.length !== 2) throw new Error((i + 2) + '行目の列数が不正です。');
      const date = cells[0].trim();
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
      if (!match || Number(match[1]) !== year) throw new Error((i + 2) + '行目の年・日付が不正です。');
      const m = Number(match[2]), d = Number(match[3]);
      if (m < 1 || m > 12 || d < 1 || d > daysInMonth(year, m - 1)) throw new Error((i + 2) + '行目の日付が存在しません。');
      if (seen.has(date)) throw new Error('日付が重複しています: ' + date);
      seen.add(date);
      const rainMm = checkNumber(cells[1].trim(), (i + 2) + '行目の雨量', 0, 10000);
      result.push({date, month: m, rainMm});
    }
    result.sort((a, b) => a.date.localeCompare(b.date));
    // Require a full calendar year so daily-demand and scenario comparisons share a denominator.
    const count = isLeap(year) ? 366 : 365;
    if (result.length !== count || result[0].date !== isoDate(year, 0, 1) || result[count - 1].date !== isoDate(year, 11, 31)) {
      throw new Error('この年の1月1日～12月31日の日付を漏れなく入力してください（' + count + '日）。');
    }
    for (let i = 1; i < result.length; i++) {
      const previous = Date.parse(result[i - 1].date + 'T00:00:00Z');
      const current = Date.parse(result[i].date + 'T00:00:00Z');
      if (current - previous !== 86400000) throw new Error('日付が連続していません。');
    }
    return result;
  }
  function demandAt(month, cfg) { return cfg.demand * (month >= 6 && month <= 9 ? cfg.summerFactor : 1); }
  function simulate(days, cfg, overrideCapacity) {
    if (!Array.isArray(days) || !days.length) throw new Error('日単位の雨量データが空です。');
    const capacity = overrideCapacity == null ? cfg.capacity : checkNumber(overrideCapacity, 'タンク容量', 1, 10000000);
    let storage = capacity * cfg.startPercent / 100;
    let totalRain = 0, collected = 0, served = 0, need = 0, shortage = 0, overflow = 0, shortageDays = 0, overflowDays = 0;
    let longestShort = 0, currentShort = 0;
    const trace = [];
    days.forEach(day => {
      const input = day.rainMm * cfg.area * cfg.efficiency / 100;
      const demand = demandAt(day.month, cfg);
      totalRain += day.rainMm; collected += input; need += demand;
      const topped = storage + input;
      const spill = Math.max(0, topped - capacity);
      const supply = Math.min(demand, Math.min(capacity, topped));
      const deficit = demand - supply;
      storage = Math.max(0, Math.min(capacity, topped) - supply);
      served += supply; shortage += deficit; overflow += spill;
      if (deficit > 1e-9) { shortageDays++; currentShort++; longestShort = Math.max(longestShort, currentShort); }
      else currentShort = 0;
      if (spill > 1e-9) overflowDays++;
      trace.push({date: day.date, month: day.month, rainMm: day.rainMm, inflow: input, demand,
        supplied: supply, shortage: deficit, overflow: spill, storage});
    });
    return {capacity, days: trace.length, totalRain, collected, served, need, shortage, overflow, shortageDays,
      overflowDays, longestShort, endStorage: storage, coverage: need > 0 ? served / need * 100 : 100, trace};
  }
  function compare(cfg, customDays) {
    const results = [];
    const modes = customDays ? [{id: 'observed', label: '実測CSV'}] : MODES;
    modes.forEach(mode => {
      const days = customDays || buildSyntheticDays(cfg.year, cfg.rain, mode.id);
      cfg.candidates.forEach(capacity => results.push({mode: mode.id, label: mode.label, ...simulate(days, cfg, capacity)}));
    });
    const byCapacity = cfg.candidates.map(capacity => {
      const entries = results.filter(r => r.capacity === capacity);
      return {capacity,
        worst: Math.min(...entries.map(x => x.coverage)),
        best: Math.max(...entries.map(x => x.coverage)),
        maxShortageDays: Math.max(...entries.map(x => x.shortageDays)),
        minOverflow: Math.min(...entries.map(x => x.overflow)),
        scenarios: Object.fromEntries(entries.map(x => [x.mode, x]))};
    });
    return {results, byCapacity, modes};
  }
  function toCSV(rows) {
    const header = 'date,rain_mm,inflow_l,demand_l,supplied_l,shortage_l,overflow_l,storage_l';
    const num = x => Math.round(x * 1000) / 1000;
    return [header, ...rows.map(x => [x.date,num(x.rainMm),num(x.inflow),num(x.demand),num(x.supplied),num(x.shortage),num(x.overflow),num(x.storage)].join(','))].join('\r\n') + '\r\n';
  }
  function templateCSV(year) { return 'date,rain_mm\r\n' + buildSyntheticDays(year, Array(12).fill(0), 'even').map(x => x.date + ',0').join('\r\n') + '\r\n'; }
  return {SAMPLE, MODES, DEFAULTS, validateConfig, checkNumber, daysInMonth, isLeap, buildSyntheticDays,
    parseDailyCSV, demandAt, simulate, compare, toCSV, templateCSV};
});
