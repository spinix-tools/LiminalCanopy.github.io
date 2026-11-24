const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {parseData,evaluate,solve}=vm.runInNewContext(fs.readFileSync(__dirname+'/index.html','utf8').split('<script id="core">')[1].split('</script>')[0]+'\n({parseData,evaluate,solve})');
const c={pmin:10,pmax:10.04,gmin:.15,gmax:.35,err:.02,current:10.25};
const rows=parseData('9.5,9.22,9.28\n10,9.72,9.78\n10.5,10.25,10.31\n11,10.76,10.83');
const r=solve(rows,c);assert.equal(r.best.x,10.49);assert.equal(r.count,5);assert.equal(r.all.length,151);assert.equal(r.current.ok,false);assert.equal(evaluate(rows,12,c),null);assert.equal(solve(rows,{...c,err:1}).count,0);assert.throws(()=>parseData('10,9,8\n11,10,11'));assert.throws(()=>parseData('10,9,10\n10,9,10'));assert.throws(()=>solve(rows,{...c,pmax:9}));assert.throws(()=>solve(parseData('1.001,1,1\n1.002,1,1'),c));
let seed=24601;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);let comparisons=0;
for(let j=0;j<300;j++){
 const a=[9,9.5,10,10.5,11].map(x=>{let m=x-.5+rand();return [x,m,m+rand()*.2]});const v={...c,err:rand()*.12,current:9+rand()*2};const z=solve(a,v);let best=-Infinity,count=0;
 for(let k=900;k<=1100;k++){const x=k/100,idx=Math.min(3,Math.floor((x-9)*2)),t=(x-a[idx][0])*2;let min=Infinity,max=-Infinity;for(const p of [v.pmin,v.pmax])for(const e of [-v.err,v.err])for(const q of [1,2]){const d=(1-t)*a[idx][q]+t*a[idx+1][q]+e-p;min=Math.min(min,d);max=Math.max(max,d);}const margin=Math.min(min-v.gmin,v.gmax-max);const out=z.all[k-900];assert.ok(Math.abs(out.lo-min)<1e-9&&Math.abs(out.hi-max)<1e-9);assert.equal(out.ok,margin>=-1e-9);best=Math.max(best,margin);count+=margin>=-1e-9;comparisons++;}assert.ok(Math.abs(z.best.margin-best)<1e-9);assert.equal(z.count,count);
}
console.log('10 fixed assertions; 300 randomized cases; '+comparisons+' independent endpoint comparisons passed');
