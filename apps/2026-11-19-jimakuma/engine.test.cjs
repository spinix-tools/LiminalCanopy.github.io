const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const o = E.PRESETS.strict;
test('parseTime accepts VTT and SRT timestamps',()=>{
 assert.equal(E.parseTime('00:01:02.345'),62345);
 assert.equal(E.parseTime('01:02,3'),62300);
 assert.equal(E.parseTime('99:59:59,999'),359999999);
 assert.equal(E.parseTime('00:60:01.000'),null);
 assert.equal(E.parseTime('hi'),null);
});
test('timecode SRT/VTT',()=>{
 assert.equal(E.timecode(62345,','),'00:01:02,345');
 assert.equal(E.timecode(62345,'.'),'00:01:02.345');
 assert.throws(()=>E.timecode(-1));
});
test('SRT loads multiline cues and indexes',()=>{
 const result=E.parseSubtitles('1\r\n00:00:00,000 --> 00:00:02,000\r\nおはよう\r\nございます\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nはい');
 assert.equal(result.cues.length,2);assert.equal(result.cues[0].text,'おはよう\nございます');assert.equal(result.type,'srt');
});
test('WebVTT loads cue identifiers and timing settings',()=>{
 const r=E.parseSubtitles('WEBVTT\n\nNOTE hi\nignore\n\ncue1\n00:00:01.000 --> 00:00:04.400 align:start\n字幕です');
 assert.equal(r.type,'vtt');assert.equal(r.cues.length,1);assert.equal(r.cues[0].start,1000);
});
test('malformed events are rejected or reported',()=>{
 assert.throws(()=>E.parseSubtitles('some nonsense'),/読み取れません/);
 assert.throws(()=>E.parseSubtitles('1\n00:00:04,000 --> 00:00:03,000\n失敗'),/不正/);
 const r=E.parseSubtitles('1\n00:00:00,000 --> 00:00:01,000\nOK\n\n2\n00:00:04,000 --> nonsense\nbad');
 assert.equal(r.cues.length,1);assert.equal(r.errors.length,1);
});
test('weighted count treats Japanese as full, ASCII as half',()=>{
 assert.equal(E.weightedLength('日本AB'),3);
 assert.deepEqual(E.lineWidths('あい\nabc'),[2,1.5]);
 assert.equal(E.weightedLength('<i>文字</i>'),2);
 assert.equal(E.weightedLength('👩‍💻'),1);
});
test('quality report checks duration width speed and overlap',()=>{
 const c=[{id:'a',start:0,end:1000,text:'あ'.repeat(14)},{id:'b',start:900,end:1100,text:'短い'}];
 const a=E.analyze(c,o);
 assert.equal(a.total,2);assert.equal(a.problem,2);
 assert.deepEqual(a.byId.get('a').issues,['読む速度が速い','行幅超過','次と重複']);
 assert.ok(a.byId.get('b').issues.includes('表示時間が短い'));
});
test('quality reports sorted chronological overlap not array order',()=>{
 const c=[{id:'b',start:1900,end:2500,text:'B'},{id:'a',start:0,end:2000,text:'A'}];
 assert.equal(E.analyze(c,E.PRESETS.casual).byId.get('a').issues.includes('次と重複'),true);
});
test('text wrap preserves all content ignoring only inserted lines',()=>{
 const text='今日は素晴らしい日ですね、みんなで歩きましょう。';
 for(let limit of [4,7,10,13,18]){
   const w=E.wrapJapanese(text,limit);assert.equal(w.replace(/\n/g,''),text);
   assert.ok(E.lineWidths(w).every(x=>x<=limit));
 }
});
test('text wrap handles ASCII half-width and empty strings',()=>{
 assert.equal(E.wrapJapanese('',13),'');
 assert.equal(E.wrapJapanese('ABCDEFGH',2),'ABCD\nEFGH');
});
test('split preserves characters and exact timing partition',()=>{
 const c={id:'x',start:0,end:4000,text:'本日は新しい商品の説明をします。'};
 const parts=E.splitCue(c,{...o,min:500});
 assert.equal(parts[0].start,0);assert.equal(parts[1].end,4000);
 assert.equal(parts[0].end,parts[1].start);
 assert.equal(parts.map(x=>x.text.replace(/\n/g,'')).join(''),c.text);
});
test('split rejects too-short duration',()=>{
 assert.throws(()=>E.splitCue({id:'x',start:0,end:900,text:'あいうえ'},o),/不足/);
});
test('extend uses free gap and does not overlap next',()=>{
 const cues=[{id:'a',start:0,end:1000,text:'あ'.repeat(20)},{id:'b',start:3500,end:4500,text:'い'}];
 const result=E.extendCue(cues,'a',{...o,max:7000});
 assert.equal(result[0].end,3500);assert.equal(result[1].start,3500);
 assert.equal(cues[0].end,1000);
});
test('extend without successor stretches to target but max duration',()=>{
 const c=[{id:'a',start:0,end:1000,text:'あ'.repeat(40)}];
 assert.equal(E.extendCue(c,'a',o)[0].end,7000);
});
test('shift preserves length and prohibits negative starts',()=>{
 const c=[{id:'a',start:100,end:300,text:'a'}];
 assert.deepEqual(E.shiftAll(c,500),[{id:'a',start:600,end:800,text:'a'}]);
 assert.throws(()=>E.shiftAll(c,-101),/負/);
});
test('formatting round-trip for both formats',()=>{
 const original=[{id:'a',start:200,end:3100,text:'漢字\nかな'},{id:'b',start:4100,end:5700,text:'半角ABC'}];
 for(const type of ['vtt','srt']){
  const s=E.formatSubtitles(original,type);const r=E.parseSubtitles(s);
  assert.deepEqual(r.cues.map(({start,end,text})=>({start,end,text})),original.map(({start,end,text})=>({start,end,text})));
 }
});
test('formatter rejects negative and backwards times',()=>{
 assert.throws(()=>E.formatSubtitles([{id:'x',start:200,end:100,text:'bad'}]));
});
test('stress: deterministic wrap and roundtrip 300 cues',()=>{
 const cues=Array.from({length:300},(_,i)=>({id:'r'+i,start:i*3200,end:i*3200+2900,text:'新しい字幕を確認します '+i}));
 const c=E.parseSubtitles(E.formatSubtitles(cues,'srt')).cues;
 assert.equal(c.length,300);
 assert.equal(E.analyze(c,E.PRESETS.casual).total,300);
});
