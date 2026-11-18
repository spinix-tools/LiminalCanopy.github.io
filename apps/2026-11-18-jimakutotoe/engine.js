/* JIMAKU TOTOE — plain JS subtitle quality engine, MIT License */
(function (global) {
'use strict';
const DEFAULT_RULES = Object.freeze({cps: 15, lineChars: 18, lines: 2, minDuration: 900, maxDuration: 7500, minGap: 80});
const CLOSING = /[、。，．！？!?：:；;」』）】〉》］｝%％℃…ー]/u;
const OPENING = /[「『（【〈《［｛]/u;
function chars(s) { if (typeof Intl!=='undefined' && Intl.Segmenter) return Array.from(new Intl.Segmenter('ja', {granularity:'grapheme'}).segment(String(s))).map(x=>x.segment); return Array.from(String(s)); }
function count(s) { return chars(String(s).replace(/\s/g,'')).length; }
function parseTime(value) {
  const s = String(value).trim().replace(',', '.');
  const m=s.match(/^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  const h = +(m[1]||0), min=+m[2], sec=+m[3];
  if (min>59 || sec>59) return null;
  return ((h*60+min)*60+sec)*1000 + +(m[4]||'').padEnd(3,'0');
}
function formatTime(ms, sep=',') {
  ms=Math.max(0,Math.round(Number(ms)||0));
  const h=Math.floor(ms/3600000), m=Math.floor(ms/60000)%60, s=Math.floor(ms/1000)%60, fract=ms%1000;
  return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':')+sep+String(fract).padStart(3,'0');
}
function cleanText(t) { return String(t||'').replace(/\r/g,'').trim(); }
function parseSubtitles(raw) {
  const source=String(raw||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
  const blocks=source.split(/\n\s*\n+/).filter(Boolean);
  const cues=[], errors=[];
  let format=/^WEBVTT(?:\s|$)/.test(source)?'vtt':'srt';
  for (let i=0;i<blocks.length;i++) {
    let lines=blocks[i].split('\n');
    if (i===0 && /^WEBVTT(?:\s|$)/.test(lines[0])) {lines.shift();while(lines.length && !lines[0].trim()) lines.shift(); if(!lines.length)continue;}
    if (/^(NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0])) continue;
    const timeIdx=lines.findIndex(line=>line.includes('-->'));
    if(timeIdx<0) {errors.push(`ブロック ${i+1}: 時刻指定がありません`);continue;}
    const tm=lines[timeIdx].match(/^\s*(\d{1,3}:\d{1,2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,3}:\d{1,2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})(?:\s+.*)?$/);
    if(!tm) {errors.push(`ブロック ${i+1}: 時刻形式が不正です`);continue;}
    const start=parseTime(tm[1]),end=parseTime(tm[2]);
    if(start===null || end===null) {errors.push(`ブロック ${i+1}: 時刻が不正です`);continue;}
    const text=cleanText(lines.slice(timeIdx+1).join('\n'));
    cues.push({id:`cue-${i+1}`,start,end,text});
  }
  if (blocks.length>0 && !cues.length && !errors.length) errors.push('字幕が見つかりません');
  return {format,cues,errors};
}
function exportSubtitles(cues,format='srt') {
  const vtt=format==='vtt';
  const blocks=cues.map((c,i) => `${vtt?'':String(i+1)+'\n'}${formatTime(c.start,vtt?'.':',')} --> ${formatTime(c.end,vtt?'.':',')}\n${cleanText(c.text)}`);
  return (vtt?'WEBVTT\n\n':'')+blocks.join('\n\n')+(blocks.length?'\n':'');
}
function analyze(cues, rules=DEFAULT_RULES) {
  const settings={...DEFAULT_RULES,...rules};
  const rows=cues.map((cue,i)=>{
    const duration=cue.end-cue.start, length=count(cue.text), speed=duration>0?length/(duration/1000):Infinity;
    const lines=cue.text.split('\n');const problems=[];
    if(cue.start<0 || cue.end<=cue.start) problems.push({severity:'error',key:'time',label:'時刻の前後関係が不正'});
    if(!cleanText(cue.text))problems.push({severity:'error',key:'empty',label:'字幕が空'});
    if (i && cue.start<cues[i-1].end) problems.push({severity:'error',key:'overlap',label:`前の字幕と ${((cues[i-1].end-cue.start)/1000).toFixed(2)}秒重複`});
    if(i && cue.start<cues[i-1].start) problems.push({severity:'error',key:'order',label:'開始時刻が逆順'});
    if(i && cue.start>=cues[i-1].end && cue.start-cues[i-1].end<settings.minGap) problems.push({severity:'warn',key:'gap',label:`前の字幕との間隔が ${settings.minGap}ms 未満`});
    if(duration>0 && duration<settings.minDuration)problems.push({severity:'warn',key:'short',label:'表示時間が短い'});
    if(duration>settings.maxDuration)problems.push({severity:'warn',key:'long',label:'表示時間が長い'});
    if(speed>settings.cps) problems.push({severity:'warn',key:'speed',label:`${speed.toFixed(1)} 字/秒（設定 ${settings.cps}）`});
    if(lines.length>settings.lines)problems.push({severity:'warn',key:'lines',label:`${lines.length} 行（設定 ${settings.lines}）`});
    if(lines.some(x=>chars(x).length>settings.lineChars))problems.push({severity:'warn',key:'width',label:`1行 ${settings.lineChars} 字を超過`});
    return {cue, index:i, duration, length, speed,lines:lines.length,problems};
  });
  return {rows, errors:rows.reduce((n,r)=>n+r.problems.filter(x=>x.severity==='error').length,0), warnings:rows.reduce((n,r)=>n+r.problems.filter(x=>x.severity==='warn').length,0), clean:rows.filter(r=>r.problems.length===0).length};
}
// Japanese-aware greedy-with-rebalancing line breaks; does not modify text content except whitespace at existing line boundaries.
function breakLines(input,maxChars=18, maxLines=2) {
  let text=cleanText(input).replace(/\n/g, '');
  const inputHasSpaces = /[A-Za-z]/.test(text);
  if(inputHasSpaces) text=cleanText(input).replace(/\n/g,' ');
  const g=chars(text); if(g.length<=maxChars) return text;
  const result=[];
  let pos=0;
  while(pos<g.length) {
    let end=Math.min(pos+maxChars,g.length);
    if(end<g.length) {
      // favor ending after a pause, avoiding a line starting with closing punctuation
      const limit=Math.max(pos+Math.floor(maxChars*.58),end-6);
      for(let j=end;j>=limit;j--){ if(/[、。！？!?，,.]/u.test(g[j-1])) {end=j;break;} }
      while(end<g.length && CLOSING.test(g[end]) && end-pos<maxChars+2)end++;
      while(end>pos+1 && OPENING.test(g[end-1]))end--;
      if(inputHasSpaces){
        const near=g.slice(pos,end).lastIndexOf(' ');
        if(near>Math.round(maxChars*.5) && end-pos-near<Math.round(maxChars*.6))end=pos+near+1;
      }
    }
    result.push(g.slice(pos,end).join('').trim());pos=end;
    while(inputHasSpaces && g[pos]===' ')pos++;
    if(result.length>1000)break;
  }
  // do not truncate: more than maxLines is deliberately flagged by QA
  return result.join('\n');
}
function autoFix(cues, rules=DEFAULT_RULES, mode='both') {
  const settings={...DEFAULT_RULES,...rules};
  let lineCount=0, timingCount=0, skipped=0;
  const result=cues.map(c=>({...c}));
  if(mode==='both' || mode==='lines'){
    result.forEach(c=>{const next=breakLines(c.text,settings.lineChars,settings.lines);if(next!==c.text){c.text=next;lineCount++;}});
  }
  if(mode==='both' || mode==='timing'){
    // trim *only the previous cue*, with a safety floor. No arbitrary extending or shifting of speech.
    for(let i=1;i<result.length;i++){
      const prev=result[i-1],curr=result[i];
      if(prev.end>curr.start){
        const proposed=curr.start-settings.minGap;
        if(proposed>=prev.start+settings.minDuration && proposed<prev.end){prev.end=proposed;timingCount++;}
        else skipped++;
      }
    }
  }
  return {cues:result,lineCount,timingCount,skipped};
}
function csvQuote(s){return '"'+String(s).replace(/"/g,'""')+'"';}
function exportReport(cues,rules){
  const report=analyze(cues,rules);
  return ['番号,開始,終了,秒数,字/秒,指摘,本文',...report.rows.map(r=>[
    r.index+1,formatTime(r.cue.start),formatTime(r.cue.end),(r.duration/1000).toFixed(2),Number.isFinite(r.speed)?r.speed.toFixed(1):'∞',csvQuote(r.problems.map(p=>p.label).join(' / ')),csvQuote(r.cue.text.replace(/\n/g,' / '))
  ].join(','))].join('\r\n')+'\r\n';
}
const api={DEFAULT_RULES,parseTime,formatTime,parseSubtitles,exportSubtitles,count,chars,analyze,breakLines,autoFix,exportReport};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
global.JimakuEngine=api;
})(typeof window!=='undefined'?window:globalThis);