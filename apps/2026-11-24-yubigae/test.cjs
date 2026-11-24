const fs=require('node:fs'), assert=require('node:assert/strict');
const m={exports:{}}; new Function('module',fs.readFileSync(__dirname+'/index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1])(m);
const {Q,corpus,metrics,search,valid}=m.exports;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
assert.ok(valid(Q));assert.ok(!valid('a'.repeat(26)));assert.equal(corpus('a ! Bあc').n,3);assert.equal(corpus('a ! Bあc').pairs.reduce((a,b)=>a+b,0),0);
near(metrics(Q,corpus('aa')).cost,1.85);near(metrics(Q,corpus('aq')).cost,2.85);near(metrics(Q,corpus('af')).cost,1.425);near(metrics(Q,corpus('aj')).cost,1.3);
const alphabet='abcdefghijklmnopqrstuvwxyz';let seed=123456;const rnd=n=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)%n);
function reference(l,s){let total=0,n=0,prev=null;for(let ch of s.toLowerCase()){if(!alphabet.includes(ch)){prev=null;continue}let i=l.indexOf(ch),row=i<10?0:i<19?1:2,col=i-[0,10,19][row],finger=[0,1,2,3,3,4,4,5,6,7][col];total+=1+[.5,0,.7][row]+[.6,.3,.1,0,0,.1,.3,.6][finger];if(prev)total+=prev.ch===ch?.5:prev.finger===finger?2:(prev.finger<4)===(finger<4)?.25:0;prev={ch,finger};n++}return total/n}
for(let t=0;t<200;t++){let l=[...Q];for(let i=25;i>0;i--){let j=rnd(i+1);[l[i],l[j]]=[l[j],l[i]]}l=l.join('');let s=Array.from({length:100},()=> (alphabet+' .!')[rnd(29)]).join('');near(metrics(l,corpus(s)).cost,reference(l,s))}
for(let t=0;t<20;t++){let texts=Array.from({length:3},()=>Array.from({length:80},()=>alphabet[rnd(26)]).join(''));let mode=t%2?'mean':'worst',lim=t%3;let res=search(Q,texts.map(corpus),'zxcv',lim,mode);assert.equal(res.all.length,231);for(const item of res.all){assert.equal(item.next.length,26);assert.ok(!/[zxcv]/.test(item.swap));let ds=texts.map(s=>100*(reference(Q,s)-reference(item.next,s))/reference(Q,s));ds.forEach((d,i)=>near(d,item.d[i]));assert.equal(item.ok,Math.min(...ds)>=-lim-1e-9)}for(let i=1;i<res.all.length;i++){let a=res.all[i-1],b=res.all[i];assert.ok(Number(a.ok)>=Number(b.ok));if(a.ok===b.ok)assert.ok((mode==='mean'?a.mean-b.mean:a.worst-b.worst)>=-1e-9)}}
assert.equal(search(Q,[corpus('abc')],alphabet,0,'worst').all.length,0);
console.log('fixed assertions passed; 200 independent sequence checks; 20 searches / 4620 candidates checked');
