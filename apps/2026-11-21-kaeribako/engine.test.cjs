const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('./engine.js');
const simple=(overrides={})=>({
 startDate:'2026-11-23',days:7,initialStock:20,
 routes:[{id:'a',name:'A',weekdays:[1,2,3,4,5,6,0],qty:5,returnDays:2,washDays:1,lossPct:0}],
 extras:[],whatIf:{extraStock:0,returnDaysCut:0,washDaysCut:0},...overrides
});
test('sample has a usable multi-route plan',()=>{const x=E.example();assert.equal(x.routes.length,3);assert.equal(x.extras.length,1);assert.equal(x.days,35);});
test('invalid date and leap day',()=>{assert.equal(E.validDate('2024-02-29'),true);assert.equal(E.validDate('2026-02-29'),false);assert.equal(E.validDate('2026-2-1'),false);assert.equal(E.validDate('nonsense'),false);});
test('date increments across year and leap day',()=>{assert.equal(E.dayISO('2024-02-28',1),'2024-02-29');assert.equal(E.dayISO('2026-12-31',1),'2027-01-01');});
test('correct weekday mapping Sunday zero',()=>{assert.equal(E.dayOfWeek('2026-11-22',0),0);assert.equal(E.dayOfWeek('2026-11-23',0),1);});
test('integer normalization clamps',()=>{assert.equal(E.integer('3.6',0,10,0),4);assert.equal(E.integer(999,0,10,0),10);assert.equal(E.integer('x',0,10,5),5);});
test('normalize removes invalid routes and extras safely',()=>{const n=E.normalize({startDate:'xxx',routes:[{id:'a',qty:3,weekdays:[1,1,10,-1],returnDays:-5},{id:'a',qty:8}],extras:[{date:'invalid',routeId:'a',qty:4}]});assert.equal(n.routes[1].id,'ax');assert.deepEqual(n.routes[0].weekdays,[1]);assert.equal(n.routes[0].returnDays,1);assert.equal(n.extras.length,0);});
test('empty plan reports no required stock',()=>{const r=E.simulate(simple({routes:[],initialStock:0}));assert.equal(r.requiredStock,0);assert.equal(r.totalDemand,0);assert.equal(r.serviceRate,1);});
test('recurring weekly dispatch is counted for 7 days',()=>{const r=E.simulate(simple());assert.equal(r.totalDemand,35);assert.equal(r.records.length,7);});
test('one-off extra dispatch matches date and route',()=>{const cfg=simple({extras:[{date:'2026-11-23',routeId:'a',qty:7}]});assert.equal(E.makeSchedule(E.normalize(cfg))[0].orders[0].qty,12);assert.equal(E.simulate(cfg).totalDemand,42);});
test('return delay: not before date, available at start of day 3',()=>{const r=E.simulate(simple());assert.equal(r.records[0].returned,0);assert.equal(r.records[1].returned,0);assert.equal(r.records[2].returned,0);assert.equal(r.records[3].returned,5);});
test('same-day wash completion when wash=0',()=>{const cfg=simple({routes:[{id:'a',name:'a',weekdays:[1],qty:5,returnDays:1,washDays:0,lossPct:0}]});const r=E.simulate(cfg);assert.equal(r.records[1].returned,5);});
test('shortage means only shipped units return',()=>{const cfg=simple({initialStock:4});const r=E.simulate(cfg);assert.equal(r.records[0].shipped,4);assert.equal(r.records[0].shortage,1);assert.equal(r.records[3].returned,4);});
test('perfect collection returns all shipment units',()=>{assert.equal(E.recovered(37,0),37);assert.equal(E.recovered(37,100),0);});
test('lost returns are rounded per actual dispatch lot',()=>{assert.equal(E.recovered(11,10),10);assert.equal(E.recovered(5,50),3);});
test('conservation of boxes across inventory, pipeline and losses',()=>{const r=E.simulate(simple({initialStock:60,routes:[{id:'a',name:'a',qty:8,weekdays:[0,1,2,3,4,5,6],returnDays:3,washDays:2,lossPct:10}]}));for(const d of r.records) assert.equal(d.available+d.inTransit+d.inWash+d.cumulativeLoss,60,JSON.stringify(d));});
test('route order selects which destination receives scarce stock',()=>{const cfg=simple({initialStock:3,routes:[{id:'a',name:'first',qty:5,weekdays:[1],returnDays:3,washDays:1,lossPct:0},{id:'b',name:'second',qty:5,weekdays:[1],returnDays:3,washDays:1,lossPct:0}]});const r=E.simulate(cfg);assert.equal(r.routeStats[0].shipped,3);assert.equal(r.routeStats[1].shipped,0);});
test('required stock for one lot equals demand',()=>{const cfg=simple({routes:[{id:'a',name:'a',qty:17,weekdays:[1],returnDays:3,washDays:1,lossPct:0}]});assert.equal(E.requiredStock(cfg).required,17);});
test('required stock is reduced by fast returns',()=>{const cfg=simple({whatIf:{extraStock:0,returnDaysCut:1,washDaysCut:1}});assert.ok(E.requiredStock(cfg,'whatIf').required<E.requiredStock(cfg).required);});
test('required stock meets full demand with no shortages',()=>{const cfg=simple();const min=E.requiredStock(cfg).required;assert.equal(E.simulate(cfg,'base',min).totalShortage,0);});
test('one fewer than required stock has a shortage',()=>{const cfg=simple();const need=E.requiredStock(cfg).required;assert.ok(E.simulate(cfg,'base',need-1).totalShortage>0);});
test('whatIf extra stock applies and base remains untouched',()=>{const cfg=simple({whatIf:{extraStock:15,returnDaysCut:1,washDaysCut:0}});assert.equal(E.simulate(cfg).initial,20);assert.equal(E.simulate(cfg,'whatIf').initial,35);});
test('returned plus shipped plus shortage counters',()=>{const r=E.simulate(simple({initialStock:7}));assert.equal(r.totalShipped+r.totalShortage,r.totalDemand);assert.equal(r.totalReturned,r.records.reduce((sum,x)=>sum+x.returned,0));});
test('CSV contains headers and all days',()=>{const r=E.simulate(simple());const csv=E.csvRows(r.records);assert.equal(csv.split('\r\n').length,8);assert.match(csv,/"日付"/);});
test('input objects are not mutated by simulation',()=>{const cfg=simple();const before=JSON.stringify(cfg);E.compare(cfg);assert.equal(JSON.stringify(cfg),before);});
test('extra date outside simulation is ignored',()=>{const cfg=simple({extras:[{date:'2028-01-01',routeId:'a',qty:99}]});assert.equal(E.simulate(cfg).totalDemand,35);});
test('never-shipped units are not artificially counted as lost',()=>{const cfg=simple({initialStock:0,routes:[{id:'a',name:'a',qty:10,weekdays:[1],returnDays:2,washDays:1,lossPct:100}]});assert.equal(E.simulate(cfg).expectedLoss,0);});
test('randomized: exact required stock and inventory conservation for 500 cases',()=>{
 let seed=37337; const rand=(n)=>{seed=(seed*1664525+1013904223)>>>0;return seed%n;};
 for(let k=0;k<500;k++){
  const rCount=1+rand(5),routes=[];
  for(let i=0;i<rCount;i++)routes.push({id:'r'+i,name:'R'+i,qty:1+rand(35),weekdays:[rand(7),rand(7),rand(7)],returnDays:1+rand(9),washDays:rand(5),lossPct:rand(28)});
  const cfg={startDate:'2026-11-23',days:7+rand(36),initialStock:rand(210),routes,
   extras:[{id:'extra1',date:'2026-11-24',routeId:routes[0].id,qty:rand(20)}],
   whatIf:{extraStock:rand(20),returnDaysCut:rand(3),washDaysCut:rand(2)}};
  for(const which of ['base','whatIf']){
   const need=E.requiredStock(cfg,which).required;
   const enough=E.simulate(cfg,which,need);
   assert.equal(enough.totalShortage,0,`case ${k} ${which} required=${need}`);
   if(need>0)assert.ok(E.simulate(cfg,which,need-1).totalShortage>0,`case ${k} ${which}`);
   const actual=E.simulate(cfg,which);
   for(const d of actual.records) assert.equal(d.available+d.inTransit+d.inWash+d.cumulativeLoss,actual.initial,`case ${k} ${which} ${d.date}`);
   assert.equal(actual.totalShipped+actual.totalShortage,actual.totalDemand);
  }
 }
});
