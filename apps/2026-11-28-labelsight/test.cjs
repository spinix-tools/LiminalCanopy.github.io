const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const core=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const {defs,solve,assess}=vm.runInNewContext(core+';({defs,solve,assess})');
const c=Object.fromEntries(defs.map(([k,n,d])=>[k,d]));const v=[{name:'low',eye:1050,d:1500},{name:'mid',eye:1300,d:1800},{name:'high',eye:1600,d:2200}];
let r=solve(c,v);assert.equal(r.before.count,0);assert.equal(r.best.count,3);assert.equal(r.best.z,1210);assert.equal(JSON.stringify(r.ranges),'[[1210,1500]]');assert.throws(()=>solve({...c,step:0},v));assert.throws(()=>solve(c,[{name:'bad',eye:1000,d:600}]));assert.equal(assess({...c,bar:2000},v[0],1100).visibility,'blocked');assert.equal(assess({...c,bar:0,angle:180},v[0],1100).pass,false);assert.equal(assess({...c,bar:0,tilt:1},v[0],1100).pass,false);assert.equal(assess({...c,bar:980,clear:0}, {name:'edge',eye:980,d:1500},1100).visibility,'partial');
let seed=123;function rand(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n}
for(let i=0;i<500;i++){
 const p={...c,center:900+rand(600),bar:rand(1600),glyph:5+rand(45),step:1+rand(60),angle:5+rand(60),tilt:5+rand(50)};
 const views=Array.from({length:1+rand(6)},(_,j)=>({name:'v'+j,eye:600+rand(1400),d:601+rand(3000)}));
 function ref(z,a){const y=z-p.panel/2;let clear=true;for(let t=0;t<=20;t++){let x=p.near+p.width*t/20;if((a.eye*x+y*(a.d-x))/a.d<=p.bar+p.clear)clear=false}const u=z-p.glyph/2-a.eye,w=z+p.glyph/2-a.eye;const theta=Math.atan2(a.d*(w-u),a.d*a.d+u*w)*10800/Math.PI;return clear&&theta+1e-9>=p.angle&&Math.abs(Math.atan((z-a.eye)/a.d))*180/Math.PI<=p.tilt+1e-9}
 const grid=[];for(let z=p.min;z<=p.max;z+=p.step)grid.push({z,n:views.filter(a=>ref(z,a)).length});grid.sort((a,b)=>b.n-a.n||Math.abs(a.z-p.center)-Math.abs(b.z-p.center)||a.z-b.z);const got=solve(p,views);assert.equal(got.best.z,grid[0].z);assert.equal(got.best.count,grid[0].n);const passing=grid.filter(a=>a.n===views.length).map(a=>a.z).sort((a,b)=>a-b);const expanded=Array.from(got.ranges).flatMap(([a,b])=>Array.from({length:(b-a)/p.step+1},(_,j)=>a+j*p.step));assert.deepEqual(expanded,passing);
}
assert.equal(solve({...c,min:100,max:4000,panel:100,step:1},Array.from({length:12},(_,i)=>({name:'v'+i,eye:800+i*100,d:1000+i*100}))).best.rows.length,12);
console.log('PASS: 10 fixed assertions, 500 independent grid comparisons, 1 capacity assertion');
