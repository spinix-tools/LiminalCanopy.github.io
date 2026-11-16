const assert = require('node:assert/strict');
const test = require('node:test');
const E = require('./engine.js');
const cue = (id, start, end, text) => ({ id, start, end, text });
test('parseTime HH:MM:SS,mmm', () => assert.equal(E.parseTime('01:02:03,004'), 3723004));
test('parseTime VTT shorter mm:ss.mmm', () => assert.equal(E.parseTime('02:03.004'), 123004));
test('parseTime rejects seconds 60', () => assert.throws(() => E.parseTime('00:00:60,000'), /59/));
test('parseTime rejects bad input', () => assert.throws(() => E.parseTime('foo'), /形式/));
test('formatTime rounded', () => assert.equal(E.formatTime(62001.4), '00:01:02,001'));
test('formatTime VTT', () => assert.equal(E.formatTime(62001, true), '00:01:02.001'));
test('fullwidth vs halfwidth count', () => assert.equal(E.width('字幕AB12'), 4));
test('halfwidth katakana count', () => assert.equal(E.width('ｶﾀｶﾅ'), 2));
test('emoji grapheme count', () => assert.equal(E.width('👩‍🚀'), 1));
test('parse SRT numbered cues', () => {
 const p = E.parse('1\r\n00:00:00,000 --> 00:00:01,200\r\nこんにちは\r\n\r\n2\r\n00:00:02,000 --> 00:00:04,000\r\nありがとう\r\n');
 assert.equal(p.cues.length, 2); assert.equal(p.cues[1].text, 'ありがとう'); assert.equal(p.kind,'srt');
});
test('parse VTT header and identifiers', () => {
 const p = E.parse('WEBVTT\n\nNOTE testing\n\nfirst\n00:00:00.000 --> 00:00:02.000 align:center\n字幕です\n');
 assert.equal(p.cues.length, 1); assert.equal(p.skippedMeta, 1); assert.equal(p.kind, 'vtt');
});
test('SRT roundtrip', () => {
 const c = [cue('a', 200, 2600, '会話、\nいいですね。')];
 const next = E.parse(E.serialize(c, 'srt')).cues;
 assert.deepEqual(next.map(x=>[x.start,x.end,x.text]), c.map(x=>[x.start,x.end,x.text]));
});
test('VTT roundtrip', () => {
 const c = [cue('a', 1000, 3100, 'おはよう')];
 const next = E.parse(E.serialize(c, 'vtt')).cues;
 assert.deepEqual(next.map(x=>[x.start,x.end,x.text]), c.map(x=>[x.start,x.end,x.text]));
});
test('parse rejects missing timeline instead of silent discard', () => assert.throws(() => E.parse('bad text'), /時刻行/));
test('parse rejects reversed cue', () => assert.throws(() => E.parse('1\n00:00:03,000 --> 00:00:02,000\nNo'), /終了時刻/));
test('autoBreak preserves text content without losing characters', () => {
 const original = '新しく作った字幕を読みやすい場所で区切るテストです。';
 const r = E.autoBreak(original, 13);
 assert.equal(r.replace(/\n/g, ''), original); assert.equal(r.split('\n').length, 2);
});
test('autoBreak does not break short subtitles', () => assert.equal(E.autoBreak('短い字幕です。', 13), '短い字幕です。'));
test('autoBreak prefers punctuation boundary when balanced', () => {
 const result = E.autoBreak('初めまして。今日は暑い日ですね。', 9);
 assert.ok(result.includes('\n')); assert.equal(result.replace('\n',''), '初めまして。今日は暑い日ですね。');
});
test('joinExistingLines leaves Japanese text contiguous', () => assert.equal(E.joinExistingLines('私は\n学生です'), '私は学生です'));
test('joinExistingLines preserves ASCII word boundary', () => assert.equal(E.joinExistingLines('Hello\nworld'), 'Hello world'));
test('audit flags fast and overlong cues', () => {
 const a = E.audit([cue('a', 0, 800, 'この字幕は長すぎてすごい速度になります')], E.presets.film);
 assert.equal(a.flagged,1); assert.ok(a.issues>=2); assert.match(a.warnings.get('a').join(' '), /表示速度/);
});
test('audit flags overlap on both involved cues', () => {
 const a = E.audit([cue('a', 0, 3000, 'A'),cue('b', 2000, 5000, 'B')]);
 assert.ok(a.warnings.get('a').some(x=>x.includes('重複')));
 assert.ok(a.warnings.get('b').some(x=>x.includes('重複')));
});
test('audit flags third line and empty text', () => {
 const a = E.audit([cue('a',0,3000,'a\nb\nc'),cue('b',3500,6000,'')]);
 assert.match(a.warnings.get('a').join(' '), /3行/);
 assert.match(a.warnings.get('b').join(' '), /空の字幕/);
});
test('audit flag short duration', () => assert.match(E.audit([cue('x',0,250,'短い')]).warnings.get('x').join(' '), /表示/));
test('shift changes times while preserving text', () => assert.deepEqual(E.shift([cue('a',500,2000,'本文')],1000),[cue('a',1500,3000,'本文')]));
test('shift refuses negative absolute timing', () => assert.throws(() => E.shift([cue('a',500,2000,'本文')],-501), /0秒/));
test('serialize refuses invalid timeline', () => assert.throws(() => E.serialize([cue('a',2000,1000,'X')]), /不正/));
test('QA CSV includes UTF-8 BOM and issue summary', () => {
 const csv=E.report([cue('a',0,1000,'="SUM(1)"')],E.presets.film);
 assert.match(csv,/QA|開始/);
 assert.ok(csv.startsWith('\uFEFF'));
});
test('audit does not treat overlapping but nonadjacent out-of-order input as clear', () => {
 const a = E.audit([cue('b',500,3000,'b'),cue('a',0,1200,'a')]);
 assert.equal(a.flagged,2);
});

test('audit detects non-adjacent nested overlaps', () => {
 const a = E.audit([cue('a',0,10000,'A'), cue('b',1000,2000,'B'), cue('c',3000,4000,'C')]);
 assert.equal(a.flagged,3);
});