const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('./engine.js');
const base=()=>({...E.DEFAULT});
const close=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);

test('6 octave bands, material coefficients',()=>{
  assert.deepEqual(E.BANDS,[125,250,500,1000,2000,4000]);
  for(const m of Object.values(E.MATERIALS)) {
    assert.equal(m.a.length,6);
    for(const a of m.a)assert.ok(a>=0&&a<=1);
  }
});
test('geometry: floor, ceiling, wall, volume',()=>{
 const g=E.surfaces(E.validate({...base(),length:4,width:3,height:2.5}));
 close(g.volume,30);close(g.walls,35);close(g.floor,12);close(g.ceiling,12);
});
test('sabine: first frequency manual weighted absorption',()=>{
 const r=E.calculate({...base(),panelArea:0});
 const a=r.geo.floor*E.MATERIALS.wood.a[0]+r.geo.ceiling*E.MATERIALS.gypsum.a[0]+r.geo.walls*E.MATERIALS.gypsum.a[0];
 close(r.baseAbs[0],a);close(r.base[0],.161*r.geo.volume/a);
});
test('eyring: explicit analytic formula',()=>{
 const r=E.calculate({...base(),method:'eyring',panelArea:0});
 const S=r.geo.floor+r.geo.ceiling+r.geo.walls;
 close(r.base[2],.161*r.geo.volume/(-S*Math.log(1-r.baseAbs[2]/S)));
});
test('Eyring lower than Sabine for same material',()=>{
 const c={...base(),panelArea:4};const a=E.calculate(c),b=E.calculate({...c,method:'eyring'});
 for(let i=0;i<6;i++)assert.ok(b.after[i]<=a.after[i]);
});
test('zero panels means no change',()=>{
 const r=E.calculate({...base(),panelArea:0});assert.deepEqual(r.base,r.after);
});
test('panels replace wall, not count as extra surface',()=>{
 const c={...base(),panelArea:2};const r=E.calculate(c);
 close(r.afterAbs[3]-r.baseAbs[3],2*(E.MATERIALS.foam50.a[3]-E.MATERIALS.gypsum.a[3]));
});
test('all bands default treatment improves selected speech bands',()=>{
 const r=E.calculate(base());for(const i of [2,3,4])assert.ok(r.after[i]<r.base[i]);
});
test('non-improving panel can make RT longer',()=>{
 const r=E.calculate({...base(),wall:'ceiling',panel:'gypsum',panelArea:3});
 assert.ok(r.after[2]>r.base[2]);
});
test('material and method whitelists',()=>{
 for(const [key,val] of [['wall','javascript:bad'],['panel','unknown'],['method','bad'],['focus','ALL']])assert.throws(()=>E.validate({...base(),[key]:val}));
});
test('invalid numbers, blank, NaN and oversize area',()=>{
 for(const patch of [{width:0},{height:1},{length:'x'},{panelArea:''},{target:0},{panelArea:999},{length:1e10}])assert.throws(()=>E.report({...base(),...patch}));
});
test('default suggestion is feasible for 500–2kHz and meets target',()=>{
 const c=base();const r=E.recommend(c);assert.ok(r.feasible);assert.ok(r.area>=0&&r.area<=E.surfaces(E.validate(c)).walls);
 const res=E.calculate(c,r.area);for(const i of [2,3,4])assert.ok(res.after[i]<=c.target+1e-8);
});
test('already meeting target returns zero area',()=>{
 const r=E.recommend({...base(),target:3,wall:'ceiling',floor:'carpet',ceiling:'ceiling'});
 assert.equal(r.area,0);assert.equal(r.feasible,true);
});
test('infeasible all-band aggressive target is reported',()=>{
 const r=E.recommend({...base(),focus:'all',target:.15,panel:'drape'});
 assert.equal(r.feasible,false);assert.equal(r.area,null);
});
test('substituting a worse panel rejects infeasible target',()=>{
 const r=E.recommend({...base(),wall:'ceiling',panel:'gypsum',target:.15});
 assert.equal(r.feasible,false);
});
test('minimum required area is accurate across both formulas and 2 focuses',()=>{
 for(const method of ['sabine','eyring'])for(const focus of ['speech','all']){
   const c={...base(),method,focus,target:.9,panel:'wool100'};
   const rec=E.recommend(c);if(!rec.feasible)continue;
   const got=E.calculate(c,rec.area);
   for(const i of got.focusBands)assert.ok(got.after[i]<=c.target+1e-7);
   if(rec.area>.001){const prev=E.calculate(c,rec.area-.001);assert.ok(prev.focusBands.some(i=>prev.after[i]>c.target-1e-7));}
 }
});
test('reverse-direction panel bounds are honored with mixed materials',()=>{
 const r=E.recommend({...base(),wall:'carpet',panel:'drape',target:.9,focus:'speech'});
 if(r.feasible){const n=E.calculate({...base(),wall:'carpet',panel:'drape',target:.9,focus:'speech'},r.area);for(const i of n.focusBands)assert.ok(n.after[i]<=.9+1e-8);}
});
test('CSV includes BOM and 6 frequency rows',()=>{
 const str=E.asCSV(E.report(base()));assert.ok(str.startsWith('\uFEFF周波数'));assert.equal(str.trim().split('\r\n').length,7);
});
test('randomized forward model checks surface replacement exactness (500)',()=>{
 let seed=8675309;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const mats=Object.keys(E.MATERIALS);
 for(let j=0;j<500;j++){
  const c={...base(),length:2+rand()*10,width:2+rand()*7,height:1.8+rand()*2.2,
    wall:mats[Math.floor(rand()*mats.length)],floor:mats[Math.floor(rand()*mats.length)],ceiling:mats[Math.floor(rand()*mats.length)],panel:mats[Math.floor(rand()*mats.length)],method:rand()<.5?'eyring':'sabine'};
  const s=E.surfaces(E.validate({...c,panelArea:0}));c.panelArea=rand()*s.walls;
  const r=E.calculate(c),total=s.floor+s.ceiling+s.walls;
  for(let i=0;i<6;i++){
    const A=s.floor*E.MATERIALS[c.floor].a[i]+s.ceiling*E.MATERIALS[c.ceiling].a[i]+(s.walls-c.panelArea)*E.MATERIALS[c.wall].a[i]+c.panelArea*E.MATERIALS[c.panel].a[i];
    close(r.afterAbs[i],A);
    let T=c.method==='sabine'?.161*s.volume/A:.161*s.volume/(-total*Math.log1p(-A/total));
    close(r.after[i],T,1e-7);
  }
 }
});
test('randomized feasible inverse solves target, respects minimality (350)',()=>{
 let z=1234567;const rand=()=>{z=(Math.imul(z,1103515245)+12345)>>>0;return z/4294967296};
 const panels=['foam50','wool100','drape','ceiling'];
 for(let j=0;j<350;j++){
  const c={...base(),length:2+rand()*5,width:2+rand()*5,height:2+rand(),target:.2+rand()*1.5,method:rand()<.5?'sabine':'eyring',focus:rand()<.5?'all':'speech',panel:panels[Math.floor(rand()*panels.length)],panelArea:0};
  const rec=E.recommend(c);
  if(!rec.feasible)continue;
  const res=E.calculate(c,rec.area);
  for(const i of res.focusBands)assert.ok(res.after[i]<=c.target+2e-8,`test ${j} freq ${i}`);
  if(rec.area>.0001){const before=E.calculate(c,Math.max(0,rec.area-0.0001));assert.ok(before.focusBands.some(i=>before.after[i]>c.target-1e-7));}
 }
});
