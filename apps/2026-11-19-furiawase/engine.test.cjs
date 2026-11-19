const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('./engine.js');
const doc=(s)=>E.csvParse(s);
const cv=(s,k)=>E.convert(doc(s),E.guessMap(doc(s).headers,k),k).items;
test('UTF-8 BOM / quoted comma / multiline / escaped quote',()=>{
 const d=doc('\uFEFFid,memo,amount\r\n1,"ABC,株式会社",100\r\n2,"改行\nメモ",200\r\n3,"quoted ""text""",300');
 assert.equal(d.rows.length,3);assert.equal(d.rows[0][1],'ABC,株式会社');assert.equal(d.rows[1][1],'改行\nメモ');assert.equal(d.rows[2][1],'quoted "text"');
});
test('CSV rejects bad structure',()=>{
 assert.throws(()=>doc('a,b\n"bad,2'),/引用符/); assert.throws(()=>doc('a,b'),/ヘッダー/);assert.throws(()=>doc('a,\n1,2'),/ヘッダー/);
});
test('money parser only integer yen and checked range',()=>{
 assert.equal(E.amount('¥1,200円'),1200);assert.equal(E.amount('(300)'),-300);assert.equal(E.amount(''),null);assert.equal(E.amount('12.2'),null);assert.equal(E.amount('NaN'),null);assert.equal(E.amount('9007199254740992'),null);
});
test('dates validated strictly, leap years and Japanese format',()=>{
 assert.equal(E.dateISO('2024年2月29日'),'2024-02-29');assert.equal(E.dateISO('2025/02/29'),null);assert.equal(E.dateISO('2026/13/1'),null);assert.equal(E.daysBetween('2026-11-01','2026-11-03'),2);
});
test('mapping guesses domestic and English columns',()=>{
 const m=E.guessMap(['精算ID','精算日','売上','手数料','返金','調整','入金予定額'],'payouts');
 assert.deepEqual(Object.values(m),[0,1,2,3,4,5,6]);
 assert.equal(E.guessMap(['Date','Credit','Description'],'banks').amount,1);
});
test('sample computes gross - fee - refund + adjustment',()=>{
 const p=cv(E.samplePayouts,'payouts');
 assert.equal(p.length,7);assert.equal(p[0].calc,9700);assert.equal(p[1].calc,6780);assert.equal(p[1].refund,500);assert.equal(p[6].mismatch,true);
});
test('invalid rows are skipped and errors exposed',()=>{
 const d=doc('date,net\n2026/11/10,2000\nnope,30\n2026/11/11,abc');
 const c=E.convert(d,E.guessMap(d.headers,'payouts'),'payouts');
 assert.equal(c.items.length,1);assert.equal(c.errors.length,2);
});
test('default sample keeps ambiguities and near miss for review',()=>{
 const r=E.reconcile(cv(E.samplePayouts,'payouts'),cv(E.sampleBanks,'banks'),{});
 assert.deepEqual([r.stats.auto,r.stats.manual,r.stats.ambiguous,r.stats.missing,r.stats.mismatch,r.stats.unmatchedBank],[2,0,2,2,1,4]);
 assert.equal(r.rows[4].near[0].gap,-100);assert.equal(r.rows[6].status,'mismatch');
});
test('manual pin reserves a bank transaction and unlocks unique match',()=>{
 const p=cv(E.samplePayouts,'payouts'),b=cv(E.sampleBanks,'banks');
 const r=E.reconcile(p,b,{manual:{2:2}});
 assert.equal(r.rows[2].status,'manual');assert.equal(r.rows[3].status,'auto');assert.equal(r.stats.unmatchedBank,2);
});
test('manual out-of-range amount is explicit, never silently auto',()=>{
 const r=E.reconcile(cv(E.samplePayouts,'payouts'),cv(E.sampleBanks,'banks'),{manual:{4:4}});
 assert.equal(r.rows[4].status,'manual');assert.equal(r.rows[4].gap,-100);
});
test('two rows competing for one bank stay ambiguous',()=>{
 const p=[{index:0,id:'A',date:'2026-01-01',net:100,mismatch:false},{index:1,id:'B',date:'2026-01-01',net:100,mismatch:false}];
 const b=[{date:'2026-01-02',amount:100}];
 const r=E.reconcile(p,b);assert.equal(r.stats.auto,0);assert.equal(r.stats.ambiguous,2);
});
test('a unique payout cannot grab bank shared with multi-candidate payout',()=>{
 const p=[{index:0,date:'2026-01-01',net:100,mismatch:false},{index:1,date:'2026-01-01',net:100,mismatch:false}];
 const b=[{date:'2026-01-02',amount:100},{date:'2026-01-02',amount:100}];
 const r=E.reconcile(p,b);assert.equal(r.stats.auto,0);
});
test('negative lag disallowed; tolerance changes candidates',()=>{
 const p=[{index:0,date:'2026-01-05',net:1000,mismatch:false}];
 const b=[{date:'2026-01-04',amount:990},{date:'2026-01-07',amount:990}];
 assert.equal(E.reconcile(p,b,{tolerance:0}).stats.auto,0);
 assert.equal(E.reconcile(p,b,{tolerance:10,lag:3}).stats.auto,1);
});
test('bank date before settlement does not auto match',()=>{
 const p=[{index:0,date:'2026-01-10',net:100,mismatch:false}];
 const b=[{date:'2026-01-09',amount:100}];assert.equal(E.reconcile(p,b).stats.auto,0);
});
test('CSV export quotes cells and neutralizes spreadsheet formulas',()=>{
 const c=E.csvEncode([['name','note'],['x','"y"'],['=HYPERLINK("http://x")','-danger'],['2026/11/01','100']]);
 assert.match(c,/"'=HYPERLINK/);assert.match(c,/"'-danger"/);assert.equal(doc(c).rows[1][0][0],"'");
});
test('no gross column still allows net-only match',()=>{
 const p=cv('date,net\n2026/10/01,500','payouts');
 assert.equal(p[0].calc,null);assert.equal(p[0].mismatch,false);
});
test('explicit mapping can handle arbitrary bank columns',()=>{
 const d=doc('WHEN,CREDITED,NOTE\n2026-11-12,100,hello');
 const c=E.convert(d,{date:0,amount:1,memo:2},'banks');assert.equal(c.items[0].amount,100);
});
test('manual duplicates cannot reserve one bank twice',()=>{
 const p=cv(E.samplePayouts,'payouts'),b=cv(E.sampleBanks,'banks');
 const r=E.reconcile(p,b,{manual:{0:0,1:0}});assert.equal(r.stats.manual,1);
});

test('malformed reported amount is rejected rather than silently replaced',()=>{
 const d=doc('date,gross,net\n2026-11-01,100,NOT_NUMBER');
 const c=E.convert(d,E.guessMap(d.headers,'payouts'),'payouts');
 assert.equal(c.items.length,0);assert.match(c.errors[0],/振込額が不正/);
});