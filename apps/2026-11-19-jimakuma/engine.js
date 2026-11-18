/* 字幕の間 / JIMAKU-MA — subtitle quality engine (MIT) */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.JimakuEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const PRESETS = Object.freeze({
    casual: { name: 'SNS・社内動画（参考値）', cps: 8, width: 18, lines: 2, min: 700, max: 7000 },
    strict: { name: '日本語配信・厳格参考値', cps: 4, width: 13, lines: 2, min: 500, max: 7000 },
    custom: { name: 'カスタム', cps: 8, width: 18, lines: 2, min: 700, max: 7000 }
  });
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const round = n => Math.round(n * 10) / 10;
  function parseTime(input) {
    const s = String(input ?? '').trim();
    const m = s.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})([,.](\d{1,3}))?$/);
    if (!m) return null;
    const h = m[1] ? Number(m[1]) : 0, min = Number(m[2]), sec = Number(m[3]);
    if (min > 59 || sec > 59) return null;
    const ms = Number((m[5] || '0').padEnd(3, '0'));
    return ((h * 60 + min) * 60 + sec) * 1000 + ms;
  }
  function timecode(ms, decimal = '.') {
    if (!Number.isFinite(ms) || ms < 0) throw new Error('不正な時刻');
    const t = Math.round(ms);
    const h = Math.floor(t / 3600000), m = Math.floor(t / 60000) % 60, s = Math.floor(t / 1000) % 60;
    return [h, m, s].map(n => String(n).padStart(2, '0')).join(':') + decimal + String(t % 1000).padStart(3, '0');
  }
  function normalizeText(s) { return String(s ?? '').replace(/\r\n?/g, '\n').trim(); }
  function cleanText(s) { return normalizeText(s).replace(/<[^>]*>/g, '').replace(/\{\\[^}]*\}/g, ''); }
  function graphemes(s) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) return [...new Intl.Segmenter('ja', {granularity:'grapheme'}).segment(s)].map(x => x.segment);
    return Array.from(s);
  }
  function charWidth(c) {
    // Width as full-width equivalents: ASCII and halfwidth katakana count as 0.5.
    return /^[\x00-\x7f\uff61-\uff9f]$/.test(c) ? .5 : 1;
  }
  const weightedLength = s => round(graphemes(cleanText(s).replace(/\n/g, '')).reduce((v, c) => v + charWidth(c), 0));
  function lineWidths(s) { return cleanText(s).split('\n').map(x => round(graphemes(x).reduce((v, c) => v + charWidth(c), 0))); }
  function parseSubtitles(source) {
    const raw = String(source ?? '').replace(/^\ufeff/, '').replace(/\r\n?/g, '\n').trim();
    if (!raw) return [];
    const vtt = /^WEBVTT(?:\s|$)/.test(raw);
    const blocks = raw.replace(/^WEBVTT[^\n]*\n?/, '').split(/\n\s*\n/);
    const cues = [], errors = [];
    for (let k = 0; k < blocks.length; k++) {
      const lines = blocks[k].split('\n');
      if (!lines.some(x => x.trim())) continue;
      if (/^(NOTE|STYLE|REGION)(\s|$)/.test(lines[0])) continue;
      const lineIdx = lines.findIndex(l => /\s+-->\s+/.test(l));
      if (lineIdx < 0) { if (/^\d+\s*$/.test(lines[0])) errors.push(`ブロック ${k+1}: 時刻なし`); continue; }
      const time = lines[lineIdx].match(/^\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})(?:\s+.*)?$/);
      if (!time) { errors.push(`ブロック ${k+1}: 時刻形式が不正`); continue; }
      const start = parseTime(time[1]), end = parseTime(time[2]);
      if (start === null || end === null || end <= start) { errors.push(`ブロック ${k+1}: 開始・終了の順序が不正`); continue; }
      const text = normalizeText(lines.slice(lineIdx + 1).join('\n'));
      if (!text) { errors.push(`ブロック ${k+1}: 字幕テキストなし`); continue; }
      cues.push({ id: `c${k+1}`, start, end, text });
    }
    if (!cues.length) throw new Error(errors[0] || (vtt ? 'WEBVTTに字幕がありません' : 'SRT/VTTを読み取れませんでした'));
    return { cues, errors, type: vtt ? 'vtt' : 'srt' };
  }
  function analyze(cues, options) {
    const opt = {...PRESETS.casual, ...options};
    const order = [...cues].sort((a,b)=> a.start - b.start || a.end - b.end);
    const byId = new Map();
    for (let i = 0; i < order.length; i++) {
      const c = order[i], next = order[i+1], widths = lineWidths(c.text), len = weightedLength(c.text);
      const duration = c.end - c.start;
      const cps = duration > 0 ? round(len / (duration / 1000)) : Infinity;
      const issues = [];
      if (!cleanText(c.text)) issues.push('空欄');
      if (duration <= 0 || c.start < 0) issues.push('時刻が不正');
      if (duration > 0 && duration < opt.min) issues.push('表示時間が短い');
      if (duration > opt.max) issues.push('表示時間が長い');
      if (cps > opt.cps) issues.push('読む速度が速い');
      if (widths.length > opt.lines) issues.push('行数超過');
      if (widths.some(w => w > opt.width)) issues.push('行幅超過');
      if (next && c.end > next.start) issues.push('次と重複');
      byId.set(c.id, {cps, duration, len, widths, issues, gap: next ? next.start - c.end : null});
    }
    const problem = [...byId.values()].filter(x => x.issues.length).length;
    return {byId, total: cues.length, problem, clean: cues.length - problem, order};
  }
  function wrapJapanese(text, maxWidth) {
    const source = normalizeText(text).replace(/\n/g, '');
    if (!source || maxWidth <= 0) return source;
    const gs = graphemes(source); const lines = []; let i = 0;
    while (i < gs.length) {
      let width = 0, j = i, candidate = -1;
      while (j < gs.length && width + charWidth(gs[j]) <= maxWidth + 1e-8) {
        width += charWidth(gs[j]);
        if (/[、。！？!?・\s，,.]/.test(gs[j])) candidate = j+1;
        j++;
      }
      if (j === gs.length) { lines.push(gs.slice(i).join('')); break; }
      if (j === i) j++;
      // Soft break at punctuation if it is not too far from full width.
      const cut = candidate > i && candidate >= i + Math.max(1, Math.floor((j - i) * .65)) ? candidate : j;
      lines.push(gs.slice(i, cut).join('').trim()); i = cut;
    }
    return lines.join('\n');
  }
  function splitCue(c, options = PRESETS.casual) {
    const full = cleanText(c.text).replace(/\n/g, '');
    const gs = graphemes(full), n = gs.length;
    if (n < 2 || c.end - c.start < 2 * options.min) throw new Error('分割する文字数または表示時間が不足しています');
    const total = weightedLength(full), desired = total/2; let w = 0, split = 1, best = Infinity;
    for (let i=1; i<n; i++) {
      w += charWidth(gs[i-1]);
      const score = Math.abs(w - desired) - (/[、。！？!?\s]/.test(gs[i-1]) ? 1.5 : 0);
      if (score < best) { best = score; split = i; }
    }
    const left = gs.slice(0,split).join('').trim(), right = gs.slice(split).join('').trim();
    if (!left || !right) throw new Error('文字列を分割できません');
    const ratio = weightedLength(left)/Math.max(.1, weightedLength(left)+weightedLength(right));
    const mid = clamp(c.start+Math.round((c.end-c.start)*ratio), c.start+options.min, c.end-options.min);
    return [{...c, end:mid, text:wrapJapanese(left, options.width)}, {...c, id:c.id+'_b', start:mid, text:wrapJapanese(right, options.width)}];
  }
  function extendCue(cues, id, options) {
    const sorted = [...cues].sort((a,b)=>a.start-b.start || a.end-b.end);
    const ix = sorted.findIndex(c => c.id===id);
    if (ix<0) throw new Error('字幕が見つかりません');
    const cue=sorted[ix], next=sorted[ix+1];
    const needed = Math.ceil(weightedLength(cue.text) / options.cps * 1000);
    const target = Math.max(cue.end, cue.start + options.min, cue.start + needed);
    const limit = Math.min(cue.start + options.max, next ? next.start : Infinity);
    const end = Math.max(cue.end, Math.min(target,limit));
    return cues.map(c => c.id===id ? {...c,end} : {...c});
  }
  function formatSubtitles(cues, format='srt') {
    const arr = [...cues].sort((a,b)=>a.start-b.start || a.end-b.end);
    const blocks = arr.map((c,i)=>{
      if (!(Number.isFinite(c.start) && Number.isFinite(c.end) && c.start>=0 && c.end>c.start)) throw new Error(`${i+1}行目の時刻が不正です`);
      const stamp = `${timecode(c.start, format==='srt'?',':'.')} --> ${timecode(c.end,format==='srt'?',':'.')}`;
      return (format==='srt'?`${i+1}\n`:'')+stamp+'\n'+normalizeText(c.text);
    });
    return (format==='vtt'?'WEBVTT\n\n':'')+blocks.join('\n\n')+'\n';
  }
  function shiftAll(cues, deltaMs) {
    if (!Number.isFinite(deltaMs) || cues.some(c=>c.start+deltaMs<0)) throw new Error('開始時刻が負になります');
    return cues.map(c=>({...c,start:c.start+deltaMs,end:c.end+deltaMs}));
  }
  return {PRESETS,parseTime,timecode,weightedLength,lineWidths,cleanText,parseSubtitles,analyze,wrapJapanese,splitCue,extendCue,formatSubtitles,shiftAll};
});
