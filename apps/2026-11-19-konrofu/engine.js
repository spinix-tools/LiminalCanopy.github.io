const KonroEngine = (function makeEngine(){
  "use strict";
  const resources=["hand","burner","oven","rice","none"];
  const defaults={serve:"19:00",capacity:{hand:1,burner:1,oven:1,rice:1},steps:[
    {id:"s1",dish:"鮭のソテー",name:"下味・水分を拭く",mins:8,resource:"hand",attention:false,after:""},
    {id:"s2",dish:"鮭のソテー",name:"フライパンで焼く",mins:13,resource:"burner",attention:true,after:"s1"},
    {id:"s3",dish:"鮭のソテー",name:"皿に盛る",mins:3,resource:"hand",attention:false,after:"s2"},
    {id:"s4",dish:"豆腐のみそ汁",name:"具材を切る",mins:7,resource:"hand",attention:false,after:""},
    {id:"s5",dish:"豆腐のみそ汁",name:"だしで煮る",mins:11,resource:"burner",attention:false,after:"s4"},
    {id:"s6",dish:"豆腐のみそ汁",name:"味噌を溶く",mins:3,resource:"hand",attention:false,after:"s5"},
    {id:"s7",dish:"炊きたてご飯",name:"米を研ぐ",mins:5,resource:"hand",attention:false,after:""},
    {id:"s8",dish:"炊きたてご飯",name:"炊飯",mins:32,resource:"rice",attention:false,after:"s7"},
    {id:"s9",dish:"炊きたてご飯",name:"蒸らし",mins:10,resource:"none",attention:false,after:"s8"},
    {id:"s10",dish:"青菜のおひたし",name:"洗って切る",mins:6,resource:"hand",attention:false,after:""},
    {id:"s11",dish:"青菜のおひたし",name:"ゆでる",mins:5,resource:"burner",attention:true,after:"s10"},
    {id:"s12",dish:"青菜のおひたし",name:"水気をしぼる",mins:4,resource:"hand",attention:false,after:"s11"}
  ]};
  function copy(v){return JSON.parse(JSON.stringify(v));}
  function isInt(v,lo,hi){return Number.isInteger(v)&&v>=lo&&v<=hi;}
  function validate(p){
    if(!p||typeof p!=="object"||!Array.isArray(p.steps))throw Error("データ形式が正しくありません");
    if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(p.serve))throw Error("提供時刻は HH:MM 形式にしてください");
    const cap=p.capacity||{};
    if(!isInt(cap.hand,1,3)||!isInt(cap.burner,1,4)||!isInt(cap.oven,0,2)||!isInt(cap.rice,0,2))throw Error("設備数は指定範囲内で設定してください");
    if(p.steps.length===0||p.steps.length>45)throw Error("工程は1〜45件にしてください");
    const ids=new Set();
    for(const s of p.steps){
      if(!s||typeof s.id!=="string"||!s.id||ids.has(s.id))throw Error("工程IDが重複しています");
      ids.add(s.id);
      if(typeof s.dish!=="string"||!s.dish.trim()||s.dish.length>50||typeof s.name!=="string"||!s.name.trim()||s.name.length>60)throw Error("料理名・工程名を確認してください");
      if(!isInt(s.mins,1,180))throw Error("所要時間は1〜180分にしてください");
      if(!resources.includes(s.resource))throw Error("設備の種類が不正です");
      if(typeof s.attention!=="boolean")throw Error("手作業の有無が不正です");
      if(typeof s.after!=="string")throw Error("前工程が不正です");
      if(s.resource!=="none"&&cap[s.resource]===0)throw Error("使用する設備が0台です: "+s.name);
    }
    const byId=new Map(p.steps.map(s=>[s.id,s]));
    for(const s of p.steps){
      if(s.after&&!byId.has(s.after))throw Error("前工程が見つかりません: "+s.name);
      if(s.after&&byId.get(s.after).dish!==s.dish)throw Error("前工程は同じ料理から選んでください: "+s.name);
    }
    const visited=new Set(),active=new Set();
    function visit(id){
      if(active.has(id))throw Error("工程の依存関係が循環しています");
      if(visited.has(id))return;
      active.add(id);
      const prev=byId.get(id).after;if(prev)visit(prev);
      active.delete(id);visited.add(id);
    }
    for(const s of p.steps)visit(s.id);
    return true;
  }
  function requirements(s){
    const a=[];
    if(s.resource!=="none")a.push(s.resource);
    if(s.attention&&s.resource!=="hand")a.push("hand");
    return a;
  }
  function solve(p){
    validate(p);
    const successors=new Map(p.steps.map(s=>[s.id,[]]));
    for(const s of p.steps){if(s.after)successors.get(s.after).push(s.id);}
    const picked=new Map(),pending=new Map(p.steps.map(s=>[s.id,s]));
    const use={hand:[],burner:[],oven:[],rice:[]};
    while(pending.size){
      const ready=[...pending.values()].filter(s=>successors.get(s.id).every(id=>picked.has(id)));
      if(!ready.length)throw Error("依存関係に問題があります");
      ready.sort((a,b)=>{
        const da=successors.get(a.id).length?Math.min(...successors.get(a.id).map(id=>picked.get(id).start)):0;
        const db=successors.get(b.id).length?Math.min(...successors.get(b.id).map(id=>picked.get(id).start)):0;
        return db-da||b.mins-a.mins||a.id.localeCompare(b.id);
      });
      const s=ready[0],children=successors.get(s.id);
      let end=children.length?Math.min(...children.map(id=>picked.get(id).start)):0;
      const req=requirements(s);
      let found=false;
      for(let e=end;e>=-1440;e--){
        const start=e-s.mins;
        let ok=true;
        for(const r of req){
          let n=0;
          for(const b of use[r])if(start<b.end&&e>b.start)n++;
          // Pairwise overlap is not enough for capacity 2+, count simultaneous load via sweep.
          if(n>=p.capacity[r]){ 
            const events=[];
            for(const b of use[r])if(start<b.end&&e>b.start){events.push([Math.max(start,b.start),1]);events.push([Math.min(e,b.end),-1]);}
            events.sort((x,y)=>x[0]-y[0]||x[1]-y[1]);
            let active=0;
            for(const ev of events){active+=ev[1];if(active>=p.capacity[r]){ok=false;break;}}
          }
          if(!ok)break;
        }
        if(ok){
          picked.set(s.id,{...s,start,end:e,requirements:req});
          for(const r of req)use[r].push({start,end:e,id:s.id});
          found=true;break;
        }
      }
      if(!found)throw Error("24時間以内に配置できません。工程を短くしてください");
      pending.delete(s.id);
    }
    const items=[...picked.values()].sort((a,b)=>a.start-b.start||a.end-b.end||a.id.localeCompare(b.id));
    const start=Math.min(...items.map(x=>x.start));
    const dishes=[...new Set(p.steps.map(s=>s.dish))].map(d=>{
      const final=p.steps.filter(s=>s.dish===d&&successors.get(s.id).length===0);
      const finish=Math.max(...final.map(s=>picked.get(s.id).end));
      return {name:d,finish,hold:-finish};
    });
    return {items,from:start,span:-start,dishes,maxHold:Math.max(...dishes.map(d=>d.hold)),totalHold:dishes.reduce((a,d)=>a+d.hold,0),serve:p.serve,capacity:copy(p.capacity)};
  }
  function clock(hm,relative){
    const spl=hm.split(":").map(Number);const absolute=spl[0]*60+spl[1]+relative;
    const days=Math.floor(absolute/1440);const v=((absolute%1440)+1440)%1440;
    const h=String(Math.floor(v/60)).padStart(2,"0"),m=String(v%60).padStart(2,"0");
    return h+":"+m+(days<0?" 前日":days>0?" 翌日":"");
  }
  function comparison(p){
    const base=solve(p), alt=copy(p);alt.capacity.burner=Math.min(4,p.capacity.burner+1);
    const withBurner=solve(alt), helper=copy(p);helper.capacity.hand=Math.min(3,p.capacity.hand+1);
    return {base,withBurner,withHelper:solve(helper)};
  }
  function csv(p){
    const s=solve(p),head=["料理","工程","開始","終了","分","設備","手の作業","前工程"];
    const rows=s.items.map(i=>[i.dish,i.name,clock(p.serve,i.start),clock(p.serve,i.end),String(i.mins),i.resource,i.requirements.includes("hand")?"あり":"なし",i.after]);
    function q(s){return '"'+String(s).replace(/"/g,'""')+'"';}
    return "\ufeff"+[head,...rows].map(a=>a.map(q).join(",")).join("\r\n");
  }
  return {defaults:copy(defaults),validate,solve,clock,comparison,csv,copy};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = KonroEngine;
