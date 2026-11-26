const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/index.html','utf8');const ctx=vm.createContext({});vm.runInContext(html.match(/<script id="core">([\s\S]*?)<\/script>/)[1]+';globalThis.api=Core',ctx);const {calibrate,plan}=ctx.api;
const rows=(s,side='upright')=>[...s].map(number=>({number,side}));
assert.equal(calibrate(rows('123')).reverse,false);assert.equal(calibrate(rows('321')).reverse,true);
for(const s of ['132','213','231','312','111','122',''])assert.equal(calibrate(rows(s)).ok,false);
for(const side of ['inverted','same','missing',''])assert.equal(calibrate(rows('123',side)).ok,false);
for(const n of [0,1,501,2.5,NaN])assert.throws(()=>plan(n,calibrate(rows('123'))));assert.throws(()=>plan(8,{ok:false}));
let cases=0;for(let n=2;n<=500;n++)for(const order of ['123','321']){const p=plan(n,calibrate(rows(order)));assert.equal(p.front.length,Math.ceil(n/2));assert.equal(p.blank,n%2?n+1:null);assert.equal(new Set([...p.front,...p.back]).size,p.padded);const feed=order==='321'?[...p.front].reverse():[...p.front];for(let j=0;j<feed.length;j++)assert.equal(p.back[j],feed[j]+1);cases++}
console.log('PASS: calibration, invalid inputs, '+cases+' page-order cases (2–500, both directions)');
