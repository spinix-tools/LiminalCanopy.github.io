/* 釣銭リハ — pure calculation module. MIT License. No dependencies. */
(function (global, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (global) global.ChangeLab = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DENOMS = Object.freeze([10000, 5000, 1000, 500, 100, 50, 10, 5, 1]);
  const SAMPLE_FLOAT = Object.freeze([0, 0, 12, 9, 24, 8, 20, 10, 10]);
  const SAMPLE_ROWS = Object.freeze([
    {name:'焼き菓子', price:350, tender:1000},
    {name:'ドリンク', price:450, tender:1000},
    {name:'セット', price:800, tender:5000},
    {name:'焼き菓子', price:350, tender:1000},
    {name:'ドリンク', price:450, tender:500},
    {name:'セット', price:800, tender:10000},
  ]);
  const asInt = (value, min, max) => {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < min || n > max) throw new RangeError('数値が範囲外です: ' + value);
    return n;
  };
  const money = (counts) => DENOMS.reduce((sum, d, i) => sum + d * counts[i], 0);
  function counts(input) {
    if (!Array.isArray(input) || input.length !== DENOMS.length) throw new Error('金種は9種類必要です');
    return input.map(x => asInt(x, 0, 9999));
  }
  function exactTender(price) {
    let rest = asInt(price, 1, 10000);
    return DENOMS.map(d => {
      const n = Math.floor(rest / d); rest %= d; return n;
    });
  }
  function tenderFor(row) {
    const price = asInt(row.price, 1, 10000);
    if (row.tender === 'exact') return exactTender(price);
    const paid = asInt(row.tender, 1, 10000);
    const i = DENOMS.indexOf(paid);
    if (i < 0 || paid < price) throw new Error('支払金種が価格より小さいか、未対応です');
    const out = DENOMS.map(() => 0); out[i] = 1; return out;
  }
  // Minimum-piece bounded change: greedy alone can fail when a larger coin is missing.
  // Memoized enumeration; ties prefer larger denominations. Items are never created.
  function findChange(amount, drawer) {
    amount = asInt(amount, 0, 10000);
    const stock = counts(drawer);
    const memo = new Map();
    const solve = (i, remaining) => {
      if (remaining === 0) return {pieces:0, plan:DENOMS.map(() => 0)};
      if (i === DENOMS.length) return null;
      if (remaining < 0) return null;
      const key = i * 10001 + remaining;
      if (memo.has(key)) return memo.get(key);
      const d = DENOMS[i];
      const max = Math.min(stock[i], Math.floor(remaining / d));
      let best = null;
      // Larger denominations first; any equal-piece answer keeps first.
      for (let n = max; n >= 0; n--) {
        const sub = solve(i + 1, remaining - n * d);
        if (!sub) continue;
        const pieces = n + sub.pieces;
        if (!best || pieces < best.pieces) {
          const plan = sub.plan.slice(); plan[i] = n;
          best = {pieces, plan};
        }
      }
      memo.set(key, best);
      return best;
    };
    const answer = solve(0, amount);
    return answer ? answer.plan : null;
  }
  function checkRow(row) {
    if (!row || typeof row !== 'object') throw new Error('取引データが不正です');
    const price = asInt(row.price, 1, 10000);
    const name = String(row.name || '会計').trim().slice(0, 40);
    const tender = row.tender === 'exact' ? 'exact' : asInt(row.tender, 1, 10000);
    tenderFor({price, tender});
    return {name, price, tender};
  }
  function runQueue(initial, rows) {
    const stock = counts(initial);
    if (!Array.isArray(rows) || rows.length > 300) throw new Error('取引は300件以内にしてください');
    const events = [];
    let sales = 0, received = 0, changeGiven = 0, failAt = -1;
    for (let j = 0; j < rows.length; j++) {
      let row, incoming;
      try { row = checkRow(rows[j]); incoming = tenderFor(row); }
      catch (error) {
        events.push({index:j, ok:false, reason:'invalid', message:error.message, name:String(rows[j]?.name||'入力エラー').slice(0,40), before:stock.slice()});
        failAt = j; break;
      }
      const paid = money(incoming), change = paid - row.price;
      const withPayment = stock.map((v,i) => v + incoming[i]);
      const out = findChange(change, withPayment);
      if (out === null) {
        events.push({index:j, ...row, ok:false, reason:'shortage', paid, change,
          message:'現在の金種ではお釣りを構成できません', before:stock.slice(), afterReceive:withPayment});
        failAt = j; break;
      }
      const next = withPayment.map((v,i) => v - out[i]);
      if (next.some(v => v < 0)) throw new Error('内部計算: マイナス在庫');
      events.push({index:j, ...row, ok:true, paid, change, out, before:stock.slice(), after:next.slice()});
      for (let i = 0; i < next.length; i++) stock[i] = next[i];
      sales += row.price; received += paid; changeGiven += change;
    }
    return {events, final:stock, sales, received, changeGiven, failAt,
      complete:failAt === -1, processed:events.filter(e=>e.ok).length,
      opening:money(counts(initial)), closing:money(stock)};
  }
  // Compute a feasible small top-up at the failure point. Optimize first for
  // the fewest added pieces, then for the least cash added. This is an
  // immediate-recovery suggestion, not a guaranteed opening-float optimum.
  function rescue(event) {
    if (!event || event.reason !== 'shortage') return null;
    const current = counts(event.afterReceive);
    const amount = asInt(event.change, 1, 10000);
    const memo = new Map();
    function solve(i, remaining) {
      if (remaining === 0) return {needed:0,cost:0,pieces:0,plan:empty()};
      if (i === DENOMS.length) return null;
      const key=i*10001+remaining;
      if(memo.has(key)) return memo.get(key);
      const d=DENOMS[i];
      let best=null;
      const max=Math.floor(remaining/d);
      for(let n=max;n>=0;n--){
        const sub=solve(i+1,remaining-n*d);
        if(!sub)continue;
        const shortage=Math.max(0,n-current[i]);
        const candidate={needed:shortage+sub.needed,cost:shortage*d+sub.cost,pieces:n+sub.pieces};
        if (!best || candidate.needed<best.needed ||
            (candidate.needed===best.needed && candidate.cost<best.cost) ||
            (candidate.needed===best.needed && candidate.cost===best.cost && candidate.pieces<best.pieces)) {
          candidate.plan=sub.plan.slice();candidate.plan[i]=n;best=candidate;
        }
      }
      memo.set(key,best);return best;
    }
    function empty(){return DENOMS.map(()=>0);}
    const result=solve(0,amount);
    if(!result || result.needed===0)return null;
    const additions=result.plan.map((v,i)=>Math.max(0,v-current[i]));
    return {additions,count:result.needed,value:result.cost,plan:result.plan};
  }
  function random(seed) {
    let s = (Number(seed) >>> 0) || 1;
    return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  }
  const choose = (weights, rng) => {
    const sum = weights.reduce((a,b)=>a+b,0); let x = rng()*sum;
    for(let i=0;i<weights.length;i++){ x-=weights[i]; if (x < 0) return i; }
    return weights.length-1;
  };
  function createQueue(menu, n, weights, rng) {
    return Array.from({length:n}, () => {
      const price = menu[Math.floor(rng()*menu.length)];
      const kind = choose(weights,rng);
      let tender = ['exact',1000,5000,10000][kind];
      if (tender !== 'exact' && tender < price) tender = [1000,5000,10000].find(x=>x>=price) || 'exact';
      return {name:'想定客', price, tender};
    });
  }
  function validateStress(settings) {
    const menu = settings.menu.map(n => asInt(n, 1, 10000));
    if (!menu.length || menu.length>30) throw new Error('価格は1〜30個登録してください');
    const customers = asInt(settings.customers,1,100);
    const trials = asInt(settings.trials,1,300);
    const seed = asInt(settings.seed,0,4294967295);
    const weights = settings.weights.map(v=>asInt(v,0,100));
    if (weights.length!==4 || !weights.some(x=>x>0)) throw new Error('支払い方の比率を入力してください');
    return {menu,customers,trials,seed,weights};
  }
  function stress(initial, settings) {
    const c = counts(initial); const cfg=validateStress(settings);
    const rng = random(cfg.seed);
    let successes=0, totalProcessed=0, firstFailureTotal=0, failures=0;
    const failingSamples=[];
    const shortByDenom = DENOMS.map(()=>0);
    for(let t=0;t<cfg.trials;t++){
      const queue = createQueue(cfg.menu,cfg.customers,cfg.weights,rng);
      const result = runQueue(c,queue);
      totalProcessed += result.processed;
      if(result.complete) successes++;
      else {
        failures++;
        firstFailureTotal += result.failAt + 1;
        const e = result.events.at(-1);
        // Costly recovery guidance is sampled only on the first 15 failures.
        if(e.reason === 'shortage' && failures <= 15) {
          const tip=rescue(e);
          if(tip)tip.additions.forEach((n,i)=>{if(n)shortByDenom[i]++;});
        }
        if(failingSamples.length<3) failingSamples.push({trial:t+1,step:result.failAt+1,
          price:e.price || null, tender:e.tender ?? null, change:e.change ?? null, reason:e.reason});
      }
    }
    const top = shortByDenom.map((count,i)=>({denom:DENOMS[i],count})).filter(x=>x.count)
      .sort((a,b)=>b.count-a.count || b.denom-a.denom)[0]||null;
    return {successes,failures,trials:cfg.trials,passRate:successes/cfg.trials,
      averageProcessed:totalProcessed/cfg.trials,
      firstFailAverage:failures ? firstFailureTotal/failures:null,
      samples:failingSamples, hint:top, assumptions:cfg};
  }
  function toCSV(rows) {
    const quote = (x) => {
      let s=String(x ?? '');
      if (/^[\s]*[=+@-]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s="'"+s;
      return '"'+s.replace(/"/g,'""')+'"';
    };
    return '\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
  }
  return {DENOMS,SAMPLE_FLOAT,SAMPLE_ROWS,asInt,money,counts,exactTender,tenderFor,
    findChange,checkRow,runQueue,rescue,random,createQueue,validateStress,stress,toCSV};
});
