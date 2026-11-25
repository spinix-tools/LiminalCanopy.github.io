const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const core=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const {list,num,gears,rpm,point,cost,cmp,plus,solve,greedy,summarize}=vm.runInNewContext(core+'\n;({list,num,gears,rpm,point,cost,cmp,plus,solve,greedy,summarize})');
const c={w:2,lo:75,target:85,hi:95,rearCost:12,frontCost:40};
let fixed=0;function check(f){f();fixed++}
check(()=>assert.equal(rpm(24,2,{f:40,r:20}),100));
check(()=>assert.equal(gears([50,34],[11,15,20],1).length,4));
check(()=>assert.throws(()=>gears([40],[11,11],0)));
check(()=>assert.throws(()=>gears([40],[11,12],1)));
check(()=>assert.throws(()=>list('',1,80,120)));
check(()=>assert.throws(()=>num('',0,1000)));
check(()=>assert.equal(solve([20],gears([40],[20],0),c).rear,0));
check(()=>assert.equal(solve([20,20],gears([40],[20],0),c).score[0],0));
check(()=>assert.equal(solve([80],gears([40],[20],0),c).score[0],1));
let seed=123;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n};
for(let t=0;t<240;t++){const gs=gears(t%2?[34,50]:[42],[12,18,25],t%2?1:0),vs=Array.from({length:1+rand(5)},()=>10+rand(36)),cfg={...c,rearCost:rand(50),frontCost:rand(80)};let best=null;function walk(path){if(path.length===vs.length){let score=[0,0,0];for(let k=0;k<path.length;k++){const g=gs[path[k]],x=vs[k]*1000/60/cfg.w*g.r/g.f,o=Math.max(cfg.lo-x,x-cfg.hi,0);score[0]+=+(o>1e-9);score[1]+=Math.round(o*100);score[2]+=Math.round(Math.abs(x-cfg.target)*100);if(k){const h=gs[path[k-1]];score[2]+=Math.round(100*(Math.abs(h.j-g.j)*cfg.rearCost+ +(h.i!==g.i)*cfg.frontCost))}}if(!best||cmp(score,best)<0)best=score;return}for(let j=0;j<gs.length;j++)walk([...path,j])}walk([]);const p=solve(vs,gs,cfg);assert.equal(cmp(p.score,best),0);assert.ok(cmp(p.score,greedy(vs,gs,cfg).score)<=0)}
const max=solve(Array.from({length:120},(_,i)=>10+i%50),gears([34,50],Array.from({length:14},(_,i)=>10+i*2),0),c);assert.equal(max.rows.length,120);
console.log(`${fixed} fixed + 240 exhaustive + max 120×28 passed`);
