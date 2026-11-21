const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('./engine.js');
const one=(options=[{label:'はい',next:'END'}])=>({version:1,name:'ok',start:'q1',questions:[{id:'q1',title:'最初',minutes:1,options}]});
test('デモは到達不能を含む',()=>assert.ok(E.audit(E.demo()).issues.some(i=>i.code==='UNREACHABLE')));
test('デモの繰返しを発見',()=>assert.ok(E.audit(E.demo()).issues.some(i=>i.code==='CYCLE')));
test('デモの完了経路もある',()=>assert.ok(E.audit(E.demo()).stats.finished>0));
test('単一質問は1経路で完了',()=>{const r=E.audit(one());assert.equal(r.stats.finished,1);assert.equal(r.stats.shortest,1);assert.equal(r.stats.issueErrors,0);});
test('最長は分岐経路の問数',()=>{const p=one([{label:'短',next:'END'},{label:'長',next:'q2'}]);p.questions.push({id:'q2',title:'続き',minutes:2,options:[{label:'終',next:'END'}]});const s=E.audit(p).stats;assert.equal(s.shortest,1);assert.equal(s.longest,2);assert.equal(s.timeMax,3);});
test('終了が存在しない循環でNO_EXIT',()=>{const r=E.audit(one([{label:'戻る',next:'q1'}]));assert.ok(r.issues.some(x=>x.code==='NO_EXIT'));});
test('終わりのある循環はNO_EXITではない',()=>{const r=E.audit(one([{label:'戻る',next:'q1'},{label:'終',next:'END'}]));assert.ok(!r.issues.some(x=>x.code==='NO_EXIT'));assert.ok(r.issues.some(x=>x.code==='CYCLE'));});
test('行き先不明はエラー',()=>{const r=E.audit(one([{label:'未設定',next:'gone'}]));assert.ok(r.issues.some(x=>x.code==='BROKEN_EDGE'));});
test('空の選択肢名',()=>{const r=E.audit(one([{label:'',next:'END'}]));assert.ok(r.issues.some(x=>x.code==='EMPTY_CHOICE'));});
test('選択肢名重複',()=>{const r=E.audit(one([{label:'A',next:'END'},{label:'A',next:'END'}]));assert.ok(r.issues.some(x=>x.code==='DUPLICATE_CHOICE'));});
test('開始ID不正',()=>{const p=one();p.start='q9';assert.ok(E.audit(p).issues.some(x=>x.code==='INVALID_START'));});
test('孤立した質問を発見',()=>{const p=one();p.questions.push({id:'q2',title:'孤立',minutes:1,options:[{label:'終',next:'END'}]});assert.ok(E.audit(p).issues.some(x=>x.code==='UNREACHABLE'));});
test('余分なIDを拒否',()=>{const p=one();p.questions[0].id='bad id';assert.throws(()=>E.clean(p));});
test('重複IDを拒否',()=>{const p=one();p.questions.push({...p.questions[0]});assert.throws(()=>E.clean(p));});
test('31件を拒否',()=>{const p=one();p.questions=Array(31).fill(p.questions[0]);assert.throws(()=>E.clean(p));});
test('6択を拒否',()=>{const p=one();p.questions[0].options=Array(6).fill({label:'A',next:'END'});assert.throws(()=>E.clean(p));});
test('負の時間を拒否',()=>{const p=one();p.questions[0].minutes=-1;assert.throws(()=>E.clean(p));});
test('NaN時間を拒否',()=>{const p=one();p.questions[0].minutes='nope';assert.throws(()=>E.clean(p));});
test('CSVの引用符をエスケープ',()=>{const p=one([{label:'はい,"OK"',next:'END'}]);assert.ok(E.csvReport(E.audit(p)).includes('""OK""'));});
test('JSONのクリーンな往復',()=>{const p=E.demo();assert.deepEqual(E.clean(JSON.parse(JSON.stringify(p))),p);});
test('到達可能な終点なしなら完了0件',()=>assert.equal(E.audit(one([{label:'不明',next:''}])).stats.finished,0));
test('すべてのCASEで完了か停止',()=>{const s=E.audit(E.demo());assert.ok(s.cases.every(c=>['end','loop','broken'].includes(c.status)));});
test('150件以上は切り詰め',()=>{let p=one();p.questions=[];for(let i=1;i<=8;i++)p.questions.push({id:'q'+i,title:'Q',minutes:1,options:[{label:'A',next:i===8?'END':'q'+(i+1)},{label:'B',next:i===8?'END':'q'+(i+1)}]});const r=E.audit(p);assert.equal(r.cases.length,E.MAX_CASES);assert.equal(r.truncated,true);});
test('終点のない部分枝を別判定',()=>{const p=one([{label:'終',next:'END'},{label:'漏れ',next:'q2'}]);p.questions.push({id:'q2',title:'閉路',minutes:1,options:[{label:'巡る',next:'q2'}]});const r=E.audit(p);assert.ok(r.issues.some(i=>i.code==='NO_EXIT'&&i.id==='q2'));assert.ok(!r.issues.some(i=>i.code==='NO_EXIT'&&i.id==='q1'));});
test('入力の安全な文字列化と長さ制限',()=>{const p=one();p.questions[0].title='a'.repeat(200);assert.equal(E.clean(p).questions[0].title.length,160);});
test('乱数固定500ケース: 到達・経路・終点の計数整合',()=>{
 let seed=20261122;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
 for(let t=0;t<500;t++){
   const n=1+Math.floor(rnd()*14),q=[];
   for(let i=0;i<n;i++){
     const opts=[];
     for(let j=0,num=1+Math.floor(rnd()*4);j<num;j++){
       const choice=Math.floor(rnd()*(n+2));
       opts.push({label:'選択'+j,next:choice===n?'END':choice===n+1?'':`q${choice+1}`});
     }
     q.push({id:`q${i+1}`,title:'Q'+i,minutes:Math.floor(rnd()*5),options:opts});
   }
   const p={name:'random',start:'q1',questions:q};
   const r=E.audit(p),mp=new Map(q.map(z=>[z.id,z]));
   const reached=new Set(),stack=['q1'];
   while(stack.length){const id=stack.pop();if(reached.has(id))continue;reached.add(id);for(const o of mp.get(id).options){if(mp.has(o.next)&&!reached.has(o.next))stack.push(o.next);}}
   assert.deepEqual(new Set(r.reachable),reached);
   assert.equal(r.stats.questions,n);
   assert.equal(r.stats.finished,r.cases.filter(c=>c.status==='end').length);
   assert.ok(r.cases.length<=E.MAX_CASES);
   for(const c of r.cases){
     assert.ok(['end','loop','broken'].includes(c.status));
     for(const step of c.path){assert.ok(mp.has(step.id));assert.ok(mp.get(step.id).options.some(o=>o.label===step.answer));}
     assert.ok(c.minutes>=0);
     if(c.status==='end')assert.equal(mp.get(c.path.at(-1).id).options[c.path.at(-1).option].next,'END');
   }
 }
});
