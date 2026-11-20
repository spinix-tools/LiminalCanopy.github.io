/* TSURISEN LAB — pure simulation engine. No network or external dependencies. */
(function(root,factory){ const api=factory(); if(typeof module==='object'&&module.exports)module.exports=api; root.TsurisenEngine=api; })(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const DENOMS=[10000,5000,2000,1000,500,100,50,10,5,1];
const TYPES=['exact','thousand','fiveThousand','tenThousand'];
const jpy=n=>new Intl.NumberFormat('ja-JP').format(Math.round(n))+'円';
const empty=()=>Array(DENOMS.length).fill(0);
const amount=counts=>DENOMS.reduce((s,d,i)=>s+d*counts[i],0);
function greedy(value){ if(!Number.isSafeInteger(value)||value<0)throw Error('金額が不正です'); const out=empty(); for(let i=0;i<DENOMS.length;i++){out[i]=Math.floor(value/DENOMS[i]);value%=DENOMS[i]}return out; }
function validate(config){
 if(!config||!Array.isArray(config.items)||!config.items.length||config.items.length>12) throw Error('商品を1～12種類で登録してください');
 const items=config.items.map((it,i)=>{const price=Number(it.price),qty=Number(it.qty),name=String(it.name||'').trim();if(!name||name.length>80||!Number.isInteger(price)||price<1||price>10000||!Number.isInteger(qty)||qty<0||qty>300)throw Error(`${i+1}行目の商品名・価格・予定個数を確認してください`);return {name,price,qty,id:String(it.id||i)};});
 if(items.reduce((a,b)=>a+b.qty,0)<1||items.reduce((a,b)=>a+b.qty,0)>320)throw Error('予定販売数は合計1～320個にしてください');
 const checkCash=(arr,label)=>{if(!Array.isArray(arr)||arr.length!==DENOMS.length||arr.some(v=>!Number.isInteger(Number(v))||Number(v)<0||Number(v)>300))throw Error(`${label}の金種枚数は0～300で入力してください`);return arr.map(Number)};
 const initial=checkCash(config.initial,'開始時');const proposed=checkCash(config.proposed,'比較案');
 const weights={};for(const k of TYPES){const v=Number(config.weights?.[k]);if(!Number.isFinite(v)||v<0||v>100)throw Error('支払い比率は0～100で入力してください');weights[k]=v}
 const wsum=Object.values(weights).reduce((a,b)=>a+b,0);if(Math.abs(wsum-100)>.01)throw Error('支払い比率の合計を100%にしてください');
 const trials=Number(config.trials);if(!Number.isInteger(trials)||trials<20||trials>400)throw Error('試行回数は20～400回で指定してください');
 return {items,initial,proposed,weights,trials};
}
// Optimal fewest-piece change-making with a limited drawer; a greedy-only answer can fail.
function makeChange(value,drawer){
 if(!Number.isSafeInteger(value)||value<0||!Array.isArray(drawer)||drawer.length!==DENOMS.length)return null;
 if(drawer.some(v=>!Number.isInteger(v)||v<0))return null;
 if(value===0)return empty(); if(amount(drawer)<value)return null;
 const memo=DENOMS.map(()=>new Map());const suffix=new Array(DENOMS.length+1).fill(0);
 for(let i=DENOMS.length-1;i>=0;i--) suffix[i]=suffix[i+1]+DENOMS[i]*drawer[i];
 function solve(i,r){if(r===0)return {pieces:0,coins:empty()};if(i===DENOMS.length||r<0||suffix[i]<r)return null;
  if(memo[i].has(r))return memo[i].get(r);const den=DENOMS[i];let best=null;
  for(let n=Math.min(drawer[i],Math.floor(r/den));n>=0;n--){const rest=r-n*den;if(rest>suffix[i+1])continue;
   if(best&&n>=best.pieces)continue;const next=solve(i+1,rest);if(next&&(!best||n+next.pieces<best.pieces)){const coins=next.coins.slice();coins[i]=n;best={pieces:n+next.pieces,coins};}}
  memo[i].set(r,best);return best;
 }
 return solve(0,value)?.coins||null;
}
function rng(seed){let x=(seed>>>0)||1;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;}}
function tender(price,type){if(type==='exact')return greedy(price);if(type==='thousand'){if(price<=1000){const a=empty();a[3]=1;return a}const a=empty();a[3]=Math.ceil(price/1000);return a}if(type==='fiveThousand'){const a=empty();a[price<=5000?1:0]=1;return a}const a=empty();a[0]=1;return a;}
function drawType(weights,r){let s=0;const chance=r()*100;for(const k of TYPES){s+=weights[k];if(chance<s+1e-10)return k}return TYPES[TYPES.length-1]}
function oneRun(cash,items,weights,random,trace=false){
 let till=cash.slice(),fail=0,passed=0,firstFail=-1;const sales=[];for(const item of items)for(let i=0;i<item.qty;i++)sales.push(item);
 for(let i=sales.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[sales[i],sales[j]]=[sales[j],sales[i]]}
 const log=[];let salesValue=0;
 sales.forEach((item,i)=>{const kind=drawType(weights,random);const received=tender(item.price,kind);const payment=amount(received);const change=payment-item.price;
 // Incoming bills/coins are available for this same transaction.
 const available=till.map((v,j)=>v+received[j]);const give=makeChange(change,available);const ok=give!==null;
 if(ok){till=available.map((v,j)=>v-give[j]);passed++;salesValue+=item.price;}else{fail++;if(firstFail<0)firstFail=i+1;}
 if(trace&&log.length<20)log.push({index:i+1,name:item.name,price:item.price,tender:payment,change,ok,detail:ok?give:null});
 });return {passed,fail,firstFail,final:till,revenue:salesValue,trace:log};
}
function percentiles(nums,p){if(!nums.length)return 0;const a=nums.slice().sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.ceil(p*a.length)-1)]}
function simulate(config,seed=24681357){const cfg=validate(config);const random=rng(seed);const scenarios=[];
 for(let n=0;n<cfg.trials;n++){
  // Independent per-trial seed shared between alternatives (common random numbers).
  const trialSeed=Math.floor(random()*4294967295)+1;
  scenarios.push([oneRun(cfg.initial,cfg.items,cfg.weights,rng(trialSeed)),oneRun(cfg.proposed,cfg.items,cfg.weights,rng(trialSeed))]);
 }
 function summarize(col){const rows=scenarios.map(x=>x[col]);return {
  anyShortage:rows.filter(x=>x.fail>0).length/rows.length,
  meanShortage:rows.reduce((s,x)=>s+x.fail,0)/rows.length,
  p90Shortage:percentiles(rows.map(x=>x.fail),.9),
  averageRevenue:rows.reduce((s,x)=>s+x.revenue,0)/rows.length,
  meanFirstShortage:rows.filter(x=>x.firstFail>=0).length?Math.round(rows.filter(x=>x.firstFail>=0).reduce((s,x)=>s+x.firstFail,0)/rows.filter(x=>x.firstFail>=0).length):null,
  initialValue:amount(col?cfg.proposed:cfg.initial)
 }}
 const trace=oneRun(cfg.initial,cfg.items,cfg.weights,rng((seed+34567)>>>0),true).trace;
 return {baseline:summarize(0),proposal:summarize(1),trace,transactions:cfg.items.reduce((s,x)=>s+x.qty,0),trials:cfg.trials,seed};
}
function suggest(config,budget){const c=validate(config);const max=Number(budget);if(!Number.isInteger(max)||max<0||max>50000)throw Error('追加予算は0～50,000円');const estimate=empty();const weights=c.weights;
 for(const it of c.items){for(const k of TYPES){const change=amount(tender(it.price,k))-it.price;const breakdown=greedy(change);const coeff=it.qty*weights[k]/100*.28;for(let j=0;j<DENOMS.length;j++)estimate[j]+=breakdown[j]*coeff}}
 const out=c.initial.slice();let spent=0;
 // Greedy-by-affordability of common shortage denominations; excludes 10k/5k deposits.
 for(const j of [3,4,5,6,7,8,9]){const goal=Math.min(100,Math.ceil(estimate[j]));const diff=Math.max(0,goal-out[j]);const add=Math.min(diff,Math.floor((max-spent)/DENOMS[j]));out[j]+=add;spent+=add*DENOMS[j]}
 return {counts:out,spent,unspent:max-spent,estimatedDemand:estimate};
}
return {DENOMS,TYPES,jpy,empty,amount,greedy,validate,makeChange,rng,tender,drawType,oneRun,simulate,suggest};
});