'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');

test('one sheet has exactly eight panels',()=>{
  assert.equal(E.PAGE_COUNT,8);
  assert.deepEqual(E.order(),[[7,6,5,4],[8,1,2,3]]);
  assert.deepEqual([0,1].flatMap(r=>[0,1,2,3].map(c=>E.logicalIndex(r,c))).sort(),[0,1,2,3,4,5,6,7]);
});
test('each of eight imposition cells maps correctly',()=>{
  for (let r=0;r<2;r++)for(let c=0;c<4;c++)assert.equal(E.logicalIndex(r,c),E.order()[r][c]-1);
});
test('invalid positions rejected',()=>{
  for(const p of [[-1,0],[2,0],[0,4],[0,-1],[.5,2]])assert.throws(()=>E.logicalIndex(...p),RangeError);
});
test('default book normalizes and returns eight pages',()=>{
  const p=E.normalize(E.makeDefault());assert.equal(p.pages.length,8);assert.equal(p.direction,'vertical');assert.equal(p.version,1);
});
test('serialized project round-trips unchanged',()=>{
  const p=E.makeDefault();p.pages[1].body='💮折本\nxyz';p.pages[0].title='めぐる';p.guides=false;
  assert.deepEqual(E.parseJSON(E.serialize(p)),p);
});
test('rejected malformed json',()=>{
  assert.throws(()=>E.parseJSON('{bad'));assert.throws(()=>E.parseJSON('{}'));assert.throws(()=>E.parseJSON('[]'));
});
test('wrong page count rejected',()=>{
  assert.throws(()=>E.normalize({pages:[]}));assert.throws(()=>E.normalize({pages:new Array(7).fill({})}));
});
test('untrusted HTML remains plain text',()=>{
  const p=E.makeDefault();p.pages[1].body='<img src=x onerror=alert(1)>';
  assert.equal(E.parseJSON(E.serialize(p)).pages[1].body,'<img src=x onerror=alert(1)>');
});
test('unsafe image URLs rejected',()=>{
  const p=E.makeDefault();p.pages[2].image='https://example.com/a.png';assert.equal(E.normalize(p).pages[2].image,'');
  p.pages[2].image='data:image/svg+xml;base64,aaaa';assert.equal(E.normalize(p).pages[2].image,'');
  p.pages[2].image='data:image/jpeg;base64,aGVsbG8=';assert.equal(E.normalize(p).pages[2].image,p.pages[2].image);
});
test('normalization clamps font size and fields',()=>{
  const p=E.makeDefault();p.fontSize=100;p.direction='diagonal';p.paper='weird';p.pages[0].title='a'.repeat(900);
  const q=E.normalize(p);assert.equal(q.fontSize,23);assert.equal(q.direction,'vertical');assert.equal(q.paper,'warm');assert.equal(q.pages[0].title.length,200);
  p.fontSize=-40;assert.equal(E.normalize(p).fontSize,11);
});
test('metrics count codepoints, images and all pages',()=>{
  const p=E.makeDefault();p.pages=p.pages.map(()=>({title:'',body:'',image:''}));p.pages[0].body='A😊 B\n';p.pages[1].title='花';
  assert.deepEqual(E.metrics(p),{pages:8,characters:4,perPage:[3,1,0,0,0,0,0,0],images:0});
});
test('all paper palettes return valid colors',()=>{
  for(const x of ['warm','blue','rose','sage','lavender'])assert.match(E.palette(x),/^#[0-9a-f]{6}$/);
});
test('safe filename removes separators',()=>{
  assert.equal(E.safeFile('a/b:c?d'),'a-b-c-d');assert.equal(E.safeFile(''), 'kotoori');
});