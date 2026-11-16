/* ARAIWAKU engine: deterministic, offline, dependency-free. */
(function(root,factory){const lib=factory();if(typeof module==='object'&&module.exports)module.exports=lib;root.AraiEngine=lib;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const COLORS={white:'白',light:'淡色',dark:'濃色',vivid:'鮮色'};
const WASH={standard:'標準',gentle:'弱水流',hand:'手洗い',no:'水洗い不可',unknown:'未確認'};
const DRY={yes:'乾燥機可',low:'低温のみ',no:'乾燥機不可',unknown:'未確認'};
const MAX_ITEMS=120;
const VALID_COLORS=Object.keys(COLORS);
const VALID_WASH=Object.keys(WASH);
const VALID_DRY=Object.keys(DRY);
function own(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
function plainObject(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function cleanName(s){return typeof s==='string'?s.trim():'';}
function asNumber(v){if(v===null||typeof v==='boolean'||v==='')return NaN;return Number(v);}
function validateGarment(o){
 if(!plainObject(o))throw Error('衣類データの形式が不正です');
 const name=cleanName(o.name);
 if(!name||name.length>64)throw Error('衣類名は1〜64文字にしてください');
 const color=o.color;
 if(!VALID_COLORS.includes(color)&&color!=='unknown')throw Error('色の種類が不正です');
 if(!VALID_WASH.includes(o.wash))throw Error('洗濯方法が不正です');
 const temp=o.temp==='unknown'?'unknown':asNumber(o.temp);
 if(temp!=='unknown'&&![30,40,60,95].includes(temp))throw Error('温度は30/40/60/95または未確認から選択');
 const weight=asNumber(o.weight);
 if(!Number.isInteger(weight)||weight<20||weight>10000)throw Error('重量は20〜10,000gの整数で指定');
 if(typeof o.bleed!=='boolean')throw Error('色移り注意の設定が不正です');
 if(!VALID_DRY.includes(o.dry))throw Error('乾燥表示が不正です');
 const done=o.done===true;
 if(o.done!==undefined&&typeof o.done!=='boolean')throw Error('洗濯済みの設定が不正です');
 return {id:typeof o.id==='string'&&/^[a-zA-Z0-9_-]{3,64}$/.test(o.id)?o.id:'',name,color,wash:o.wash,temp,weight,bleed:o.bleed,dry:o.dry,done};
}
function validateState(data){
 if(!plainObject(data)||data.version!==1||!Array.isArray(data.garments)||data.garments.length>MAX_ITEMS)throw Error('この形式のバックアップには対応していません');
 const capacity=asNumber(data.capacity);
 if(!Number.isInteger(capacity)||capacity<500||capacity>20000||capacity%100!==0)throw Error('容量は0.5〜20kgを0.1kg刻みで指定');
 const garments=data.garments.map(validateGarment),ids=new Set();
 for(const g of garments){if(!g.id||ids.has(g.id))throw Error('衣類IDが不正または重複しています');ids.add(g.id);}
 return {version:1,capacity,garments};
}
function nextId(){return 'g_'+Math.random().toString(36).slice(2,12)+Date.now().toString(36).slice(-5);}
function greedyPack(sorted,capacity){const bins=[];for(const item of sorted){let target=bins.find(b=>b.total+item.weight<=capacity);if(!target){target={items:[],total:0};bins.push(target);}target.items.push(item);target.total+=item.weight;}return bins;}
/* Exact branch-and-bound for <=12 compatible garments. Otherwise first-fit decreasing. */
function pack(items,capacity){
 const sorted=items.slice().sort((a,b)=>b.weight-a.weight||a.id.localeCompare(b.id));
 if(!sorted.length)return {bins:[],exact:true};
 if(sorted.length>12)return {bins:greedyPack(sorted,capacity),exact:false};
 let best=greedyPack(sorted,capacity).map(b=>({items:b.items.slice(),total:b.total}));
 const bins=[];
 function dfs(i){
  if(i===sorted.length){if(bins.length<best.length)best=bins.map(b=>({items:b.items.slice(),total:b.total}));return;}
  if(bins.length>=best.length)return;
  const item=sorted[i],seen=new Set();
  for(const bin of bins){const free=capacity-bin.total;if(free<item.weight||seen.has(free))continue;seen.add(free);bin.items.push(item);bin.total+=item.weight;dfs(i+1);bin.total-=item.weight;bin.items.pop();}
  if(bins.length+1<best.length){bins.push({items:[item],total:item.weight});dfs(i+1);bins.pop();}
 }
 dfs(0);
 return {bins:best,exact:true};
}
function planLoads(data){
 const state=validateState(data),cap=state.capacity;
 const result={cycles:[],hand:[],excluded:[],review:[],overweight:[],done:[],capacity:cap,approxCount:0};
 const byGroup=new Map();
 for(const item of state.garments){
  if(item.done){result.done.push(item);continue;}
  if(item.wash==='no'){result.excluded.push({item,reason:'水洗い不可'});continue;}
  if(item.wash==='unknown'||item.color==='unknown'||item.temp==='unknown'){
   const missing=[item.wash==='unknown'?'洗濯方法':'',item.color==='unknown'?'色':'',item.temp==='unknown'?'水温':''].filter(Boolean).join('・');
   result.review.push({item,reason:`${missing}を確認してください`});continue;
  }
  if(item.wash==='hand'){result.hand.push({item,reason:'手洗い表示：機械洗いへ混ぜない'});continue;}
  if(item.weight>cap){result.overweight.push({item,reason:'1点で設定容量を超えます'});continue;}
  // Color and gentleness are conservative separation rules, not textile guarantees.
  const group=item.bleed?`bleed:${item.id}`:`${item.color}:${item.wash}`;
  if(!byGroup.has(group))byGroup.set(group,[]);
  byGroup.get(group).push(item);
 }
 for(const [group,items] of byGroup){
  const {bins,exact}=pack(items,cap);
  if(!exact)result.approxCount++;
  for(const bin of bins){
   const temperature=Math.min(...bin.items.map(item=>item.temp));
   const dry=bin.items.every(item=>item.dry==='yes')?'yes':bin.items.every(item=>['yes','low'].includes(item.dry))?'low':'check';
   const sample=bin.items[0];
   result.cycles.push({items:bin.items,weight:bin.total,color:sample.color,wash:sample.wash,temperature,dry,exact,isolated:sample.bleed,group});
  }
 }
 const rank={white:0,light:1,dark:2,vivid:3};
 result.cycles.sort((a,b)=>rank[a.color]-rank[b.color]||a.wash.localeCompare(b.wash)||b.weight-a.weight);
 result.summary={pending:state.garments.filter(g=>!g.done).length,cycles:result.cycles.length,itemsInCycles:result.cycles.reduce((s,c)=>s+c.items.length,0),hold:result.hand.length+result.excluded.length+result.review.length+result.overweight.length,done:result.done.length};
 return result;
}
function escCSV(v){let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function toCsv(state,plan){const rows=[['区分','番号','衣類','色','コース','水温上限(℃)','実測重量(g)','乾燥','注意']];
 for(let i=0;i<plan.cycles.length;i++){const cycle=plan.cycles[i];for(const item of cycle.items)rows.push(['洗濯機',i+1,item.name,COLORS[item.color],WASH[item.wash],cycle.temperature,item.weight,DRY[item.dry],cycle.isolated?'色移り注意：単独': '表示・素材・汚れを再確認']);}
 for(const [kind,list] of [['手洗い',plan.hand],['水洗い不可',plan.excluded],['要確認',plan.review],['容量超過',plan.overweight]])for(const entry of list)rows.push([kind,'',entry.item.name,COLORS[entry.item.color]||'未確認',WASH[entry.item.wash],entry.item.temp,entry.item.weight,DRY[entry.item.dry],entry.reason]);
 return '\ufeff'+rows.map(row=>row.map(escCSV).join(',')).join('\r\n')+'\r\n';}
function report(state,plan){const lines=['洗濯仕分けメモ / あらいわく',`容量 ${ (state.capacity/1000).toFixed(1)}kg ｜ 機械洗い ${plan.cycles.length}回 ｜ 手洗い ${plan.hand.length}点 ｜ 保留など ${plan.summary.hold}点`];
 plan.cycles.forEach((c,i)=>lines.push(`${i+1}. ${COLORS[c.color]}・${WASH[c.wash]}・${c.temperature}℃以下・${c.weight}g : ${c.items.map(x=>x.name).join(' / ')}${c.isolated?' [色移り注意・単独]':''}`));
 for(const [label,list] of [['手洗い',plan.hand],['水洗い不可',plan.excluded],['確認待ち',plan.review],['容量超過',plan.overweight]])for(const e of list)lines.push(`${label}：${e.item.name}（${e.reason}）`);
 lines.push('※洗濯表示・素材・色落ち・汚れを必ず再確認。仕分けは安全性を保証しません。');return lines.join('\n');}
return Object.freeze({COLORS,WASH,DRY,MAX_ITEMS,validateGarment,validateState,nextId,pack,planLoads,toCsv,report});
});