const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(__dirname+'/index.html','utf8').match(/<script id="core">([\s\S]*?)<\/script>/)[1],ctx);const {parse,solve}=ctx;
const row=(m,t=100,d=1,u=0)=>({name:'mark',m,t,d,u});
assert.equal(solve([row(98)],100,90,110,1).best.p,102);
assert.equal(solve([row(98),row(102)],100,90,110,1).feasible,0);
assert.equal(solve([row(100,100,0,0)],100,90,110,1).feasible,1);
assert.equal(solve([row(100,100,0,0.1)],100,90,110,1).feasible,0);
assert.equal(solve([row(100)],100,90.1,90.2,1).best,null);
assert.equal(solve([row(100)],100,100,100,.1).best.p,100);
assert.throws(()=>parse('a\t100\t0\t1\t0'));
assert.throws(()=>parse('a\t100\t100\t1\t100'));
assert.throws(()=>parse('a\t100\t100\t\t0'));
assert.throws(()=>solve([row(100)],100,110,90,1));
let seed=77;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
for(let n=0;n<500;n++){const base=90+Math.floor(rand()*21),lo=90,hi=110,step=[.1,.5,1][n%3];const rows=Array.from({length:1+Math.floor(rand()*8)},()=>{const t=20+rand()*200;return row(t*(.95+rand()*.1),t,rand()*3,rand()*.4)});const got=solve(rows,base,lo,hi,step);let ref=[];for(let i=0;i<=Math.round((hi-lo)/step);i++){const p=Number((lo+i*step).toFixed(6));const error=Math.max(...rows.flatMap(r=>[-1,1].map(sign=>Math.max(0,Math.abs((r.m+sign*r.u)*p/base-r.t)-r.d))));ref.push({p,error});}ref.sort((a,b)=>a.error-b.error||Math.abs(a.p-base)-Math.abs(b.p-base)||a.p-b.p);assert.equal(got.feasible,ref.filter(x=>x.error<=1e-9).length);assert.ok(Math.abs(got.best.loss-ref[0].error)<1e-8);if(got.feasible)assert.equal(got.best.p,ref[0].p);}
assert.equal(solve(Array.from({length:100},()=>row(100)),100,10,400,.1).best.p,100);
console.log('PASS: 11 fixed assertions + 500 generated cases');
