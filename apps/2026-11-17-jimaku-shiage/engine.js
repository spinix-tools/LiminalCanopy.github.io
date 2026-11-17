/* 字幕しあげ / JIMAKU SHIAGE — pure subtitle engine, MIT */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JimakuEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SAMPLE=`1\n00:00:00,000 --> 00:00:01,300\n駅前の小さな喫茶店で、新しい企画が始まりました。\n\n2\n00:00:01,220 --> 00:00:03,600\n私たちは、いつもの景色を\n少し変えてみたいと思っています。\n\n3\n00:00:04,200 --> 00:00:05,000\nさあ、出発です！`;
  const PRESETS={vertical:{name:'縦型ショート（参考値）',maxCps:10,maxLine:16,maxLines:2,minMs:850,maxMs:7000,gapMs:80},horizontal:{name:'横型動画（参考値）',maxCps:13,maxLine:22,maxLines:2,minMs:850,maxMs:7000,gapMs:80}};
  const punctStart='、。，．！？!?）)]」』】〉》ぁぃぅぇぉっゃゅょー';
  const punctEnd='（([「『【〈《';
  const n=v=>Number(v);
  function timeToMs(raw){
    if(typeof raw!=='string')return null;
    const m=raw.trim().match(/^(?:(\d{1,3}):)?([0-5]\d):([0-5]\d)[,.](\d{3})$/);
    if(!m)return null;
    const hours=m[1]===undefined?0:n(m[1]);
    return ((hours*60+n(m[2]))*60+n(m[3]))*1000+n(m[4]);
  }
  function msToTime(ms,format='srt'){
    if(!Number.isFinite(ms)||ms<0)throw Error('時刻は0以上の有限値です');
    const t=Math.round(ms),h=Math.floor(t/3600000),m=Math.floor(t%3600000/60000),s=Math.floor(t%60000/1000),r=t%1000;
    return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':')+(format==='vtt'?'.':',')+String(r).padStart(3,'0');
  }
  function parse(input){
    const raw=String(input??'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
    if(!raw)return{cues:[],errors:['字幕データが空です。'],format:'srt'};
    const vtt=/^WEBVTT(?:\s|$)/.test(raw), source=vtt?raw.replace(/^WEBVTT[^\n]*(?:\n|$)/,'').trim():raw;
    const blocks=source.split(/\n\s*\n/), cues=[],errors=[];
    for(let b=0;b<blocks.length;b++){
      const lines=blocks[b].split('\n').map(x=>x.trimEnd()).filter((x,i,a)=>!(i===0&&!x.trim()));
      if(!lines.length)continue;
      if(vtt&&/^(NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0])){errors.push(`ブロック${b+1}: VTTの注釈・スタイルは保持できません。`);continue;}
      let pos=lines.findIndex(x=>x.includes('-->'));
      if(pos<0){errors.push(`ブロック${b+1}: 時刻行がありません。`);continue;}
      if(pos>1){errors.push(`ブロック${b+1}: 複数の識別子には非対応です。`);continue;}
      const timing=lines[pos].split(/\s*-->\s*/);
      const left=timing[0],right=timing.length===2?timing[1].split(/\s+/)[0]:'';
      const start=timeToMs(left),end=timeToMs(right);
      if(start===null||end===null||start>=end){errors.push(`ブロック${b+1}: 時刻が不正、または終了が開始以前です。`);continue;}
      const text=lines.slice(pos+1).join('\n');
      if(!text.trim()){errors.push(`ブロック${b+1}: 字幕テキストがありません。`);continue;}
      cues.push({id:b+1,start,end,text});
    }
    if(!cues.length&&!errors.length)errors.push('字幕ブロックが見つかりません。');
    return{cues,errors,format:vtt?'vtt':'srt'};
  }
  function visibleText(s){return String(s??'').replace(/<[^>]*>/g,'').replace(/\{\\[^}]*\}/g,'').replace(/\r/g,'');}
  function charCount(s){return Array.from(visibleText(s).replace(/\n/g,'')).length;}
  function analyze(cues,config){
    const o={...PRESETS.vertical,...(config||{})};
    const diagnostics=[];
    const ordered=cues.map((cue,index)=>({...cue,index})).sort((a,b)=>a.start-b.start||a.index-b.index);
    const nextMap=new Map(ordered.map((c,i)=>[c.index,ordered[i+1]||null]));
    let issueCount=0;
    for(let i=0;i<cues.length;i++){
      const c=cues[i], problems=[],duration=(c.end-c.start)/1000;
      const cps=duration>0?charCount(c.text)/duration:Infinity;
      const lengths=visibleText(c.text).split('\n').map(line=>Array.from(line).length);
      if(!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end<=c.start)problems.push('時刻不正');
      if(duration>0&&duration*1000<o.minMs)problems.push('表示が短い');
      if(duration*1000>o.maxMs)problems.push('表示が長い');
      if(cps>o.maxCps)problems.push('読む速度が速い');
      if(lengths.some(v=>v>o.maxLine))problems.push('1行が長い');
      if(lengths.length>o.maxLines)problems.push('行数が多い');
      if(!String(c.text).trim())problems.push('本文が空');
      if(i>0&&c.start<cues[i-1].start)problems.push('入力順が前後');
      const next=nextMap.get(i);
      if(next){
        if(c.end>next.start)problems.push('次の字幕と重複');
        else if(next.start-c.end<o.gapMs)problems.push('次字幕との間隔が短い');
      }
      issueCount+=problems.length;
      diagnostics.push({index:i,problems,cps,duration,lengths,chars:charCount(c.text),nextIndex:next?next.index:null});
    }
    return{diagnostics,issueCount,flagged:diagnostics.filter(d=>d.problems.length).length};
  }
  function validateForExport(cues){
    if(!Array.isArray(cues)||!cues.length)throw Error('字幕がありません。');
    for(const c of cues){if(!Number.isSafeInteger(c.start)||!Number.isSafeInteger(c.end)||c.start<0||c.end<=c.start||!String(c.text||'').trim())throw Error('時刻や本文が不正な字幕があります。');}
  }
  function exportSrt(cues){validateForExport(cues);return cues.slice().sort((a,b)=>a.start-b.start).map((c,i)=>`${i+1}\n${msToTime(c.start)} --> ${msToTime(c.end)}\n${c.text.trim()}`).join('\n\n')+'\n';}
  function exportVtt(cues){validateForExport(cues);return 'WEBVTT\n\n'+cues.slice().sort((a,b)=>a.start-b.start).map(c=>`${msToTime(c.start,'vtt')} --> ${msToTime(c.end,'vtt')}\n${c.text.trim()}`).join('\n\n')+'\n';}
  function suggestedBreak(raw,maxLine){
    const clean=String(raw??'').split('\n').map(x=>x.trim()).filter(Boolean).reduce((acc,part)=>{
      if(!acc)return part;
      return acc+(/[a-zA-Z0-9]$/.test(acc)&&/^[a-zA-Z0-9]/.test(part)?' ':'')+part;
    },'');
    const chars=Array.from(clean),length=chars.length;
    if(!length)return{ok:false,reason:'本文が空です。'};
    if(length<=maxLine)return{ok:true,text:clean,changed:clean!==raw};
    if(length>maxLine*2)return{ok:false,reason:'2行に収まりません。本文を短くしてください。'};
    let best=null;
    for(let pos=Math.max(1,length-maxLine);pos<=Math.min(maxLine,length-1);pos++){
      const before=chars[pos-1],after=chars[pos];
      if(punctStart.includes(after)||punctEnd.includes(before))continue;
      if(/[A-Za-z]/.test(before)&&/[A-Za-z]/.test(after))continue;
      const a=chars.slice(0,pos).join('').trimEnd(),b=chars.slice(pos).join('').trimStart();
      if(!a||!b||Array.from(a).length>maxLine||Array.from(b).length>maxLine)continue;
      const score=Math.abs(Array.from(a).length-Array.from(b).length)*2 + (/[、。，．!?！？]/.test(before)?-5:0) +(before===' '?-4:0)+(after===' '?-2:0);
      if(!best||score<best.score)best={score,text:a+'\n'+b};
    }
    return best?{ok:true,text:best.text,changed:best.text!==raw}:{ok:false,reason:'自然な改行位置が見つかりません。'};
  }
  function extendSafely(cues,index,config){
    const c=cues[index];if(!c) return{ok:false,reason:'字幕がありません。'};
    const o={...PRESETS.vertical,...(config||{})};
    const desired=Math.ceil(Math.max(o.minMs,1000*charCount(c.text)/o.maxCps));
    if(!Number.isFinite(desired)||desired>o.maxMs)return{ok:false,reason:'必要な表示時間が長すぎます。本文を短くする必要があります。'};
    const next=cues.filter((x,i)=>i!==index&&x.start>=c.start).sort((a,b)=>a.start-b.start)[0];
    const available=next?next.start-o.gapMs:Infinity;
    const end=c.start+desired;
    if(end>available)return{ok:false,reason:'次の字幕に重なるため延長できません。文言やタイミングを手動調整してください。'};
    if(end<=c.end)return{ok:false,reason:'必要な表示時間をすでに満たしています。'};
    return{ok:true,cue:{...c,end}};
  }
  function shortenOverlap(cues,index,config){
    const c=cues[index];if(!c)return{ok:false,reason:'字幕がありません。'};
    const o={...PRESETS.vertical,...(config||{})};
    const next=cues.filter((x,i)=>i!==index&&x.start>=c.start).sort((a,b)=>a.start-b.start)[0];
    if(!next)return{ok:false,reason:'次の字幕がありません。'};
    const newEnd=Math.min(c.end,next.start-o.gapMs);
    if(newEnd<=c.start)return{ok:false,reason:'終了を短くすると表示時間が0以下になります。手動調整してください。'};
    if(newEnd===c.end)return{ok:false,reason:'次の字幕との間隔は確保されています。'};
    return{ok:true,cue:{...c,end:newEnd}};
  }
  function csvReport(cues,config){
    const a=analyze(cues,config).diagnostics;
    const quote=s=>'"'+String(s??'').replace(/"/g,'""')+'"';
    return '\uFEFF'+[['#','start','end','duration_s','chars','cps','issues','text'].map(quote).join(',')].concat(cues.map((c,i)=>[i+1,msToTime(c.start),msToTime(c.end),a[i].duration.toFixed(2),a[i].chars,Number.isFinite(a[i].cps)?a[i].cps.toFixed(1):'∞',a[i].problems.join('/'),c.text].map(quote).join(','))).join('\r\n')+'\r\n';
  }
  return{SAMPLE,PRESETS,timeToMs,msToTime,parse,visibleText,charCount,analyze,exportSrt,exportVtt,suggestedBreak,extendSafely,shortenOverlap,csvReport};
});
