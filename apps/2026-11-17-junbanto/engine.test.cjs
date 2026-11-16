const assert=require('node:assert/strict');
const test=require('node:test');
const E=require('./engine.js');
const t0='2026-11-17T01:00:00Z';
const t=E.exampleTemplates()[0];
test('sample template validates',()=>assert.equal(E.validateTemplate(t),true));
test('beginRun snapshots independent of templates',()=>{const r=E.beginRun(t,t0);t.steps[0].title='edited';assert.notEqual(r.steps[0].title,t.steps[0].title)});
test('all pending cannot finish',()=>{const r=E.beginRun(t,t0);assert.equal(E.assess(r).eligible,false);assert.throws(()=>E.closeRun(r,'completed'))});
test('mandatory step cannot be skipped',()=>{const r=E.beginRun(t,t0);assert.throws(()=>E.updateStep(r,'e1','skipped','理由'))});
test('optional skip requires reason',()=>{const r=E.beginRun(t,t0);assert.throws(()=>E.updateStep(r,'e3','skipped',' '));assert.equal(E.updateStep(r,'e3','skipped','不要なため').steps[2].status,'skipped')});
test('blocker blocks completion',()=>{let r=E.beginRun(t,t0);r=E.updateStep(r,'e1','blocked','動線再調整');for(const x of r.steps.slice(1))r=E.updateStep(r,x.id,'done');assert.equal(E.assess(r).eligible,false);assert.equal(E.assess(r).blocked,1)});
test('all done can complete',()=>{let r=E.beginRun(t,t0);for(const s of r.steps)r=E.updateStep(r,s.id,'done','',t0);assert.equal(E.assess(r).eligible,true);r=E.closeRun(r,'completed');assert.equal(r.status,'completed')});
test('cannot change completed run',()=>{let r=E.beginRun(t,t0);for(const s of r.steps)r=E.updateStep(r,s.id,'done');r=E.closeRun(r,'completed');assert.throws(()=>E.updateStep(r,'e1','blocked'))});
test('incomplete closure retains blockers',()=>{let r=E.beginRun(t,t0);r=E.updateStep(r,'e1','blocked','未解決');r=E.closeRun(r,'incomplete');assert.equal(r.steps[0].status,'blocked')});
test('Markdown report includes condition and provenance disclaimer',()=>{const r=E.beginRun(t,t0),m=E.markdown(r);assert.match(m,/実行記録/);assert.match(m,/判定条件/);assert.match(m,/自己申告/)})
test('backup roundtrip state',()=>{const a=E.initial();a.runs.push(E.beginRun(a.templates[0],t0));assert.equal(E.validateState(JSON.parse(JSON.stringify(a))),true)});
test('invalid backup rejected',()=>{assert.throws(()=>E.validateState({version:999,templates:[],runs:[]}));assert.throws(()=>E.validateState({version:1,templates:[{id:'bad',title:'x',steps:[]}],runs:[]}))});
test('Markdown note special characters escaped',()=>{let r=E.beginRun(t,t0);r=E.updateStep(r,'e1','done','<script> **hi**');assert.match(E.markdown(r),/\\\*\\\*hi\\\*\\\*/)});