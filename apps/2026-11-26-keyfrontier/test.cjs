const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const core=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const {parse,normalize,audit,compare}=vm.runInNewContext(core+';({parse,normalize,audit,compare})');
let n=0;function test(name,fn){fn();n++;console.log('PASS',name)}
test('preserve leading zeros and whitespace',()=>{assert.equal(parse('001\r\n x \n\n')[1].raw,' x ');assert.equal(normalize('001',0),'001')});
test('all rules in fixed order',()=>{assert.equal(normalize(' Ａ−１ ',15),'a-1');assert.equal(normalize('０００',17),'0');assert.equal(normalize('A001',16),'A001')});
test('exact and new pairs',()=>{const p=compare(parse('A\nB'),parse('A\nb'));assert.equal(p[0].unique,1);assert.equal(p[4].unique,2);assert.equal(p[4].newPairs,1)});
test('lost exact match due to normalization',()=>{const p=compare(parse('0012\n12'),parse('12'))[16];assert.equal(p.lost,1);assert.equal(p.unique,0);assert.equal(p.ambiguous,3)});
test('same side duplicates without counterpart',()=>{const p=audit(parse('X\nX'),parse('Y'),0);assert.equal(p.ambiguous,2);assert.equal(p.unmatchedA,2);assert.equal(p.unmatchedB,1)});
test('empty lines never match',()=>{assert.equal(audit(parse(' \n'),parse('\t'),2).unique,0)});
test('bounds',()=>{assert.throws(()=>parse('x'.repeat(121)));assert.throws(()=>parse(Array(2001).fill('x').join('\n')))});
test('Pareto retains baseline, removes useless rules',()=>{const p=compare(parse('A'),parse('A'));assert.equal(p.filter(x=>x.frontier).length,1);assert.equal(p[0].frontier,true)});
test('prototype strings and large IDs',()=>{assert.equal(compare(parse('__proto__\n9999999999999999999'),parse('__proto__\n9999999999999999999'))[0].unique,2)});
test('32 policies, 2000 rows per side',()=>{const a=parse(Array.from({length:2000},(_,i)=>'K'+i).join('\n'));const p=compare(a,a);assert.equal(p.length,32);assert.equal(p[31].unique,2000)});
let seed=42;const rand=n=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed%n};const pool=['A','a','Ａ','001','1','x-y','x−y',' x-y ','カナ','ｶﾅ'];for(let i=0;i<100;i++){const a=parse(Array.from({length:rand(9)+1},()=>pool[rand(pool.length)]).join('\n')),b=parse(Array.from({length:rand(9)+1},()=>pool[rand(pool.length)]).join('\n'));for(const p of compare(a,b)){const count=(r,s)=>r.filter(x=>normalize(x.raw,p.m)===s).length;let unique=0,ambiguous=0,ua=0,ub=0;for(const x of a){const k=normalize(x.raw,p.m),l=count(a,k),r=count(b,k);unique+=Number(l===1&&r===1);ambiguous+=Number(l>1||r>1);ua+=Number(!r)}for(const x of b){const k=normalize(x.raw,p.m),l=count(a,k),r=count(b,k);ambiguous+=Number(l>1||r>1);ub+=Number(!l)}assert.deepEqual([p.unique,p.ambiguous,p.unmatchedA,p.unmatchedB],[unique,ambiguous,ua,ub])}}console.log(`${n} fixed tests + 3200 independent row-count comparisons passed`);
