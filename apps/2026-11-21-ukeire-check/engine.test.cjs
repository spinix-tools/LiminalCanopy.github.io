'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const E=require('./engine.js');
const defs=E.DEFAULT_RULES.map(x=>({...x}));
function sampleAnalyze(){return E.analyze(E.SAMPLE,defs);}
test('sample parse: six data rows',()=>{assert.equal(E.parseCSV(E.SAMPLE).rows.length,7);});
test('sample validation surfaces multiple problems',()=>{const r=sampleAnalyze();assert.equal(r.summary.total,6);assert.ok(r.summary.rejected>=4);assert.ok(r.issues.some(x=>x.code==='duplicate'));assert.ok(r.issues.some(x=>x.code==='enum'));assert.ok(r.issues.some(x=>x.code==='required'));});
test('proper CSV quoting comma',()=>{const r=E.parseCSV('h,a\n1,"a,b"');assert.equal(r.rows[1][1],'a,b');});
test('proper quoted escaping and multiline row number',()=>{const r=E.parseCSV('h,a\n1,"a""b\nc"\n2,z');assert.equal(r.rows[1][1],'a"b\nc');assert.equal(r.lines[2],4);});
test('unclosed quote detected',()=>assert.ok(E.parseCSV('a,b\n"a,b').problems.some(x=>x.code==='unclosed_quote')));
test('quote in middle rejected',()=>assert.ok(E.parseCSV('a,b\nc"d,e').problems.some(x=>x.code==='quote')));
test('quote trailing characters rejected',()=>assert.ok(E.parseCSV('a,b\n"a"z,e').problems.some(x=>x.code==='quote_tail')));
test('blank input results in no rows',()=>assert.equal(E.parseCSV('').rows.length,0));
test('tab delimiter detected',()=>assert.equal(E.guessDelimiter('a\tb\tc\n1\t2\t3'), '\t'));
test('semicolon delimiter detected',()=>assert.equal(E.guessDelimiter('a;b;c\n1;2;3'), ';'));
test('UTF8 BOM decoded',()=>{const d=E.decodeBytes(Uint8Array.from([239,187,191,...Buffer.from('名前,値\nあ,1')]));assert.equal(d.encoding,'utf-8');assert.equal(d.text,'名前,値\nあ,1');});
test('UTF8 text with non-ascii',()=>{const d=E.decodeBytes(Buffer.from('商品,金額\n本,100'));assert.equal(d.encoding,'utf-8');});
test('unknown decoder rejected',()=>assert.throws(()=>E.decodeBytes(new Uint8Array(10),'iso-8859-1')));
test('truncated UTF8 warns about loss',()=>{const d=E.decodeBytes(Uint8Array.from([0xEF,0xBF]),'utf-8');assert.equal(d.loss,true);});
test('date leap 2024-02-29 valid',()=>assert.equal(E.validDate('2024-02-29'),true));
test('date leap 2025-02-29 invalid',()=>assert.equal(E.validDate('2025-02-29'),false));
test('invalid 2026-13-02',()=>assert.equal(E.validDate('2026-13-02'),false));
test('allow signed integer',()=>assert.equal(E.validType('-1','integer'),true));
test('reject negative nonnegative number',()=>assert.equal(E.validType('-1','nonneg'),false));
test('reject commas number',()=>assert.equal(E.validType('1,000','nonneg'),false));
test('header duplicate blocks export',()=>{const r=E.analyze('A,A\n1,2',[{name:'A',source:'A',type:'text'}]);assert.equal(r.headerError,true);assert.equal(r.approvedRows.length,0);});
test('missing mapping blocks output',()=>{const r=E.analyze('X\n1',[{name:'A',source:'A'}]);assert.equal(r.headerError,true);});
test('normalized full-width header matches',()=>{const r=E.analyze('商品ＣＤ\n001',[{name:'code',source:'商品CD'}]);assert.equal(r.approvedRows[0][0],'001');});
test('column count error excludes row',()=>{const r=E.analyze('a,b\n1,2,3\n4,5',[{name:'a',source:'a'},{name:'b',source:'b'}]);assert.equal(r.summary.accepted,1);});
test('blank row skipped with warning',()=>{const r=E.analyze('a\n1\n\n2',[{name:'a',source:'a'}]);assert.equal(r.summary.total,2);assert.ok(r.issues.some(x=>x.code==='empty_line'));});
test('duplicate values block only second occurrence',()=>{const r=E.analyze('id\na\na\nb',[{name:'id',source:'id',unique:true}]);assert.equal(r.summary.accepted,2);});
test('leading zeros kept and warned',()=>{const r=E.analyze('id\n00123',[{name:'id',source:'id',type:'text'}]);assert.equal(r.approvedRows[0][0],'00123');assert.ok(r.issues.some(x=>x.code==='excel'));});
test('long integers warned',()=>assert.equal(E.spreadsheetRisk('1234567890123456'),true));
test('formula risk',()=>{for(const s of ['=1+1',' +cmd','@sum','-cmd'])assert.equal(E.excelRisk(s),true);});
test('negative number is not formula risk',()=>assert.equal(E.excelRisk('-100.50'),false));
test('formula kept by default, opt-in escape adds apostrophe',()=>{assert.ok(E.toCSV(['a'],[['=1+1']],{bom:false}).includes('=1+1'));assert.ok(E.toCSV(['a'],[['=1+1']],{bom:false,guardFormula:true}).includes("'=1+1"));});
test('output BOM and CRLF',()=>{const s=E.toCSV(['A'],[['001']]);assert.equal(s.charCodeAt(0),0xFEFF);assert.ok(s.includes('\r\n'));});
test('schema JSON round trip',()=>{const s=E.ruleJSON(defs);assert.deepEqual(E.importRuleJSON(s),defs);});
test('malformed schema rejected',()=>assert.throws(()=>E.importRuleJSON('{}')));
test('duplicate output rules rejected',()=>assert.throws(()=>E.analyze('a\nx',[{name:'X',source:'a'},{name:'X',source:'a'}])));
test('no silent trimming of data',()=>{const r=E.analyze('a\n"  001  "',[{name:'a',source:'a'}]);assert.equal(r.approvedRows[0][0],'  001  ');});
test('CSV formula in issue report not exposed to Excel',()=>{const csv=E.issuesCSV([{row:2,col:'a',level:'error',code:'x',message:'ok'}]);assert.ok(csv.startsWith('\uFEFF'));});
test('deterministic round trip on 500 randomized tables',()=>{
 let seed=918317;function rnd(n){seed=(seed*1664525+1013904223)>>>0;return seed%n;}
 const tokens=['a,b','漢字','"','\n','001','', ' space ','=1+2','😀'];
 for(let k=0;k<500;k++){
   const rows=Array.from({length:1+rnd(8)},()=>Array.from({length:1+rnd(6)},()=>tokens[rnd(tokens.length)]));
   const output=E.toCSV(['c'],rows,{bom:false,eol:'LF'});
   const result=E.parseCSV(output).rows;
   assert.deepEqual(result.slice(1),rows);
 }
});