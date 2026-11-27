const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(__dirname+'/index.html','utf8').split('<script id="core">')[1].split('</script>')[0];
const {parse,solve}=vm.runInNewContext(code+'\n;({parse,solve})');
let seed=17;const rnd=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed>>>8)%n;};
for(let t=0;t<500;t++){
 const f=2+rnd(5),n=1+rnd(40),budget=rnd(15);const factors=Array.from({length:f},(_,i)=>'F'+i),rows=Array.from({length:n},(_,i)=>({id:'T'+i,done:rnd(4)===0,values:Array.from({length:f},()=>String(rnd(5)))}));
 const result=solve({factors,rows,budget});const keys=r=>factors.flatMap((_,i)=>factors.slice(i+1).map((_,j)=>[i,r.values[i],i+j+1,r.values[i+j+1]].join('|')));
 const all=new Set(rows.flatMap(keys)),old=new Set(rows.filter(r=>r.done).flatMap(keys)),current=new Set(old),used=new Set();
 assert.equal(result.total,all.size);assert.equal(result.before,old.size);assert.ok(result.chosen.length<=budget);
 for(const c of result.chosen){const row=rows.find(r=>r.id===c.id);assert.ok(row&&!row.done&&!used.has(c.id));const gain=r=>keys(r).filter(k=>!current.has(k)).length;assert.equal(c.gain,Math.max(...rows.filter(r=>!r.done&&!used.has(r.id)).map(gain)));assert.ok(c.gain>0);keys(row).forEach(k=>current.add(k));used.add(c.id);}
 assert.equal(result.after,current.size);assert.equal(result.gaps.length,all.size-current.size);assert.equal(result.pairs.reduce((s,p)=>s+p.after,0),current.size);
 if(result.chosen.length<budget)assert.ok(rows.every(r=>keys(r).every(k=>current.has(k))));
}
assert.throws(()=>parse('ID\t状態\tA\tB\nx\t済\t1\t2\nx\t候補\t2\t3',1));assert.throws(()=>parse('ID\t状態\tA\tB\nx\t候補\t1\t2',-1));assert.throws(()=>parse('ID\t状態\tA\tA\nx\t候補\t1\t2',1));
const s=parse('ID\t状態\tA\tB\nx\t済\t1\t2\ny\t候補\t2\t3',0);assert.equal(solve(s).after,1);assert.equal(solve({...s,budget:1}).after,2);
const max={factors:['A','B','C','D','E','F'],rows:Array.from({length:500},(_,i)=>({id:String(i),done:false,values:Array.from({length:6},(_,j)=>String((i*(j+1))%503))})),budget:500};assert.equal(solve(max).gaps.length,0);
console.log('500 generated cases, 6 fixed checks passed');
