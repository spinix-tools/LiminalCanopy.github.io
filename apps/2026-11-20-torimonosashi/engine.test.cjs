const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const demo = E.demo();
const A=E.DEFAULT_A, B=E.DEFAULT_B;
function sample(overrides={}) {return {id:'x',date:'2026-09-10',site:'川沿い',minutes:60,complete:true,sightings:[],...overrides};}
test('demo dataset is independently cloned',()=>{const a=E.demo();a.sessions[0].minutes=1;assert.notEqual(E.demo().sessions[0].minutes,1);});
test('demo is a fully valid project',()=>assert.equal(E.normalizeProject(demo).sessions.length,13));
test('strict ISO date validation including leap day',()=>{assert.equal(E.dateOK('2024-02-29'),true);assert.equal(E.dateOK('2025-02-29'),false);assert.equal(E.dateOK('2026-13-01'),false);assert.equal(E.dateOK('2026-11-20'),true);});
test('unicode normalization and repeated species are merged',()=>assert.deepEqual(E.parseSightings('ｽｽﾞﾒ,２\nスズメ，3'),[{species:'スズメ',count:5}]));
test('empty observation is allowed',()=>assert.deepEqual(E.parseSightings('  \n'),[]));
test('malformed observation rows rejected',()=>{for(const bad of ['スズメ','スズメ,-2','スズメ,0','スズメ,1.2','スズメ,10000',',2','スズメ,2,3'])assert.throws(()=>E.parseSightings(bad));});
test('invalid raw observations rejected',()=>{for(const ov of [{date:'2026-02-29'},{site:''},{minutes:0},{minutes:1441},{complete:'yes'},{sightings:[{species:'x',count:0}]}])assert.throws(()=>E.normalizeSession(sample(ov)));});
test('duplicate sightings in JSON rejected',()=>assert.throws(()=>E.normalizeSession(sample({sightings:[{species:'a',count:2},{species:'a',count:1}]}))));
test('period must be valid and ordered',()=>{assert.throws(()=>E.normalizePeriod({start:'2026-12-01',end:'2026-01-01'}));assert.throws(()=>E.normalizePeriod({start:'junk',end:'2026-11-20'}));});
test('zero complete sessions means null not zero detection rate',()=>{const r=E.summarize([sample({complete:false,sightings:[{species:'x',count:2}]})],B,'x');assert.equal(r.n,0);assert.equal(r.rate,null);assert.equal(r.partial,1);});
test('complete no-sighting session is denominator',()=>{const r=E.summarize([sample(),sample({id:'y',sightings:[{species:'a',count:2}]})],B,'a');assert.equal(r.n,2);assert.equal(r.present,1);assert.equal(r.rate,.5);assert.equal(r.individuals,2);assert.equal(r.perHour,1);});
test('partial sessions ignored in both numerator and denominator',()=>{const r=E.summarize([sample(),sample({id:'y',complete:false,sightings:[{species:'a',count:10}]})],B,'a');assert.equal(r.rate,0);assert.equal(r.individuals,0);assert.equal(r.partial,1);});
test('site filter avoids mixing habitats',()=>{const r=E.summarize([sample({site:'川沿い',sightings:[{species:'a',count:2}]}),sample({id:'2',site:'公園'})],B,'a','川沿い');assert.equal(r.n,1);assert.equal(r.rate,1);});
test('day interval bounds are inclusive',()=>{const r=E.summarize([sample({date:'2026-09-01'}),sample({id:'2',date:'2026-11-30'}),sample({id:'3',date:'2026-12-01'})],B,'a');assert.equal(r.n,2);});
test('Wilson interval boundaries are valid',()=>{assert.equal(E.wilson(0,0),null);const lo=E.wilson(0,10),hi=E.wilson(10,10);assert.equal(lo.lo,0);assert.equal(hi.hi,1);assert.ok(lo.hi>0&&hi.lo<1);});
test('difference is B minus A',()=>{const r=E.compare({sessions:[sample({date:'2026-03-01',sightings:[]}),sample({id:'b',date:'2026-09-01',sightings:[{species:'x',count:1}]})]},{a:A,b:B,species:'x'});assert.equal(r.delta,1);});
test('monthly buckets exclude incomplete sessions',()=>{const rows=E.monthly([sample({date:'2026-09-01',sightings:[{species:'x',count:1}]}),sample({id:'t',date:'2026-09-12',complete:false})],'x');assert.equal(rows[0].n,1);assert.equal(rows[0].rate,1);});
test('project JSON rejects duplicate ids and excessive records',()=>{assert.throws(()=>E.normalizeProject({version:1,sessions:[sample(),sample()]}));assert.throws(()=>E.normalizeProject({version:2,sessions:[]}));});
test('CSV escapes formulas, double quotes, and adds BOM',()=>{const csv=E.toCSV([sample({site:'=HYPERLINK("oops")',sightings:[{species:'+danger',count:1}]})]);assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes("'+danger"));assert.ok(csv.includes('""oops""'));});
test('demo A/B rates differ from raw counts for example',()=>{const r=E.compare(demo,{a:A,b:B,species:'シジュウカラ'});assert.equal(r.a.n,6);assert.equal(r.b.n,6);assert.equal(r.b.partial,1);assert.ok(r.a.hours>r.b.hours*2);assert.equal(r.a.present,4);assert.equal(r.b.present,5);assert.equal(r.a.rate,4/6);assert.equal(r.b.rate,5/6);});
test('species list yields deduplicated sorted values',()=>{const s=E.speciesList(demo.sessions);assert.equal(s.length,new Set(s).size);assert.ok(s.includes('カワセミ'));});
test('deterministic random checks: presence, counts, interval within bounds',()=>{
  let seed=42;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let trial=0;trial<400;trial++){
    const records=[];let present=0,complete=0,total=0,mins=0;
    for(let i=0;i<7;i++){
      const full=rnd()<.8;const seen=rnd()<.5;const count=1+Math.floor(rnd()*6);const minutes=10+Math.floor(rnd()*130);
      records.push(sample({id:'r'+i,complete:full,minutes,sightings:seen?[{species:'x',count}]:[]}));
      if(full){complete++;mins+=minutes;if(seen){present++;total+=count;}}
    }
    const r=E.summarize(records,B,'x');assert.equal(r.n,complete);assert.equal(r.present,present);assert.equal(r.individuals,total);assert.equal(r.minutes,mins);assert.equal(r.rate,complete?present/complete:null);
    if(r.interval){assert.ok(r.interval.lo>=0&&r.interval.hi<=1&&r.interval.lo<=r.rate+1e-12&&r.interval.hi>=r.rate-1e-12);}
  }
});