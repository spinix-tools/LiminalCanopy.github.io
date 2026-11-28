const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/index.html','utf8');const ctx=vm.createContext({});vm.runInContext(html.match(/<script id="core">([\s\S]*?)<\/script>/)[1],ctx);const {audit,cpp}=ctx;
let seed=24601;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
for(let i=0;i<200;i++){
 const n=2+Math.floor(rnd()*5),rs=Array.from({length:n},()=>100+Math.floor(rnd()*30000)),rp=100+Math.floor(rnd()*20000),t=Math.floor(rnd()*10),bits=[8,10,12][i%3],noise=i%6,a=audit(rs,rp,t,bits,noise),max=2**bits-1;
 for(const s of a.states){const active=rs.filter((_,j)=>s.mask&(1<<j)),all=[];for(let k=0;k<2**(active.length+1);k++){const rr=rp*(1+(k&1?1:-1)*t/100);const g=active.reduce((sum,r,j)=>sum+1/(r*(1+(k&(2<<j)?1:-1)*t/100)),0);const code=Math.min(max,Math.floor(2**bits/(1+rr*g)));all.push(code)}assert.equal(s.lo,Math.max(0,Math.min(...all)-noise));assert.equal(s.hi,Math.min(max,Math.max(...all)+noise));}
 for(let c=0;c<=max;c++){const ref=a.states.filter(s=>s.lo<=c&&c<=s.hi).map(s=>s.mask);assert.equal(a.codes[c].join(','),ref.join(','));assert.equal(a.segments.find(s=>s.lo<=c&&c<=s.hi).mask,ref.length===1?ref[0]:-1)}
}
const same=audit([1000,1000],1000,0,10,0);assert.equal(same.pairs,1);assert.equal(same.codes[512].length,2);assert.equal(same.states[0].nominal,1023);assert.match(cpp(same),/return -1/);assert.throws(()=>audit([0,1000],1000,1,10,2));assert.throws(()=>audit([1000,2000],1000,1,9,2));assert.equal(audit(Array(8).fill(1000),1000,1,12,2).states.length,256);
const a=audit([1000,2200,4700,10000],10000,1,10,2),b=audit([1000,2000,4000,8000],1000,1,10,2);console.log('200 corner-enumeration and decoder cases passed; 7 fixed assertions passed');console.log('sample',a.unique,a.pairs,a.ambiguousCodes,'alternate',b.unique,b.pairs,b.ambiguousCodes);
