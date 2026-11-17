'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const D = E.defaults;
test('デフォルトのA/B変換は成立する', () => {
  const x = E.calculate(D); assert.equal(x.A.start, 52); assert.equal(x.A.end, 88); assert.equal(x.A.targetRows, 96); assert.equal(x.B.targetRows, 90);
});
test('元ゲージと一致した場合は元の目数・段数へ戻る', () => {
  const x = E.calculate({...D,swatchASt:20,swatchARows:28});
  assert.equal(x.A.start,48); assert.equal(x.A.end,80); assert.equal(x.A.targetRows,84);
  assert.equal(x.A.widthError,0); assert.equal(x.A.lengthError,0);
});
test('増し目を左右対称にスケジュールする', () => {
  const x = E.schedule(20,30,20,2);
  assert.equal(x.events.length,5); assert.equal(x.events.reduce((n,e)=>n+e.change,0),10);
  assert.equal(x.timeline[19].after,30);
  assert(x.events.every(e=>e.row%2===0 && e.eachSide===1));
});
test('減らし目を左右対称にスケジュールする', () => {
  const x=E.schedule(30,20,20,2);assert.equal(x.events.reduce((n,e)=>n+e.change,0),-10);assert(x.events.every(e=>e.change<0));
});
test('増減無しで問題が生じない', () => {const x=E.schedule(20,20,12,2); assert.equal(x.events.length,0);assert.equal(x.timeline.length,12);});
test('密集すると1段で複数目の警告が出る', () => {
  const x=E.calculate({...D, sourceStart:20,sourceEnd:200,sourceRows:10,step:2,swatchASt:20,swatchARows:28});
  assert(x.A.peak>1);assert(x.A.warnings.some(s=>s.includes('複数')||s.includes('以上')));
});
test('模様の倍数+余りを守る', () => {
  const x=E.calculate({...D,multiple:4,offset:2});
  for(const k of [x.A,x.B]){ assert.equal(k.start%4,2); assert.equal(k.end%4,2); assert.equal((k.end-k.start)%2,0); }
});
test('目数の奇偶を維持する',()=>{const x=E.calculate({...D,multiple:1,offset:0});assert.equal(Math.abs(x.A.end-x.A.start)%2,0);});
test('必要段数はゲージに応じて伸びる',()=>{const x=E.calculate({...D,swatchARows:42});assert.equal(x.A.targetRows,126);});
test('最小入力でも安全に計算できる',()=>{
  const x=E.calculate({...D,patternSt:1,patternRows:1,sourceStart:2,sourceEnd:2,sourceRows:1,swatchASt:1,swatchARows:1});assert.equal(x.A.targetRows,1);
});
test('負の幅調整で非正長になると拒否する',()=>{assert.throws(()=>E.calculate({...D,sourceStart:2,ease:-10}),/正数/);});
test('負の総段数を拒否する',()=>assert.throws(()=>E.calculate({...D,sourceRows:-1}),/段数/));
test('数字でないゲージを拒否する',()=>assert.throws(()=>E.calculate({...D,swatchASt:'oops'}),/目数/));
test('模様の余りが倍数以上なら拒否する',()=>assert.throws(()=>E.calculate({...D,multiple:2,offset:2}),/余り/));
test('整数以外の目数を拒否する',()=>assert.throws(()=>E.calculate({...D,sourceStart:21.2}),/整数/));
test('大きすぎる段数変換を拒否する',()=>assert.throws(()=>E.calculate({...D,patternRows:1,swatchARows:160,sourceRows:1200}),/上限|以内/));
test('反復候補の同点時は小さい方',()=>assert.equal(E.nearestValid(10,4,0),8));
test('偶奇指定で該当しない候補は例外',()=>assert.throws(()=>E.nearestValid(10,2,0,1),/候補/));
test('不正な左右対称差を拒否する',()=>assert.throws(()=>E.schedule(20,21,8,2),/偶数/));
test('段の候補がない計画を拒否する',()=>assert.throws(()=>E.schedule(20,22,1,2),/使える段/));
test('全イベントの目数が0以上で終点に一致する',()=>{
  for(let start=8;start<=24;start+=2) for(let end=8;end<=24;end+=2) for(const step of [1,2,4]){
    const s=E.schedule(start,end,36,step);assert.equal(s.timeline.at(-1).after,end);assert(s.timeline.every(x=>x.after>=2));
  }
});
