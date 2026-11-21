const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const s=E.PRESETS.horizontal;
test('SRT読み込み、時間、本文、出力往復',()=>{
 const p=E.parse(E.DEMO);assert.equal(p.format,'srt');assert.equal(p.cues.length,5);assert.equal(p.cues[0].start,500);
 const q=E.parse(E.serialize(p.cues,'srt'));assert.deepEqual(q.cues.map(x=>[x.start,x.end,x.text]),p.cues.map(x=>[x.start,x.end,x.text]));
});
test('WebVTT識別子、cue settingsを読み書き',()=>{
 const source='WEBVTT\n\nNOTE keep local\ncomment\n\nintro\n00:01.000 --> 00:03.500 align:start position:10%\nこんにちは\n\n00:04.000 --> 00:06.000\n世界';
 const p=E.parse(source);assert.equal(p.format,'vtt');assert.equal(p.cues.length,2);assert.equal(p.cues[0].settings,'align:start position:10%');assert.equal(p.warnings.length,1);
 const round=E.parse(E.serialize(p.cues,'vtt'));assert.equal(round.cues[0].sourceId,'intro');assert.equal(round.cues[0].text,'こんにちは');
});
test('時刻と文字幅の計算',()=>{
 assert.equal(E.parseTime('00:01:02,003'),62003);assert.equal(E.parseTime('01:02.345'),62345);assert.ok(Number.isNaN(E.parseTime('00:66:02,003')));
 assert.equal(E.timecode(62345),'00:01:02,345');assert.equal(E.timecode(62345,'vtt'),'00:01:02.345');
 assert.equal(E.width('日本ABC123ｱ'),5.5);assert.equal(E.width('abc'),1.5);
});
test('不正形式の警告と読み飛ばし',()=>{const p=E.parse('1\n00:00:xx,000 --> 00:00:03,000\nテスト\n\n2\n00:00:04,000 --> 00:00:06,000\n有効');assert.equal(p.cues.length,1);assert.equal(p.warnings.length,1)});
test('サンプルは意図した問題を検出',()=>{const a=E.analyze(E.parse(E.DEMO).cues,s);assert.ok(a.summary.flagged>=3);assert.ok(a.summary.kinds.overlap>=1);assert.ok(a.summary.kinds.head>=1);assert.ok(a.summary.kinds.speed>=1);});
test('読速・行数・幅・短時間・空テキスト',()=>{const c=[{id:1,start:0,end:200,text:'大変長い字幕です\nながいです\n三行目がある'},{id:2,start:500,end:2000,text:''}];const a=E.analyze(c,s);assert.ok(a.rows[0].issues.includes('short'));assert.ok(a.rows[0].issues.includes('speed'));assert.ok(a.rows[0].issues.includes('lines'));assert.ok(a.rows[1].issues.includes('empty'));});
test('改行の日本語禁則と長さ',()=>{const p=E.proposeWrap('本日のお知らせを皆さんにお届けします。',s);assert.ok(p.ok,p.reason);const lines=p.text.split('\n');assert.equal(lines.length,2);assert.ok(lines.every(line=>E.width(line)<=13));assert.ok(!/^[、。！]/.test(lines[1]));});
test('話者別の行を壊さない',()=>{assert.equal(E.proposeWrap('- こんにちは\n- こんばんは',s).ok,false);});
test('行幅が収まらなければテキストを削らない',()=>{const txt='あ'.repeat(50);const p=E.proposeWrap(txt,s);assert.equal(p.ok,false);});
test('拡張は次字幕を越えない',()=>{const c=[{id:1,start:0,end:800,text:'とてもとても長い文章で表示時間が足りません'},{id:2,start:1300,end:2500,text:'次'}];const r=E.extendCue(c,1,s);assert.ok(r.changed);assert.ok(r.cues[0].end<=r.cues[1].start-s.minGap);assert.equal(c[0].end,800);});
test('読速を満たす時間まで拡張できる場合は満たす',()=>{const c=[{id:1,start:0,end:800,text:'こんにちは世界こんにちは世界'}];const r=E.extendCue(c,1,s);assert.ok(r.changed);assert.ok(E.score(r.cues[0]).speed<=s.maxSpeed+0.01);});
test('一括操作は入力を破壊しない',()=>{const src=E.parse(E.DEMO).cues,copy=JSON.stringify(src);E.extendAll(src,s);E.wrapAll(src,s);assert.equal(JSON.stringify(src),copy);});
test('移動と負の時刻の拒否',()=>{const p=E.parse(E.DEMO).cues;const q=E.shift(p,250);assert.equal(q[0].start,750);assert.throws(()=>E.shift(p,-501),/0秒/);});
test('時刻異常のエクスポート拒否',()=>{const c=[{id:1,start:1000,end:400,text:'bad'}];assert.ok(E.analyze(c).rows[0].issues.includes('badtime'));assert.throws(()=>E.serialize(c),/時刻/);});
test('CSV注入を含む文本も全セルが引用符付き',()=>{const c=[{id:1,start:0,end:2000,text:'=HYPERLINK("bad")'}];const csv=E.reportCSV(E.analyze(c));assert.ok(csv.includes("\"'=HYPERLINK(\"\"bad\"\")\""));assert.ok(csv.startsWith('\uFEFF'));});
test('400ランダムケースで出力往復、ソート、改行上限、安全な拡張',()=>{
 let seed=37;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 for(let k=0;k<400;k++){
  const n=1+Math.floor(rand()*9);let start=0;
  const cues=[];
  for(let i=0;i<n;i++){start+=Math.floor(rand()*2500);const end=start+700+Math.floor(rand()*3000);const text=Array.from({length:1+Math.floor(rand()*20)},()=>String.fromCodePoint(0x3042+Math.floor(rand()*45))).join('');cues.push({id:i+1,start,end,text,settings:''});}
  const again=E.parse(E.serialize(cues,'srt')).cues;
  assert.deepEqual(again.map(x=>[x.start,x.end,x.text]),cues.map(x=>[x.start,x.end,x.text]));
  const extended=E.extendAll(cues,s);assert.equal(extended.cues.length,n);
  for(let i=0;i<n;i++){assert.ok(extended.cues[i].end>=cues[i].end);assert.equal(extended.cues[i].start,cues[i].start);}
  const wrapped=E.wrapAll(cues,s).cues;
  for(const c of wrapped){const original=cues.find(x=>x.id===c.id);assert.equal(c.text.replace(/\n/g,''),original.text.replace(/\n/g,''));}
  assert.equal(E.analyze(cues,s).summary.total,n);
 }
});
