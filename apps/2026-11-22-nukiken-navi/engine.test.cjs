const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
function choose(n,k){if(k<0||k>n)return 0;let p=1;for(let i=1;i<=Math.min(k,n-k);i++)p=p*(n-i+1)/i;return p;}
function brute(N,D,n,c){let sum=0;for(let k=0;k<=c;k++)sum+=choose(D,k)*choose(N-D,n-k)/choose(N,n);return sum;}
const approx = (x,y,eps=1e-8)=>assert.ok(Math.abs(x-y)<eps, `${x} ≠ ${y}`);
test('without-replacement simple probabilities',()=>{
 approx(E.acceptProbability(10,1,2,0),.8);
 approx(E.acceptProbability(10,1,2,1),1);
 approx(E.acceptProbability(10,10,2,0),0);
 approx(E.acceptProbability(10,0,2,0),1);
 approx(E.acceptProbability(10,5,10,4),0);
 approx(E.acceptProbability(10,5,10,5),1);
});
test('strict plan validation',()=>{
 const p={N:100,n:10,c:1,good:1,bad:7,minutes:1,target:5};
 assert.deepEqual(E.validatePlan(p),p);
 for(const q of [{N:1},{n:501},{n:101},{n:1.5},{c:11},{good:7,bad:7},{good:10,bad:5},{target:0},{minutes:0},{N:'abc'}])
  assert.throws(()=>E.validatePlan({...p,...q}));
});
test('rounded defect count and metrics labels',()=>{
 assert.equal(E.defectsForPct(101,1),1);
 const p=E.metrics({N:100,n:10,c:0,good:0,bad:10,minutes:2,target:5});
 assert.equal(p.goodD,0);assert.equal(p.badD,10);assert.equal(p.estimatedMinutes,20);assert.equal(p.producerRisk,0);
});
test('exact oracle exhaustive for all small N, D, n, c',()=>{
 let count=0;
 for(let N=2;N<=19;N++)for(let D=0;D<=N;D++)for(let n=1;n<=N;n++)for(let c=0;c<=n;c++){
  approx(E.acceptProbability(N,D,n,c),brute(N,D,n,c));count++;
 }
 assert.ok(count>20000);
});
test('cdf monotonic in acceptance limit',()=>{
 for(let N=3;N<=80;N+=7)for(let D=0;D<=N;D+=3)for(let n=1;n<=Math.min(N,40);n+=4){
  let previous=0;
  for(let c=0;c<=n;c++) {const x=E.acceptProbability(N,D,n,c);assert.ok(x+1e-9>=previous);previous=x;}
 }
});
test('cdf monotonic in defect count',()=>{
 for(let N=10;N<=120;N+=10)for(const n of [1,5,10])for(const c of [0,1,2]){
  if(n>N||c>n)continue;
  let previous=1;
  for(let D=0;D<=N;D++){const x=E.acceptProbability(N,D,n,c);assert.ok(x<=previous+1e-9);previous=x;}
 }
});
test('minimum sample is globally first within range',()=>{
 const p={N:100,n:12,c:0,good:1,bad:10,minutes:1,target:5};
 const got=E.minimumSample(p);assert.ok(got);assert.ok(got.risk<=.05);
 for(let n=1;n<got.n;n++)assert.ok(E.acceptProbability(100,10,n,0)>.05);
 assert.equal(E.minimumSample({...p,good:0,bad:.1,target:.1}),null);
});
test('Floyd draw distinct, range, complete census, adversarial random',()=>{
 for(let N=2;N<80;N++)for(let n=1;n<=Math.min(N,25);n++){
   for(let kind=0;kind<3;kind++){
    const r=E.pickIds(N,n,j=>kind===0?0:kind===1?j-1:Math.floor(j*.43));
    assert.equal(r.length,n);assert.equal(new Set(r).size,n);assert.ok(r.every(x=>x>=1&&x<=N));
   }
 }
 assert.deepEqual(E.pickIds(5,5,()=>0),[1,2,3,4,5]);
 assert.throws(()=>E.pickIds(20,3,()=>-1));
});
test('inspection always pending until all done',()=>{
 assert.deepEqual(E.assessment(['pending','ok','bad'],1),{bad:1,ok:1,pending:1,decision:'未確定'});
 assert.equal(E.assessment(['ok','bad','ok'],1).decision,'合格');
 assert.equal(E.assessment(['bad','bad','ok'],1).decision,'不合格');
 assert.throws(()=>E.assessment(['unknown'],0));
});
test('CSV escaping and header',()=>{
 const s=E.exportCsv([5,2],['ok','pending'],0);assert.match(s,/抽出番号,検査状態,全体判定/);assert.match(s,/5,良,未確定/);assert.ok(s.startsWith('\uFEFF'));
});
test('curve supports 31 monotonic plot points',()=>{
 const rows=E.curve({N:240,n:32,c:0,good:1,bad:9,minutes:1.5,target:5});
 assert.equal(rows.length,31);for(let i=1;i<rows.length;i++){assert.ok(rows[i].rate>rows[i-1].rate);assert.ok(rows[i].p<=rows[i-1].p+1e-9);}
});
