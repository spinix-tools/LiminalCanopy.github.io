/* 収穫なみ: deterministic, dependency-free planning engine. Assumptions are user-editable estimates. */
(function(root, factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;root.HarvestEngine=value;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(v,min,max,fallback=min)=>{const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};
const int=(v,min,max,fallback=min)=>Math.round(clamp(v,min,max,fallback));
const str=(v,n=40)=>String(v??'').trim().slice(0,n);
const dateOK=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'));
const dateAt=(base,week)=>{const d=new Date(base+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+week*7);return d;};
const dateLabel=d=>`${d.getUTCMonth()+1}/${d.getUTCDate()}`;
const isoDate=d=>d.toISOString().slice(0,10);
const inSeason=(month,start,end)=>start<=end?(month>=start&&month<=end):(month>=start||month<=end);
const uuid=()=>Math.random().toString(36).slice(2,10);
function sample(){return {
 version:1,start:'2027-03-01',weeks:26,target:8,beds:[{id:'a',name:'南側プランター'},{id:'b',name:'東側プランター'},{id:'c',name:'小さな畝'}],
 crops:[
 {id:'r',name:'ラディッシュ',family:'アブラナ科',grow:3,harvest:1,yield:8,first:3,last:11},
 {id:'k',name:'小松菜',family:'アブラナ科',grow:4,harvest:2,yield:9,first:3,last:11},
 {id:'s',name:'ほうれん草',family:'ヒユ科',grow:5,harvest:2,yield:8,first:3,last:5},
 {id:'l',name:'リーフレタス',family:'キク科',grow:5,harvest:3,yield:9,first:3,last:10},
 {id:'b',name:'インゲン',family:'マメ科',grow:7,harvest:4,yield:12,first:4,last:7},
 {id:'n',name:'葉ねぎ',family:'ヒガンバナ科',grow:7,harvest:4,yield:12,first:3,last:9}],
 plantings:[
 {id:'p1',bed:'a',crop:'r',week:0},
 {id:'p2',bed:'a',crop:'l',week:5},
 {id:'p3',bed:'b',crop:'s',week:0},
 {id:'p4',bed:'b',crop:'b',week:9},
 {id:'p5',bed:'c',crop:'k',week:2},
 ]};}
function normalize(raw){if(!raw||typeof raw!=='object')throw Error('設定データが不正です');
 const start=dateOK(raw.start)?raw.start:'2027-03-01';const weeks=int(raw.weeks,8,52,26),target=clamp(raw.target,0.5,100,8);
 const beds=(Array.isArray(raw.beds)?raw.beds:[]).slice(0,16).map((x,i)=>({id:str(x?.id,32)||'bed'+i,name:str(x?.name,32)||`区画${i+1}`}));
 const crops=(Array.isArray(raw.crops)?raw.crops:[]).slice(0,36).map((x,i)=>({id:str(x?.id,32)||'crop'+i,name:str(x?.name,32)||`作物${i+1}`,family:str(x?.family,32)||'その他',grow:int(x?.grow,1,30,5),harvest:int(x?.harvest,1,20,2),yield:clamp(x?.yield,0.1,500,8),first:int(x?.first,1,12,3),last:int(x?.last,1,12,11)}));
 const bedSet=new Set(beds.map(x=>x.id)),cropSet=new Set(crops.map(x=>x.id));if(bedSet.size!==beds.length||cropSet.size!==crops.length)throw Error('IDに重複があります');
 const plantings=(Array.isArray(raw.plantings)?raw.plantings:[]).slice(0,180).map((x,i)=>({id:str(x?.id,32)||'plant'+i,bed:str(x?.bed,32),crop:str(x?.crop,32),week:int(x?.week,0,weeks-1,0)})).filter(x=>bedSet.has(x.bed)&&cropSet.has(x.crop));
 if(new Set(plantings.map(x=>x.id)).size!==plantings.length)throw Error('作付けIDに重複があります');
 return {version:1,start,weeks,target,beds,crops,plantings};}
function details(data){const d=normalize(data),byCrop=new Map(d.crops.map(x=>[x.id,x])),byBed=new Map(d.beds.map(x=>[x.id,x]));
 const items=d.plantings.map(p=>{const c=byCrop.get(p.crop),start=p.week,finish=start+c.grow+c.harvest;return {...p,cropName:c.name,bedName:byBed.get(p.bed).name,family:c.family,firstHarvest:start+c.grow,finish,perWeek:c.yield/c.harvest,month:dateAt(d.start,start).getUTCMonth()+1,seasonOK:inSeason(dateAt(d.start,start).getUTCMonth()+1,c.first,c.last)};});
 return {d,items};}
function analyze(raw){const {d,items}=details(raw),supply=Array(d.weeks).fill(0),occupied=d.beds.map(b=>({bed:b.id,slots:Array.from({length:d.weeks},()=>[])}));const byBed=new Map(occupied.map(x=>[x.bed,x.slots]));
 for(const p of items){for(let w=p.week;w<Math.min(d.weeks,p.finish);w++)byBed.get(p.bed)[w].push(p.id);for(let w=p.firstHarvest;w<Math.min(d.weeks,p.finish);w++)supply[w]+=p.perWeek;}
 const issues=[];for(const p of items){if(!p.seasonOK)issues.push({kind:'season',id:p.id,week:p.week,message:`${p.bedName}の${p.cropName}は設定した種まき月の範囲外です`});if(p.finish>d.weeks)issues.push({kind:'horizon',id:p.id,week:p.week,message:`${p.cropName}の収穫が表示期間を超えます`});}
 for(const record of occupied){for(let w=0;w<d.weeks;w++)if(record.slots[w].length>1)issues.push({kind:'overlap',bed:record.bed,week:w,message:`${d.beds.find(b=>b.id===record.bed).name}で${w+1}週目に作付けが重複しています`});}
 for(const b of d.beds){const ps=items.filter(p=>p.bed===b.id).sort((x,y)=>x.week-y.week);for(let i=1;i<ps.length;i++){const prev=ps[i-1],cur=ps[i];if(prev.family===cur.family&&cur.week>=prev.finish&&cur.week-prev.finish<12)issues.push({kind:'rotation',id:cur.id,week:cur.week,message:`${b.name}: ${cur.cropName}は前作と同じ科です（輪作の目安警告）`});}}
 const shortage=supply.map(v=>Math.max(0,d.target-v)),surplus=supply.map(v=>Math.max(0,v-d.target));const counts={shortageWeeks:shortage.filter(x=>x>0.001).length,glutWeeks:surplus.filter(x=>x>d.target*.25).length,totalShortage:shortage.reduce((a,b)=>a+b,0),totalSurplus:surplus.reduce((a,b)=>a+b,0),totalYield:supply.reduce((a,b)=>a+b,0),overlapWeeks:issues.filter(x=>x.kind==='overlap').length};
 return {...d,items,supply,occupied,shortage,surplus,issues,counts,dates:Array.from({length:d.weeks},(_,w)=>({week:w,iso:isoDate(dateAt(d.start,w)),label:dateLabel(dateAt(d.start,w))}))};}
function fits(plan,bed,crop,week){const c=plan.crops.find(x=>x.id===crop);if(!c||!plan.beds.some(b=>b.id===bed)||week<0||week>=plan.weeks)return false;const month=dateAt(plan.start,week).getUTCMonth()+1;if(!inSeason(month,c.first,c.last))return false;
 const end=week+c.grow+c.harvest;if(end>plan.weeks)return false;
 for(const p of plan.plantings.filter(x=>x.bed===bed)){const old=plan.crops.find(x=>x.id===p.crop);if(!old)continue;const oldEnd=p.week+old.grow+old.harvest;if(week<oldEnd&&p.week<end)return false;
 if(p.week<=week&&p.week<end&&old.family===c.family&&week-oldEnd>=0&&week-oldEnd<12)return false;
 if(week<p.week&&old.family===c.family&&p.week-end>=0&&p.week-end<12)return false;
 }return true;}
function suggest(raw){const state=analyze(raw),{target,weeks}=state;let best=null;
 for(const bed of state.beds)for(const crop of state.crops)for(let w=0;w<weeks;w++){
 if(!fits(state,bed.id,crop.id,w))continue;
 let gain=0;for(let k=w+crop.grow;k<w+crop.grow+crop.harvest;k++){
 const before=state.supply[k],after=before+crop.yield/crop.harvest;
 const diff=Math.min(target,after)-Math.min(target,before);
 const extra=Math.max(0,after-target)-Math.max(0,before-target);
 gain+=diff-0.45*extra;
 }
 // Earliest tied plan is preferred; the same objective is used for all candidates.
 if(gain>0.01&&(!best||gain>best.gain+1e-8||Math.abs(gain-best.gain)<1e-8&&w<best.week))best={bed:bed.id,crop:crop.id,week:w,gain:+gain.toFixed(2)};
 }
 return best;}
function exportCSV(raw){const s=analyze(raw);const cell=v=>'"'+String(v??'').replaceAll('"','""')+'"';const lines=[['種別','区画','作物','開始日','収穫開始日','占有終了日','収穫見込(食分)','週'].map(cell).join(',')];
 for(const p of s.items){lines.push(['作付け',p.bedName,p.cropName,isoDate(dateAt(s.start,p.week)),isoDate(dateAt(s.start,p.firstHarvest)),isoDate(dateAt(s.start,p.finish)),(p.perWeek*(p.finish-p.firstHarvest)).toFixed(1),p.week+1].map(cell).join(','));}
 lines.push(['週次','日付','予測食分','目標食分','不足食分','余剰食分',''].map(cell).join(','));for(let i=0;i<s.weeks;i++)lines.push(['週次',s.dates[i].iso,s.supply[i].toFixed(1),s.target.toFixed(1),s.shortage[i].toFixed(1),s.surplus[i].toFixed(1),''].map(cell).join(','));return '\ufeff'+lines.join('\r\n');}
return {sample,normalize,analyze,details,fits,suggest,exportCSV,dateAt,dateLabel,isoDate,inSeason,uuid};
});
