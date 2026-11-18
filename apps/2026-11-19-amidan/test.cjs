// AMIDAN self-contained Node.js tests. Run: node test.cjs
"use strict";
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const script=html.match(/<script id="engine">([\s\S]*?)<\/script>/);
assert.ok(script,"engine script must be present");
const ctx={};vm.runInNewContext(script[1],ctx);
const A=ctx.AMIDAN;
const d={project:"test",gaugeSt:22,gaugeRow:28,startCm:20,endCm:34,lengthCm:40,multiple:2,offset:0,headGap:4,tailGap:4,side:"odd"};
let count=0;
function check(name,fn){try{fn();count++;console.log("PASS "+name);}catch(err){console.error("FAIL "+name+": "+err.message);process.exitCode=1;}}
const p=A.makePlan(d);
check("default cast on",()=>assert.equal(p.start,44));
check("default final stitches",()=>assert.equal(p.end,74));
check("default row count",()=>assert.equal(p.total,112));
check("default increase count",()=>assert.equal(p.events.length,15));
check("last row ends at target",()=>assert.equal(p.rows.at(-1).stitches,p.end));
check("sum of increases equals stitch delta",()=>assert.equal(p.rows.reduce((a,b)=>a+b.delta,0),p.end-p.start));
check("only odd rows when requested",()=>assert.ok(p.events.every(a=>a.row%2===1)));
check("head and tail padding",()=>assert.ok(p.events.every(a=>a.row>4&&a.row<=p.total-4)));
check("no event collision",()=>assert.equal(new Set(p.events.map(a=>a.row)).size,p.events.length));
check("pattern is valid at endpoints",()=>assert.ok(p.start%2===0&&p.end%2===0));
const down=A.makePlan({...d,startCm:34,endCm:20});
check("decrease direction",()=>assert.ok(down.events.length===15&&down.events.every(a=>a.delta===-2)));
check("equal widths no event",()=>assert.equal(A.makePlan({...d,endCm:20}).events.length,0));
check("even rows when requested",()=>assert.ok(A.makePlan({...d,side:"even"}).events.every(a=>a.row%2===0)));
check("all rows mode",()=>assert.equal(A.makePlan({...d,side:"all"}).events.length,15));
const rep=A.makePlan({...d,multiple:3,offset:1});
check("nontrivial motif endpoints",()=>assert.ok(rep.start%3===1&&rep.end%3===1));
check("broken motif count range",()=>assert.ok(rep.bad>=0&&rep.bad<=rep.total));
check("invalid side rejected",()=>assert.throws(()=>A.makePlan({...d,side:"wrong"})));
check("invalid motif offset rejected",()=>assert.throws(()=>A.makePlan({...d,offset:2})));
check("too many rows rejected",()=>assert.throws(()=>A.makePlan({...d,gaugeRow:100,lengthCm:120})));
check("insufficient shaping rows rejected",()=>assert.throws(()=>A.makePlan({...d,headGap:90,tailGap:20})));
check("empty numeric input rejected",()=>assert.throws(()=>A.makePlan({...d,startCm:""})));
check("216 combinations conserve stitches and avoid overlaps",()=>{
 let n=0;
 for(let m=1;m<=8;m++)for(const s of ["odd","even","all"])for(const a of [10,20,32])for(const b of [10,20,32]){
  const q=A.makePlan({...d,multiple:m,offset:0,side:s,startCm:a,endCm:b,headGap:0,tailGap:0});
  assert.equal(q.rows.at(-1).stitches,q.end);
  assert.equal(q.events.length,Math.abs(q.end-q.start)/2);
  assert.ok(q.events.every(x=>x.row>=1&&x.row<=q.total));
  assert.equal(new Set(q.events.map(x=>x.row)).size,q.events.length);
  n++;
 }
 assert.equal(n,216);
});
console.log(count+"/22 test groups passed; exit="+(process.exitCode||0));
