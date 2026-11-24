const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(__dirname+'/index.html','utf8').match(/<script id="core">([\s\S]*?)<\/script>/)[1]+';this.odds=odds;this.swaps=swaps;',ctx);
const {odds,swaps}=ctx;
function brute(c,d,r){const deck=c.flatMap((n,i)=>Array(n).fill(i));let all=0,shared=0,distinct=0;const hand=[];const roles=r.flatMap((n,i)=>Array(n).fill(1<<i));function assign(i,used){if(i===roles.length)return true;return hand.some((m,j)=>(m&roles[i])&&!(used&(1<<j))&&assign(i+1,used|(1<<j)))}function walk(start){if(hand.length===d){all++;if(r.every((n,i)=>hand.filter(m=>m&(1<<i)).length>=n))shared++;if(assign(0,0))distinct++;return}for(let i=start;i<=deck.length-d+hand.length;i++){hand.push(deck[i]);walk(i+1);hand.pop()}}walk(0);return {all,shared,distinct}}
const plain=x=>JSON.parse(JSON.stringify(x));
assert.deepEqual(plain(odds([0,0,0,1,0,0,0,0],1,[1,1,0])),{all:1,shared:1,distinct:0});
assert.equal(odds([0,1,1,0,1,0,0,0],3,[1,1,1]).distinct,1);
assert.equal(odds([100,0,0,0,0,0,0,0],12,[0,0,0]).all,1050421051106700);
assert.throws(()=>odds([1,0,0,0,0,0,0,0],2,[1,0,0]));
assert.throws(()=>odds([1,0,0,0,0,0,0,0],1,[4,0,0]));
assert.throws(()=>odds([NaN,0,0,0,0,0,0,0],1,[1,0,0]));
let seed=103;const rand=n=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)>>>8)%n;
for(let t=0;t<400;t++){let c=Array(8).fill(0),n=1+rand(11);for(let i=0;i<n;i++)c[rand(8)]++;let d=1+rand(Math.min(n,6)),r=Array.from({length:3},()=>rand(4));assert.deepEqual(plain(odds(c,d,r)),brute(c,d,r));}
for(let t=0;t<30;t++){const c=Array(8).fill(0);for(let i=0;i<8;i++)c[rand(8)]++;const d=4,r=[1,1,1],l=Array.from({length:8},()=>rand(3)===0),mode=t%2?'shared':'distinct',base=brute(c,d,r);const actual=plain(swaps(c,d,r,l,mode));const expected=[];for(let f=0;f<8;f++)for(let to=0;to<8;to++)if(f!==to&&c[f]&&!l[f]&&!l[to]){const x=c.slice();x[f]--;x[to]++;const v=brute(x,d,r);expected.push({from:f,to,...v,gain:v[mode]-base[mode]})}expected.sort((a,b)=>b.gain-a.gain||a.from-b.from||a.to-b.to);assert.deepEqual(actual,expected)}
const c=[28,8,7,5,6,3,2,1],r=odds(c,7,[1,1,1]);console.log('6 fixed + 400 brute force + 30 swap rankings passed');console.log('sample',r,swaps(c,7,[1,1,1],Array(8).fill(false),'distinct')[0]);
