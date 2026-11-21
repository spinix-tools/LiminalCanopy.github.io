/* KAMAMICHI planning core — no network, no dependencies. MIT License. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KamaEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STEP = 5, DAY = 1440;
  function minutes(hhmm) {
    if (typeof hhmm !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)) throw Error('時刻は HH:MM 形式で入力してください');
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }
  function clock(t) { return t == null ? '—' : (Math.floor(t / 60)).toString().padStart(2, '0') + ':' + (t % 60).toString().padStart(2, '0'); }
  function integer(x, min, max, name, multiple = 1) {
    const n = Number(x);
    if (x === '' || x == null || !Number.isInteger(n) || n < min || n > max || n % multiple !== 0) throw Error(name + 'は' + min + '〜' + max + 'の' + multiple + '刻みで入力してください');
    return n;
  }
  function normalize(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('設定が不正です');
    const start = minutes(input.start);
    if (start % STEP) throw Error('開始時刻は5分単位にしてください');
    const oven = integer(input.oven, 1, 16, 'オーブン容量（枚）');
    if (!Array.isArray(input.jobs) || input.jobs.length === 0 || input.jobs.length > 30) throw Error('製品は1〜30件にしてください');
    const ids = new Set();
    const jobs = input.jobs.map((j, index) => {
      if (!j || typeof j !== 'object' || Array.isArray(j)) throw Error('製品データが不正です');
      const id = String(j.id || '');
      const name = String(j.name || '').trim();
      if (!id || id.length > 70 || ids.has(id)) throw Error('製品IDが重複または不正です');
      ids.add(id);
      if (!name || name.length > 55) throw Error('製品名は1〜55文字にしてください');
      const prep = integer(j.prep, 5, 240, name + 'の仕込み時間', STEP);
      const proof = integer(j.proof, 5, 600, name + 'の最低発酵時間', STEP);
      const proofMax = integer(j.proofMax, proof, 720, name + 'の発酵許容上限', STEP);
      const bake = integer(j.bake, 5, 240, name + 'の焼成時間', STEP);
      const cool = integer(j.cool, 0, 240, name + 'の冷却時間', STEP);
      const trays = integer(j.trays, 1, oven, name + 'の天板数');
      const due = minutes(j.due);
      if (due % STEP || due <= start) throw Error(name + 'の完成期限は開始後かつ5分単位にしてください');
      return { id, name, prep, proof, proofMax, bake, cool, trays, due, index };
    });
    return { start, oven, jobs };
  }
  function rankJobs(data, mode) {
    const jobs = data.jobs.map(j => ({ ...j }));
    if (mode === 'proof') jobs.sort((a, b) => (a.due - a.cool - a.bake - a.proofMax) - (b.due - b.cool - b.bake - b.proofMax) || a.index - b.index);
    else if (mode === 'manual') jobs.sort((a, b) => a.index - b.index);
    else jobs.sort((a, b) => a.due - b.due || a.index - b.index);
    let prepCursor = data.start;
    for (const j of jobs) {
      j.prepStart = prepCursor;
      j.prepEnd = prepCursor + j.prep;
      j.ready = j.prepEnd + j.proof;
      j.last = j.prepEnd + j.proofMax;
      prepCursor = j.prepEnd;
    }
    if (mode === 'proof') jobs.sort((a, b) => a.last - b.last || a.due - b.due || a.index - b.index);
    else if (mode !== 'manual') jobs.sort((a, b) => a.due - b.due || a.ready - b.ready || a.index - b.index);
    return jobs;
  }
  function occupy(used, from, duration, trays, capacity) {
    for (let t = from; t < from + duration; t += STEP) if ((used.get(t) || 0) + trays > capacity) return false;
    return true;
  }
  function one(data, mode) {
    const jobs = rankJobs(data, mode), used = new Map(), rows = [];
    for (const j of jobs) {
      let bakeStart = null;
      for (let t = Math.ceil(j.ready / STEP) * STEP; t + j.bake <= DAY; t += STEP) {
        if (occupy(used, t, j.bake, j.trays, data.oven)) { bakeStart = t; break; }
      }
      if (bakeStart !== null) for (let t = bakeStart; t < bakeStart + j.bake; t += STEP) used.set(t, (used.get(t) || 0) + j.trays);
      const bakeEnd = bakeStart === null ? null : bakeStart + j.bake;
      const finished = bakeEnd === null ? null : bakeEnd + j.cool;
      const overproof = bakeStart === null ? 0 : Math.max(0, bakeStart - j.last);
      const late = finished === null ? 0 : Math.max(0, finished - j.due);
      rows.push({ ...j, bakeStart, bakeEnd, finished, overproof, late, unscheduled: bakeStart === null, beyondDay: finished !== null && finished > DAY });
    }
    rows.sort((a, b) => a.index - b.index);
    const unscheduled = rows.filter(r => r.unscheduled).length;
    const lateCount = rows.filter(r => r.late > 0 || r.beyondDay).length;
    const overproofCount = rows.filter(r => r.overproof > 0).length;
    const lateMinutes = rows.reduce((s,r) => s + r.late, 0);
    const overproofMinutes = rows.reduce((s,r) => s + r.overproof, 0);
    const end = Math.max(data.start, ...rows.map(r => r.finished ?? r.prepEnd));
    const ovenMinutes = rows.reduce((s,r) => s + (r.unscheduled ? 0 : r.bake * r.trays), 0);
    const score = unscheduled * 1e10 + lateCount * 1e8 + overproofCount * 1e7 + lateMinutes * 1e4 + overproofMinutes * 1e3 + end;
    return { rows, used, metrics: { unscheduled, lateCount, overproofCount, lateMinutes, overproofMinutes, end, ovenMinutes, total: rows.length }, score, mode };
  }
  function plan(raw, mode = 'auto') {
    const data = normalize(raw);
    if (!['auto', 'due', 'proof', 'manual'].includes(mode)) throw Error('計画モードが不正です');
    if (mode !== 'auto') return { ...one(data, mode), config: data };
    const a = one(data, 'due'), b = one(data, 'proof');
    return { ...(a.score <= b.score ? a : b), config: data, compared: { due: a.metrics, proof: b.metrics } };
  }
  function csvCell(value) {
    let str = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(str)) str = "'" + str;
    return '"' + str.replace(/"/g, '""') + '"';
  }
  function csv(result) {
    const cols = ['製品','天板数','仕込み開始','仕込み終了','発酵可能開始','発酵期限','焼成開始','焼成終了','冷却終了','完成期限','期限超過分','発酵超過分','未割当'];
    const lines = result.rows.map(r => [r.name,r.trays,clock(r.prepStart),clock(r.prepEnd),clock(r.ready),clock(r.last),clock(r.bakeStart),clock(r.bakeEnd),clock(r.finished),clock(r.due),r.late,r.overproof,r.unscheduled ? 'はい':'いいえ'].map(csvCell).join(','));
    return '\ufeff' + [cols.map(csvCell).join(','), ...lines].join('\r\n') + '\r\n';
  }
  const demo = () => ({ start: '05:00', oven: 4, jobs: [
    {id:'b1',name:'クロワッサン',prep:35,proof:70,proofMax:120,bake:20,cool:25,trays:3,due:'08:20'},
    {id:'b2',name:'バゲット',prep:25,proof:60,proofMax:95,bake:30,cool:20,trays:2,due:'08:00'},
    {id:'b3',name:'塩パン',prep:25,proof:45,proofMax:80,bake:20,cool:15,trays:2,due:'07:45'},
    {id:'b4',name:'フォカッチャ',prep:25,proof:60,proofMax:90,bake:25,cool:20,trays:2,due:'08:30'},
    {id:'b5',name:'シナモンロール',prep:20,proof:45,proofMax:100,bake:20,cool:20,trays:2,due:'09:00'},
    {id:'b6',name:'ミニ食パン',prep:30,proof:65,proofMax:95,bake:35,cool:30,trays:3,due:'09:20'}
  ]});
  return { STEP, DAY, minutes, clock, normalize, occupy, plan, csv, demo };
});
