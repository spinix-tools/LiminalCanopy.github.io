/* おつり予報 — deterministic cash-float scenario engine. No network / dependencies. */
(function(root, factory){ const engine=factory(); if(typeof module==='object'&&module.exports) module.exports=engine; root.OtsuriEngine=engine; })(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const DENOMS=[10000,5000,2000,1000,500,100,50,10,5,1];
const STYLE_OPTIONS=[{key:'exact',label:'ちょうど'},{key:'k1000',label:'千円単位'},{key:'k5000',label:'五千円単位'},{key:'k10000',label:'一万円単位'}];
const PRESETS={
 market:{name:'週末マルシェ',products:[{name:'焼き菓子',price:350,weight:40},{name:'コーヒー',price:500,weight:30},{name:'ジャム',price:850,weight:20},{name:'詰め合わせ',price:1200,weight:10}],float:[0,0,0,3,5,16,12,22,10,25],styles:[20,45,25,10],count:100,pairChance:15,budget:2500,seed:20261118,runs:24},
 flea:{name:'フリーマーケット',products:[{name:'雑貨',price:200,weight:35},{name:'アクセサリー',price:700,weight:30},{name:'古着',price:1500,weight:25},{name:'セット',price:2300,weight:10}],float:[0,0,0,3,3,10,8,15,6,12],styles:[15,45,30,10],count:80,pairChance:20,budget:3500,seed:20261118,runs:24},
 school:{name:'学園祭の模擬店',products:[{name:'ドリンク',price:150,weight:35},{name:'フード',price:400,weight:40},{name:'セット',price:550,weight:25}],float:[0,0,0,2,4,14,14,16,8,15],styles:[30,55,10,5],count:180,pairChance:25,budget:3000,seed:20261118,runs:24}
};
const copy=x=>JSON.parse(JSON.stringify(x));
const int=(v,min,max)=>{let x=Number(v); if(!Number.isFinite(x)||!Number.isInteger(x)||x<min||x>max)throw Error('数値は '+min+'〜'+max+' の整数で指定してください');return x;};
function normalize(data){
 if(!data||typeof data!=='object')throw Error('設定を読み取れません');
 const p=data.products; if(!Array.isArray(p)||p.length<1||p.length>10)throw Error('商品は1〜10種類で登録してください');
 const products=p.map((x,i)=>({name:String(x.name||'商品 '+(i+1)).trim().slice(0,40)||'商品 '+(i+1),price:int(x.price,1,50000),weight:int(x.weight,0,100)}));
 if(!products.some(x=>x.weight>0))throw Error('売れ行き比率に1以上を設定してください');
 if(!Array.isArray(data.float)||data.float.length!==DENOMS.length)throw Error('金種の数が正しくありません');
 const float=data.float.map(x=>int(x,0,1000));
 if(!Array.isArray(data.styles)||data.styles.length!==4)throw Error('支払傾向の数が正しくありません');
 const styles=data.styles.map(x=>int(x,0,100));
 if(!styles.some(Boolean))throw Error('支払傾向に1以上を設定してください');
 return {name:String(data.name||'新しい計画').slice(0,60),products,float,styles,count:int(data.count,1,500),pairChance:int(data.pairChance,0,100),seed:int(data.seed,1,2147483647),runs:int(data.runs,1,100),budget:int(data.budget,0,100000)};
}
function seeded(seed){let x=seed>>>0;return ()=>{x+=0x6d2b79f5;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function weightedIndex(weights,rng){const sum=weights.reduce((a,b)=>a+b,0);let n=rng()*sum;for(let i=0;i<weights.length;i++){n-=weights[i];if(n<0)return i;}return weights.length-1;}
function worth(counts){return DENOMS.reduce((total,n,i)=>total+n*counts[i],0);}
function greedy(amount){let r=amount;return DENOMS.map(n=>{const c=Math.floor(r/n);r-=n*c;return c;});}
function changeFor(amount,available){if(!Number.isInteger(amount)||amount<0)throw Error('お釣り金額が不正です');if(amount===0)return Array(10).fill(0);if(worth(available)<amount)return null;
 const failed=new Set();const selected=Array(10).fill(0);let iterations=0;
 function dfs(i,rem){if(rem===0){selected.fill(0,i);return true;}if(i===9){if(rem<=available[9]){selected[9]=rem;return true;}return false;}
  if(++iterations>350000)return false;
  const key=i+':'+rem;if(failed.has(key))return false;
  let max=Math.min(available[i],Math.floor(rem/DENOMS[i]));
  for(let count=max;count>=0;count--){selected[i]=count;const residue=rem-count*DENOMS[i];if(dfs(i+1,residue))return true;}
  failed.add(key);return false;
 }
 return dfs(0,amount)?selected.slice():null;
}
function makeTender(total,style){const unit=style==='exact'?1:style==='k1000'?1000:style==='k5000'?5000:10000;const paid=Math.ceil(total/unit)*unit;return {paid,coins:greedy(paid)};}
function simulateRun(raw,runIndex=0,opts={}){
 const data=normalize(raw),seed=(data.seed+runIndex*104729)>>>0,rng=seeded(seed),stock=data.float.slice(),logs=[],shortages=Array(10).fill(0),denomUse=Array(10).fill(0);
 let failed=0,served=0,tenderedTotal=0,salesTotal=0;
 for(let i=0;i<data.count;i++){
  const first=data.products[weightedIndex(data.products.map(x=>x.weight),rng)];const names=[first.name];let total=first.price;
  if(rng()*100<data.pairChance){const next=data.products[weightedIndex(data.products.map(x=>x.weight),rng)];total+=next.price;names.push(next.name);}
  const styleIndex=weightedIndex(data.styles,rng),style=STYLE_OPTIONS[styleIndex].key,{paid,coins}=makeTender(total,style),due=paid-total;
  const candidate=stock.map((n,j)=>n+coins[j]);const given=changeFor(due,candidate);const okay=given!==null;
  if(okay){for(let j=0;j<10;j++){stock[j]=candidate[j]-given[j];denomUse[j]+=given[j];}served++;salesTotal+=total;tenderedTotal+=paid;}
  else {failed++;const ideal=greedy(due);for(let j=0;j<10;j++)shortages[j]+=Math.max(0,ideal[j]-candidate[j]);}
  if(!opts.skipLogs&&logs.length<20) logs.push({index:i+1,items:names,total,paid,due,okay,style:STYLE_OPTIONS[styleIndex].label});
 }
 return {served,failed,salesTotal,tenderedTotal,stock,shortages,denomUse,logs,endingCash:worth(stock)};
}
function quantile(sorted,p){if(!sorted.length)return 0;return sorted[Math.ceil(sorted.length*p)-1];}
function evaluate(raw,override={}){
 const cfg=normalize({...raw,...override}),runs=[],shortages=Array(10).fill(0);let failedSum=0,failedRuns=0,servedSum=0,totalSales=0;
 for(let i=0;i<cfg.runs;i++) {const result=simulateRun(cfg,i,{skipLogs:i!==0});runs.push(result);failedSum+=result.failed;servedSum+=result.served;totalSales+=result.salesTotal;if(result.failed)failedRuns++;result.shortages.forEach((n,j)=>shortages[j]+=n);}
 const failureCounts=runs.map(r=>r.failed).sort((a,b)=>a-b);
 return {cfg,avgFailed:failedSum/cfg.runs,avgServed:servedSum/cfg.runs,avgSales:totalSales/cfg.runs,failRate:failedSum/(cfg.count*cfg.runs),risk:failedRuns/cfg.runs,p90Failures:quantile(failureCounts,.9),shortages,first:runs[0],failureCounts};
}
const PACKS=[{index:3,count:1},{index:4,count:1},{index:5,count:4},{index:6,count:4},{index:7,count:10},{index:8,count:10},{index:9,count:20}];
function recommend(raw){const cfg=normalize(raw);const limited={...cfg,runs:Math.min(cfg.runs,12),count:Math.min(cfg.count,200)};
 const baseline=evaluate(limited),float=cfg.float.slice(),picks=Array(10).fill(0);let left=cfg.budget,base=baseline;
 if(base.failRate===0)return {picks,spent:0,before:baseline,after:baseline,reason:'試算範囲では不足が発生しませんでした。'};
 for(let step=0;step<25;step++){
  let chosen=null,top=-Infinity;
  for(const pack of PACKS){const cost=DENOMS[pack.index]*pack.count;if(cost>left||float[pack.index]+pack.count>1000)continue;
   const nextFloat=float.slice();nextFloat[pack.index]+=pack.count;
   const candidate=evaluate({...limited,float:nextFloat});
   const gain=base.failRate-candidate.failRate;
   // First prioritize actual reduction in failed sales. For plateaus, target short denominations.
   const need=base.shortages[pack.index];const score=gain*100000/cost+(need>0?Math.min(need,pack.count)*0.001/cost:0);
   if(score>top){top=score;chosen={pack,cost,candidate,gain,need};}
  }
  if(!chosen||(chosen.gain<=0&&chosen.need<=0))break;
  float[chosen.pack.index]+=chosen.pack.count;picks[chosen.pack.index]+=chosen.pack.count;left-=chosen.cost;base=chosen.candidate;
  if(base.failRate===0)break;
 }
 return {picks,spent:cfg.budget-left,before:baseline,after:base,reason:'追加候補は固定シードの簡易貪欲探索であり、最適解を保証しません。'};
}
function csvCell(v){const s=String(v??'');return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function toCSV(rows){return '\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';}
function reportCSV(cfg,result,reco){const rows=[['レポート','おつり予報'],['計画',cfg.name],['来客想定',cfg.count],['反復回数',cfg.runs],['平均お釣り不足件数',result.avgFailed.toFixed(2)],['1件以上不足の試行割合',(result.risk*100).toFixed(1)+'%'],['追加予算',cfg.budget],['推奨追加額',reco.spent],[],['金種','初期枚数','提案追加','追加後枚数']];DENOMS.forEach((d,i)=>rows.push([d,cfg.float[i],reco.picks[i],cfg.float[i]+reco.picks[i]]));rows.push([],['商品','単価','出現重み']);cfg.products.forEach(p=>rows.push([p.name,p.price,p.weight]));return toCSV(rows);}
return {DENOMS,STYLE_OPTIONS,PRESETS,copy,normalize,seeded,weightedIndex,worth,greedy,changeFor,makeTender,simulateRun,evaluate,recommend,toCSV,reportCSV};
});
