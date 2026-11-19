'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function tiny(deck, hand, groups) { return {deck,hand,turns:2,drawPerTurn:1,groups}; }
function brute(cfg, n) {
  const cards = [];
  cfg.groups.forEach((g, i) => { for (let j = 0; j < g.count; j++) cards.push(i); });
  for (let i = cards.length; i < cfg.deck; i++) cards.push(-1);
  let yes = 0, total = 0;
  function visit(pos, seen) {
    if (seen.length === n) {
      total++;
      if (cfg.groups.every((g,i)=>{const x=seen.filter(v=>v===i).length;return x>=g.min&&x<=g.max;})) yes++;
      return;
    }
    for (let i = pos; i <= cards.length - (n-seen.length); i++) visit(i+1,[...seen,cards[i]]);
  }
  visit(0,[]); return yes/total;
}
test('binomial coefficients and impossible arguments', () => {
  assert.equal(E.choose(5,0),1); assert.equal(E.choose(5,2),10);
  assert.equal(E.choose(10,10),1); assert.equal(E.choose(5,6),0);
  assert.equal(E.choose(-1,0),0); assert.equal(E.choose(3,1.2),0);
  close(E.choose(100,3),161700);
});
test('empty condition probability is one',()=>{
  const c=tiny(10,5,[{name:'zero',count:0,min:0,max:200}]);
  for(let n=0;n<=10;n++)close(E.probability(c,n),1);
});
test('single-card probability exact',()=>{
  const c=tiny(60,7,[{name:'A',count:4,min:1,max:200}]);
  close(E.probability(c,7),1-E.choose(56,7)/E.choose(60,7));
});
test('sample two-group hand, no overlap',()=>{
  const c=tiny(10,2,[{name:'A',count:2,min:1,max:200},{name:'B',count:3,min:1,max:200}]);
  close(E.probability(c,2),6/45);
});
test('bounded maximum causes nonmonotone curves',()=>{
  const c=tiny(10,2,[{name:'A',count:10,min:0,max:1}]);
  close(E.probability(c,1),1);
  close(E.probability(c,2),0);
});
test('zero categories, impossible constraints and drawn zero',()=>{
  const c=tiny(5,2,[{name:'A',count:0,min:1,max:200}]);
  close(E.probability(c,2),0);
  close(E.probability(c,0),0);
});
test('drawing entire deck obeys all maximums',()=>{
  const c=tiny(10,2,[{name:'A',count:5,min:2,max:4}]);
  close(E.probability(c,10),0);
});
test('validation rejects broken inputs',()=>{
  const c=E.configureDefaults();
  for(const v of [0,201,1.1,NaN])assert.throws(()=>E.validate({...c,deck:v}));
  assert.throws(()=>E.validate({...c,hand:61}));
  assert.throws(()=>E.validate({...c,groups:[...c.groups,{name:'4',count:5,min:0,max:3},{name:'5',count:2,min:0,max:2}]}));
  assert.throws(()=>E.validate({...c,groups:[{name:'too many',count:61,min:0,max:200}]}));
  assert.throws(()=>E.validate({...c,groups:[{name:'A',count:5,min:2,max:1}]}));
  assert.throws(()=>E.validate({...c,groups:[{name:'A',count:-1,min:0,max:1}]}));
});
test('same-hand one optional full redraw conditional',()=>{
  close(E.fullRedraw(0.3),0.51);
  close(E.fullRedraw(0),0);close(E.fullRedraw(1),1);
  assert.throws(()=>E.fullRedraw(-0.01));
});
test('suggestions keep deck fixed and sorted',()=>{
  const c=E.configureDefaults();
  const arr=E.suggestions(c);
  assert.equal(arr.length,6);
  assert.ok(arr.every(v=>Math.abs(v.baseline-E.probability(c,c.hand))<1e-12));
  for(let i=1;i<arr.length;i++)assert.ok(arr[i].delta<=arr[i-1].delta +1e-15);
  const packed=tiny(5,2,[{name:'A',count:5,min:0,max:200}]);
  assert.ok(E.suggestions(packed).every(s=>s.step===-1));
});
test('curve respects capped deck draw count',()=>{
  const c=tiny(5,4,[{name:'A',count:2,min:1,max:200}]);
  c.turns=5;c.drawPerTurn=2;
  assert.equal(E.curve(c).length,6);
  assert.deepEqual(E.curve(c).map(x=>x.seen),[4,5,5,5,5,5]);
});
test('draw sample uses deterministic valid Fisher-Yates',()=>{
  const c=tiny(10,4,[{name:'A',count:4,min:1,max:3}]);
  const v=E.drawSample(c,4,()=>0);
  assert.deepEqual(v.counts,[4]);assert.equal(v.other,0);assert.equal(v.accepted,false);
  assert.throws(()=>E.drawSample(c,3,()=>1));
});
test('full brute force check over independent bounded categories (hundreds of configurations)',()=>{
  let total=0;
  for(let deck=4;deck<=10;deck++){
    for(let first=0;first<=Math.min(deck,3);first++){
      for(let second=0;second<=Math.min(deck-first,3);second++){
        const cfg=tiny(deck,Math.min(deck,3),[
          {name:'A',count:first,min:first?1:0,max:first?Math.min(first,2):0},
          {name:'B',count:second,min:0,max:second?Math.min(1,second):0}
        ]);
        for(let n=0;n<=Math.min(deck,5);n++) {close(E.probability(cfg,n),brute(cfg,n),2e-12);total++;}
      }
    }
  }
  assert.ok(total>=500,`only ${total} checked`);
});
