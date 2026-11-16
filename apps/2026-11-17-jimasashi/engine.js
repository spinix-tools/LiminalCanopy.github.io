/* 字幕ものさし / JIMASASHI — dependency-free subtitle QA engine */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.JimasashiCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_CUES = 10000;
  const presets = Object.freeze({
    web: { label: '一般動画（編集用の初期値）', maxWidth: 18, cps: 7, minDuration: 0.8, maxLines: 2 },
    film: { label: '日本語配信作品（Netflix一般要件の参考値）', maxWidth: 13, cps: 4, minDuration: 0.8, maxLines: 2 }
  });
  function graphemes(text) {
    const str = String(text ?? '');
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      return Array.from(new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(str), x => x.segment);
    }
    return Array.from(str);
  }
  function charWidth(char) {
    if (/^[\u0000-\u007f\uff61-\uff9f]$/.test(char)) return 0.5;
    if (/^[\u0300-\u036f\ufe00-\ufe0f]$/.test(char)) return 0;
    return 1;
  }
  function width(text) { return graphemes(String(text ?? '')).reduce((n, x) => n + charWidth(x), 0); }
  function parseTime(input) {
    const x = String(input ?? '').trim();
    const m = x.match(/^(?:(\d{1,}):)?(\d{1,2}):(\d{2})[,.](\d{3})$/);
    if (!m) throw Error('時刻の形式が正しくありません: ' + x + '（HH:MM:SS,mmm）');
    const h = Number(m[1] || 0), mm = Number(m[2]), ss = Number(m[3]), ms = Number(m[4]);
    if (mm >= 60 || ss >= 60) throw Error('時刻の分・秒は59以下にしてください: ' + x);
    return ((h * 60 + mm) * 60 + ss) * 1000 + ms;
  }
  function formatTime(milliseconds, vtt = false) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) throw Error('時刻は0以上の数値で指定してください');
    const t = Math.round(milliseconds);
    const hh = String(Math.floor(t / 3600000)).padStart(2, '0');
    const mm = String(Math.floor(t / 60000) % 60).padStart(2, '0');
    const ss = String(Math.floor(t / 1000) % 60).padStart(2, '0');
    const ms = String(t % 1000).padStart(3, '0');
    return `${hh}:${mm}:${ss}${vtt ? '.' : ','}${ms}`;
  }
  function validateCue(cue) {
    return cue && Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.start >= 0 && cue.end > cue.start && typeof cue.text === 'string';
  }
  function cleanText(text) { return String(text).replace(/\r\n?/g, '\n').trim(); }
  function parse(text) {
    let source = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
    if (!source) throw Error('字幕ファイルが空です');
    const isVtt = /^WEBVTT(?:\s|$)/.test(source);
    if (isVtt) source = source.replace(/^WEBVTT[^\n]*\n?/, '').trim();
    const blocks = source.split(/\n\s*\n/).filter(Boolean);
    const cues = [];
    let skippedMeta = 0;
    for (let i = 0; i < blocks.length; i++) {
      const lines = blocks[i].split('\n');
      if (isVtt && /^(?:NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0])) { skippedMeta++; continue; }
      let t = lines.findIndex(x => x.includes('-->'));
      if (t < 0) throw Error(`ブロック${i + 1}に時刻行がありません。内容を確認してください`);
      if (t > 1) throw Error(`ブロック${i + 1}の識別子形式に対応していません`);
      const match = lines[t].match(/^\s*(\d+(?::\d{1,2})?:\d{2}[,.]\d{3})\s*-->\s*(\d+(?::\d{1,2})?:\d{2}[,.]\d{3})(?:\s+.*)?$/);
      if (!match) throw Error(`ブロック${i + 1}の時刻行が不正です`);
      const cue = { id: 'c' + (i + 1), start: parseTime(match[1]), end: parseTime(match[2]), text: cleanText(lines.slice(t + 1).join('\n')) };
      if (!validateCue(cue)) throw Error(`ブロック${i + 1}の終了時刻は開始より後にしてください`);
      cues.push(cue);
      if (cues.length > MAX_CUES) throw Error('字幕は最大10,000件まで読み込めます');
    }
    if (!cues.length) throw Error('有効な字幕行がありません');
    return { cues, kind: isVtt ? 'vtt' : 'srt', skippedMeta };
  }
  function serialize(cues, kind = 'srt') {
    if (!Array.isArray(cues) || !cues.every(validateCue)) throw Error('時刻が不正な字幕があるため出力できません');
    const vtt = kind === 'vtt';
    const out = cues.map((c, i) => `${vtt ? '' : (i + 1) + '\n'}${formatTime(c.start, vtt)} --> ${formatTime(c.end, vtt)}\n${cleanText(c.text)}`).join('\n\n');
    return (vtt ? 'WEBVTT\n\n' : '') + out + '\n';
  }
  const noBefore = /^[、。，．！？!?）」』】〉》,.;:]/;
  const noAfter = /[（「『【〈《(\[]$/;
  function joinExistingLines(text) {
    return cleanText(text).split('\n').map(x => x.trim()).reduce((acc, x) => {
      if (!acc) return x;
      if (!x) return acc;
      // Separate ASCII words which were separated by a pre-existing subtitle line break.
      return acc + (/[a-zA-Z0-9]$/.test(acc) && /^[a-zA-Z0-9]/.test(x) ? ' ' : '') + x;
    }, '');
  }
  function autoBreak(text, maxWidth = 18) {
    const source = joinExistingLines(text);
    if (!source || width(source) <= maxWidth) return source;
    const g = graphemes(source);
    if (g.length < 2) return source;
    let best = null;
    for (let i = 1; i < g.length; i++) {
      const a = g.slice(0, i).join(''), b = g.slice(i).join('');
      const wa = width(a), wb = width(b);
      const overflow = Math.max(0, wa - maxWidth) + Math.max(0, wb - maxWidth);
      let score = overflow * 1000 + Math.abs(wa - wb) * 1.7;
      if (/[、。！？!?，,。]$/.test(a)) score -= 6;
      if (/[・／/]$/.test(a)) score += 3;
      if (noBefore.test(b) || noAfter.test(a)) score += 150;
      if (/[a-zA-Z0-9]$/.test(a) && /^[a-zA-Z0-9]/.test(b)) score += 150;
      if (/^[ぁぃぅぇぉっゃゅょァィゥェォッャュョ]/.test(b)) score += 70;
      if (!best || score < best.score) best = { score, value: a + '\n' + b };
    }
    return best.value;
  }
  function audit(cues, cfg = presets.web) {
    const sorted = [...cues].sort((a, b) => a.start - b.start || a.end - b.end);
    const warnings = new Map();
    for (const cue of cues) {
      const reasons = [];
      if (!validateCue(cue)) { reasons.push('時刻が不正'); warnings.set(cue.id, reasons); continue; }
      const duration = (cue.end - cue.start) / 1000;
      const lines = cleanText(cue.text).split('\n');
      const readingWidth = lines.reduce((acc, line) => acc + width(line.replace(/\s/g, '')), 0);
      const cps = Math.round((readingWidth / duration) * 10) / 10;
      if (!cleanText(cue.text)) reasons.push('空の字幕');
      if (lines.length > cfg.maxLines) reasons.push(`${lines.length}行（上限${cfg.maxLines}行）`);
      const longest = Math.max(...lines.map(width), 0);
      if (longest > cfg.maxWidth) reasons.push(`1行${longest}文字相当（上限${cfg.maxWidth}）`);
      if (cps > cfg.cps) reasons.push(`表示速度${cps}文字/秒（目安${cfg.cps}以下）`);
      if (duration < cfg.minDuration) reasons.push(`表示${duration.toFixed(2)}秒（下限${cfg.minDuration}秒）`);
      warnings.set(cue.id, reasons);
    }
    // Sweeping max-end detects nested overlaps as well as adjacent overlaps.
    let longest = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      if (longest && current.start < longest.end) {
        if (!warnings.get(current.id).some(x => x.includes('時間が重複'))) warnings.get(current.id).push('ほかの字幕と時間が重複');
        if (!warnings.get(longest.id).some(x => x.includes('時間が重複'))) warnings.get(longest.id).push('ほかの字幕と時間が重複');
      }
      if (!longest || current.end > longest.end) longest = current;
    }
    const flagged = cues.filter(c => warnings.get(c.id)?.length).length;
    return { total: cues.length, flagged, clear: cues.length - flagged, issues: [...warnings.values()].reduce((n, a) => n + a.length, 0), warnings };
  }
  function shift(cues, delta) {
    if (!Number.isFinite(delta)) throw Error('移動量が不正です');
    if (cues.some(c => c.start + delta < 0)) throw Error('開始時刻が0秒より前になります。移動量を小さくしてください');
    return cues.map(c => ({ ...c, start: Math.round(c.start + delta), end: Math.round(c.end + delta) }));
  }
  function report(cues, cfg) {
    const a = audit(cues, cfg);
    const lines = [['番号','開始','終了','状態','指摘内容']];
    cues.forEach((c, i) => lines.push([String(i+1),formatTime(c.start), formatTime(c.end), a.warnings.get(c.id).length ? '要確認' : 'OK', a.warnings.get(c.id).join(' / ')]));
    return '\uFEFF' + lines.map(cols => cols.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\r\n') + '\r\n';
  }
  function demo() {
    return [
      { id: 'demo1', start: 0, end: 3200, text: '字幕は作っただけでは\n読みやすいとは限りません。' },
      { id: 'demo2', start: 3400, end: 5200, text: 'ここは一気に情報を詰め込みすぎていて読む時間が少し足りない例文です。' },
      { id: 'demo3', start: 5000, end: 8900, text: '時間が重なるところも\n見つけます。' },
      { id: 'demo4', start: 9300, end: 13400, text: '行の折り返し候補を確認して\n必要なら手で調整しましょう。' }
    ];
  }
  return { presets, graphemes, width, parseTime, formatTime, validateCue, parse, serialize, autoBreak, joinExistingLines, audit, shift, report, demo };
});