/* ROKO DANDORI: pure calculation engine. No network or external dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RokoEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ND = Object.freeze([1, 2, 4, 8, 16, 32, 64, 400, 1000]);
  const MAX_SHOTS = 16;
  const MAX_FRAMES = 48;
  function fail(message) { throw new Error(message); }
  function parseMeter(value) {
    const s = String(value ?? '').trim();
    if (!/^(?:\d+(?:\.\d+)?|\d+\s*\/\s*\d+)$/.test(s)) fail('測光値は 1/125 または 0.5 の形式で入力してください');
    const parts = s.split('/').map(Number);
    const n = parts.length === 2 ? parts[0] / parts[1] : parts[0];
    if (!Number.isFinite(n) || n < 1 / 8000 || n > 3600) fail('測光値は 1/8000〜3600秒で入力してください');
    return n;
  }
  function numeric(v, min, max, label) {
    if (v === '' || v === null || v === undefined || !Number.isFinite(Number(v))) fail(`${label}が正しくありません`);
    const n = Number(v);
    if (n < min || n > max) fail(`${label}は${min}〜${max}で指定してください`);
    return n;
  }
  function validateShot(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('撮影設定を読み取れません');
    const name = String(raw.name ?? '').trim();
    if (!name || name.length > 48) fail('撮影名は1〜48文字で指定してください');
    const meter = String(raw.meter ?? '').trim();
    parseMeter(meter);
    const nd1 = Number(raw.nd1), nd2 = Number(raw.nd2);
    if (!ND.includes(nd1) || !ND.includes(nd2)) fail('ND倍率は候補から選択してください');
    const exponent = numeric(raw.exponent, 1, 1.8, '補正指数');
    if (typeof raw.bracket !== 'boolean') fail('ブラケット設定が正しくありません');
    const note = String(raw.note ?? '').trim();
    if (note.length > 120) fail('メモは120文字以内で入力してください');
    return { name, meter, nd1, nd2, exponent, bracket: raw.bracket, note };
  }
  function validatePlan(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('計画データが正しくありません');
    if (!Array.isArray(raw.shots) || raw.shots.length < 1 || raw.shots.length > MAX_SHOTS) fail('撮影は1〜16シーンで指定してください');
    const start = String(raw.start ?? '');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) fail('開始時刻が正しくありません');
    const gap = numeric(raw.gap, 0, 600, '準備間隔');
    if (!Number.isInteger(gap)) fail('準備間隔は整数の秒で指定してください');
    const budget = numeric(raw.budget, 1, 720, '撮影可能時間');
    if (!Number.isInteger(budget)) fail('撮影可能時間は整数の分で指定してください');
    return { version: 1, start, gap, budget, shots: raw.shots.map(validateShot) };
  }
  function correctedExposure(meter, nd1, nd2, exponent, ev = 0) {
    const t = parseMeter(meter);
    if (!ND.includes(Number(nd1)) || !ND.includes(Number(nd2))) fail('ND倍率が無効です');
    const p = numeric(exponent, 1, 1.8, '補正指数');
    const b = numeric(ev, -2, 2, 'EV補正');
    const filtered = t * Number(nd1) * Number(nd2) * 2 ** b;
    const corrected = filtered <= 1 ? filtered : filtered ** p;
    if (!Number.isFinite(corrected) || corrected > 86400) fail('1コマが24時間を超えます。条件を見直してください');
    return { metered: t, ndFactor: Number(nd1) * Number(nd2), ev: b, filtered, corrected, added: corrected - filtered };
  }
  function schedule(source) {
    const plan = validatePlan(source);
    const frames = [];
    let position = 0;
    for (let i = 0; i < plan.shots.length; i++) {
      const shot = plan.shots[i];
      for (const ev of shot.bracket ? [-1, 0, 1] : [0]) {
        if (frames.length) position += plan.gap;
        const times = correctedExposure(shot.meter, shot.nd1, shot.nd2, shot.exponent, ev);
        const startSec = position;
        position += times.corrected;
        if (position > 172800) fail('撮影が48時間を超えます。計画を分割してください');
        frames.push({ index: frames.length, shotIndex: i, scene: shot.name, ev, startSec, endSec: position, ...times });
      }
    }
    if (frames.length > MAX_FRAMES) fail('コマ数が多すぎます');
    const exposureTotal = frames.reduce((s, f) => s + f.corrected, 0);
    const pairs = frames.length - 1;
    return {
      plan,
      frames,
      exposureTotal,
      gapTotal: pairs * plan.gap,
      total: position,
      remaining: plan.budget * 60 - position,
      fits: position <= plan.budget * 60,
      endClock: clockAt(plan.start, position),
      endAt: position,
    };
  }
  function formatSeconds(sec) {
    if (!Number.isFinite(sec) || sec < 0) fail('秒数が正しくありません');
    if (sec < 1) return `${sec.toFixed(3)}秒`;
    if (sec < 60) return `${sec.toFixed(sec < 10 ? 2 : 1).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')}秒`;
    const n = Math.round(sec);
    const h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), s = n % 60;
    return h ? `${h}時間${String(m).padStart(2, '0')}分${String(s).padStart(2, '0')}秒` : `${m}分${String(s).padStart(2, '0')}秒`;
  }
  function clockAt(start, offsetSec) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !Number.isFinite(offsetSec) || offsetSec < 0) fail('時刻計算の入力が不正です');
    const [h, m] = start.split(':').map(Number);
    const total = h * 3600 + m * 60 + Math.round(offsetSec);
    const day = Math.floor(total / 86400);
    const daySec = total % 86400;
    return `${String(Math.floor(daySec / 3600)).padStart(2, '0')}:${String(Math.floor((daySec % 3600) / 60)).padStart(2, '0')}:${String(daySec % 60).padStart(2, '0')}${day ? ` (+${day}日)` : ''}`;
  }
  function safeCell(value) {
    let s = String(value ?? '');
    if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  }
  function csv(source) {
    const out = schedule(source);
    const columns = ['コマ番号', '場面', '補正EV', '測光秒', 'ND合計倍率', 'フィルタ後秒', '補正指数', '露光秒', '補正追加秒', '開始', '終了', 'メモ'];
    const rows = out.frames.map(f => {
      const shot = out.plan.shots[f.shotIndex];
      return [f.index + 1, f.scene, f.ev, f.metered, f.ndFactor, f.filtered, shot.exponent, f.corrected, f.added, clockAt(out.plan.start, f.startSec), clockAt(out.plan.start, f.endSec), shot.note];
    });
    return [columns, ...rows].map(r => r.map(safeCell).join(',')).join('\r\n') + '\r\n';
  }
  function example() {
    return {
      version: 1, start: '17:10', gap: 25, budget: 25,
      shots: [
        { name: '海辺 / うねる波', meter: '1/125', nd1: 1000, nd2: 1, exponent: 1.30, bracket: true, note: '三脚・レリーズ準備' },
        { name: '街角 / 光の軌跡', meter: '1/60', nd1: 64, nd2: 1, exponent: 1.30, bracket: false, note: '先に構図を固定' },
        { name: '港 / 最後の1枚', meter: '1/250', nd1: 1000, nd2: 4, exponent: 1.25, bracket: true, note: '光量変化時は再測光' },
      ],
    };
  }
  return Object.freeze({ ND, MAX_SHOTS, parseMeter, validateShot, validatePlan, correctedExposure, schedule, formatSeconds, clockAt, csv, example });
});
