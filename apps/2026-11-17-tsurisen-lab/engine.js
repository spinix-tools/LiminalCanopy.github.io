/* つり銭ラボ — deterministic, offline calculation engine (MIT). */
(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.TsuriEngine = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DENOMS = Object.freeze([10000, 5000, 2000, 1000, 500, 100, 50, 10, 5, 1]);
  const START = Object.freeze([0, 0, 0, 8, 10, 20, 10, 20, 10, 20]);
  const PAY_WEIGHTS = Object.freeze({10000: 9, 5000: 20, 2000: 3, 1000: 62, 500: 6});
  const version = 1;
  const copy = value => JSON.parse(JSON.stringify(value));
  const totalCash = counts => DENOMS.reduce((sum, d, i) => sum + d * (Number(counts[i]) || 0), 0);
  const validInteger = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
  const sum = a => a.reduce((s, x) => s + x, 0);

  function newState() {
    return { version, opening: [...START], sales: [], products: [
      {id: 'p1', name: 'ポストカード', price: 350, weight: 5},
      {id: 'p2', name: 'ミニ雑貨', price: 750, weight: 4},
      {id: 'p3', name: 'アクセサリー', price: 1200, weight: 3},
      {id: 'p4', name: 'ギフトセット', price: 2800, weight: 1}
    ], physical: null };
  }
  function validateCounts(counts) {
    if (!Array.isArray(counts) || counts.length !== DENOMS.length || !counts.every(x => validInteger(x, 0, 999))) throw Error('金種は0～999枚の整数で入力してください。');
    return counts;
  }
  function validateProduct(p) {
    if (!p || typeof p.id !== 'string' || p.id.length > 60 || !/^[a-zA-Z0-9-]+$/.test(p.id)) throw Error('商品IDが不正です。');
    if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 50) throw Error('商品名は1～50文字で入力してください。');
    if (!validInteger(p.price, 1, 10000)) throw Error('価格は1～10,000円の整数にしてください。');
    if (!validInteger(p.weight, 1, 100)) throw Error('販売比重は1～100の整数にしてください。');
    return p;
  }
  function normalizeState(raw) {
    if (!raw || raw.version !== 1) throw Error('対応していないバックアップ形式です。');
    validateCounts(raw.opening);
    if (!Array.isArray(raw.products) || raw.products.length > 100) throw Error('商品は100件までです。');
    raw.products.forEach(validateProduct);
    if (new Set(raw.products.map(p => p.id)).size !== raw.products.length) throw Error('商品IDの重複があります。');
    if (!Array.isArray(raw.sales) || raw.sales.length > 2000) throw Error('取引は2,000件までです。');
    const cleaned = {version, opening: [...raw.opening], products: raw.products.map(p => ({id:p.id, name:p.name, price:p.price,weight:p.weight})), sales: [], physical: null};
    for (const s of raw.sales) {
      if (!s || !validInteger(s.amount, 1, 10000) || !DENOMS.includes(s.tender) || s.tender < s.amount) throw Error('取引内容が不正です。');
      if (typeof s.id !== 'string' || s.id.length > 60 || typeof s.label !== 'string' || s.label.length > 150 || typeof s.at !== 'string' || s.at.length > 40) throw Error('取引履歴の書式が不正です。');
      validateCounts(s.change);
      if (totalCash(s.change) !== s.tender - s.amount) throw Error('お釣りの金額が一致しません。');
      cleaned.sales.push({id:s.id, label:s.label, amount:s.amount, tender:s.tender, change:[...s.change],at:s.at});
    }
    if (raw.physical != null) {validateCounts(raw.physical); cleaned.physical = [...raw.physical];}
    // Verify that every imported transaction is physically possible in the declared order.
    getDrawer(cleaned);
    return cleaned;
  }
  function changeByGreedy(amount, stock) {
    const used = DENOMS.map(() => 0);
    let rest = amount;
    for (let i = 0; i < DENOMS.length; i++) {
      const n = Math.min(stock[i], Math.floor(rest / DENOMS[i]));
      used[i] = n; rest -= n * DENOMS[i];
    }
    return rest === 0 ? used : null;
  }
  // Exact feasibility fallback using bounded binary-knapsack with immutable parent chains.
  // Greedy is intentionally the fast first choice, not a promise of globally fewest coins.
  function makeChange(amount, available) {
    validateCounts(available);
    if (!validInteger(amount, 0, 10000)) throw Error('お釣りは0～10,000円で指定してください。');
    if (amount === 0) return DENOMS.map(() => 0);
    if (totalCash(available) < amount) return null;
    const quick = changeByGreedy(amount, available);
    if (quick) return quick;
    const dp = new Array(amount+1).fill(null); dp[0] = {pieces:0, prev:null, index:-1, quantity:0};
    for (let i=0;i<DENOMS.length;i++) {
      let remaining = Math.min(available[i], Math.floor(amount / DENOMS[i]));
      for (let block=1; remaining>0; block*=2) {
        const q = Math.min(block, remaining); remaining -= q;
        const v = DENOMS[i]*q;
        for (let a=amount; a>=v;a--) {
          const from = dp[a-v]; if (!from) continue;
          const pieces = from.pieces + q;
          if (!dp[a] || pieces < dp[a].pieces) dp[a] = {pieces, prev:from, index:i, quantity:q};
        }
      }
    }
    const node = dp[amount]; if (!node) return null;
    const result = DENOMS.map(() => 0);
    for (let n=node; n && n.index !== -1; n=n.prev) result[n.index] += n.quantity;
    if (totalCash(result) !== amount || result.some((n,i)=>n>available[i])) throw Error('内部計算エラー');
    return result;
  }
  function drawerAfter(drawer, sale) {
    const next = [...drawer];
    const index = DENOMS.indexOf(sale.tender);
    if (index < 0 || !validInteger(sale.amount, 1, 10000) || sale.amount > sale.tender) throw Error('預かり金または金額が不正です。');
    next[index] += 1;
    for (let i=0; i<DENOMS.length;i++) {
      next[i] -= sale.change[i];
      if (next[i] < 0) throw Error('取引履歴に金種不足があります。');
    }
    if (totalCash(next) !== totalCash(drawer) + sale.amount) throw Error('金額検算に失敗しました。');
    return next;
  }
  function getDrawer(state) {
    validateCounts(state.opening);
    let drawer = [...state.opening];
    for(const sale of state.sales) drawer = drawerAfter(drawer, sale);
    return drawer;
  }
  function quote(drawer, amount, tender) {
    if (!validInteger(amount, 1, 10000)) throw Error('売上金額が不正です。');
    if (!DENOMS.includes(tender) || tender < amount) throw Error('預かり金額が売上より小さいか、単一金種ではありません。');
    const available = [...drawer]; available[DENOMS.indexOf(tender)]++;
    const change = makeChange(tender-amount, available);
    return {amount, tender, due:tender-amount, change, possible: !!change};
  }
  function recordSale(state, label, amount, tender, at = new Date().toISOString()) {
    if (state.sales.length >= 2000) throw Error('取引上限に達しました。CSVを出力し新しい会計を開始してください。');
    const current = getDrawer(state); const q = quote(current,amount,tender);
    if (!q.possible) throw Error('現在の金種では、お釣りを正確に返せません。');
    const sale = {id:'s'+Date.now().toString(36)+'-'+state.sales.length.toString(36),label:String(label).slice(0,150), amount,tender,change:q.change,at:String(at).slice(0,40)};
    return {...state, sales:[...state.sales,sale], physical:null};
  }
  function undoLast(state) {return {...state, sales:state.sales.slice(0,-1), physical:null};}
  function cashSummary(state) {
    const drawer = getDrawer(state);
    const revenue = sum(state.sales.map(s => s.amount));
    const expected = totalCash(state.opening)+revenue;
    return {drawer, opening:totalCash(state.opening), revenue, expected, transactions:state.sales.length,
      physical:state.physical ? totalCash(state.physical) : null,
      difference:state.physical ? totalCash(state.physical)-expected : null};
  }
  function random(seed) {
    let s=(seed>>>0) || 0x51a77e;
    return () => {s ^= s<<13; s ^= s>>>17; s ^= s<<5; return (s>>>0)/4294967296;};
  }
  function weightedPick(items, weights, rand) {
    let total=0; weights.forEach(w => total+=w);
    let r=rand()*total;
    for(let i=0;i<items.length;i++) {r-=weights[i]; if(r<0) return items[i];}
    return items[items.length-1];
  }
  function simulate(products, starting, options={}) {
    validateCounts(starting);
    if (!Array.isArray(products) || !products.length) throw Error('シミュレーションには商品が1件以上必要です。');
    products.forEach(validateProduct);
    const trials=options.trials==null?100:options.trials;
    const visits=options.visits==null?35:options.visits;
    if (!validInteger(trials, 1, 300) || !validInteger(visits, 1, 300) || trials * visits > 20000) throw Error('試行は最大20,000会計までです（件数×試行回数）。');
    const rand=random(options.seed==null?20261117:options.seed);
    let clean=0, shortages=0, firstFailSum=0, firstFailN=0;
    const byChange={};
    const byProduct={};
    let allSuccessful=0;
    for (let t=0;t<trials;t++) {
      let drawer=[...starting], fail=0;
      for(let k=0;k<visits;k++) {
        const product=weightedPick(products,products.map(p=>p.weight),rand);
        const pay=DENOMS.filter(d=>PAY_WEIGHTS[d] && d>=product.price);
        const tender=weightedPick(pay,pay.map(d=>PAY_WEIGHTS[d]),rand);
        const q=quote(drawer,product.price,tender);
        if(!q.possible) {
          fail++; shortages++;
          byChange[q.due]=(byChange[q.due]||0)+1;
          byProduct[product.name]=(byProduct[product.name]||0)+1;
          if (fail===1){firstFailSum+=k+1;firstFailN++;}
        } else {drawer=drawerAfter(drawer,{amount:product.price,tender,change:q.change});allSuccessful++;}
      }
      if (fail===0) clean++;
    }
    return {trials, visits, noShortageRate:clean/trials, noShortageRuns:clean, shortageCount:shortages,
      successfulSales:allSuccessful, avgShortages:shortages/trials,
      avgFirstShortageSale:firstFailN?firstFailSum/firstFailN:null,
      riskyChanges:Object.entries(byChange).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([amount,n])=>({amount:+amount,count:n})),
      riskyProducts:Object.entries(byProduct).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([name,n])=>({name,count:n}))};
  }
  function csvCell(v){const s=String(v ?? ''); const guarded = /^[=+@\-]/.test(s.trimStart()) ? "'"+s : s;return '"'+guarded.replace(/"/g,'""')+'"';}
  function salesCSV(state) {
    const header = ['日時','商品/注文','売上(円)','預かり(円)','お釣り(円)',...DENOMS.map(x=>'返却'+x+'円')];
    const rows=state.sales.map(s=>[s.at,s.label,s.amount,s.tender,s.tender-s.amount,...s.change]);
    return '\uFEFF'+[header,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
  }
  return {DENOMS,START,newState,validateCounts,validateProduct,normalizeState,makeChange,quote,recordSale,undoLast,getDrawer,totalCash,cashSummary,random,simulate,salesCSV};
});