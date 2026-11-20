'use strict';
const {test}=require('node:test');const a=require('node:assert/strict');const E=require('./engine.js');
const clone=s=>JSON.parse(JSON.stringify(s));
const approx=(x,y,tol=1e-6)=>a.ok(Math.abs(x-y)<=tol,`${x} != ${y}`);
test('demo is valid with 400 respondents',()=>a.equal(E.validate(E.demo()),400));
test('demo raw yes percentage 53',()=>approx(E.compare(E.demo()).rawShare,53));
test('demo raking matches row and column targets',()=>{
 const r=E.rake(E.demo());for(const x of [...r.rows,...r.cols])approx(x.after,x.target,1e-5);
});
test('demo weighted total equals original',()=>approx(E.rake(E.demo()).mass.flat().reduce((x,y)=>x+y),400));
test('demo weighted yes percentage is deterministic',()=>approx(E.rake(E.demo()).weightedShare,51.5362008645));
test('comparison preserves identical raw share',()=>a.equal(E.compare(E.demo()).row.rawShare,E.compare(E.demo()).both.rawShare));
test('row-only calibration matches all row targets',()=>{const r=E.rake(E.demo(),'row');r.rows.forEach(x=>approx(x.after,x.target));});
test('row-only does not force col targets',()=>{const r=E.rake(E.demo(),'row');a.ok(Math.abs(r.cols[0].after-60)>0.1)});
test('equal target shares with uniform responses yield weight 1',()=>{
 const s=E.demo();s.rows=[{name:'a',target:50},{name:'b',target:50}];s.cols=[{name:'x',target:50},{name:'y',target:50}];s.cells=[[{n:10,yes:4},{n:10,yes:4}],[{n:10,yes:4},{n:10,yes:4}]];
 const r=E.rake(s);r.weights.flat().forEach(w=>approx(w,1));approx(r.ess,40);approx(r.weightedShare,40);
});
test('zero support in positive row is rejected',()=>{const s=E.demo();s.cells[0]=s.cells[0].map(()=>({n:0,yes:0}));a.throws(()=>E.rake(s),/回答0人/)});
test('zero support in positive col is rejected',()=>{const s=E.demo();s.cells.forEach(row=>row[0]={n:0,yes:0});a.throws(()=>E.rake(s),/回答0人/)});
test('structural-zero impossible targets are rejected by nonconvergence',()=>{
 const s={...E.demo(),rows:[{name:'A',target:80},{name:'B',target:20}],cols:[{name:'x',target:20},{name:'y',target:80}],cells:[[{n:10,yes:4},{n:0,yes:0}],[{n:0,yes:0},{n:10,yes:8}]]};
 a.throws(()=>E.rake(s),/収束しません/);
});
test('zero target allowed and drops that group from weighted totals',()=>{
 const s=E.demo();s.rows[0].target=0;s.rows[1].target=50;s.rows[2].target=50;
 const r=E.rake(s);approx(r.rows[0].after,0);approx(r.rows[1].after,50);
});
test('empty cells are not fabricated',()=>{
 const s=E.demo();s.cells[0][0]={n:0,yes:0};const r=E.rake(s);a.equal(r.mass[0][0],0);a.equal(r.weights[0][0],0);
});
test('yes above respondents is rejected',()=>{const s=E.demo();s.cells[0][0].yes=81;a.throws(()=>E.validate(s),/はい/)});
test('negative respondents rejected',()=>{const s=E.demo();s.cells[0][0].n=-1;a.throws(()=>E.validate(s),/回答人数/)});
test('fractional respondents rejected',()=>{const s=E.demo();s.cells[0][0].n=1.3;a.throws(()=>E.validate(s),/整数/)});
test('NaN target rejected',()=>{const s=E.demo();s.rows[0].target=NaN;a.throws(()=>E.validate(s),/目標割合/)});
test('target sums must be 100',()=>{const s=E.demo();s.cols[0].target=61;a.throws(()=>E.validate(s),/合計/)});
test('too few categories rejected',()=>{const s=E.demo();s.rows=[s.rows[0]];s.cells=[s.cells[0]];a.throws(()=>E.validate(s),/2〜5/)});
test('matrix dimension mismatch rejected',()=>{const s=E.demo();s.cells[0].pop();a.throws(()=>E.validate(s),/列数/)});
test('zero samples rejected',()=>{const s=E.demo();s.cells.forEach(row=>row.forEach(c=>{c.n=0;c.yes=0}));a.throws(()=>E.validate(s),/回答数/)});
test('diagnosis mentions empty cells',()=>{const s=E.demo();s.cells[0][0]={n:0,yes:0};a.match(E.compare(s).warnings.join(','),/交差セル/)});
test('max weight > 3 warns',()=>{
 const s=E.demo();s.cols[0].target=95;s.cols[1].target=5;const r=E.rake(s);a.ok(r.maxWeight>1);a.equal(typeof E.diagnose(s,r)[0],'string');
});
test('csv includes utf8 bom and headers',()=>{const s=E.demo(),r=E.rake(s);a.ok(E.exportCSV(s,r).startsWith('\uFEFF'));a.match(E.exportCSV(s,r),/加重人数/);});
test('csv formula injection is quoted and prefixed',()=>{a.equal(E.safeCSV('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');a.equal(E.safeCSV('  +SUM(1)'),'"\'  +SUM(1)"');});
test('json round trip',()=>a.deepEqual(E.parseJSON(JSON.stringify(E.demo())),E.demo()));
test('malformed json rejected',()=>a.throws(()=>E.parseJSON('{invalid'),SyntaxError));
test('oversized json rejected',()=>a.throws(()=>E.parseJSON(' '.repeat(200001)),/大きすぎ/));
test('invalid JSON state rejected',()=>a.throws(()=>E.parseJSON(JSON.stringify({...E.demo(),cells:[]})),/行数/));
test('invisible survey label is rejected',()=>{const s=E.demo();s.rows[0].name='  ';a.throws(()=>E.validate(s),/名前/)});
test('random full support validates marginal fits and ESS in 250 scenarios',()=>{
 let seed=129087;function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
 for(let t=0;t<250;t++){
  const R=2+Math.floor(rnd()*4),C=2+Math.floor(rnd()*4);
  const rows=Array.from({length:R},(_,i)=>({name:`A${i}`,target:0})),cols=Array.from({length:C},(_,i)=>({name:`B${i}`,target:0}));
  const ar=Array.from({length:R},()=>rnd()+.1),ac=Array.from({length:C},()=>rnd()+.1);
  rows.forEach((x,i)=>x.target=100*ar[i]/ar.reduce((a,b)=>a+b));cols.forEach((x,i)=>x.target=100*ac[i]/ac.reduce((a,b)=>a+b));
  const cells=Array.from({length:R},()=>Array.from({length:C},()=>{const n=1+Math.floor(rnd()*150);return{n,yes:Math.floor(rnd()*(n+1))}}));
  const s={...E.demo(),rows,cols,cells};const r=E.rake(s);
  r.rows.forEach(x=>approx(x.after,x.target,1e-5));r.cols.forEach(x=>approx(x.after,x.target,1e-5));
  a.ok(r.ess<=r.N+1e-6 && r.ess>0 && r.weightedShare>=0 && r.weightedShare<=100);
  cells.forEach((line,i)=>line.forEach((cell,j)=>approx(r.mass[i][j],cell.n*r.weights[i][j],1e-5)));
 }
});
