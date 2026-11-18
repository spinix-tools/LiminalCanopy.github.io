/* TSURIKAGO cash float simulation engine. MIT License. No dependencies. */
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TsuriEngine = api;
})(typeof globalThis === 'object' ? globalThis : this, function() {
  'use strict';
  const DENOMS = [10000, 5000, 1000, 500, 100, 50, 10, 5, 1];
  const PACKS = {1000:2,500:4,100:10,50:10,10:20,5:10,1:20};
  const yen = n => '¥' + Math.round(n).toLocaleString('ja-JP');
  const total = counts => DENOMS.reduce((s, d, i) => s + d * (counts[i] || 0), 0);
  const makeRng = seed => { let s = (Number(seed) >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; };
  function splitExact(amount) {
    if (!Number.isSafeInteger(amount) || amount < 0) throw Error('Invalid amount');
    const out = Array(DENOMS.length).fill(0);
    for (let i=0; i<DENOMS.length; i++) { out[i] = Math.floor(amount / DENOMS[i]); amount %= DENOMS[i]; }
    return out;
  }
  function makeChange(counts, amount) {
    if (!Number.isSafeInteger(amount) || amount < 0) return null;
    if (amount === 0) return Array(DENOMS.length).fill(0);
    if (total(counts) < amount) return null;
    const greedy = Array(DENOMS.length).fill(0);
    let left = amount;
    for (let i = 0; i < DENOMS.length; i++) {
      greedy[i] = Math.min(counts[i] || 0, Math.floor(left / DENOMS[i]));
      left -= greedy[i] * DENOMS[i];
    }
    if (left === 0) return greedy;
    const memo = new Set();
    const candidate = Array(DENOMS.length).fill(0);
    const suffix = Array(DENOMS.length+1).fill(0);
    for (let i=DENOMS.length-1;i>=0;i--) suffix[i] = suffix[i+1]+ (counts[i]||0)*DENOMS[i];
    function dfs(i, rem) {
      if (rem === 0) { candidate.fill(0, i); return true; }
      if (i === DENOMS.length || suffix[i] < rem) return false;
      const key = `${i}:${rem}`;
      if (memo.has(key)) return false;
      const takeMax = Math.min(counts[i] || 0, Math.floor(rem / DENOMS[i]));
      const takeMin = Math.max(0, Math.ceil((rem-suffix[i+1]) / DENOMS[i]));
      for (let q=takeMax; q>=takeMin; q--) {
        candidate[i]=q;
        if (dfs(i+1, rem-q*DENOMS[i])) return true;
      }
      candidate[i]=0; memo.add(key); return false;
    }
    return dfs(0, amount) ? candidate : null;
  }
  function weightedPick(rows, rng) {
    const valid = rows.filter(x => Number(x.weight)>0);
    const sum = valid.reduce((s,x)=>s+Number(x.weight),0);
    if (!sum) return null;
    let r = rng()*sum;
    for (const x of valid) { r-=Number(x.weight); if(r<0) return x; }
    return valid[valid.length-1];
  }
  function sanitize(raw) {
    const items = (Array.isArray(raw.items) ? raw.items : []).slice(0,20).map((x,i)=>({
      name:String(x.name || `商品${i+1}`).slice(0,30), price:Math.floor(Number(x.price)), weight:Number(x.weight)
    })).filter(x=>Number.isSafeInteger(x.price)&&x.price>=1&&x.price<=10000&&Number.isFinite(x.weight)&&x.weight>=0);
    if (!items.some(x=>x.weight>0)) throw Error('商品と販売比率を1件以上設定してください');
    const float = DENOMS.map((d,i)=>Math.max(0,Math.min(1000,Math.floor(Number((raw.float||[])[i]) || 0))));
    const payment = ['exact','1000','5000','10000'].map((id,i)=>({id,weight:Math.max(0,Math.min(100,Number(typeof (raw.payment||[])[i] === 'object' ? (raw.payment||[])[i]?.weight : (raw.payment||[])[i])||0))}));
    if (payment.every(x=>x.weight===0)) throw Error('支払方法の比率を設定してください');
    const transactions = Math.max(1,Math.min(250,Math.floor(Number(raw.transactions)||80)));
    const repeats = Math.max(1,Math.min(300,Math.floor(Number(raw.repeats)||80)));
    const seed = (Number(raw.seed)>>>0)||311;
    return {items,float,payment,transactions,repeats,seed};
  }
  function oneRun(config, seed, collectLog=false) {
    let drawer = config.float.slice();
    const rng = makeRng(seed);
    const log = [];
    let completed=0, missing=0, firstShortfall=null;
    for (let step=0;step<config.transactions;step++) {
      const item = weightedPick(config.items,rng);
      const eligible = config.payment.filter(x=>x.id==='exact'||Number(x.id)>=item.price);
      const pay = weightedPick(eligible,rng) || {id:'exact'};
      const face = pay.id==='exact' ? item.price : Number(pay.id);
      const incoming = pay.id==='exact' ? splitExact(item.price) : DENOMS.map(d=>d===face?1:0);
      const proposed = drawer.map((v,i)=>v+incoming[i]);
      const change = face-item.price;
      const outgoing = makeChange(proposed,change);
      if (!outgoing) {
        missing++;
        const ideal = splitExact(change);
        firstShortfall = DENOMS.map((d,i)=>({denom:d,need:Math.max(0,ideal[i]-proposed[i])})).filter(x=>x.need>0);
        if (collectLog) log.push({step:step+1,item:item.name,price:item.price,face,change,ok:false});
        break;
      }
      drawer = proposed.map((v,i)=>v-outgoing[i]);
      completed++;
      if(collectLog && (log.length<15 || step===config.transactions-1)) log.push({step:step+1,item:item.name,price:item.price,face,change,ok:true});
    }
    return {completed,missing,firstShortfall,drawer,log};
  }
  function simulate(input) {
    const config = sanitize(input);
    const runs=[];
    let successes=0, stepSum=0, exhaustedCount=Array(DENOMS.length).fill(0);
    for (let i=0;i<config.repeats;i++) {
      const res=oneRun(config,(config.seed + Math.imul(i+1,2654435761))>>>0,i===0);
      if(res.completed===config.transactions) successes++;
      stepSum+=res.completed;
      if(res.missing) res.drawer.forEach((n,j)=>{if(!n) exhaustedCount[j]++});
      runs.push(res);
    }
    const sorted=runs.map(x=>x.completed).sort((a,b)=>a-b);
    return {config,successes,successRate:100*successes/config.repeats,avgCompleted:stepSum/config.repeats,medianCompleted:sorted[Math.floor((sorted.length-1)/2)],minCompleted:sorted[0],maxCompleted:sorted[sorted.length-1],exhaustedCount,sample:runs[0],runs:config.repeats};
  }
  function recommend(input, budget) {
    const config = sanitize(input);
    const limit=Math.max(0,Math.min(50000,Math.floor(Number(budget)||0)));
    const quick={...config,repeats:Math.min(35,config.repeats)};
    const base=simulate(quick);
    const options=[];
    for (const [face,qty] of Object.entries(PACKS)) {
      const d=Number(face), cost=d*qty, index=DENOMS.indexOf(d);
      if(cost>limit) continue;
      const next={...quick,float:quick.float.map((v,i)=>i===index?v+qty:v)};
      const s=simulate(next);
      options.push({denom:d,qty,cost,successRate:s.successRate,avgCompleted:s.avgCompleted,deltaSuccess:s.successRate-base.successRate,deltaCompleted:s.avgCompleted-base.avgCompleted});
    }
    options.sort((a,b)=>b.deltaSuccess-a.deltaSuccess||b.deltaCompleted-a.deltaCompleted||a.cost-b.cost);
    return {base,options,best:options[0]||null};
  }
  return {DENOMS,PACKS,yen,total,makeRng,splitExact,makeChange,weightedPick,sanitize,oneRun,simulate,recommend};
});
