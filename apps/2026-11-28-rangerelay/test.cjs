const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(__dirname+'/index.html','utf8');const core={exports:{}};new Function('module',html.split('<script>')[1].split('</script>')[0])(core);const {ranges,contains,plan,audit}=core.exports;
let fixed=0;function test(fn){fn();fixed++}
test(()=>assert.deepEqual(ranges('U+4??, U+500,U+501-502'),[[0x400,0x502]]));
test(()=>assert.throws(()=>ranges('U+110000')));
test(()=>assert.throws(()=>ranges('U+??????')));
test(()=>assert.throws(()=>ranges('U+5-2')));
test(()=>assert.throws(()=>plan('x\t1\tU+0-FF\nx\t2\tU+0-FF')));
test(()=>assert.throws(()=>plan('x\tNaN\tU+0-FF')));
test(()=>assert.equal(contains(ranges('U+10FFFF'),0x10ffff),true));
const a=plan('base\t12\tU+0-10FFFF'),b=plan('base\t12\tU+0-7F\nwide\t15\tU+0-7F\tU+41');const r=audit(a,b,'AAB𠮷\n');
test(()=>assert.deepEqual(r.rows.map(x=>[x.ch,x.count,x.after.winner]),[['A',2,'wide'],['B',1,'base'],['𠮷',1,null]]));
test(()=>assert.deepEqual([r.lost,r.changed,r.overlap,r.mismatch,r.after.size],[1,2,2,1,27]));
test(()=>assert.equal(audit(a,plan('empty\t1\tU+0-10FFFF\t-'),'A').after.missing,1));
test(()=>assert.throws(()=>audit(a,b,'\n\t')));
test(()=>assert.throws(()=>audit(a,b,'\uD800')));
let seed=90210;function rand(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n}const hex=n=>n.toString(16);
for(let t=0;t<500;t++){const make=()=>{const raw=Array.from({length:1+rand(8)},(_,i)=>{let d=Array.from({length:1+rand(4)},()=>{const l=32+rand(50);return [l,l+rand(20)]}),e=Array.from({length:1+rand(4)},()=>{const l=32+rand(50);return [l,l+rand(20)]});return {id:'f'+i,size:1+i,d,e}});const str=a=>a.map(([l,h])=>'U+'+hex(l)+'-'+hex(h)).join(',');return [raw,plan(raw.map(f=>[f.id,f.size,str(f.d),str(f.e)].join('\t')).join('\n'))]};const [rawA,pA]=make(),[rawB,pB]=make(),text=Array.from({length:70},(_,i)=>String.fromCharCode(32+i)).join('');const report=audit(pA,pB,text);for(const row of report.rows){for(const [raw,key] of [[rawA,'before'],[rawB,'after']]){const eligible=raw.filter(f=>f.d.some(([l,h])=>l<=row.n&&row.n<=h)&&f.e.some(([l,h])=>l<=row.n&&row.n<=h)).reverse();assert.equal(row[key].winner,eligible[0]?.id??null)}}}
const maxText=Array.from({length:5000},(_,i)=>String.fromCodePoint(0x10000+i)).join('');assert.equal(audit(a,plan(Array.from({length:100},(_,i)=>'f'+i+'\t1\tU+10000-12000').join('\n')),maxText).rows.length,5000);
console.log(`${fixed} fixed assertions; 500 randomized plan pairs (70 characters each); max-size case passed`);
