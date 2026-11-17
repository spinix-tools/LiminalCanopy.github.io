/* node --test engine.test.cjs | no dependencies */
const test=require("node:test");
const assert=require("node:assert/strict");
const K=require("./engine.js");
const clone=v=>JSON.parse(JSON.stringify(v));
const base=()=>({
 version:1,
 items:[{id:"camera",name:"カメラ",stock:2,buffer:0},{id:"mic",name:"マイク",stock:1,buffer:15}],
 events:[{id:"one",title:"午前",start:"2026-11-18T09:00",end:"2026-11-18T10:00",needs:{camera:1,mic:1}},
         {id:"two",title:"午後",start:"2026-11-18T10:00",end:"2026-11-18T11:00",needs:{camera:1}}]
});
test("サンプルは妥当",()=>assert.deepEqual(K.check(K.sample()),[]));
test("定義済みデータが妥当",()=>assert.deepEqual(K.check(base()),[]));
test("時刻の正常な読み書き",()=>assert.equal(K.fmt(K.ms("2026-11-18T12:30")),"2026-11-18T12:30"));
test("不正な日付は無効",()=>assert.equal(Number.isNaN(K.ms("2026-02-30T10:00")),true));
test("不正フォーマットは無効",()=>assert.equal(Number.isNaN(K.ms("2026/11/18 10:00")),true));
test("同時に在庫ちょうどなら不足なし",()=>{
 const p=base();p.events[1].start="2026-11-18T09:00";p.events[1].end="2026-11-18T10:00";
 assert.equal(K.trace(p).find(x=>x.itemId==="camera").peak,2);
 assert.equal(K.trace(p).find(x=>x.itemId==="camera").shortage,0);
});
test("半開区間では接する予定は衝突しない",()=>{
 const p=base();assert.equal(K.trace(p).find(x=>x.itemId==="camera").shortage,0);
});
test("前後15分で接する予約が衝突する",()=>{
 const p=base();p.events[1].needs={mic:1};
 assert.equal(K.trace(p).find(x=>x.itemId==="mic").shortage,1);
});
test("同時必要数で不足数が2になる",()=>{
 const p=base();p.events[1].start=p.events[0].start;p.events[1].end=p.events[0].end;p.events[1].needs={camera:3};
 assert.equal(K.trace(p).find(x=>x.itemId==="camera").shortage,2);
});
test("不足時間区間が返る",()=>{
 const p=base();p.events[1].needs={mic:1};
 const seg=K.trace(p).find(x=>x.itemId==="mic").segments;
 assert.equal(seg.length,1);assert.equal(seg[0].shortage,1);
});
test("編集時は元予定を除外して検証",()=>{
 const p=base();assert.equal(K.availability(p,p.events[0],"one").ok,true);
});
test("競合予約をブロック",()=>{
 const p=base();const x={id:"three",title:"3",start:"2026-11-18T09:00",end:"2026-11-18T10:00",needs:{mic:1}};
 assert.equal(K.availability(p,x).ok,false);
});
test("競合なしの予約は保存可能",()=>{
 const p=base();const x={id:"three",title:"3",start:"2026-11-18T15:00",end:"2026-11-18T16:00",needs:{mic:1}};
 assert.equal(K.availability(p,x).ok,true);
});
test("代替時間は競合がなく日時の後に出る",()=>{
 const p=base();const x={id:"three",title:"3",start:"2026-11-18T09:00",end:"2026-11-18T10:00",needs:{mic:1}};
 const s=K.suggestions(p,x,null,3,2);
 assert.equal(s.length,3);assert.ok(K.ms(s[0].start)>K.ms(x.start));
 for(const t of s)assert.ok(K.availability(p,{...x,...t}).ok);
});
test("空の必要備品を拒否",()=>assert.equal(K.availability(base(),{id:"x",title:"x",start:"2026-11-18T12:00",end:"2026-11-18T13:00",needs:{}}).ok,false));
test("未知の備品IDを拒否",()=>{
 const p=base();p.events[0].needs={missing:1};assert.ok(K.check(p).length>0);
});
test("重複IDを拒否",()=>{
 const p=base();p.items[1].id=p.items[0].id;assert.ok(K.check(p).length>0);
});
test("在庫ゼロを拒否",()=>{
 const p=base();p.items[0].stock=0;assert.ok(K.check(p).length>0);
});
test("準備時間の負値を拒否",()=>{
 const p=base();p.items[0].buffer=-1;assert.ok(K.check(p).length>0);
});
test("7日以上のイベントを拒否",()=>{
 const p=base();p.events[0].end="2026-12-01T11:00";assert.ok(K.check(p).length>0);
});
test("イベント開始と終了が逆なら拒否",()=>{
 const p=base();p.events[0].end="2026-11-18T08:00";assert.ok(K.check(p).length>0);
});
test("CSVのBOMとカラム",()=>{
 const c=K.csv(base());assert.ok(c.startsWith("\uFEFF"));assert.ok(c.includes('"予定名"'));
});
test("CSV formula injectionはアポストロフィで無害化",()=>{
 const p=base();p.events[0].title="=1+1";assert.ok(K.csv(p).includes("'=1+1"));
});
test("CSVの引用符を二重化",()=>{
 const p=base();p.items[0].name='録画"カメラ';assert.ok(K.csv(p).includes('録画""カメラ'));
});
test("元データを解析中に変更しない",()=>{
 const p=base(),s=JSON.stringify(p);K.trace(p);K.availability(p,p.events[0],"one");assert.equal(JSON.stringify(p),s);
});

test("既存の別備品の衝突は新規予約を妨げない",()=>{
 const p=base();p.events[1].needs={mic:1};p.events[1].start="2026-11-18T09:30";p.events[1].end="2026-11-18T10:30";
 const x={id:"three",title:"独立",start:"2026-11-18T09:30",end:"2026-11-18T10:00",needs:{camera:1}};
 assert.equal(K.availability(p,x).ok,true);
});
test("既存の衝突に新規予約が重なる場合は遮断",()=>{
 const p=base();p.events[1].needs={mic:1};p.events[1].start="2026-11-18T09:30";p.events[1].end="2026-11-18T10:30";
 const x={id:"three",title:"追加",start:"2026-11-18T09:30",end:"2026-11-18T10:00",needs:{mic:1}};
 assert.equal(K.availability(p,x).ok,false);
});
