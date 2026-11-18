/* Node.js 18+ / node --test engine.test.cjs
   Uses the EXACT inline engine inside index.html, not a reimplementation. */
"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const page=fs.readFileSync(__dirname+"/index.html","utf8");
const match=page.match(/<script id="engine">([\s\S]*?)<\/script>/);
assert.ok(match,"Inline engine present");
const sandbox={};vm.runInNewContext(match[1],sandbox);
const E=sandbox.CashEngine;
const tx=(date,kind,amount,extra={})=>({name:"予定",date,kind,amount,repeat:"once",uncertain:false,...extra});
const m=(items=[],extra={})=>({start:"2026-11-18",days:30,opening:100000,reserve:50000,items,...extra});
test("UTC dates and invalid calendar dates",()=>{assert.equal(E.shiftDay("2028-02-28",1),"2028-02-29");assert.throws(()=>E.dayNumber("2026-02-29"));assert.throws(()=>E.dayNumber("2026-13-01"))});
test("Month end clamp preserves original anchor",()=>{assert.equal(E.shiftMonth("2027-01-31",1),"2027-02-28");assert.equal(E.shiftMonth("2027-01-31",2),"2027-03-31")});
test("daily ledger includes day 0",()=>assert.equal(E.forecast(m([tx("2026-11-18","out",30000)])).rows[0].balance,70000));
test("scheduled outside start and horizon excluded",()=>assert.equal(E.forecast(m([tx("2026-11-17","out",50000),tx("2026-12-19","in",40000)])).end,100000));
test("same day net sum",()=>assert.equal(E.forecast(m([tx("2026-11-19","in",20000),tx("2026-11-19","out",30000)])).rows[1].net,-10000));
test("uncertain incoming is delayed",()=>assert.equal(E.forecast(m([tx("2026-11-19","in",80000,{uncertain:true})]),10).rows[1].balance,100000));
test("known incoming is never delayed",()=>assert.equal(E.forecast(m([tx("2026-11-19","in",80000)]),10).rows[1].balance,180000));
test("outgoing never delayed",()=>assert.equal(E.forecast(m([tx("2026-11-19","out",80000,{uncertain:true})]),10).rows[1].balance,20000));
test("deficit and first breach dates",()=>{const x=E.forecast(m([tx("2026-11-19","out",160000)]));assert.equal(x.min,-60000);assert.equal(x.shortfall,110000);assert.equal(x.negative,"2026-11-19")});
test("single receipt rescue scenario is ranked",()=>{const x=m([tx("2026-11-19","in",80000,{uncertain:true}),tx("2026-11-20","out",120000)]);assert.equal(E.candidates(x,20)[0].gain,80000)});
test("CSV includes BOM and header",()=>{const x=E.forecast(m());assert.equal(E.dailyCSV(x,x).split("\r\n").length,32);assert.ok(E.dailyCSV(x,x).charCodeAt(0)===65279)});
test("maximum 150 entries and 120 days",()=>{const t=tx("2026-11-19","in",1);assert.doesNotThrow(()=>E.validate(m(Array(150).fill(t),{days:120})));assert.throws(()=>E.validate(m(Array(151).fill(t))))});
test("negative and malformed amounts rejected",()=>{assert.throws(()=>E.validate(m([tx("2026-11-19","in",-100)])));assert.throws(()=>E.validate(m([tx("2026-11-19","in",Infinity)])))});
test("overrides do not disturb other incoming",()=>{const x=m([tx("2026-11-19","in",30000,{uncertain:true}),tx("2026-11-20","in",20000,{uncertain:true})]);assert.equal(E.forecast(x,10,{0:0}).rows[1].balance,130000)});
