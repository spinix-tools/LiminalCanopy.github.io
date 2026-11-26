const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/index.html','utf8').split('<script>')[1].split('// UI')[0];
const plan=vm.runInNewContext(source+'\nplan');
function oracle(rows,modes){let best=[-1,Infinity];for(let mask=0;mask<2**modes.length;mask++){const chosen=modes.map((_,i)=>i).filter(i=>mask>>i&1);if(chosen.some(i=>modes[i]!=='target'))continue;if(rows.some(r=>chosen.length*r.need>r.counts.reduce((s,v,i)=>s+(modes[i]==='exclude'?0:v),0)))continue;const cost=rows.reduce((s,r)=>s+chosen.reduce((z,i)=>z+Math.max(0,r.need-r.counts[i]),0),0);if(chosen.length>best[0]||chosen.length===best[0]&&cost<best[1])best=[chosen.length,cost];}return best;}
function verify(rows,modes){const p=plan(rows,modes);assert.deepEqual([p.k,p.units],oracle(rows,modes));const a=rows.map(r=>r.counts.slice());for(const m of p.moves){assert(m.qty>0&&m.from!==m.to&&modes[m.from]!=='exclude'&&modes[m.to]==='target');assert(a[m.part][m.from]>=m.qty);a[m.part][m.from]-=m.qty;a[m.part][m.to]+=m.qty;}assert.equal(JSON.stringify(a),JSON.stringify(p.after));for(let j=0;j<rows.length;j++){assert.equal(a[j].reduce((x,y)=>x+y,0),rows[j].counts.reduce((x,y)=>x+y,0));for(const i of p.targets)assert(a[j][i]>=rows[j].need);for(let i=0;i<modes.length;i++)if(modes[i]==='exclude')assert.equal(a[j][i],rows[j].counts[i]);}return p;}
const rows=[{name:'a',need:8,counts:[8,7,8,1]},{name:'b',need:12,counts:[11,12,8,5]},{name:'c',need:4,counts:[4,3,4,1]}];const p=verify(rows,['target','target','target','donor']);assert.deepEqual([p.before,p.k,p.units],[0,3,7]);
assert.equal(verify([{name:'a',need:4,counts:[4,0,4]}],['target','target','exclude']).k,1);
assert.equal(verify([{name:'a',need:4,counts:[4,4]}],['donor','exclude']).k,0);
assert.equal(verify([{name:'a',need:4,counts:[4,0]}],['target','target']).units,0);
assert.throws(()=>plan([{name:'a',need:2,counts:[null]}],['target']));assert.throws(()=>plan([{name:'a',need:0,counts:[2]}],['target']));assert.throws(()=>plan([{name:'a',need:2,counts:[1.5]}],['target']));
let seed=1234567;function rand(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;}
for(let k=0;k<500;k++){const n=1+rand(8),m=1+rand(5),modes=Array.from({length:n},()=>['target','donor','exclude'][rand(3)]),rows=Array.from({length:m},(_,i)=>({name:'p'+i,need:1+rand(9),counts:Array.from({length:n},()=>rand(14))}));verify(rows,modes);}
verify(Array.from({length:30},(_,i)=>({name:'p'+i,need:10000,counts:Array(12).fill(10000)})),Array(12).fill('target'));
console.log('PASS: 8 fixed cases (including max size), 500 exhaustive subset comparisons, transfer replay and conservation.');
