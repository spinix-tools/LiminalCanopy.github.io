const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script id="core">([\s\S]*?)<\/script>/)[1];
vm.runInNewContext(source+`\nthis.api={norm,parse,lcp,audit,candidates,csvCell};`,globalThis);
const {parse,audit,candidates,norm,csvCell}=api;
const check=(raw,expected)=>assert.equal(JSON.stringify(audit(parse(raw)).map(x=>x.point)),JSON.stringify(expected));
check('A|abc\nB|abd',[3,3]);check('A|ab\nB|abc',[3,3]);check('A|abc\nB|abc',[null,null]);check('A|abc\nＡ|abc',[0,0]);check('A|abc\nB|xyz',[1,1]);check('A|Ａ、Ｂ c\nB|abc',[null,null]);
assert.throws(()=>parse('A|a'));assert.throws(()=>parse('A|a\nB|'));assert.equal(norm('🦊').length,1);assert.equal(csvCell('=1+1'),'"\'=1+1"');
let seed=42;const rand=n=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)>>>8)%n;
for(let t=0;t<500;t++){const rows=parse(Array.from({length:2+rand(8)},()=>String(rand(4))+'|'+Array.from({length:1+rand(8)},()=> 'abc'[rand(3)]).join('')).join('\n'));const stats=audit(rows);rows.forEach((q,i)=>{let expected=null;for(let p=0;p<=q.chars.length+1;p++){const prefix=q.chars.slice(0,p).join('');const other=rows.filter(r=>r.key!==q.key&&(p>q.chars.length?r.chars.join('')===prefix:r.chars.join('').startsWith(prefix)));assert.equal(JSON.stringify(candidates(rows,i,p).map(r=>r.id)),JSON.stringify(other.map(r=>r.id)));if(!other.length&&expected===null)expected=p;}assert.equal(stats[i].point,expected);});}
const big=parse(Array.from({length:200},(_,i)=>i+'|'+ 'a'.repeat(296)+String(i).padStart(3,'0')).join('\n'));assert.equal(audit(big).length,200);
console.log('10 fixed checks, 500 randomized banks (all positions), 200-row limit: PASS');
