const assert = require('node:assert/strict');
const {test} = require('node:test');
const E = require('./engine.js');
test('right-binding 8 pages: correct four sides', () => {
  const p=E.makePlan({pages:8,binding:'right'});
  assert.deepEqual(p.sheets.map(s=>[s.front,s.back]),[
    [[1,8],[7,2]], [[3,6],[5,4]]
  ]);
});
test('left-binding 8 pages: correct four sides', () => {
  const p=E.makePlan({pages:8,binding:'left'});
  assert.deepEqual(p.sheets.map(s=>[s.front,s.back]),[
    [[8,1],[2,7]], [[6,3],[4,5]]
  ]);
});
test('padding and center and outer detection', () => {
 const p=E.makePlan({pages:14}); assert.equal(p.padded,16);assert.equal(p.blanks,2);
 assert.deepEqual(p.sheets[0].front,[16,1]); assert.equal(p.sheets[0].isOuter,true);
 assert.equal(p.sheets[3].isCenter,true);
});
test('all pages appear once, each sheet contains four pages for all valid lengths', () => {
 for(let count=1;count<=120;count++) for(const binding of ['left','right']){
  const p=E.makePlan({pages:count,binding});
  assert.equal(p.padded%4,0); assert.equal(p.sheetCount,p.padded/4);
  const pages=p.sheets.flatMap(s=>s.front.concat(s.back)).sort((a,b)=>a-b);
  assert.deepEqual(pages,Array.from({length:p.padded},(_,i)=>i+1));
 }
});
test('selected blanks only at end of logical sequence', () => {
 for(let count=1;count<=120;count++){
  const p=E.makePlan({pages:count});
  assert.equal(p.sheets.flatMap(s=>s.blankPages).length,p.blanks);
  assert.ok(p.sheets.every(s=>s.blankPages.every(v=>v>count)));
 }
});
test('estimated cost includes trial sheets but no duplicate imposition', () => {
 const p=E.makePlan({pages:7,copies:10,paperPerSheet:3,inkPerSide:8,testSheets:2});
 const a=E.estimate(p); assert.equal(a.productionSheets,20);assert.equal(a.physicalSheets,22);
 assert.equal(a.printedSides,44);assert.equal(a.paperCost,66);assert.equal(a.printCost,352);assert.equal(a.totalCost,418);
});
test('validation clamps invalid and hostile input', () => {
 const p=E.makePlan({pages:3000,copies:-8,binding:'nonsense',paper:'?'});
 assert.equal(p.pages,120);assert.equal(p.copies,1);assert.equal(p.binding,'left');assert.equal(p.paper,'A4');
});
test('manual backs reversal works without changing face mapping', () => {
 const p=E.makePlan({pages:12,backReverse:true});
 const a=E.orderedSides(p,'backs');
 assert.deepEqual(a.map(s=>s.sheet),[3,2,1]);assert.ok(a.every(s=>s.side==='back'));
 assert.equal(E.orderedSides(p,'all').length,6);
});
test('CSV has BOM and every side mapping', () => {
 const text=E.csv({pages:5});assert.ok(text.startsWith('\ufeff'));
 const rows=text.trim().split('\r\n');assert.equal(rows.length,5);
 assert.match(text,/yes/);
});
test('printable dummy contains correct print page count, escaping, orientation, and mode', () => {
 const html=E.printHTML({pages:7,title:'<test>&',paper:'B4',backRotate:true},'all');
 assert.match(html,/B4/);assert.match(html,/&lt;test&gt;&amp;/);
 assert.equal((html.match(/<article class="sheet/g)||[]).length,4);
 assert.equal((html.match(/class="sheet rotated"/g)||[]).length,2);
 assert.equal((E.printHTML({pages:8},'fronts').match(/<article class="sheet/g)||[]).length,2);
 assert.throws(()=>E.printHTML({},'bad'),/Invalid/);
});
test('XSS not emitted as markup in printable template',()=>{
 const html=E.printHTML({title:'<script>alert(1)</script>'});
 assert.ok(!html.includes('<script>alert(1)</script>'));
 assert.ok(html.includes('&lt;script&gt;'));
});