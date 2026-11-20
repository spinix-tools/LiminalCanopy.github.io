/* 字幕ものさし – pure subtitle engine, no dependencies. MIT */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.JimakuEngine = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const presets = Object.freeze({
    jp: { label: '日本語・標準（独自の目安）', line: 15, cps: 6, min: 0.7, max: 7, lines: 2, gap: 80 },
    strict: { label: '日本語・厳しめ（参考値）', line: 13, cps: 4, min: 0.5, max: 7, lines: 2, gap: 80 },
    en: { label: '英語・一般（独自の目安）', line: 42, cps: 20, min: 0.8, max: 7, lines: 2, gap: 80 }
  });
  const clone = value => JSON.parse(JSON.stringify(value));
  function parseTime(value) {
    const m = String(value).trim().match(/^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})[,.](\d{1,3})$/);
    if (!m) throw Error('タイムコードを解釈できません: ' + value);
    const h = +(m[1] || 0), mm = +m[2], s = +m[3];
    if (s > 59 || (m[1] != null && mm > 59)) throw Error('時刻の分・秒が範囲外です: ' + value);
    return ((h * 3600 + mm * 60 + s) * 1000 + +(m[4].padEnd(3, '0')));
  }
  function formatTime(ms, type = 'srt') {
    if (!Number.isFinite(ms) || ms < 0) throw Error('負または不正な時刻です');
    let n = Math.round(ms), msec = n % 1000; n = Math.floor(n / 1000);
    const sec = n % 60, min = Math.floor(n / 60) % 60, hour = Math.floor(n / 3600);
    return [hour, min, sec].map(v => String(v).padStart(2, '0')).join(':') + (type === 'vtt' ? '.' : ',') + String(msec).padStart(3, '0');
  }
  function parseSubtitles(input) {
    if (typeof input !== 'string' || !input.trim()) throw Error('字幕テキストが空です');
    const normalized = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
    const vtt = /^WEBVTT(?:\s|$)/.test(normalized);
    const rawBlocks = normalized.split(/\n\s*\n/);
    const cues = [];
    let skipHeader = vtt;
    for (let bi = 0; bi < rawBlocks.length; bi++) {
      const lines = rawBlocks[bi].split('\n');
      if (skipHeader && /^WEBVTT/.test(lines[0])) { skipHeader = false; continue; }
      if (vtt && /^(NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0])) continue;
      const arrow = lines.findIndex(x => /-->/.test(x));
      if (arrow < 0) throw Error(`${bi + 1}番目のブロック: 時刻行（-->）がありません`);
      if (arrow > 1) throw Error(`${bi + 1}番目のブロック: 識別子の形式を確認してください`);
      const timing = lines[arrow].match(/^\s*(\S+)\s+-->\s+(\S+)(?:\s+(.*))?\s*$/);
      if (!timing) throw Error(`${bi + 1}番目のブロック: 時刻行の形式が不正です`);
      let start, end;
      try { start = parseTime(timing[1]); end = parseTime(timing[2]); }
      catch (e) { throw Error(`${bi + 1}番目のブロック: ${e.message}`); }
      cues.push({ id: arrow === 1 ? lines[0].trim() : String(cues.length + 1), start, end,
        text: lines.slice(arrow + 1).join('\n'), settings: vtt ? (timing[3] || '').trim() : '',
        uid: cues.length + 1 });
    }
    if (!cues.length) throw Error('字幕キューが見つかりません');
    return { format: vtt ? 'vtt' : 'srt', cues };
  }
  function exportSubtitles(cues, type) {
    if (!['srt', 'vtt'].includes(type)) throw Error('未対応の書き出し形式');
    const blocks = cues.map((c, i) => {
      if (!Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < 0 || c.end <= c.start) {
        throw Error(`キュー ${i + 1} の時刻が不正です。修正してから出力してください`);
      }
      const setting = type === 'vtt' && c.settings ? ' ' + c.settings : '';
      return (type === 'srt' ? `${i + 1}\n` : (c.id && !/^\d+$/.test(c.id) ? `${c.id}\n` : '')) +
        `${formatTime(c.start, type)} --> ${formatTime(c.end, type)}${setting}\n${c.text}`;
    });
    return (type === 'vtt' ? 'WEBVTT\n\n' : '') + blocks.join('\n\n') + '\n';
  }
  function charUnit(ch, language = 'jp') {
    if (language === 'en') return 1;
    const code = ch.codePointAt(0);
    if (code <= 0x7f || (code >= 0xff61 && code <= 0xff9f)) return .5;
    return 1;
  }
  function lineUnits(line, language = 'jp') {
    return Array.from(line).reduce((s, ch) => s + charUnit(ch, language), 0);
  }
  function countUnits(text, language = 'jp') {
    return lineUnits(String(text).replace(/\n/g, ''), language);
  }
  const forbiddenStart = /^[、。，．！？!?：；）」』】〉》ぁぃぅぇぉっゃゅょァィゥェォッャュョー]/u;
  const forbiddenEnd = /[（「『【〈《]$/u;
  function check(cues, rules = presets.jp, language = 'jp') {
    const issues = [], perCue = cues.map(() => []);
    function add(i, code, level, message) {
      const item = { index: i, code, level, message };
      issues.push(item); perCue[i].push(item);
    }
    const r = { ...presets.jp, ...rules };
    cues.forEach((c, i) => {
      const duration = (c.end - c.start) / 1000;
      const lines = String(c.text).split('\n');
      const total = countUnits(c.text, language);
      if (c.start < 0 || c.end <= c.start) add(i, 'time', 'error', '開始・終了時刻が逆転または不正');
      if (!c.text.trim()) add(i, 'empty', 'error', '字幕テキストが空');
      if (duration > 0 && duration < r.min - 0.0001) add(i, 'short', 'warn', `表示時間が短い：${duration.toFixed(2)}秒`);
      if (duration > r.max + 0.0001) add(i, 'long', 'warn', `表示時間が長い：${duration.toFixed(2)}秒`);
      if (lines.length > r.lines) add(i, 'lines', 'warn', `${lines.length}行（上限${r.lines}行）`);
      if (lines.some(s => lineUnits(s, language) > r.line + 0.0001)) add(i, 'width', 'warn', `1行の字幅が${r.line}を超過`);
      if (duration > 0 && total / duration > r.cps + 0.0001) add(i, 'speed', 'warn', `読速${(total / duration).toFixed(1)}字幅/秒（目安${r.cps}）`);
      if (lines.some((s, j) => (j > 0 && forbiddenStart.test(s)) || (j < lines.length - 1 && forbiddenEnd.test(s))))
        add(i, 'kinsoku', 'warn', '行頭・行末の禁則文字を確認');
      if (i > 0) {
        const prev = cues[i - 1];
        if (c.start < prev.start) add(i, 'order', 'error', '前の字幕より開始時刻が早い');
        if (c.start < prev.end) add(i, 'overlap', 'error', `前の字幕と${((prev.end-c.start)/1000).toFixed(2)}秒重複`);
      }
    });
    return { issues, perCue, errors: issues.filter(x => x.level === 'error').length,
      warnings: issues.filter(x => x.level === 'warn').length,
      clean: cues.filter((_, i) => perCue[i].length === 0).length,
      risky: perCue.filter(x => x.length > 0).length };
  }
  function rewrap(text, maxUnits, language = 'jp', maxLines = 2) {
    const original = String(text);
    const flattened = original.replace(/\n/g, '');
    if (!flattened.trim()) return { text: original, changed: false, reason: '空字幕' };
    if (maxLines !== 2) return { text: original, changed: false, reason: '自動整形は2行設定のみ対応' };
    const total = countUnits(flattened, language);
    if (total > maxUnits * 2 + 0.0001) return { text: original, changed: false, reason: '2行には収まらないため保持' };
    if (total <= maxUnits) return { text: flattened, changed: original !== flattened, reason: '1行に整形' };
    const a = Array.from(flattened);
    let best = null;
    for (let i = 1; i < a.length; i++) {
      const left = a.slice(0, i).join(''), right = a.slice(i).join('');
      const lw = lineUnits(left, language), rw = lineUnits(right, language);
      if (lw > maxUnits || rw > maxUnits) continue;
      const penalty = (forbiddenStart.test(right) ? 1000 : 0) + (forbiddenEnd.test(left) ? 1000 : 0) +
        (/[a-zA-Z0-9]$/u.test(left) && /^[a-zA-Z0-9]/u.test(right) ? 30 : 0);
      const score = penalty + Math.abs(lw - rw) + (/[、。！？!?\s]$/u.test(left) ? -0.75 : 0);
      if (!best || score < best.score) best = { text: left + '\n' + right, score };
    }
    if (!best) return { text: original, changed: false, reason: '禁則・字幅を守る改行位置がありません' };
    return { text: best.text, changed: original !== best.text,
      reason: best.score >= 1000 ? '禁則文字が残る候補（要手直し）' : '字幅とバランスから改行' };
  }
  function batchWrap(cues, rules = presets.jp, language = 'jp') {
    const updated = clone(cues), changes = [], skipped = [];
    updated.forEach((cue, i) => {
      const x = rewrap(cue.text, rules.line, language, rules.lines);
      if (x.changed) { changes.push({ index: i, field: 'text', before: cue.text, after: x.text, reason: x.reason }); cue.text = x.text; }
      else if (x.reason.includes('保持') || x.reason.includes('ありません')) skipped.push({ index: i, reason: x.reason });
    });
    return { cues: updated, changes, skipped };
  }
  function trimOverlaps(cues, gap = 80, minDuration = 500) {
    const updated = clone(cues), changes = [], skipped = [];
    for (let i = 1; i < updated.length; i++) {
      const p = updated[i-1], c = updated[i];
      if (c.start < p.start) { skipped.push({ index: i, reason: '時刻順が逆転（自動修正対象外）' }); continue; }
      if (p.end <= c.start - gap) continue;
      const candidate = c.start - gap;
      if (candidate >= p.start + minDuration && candidate < p.end) {
        changes.push({ index: i-1, field: 'end', before: p.end, after: candidate, reason: `次の字幕との間隔 ${gap}ms を確保` });
        p.end = candidate;
      } else skipped.push({ index: i-1, reason: '短すぎる表示時間になるため未修正' });
    }
    return { cues: updated, changes, skipped };
  }
  function demo() {
    return parseSubtitles(`1\n00:00:01,000 --> 00:00:03,000\n今日は字幕の読みやすさを一緒に確認していきましょう。\n\n2\n00:00:02,850 --> 00:00:05,800\n長い字幕をそのまま表示してしまうと、視聴者は内容を読み切れないことがあります。\n\n3\n00:00:06,000 --> 00:00:08,600\nなので、文の切れ目を大切にします。\n\n4\n00:00:08,700 --> 00:00:10,000\n（拍手）\n\n5\n00:00:10,100 --> 00:00:12,400\n次は実際に書き出してみましょう。`);
  }
  return { presets, clone, parseTime, formatTime, parseSubtitles, exportSubtitles,
    charUnit, lineUnits, countUnits, check, rewrap, batchWrap, trimOverlaps, demo };
});
