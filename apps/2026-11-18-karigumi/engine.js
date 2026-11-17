/* かりぐみ KARI GUMI | offline, no dependencies | MIT */
(function(root){
const KariCore=(function buildCore(){
 const MAX_ITEMS=32, MAX_EVENTS=120;
 function ms(v){
   if(typeof v!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(v))return NaN;
   const d=new Date(v),parts=v.match(/\d+/g).map(Number);
   if(!Number.isFinite(d.getTime())||d.getFullYear()!==parts[0]||d.getMonth()+1!==parts[1]||d.getDate()!==parts[2]||d.getHours()!==parts[3]||d.getMinutes()!==parts[4])return NaN;
   return d.getTime();
 }
 function fmt(t){const d=new Date(t),p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;}
 function check(project){
   const errors=[];
   if(!project||typeof project!=="object"||!Array.isArray(project.items)||!Array.isArray(project.events))return ["データ構造が不正です。"];
   if(project.items.length<1||project.items.length>MAX_ITEMS)errors.push("備品種類数は1～32です。");
   if(project.events.length>MAX_EVENTS)errors.push("予定は120件以内です。");
   const ids=new Set(),eventIds=new Set();
   for(const [i,x] of project.items.entries()){
     if(!x||typeof x!=="object"||typeof x.id!=="string"||!/^[a-z0-9_-]{1,50}$/i.test(x.id)||ids.has(x.id))errors.push(`備品${i+1}のIDが不正・重複しています。`);
     else ids.add(x.id);
     if(typeof x?.name!=="string"||!x.name.trim()||x.name.length>60)errors.push(`備品${i+1}の名前が不正です。`);
     if(!Number.isInteger(x?.stock)||x.stock<1||x.stock>999)errors.push(`備品${i+1}の在庫数は1～999です。`);
     if(!Number.isInteger(x?.buffer)||x.buffer<0||x.buffer>480)errors.push(`備品${i+1}の前後準備時間は0～480分です。`);
   }
   for(const [i,e] of project.events.entries()){
     if(!e||typeof e!=="object"||typeof e.id!=="string"||!/^[a-z0-9_-]{1,50}$/i.test(e.id)||eventIds.has(e.id))errors.push(`予定${i+1}のIDが不正・重複しています。`);
     else eventIds.add(e.id);
     if(typeof e?.title!=="string"||!e.title.trim()||e.title.length>80)errors.push(`予定${i+1}の名前が不正です。`);
     const s=ms(e?.start),t=ms(e?.end);
     if(!Number.isFinite(s)||!Number.isFinite(t)||t<=s||t-s>7*86400000)errors.push(`予定${i+1}の開始・終了は正しい日時で7日以内にしてください。`);
     if(!e?.needs||typeof e.needs!=="object"||Array.isArray(e.needs))errors.push(`予定${i+1}の備品数が不正です。`);
     else {
       for(const [id,quantity] of Object.entries(e.needs)){
         if(!ids.has(id)||!Number.isInteger(quantity)||quantity<1||quantity>999)errors.push(`予定${i+1}の必要備品 ${id} が不正です。`);
       }
       if(Object.keys(e.needs).length===0)errors.push(`予定${i+1}に必要備品を指定してください。`);
     }
   }
   return errors;
 }
 function trace(project, candidate=null, excludeId=null){
   const events=project.events.filter(e=>e.id!==excludeId);
   if(candidate)events.push(candidate);
   const result=[];
   for(const item of project.items){
     const changes=[];
     for(const e of events){
       const q=Number(e.needs?.[item.id]||0);
       if(!q)continue;
       const start=ms(e.start)-item.buffer*60000,end=ms(e.end)+item.buffer*60000;
       if(!Number.isFinite(start)||!Number.isFinite(end))continue;
       changes.push({time:start,delta:q,eventId:e.id},{time:end,delta:-q,eventId:e.id});
     }
     changes.sort((a,b)=>a.time-b.time||a.delta-b.delta);
     let used=0,peak=0,segments=[],excess=0;
     for(let i=0;i<changes.length;){
       const time=changes[i].time;
       while(i<changes.length&&changes[i].time===time){used+=changes[i].delta;i++;}
       const next=i<changes.length?changes[i].time:null;
       peak=Math.max(peak,used);
       if(next!==null&&next>time&&used>item.stock){
         const last=segments[segments.length-1];
         if(last&&last.end===time&&last.used===used){last.end=next;}
         else segments.push({start:time,end:next,used,shortage:used-item.stock});
         excess=Math.max(excess,used-item.stock);
       }
     }
     result.push({itemId:item.id,name:item.name,stock:item.stock,peak,shortage:excess,segments});
   }
   return result;
 }
 function availability(project, candidate, excludeId=null){
   if(!candidate||!candidate.needs||!Object.keys(candidate.needs).length)return {ok:false,errors:["必要備品を1つ以上設定してください。"],shortages:[]};
   const probe={...project,events:[...project.events.filter(e=>e.id!==excludeId),candidate]};
   const errors=check(probe);
   if(errors.length)return {ok:false,errors,shortages:[]};
   const shortages=trace(project,candidate,excludeId).flatMap(x=>{
     if(!(candidate.needs[x.itemId]>0))return [];
     const item=project.items.find(i=>i.id===x.itemId);
     const from=ms(candidate.start)-item.buffer*60000,to=ms(candidate.end)+item.buffer*60000;
     const segments=x.segments.filter(v=>v.start<to&&v.end>from);
     const shortage=Math.max(0,...segments.map(v=>v.shortage));
     return shortage>0?[{...x,segments,shortage}]:[];
   });
   return {ok:shortages.length===0,errors:[],shortages};
 }
 function suggestions(project,candidate,excludeId=null,count=4,days=7){
   if(!Number.isFinite(ms(candidate.start))||!Number.isFinite(ms(candidate.end)))return [];
   const duration=ms(candidate.end)-ms(candidate.start);if(duration<=0)return [];
   const start=ms(candidate.start),slots=[];
   for(let n=1;n<=days*48 && slots.length<count;n++){
     const s=start+n*1800000;const copy={...candidate,start:fmt(s),end:fmt(s+duration)};
     if(availability(project,copy,excludeId).ok)slots.push({start:copy.start,end:copy.end});
   }
   return slots;
 }
 function csv(project){
   function cell(v){
     let s=String(v??"");
     if(/^[\s]*[=+\-@]/.test(s))s="'"+s;
     return `"${s.replace(/"/g,'""')}"`;
   }
   const lines=[["予定名","開始","終了","備品","必要数","準備前後(分)"].map(cell).join(",")];
   const lookup=new Map(project.items.map(i=>[i.id,i]));
   for(const e of project.events){
     for(const [id,q] of Object.entries(e.needs)){
       const item=lookup.get(id);
       lines.push([e.title,e.start,e.end,item?.name??id,q,item?.buffer??0].map(cell).join(","));
     }
   }
   return "\uFEFF"+lines.join("\r\n")+"\r\n";
 }
 function sample(){
   const now=new Date(),d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,9,0);
   const t=(add)=>fmt(d.getTime()+add*60000);
   return {version:1,items:[
     {id:"projector",name:"プロジェクター",stock:2,buffer:30},
     {id:"speaker",name:"ワイヤレスマイク",stock:3,buffer:15},
     {id:"extension",name:"延長コード",stock:5,buffer:10},
     {id:"screen",name:"スクリーン",stock:2,buffer:30}
   ],events:[
     {id:"ev1",title:"午前の講座",start:t(60),end:t(180),needs:{projector:1,speaker:2,extension:2}},
     {id:"ev2",title:"展示準備",start:t(120),end:t(270),needs:{projector:1,screen:1,extension:1}},
     {id:"ev3",title:"午後のワークショップ",start:t(300),end:t(420),needs:{projector:1,speaker:1,screen:1}}
   ]};
 }
 return {ms,fmt,check,trace,availability,suggestions,csv,sample};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=KariCore;
if(root)root.KariCore=KariCore;
})(typeof globalThis!=="undefined"?globalThis:this);
