const test=require('node:test'), assert=require('node:assert/strict');
const E=require('./engine.js');
const q=(id,topic,seconds,attempts=0,correct=0,lastUsed='')=>({id,topic,prompt:'問題 '+id,answer:'答え '+id,seconds,difficulty:2,attempts,correct,lastUsed});
test('sample contains multiple subjects',()=>assert.ok(new Set(E.sampleBank().map(x=>x.topic)).size>=3));
test('invalid missing prompt rejected',()=>assert.throws(()=>E.parseQuestion({...q('a','理科',40),prompt:''}))); 
test('invalid bank duplicate id rejected',()=>assert.throws(()=>E.validateBank([q('a','X',30),q('a','Y',45)])));
test('invalid bank over max rejected',()=>assert.throws(()=>E.validateBank(Array.from({length:301},(_,i)=>q('x'+i,'Y',30)))));
test('invalid date rejected',()=>assert.equal(E.dateValid('2026-02-30'),false));
test('leap date accepted',()=>assert.equal(E.dateValid('2028-02-29'),true));
test('day diff leap boundary',()=>assert.equal(E.dayDiff('2028-02-28','2028-03-01'),2));
test('empty topic list gives no selected questions',()=>assert.equal(E.plan([q('a','X',30)],{topics:[]}).questions.length,0));
test('plan respects count',()=>assert.equal(E.plan([q('a','X',30),q('b','Y',30)],{count:1,minutes:2}).questions.length,1));
test('plan respects seconds budget',()=>assert.equal(E.plan([q('a','X',100),q('b','Y',100)],{minutes:1}).questions.length,0));
test('plan avoids duplicate',()=>assert.equal(new Set(E.plan([q('a','X',20),q('b','X',20)],{minutes:5}).questions.map(x=>x.id)).size,2));
test('plan encourages subject coverage',()=>{const xs=Array.from({length:4},(_,i)=>q('a'+i,'A',30,20,0,'2026-01-01')).concat([q('b','B',30,20,2,'2026-01-01')]);assert.equal(new Set(E.plan(xs,{count:2,minutes:5,asOf:'2026-11-21'}).questions.map(x=>x.topic)).size,2);});
test('plan sorts by weak performance if same subject',()=>{const v=[q('good','A',40,20,20,'2026-11-01'),q('bad','A',40,20,2,'2026-11-01')];assert.equal(E.plan(v,{count:1,minutes:2,asOf:'2026-11-21'}).questions[0].id,'bad');});
test('recently used suppressed with same other attributes',()=>{const v=[q('recent','A',40,20,10,'2026-11-20'),q('old','A',40,20,10,'2026-11-01')];assert.equal(E.plan(v,{count:1,minutes:2,asOf:'2026-11-21'}).questions[0].id,'old');});
test('wrong/correct count aggregated',()=>{let z=E.recordAggregate([q('a','A',40,10,4)],'a',20,15,'2026-11-21');assert.equal(z[0].attempts,30);assert.equal(z[0].correct,19);assert.equal(z[0].lastUsed,'2026-11-21');});
test('cannot count correct > attempts',()=>assert.throws(()=>E.recordAggregate([q('a','A',40)],'a',3,4,'2026-11-21')));
test('cannot record unknown ID',()=>assert.throws(()=>E.recordAggregate([q('a','A',40)],'b',3,2,'2026-11-21')));
test('CSV escapes quotes/newline',()=>assert.equal(E.csvCell('"a\nb"'),'"""a\nb"""'));
test('CSV formula injection neutralized',()=>assert.equal(E.csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"'));
test('CSV prefix + and - neutralized',()=>{assert.equal(E.csvCell('+2'),'"\'+2"');assert.equal(E.csvCell('-2'),'"\'-2"');});
test('JSON round trip retains bank',()=>assert.deepEqual(E.validateBank(JSON.parse(JSON.stringify(E.sampleBank()))),E.sampleBank()));
test('random 750 plans satisfy count, time, uniqueness and scope',()=>{
  for(let s=1;s<=750;s++){
    const list=Array.from({length:1+s%22},(_,i)=>q('q'+i,'T'+i%5,15+(i*31+s*7)%160,(i*4)%50,(i*4)%50,'2026-11-01'));
    const count=1+s%25,minutes=1+s%12,chosen=['T0','T1','T2'];
    const v=E.plan(list,{count,minutes,asOf:'2026-11-21',topics:chosen});
    assert.ok(v.questions.length<=count);assert.ok(v.seconds<=minutes*60);
    assert.equal(v.seconds,v.questions.reduce((a,b)=>a+b.seconds,0));
    assert.equal(new Set(v.questions.map(x=>x.id)).size,v.questions.length);
    assert.ok(v.questions.every(x=>chosen.includes(x.topic)));
  }
});
