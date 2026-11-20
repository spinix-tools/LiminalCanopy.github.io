'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('./engine.js');
const fresh=()=>E.sample();
const clone=x=>JSON.parse(JSON.stringify(x));
const checks=[
['sample validates',()=>assert.equal(E.validate(fresh()).errors.length,0)],
['sample has four categories',()=>assert.equal(fresh().categories.length,4)],
['sample has two series',()=>assert.equal(fresh().series.length,2)],
['reject empty document',()=>assert.ok(E.validate(null).errors.length)],
['reject empty title',()=>{let m=fresh();m.title='';assert.ok(E.validate(m).errors.length)}],
['reject more than 16 rows',()=>{let m=fresh();m.categories=Array.from({length:17},()=>({label:'x',values:[1,2]}));assert.ok(E.validate(m).errors.length)}],
['reject more than 6 series',()=>{let m=fresh();m.series=Array(7).fill('X');assert.ok(E.validate(m).errors.length)}],
['reject invalid mode',()=>{let m=fresh();m.mode='pie';assert.ok(E.validate(m).errors.length)}],
['reject negative numeric values',()=>{let m=fresh();m.categories[0].values[0]=-1;assert.ok(E.validate(m).errors.length)}],
['reject Infinity',()=>{let m=fresh();m.categories[0].values[0]=Infinity;assert.ok(E.validate(m).errors.length)}],
['reject NaN',()=>{let m=fresh();m.categories[0].values[0]=NaN;assert.ok(E.validate(m).errors.length)}],
['reject above maximum',()=>{let m=fresh();m.categories[0].values[0]=1e10;assert.ok(E.validate(m).errors.length)}],
['reject mismatched value count',()=>{let m=fresh();m.categories[0].values=[1];assert.ok(E.validate(m).errors.length)}],
['warn on duplicates',()=>{let m=fresh();m.series=['春','春'];assert.ok(E.validate(m).warnings.length)}],
['warn all zeros',()=>{let m=fresh();m.categories.forEach(c=>c.values=[0,0]);assert.ok(E.validate(m).warnings.length)}],
['parse CRLF',()=>assert.deepEqual(E.parseCSV('項目,A\r\n春,1\r\n'),[['項目','A'],['春','1']])],
['parse quoted commas',()=>assert.deepEqual(E.parseCSV('"a,b",c\nx,y'),[['a,b','c'],['x','y']])],
['parse escaped quotes',()=>assert.deepEqual(E.parseCSV('"a""b",c'),[['a"b','c']])],
['parse quoted newline',()=>assert.deepEqual(E.parseCSV('"a\nb",1'),[['a\nb','1']])],
['reject unterminated CSV quote',()=>assert.throws(()=>E.parseCSV('"oops'),/閉じ/)],
['reject stray CSV quote',()=>assert.throws(()=>E.parseCSV('a"b,c'),/不正/)],
['reject ragged CSV',()=>assert.throws(()=>E.toModelFromCSV('項目,A,B\nx,4'),/列数/)],
['reject nonnumeric CSV cell',()=>assert.throws(()=>E.toModelFromCSV('項目,A\nx,hello'),/数値/)],
['reject negative CSV cell',()=>assert.throws(()=>E.toModelFromCSV('項目,A\nx,-4'),/数値/)],
['CSV round trip data',()=>{let m=fresh(),x=E.toModelFromCSV(E.toCSV(m));assert.deepEqual(x.series,m.series);assert.deepEqual(x.categories,m.categories)}],
['CSV formula injection protection',()=>assert.equal(E.csvCell('=SUM(A1:A3)'),"'=SUM(A1:A3)")],
['CSV escaping embedded delimiters',()=>assert.equal(E.csvCell('a,b"c'),'"a,b""c"')],
['XML escaping',()=>assert.equal(E.escapeXml('<img a="x">&'), '&lt;img a=&quot;x&quot;&gt;&amp;')],
['SVG is a single SVG root',()=>assert.match(E.renderSvg(fresh()),/^<svg[\s\S]*<\/svg>$/)],
['SVG includes patterned defs',()=>assert.match(E.renderSvg(fresh()),/id="sw-1"/)],
['SVG escapes user provided strings',()=>{let m=fresh();m.title='<script>alert(1)</script>';m.categories[0].label='<img/>';let svg=E.renderSvg(m);assert.doesNotMatch(svg,/<script>|<img\/>/);assert.match(svg,/&lt;script&gt;/)}],
['stacked mode renders totals',()=>{let m=fresh();m.mode='stacked';assert.match(E.renderSvg(m),/合計/)}],
['grayscale mode uses white fills',()=>assert.match(E.renderSvg(fresh()),/fill="#ffffff" stroke=/)],
['color mode includes palette',()=>{let m=fresh();m.monochrome=false;assert.ok(E.renderSvg(m).includes(E.PALETTE[0]))}],
['luminance of black is zero',()=>assert.equal(E.luminance('#000000'),0)],
['contrast black white approx 21',()=>assert.ok(Math.abs(E.contrast('#000000','#ffffff')-21)<1e-9)],
['contrast symmetry',()=>assert.equal(E.contrast('#012345','#abcdef'),E.contrast('#abcdef','#012345'))],
['niceCeil never below n',()=>{for(const n of [0,.001,.21,1,2.001,13,517,1e6])assert.ok(E.niceCeil(n)>=n)}],
['JSON import of sample',()=>assert.deepEqual(E.safeImport(JSON.stringify(fresh())),fresh())],
['JSON does not accept malformed',()=>assert.throws(()=>E.safeImport('{hi'),/JSON/)],
['JSON import drops unknown keys',()=>{let m=fresh();m.evil='hi';assert.equal(E.safeImport(JSON.stringify(m)).evil,undefined)}],
['JSON import refuses malformed values',()=>{let m=fresh();m.series=[];assert.throws(()=>E.safeImport(JSON.stringify(m)),/系列/)}],
];
checks.forEach(([name,fn])=>test(name,fn));
test('randomized CSV roundtrips and SVG invariants (400 cases)',()=>{
  let seed=20261121;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};
  for(let t=0;t<400;t++){
    const n=1+Math.floor(rnd()*15),s=1+Math.floor(rnd()*6);
    const m={version:1,title:'図 '+t,note:'機密情報は入力しない',mode:rnd()<.5?'grouped':'stacked',monochrome:rnd()<.5,
      series:Array.from({length:s},(_,i)=>`S${i+1}`),categories:Array.from({length:n},(_,i)=>({label:`C${i+1}, ${t}`,values:Array.from({length:s},()=>Math.round(rnd()*10000)/100)}))};
    assert.equal(E.validate(m).errors.length,0);
    assert.deepEqual(E.toModelFromCSV(E.toCSV(m),m).categories,m.categories);
    const svg=E.renderSvg(m);assert.match(svg,/<\/svg>$/);
    assert.equal((svg.match(/<pattern /g)||[]).length,s);
    assert.ok(svg.length<300000);
  }
});
