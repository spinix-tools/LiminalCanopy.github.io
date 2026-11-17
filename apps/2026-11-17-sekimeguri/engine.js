/* SEKI MEGURI: deterministic, browser-local multi-round group scheduling engine. MIT. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SekiEngine=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
function int(v,min,max,label){const n=Number(v);if(!Number.isInteger(n)||n<min||n>max)throw Error(`${label}は${min}〜${max}の整数にしてください`);return n;}
function parseRoster(text,rounds){const rows=String(text).replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean);if(rows.length<2||rows.length>64)throw Error('参加者は2〜64人にしてください');const used=new Set();return rows.map((line,i)=>{const p=line.split(',').map(x=>x.trim());if(p.length>3||p.length<1||!p[0])throw Error(`${i+1}行目の形式が違います`);const name=p[0];if(name.length>36||/[<>\t]/.test(name))throw Error(`${i+1}行目の名前を確認してください`);if(used.has(name))throw Error(`参加者「${name}」が重複しています`);used.add(name);const start=p[1]?int(p[1],1,rounds,'参加開始'):1;const end=p[2]?int(p[2],1,rounds,'参加終了'):rounds;if(end<start)throw Error(`「${name}」の終了は開始以降にしてください`);return {name,start,end};});}
function parseApart(text,roster){const names=new Set(roster.map(p=>p.name)),pairs=[],seen=new Set();for(const [i,line] of String(text).replace(/\r/g,'').split('\n').entries()){if(!line.trim())continue;const p=line.split(',').map(x=>x.trim());if(p.length!==2||!p[0]||!p[1])throw Error(`同席禁止 ${i+1}行目は「A,B」の形式にしてください`);if(p[0]===p[1]||!p.every(n=>names.has(n)))throw Error(`同席禁止 ${i+1}行目の参加者を確認してください`);const key=pair(p[0],p[1]);if(!seen.has(key)){seen.add(key);pairs.push(key);}}return pairs;}
function pair(a,b){return [a,b].sort((x,y)=>x.localeCompare(y,'ja')).join('\u0001');}
function rng(seed){let s=(Number(seed)>>>0)||1;return function(){s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};}
function shuffle(a,r){for(let i=a.length-1;i>0;i--){let j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function existing(rounds){const contacts=new Map(),visits=new Map();for(const rd of rounds){for(let t=0;t<rd.groups.length;t++){const g=rd.groups[t];for(const a of g){if(!visits.has(a))visits.set(a,[]);visits.get(a)[t]=(visits.get(a)[t]||0)+1;}for(let i=0;i<g.length;i++)for(let j=i+1;j<g.length;j++){const k=pair(g[i],g[j]);contacts.set(k,(contacts.get(k)||0)+1);}}}return {contacts,visits};}
function score(groups,contacts,visits){let penalty=0;for(let t=0;t<groups.length;t++){const g=groups[t];for(let i=0;i<g.length;i++){const v=(visits.get(g[i])||[])[t]||0;penalty+=v*3;for(let j=i+1;j<g.length;j++)penalty+=(contacts.get(pair(g[i],g[j]))||0)*110;}}return penalty;}
function valid(groups,blocked){return groups.every(g=>g.every((a,i)=>g.slice(i+1).every(b=>!blocked.has(pair(a,b)))));}
function generate(roster,tableCount,roundCount,seed,apart,committed=[]){
  tableCount=int(tableCount,1,16,'卓数');roundCount=int(roundCount,1,12,'ラウンド数');const r=rng(int(seed,1,2147483647,'乱数シード'));
  if(!Array.isArray(committed)||committed.length>roundCount)throw Error('確定済みラウンドが不正です');const names=new Set(roster.map(p=>p.name));const blocked=new Set(apart);let out=committed.map((rd,i)=>{if(rd.round!==i+1||!Array.isArray(rd.groups)||rd.groups.length!==tableCount)throw Error('保存済みの卓構成が現在の設定と一致しません');return {round:rd.round,groups:rd.groups.map(g=>g.slice()),active:rd.active.slice()};});
  for(let round=out.length+1;round<=roundCount;round++){
    const active=roster.filter(p=>p.start<=round&&p.end>=round).map(p=>p.name),count=active.length;
    if(count===0){out.push({round,groups:Array.from({length:tableCount},()=>[]),active});continue;}
    const sizes=Array.from({length:tableCount},(_,t)=>Math.floor(count/tableCount)+(t<count%tableCount?1:0));const hist=existing(out);
    let best=null,bestScore=Infinity;const attempts=Math.min(420,Math.max(100,count*6));
    for(let z=0;z<attempts;z++){
      const groups=Array.from({length:tableCount},()=>[]);
      const order=shuffle(active.slice(),r).sort((a,b)=>{let da=0,db=0;for(const x of active){if(blocked.has(pair(a,x)))da++;if(blocked.has(pair(b,x)))db++;}return db-da;});
      let feasible=true;
      for(const name of order){const options=[];for(let t=0;t<tableCount;t++){
        if(groups[t].length>=sizes[t]||groups[t].some(v=>blocked.has(pair(name,v))))continue;
        const repeat=groups[t].reduce((s,v)=>s+(hist.contacts.get(pair(name,v))||0),0);
        const visits=(hist.visits.get(name)||[])[t]||0;
        options.push({t,weight:repeat*110+visits*3+r()*3});
      }
      if(!options.length){feasible=false;break;}options.sort((a,b)=>a.weight-b.weight);groups[options[0].t].push(name);
      }
      if(!feasible)continue;
      let val=score(groups,hist.contacts,hist.visits);
      for(let step=0;step<Math.min(100,count*6);step++){
        const a=Math.floor(r()*tableCount),b=Math.floor(r()*tableCount);if(a===b||!groups[a].length||!groups[b].length)continue;
        const ai=Math.floor(r()*groups[a].length),bi=Math.floor(r()*groups[b].length);
        [groups[a][ai],groups[b][bi]]=[groups[b][bi],groups[a][ai]];
        if(valid([groups[a],groups[b]],blocked)){const trial=score(groups,hist.contacts,hist.visits);if(trial<=val){val=trial;continue;}}
        [groups[a][ai],groups[b][bi]]=[groups[b][bi],groups[a][ai]];
      }
      if(val<bestScore){best=groups.map(g=>g.slice());bestScore=val;}
      if(val===0)break;
    }
    if(!best)throw Error(`第${round}回の同席禁止条件と卓数を両立できません。卓数を増やすか条件を緩めてください。`);
    out.push({round,groups:best,active});
  }
  return out;
}
function stats(rounds,roster){const pairs=new Map(),personal=new Map();for(const p of roster)personal.set(p.name,new Set());let total=0,repeat=0;const perRound=[];for(const rd of rounds){let fresh=0,old=0;for(const g of rd.groups){for(let i=0;i<g.length;i++)for(let j=i+1;j<g.length;j++){
  const key=pair(g[i],g[j]);const previous=pairs.get(key)||0;total++;if(previous){repeat++;old++;}else fresh++;
  pairs.set(key,previous+1);if(!personal.has(g[i]))personal.set(g[i],new Set());if(!personal.has(g[j]))personal.set(g[j],new Set());personal.get(g[i]).add(g[j]);personal.get(g[j]).add(g[i]);
}}perRound.push({round:rd.round,fresh,repeat:old});}
return {unique:pairs.size,total,repeat,perRound,personal:Object.fromEntries([...personal].map(([k,v])=>[k,v.size])),maxPairs:roster.length*(roster.length-1)/2};}
return {parseRoster,parseApart,pair,rng,generate,stats,valid,existing};
});
