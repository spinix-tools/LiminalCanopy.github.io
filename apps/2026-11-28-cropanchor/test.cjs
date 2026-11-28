const fs=require('node:fs'),assert=require('node:assert/strict');
const src=fs.readFileSync(__dirname+'/index.html','utf8').split('// CORE START')[1].split('// CORE END')[0];
eval(src+`
let seed=174;function rand(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n}
// Independent convex-envelope oracle: enumerate all pairwise intersections of affine edge-loss lines.
function oracle(W,H,sizes,regions){return Math.max(...[0,1].map(k=>{const L=k?H:W,lines=[[0,0]];for(const s of sizes){const C=k?Math.min(H,W*s.h/s.w):Math.min(W,H*s.w/s.h),m=L-C;for(const r of regions){const p=k?r.y:r.x,q=p+(k?r.h:r.w);lines.push([m,-p],[-m,q-C])}}const candidates=[0,1];for(const [m,b] of lines)for(const [n,c] of lines)if(m!==n){const x=(c-b)/(m-n);if(x>=0&&x<=1)candidates.push(x)}return Math.min(...candidates.map(x=>Math.max(...lines.map(([m,b])=>m*x+b))))}))}
const sizes=[{w:600,h:600},{w:480,h:600},{w:960,h:540}],regions=[{x:510,y:120,w:200,h:95},{x:565,y:220,w:210,h:210}];
assert.equal(audit(1000,600,sizes,regions,.5,.5).filter(r=>r.worst<=EPS).length,2);
assert.equal(solve(1000,600,sizes,regions).worst,0);
assert.equal(solve(100,100,[{w:50,h:100}],[{x:0,y:0,w:100,h:100}]).feasible,false);
assert.ok(Math.abs(solve(100,100,[{w:50,h:100}],[{x:0,y:0,w:100,h:100}]).worst-25)<1e-5);
assert.equal(solve(100,100,sizes,[]).worst,0);
for(let i=0;i<400;i++){const W=1+rand(500),H=1+rand(500),ss=Array.from({length:1+rand(8)},()=>({w:1+rand(600),h:1+rand(600)})),rr=Array.from({length:rand(10)},()=>{const x=rand(W),y=rand(H);return {x,y,w:1+rand(W-x),h:1+rand(H-y)}}),v=solve(W,H,ss,rr),o=oracle(W,H,ss,rr);assert.ok(Math.abs(v.worst-o)<2e-5,JSON.stringify({v,o,W,H,ss,rr}));assert.equal(v.feasible,o<1e-7);assert.ok(v.x>=0&&v.x<=1&&v.y>=0&&v.y<=1)}
console.log('5 fixed assertions + 400 independent envelope comparisons passed');`);
