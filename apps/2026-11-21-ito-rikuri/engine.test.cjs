const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
function empty(w=8,h=6){const p=E.makeSample();p.width=w;p.height=h;p.cells=Array(w*h).fill(null);return p;}
test('sample validates and has several distinct colors',()=>{const p=E.validateProject(E.makeSample());assert.equal(p.cells.length,p.width*p.height);assert.ok(new Set(p.cells.filter(Boolean)).size>=4);});
test('sample reports real shortage and dimensions',()=>{const u=E.usage(E.makeSample());assert.ok(u.stitches>0);assert.ok(u.physicalWidthCm>0);assert.ok(u.missingColors>=1);});
test('zero stitch consumption is zero for all colors',()=>{const u=E.usage(empty());assert.equal(u.stitches,0);assert.equal(u.requiredCm,0);assert.equal(u.missingColors,0);});
test('14 count / 2 strands / 55% waste formula',()=>{const p=empty();const f=E.usagePerStitchCm(p);assert.ok(Math.abs(f-(2*Math.SQRT2+2)*2.54/14*2/6*1.55)<1e-12);});
test('usage increases as waste and strand count increase',()=>{const p=empty();const a=E.usagePerStitchCm(p);p.waste=100;const b=E.usagePerStitchCm(p);p.strands=4;const c=E.usagePerStitchCm(p);assert.ok(a<b&&b<c);});
test('paint creates copy without mutating input',()=>{const p=empty(),next=E.paint(p,3,2,'petal');assert.equal(p.cells[2*p.width+3],null);assert.equal(next.cells[2*p.width+3],'petal');});
test('paint rejects invalid cells or palette IDs',()=>{const p=empty();assert.throws(()=>E.paint(p,-1,0,'petal'));assert.throws(()=>E.paint(p,0,0,'unknown'));});
test('flood fill respects 4-connectivity and stops at boundary',()=>{let p=empty(5,5);for(let y=0;y<5;y++)p=E.paint(p,2,y,'leaf');p=E.fill(p,0,0,'petal');assert.equal(p.cells.filter(x=>x==='petal').length,10);assert.equal(p.cells.filter(x=>x==='leaf').length,5);assert.equal(p.cells.filter(x=>x===null).length,10);});
test('fill same color is idempotent',()=>{let p=empty(5,5);p=E.fill(p,2,3,'petal');assert.deepEqual(E.fill(p,2,3,'petal'),p);});
test('resize preserves top-left origin and crops',()=>{let p=E.paint(empty(5,5),4,4,'petal');p=E.paint(p,1,1,'leaf');const s=E.resize(p,4,4);assert.equal(s.cells[5],'leaf');assert.equal(s.cells.filter(x=>x==='petal').length,0);});
test('color replacement changes all matching cells, not metadata',()=>{const p=E.makeSample(),before=p.cells.filter(x=>x==='petal').length;const q=E.replaceColor(p,'petal','leaf');assert.equal(q.cells.filter(x=>x==='petal').length,0);assert.equal(q.cells.filter(x=>x==='leaf').length,p.cells.filter(x=>x==='leaf').length+before);assert.notDeepEqual(q,p);});
test('color substitution only suggests fully sufficient palette member',()=>{let p=empty(8,8);p.cells.fill('petal');p.colors.find(c=>c.id==='petal').stock=0;p.colors.find(c=>c.id==='leaf').stock=100000;
const s=E.suggestions(p).find(x=>x.fromId==='petal');assert.ok(s?.toId);const q=E.replaceColor(p,'petal',s.toId);assert.equal(E.usage(q).missingColors,0);});
test('no replacement when all spare stocks are zero',()=>{let p=empty();p.cells.fill('petal');p.colors.forEach(c=>c.stock=0);assert.equal(E.suggestions(p).find(s=>s.fromId==='petal').toId,null);});
test('symbols remain unique',()=>assert.equal(new Set(E.SYMBOLS).size,12));
test('SVG sanitizes title and contains physical grid and labels',()=>{const p=empty();p.title='<script>"';p.cells[0]='petal';const s=E.svg(p);assert.ok(s.includes('&lt;script&gt;'));assert.ok(!s.includes('<script>'));assert.ok(s.includes('<line'));assert.ok(s.includes('●'));});
test('CSV quote escaping protects commas and quotes',()=>{const p=empty();p.colors[0].name='赤,"強"';const c=E.csv(p);assert.ok(c.startsWith('\uFEFF'));assert.ok(c.includes('"赤,""強"""'));});
test('malformed project validation fails',()=>{const p=empty();p.cells[0]='nonexistent';assert.throws(()=>E.validateProject(p));});
test('rejects malformed numbers and excessive size',()=>{for(const v of [0,3,65,1.5,NaN]){const p=empty();p.width=v;assert.throws(()=>E.validateProject(p));}});
test('rejects duplicate IDs, malformed hex, negative inventory',()=>{for(const f of [p=>p.colors[1].id=p.colors[0].id,p=>p.colors[0].hex='red',p=>p.colors[1].stock=-1]){const p=empty();f(p);assert.throws(()=>E.validateProject(p));}});
test('project JSON round-trip is lossless',()=>{const p=E.makeSample();assert.deepEqual(E.validateProject(JSON.parse(JSON.stringify(p))),p);});
test('replacing with same color is rejected',()=>assert.throws(()=>E.replaceColor(empty(),'petal','petal')));
test('color distance zero for same hex, symmetric and nonnegative',()=>{const a='#AABBDD',b='#112233';assert.equal(E.colorDistance(a,a),0);assert.equal(E.colorDistance(a,b),E.colorDistance(b,a));assert.ok(E.colorDistance(a,b)>0);});
test('usage math conserves exact counts for 500 random grids',()=>{
  let seed=0x341abc,rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};
  for(let i=0;i<500;i++){
    const w=4+Math.floor(rand()*35),h=4+Math.floor(rand()*35),p=empty(w,h);p.count=8+Math.floor(rand()*21);p.strands=1+Math.floor(rand()*6);p.waste=Math.floor(rand()*151);p.cells=p.cells.map(()=>rand()<.26?null:p.colors[Math.floor(rand()*p.colors.length)].id);
    p.colors.forEach(c=>c.stock=Math.floor(rand()*1100));
    const u=E.usage(p);assert.equal(u.rows.reduce((a,r)=>a+r.stitches,0),u.stitches);assert.equal(u.stitches,p.cells.filter(Boolean).length);
    for(const r of u.rows){assert.equal(r.stitches,p.cells.filter(x=>x===r.id).length);assert.ok(Math.abs(r.neededCm-r.stitches*E.usagePerStitchCm(p))<=.00501);assert.ok(r.shortageCm>=0);}
    const q=E.resize(p,w,h);assert.deepEqual(q.cells,p.cells);
  }
});
