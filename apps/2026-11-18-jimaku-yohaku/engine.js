/* 字幕余白 / JIMAKU YOHA — pure subtitle QA engine (MIT). No dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JimakuEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const BREAK_AFTER = '。！？!?、，,.：:；;';
  const BAD_START = '、。，．！？!?)]）】」』〉》ぁぃぅぇぉっゃゅょー';
  const BAD_END = '([（【「『〈《';
  const PRESETS = Object.freeze({
    shorts: { label: 'YouTube Shorts（目安）', top: 15, bottom: 25, left: 9, right: 15 },
    reels: { label: 'Instagram Reels（目安）', top: 13, bottom: 24, left: 10, right: 14 },
    tiktok: { label: 'TikTok（目安）', top: 15, bottom: 30, left: 10, right: 16 },
    common: { label: '縦型共通（保守的な目安）', top: 16, bottom: 31, left: 12, right: 17 },
    landscape: { label: '横型 16:9（目安）', top: 7, bottom: 14, left: 7, right: 7 }
  });
  const DEFAULT_SETTINGS = { cps: 10, maxChars: 16, maxLines: 2, minDuration: 800, maxDuration: 6500, minGap: 100, platform: 'common', position: 46 };
  const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('ja', { granularity: 'grapheme' }) : null;
  const chars = value => segmenter ? Array.from(segmenter.segment(String(value)), x => x.segment) : Array.from(String(value));
  function visibleChars(value) { return chars(String(value).replace(/\s/gu, '')).length; }
  function stamp(ms, separator = ',') {
    if (!Number.isFinite(ms) || ms < 0) throw new Error('時間は0以上のミリ秒で指定してください');
    const n = Math.round(ms);
    const hh = Math.floor(n / 3600000);
    const mm = Math.floor((n % 3600000) / 60000);
    const ss = Math.floor((n % 60000) / 1000);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}${separator}${String(n % 1000).padStart(3, '0')}`;
  }
  function parseStamp(value) {
    const s = String(value).trim().replace(',', '.');
    const m = s.match(/^(?:(\d{1,3}):)?([0-5]?\d):([0-5]\d)\.(\d{1,3})$/);
    if (!m) throw new Error(`時間表記を解釈できません: ${value}`);
    return ((Number(m[1] || 0) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + Number(m[4].padEnd(3, '0'));
  }
  const timing = /^\s*((?:\d{1,3}:)?[0-5]?\d:[0-5]\d[,.]\d{1,3})\s*-->\s*((?:\d{1,3}:)?[0-5]?\d:[0-5]\d[,.]\d{1,3})(?:\s+.*)?$/;
  function parseSubtitles(text) {
    const src = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
    if (!src) throw new Error('字幕データが空です');
    const isVtt = /^WEBVTT(?:\s|$)/.test(src);
    const blocks = (isVtt ? src.replace(/^WEBVTT[^\n]*(?:\n|$)/, '') : src).split(/\n\s*\n/);
    const cues = []; let invalid = 0;
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (!lines.length || /^(NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0])) continue;
      const timeIndex = lines.findIndex(x => timing.test(x));
      if (timeIndex < 0 || timeIndex > 1) { invalid++; continue; }
      const m = lines[timeIndex].match(timing);
      const start = parseStamp(m[1]), end = parseStamp(m[2]);
      const txt = lines.slice(timeIndex + 1).join('\n').trim();
      cues.push({ id: cues.length + 1, start, end, text: txt });
    }
    if (!cues.length) throw new Error('SRT / VTT の時間行が見つかりませんでした');
    return { cues, format: isVtt ? 'vtt' : 'srt', skipped: invalid };
  }
  function normalizeCues(cues) {
    if (!Array.isArray(cues) || cues.length > 5000) throw new Error('字幕は最大5000件までです');
    return cues.map((c, i) => {
      const start = Number(c.start), end = Number(c.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < 0 || start > 360000000 || end > 360000000) throw new Error(`${i + 1}行目の時間が無効です`);
      return { id: i + 1, start: Math.round(start), end: Math.round(end), text: String(c.text ?? '').slice(0, 4000) };
    });
  }
  function serializeSrt(cues) { return normalizeCues(cues).map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text.replace(/\r/g, '')}`).join('\n\n') + '\n'; }
  function serializeVtt(cues) { return 'WEBVTT\n\n' + normalizeCues(cues).map(c => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text.replace(/\r/g, '')}`).join('\n\n') + '\n'; }
  function cueMetrics(cue, settings = DEFAULT_SETTINGS) {
    const text = String(cue.text || ''), lines = text.split('\n');
    const length = visibleChars(text), duration = Number(cue.end) - Number(cue.start);
    const cps = duration > 0 ? Math.round(length * 10000 / duration) / 10 : Infinity;
    return { length, duration, cps, lineCount: lines.length, maxLine: Math.max(...lines.map(visibleChars)), isEmpty: !text.trim() };
  }
  function assess(cues, settings = DEFAULT_SETTINGS) {
    const opts = { ...DEFAULT_SETTINGS, ...settings };
    const normalized = normalizeCues(cues);
    const rows = normalized.map((cue, i) => {
      const m = cueMetrics(cue, opts), issues = [];
      if (cue.end <= cue.start) issues.push({ key: 'time', severity: 'error', message: '終了時刻が開始以前' });
      if (m.isEmpty) issues.push({ key: 'empty', severity: 'error', message: 'テキストが空' });
      if (m.cps > Number(opts.cps)) issues.push({ key: 'speed', severity: 'warning', message: `読速 ${Number.isFinite(m.cps) ? m.cps : '∞'}字/秒（上限 ${opts.cps}）` });
      if (m.maxLine > Number(opts.maxChars)) issues.push({ key: 'line', severity: 'warning', message: `1行 ${m.maxLine}字（上限 ${opts.maxChars}）` });
      if (m.lineCount > Number(opts.maxLines)) issues.push({ key: 'lines', severity: 'warning', message: `${m.lineCount}行（上限 ${opts.maxLines}）` });
      if (m.duration < Number(opts.minDuration)) issues.push({ key: 'short', severity: 'warning', message: '表示が短すぎます' });
      if (m.duration > Number(opts.maxDuration)) issues.push({ key: 'long', severity: 'warning', message: '表示が長すぎます' });
      if (i > 0) {
        const previous = normalized[i - 1];
        if (cue.start < previous.start) issues.push({ key: 'order', severity: 'error', message: '字幕の時間順が逆転' });
        const gap = cue.start - previous.end;
        if (gap < 0) issues.push({ key: 'overlap', severity: 'error', message: `直前と ${Math.abs(gap)}ms 重複` });
        else if (gap < opts.minGap) issues.push({ key: 'gap', severity: 'warning', message: `前行との間隔 ${gap}ms` });
      }
      return { cue, ...m, issues };
    });
    const errors = rows.reduce((n, r) => n + r.issues.filter(x => x.severity === 'error').length, 0);
    const warnings = rows.reduce((n, r) => n + r.issues.filter(x => x.severity === 'warning').length, 0);
    return { rows, errors, warnings, flagged: rows.filter(r => r.issues.length).length, total: rows.length, duration: Math.max(0, ...normalized.map(c => c.end)) };
  }
  function linePenalty(arr, start, end, target) {
    const len = end - start;
    if (len === 0) return Infinity;
    const next = arr[end] || '', last = arr[end - 1] || '';
    return Math.pow(len - target, 2) * .65
      + (BAD_START.includes(next) ? 260 : 0) + (BAD_END.includes(last) ? 260 : 0)
      + (/^[a-zA-Z0-9]$/.test(last) && /^[a-zA-Z0-9]$/.test(next) ? 110 : 0)
      - (BREAK_AFTER.includes(last) ? 18 : 0) - (/\s/.test(next) ? 8 : 0);
  }
  function reflow(text, maxChars = 16, maxLines = 2) {
    const source = String(text).replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const units = chars(source);
    const limit = Math.max(2, Math.min(80, Math.floor(Number(maxChars) || 16)));
    const linesLimit = Math.max(1, Math.min(4, Math.floor(Number(maxLines) || 2)));
    if (units.length <= limit) return source;
    if (units.length > limit * linesLimit || units.length > 320) return source; // no misleading auto-fix
    const n = units.length, target = n / Math.ceil(n / limit), memo = new Map();
    function search(pos, linesLeft) {
      if (pos === n) return { cost: 0, parts: [] };
      if (!linesLeft || n - pos > linesLeft * limit) return null;
      const key = `${pos}:${linesLeft}`;
      if (memo.has(key)) return memo.get(key);
      let best = null;
      for (let end = pos + 1; end <= Math.min(n, pos + limit); end++) {
        if (n - end > (linesLeft - 1) * limit) continue;
        const tail = search(end, linesLeft - 1);
        if (!tail) continue;
        const cost = linePenalty(units, pos, end, target) + tail.cost;
        if (!best || cost < best.cost) best = { cost, parts: [units.slice(pos, end).join('').trim(), ...tail.parts] };
      }
      memo.set(key, best); return best;
    }
    return search(0, linesLimit)?.parts.filter(Boolean).join('\n') || source;
  }
  function reflowAll(cues, settings = DEFAULT_SETTINGS) { return normalizeCues(cues).map(c => ({ ...c, text: reflow(c.text, settings.maxChars, settings.maxLines) })); }
  function shiftAll(cues, wantedMs) {
    const input = normalizeCues(cues), wanted = Math.round(Number(wantedMs));
    if (!Number.isFinite(wanted)) throw new Error('移動量は数字で入力してください');
    const minStart = input.length ? Math.min(...input.map(c => c.start)) : 0;
    const applied = Math.max(wanted, -minStart);
    return { cues: input.map(c => ({ ...c, start: c.start + applied, end: c.end + applied })), applied };
  }
  function trimOverlaps(cues, minGap = 100) {
    const output = normalizeCues(cues), gap = Math.max(0, Math.round(Number(minGap) || 0)); let fixed = 0;
    for (let i = 0; i < output.length - 1; i++) {
      const allowed = output[i + 1].start - gap;
      if (output[i].end > allowed && allowed > output[i].start) { output[i].end = allowed; fixed++; }
    }
    return { cues: output, fixed };
  }
  function positionRisk(platform, position, heightPct = 9) {
    const p = PRESETS[platform] || PRESETS.common;
    const y = Number(position);
    return y - heightPct / 2 < p.top || y + heightPct / 2 > 100 - p.bottom;
  }
  function toCsvReport(report) {
    const q = x => '"' + String(x ?? '').replace(/"/g, '""') + '"';
    return '\uFEFF' + ['番号,開始,終了,字幕テキスト,表示秒数,文字数,字毎秒,最大行字数,行数,警告'].concat(report.rows.map((r, i) => [i + 1, stamp(r.cue.start), stamp(r.cue.end), r.cue.text, (r.duration / 1000).toFixed(2), r.length, Number.isFinite(r.cps) ? r.cps : '∞', r.maxLine, r.lineCount, r.issues.map(x => x.message).join(' / ')].map(q).join(','))).join('\r\n');
  }
  return { PRESETS, DEFAULT_SETTINGS, chars, visibleChars, stamp, parseStamp, parseSubtitles, normalizeCues, serializeSrt, serializeVtt, cueMetrics, assess, reflow, reflowAll, shiftAll, trimOverlaps, positionRisk, toCsvReport };
});
