/* AMIKAE core: deterministic, dependency-free pattern-gauge conversion. MIT. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AmiEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function finite(value, label, min, max) {
    const n = Number(value);
    if (value === '' || value === null || !Number.isFinite(n) || n < min || n > max) throw Error(label + 'は' + min + '〜' + max + 'の数値で入力してください');
    return n;
  }
  function nearestValid(raw, multiple, offset, parity) {
    let best = null;
    const anchor = Math.floor((raw - offset) / multiple);
    for (let k = Math.max(0, anchor - 5); k <= anchor + 6; k++) {
      const n = k * multiple + offset;
      if (n < 2 || (parity !== undefined && ((n % 2 + 2) % 2) !== parity)) continue;
      if (best === null || Math.abs(n - raw) < Math.abs(best - raw) - 1e-9 || (Math.abs(Math.abs(n - raw) - Math.abs(best - raw)) <= 1e-9 && n < best)) best = n;
    }
    if (best === null) throw Error('目数の制約を満たす候補がありません');
    return best;
  }
  function schedule(start, end, rows, step) {
    if (!Number.isInteger(start) || !Number.isInteger(end) || !Number.isInteger(rows) || !Number.isInteger(step) || start < 2 || end < 2 || rows < 1 || step < 1) throw Error('段割の入力が不正です');
    const delta = end - start;
    if (delta % 2 !== 0) throw Error('左右対称の増減目には偶数の差が必要です');
    const sideEvents = Math.abs(delta) / 2;
    const slots = Math.floor(rows / step);
    if (sideEvents && slots === 0) throw Error('増減目に使える段がありません');
    if (sideEvents > 3000 || rows > 1200) throw Error('計画の段数または増減数が上限を超えています');
    const changes = new Array(rows + 1).fill(0);
    // Bresenham-like cumulative allocation; every row ends with a consistent stitch count.
    let previous = 0;
    for (let s = 1; s <= slots; s++) {
      const cumulative = Math.round(s * sideEvents / slots);
      const count = cumulative - previous;
      if (count) changes[s * step] = Math.sign(delta) * 2 * count;
      previous = cumulative;
    }
    const events = [];
    const timeline = [];
    let stitches = start, peak = 0;
    for (let row = 1; row <= rows; row++) {
      stitches += changes[row];
      if (changes[row]) {
        events.push({ row, change: changes[row], after: stitches, eachSide: Math.abs(changes[row]) / 2 });
        peak = Math.max(peak, Math.abs(changes[row]) / 2);
      }
      timeline.push({ row, change: changes[row], after: stitches });
    }
    if (stitches !== end) throw Error('段割の整合性エラー');
    return { events, timeline, peak, slots, sideEvents };
  }
  function normalize(input) {
    const data = input || {};
    const out = {
      title: String(data.title || '無題の作品').trim().slice(0, 60) || '無題の作品',
      patternSt: finite(data.patternSt, '編み図の10cm目数', 1, 120),
      patternRows: finite(data.patternRows, '編み図の10cm段数', 1, 160),
      sourceStart: finite(data.sourceStart, '編み始めの目数', 2, 1500),
      sourceEnd: finite(data.sourceEnd, '編み終わりの目数', 2, 1500),
      sourceRows: finite(data.sourceRows, '編み図の段数', 1, 1200),
      ease: finite(data.ease, '幅調整', -20, 20),
      multiple: finite(data.multiple, '模様の倍数', 1, 24),
      offset: finite(data.offset, '模様の余り', 0, 23),
      step: finite(data.step, '増減目の段間隔', 1, 12),
      swatchASt: finite(data.swatchASt, '試し編みAの目数', 1, 120),
      swatchARows: finite(data.swatchARows, '試し編みAの段数', 1, 160),
      swatchBSt: finite(data.swatchBSt, '試し編みBの目数', 1, 120),
      swatchBRows: finite(data.swatchBRows, '試し編みBの段数', 1, 160)
    };
    for (const key of ['sourceStart','sourceEnd','sourceRows','multiple','offset','step']) if (!Number.isInteger(out[key])) throw Error('目数・段数・模様の指定には整数を入力してください');
    if (out.offset >= out.multiple) throw Error('模様の余りは倍数より小さくしてください');
    if (out.sourceStart / out.patternSt * 10 + out.ease <= 0 || out.sourceEnd / out.patternSt * 10 + out.ease <= 0) throw Error('幅調整後の寸法は正数にしてください');
    return out;
  }
  function scenario(d, st, rows, label) {
    const targetStartCm = 10 * d.sourceStart / d.patternSt + d.ease;
    const targetEndCm = 10 * d.sourceEnd / d.patternSt + d.ease;
    const idealStart = targetStartCm * st / 10;
    const idealEnd = targetEndCm * st / 10;
    // Constrain both ends to the pattern repeat and even stitch delta.
    const startCandidates = [];
    for (let k = 0; k <= 1500; k++) {
      const n = k * d.multiple + d.offset;
      if (n >= 2 && Math.abs(n - idealStart) < Math.max(30, d.multiple * 3)) startCandidates.push(n);
      if (n > idealStart + 40) break;
    }
    if (!startCandidates.length) startCandidates.push(nearestValid(idealStart, d.multiple, d.offset));
    let chosen = null;
    for (const start of startCandidates) {
      let end;
      try { end = nearestValid(idealEnd, d.multiple, d.offset, start % 2); } catch (_) { continue; }
      const cost = Math.abs(start - idealStart) + Math.abs(end - idealEnd);
      if (!chosen || cost < chosen.cost - 1e-8 || (Math.abs(cost - chosen.cost) < 1e-8 && start < chosen.start)) chosen = { start, end, cost };
    }
    if (!chosen) throw Error('左右対称と模様の制約を両立できません');
    const targetRows = Math.max(1, Math.round(d.sourceRows / d.patternRows * rows));
    const plan = schedule(chosen.start, chosen.end, targetRows, d.step);
    const actualStartCm = chosen.start * 10 / st;
    const actualEndCm = chosen.end * 10 / st;
    const targetLengthCm = 10 * d.sourceRows / d.patternRows;
    const actualLengthCm = 10 * targetRows / rows;
    const warnings = [];
    if (plan.peak > 1) warnings.push('1つの段で左右それぞれ' + plan.peak + '目以上を増減する箇所があります。編み方を再検討してください。');
    if (Math.abs(actualStartCm - targetStartCm) > 0.5 || Math.abs(actualEndCm - targetEndCm) > 0.5) warnings.push('模様の倍数を優先したため、目標幅から0.5cmを超える誤差があります。');
    if (d.ease !== 0) warnings.push('幅調整は開始・終了両端に同じcmを加算します。周長と平置き幅を取り違えないでください。');
    if (targetRows > 1200) throw Error('換算後の段数は1200段以内にしてください');
    return { label, stitchGauge: st, rowGauge: rows, start: chosen.start, end: chosen.end, targetRows, ...plan, targetStartCm, targetEndCm, actualStartCm, actualEndCm, targetLengthCm, actualLengthCm,
      widthError: Math.max(Math.abs(actualStartCm - targetStartCm), Math.abs(actualEndCm - targetEndCm)),
      lengthError: Math.abs(actualLengthCm - targetLengthCm), warnings,
      adjustment: chosen.start - d.sourceStart,
      score: (Math.abs(actualStartCm - targetStartCm) + Math.abs(actualEndCm - targetEndCm)) + plan.peak * 0.6 + (plan.peak > 1 ? 5 : 0)
    };
  }
  function calculate(data) {
    const d = normalize(data);
    const a = scenario(d, d.swatchASt, d.swatchARows, 'A');
    const b = scenario(d, d.swatchBSt, d.swatchBRows, 'B');
    return { input: d, A: a, B: b, recommendation: a.score <= b.score ? 'A' : 'B' };
  }
  const defaults = {
    title: '袖の増し目・ゲージ調整', patternSt: 20, patternRows: 28,
    sourceStart: 48, sourceEnd: 80, sourceRows: 84,
    ease: 0, multiple: 2, offset: 0, step: 2,
    swatchASt: 22, swatchARows: 32, swatchBSt: 21, swatchBRows: 30
  };
  return { finite, nearestValid, schedule, normalize, scenario, calculate, defaults };
});
