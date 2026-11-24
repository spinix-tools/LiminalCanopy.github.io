const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({});vm.runInContext(fs.readFileSync(__dirname+'/index.html','utf8').match(/<script id="core">([\s\S]*?)<\/script>/)[1],c);const {distribution,ways,difference,search}=vm.runInContext('({distribution,ways,difference,search})',c);
function brute(ds,m){let a=[m];for(const s of ds)a=a.flatMap(x=>Array.from({length:s},(_,i)=>x+i+1));return a;}
let seed=537;function rand(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;}
for(let i=0;i<200;i++){const ds=Array.from({length:1+rand(3)},()=>2+rand(9)),m=rand(11)-5,d=distribution(ds,m),a=brute(ds,m);assert.equal(d.den,a.length);for(let t=-6;t<=36;t++)assert.equal(ways(d,t),a.filter(x=>x>=t).length);}
assert.equal(search(distribution([6]),[0,1,0,0,0,0],1,0)[0].gap,0);
assert.equal(search(distribution([6]),[0,0,0,0,0,0],4,20).length,0);
const rows=search(distribution([20]),[0,4,0,0,0,0],4,8);assert.equal(rows.length,68);assert.equal(rows[0].name,'4d6-3');assert.equal(rows[0].gap,0.20277777777777778);
// Independent ordered dice enumeration; canonicalize unordered pools and enumerate corrections.
let compared=0;for(let i=0;i<50;i++){const a=brute([2+rand(11),2+rand(5)],rand(5)-2),target=distribution([2],0); // reconstruct target from direct counts
const lo=Math.min(...a),hi=Math.max(...a),counts=Array.from({length:hi-lo+2},(_,j)=>a.filter(x=>x>=lo+j).length);Object.assign(target,{lo,hi,den:a.length,mod:lo,tail:counts});
const stock=[rand(3),rand(3),0,0,0,0];if(!stock[0]&&!stock[1])stock[0]=1;const cap=1+rand(3),lim=2,actual=search(target,stock,cap,lim);let expected=[];
for(let x=0;x<=stock[0];x++)for(let y=0;y<=stock[1];y++)if(x+y>0&&x+y<=cap)for(let m=-lim;m<=lim;m++){const b=brute([...Array(x).fill(4),...Array(y).fill(6)],m);let gap=0;for(let t=-10;t<=30;t++)gap=Math.max(gap,Math.abs(a.filter(v=>v>=t).length/a.length-b.filter(v=>v>=t).length/b.length));const name=(x?x+'d4':'')+(x&&y?'+':'')+(y?y+'d6':'')+(m>0?'+'+m:m<0?String(m):'');expected.push({name,gap});}
assert.equal(actual.length,expected.length);for(const r of actual){const e=expected.find(x=>x.name===r.name);assert.ok(e);assert.ok(Math.abs(r.gap-e.gap)<1e-12);compared++;}assert.ok(Math.abs(actual[0].gap-Math.min(...expected.map(x=>x.gap)))<1e-12);}
const max=search(distribution([100,100,100,100],20),[4,4,4,4,4,4],4,20);assert.equal(max.length,8569);assert.ok(max.every(x=>Number.isSafeInteger(x.peak)));console.log('200 distribution cases; 50 independent search cases / '+compared+' candidates; fixed sample and maximum 8569 candidates: PASS');
