const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const base = 'https://example.org/jp/item?ref=a%2Bb&ref=z#form';
function one(partial = {}) { return { ...E.sample(), placements: [{ id: 'one', label: '行1', destination: '', source: 'instagram', medium: 'social', content: 'story_01', term: '', ...partial }] }; }

test('sample is fully independent and normalizes input', () => {
  const x = E.sample(), y = E.sample(); x.placements[0].source = 'edited'; assert.equal(y.placements[0].source, 'instagram');
  assert.equal(E.fromObject(x).placements[0].source, 'edited');
});
test('sample generates a complete campaign and warning statuses', () => {
  const r = E.audit(E.sample()); assert.equal(r.rows.length, 5); assert.equal(r.counts.generated, 5);
  assert.equal(r.counts.groupCollisions, 1); assert.equal(r.counts.error, 0);
  assert.ok(r.rows[4].issues.some(i => i.code === 'REPLACE'));
  assert.ok(r.rows[4].issues.some(i => i.code === 'NAMING'));
});
test('query and fragment survive while replacing case insensitive tracking', () => {
  const url = E.makeUrl('https://example.org/shop?x=1&UTM_SOURCE=old&x=2&utm_source=dup#purchase',
    {utm_source:'news',utm_medium:'email',utm_campaign:'early',utm_content:'hero'});
  const u = new URL(url);
  assert.deepEqual(u.searchParams.getAll('x'), ['1', '2']); assert.equal(u.hash, '#purchase');
  assert.deepEqual(u.searchParams.getAll('utm_source'), ['news']);
  assert.equal(u.searchParams.has('UTM_SOURCE'), false);
  assert.equal(u.searchParams.get('utm_campaign'), 'early');
});
test('duplicate original UTM is diagnosed', () => {
  const r = E.audit(one({ destination: 'https://example.com?utm_medium=a&utm_medium=b&z=1' }));
  assert.ok(r.rows[0].issues.some(i => i.code === 'REPEATED'));
  assert.ok(r.rows[0].url.includes('z=1'));
});
test('missing required tags block link creation', () => {
  for (const field of ['source','medium']) {
    const r = E.audit(one({[field]:'  '})); assert.equal(r.counts.error, 1); assert.equal(r.rows[0].url, '');
  }
  const r = E.audit({...one(), campaign:''}); assert.equal(r.counts.error,1);assert.equal(r.counts.generated,0);
});
test('unsafe URLs and user info are rejected', () => {
  for (const url of ['javascript:alert(1)', 'ftp://a.com', '//example.org', 'https://u:p@example.org/a', 'not a link', 'file:///etc/passwd', '']) {
    assert.throws(() => E.inspectDestination(url));
    assert.equal(E.audit(one({destination:url || 'javascript:1'})).counts.error,1);
  }
});
test('http is allowed with warning', () => {
  const row = E.audit(one({destination:'http://example.org'})).rows[0]; assert.ok(row.url.startsWith('http:'));assert.ok(row.issues.some(i=>i.code==='HTTP'));
});
test('all 5 UTM keys correctly roundtrip with Japanese Unicode', () => {
  const url=E.makeUrl(base,{utm_source:'line',utm_medium:'social',utm_campaign:'秋祭り 2026',utm_content:'①特設',utm_term:'出店 販売'});
  const u=new URL(url); assert.equal(u.searchParams.get('utm_campaign'),'秋祭り 2026');
  assert.equal(u.searchParams.get('utm_content'),'①特設'); assert.equal(u.searchParams.get('utm_term'),'出店 販売');
  assert.equal(u.hash,'#form');
});
test('exact duplicated URLs are an error', () => {
  const obj=one();obj.placements.push({...obj.placements[0],id:'two',label:'行2'});
  const r=E.audit(obj);assert.equal(r.counts.error,2);assert.ok(r.rows.every(row=>row.issues.some(i=>i.code==='DUPLICATE')));
});
test('different utm_content has report grouping only', () => {
  const obj=one();obj.placements.push({...obj.placements[0],id:'two',label:'行2',content:'story_02'});
  const r=E.audit(obj);assert.equal(r.counts.groupCollisions,1); assert.equal(r.counts.error,0);
  assert.ok(r.rows.every(row=>row.issues.some(i=>i.code==='REPORT_GROUP')));
});
test('different source creates distinct report groups', () => {
  const obj=one();obj.placements.push({...obj.placements[0],id:'two',source:'email'});
  const r=E.audit(obj);assert.equal(r.counts.groupCollisions,0);
});
test('case-only differences flagged', () => {
  const obj=one();obj.placements.push({...obj.placements[0],id:'two',label:'B',source:'Instagram'});
  const r=E.audit(obj);assert.ok(r.rows.every(row=>row.issues.some(i=>i.code==='CASE_DRIFT')));
});
test('invalid imported shapes are rejected', () => {
  for(const x of [null, [], {}, {placements:{}}, {placements:Array(81).fill({})}, {placements:[null]}]) assert.throws(()=>E.fromObject(x));
});
test('unknown properties discarded, strings length bounded', () => {
  const r=E.fromObject({campaign:'x'.repeat(999),defaultUrl:'ok',evil:1,placements:[{label:'hello',source:'a',evil:true}]});
  assert.equal(r.campaign.length,200);assert.equal(r.placements[0].evil,undefined);assert.equal(r.placements[0].id,'row-0');
});
test('bulk paste tab separator handles multiple rows', () => {
  const p=E.parseBulk('A\ta\temail\ta1\nB\tb\tsocial\tb1\thttps://example.org\tterm');
  assert.equal(p.length,2);assert.equal(p[1].term,'term'); assert.equal(p[0].destination,'');
  assert.throws(()=>E.parseBulk('A, b, c'));assert.throws(()=>E.parseBulk('a\tb\tc\td\te\tf\tg'));
});
test('CSV escapes quote, newline, and spreadsheet formulas',()=>{
  const csv=E.csv([['one','say "hello"','two\nlines','=1+1',' @SUM(1)','-42']]);
  assert.ok(csv.includes('"say ""hello"""'));assert.ok(csv.includes('"two\nlines"'));
  assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.includes('"\' @SUM(1)"'));assert.ok(csv.includes('"\'-42"'));
});
test('CSV contains original name and URL and BOM',()=>{
  const x=E.exportCsv(E.audit(one()));assert.ok(x.startsWith('\uFEFF'));assert.ok(x.includes('utm_campaign'));assert.ok(x.includes('story_01'));
});
test('immutability: auditing does not change the input model',()=>{
  const x=E.sample(), before=JSON.stringify(x);E.audit(x);assert.equal(JSON.stringify(x),before);
});
test('random URL properties and counts on 600 generated rows',()=>{
  let seed=4271;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;};
  for(let run=0;run<600;run++) {
    const n=1+(rand()%12); const obj={campaign:'camp_'+run,defaultUrl:'https://example.org/x?ref='+run+'#anchor',placements:[]};
    for(let i=0;i<n;i++) obj.placements.push({id:'p'+i,label:'line'+i,source:'s_'+(rand()%5),medium:'social',content:'c_'+i,term:''});
    const r=E.audit(obj); assert.equal(r.rows.length,n);assert.equal(r.counts.generated,n);assert.equal(r.counts.total,r.counts.ok+r.counts.warning+r.counts.error);
    for(const row of r.rows){const u=new URL(row.url);assert.equal(u.hash,'#anchor');assert.equal(u.searchParams.get('ref'),String(run));assert.equal(u.searchParams.get('utm_campaign'),obj.campaign);assert.equal(u.searchParams.get('utm_content'),row.content);}
  }
});
