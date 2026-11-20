const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const P = E.PALETTE;
const A = P.pink.rgb, B = P.blue.rgb;
const approx = (a,b,tol=0.02) => assert.ok(Math.abs(a-b)<=tol, `${a} != ${b}`);
test('palette contains distinct ink triples',()=>{
  for(const ink of Object.values(P)) {assert.equal(ink.rgb.length,3);for(const v of ink.rgb) assert.ok(v>=0&&v<=255);} 
  assert.notDeepEqual(A,B);
});
test('white uses no ink',()=>{
  const [a,b]=E.separatePixel([255,255,255],A,B);
  approx(a,0);approx(b,0);
});
test('each named ink can be reconstructed with corresponding plate',()=>{
  for(const [a,b,target] of [[1,0,A],[0,1,B]]) {
    const [x,y]=E.separatePixel(target,A,B);
    approx(x,a,.005);approx(y,b,.005);
    const r=E.reconstruction(x,y,A,B);
    for(let i=0;i<3;i++) assert.ok(Math.abs(r[i]-target[i])<=1);
  }
});
test('clamped and stable if inks coincide',()=>{
  const values=E.separatePixel([0,0,0],A,A);
  for(const v of values) assert.ok(Number.isFinite(v)&&v>=0&&v<=1);
});
test('composite takes image size and preserves paper white',()=>{
  const pix=E.renderComposite(new Uint8ClampedArray(9),new Uint8ClampedArray(9),3,3,A,B);
  assert.equal(pix.length,36);for(let i=0;i<pix.length;i+=4)assert.deepEqual(Array.from(pix.slice(i,i+4)),[255,255,255,255]);
});
test('offset moves plate B only',()=>{
  const a=Uint8ClampedArray.from([0,0,0,0]);const b=Uint8ClampedArray.from([255,0,0,0]);
  const shifted=E.renderComposite(a,b,2,2,A,B,1,0);
  assert.deepEqual(Array.from(shifted.slice(0,4)),[255,255,255,255]);
  assert.deepEqual(Array.from(shifted.slice(4,8)).slice(0,3),B);
});
test('plate grayscale reverses density',()=>{
  assert.deepEqual(Array.from(E.plateGrayscale(Uint8ClampedArray.from([0,128,255]))),[255,255,255,255,127,127,127,255,0,0,0,255]);
});
test('separateImage validates shape',()=>{
  assert.throws(()=>E.separateImage(Uint8ClampedArray.from([1,2,3]),2,2,A,B),/不正/);
});
test('opaque black has maximum ink constraints',()=>{
  const source=Uint8ClampedArray.from([0,0,0,255]);const r=E.separateImage(source,1,1,A,B);
  assert.ok(r.a[0]>0||r.b[0]>0);
  for(const n of Object.values(r.stats)) assert.ok(Number.isFinite(n));
});
test('transparent pixels are white',()=>{
  const r=E.separateImage(Uint8ClampedArray.from([200,10,10,0]),1,1,A,B);
  assert.equal(r.a[0],0);assert.equal(r.b[0],0);
});
test('turning off one ink produces zero mask',()=>{
  const r=E.separateImage(Uint8ClampedArray.from([30,100,60,255]),1,1,A,B,1,0,1);
  assert.equal(r.a[0],0);
});
test('same input deterministic',()=>{
  const data=Uint8ClampedArray.from([23,99,160,255,130,150,30,255]);
  const r=E.separateImage(data,2,1,A,B);const s=E.separateImage(data,2,1,A,B);
  assert.deepEqual(r,s);
});
test('300 random pixel property checks (0..255, valid statistics, bounded reconstruction)',()=>{
  let seed=5171;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<300;i++){
    const rgba=Uint8ClampedArray.from([rnd()*255,rnd()*255,rnd()*255,255]);
    const inks=[A,B,P.yellow.rgb,P.green.rgb,P.black.rgb];
    const inkA=inks[(rnd()*inks.length)|0],inkB=inks[(rnd()*inks.length)|0];
    const r=E.separateImage(rgba,1,1,inkA,inkB,0.6+rnd(),rnd(),rnd());
    assert.ok(r.a[0]>=0&&r.a[0]<=255&&r.b[0]>=0&&r.b[0]<=255);
    for(const v of Object.values(r.stats)) assert.ok(Number.isFinite(v)&&v>=0&&v<=255);
    const composite=E.renderComposite(r.a,r.b,1,1,inkA,inkB,0,0);
    assert.equal(composite.length,4);assert.equal(composite[3],255);
  }
});
