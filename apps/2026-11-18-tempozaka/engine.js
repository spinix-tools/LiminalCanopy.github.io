(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.TempoEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MAX_SEGMENTS=16, MAX_EVENTS=45000;
  const PRESETS={
    climb:{name:'階段トレーニング',countIn:true,segments:[
      {name:'ゆっくり確認',start:64,end:64,bars:8,beats:4,sub:1,mode:'play'},
      {name:'少しずつ加速',start:68,end:96,bars:12,beats:4,sub:2,mode:'play'},
      {name:'仕上げの反復',start:100,end:100,bars:8,beats:4,sub:1,mode:'play'},
      {name:'休憩',start:72,end:72,bars:4,beats:4,sub:1,mode:'rest'}
    ]},
    trio:{name:'３拍子と３連符',countIn:true,segments:[
      {name:'ワルツの重心',start:72,end:72,bars:8,beats:3,sub:1,mode:'play'},
      {name:'３連符を正確に',start:72,end:92,bars:12,beats:3,sub:3,mode:'play'},
      {name:'元の速さに戻す',start:72,end:72,bars:8,beats:3,sub:1,mode:'play'}
    ]},
    stamina:{name:'短時間集中',countIn:true,segments:[
      {name:'ウォームアップ',start:80,end:80,bars:8,beats:4,sub:1,mode:'play'},
      {name:'挑戦',start:100,end:116,bars:12,beats:4,sub:2,mode:'play'},
      {name:'小休止（無音）',start:80,end:80,bars:4,beats:4,sub:1,mode:'rest'},
      {name:'再挑戦',start:112,end:112,bars:10,beats:4,sub:1,mode:'play'}
    ]}
  };
  const copy = x=>JSON.parse(JSON.stringify(x));
  function integer(value,lo,hi,label){
    if(value===''||value===null||value===undefined||!Number.isInteger(Number(value))||Number(value)<lo||Number(value)>hi)
      throw new Error(`${label} は ${lo}〜${hi} の整数で入力してください。`);
    return Number(value);
  }
  function validateSegment(s){
    if(!s||typeof s!=='object')throw new Error('ブロックが不正です。');
    const name=String(s.name||'練習').trim().slice(0,40);
    const mode= s.mode==='rest'?'rest':s.mode==='play'?'play':null;
    if(!mode)throw new Error('モードが不正です。');
    return {name:name||'練習',start:integer(s.start,30,260,'開始BPM'),end:integer(s.end,30,260,'終了BPM'),bars:integer(s.bars,1,48,'小節数'),beats:integer(s.beats,2,12,'拍数'),sub:integer(s.sub,1,4,'分割数'),mode};
  }
  function validatePlan(p){
    if(!p||typeof p!=='object'||!Array.isArray(p.segments)||!p.segments.length||p.segments.length>MAX_SEGMENTS)throw new Error('練習ブロックは1〜16件にしてください。');
    const name=String(p.name||'マイ練習').trim().slice(0,60)||'マイ練習';
    return {name,countIn:!!p.countIn,segments:p.segments.map(validateSegment)};
  }
  function preset(key){return copy(PRESETS[key]||PRESETS.climb);}
  function barBpm(s,bar){return s.bars===1?s.start:Math.round((s.start+(s.end-s.start)*bar/(s.bars-1))*1000)/1000;}
  function buildTimeline(raw){
    const p=validatePlan(raw),events=[],bars=[],blocks=[];
    let time=0,track=0;
    function beatEvents(t,bpm,sub,accent,info){
      for(let k=0;k<sub;k++){
        if(events.length>=MAX_EVENTS)throw new Error('拍イベントの上限を超えました。');
        events.push({...info,t:t+(60/bpm)*k/sub,accent:accent&&k===0,subbeat:k,muted:info.mode==='rest'});
      }
    }
    const first=p.segments[0];
    if(p.countIn){
      for(let beat=0;beat<first.beats;beat++)beatEvents(time+(60/first.start)*beat,first.start,1,beat===0,{kind:'count',segment:-1,bar:-1,beat,mode:'play',bpm:first.start});
      time+=first.beats*60/first.start;
    }
    const rehearsalStart=time;
    p.segments.forEach((s,si)=>{
      const blockStart=time;
      for(let bar=0;bar<s.bars;bar++){
        const bpm=barBpm(s,bar),barStart=time;
        for(let beat=0;beat<s.beats;beat++){
          beatEvents(time,bpm,s.sub,beat===0,{kind:'practice',segment:si,bar,beat,mode:s.mode,bpm});
          time+=60/bpm;
        }
        bars.push({segment:si,bar,bpm,start:barStart,end:time,mode:s.mode,beats:s.beats});
      }
      blocks.push({index:si,name:s.name,mode:s.mode,start:blockStart,end:time,duration:time-blockStart,startBpm:s.start,endBpm:s.end,bars:s.bars});
      track+=s.bars;
    });
    return {plan:p,events,bars,blocks,countInSeconds:rehearsalStart,totalSeconds:time,practiceSeconds:time-rehearsalStart,totalBars:track};
  }
  function formatDuration(sec){const n=Math.ceil(Math.max(0,sec));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
  function progressAt(timeline,seconds){
    const t=Math.max(0,Number(seconds)||0);
    if(t>=timeline.totalSeconds){const last=timeline.blocks.at(-1);return {phase:'done',block:last?last.index:-1,bpm:last?last.endBpm:0,progress:1,bar:null};}
    if(t<timeline.countInSeconds)return {phase:'count',block:-1,bpm:timeline.plan.segments[0].start,progress:t/timeline.totalSeconds,bar:null};
    let low=0,hi=timeline.bars.length-1;
    while(low<=hi){let m=Math.floor((low+hi)/2);if(timeline.bars[m].end<=t)low=m+1;else hi=m-1;}
    const b=timeline.bars[low];
    return {phase:b.mode,block:b.segment,bpm:b.bpm,progress:t/timeline.totalSeconds,bar:b.bar+1};
  }
  function csv(timeline){
    const esc=v=>'"'+String(v).replace(/"/g,'""')+'"';
    const lines=[['ブロック','モード','小節','BPM','開始秒','終了秒'].map(esc).join(',')];
    for(const b of timeline.bars){const s=timeline.plan.segments[b.segment];lines.push([s.name,b.mode,b.bar+1,b.bpm,b.start.toFixed(3),b.end.toFixed(3)].map(esc).join(','));}
    return '\uFEFF'+lines.join('\r\n')+'\r\n';
  }
  function tempoFromTaps(times){
    if(!Array.isArray(times)||times.length<2)return null;
    const ds=[];for(let i=1;i<times.length;i++){const d=times[i]-times[i-1];if(d>200&&d<2000)ds.push(d);}
    if(!ds.length)return null;
    ds.sort((a,b)=>a-b);const mid=ds[Math.floor(ds.length/2)];return Math.min(260,Math.max(30,Math.round(60000/mid)));
  }
  return {MAX_SEGMENTS,PRESETS,preset,validateSegment,validatePlan,barBpm,buildTimeline,progressAt,formatDuration,csv,tempoFromTaps};
});
