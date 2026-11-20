/* KEIKO PUZZLE scheduling engine. No dependencies, runs in Node and browsers. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.KeikoEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const number=(v,min=0,max=10000)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):0));
const unique=xs=>[...new Set(xs)];
const round15=n=>Math.max(15,Math.round(number(n,15,600)/15)*15);
function sample(){return {
 title:'週末公演・稽古プラン（サンプル）',
 people:[{id:'p1',name:'役A',absent:['t2']},{id:'p2',name:'役B',absent:['t3']},{id:'p3',name:'役C',absent:[]},{id:'p4',name:'役D',absent:['t1']}],
 scenes:[{id:'s1',name:'第一場｜出会い',cast:['p1','p2'],minutes:90,priority:3},{id:'s2',name:'第二場｜対話',cast:['p2','p3'],minutes:60,priority:2},{id:'s3',name:'第三場｜対立',cast:['p1','p3','p4'],minutes:90,priority:3},{id:'s4',name:'第四場｜終幕',cast:['p3','p4'],minutes:60,priority:1}],
 slots:[{id:'t1',name:'11/21（土）18:00',minutes:90},{id:'t2',name:'11/22（日）13:00',minutes:120},{id:'t3',name:'11/24（火）18:00',minutes:120}],
 allocations:[{id:'a1',slotId:'t1',sceneId:'s1',minutes:30,locked:true}]
};}
function normalize(raw){if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('JSON形式が正しくありません');
 const persons=Array.isArray(raw.people)?raw.people.slice(0,80):[];
 const slots=Array.isArray(raw.slots)?raw.slots.slice(0,50):[];
 const scenes=Array.isArray(raw.scenes)?raw.scenes.slice(0,100):[];
 const ids=(list,prefix)=>list.map((v,i)=>({id:String(v.id||prefix+i).slice(0,64),name:String(v.name||`${prefix}${i+1}`).slice(0,90)}));
 const people=ids(persons,'p').map((v,i)=>({...v,absent:unique(Array.isArray(persons[i].absent)?persons[i].absent.map(String):[])}));
 const ss=ids(slots,'t').map((v,i)=>({...v,minutes:round15(slots[i].minutes||90)}));
 const sc=ids(scenes,'s').map((v,i)=>({...v,minutes:round15(scenes[i].minutes||60),priority:number(scenes[i].priority||1,1,3),cast:unique(Array.isArray(scenes[i].cast)?scenes[i].cast.map(String):[])}));
 const allowedId=(v,collection)=>collection.some(x=>x.id===v);
 const allocations=(Array.isArray(raw.allocations)?raw.allocations:[]).slice(0,500).filter(a=>allowedId(String(a.slotId),ss)&&allowedId(String(a.sceneId),sc)).map((a,i)=>({id:String(a.id||'a'+i).slice(0,64),slotId:String(a.slotId),sceneId:String(a.sceneId),minutes:round15(a.minutes||15),locked:!!a.locked}));
 if(new Set(people.map(p=>p.id)).size!==people.length||new Set(ss.map(s=>s.id)).size!==ss.length||new Set(sc.map(s=>s.id)).size!==sc.length)throw Error('識別IDが重複しています');
 return {title:String(raw.title||'稽古プラン').slice(0,90),people,scenes:sc,slots:ss,allocations};}
const byId=(list,id)=>list.find(x=>x.id===id);
function available(data,scene,slot){return scene.cast.every(id=>{const p=byId(data.people,id);return !!p&&!p.absent.includes(slot.id);});}
function booked(data,sceneId,allocations=data.allocations){return allocations.filter(a=>a.sceneId===sceneId).reduce((n,a)=>n+a.minutes,0);}
function used(data,slotId,allocations=data.allocations){return allocations.filter(a=>a.slotId===slotId).reduce((n,a)=>n+a.minutes,0);}
function issues(data,allocations=data.allocations){let alerts=[];
 for(const a of allocations){const scene=byId(data.scenes,a.sceneId),slot=byId(data.slots,a.slotId);if(!scene||!slot){alerts.push(`不明な割当: ${a.id}`);continue;}if(!available(data,scene,slot))alerts.push(`欠席と衝突: ${slot.name} / ${scene.name}`);}
 for(const s of data.slots)if(used(data,s.id,allocations)>s.minutes)alerts.push(`稽古枠の時間超過: ${s.name}`);
 for(const s of data.scenes)if(booked(data,s.id,allocations)>s.minutes)alerts.push(`必要時間の超過: ${s.name}`);
 return alerts;}
function optimize(raw){const data=normalize(raw);const kept=data.allocations.filter(a=>a.locked);const assigned=kept.map(a=>({...a}));
 // Existing fixed work is never moved, even if inconsistent: surface issues rather than hiding them.
 let sequence=0;
 for(const slot of data.slots){let free=Math.max(0,slot.minutes-used(data,slot.id,assigned));let guard=0;
 while(free>=15&&guard++<200){let candidates=data.scenes.filter(s=>available(data,s,slot)&&s.minutes-booked(data,s.id,assigned)>=15);
 if(!candidates.length)break;
 candidates.sort((a,b)=>b.priority-a.priority|| (b.minutes-booked(data,b.id,assigned))-(a.minutes-booked(data,a.id,assigned)) || a.id.localeCompare(b.id));
 const s=candidates[0],still=s.minutes-booked(data,s.id,assigned),mins=Math.min(free,still,60);
 assigned.push({id:'auto'+(++sequence),slotId:slot.id,sceneId:s.id,minutes:mins,locked:false});free-=mins;
 }
 }
 const next={...data,allocations:assigned};return {...next,report:report(next)};
}
function report(data){const total=data.scenes.reduce((n,s)=>n+s.minutes,0);
 const fulfilled=data.scenes.reduce((n,s)=>n+Math.min(s.minutes,booked(data,s.id)),0);
 const remaining=data.scenes.map(s=>{const unmet=Math.max(0,s.minutes-booked(data,s.id));const any=data.slots.some(t=>available(data,s,t));return {id:s.id,name:s.name,unmet,reason:unmet?(any?'稽古枠の残容量不足':'全員が揃う枠なし'):''};});
 return {total,fulfilled,percent:total?Math.round(100*fulfilled/total):100,unused:data.slots.reduce((n,t)=>n+Math.max(0,t.minutes-used(data,t.id)),0),remaining,issues:issues(data)};}
function insert(raw,slotId,sceneId,minutes){const d=normalize(raw),s=byId(d.scenes,sceneId),t=byId(d.slots,slotId),m=round15(minutes);
 if(!s||!t)throw Error('稽古枠か場面が見つかりません');
 if(!available(d,s,t))throw Error('この枠では必要な出演者が揃いません');
 if(used(d,t.id)+m>t.minutes)throw Error('稽古枠の残り時間を超えます');
 if(booked(d,s.id)+m>s.minutes)throw Error('その場面の必要時間を超えます');
 d.allocations.push({id:'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),slotId,sceneId,minutes:m,locked:true});return d;
}
function candidates(raw,slotId){const d=normalize(raw),t=byId(d.slots,slotId);if(!t)return [];
 return d.scenes.map(s=>({id:s.id,name:s.name,remaining:Math.max(0,s.minutes-booked(d,s.id)),possible:available(d,s,t),priority:s.priority})).filter(x=>x.remaining>0).sort((a,b)=>Number(b.possible)-Number(a.possible)||b.priority-a.priority||b.remaining-a.remaining);
}
return {sample,normalize,available,booked,used,issues,optimize,report,insert,candidates,round15};
});
