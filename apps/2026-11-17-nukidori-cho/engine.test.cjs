const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('./engine.js');
function choose(n,k){if(k<0||k>n)return 0;let p=1;for(let i=1;i<=k;i++)p=p*(n-i+1)/i;return p;}
function reference(N,D,n,c){let sum=0;for(let k=0;k<=c;k++)sum+=choose(D,k)*choose(N-D,n-k)/choose(N,n);return sum;}
for(const [N,D,n,c] of [[10,2,3,0],[10,2,3,1],[10,2,3,2],[10,10,3,2],[10,10,3,3],[10,0,7,0],[7,4,5,2],[7,4,5,3],[4,1,4,0],[4,1,4,1],[20,6,2,1]]){
 test(`hypergeometric N=${N},D=${D},n=${n},c=${c}`,()=>assert.ok(Math.abs(E.acceptance(N,D,n,c)-reference(N,D,n,c))<1e-10));
}
test('full inspection distinguishes different counts',()=>{
 assert.equal(E.acceptance(20,1,20,1),1);
 assert.equal(E.acceptance(20,2,20,1),0);
});
test('boundary validation',()=>{
 assert.throws(()=>E.acceptance(5,3,6,0));
 assert.throws(()=>E.search({N:100,good:10,bad:5,alpha:20,beta:20,maxN:90}));
});
test('search meets risk limits',()=>{
 const p=E.search({N:240,good:1,bad:9,alpha:15,beta:20,maxN:160});
 assert.ok(p.found,JSON.stringify(p));assert.ok(p.alpha<=0.15+1e-12);assert.ok(p.beta<=0.2+1e-12);
});
test('search reports unmet plan honestly',()=>{
 const p=E.search({N:240,good:1,bad:9,alpha:5,beta:5,maxN:2});
 assert.equal(p.found,false);assert.ok(p.closest);
});
test('same seed same sample and no duplicates',()=>{
 const a=E.pick(240,70,'ユニット001');assert.deepEqual(a,E.pick(240,70,'ユニット001'));
 assert.equal(new Set(a).size,70);assert.ok(a.every(x=>x>=1&&x<=240));
});
test('different seeds change sample',()=>assert.notDeepEqual(E.pick(50,9,'a'),E.pick(50,9,'b')));
test('full lot sample contains all IDs',()=>assert.deepEqual(E.pick(7,7,'seed'),[1,2,3,4,5,6,7]));
test('decision pending / reject early / accept when done',()=>{
 assert.equal(E.decision(['ok','', ''],0).verdict,'pending');
 assert.equal(E.decision(['ng','', ''],0).verdict,'reject');
 assert.equal(E.decision(['ok','ng','ok'],1).verdict,'accept');
});
test('csv quotes and UTF8 bom',()=>assert.ok(E.csv([['a,"b"','あ']]).startsWith('\ufeff"a,""b""","あ"')));
test('rounded finite defective counts',()=>{
 const r=E.risk(10,3,0,1,9);assert.equal(r.Dgood,0);assert.equal(r.Dbad,1);
});