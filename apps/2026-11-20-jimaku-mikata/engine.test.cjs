const test=require("node:test"),assert=require("node:assert/strict");
const E=require("./engine.js");
const SAMPLE=E.parse(E.SAMPLE),R={...E.PRESETS.film};
test("SRTのサンプルを5件として解析",()=>assert.equal(SAMPLE.length,5));
test("VTT headerと識別子を解析",()=>{const c=E.parse("WEBVTT\n\nidentifier\n00:01.000 --> 00:02.500 align:start\nこんにちは");assert.equal(c.length,1);assert.equal(c[0].start,1000);});
test("BOMとCRLFを処理",()=>assert.equal(E.parse("\uFEFF1\r\n00:00:01,000 --> 00:00:02,000\r\n字幕").length,1));
test("不正な時刻は例外",()=>assert.throws(()=>E.parse("1\nINVALID\ntext")));
test("空の字幕本文を拒否",()=>assert.throws(()=>E.parse("1\n00:00:01,000 --> 00:00:02,000")));
test("分と時の時刻変換",()=>assert.equal(E.ms("01:02:03,125"),3723125));
test("2桁分表記",()=>assert.equal(E.ms("01:03.600"),63600));
test("異常時刻はNaN",()=>assert.ok(Number.isNaN(E.ms("1:77:00,123"))));
test("SRT時刻書式",()=>assert.equal(E.stamp(3723125),"01:02:03,125"));
test("VTT時刻書式",()=>assert.equal(E.stamp(3723125,"."),"01:02:03.125"));
test("負の時刻は拒否",()=>assert.throws(()=>E.stamp(-1)));
test("日本語書記素・絵文字数",()=>assert.equal(E.count("あ😀か"),3));
test("改行は文字数から除外",()=>assert.equal(E.count("あ\nい"),2));
test("HTMLタグは計数除外",()=>assert.equal(E.count("<i>はい</i>"),2));
test("CPS上限超過を検知",()=>assert.ok(E.diagnostics([{id:1,start:0,end:1000,text:"あいうえおかきく",locked:false}],R).items[0].warnings.some(x=>x.code==="cps")));
test("短時間を検知",()=>assert.ok(E.diagnostics([{id:1,start:0,end:100,text:"あ"}],R).items[0].warnings.some(x=>x.code==="short")));
test("行幅を検知",()=>assert.ok(E.diagnostics([{id:1,start:0,end:10000,text:"あ".repeat(20)}],R).items[0].warnings.some(x=>x.code==="width")));
test("行数を検知",()=>assert.ok(E.diagnostics([{id:1,start:0,end:10000,text:"あ\nい\nう"}],R).items[0].warnings.some(x=>x.code==="lines")));
test("前の字幕との重複を検知",()=>assert.ok(E.diagnostics([{id:1,start:0,end:1500,text:"あ"},{id:2,start:1200,end:2000,text:"い"}],R).items[1].warnings.some(x=>x.code==="overlap")));
test("最小ギャップ不足を検知",()=>assert.ok(E.diagnostics([{id:1,start:0,end:1500,text:"あ"},{id:2,start:1550,end:3000,text:"い"}],R).items[1].warnings.some(x=>x.code==="gap")));
test("固定字幕は変更されない",()=>{const cues=[{id:1,start:0,end:500,text:"長い長い長い長い長い長い長い長い",locked:true}];assert.deepEqual(E.autoDraft(cues,R).cues,cues);});
test("修正案は本文を削除しない",()=>{const cues=[{id:1,start:0,end:800,text:"本当に読みやすい行に改行したいのです。",locked:false}];const c=E.autoDraft(cues,R).cues[0];assert.equal(c.text.replace(/\n/g,""),cues[0].text);});
test("修正案は次字幕と重複させない",()=>{const cues=[{id:1,start:0,end:1000,text:"大変長い字幕の文字列",locked:false},{id:2,start:1800,end:2600,text:"次の字幕",locked:false}];const c=E.autoDraft(cues,R).cues;assert.ok(c[0].end<=c[1].start-R.gap);});
test("最後の字幕は必要な表示時間まで延長できる",()=>{const c=E.autoDraft([{id:1,start:0,end:500,text:"あいうえおかきく",locked:false}],R).cues;assert.equal(c[0].end,2000);});
test("元データを破壊しない",()=>{const before=JSON.stringify(SAMPLE);E.autoDraft(SAMPLE,R);assert.equal(JSON.stringify(SAMPLE),before);});
test("長文改行は文字を維持し不可能時には3行目を許す",()=>{const t="あ".repeat(44),v=E.breakLines(t,16,2);assert.equal(v.replace(/\n/g,""),t);assert.ok(v.split("\n").length>2);});
test("SRT→解析の往復",()=>{const v=E.parse(E.encodeSrt(SAMPLE));assert.equal(v.length,SAMPLE.length);assert.equal(v[3].text,SAMPLE[3].text);});
test("VTT→解析の往復",()=>{const v=E.parse(E.encodeVtt(SAMPLE));assert.equal(v.length,SAMPLE.length);assert.equal(v[4].start,SAMPLE[4].start);});
test("CSVで引用符をエスケープ",()=>{const cues=[{id:1,start:0,end:2000,text:'「"引用"」'}];const csv=E.csvReport(cues,E.diagnostics(cues,R));assert.ok(csv.includes('""引用""'));});
test("空字幕でも指標は有限",()=>{const r=E.diagnostics([],R);assert.equal(r.cleanCues,0);assert.equal(r.issueCount,0);});
test("ランダムな非重複字幕500件で修正案が安全",()=>{
 let seed=229;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 for(let k=0;k<500;k++){
  const list=[];let t=0;
  for(let j=0;j<3+Math.floor(rnd()*12);j++){
   const dur=300+Math.floor(rnd()*2900);list.push({id:j+1,start:t,end:t+dur,text:"日本語テスト".repeat(1+Math.floor(rnd()*11)),locked:rnd()<.2});t+=dur+Math.floor(rnd()*1500)+R.gap;
  }
  const out=E.autoDraft(list,R).cues;
  assert.equal(out.length,list.length);
  for(let j=0;j<out.length;j++){
   assert.equal(out[j].start,list[j].start);
   assert.equal(out[j].text.replace(/\n/g,""),list[j].text);
   if(list[j].locked)assert.deepEqual(out[j],list[j]);
   if(j+1<out.length)assert.ok(out[j].end<=out[j+1].start-R.gap);
  }
 }
});
test("改行調整は空白を落とさない",()=>{const s="This is a text with spaces and\n punctuation.",v=E.breakLines(s,12,4);assert.equal(v.replace(/\n/g,""),s.replace(/\n/g,""));});
