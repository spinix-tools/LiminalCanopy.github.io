/* AME MARCHE — offline, deterministic, testable calculation engine. MIT. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AmeEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_PRODUCTS = 12;
  const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const bounded = (v, lo, hi, fallback = 0) => Math.min(hi, Math.max(lo, finite(v, fallback)));
  const int = (v, lo, hi, fallback = lo) => Math.round(bounded(v, lo, hi, fallback));
  const DEFAULT = {
    rain: 35,
    hourlyGoal: 1200,
    products: [
      {id: 1, name:'刺繍ブローチ', price:1800, cost:510, stock:20, mix:45, leftover:0},
      {id: 2, name:'布小物', price:1200, cost:340, stock:26, mix:35, leftover:0},
      {id: 3, name:'焼き菓子', price:350, cost:130, stock:40, mix:20, leftover:130}
    ],
    plans: [
      {id:'A', name:'屋外テント', booth:3500, travel:1500, misc:750, visitorsSun:450, visitorsRain:140, conversion:14, fee:3.25, hours:8},
      {id:'B', name:'屋内会場', booth:7000, travel:1200, misc:500, visitorsSun:350, visitorsRain:310, conversion:14, fee:3.25, hours:8}
    ]
  };
  function cleanProduct(p, i) {
    if (!p || typeof p !== 'object') throw new Error('商品データが不正です');
    const name = String(p.name ?? '').trim().slice(0,32);
    if (!name) throw new Error('商品名は必須です');
    return {id: int(p.id, 1, 10000000, i + 1), name, price:bounded(p.price, 0, 1000000), cost:bounded(p.cost, 0, 1000000), stock:int(p.stock, 0, 5000), mix:bounded(p.mix, 0, 10000), leftover:bounded(p.leftover, 0, 1000000)};
  }
  function cleanPlan(p, i) {
    if (!p || typeof p !== 'object') throw new Error('出店案データが不正です');
    return {id:i===0?'A':'B', name:String(p.name??'').trim().slice(0,32)||'案'+(i+1),
      booth:bounded(p.booth,0,10000000), travel:bounded(p.travel,0,10000000), misc:bounded(p.misc,0,10000000),
      visitorsSun:int(p.visitorsSun,0,100000),visitorsRain:int(p.visitorsRain,0,100000),
      conversion:bounded(p.conversion,0,100),fee:bounded(p.fee,0,100),hours:bounded(p.hours,0.5,72,8)};
  }
  function validate(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.products) || !Array.isArray(raw.plans) || raw.plans.length !== 2 || raw.products.length < 1 || raw.products.length > MAX_PRODUCTS) {
      throw new Error('設定には1〜12商品・2出店案が必要です');
    }
    const products = raw.products.map(cleanProduct);
    if (new Set(products.map(x=>x.id)).size !== products.length) throw new Error('商品IDが重複しています');
    if (!products.some(x=>x.mix > 0)) throw new Error('需要比率がすべて0です');
    return {rain:bounded(raw.rain,0,100), hourlyGoal:bounded(raw.hourlyGoal,0,1000000), products,
      plans:raw.plans.map(cleanPlan)};
  }
  function initial(){return validate(JSON.parse(JSON.stringify(DEFAULT)));}
  function fixed(p){return p.booth+p.travel+p.misc;}
  function mixWeights(products){const total=products.reduce((s,p)=>s+p.mix,0);return products.map(p=>p.mix/total);}
  // Counts sold are capped by stock. Unsold loss is charged once for EVERY leftover unit.
  function fromDemand(plan, products, demands) {
    let revenue=0, variableCosts=0, fees=0, remainingLoss=0, soldTotal=0, askedTotal=0;
    const items=products.map((p,i)=>{
      const demand=Math.max(0,finite(demands[i]));
      const sold=Math.min(p.stock,demand);
      const left=p.stock-sold;
      const lineRevenue=sold*p.price;
      const lineFees=lineRevenue*plan.fee/100;
      const lineCosts=sold*p.cost;
      const lineLoss=left*p.leftover;
      revenue+=lineRevenue; fees+=lineFees;variableCosts+=lineCosts;remainingLoss+=lineLoss;
      soldTotal+=sold;askedTotal+=demand;
      return {name:p.name, sold, left, requested:demand, revenue:lineRevenue, contribution:lineRevenue-lineFees-lineCosts-lineLoss};
    });
    const cashProfit=revenue-variableCosts-fees-remainingLoss-fixed(plan);
    return {revenue, variableCosts, fees, remainingLoss, fixedCost:fixed(plan), profit:cashProfit, soldTotal, unmet:Math.max(0,askedTotal-soldTotal), items};
  }
  function expectedWeather(plan,products,raining){
    const traffic=raining?plan.visitorsRain:plan.visitorsSun;
    const weights=mixWeights(products);
    return {...fromDemand(plan,products,weights.map(w=>traffic*plan.conversion/100*w)), visitors:traffic};
  }
  function expectedResult(plan, products, rain){
    const r=bounded(rain,0,100)/100;
    const sun=expectedWeather(plan,products,false), wet=expectedWeather(plan,products,true);
    return {sun, rain:wet, expectedProfit:sun.profit*(1-r)+wet.profit*r,
      expectedRevenue:sun.revenue*(1-r)+wet.revenue*r,
      expectedSold:sun.soldTotal*(1-r)+wet.soldTotal*r};
  }
  function rng(seed=20261120){let s=Number(seed)>>>0;return function(){s=(Math.imul(1664525,s)+1013904223)>>>0;return (s+0.5)/4294967296;};}
  // Exact Knuth algorithm at small lambda; normal approximation for large Poisson means.
  function poisson(lambda,random){
    if(!(lambda>0)) return 0;
    if(lambda<30){const L=Math.exp(-lambda);let k=0,p=1;do{k++;p*=random();}while(p>L);return k-1;}
    const u1=Math.max(1e-12,random()),u2=random();
    const z=Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);
    return Math.max(0,Math.round(lambda+Math.sqrt(lambda)*z));
  }
  function quantile(sorted,p){if(!sorted.length)return 0;const n=(sorted.length-1)*p;const a=Math.floor(n),f=n-a;return sorted[a]+(sorted[Math.min(a+1,sorted.length-1)]-sorted[a])*f;}
  // Use common weather and common uniform streams across plans to make A/B risk comparisons stable.
  function simulate(config, trials=1600, seed=20261120){
    const data=validate(config),random=rng(seed),weights=mixWeights(data.products);
    const profits=data.plans.map(()=>[]), profitsSun=[[],[]],profitsRain=[[],[]];
    for(let i=0;i<trials;i++){
      const rain=random()*100<data.rain;
      // For each plan, sample realized visitors and product purchases conditional on weather.
      data.plans.forEach((p,j)=>{
        const traffic=rain?p.visitorsRain:p.visitorsSun;
        const realizedVisitors=poisson(traffic,random);
        const demands=weights.map(w=>poisson(realizedVisitors*p.conversion/100*w,random));
        const profit=fromDemand(p,data.products,demands).profit;
        profits[j].push(profit);(rain?profitsRain[j]:profitsSun[j]).push(profit);
      });
    }
    return profits.map((arr,j)=>{
      const sorted=[...arr].sort((a,b)=>a-b), n=sorted.length;
      const mean=arr.reduce((a,b)=>a+b,0)/n;
      return {mean,p10:quantile(sorted,.1),p50:quantile(sorted,.5),p90:quantile(sorted,.9),
        lossRate:arr.filter(x=>x<0).length/n, goalRate:arr.filter(x=>x>=data.hourlyGoal*data.plans[j].hours).length/n,
        hours:data.plans[j].hours,sunSampleCount:profitsSun[j].length,rainSampleCount:profitsRain[j].length};
    });
  }
  function grid(config){const data=validate(config);return Array.from({length:11},(_,i)=>{
    const rain=i*10;
    return {rain,A:expectedResult(data.plans[0],data.products,rain).expectedProfit,B:expectedResult(data.plans[1],data.products,rain).expectedProfit};
  });}
  function analysis(config){const d=validate(config);return {config:d, expectations:d.plans.map(p=>expectedResult(p,d.products,d.rain)), simulation:simulate(d), sensitivity:grid(d)};}
  return {DEFAULT,MAX_PRODUCTS,initial,validate,cleanProduct,cleanPlan,fixed,mixWeights,fromDemand,expectedWeather,expectedResult,rng,poisson,quantile,simulate,grid,analysis};
});
