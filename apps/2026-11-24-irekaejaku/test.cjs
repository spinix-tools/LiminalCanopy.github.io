const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const {parse,moves,won,shortest,comparison,size}=vm.runInNewContext(core+'\n;({parse,moves,won,shortest,comparison,size})');
const json=x=>JSON.parse(JSON.stringify(x));
const p=parse('2 1 2 1 1 1','5 3 3 2','AB/CD/EF/','FCA',1);
assert.deepEqual(json(comparison(p).map(x=>x.steps)),[null,null,22,22,15]);
assert.throws(()=>parse('1 1','2 2 2 2','AA///','A',1));
assert.throws(()=>parse('2 2','1 2 2 2','A/B//','A',1));
assert.throws(()=>parse('1 1','2 2 2 2','A/B//','AA',1));
assert.throws(()=>parse('1 1','2 2 2 2','A/B//','A',0));
assert.equal(shortest(['A','B','',''],[2,2,2,2],{A:1,B:1},'A').path.length,0);
assert.equal(moves(['AB','','',''],[3,3,3,3],{A:1,B:2}).find(x=>x.cars==='AB').t[3],'BA');
// Independent frontier traversal: use array shift/unshift operations rather than string prefix reversal.
function oracle(start,c,l,g){let front=[start.map(x=>[...x])],seen=new Set([start.join('/')]),depth=0;while(front.length){let next=[];for(const s of front){if(s[0].slice().reverse().join('')===g&&!s[3].length)return depth;for(let a=0;a<4;a++)for(let b=0;b<4;b++){if(a===b||Math.max(a,b)!==3)continue;let t=s.map(x=>x.slice());while(t[a].length){t[b].unshift(t[a].shift());if(t[b].reduce((v,x)=>v+l[x],0)>c[b])break;let k=t.map(x=>x.join('')).join('/');if(!seen.has(k)){seen.add(k);next.push(t.map(x=>x.slice()))}}}}front=next;depth++}return null}
let seed=389;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed>>>8)%n};let checked=0;
for(let i=0;i<180;i++){let n=2+rand(4),ids='ABCDEF'.slice(0,n),l=Object.fromEntries([...ids].map(x=>[x,1+rand(3)])),s=['','','',''];for(const x of ids)s[rand(4)]+=x;let c=s.map(x=>Math.max(1,size(x,l)+rand(4))),g=[...ids].filter(()=>rand(2)).reverse().join('')||ids[0];let r=shortest(s,c,l,g);assert.equal(r.path===null?null:r.path.length,oracle(s,c,l,g));if(r.path){let cur=s;for(const m of r.path){assert.ok(moves(cur,c,l).some(x=>x.a===m.a&&x.b===m.b&&x.cars===m.cars&&x.t.join('/')===m.t.join('/')));cur=m.t;checked++}assert.ok(won(cur,g))}}
console.log('7 fixed checks; 180 independent shortest-path cases; '+checked+' reconstructed moves verified');
