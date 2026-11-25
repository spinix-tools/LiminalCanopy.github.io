const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const html=fs.readFileSync(__dirname+'/index.html','utf8');const ctx=vm.createContext({});vm.runInContext(html.match(/<script id="core">([\s\S]*?)<\/script>/)[1]+'\nthis.api={parse,solve,rows,makeCSV}',ctx);const {parse,solve,rows,makeCSV}=ctx.api;
const track=(d,w,req=false,side='自由')=>({name:'x',d,w,req,side});
assert.equal(solve([track(10,1,true)],9,9,0),null);
assert.equal(solve([track(10,1,true,'B'),track(10,1,true,'A')],30,30,0),null);
assert.equal(solve([track(10,1,true),track(10,1,true)],23,0,3).x.time,23);
assert.equal(solve([track(10,1,true),track(10,1,true)],22,0,3),null);
assert.equal(solve([track(10,1)],0,0,3).score,0);
assert.throws(()=>parse('x | 1:60 | 1 | 任意 | 自由'));
assert.equal(parse('x | 1:00 | 5 | 必須 | A')[0].d,60);
assert.ok(makeCSV([{...track(10,1),name:'=1+1'}],solve([track(10,1)],10,0,0),0).includes("'=1+1"));
let seed=23;const rand=n=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)%n);function brute(t,a,b,g){let best=null;function walk(i,phase,A,B,s){if(i===t.length){const v=[s,A+B,-Math.abs(a-A-b+B)];if(!best||v[0]>best[0]||v[0]===best[0]&&(v[1]>best[1]||v[1]===best[1]&&v[2]>best[2]))best=v;return}const x=t[i];if(!x.req)walk(i+1,phase,A,B,s);let u=A+x.d+(A?g:0),v=B+x.d+(B?g:0);if(!phase&&x.side!=='B'&&u<=a)walk(i+1,0,u,B,s+x.w);if(x.side!=='A'&&v<=b)walk(i+1,1,A,v,s+x.w)}walk(0,0,0,0,0);return best}
for(let j=0;j<400;j++){const t=Array.from({length:1+rand(8)},()=>track(1+rand(20),1+rand(9),rand(5)===0,['自由','A','B'][rand(3)])),a=rand(60),b=rand(60),g=rand(5),p=solve(t,a,b,g),q=brute(t,a,b,g);assert.deepEqual(p?[p.score,p.time,-p.delta]:null,q);if(p){const A=rows(t,p.x.mask,g),B=rows(t,p.y.mask,g);assert.equal(A.at(-1)?.end||0,p.x.time);assert.equal(B.at(-1)?.end||0,p.y.time);assert.equal(p.x.mask&p.y.mask,0);assert.ok(t.every((x,i)=>!x.req||((p.x.mask|p.y.mask)&(1<<i))))}}
assert.ok(solve(Array.from({length:30},()=>track(120,1)),3600,3600,3));console.log('8 fixed + 400 exhaustive comparisons + max input passed');
