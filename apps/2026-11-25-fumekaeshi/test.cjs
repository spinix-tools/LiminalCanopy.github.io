const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const core=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script id="core">([\s\S]*?)<\/script>/)[1];
assert.equal(vm.runInNewContext(core+'\nselfTest()'),306);
console.log('306 checks passed (300 exhaustive comparisons, 6 fixed checks)');
