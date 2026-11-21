/* 復習つづり / FUKUSHU TSUZURI: pure domain logic, no network or dependencies */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FukushuEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX = 300;
  const today = () => new Date().toISOString().slice(0, 10);
  function integer(v, low, high, fallback) {
    const n = Number(v);
    return Number.isInteger(n) && n >= low && n <= high ? n : fallback;
  }
  function safeString(v, max = 360) { return String(v ?? '').trim().slice(0, max); }
  function makeId() { return 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
  function dateValid(s) {
    if (!/^\d{4}-\d\d-\d\d$/.test(s || '')) return false;
    const d = new Date(s + 'T00:00:00Z');
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s;
  }
  function parseQuestion(q, fallbackId) {
    if (!q || typeof q !== 'object') throw Error('問題データの形式が正しくありません');
    const id = safeString(q.id || fallbackId || makeId(), 64);
    const topic = safeString(q.topic, 40);
    const prompt = safeString(q.prompt, 360);
    const answer = safeString(q.answer, 360);
    if (!topic || !prompt || !answer) throw Error('単元・問題・解答は必須です');
    const seconds = integer(q.seconds, 15, 1200, 90);
    const difficulty = integer(q.difficulty, 1, 3, 2);
    const attempts = integer(q.attempts, 0, 99999, 0);
    const correct = integer(q.correct, 0, attempts, 0);
    const lastUsed = q.lastUsed && dateValid(q.lastUsed) ? q.lastUsed : '';
    return {id, topic, prompt, answer, seconds, difficulty, attempts, correct, lastUsed};
  }
  function validateBank(input) {
    if (!Array.isArray(input) || input.length > MAX) throw Error('問題は最大300件までです');
    const ids = new Set();
    return input.map((q, i) => {
      const x = parseQuestion(q, 'import-' + i);
      if (ids.has(x.id)) throw Error('重複する問題IDがあります');
      ids.add(x.id);
      return x;
    });
  }
  function dayDiff(day, base) {
    if (!dateValid(day) || !dateValid(base)) return null;
    return Math.floor((Date.parse(base + 'T00:00:00Z') - Date.parse(day + 'T00:00:00Z')) / 86400000);
  }
  function interval(q) {
    if (!q.attempts) return 0;
    const r = q.correct / q.attempts;
    return r < 0.5 ? 2 : r < 0.8 ? 5 : 10;
  }
  function priority(q, asOf) {
    const ago = dayDiff(q.lastUsed, asOf);
    const since = ago === null ? 999 : Math.max(0, ago);
    const weakness = q.attempts ? 1 - q.correct / q.attempts : 0.5;
    const due = since >= interval(q);
    const freshness = q.lastUsed ? (since < 2 ? -2.5 : 0) : 1.5;
    return {score: +(weakness * 4 + (due ? 3 : 0) + freshness + q.difficulty * 0.18).toFixed(4), due, since, weakness, interval: interval(q)};
  }
  function plan(bank, opts = {}) {
    const list = validateBank(bank);
    const asOf = dateValid(opts.asOf) ? opts.asOf : today();
    const count = integer(opts.count, 1, 30, 8);
    const maxMinutes = integer(opts.minutes, 1, 120, 12);
    const budget = maxMinutes * 60;
    const topics = Array.isArray(opts.topics) ? new Set(opts.topics.map(x => safeString(x, 40))) : null;
    const eligible = list.filter(q => !topics || topics.has(q.topic));
    const selected = [], used = new Set(), coverage = new Set();
    let total = 0;
    // Greedy weighted set cover: reward the first question from each topic.
    while (selected.length < count) {
      let best = null, bestScore = -Infinity;
      for (const q of eligible) {
        if (used.has(q.id) || total + q.seconds > budget) continue;
        const p = priority(q, asOf);
        const diversity = coverage.has(q.topic) ? 0 : 2.2;
        const candidate = p.score + diversity;
        if (candidate > bestScore || (candidate === bestScore && best && q.id.localeCompare(best.id) < 0)) {
          best = q; bestScore = candidate;
        }
      }
      if (!best) break;
      selected.push(best); used.add(best.id); coverage.add(best.topic); total += best.seconds;
    }
    return {questions:selected.map(q => ({...q, ...priority(q, asOf)})), seconds:total,
      countRequested:count, minutes:maxMinutes, eligibleCount:eligible.length,
      warning:selected.length < count ? `希望${count}問に対して${selected.length}問です（時間上限・登録数・単元を確認）` : '',
      asOf, coveredTopics:[...coverage]};
  }
  function recordAggregate(bank, id, attempts, correct, day) {
    const list = validateBank(bank);
    const n = integer(attempts, 1, 9999, -1), c = integer(correct, 0, n, -1);
    if (n === -1 || c === -1 || !dateValid(day)) throw Error('受験数・正解数・日付を確認してください');
    let found = false;
    const changed = list.map(q => {
      if (q.id !== id) return q;
      found = true;
      if (q.attempts + n > 99999) throw Error('受験累計が上限を超えます');
      return {...q, attempts: q.attempts + n, correct: q.correct + c, lastUsed:day};
    });
    if (!found) throw Error('問題が見つかりません');
    return changed;
  }
  function csvCell(value) {
    let s = String(value ?? '');
    if (/^[\s]*[=+@\-]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function toCSV(rows) { return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'; }
  function sampleBank() {
    const data = [
      ['分数','1/4 + 1/2 を計算しなさい。','3/4',90,1,24,14,'2026-11-17'],
      ['分数','3/5 と 2/3 のうち大きいものは？','2/3',80,2,25,9,'2026-11-19'],
      ['分数','7/8 - 1/4 を求めなさい。','5/8',110,2,22,17,'2026-11-09'],
      ['理科','水が水蒸気に変わる状態変化の名称は？','気化',70,1,27,23,'2026-11-13'],
      ['理科','乾電池と豆電球を一本の導線だけでつないでも点灯しない理由は？','回路が閉じていないため',110,2,24,12,'2026-11-18'],
      ['理科','食塩水から食塩を取り出す方法を一つ挙げなさい。','水を蒸発させる',90,1,20,15,'2026-11-10'],
      ['国語','「静寂」の読みを書きなさい。','せいじゃく',60,1,26,19,'2026-11-08'],
      ['国語','「原因」の反対の意味を持つ語を書きなさい。','結果',65,1,18,13,'2026-11-15'],
      ['国語','「検討する」を別の言葉で説明しなさい。','よく調べて考えること',120,3,23,8,'2026-11-20'],
      ['国語','「彼は走った。しかし間に合わなかった。」の接続語の働きは？','逆接',90,2,20,11,'2026-11-04']
    ];
    return data.map((row, i) => ({id:'demo-'+(i+1), topic:row[0],prompt:row[1],answer:row[2],seconds:row[3],difficulty:row[4],attempts:row[5],correct:row[6],lastUsed:row[7]}));
  }
  return {MAX, today, dateValid, dayDiff, parseQuestion, validateBank, priority, plan, recordAggregate, csvCell, toCSV, sampleBank, makeId};
});
