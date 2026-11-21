/* 字幕のりしろ: offline subtitle timing / line-break workbench. MIT License. */
(function (root, factory) {
  const lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else root.Norishiro = lib;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DEFAULTS = Object.freeze({maxWidth:13, maxLines:2, maxSpeed:8, minDuration:700, maxDuration:7000, minGap:100});
  const PRESETS = Object.freeze({
    horizontal:{...DEFAULTS},
    vertical:{...DEFAULTS,maxWidth:10,maxSpeed:7},
    loose:{...DEFAULTS,maxWidth:16,maxSpeed:10,minGap:0}
  });
  const RULES = {badtime:'時刻不正', overlap:'字幕重なり', gap:'切替間隔不足', short:'表示時間が短い', long:'表示時間が長い', speed:'読速超過', width:'1行が長い', lines:'行数超過', head:'行頭禁則', tail:'行末禁則', empty:'字幕テキストなし'};
  const BAD_HEAD = /^[、。，．・！？!?,.:;：；）〕］｝】』」〉》％%]/u;
  const BAD_TAIL = /[（〔［｛【『「〈《]$/u;
  const copy = x => JSON.parse(JSON.stringify(x));
  const pad = (n, len=2) => String(n).padStart(len,'0');

  function parseTime(raw) {
    const text=String(raw).trim();
    const m=text.match(/^(?:(\d{1,4}):)?(\d{1,2}):(\d{2})[.,](\d{3})$/);
    if (!m) return NaN;
    let h=m[1]===undefined?0:Number(m[1]), min=Number(m[2]), sec=Number(m[3]), mil=Number(m[4]);
    if (min>59||sec>59||!Number.isSafeInteger(h)) return NaN;
    return ((h*60+min)*60+sec)*1000+mil;
  }
  function timecode(ms,format='srt') {
    if (!Number.isFinite(ms) || ms<0) return 'INVALID';
    const t=Math.round(ms), h=Math.floor(t/3600000), m=Math.floor(t/60000)%60, s=Math.floor(t/1000)%60;
    return `${pad(h)}:${pad(m)}:${pad(s)}${format==='vtt'?'.':','}${pad(t%1000,3)}`;
  }
  function parse(input) {
    const normalized=String(input||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
    const vtt=/^WEBVTT(?:[ \t]|\n|$)/.test(normalized);
    const format=vtt?'vtt':'srt';
    const text=vtt?normalized.replace(/^WEBVTT[^\n]*(?:\n|$)/,'').trim():normalized;
    const blocks=text?text.split(/\n\s*\n+/):[];
    const cues=[],warnings=[];
    for(let bi=0;bi<blocks.length;bi++) {
      let lines=blocks[bi].split('\n').map(line=>line.trimEnd());
      if (vtt && /^(?:NOTE|STYLE|REGION)(?:[ \t]|$)/.test(lines[0])) {
        warnings.push(`${bi+1}番目のブロック: VTTのNOTE/STYLE/REGIONは編集対象外（出力では除外）`);
        continue;
      }
      if (!vtt && /^\d+$/.test(lines[0].trim())) lines=lines.slice(1);
      let index=lines.findIndex(x=>x.includes('-->'));
      if (index<0 || index>1) {warnings.push(`${bi+1}番目のブロック: 時刻行がなく読み飛ばしました`);continue;}
      const match=lines[index].match(/^\s*(\S+)\s+-->\s+(\S+)(.*)$/);
      if (!match) {warnings.push(`${bi+1}番目のブロック: 時刻行を解釈できません`);continue;}
      const start=parseTime(match[1]),end=parseTime(match[2]);
      if (!Number.isFinite(start)||!Number.isFinite(end)) {warnings.push(`${bi+1}番目のブロック: 時刻の形式が不正で読み飛ばしました`);continue;}
      const cueText=lines.slice(index+1).join('\n');
      const sourceId=index===1?lines[0].trim():'';
      cues.push({id:bi+1,sourceId,start,end,text:cueText,settings:vtt?(match[3]||'').trim():''});
    }
    if (!text) warnings.push('空の字幕データです');
    return {format,cues,warnings};
  }
  function visibleText(text) {
    return String(text||'').replace(/<\/?(?:b|i|u|c(?:\.[^>\s]+)?|v(?:\s+[^>]*)?|lang(?:\s+[^>]*)?|ruby|rt)[^>]*>/gi,'').replace(/\{\\[^}]*\}/g,'');
  }
  function charWidth(ch) {
    if (/^[\u0300-\u036F\uFE00-\uFE0F\u200D]$/u.test(ch)) return 0;
    if (/^[\x00-\x7F\uFF61-\uFF9F]$/u.test(ch)) return 0.5;
    return 1;
  }
  function width(str) {let out=0;for(const ch of String(str))out+=charWidth(ch);return Math.round(out*10)/10;}
  function linesOf(cue) {return visibleText(cue.text).split('\n');}
  function score(cue) {
    const lines=linesOf(cue),duration=cue.end-cue.start;
    const count=width(lines.join(''));
    return {duration,count,speed:duration>0?+(1000*count/duration).toFixed(2):Infinity,lines:lines.length,maxLine:Math.max(0,...lines.map(width))};
  }
  function settingsOf(input) {
    const s={...DEFAULTS,...input};
    const keys=['maxWidth','maxLines','maxSpeed','minDuration','maxDuration','minGap'];
    for (const k of keys) if(!Number.isFinite(s[k]) || s[k]<0) throw Error(`設定値 ${k} が不正です`);
    if(s.maxWidth===0||s.maxLines<1||s.maxSpeed===0||s.maxDuration<s.minDuration) throw Error('検品基準の大小関係が不正です');
    return s;
  }
  function analyze(cues,params={}) {
    const s=settingsOf(params),sorted=[...cues].sort((a,b)=>a.start-b.start||a.id-b.id);
    const rows=sorted.map(cue=>{
      const x=score(cue),l=linesOf(cue),issues=[];
      if(cue.end<=cue.start||cue.start<0) issues.push('badtime');
      if(!visibleText(cue.text).trim()) issues.push('empty');
      if(x.duration>0 && x.duration<s.minDuration)issues.push('short');
      if(x.duration>s.maxDuration) issues.push('long');
      if(x.speed>s.maxSpeed)issues.push('speed');
      if(x.maxLine>s.maxWidth)issues.push('width');
      if(l.length>s.maxLines)issues.push('lines');
      if(l.slice(1).some(v=>BAD_HEAD.test(v.trimStart())))issues.push('head');
      if(l.slice(0,-1).some(v=>BAD_TAIL.test(v.trimEnd())))issues.push('tail');
      return {cue,...x,issues};
    });
    for(let i=1;i<rows.length;i++) {
      const prev=rows[i-1].cue,cur=rows[i].cue;
      if(cur.start<prev.end)rows[i].issues.push('overlap');
      else if(cur.start-prev.end<s.minGap)rows[i].issues.push('gap');
    }
    const kinds={};let violations=0;
    for(const row of rows)for(const code of row.issues){kinds[code]=(kinds[code]||0)+1;violations++;}
    return {rows,summary:{total:rows.length,flagged:rows.filter(r=>r.issues.length).length,violations,clean:rows.filter(r=>!r.issues.length).length,peakSpeed:Math.max(0,...rows.filter(r=>Number.isFinite(r.speed)).map(r=>r.speed)),kinds}};
  }
  // Non-destructive Japanese line wrap suggestion. Never splits code points or speaker lines.
  function proposeWrap(text,params={}) {
    const s=settingsOf(params),raw=visibleText(text),old=raw.split('\n');
    if(old.length>1 && old.some(l=>/^\s*[-—–]/u.test(l))) return {ok:false,reason:'話者行を含むため自動改行しません'};
    if (/<[^>]+>/.test(text)) return {ok:false,reason:'装飾タグを含むため自動改行しません'};
    const flat=old.map(x=>x.trim()).join('');
    if(!flat) return {ok:false,reason:'文字がありません'};
    if(width(flat)<=s.maxWidth) return {ok:true,text:flat,unchanged:flat===text};
    if(s.maxLines<2||width(flat)>s.maxWidth*2) return {ok:false,reason:'指定行数に収まりません。テキストの短縮が必要です'};
    const chars=Array.from(flat);
    let best=null;
    for(let i=1;i<chars.length;i++) {
      const a=chars.slice(0,i).join(''),b=chars.slice(i).join(''),aw=width(a),bw=width(b);
      if(aw>s.maxWidth||bw>s.maxWidth||BAD_HEAD.test(b)||BAD_TAIL.test(a))continue;
      // Balance both lines, favor breaks after punctuation / before clauses.
      let cost=Math.abs(aw-bw)*2 + (/[、，,:：]/u.test(a.slice(-1))?-2:0) + (/[はがをにでと]/u.test(b.slice(0,1))?2:0);
      if(!best||cost<best.cost) best={text:a+'\n'+b,cost};
    }
    return best?{ok:true,text:best.text,unchanged:best.text===text}:{ok:false,reason:'禁則を守る改行位置がありません'};
  }
  function nextStart(cues,cue) {
    return Math.min(Infinity,...cues.filter(x=>x.id!==cue.id&&x.start>=cue.start).map(x=>x.start));
  }
  function extendCue(cues,id,params={}) {
    const s=settingsOf(params),draft=copy(cues),c=draft.find(x=>x.id===id);
    if(!c) return {cues:draft,changed:false,reason:'字幕が見つかりません'};
    const next=nextStart(draft,c),needed=Math.ceil(Math.max(s.minDuration,1000*score(c).count/s.maxSpeed));
    if(c.end-c.start>=needed) return {cues:draft,changed:false,reason:'すでに指定の読速と最短時間を満たしています'};
    const ceiling=Math.min(c.start+s.maxDuration,next-s.minGap);
    const end=Math.min(c.start+needed,ceiling);
    if(end<=c.end)return {cues:draft,changed:false,reason:'後続字幕との間隔を守るため延長できません'};
    c.end=Math.round(end);
    return {cues:draft,changed:true,complete:c.end-c.start>=needed,reason:c.end-c.start>=needed?'必要時間まで延長しました':'可能な範囲で延長しました（警告が残る場合があります）'};
  }
  function extendAll(cues,params={}) {
    let draft=copy(cues),changed=0,partial=0;
    for(const cue of [...draft].sort((a,b)=>a.start-b.start)) {
      const r=extendCue(draft,cue.id,params);
      if(r.changed) {draft=r.cues;changed++;if(!r.complete)partial++;}
    }
    return {cues:draft,changed,partial};
  }
  function wrapAll(cues,params={}) {
    const draft=copy(cues);let changed=0,skipped=0;
    for(const c of draft){const p=proposeWrap(c.text,params);if(p.ok && !p.unchanged){c.text=p.text;changed++;}else if(!p.ok)skipped++;}
    return {cues:draft,changed,skipped};
  }
  function shift(cues,ms) {
    if(!Number.isFinite(ms))throw Error('移動ミリ秒が不正です');
    if(cues.some(c=>c.start+ms<0||c.end+ms<0))throw Error('字幕の時刻が0秒より前になります');
    return cues.map(c=>({...c,start:Math.round(c.start+ms),end:Math.round(c.end+ms)}));
  }
  function serialize(cues,format='srt') {
    if(!['srt','vtt'].includes(format))throw Error('SRTまたはVTTを指定してください');
    const arr=[...cues].sort((a,b)=>a.start-b.start||a.id-b.id);
    for(const c of arr) if(!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end<=c.start)throw Error(`字幕 #${c.id} の時刻を修正してから保存してください`);
    const blocks=arr.map((c,i)=>{
      const timing=`${timecode(c.start,format)} --> ${timecode(c.end,format)}`;
      if(format==='srt')return `${i+1}\n${timing}\n${c.text}`;
      return `${c.sourceId && !/^\d+$/.test(c.sourceId)?c.sourceId+'\n':''}${timing}${c.settings?' '+c.settings:''}\n${c.text}`;
    });
    return (format==='vtt'?'WEBVTT\n\n':'')+blocks.join('\n\n')+'\n';
  }
  function reportCSV(analysis) {
    const esc=x=>{const raw=String(x??'');const safe=/^[\s]*[=+\-@]/.test(raw)?"'"+raw:raw;return '"'+safe.replace(/"/g,'""')+'"';};
    return '\uFEFF'+'番号,開始,終了,秒,全角相当,全角相当毎秒,最大行幅,指摘,字幕\r\n'+analysis.rows.map((r,i)=>[i+1,timecode(r.cue.start),timecode(r.cue.end),(r.duration/1000).toFixed(3),r.count,r.speed,r.maxLine,r.issues.map(x=>RULES[x]).join(' / '),r.cue.text].map(esc).join(',')).join('\r\n');
  }
  const DEMO=`1\n00:00:00,500 --> 00:00:02,700\n朝の駅前で、小さな実験が始まりました。\n\n2\n00:00:02,740 --> 00:00:03,700\n一人ひとりの声を聞きます。\n\n3\n00:00:03,600 --> 00:00:06,500\nその結果は、私たちが想像していたものとは違いました。\n\n4\n00:00:07,000 --> 00:00:09,500\n「続けたい」と思う人が\n、予想より多かったのです。\n\n5\n00:00:10,000 --> 00:00:13,500\n次の一歩を、ここから考えましょう。`;
  return {DEFAULTS,PRESETS,RULES,DEMO,parseTime,timecode,parse,visibleText,charWidth,width,score,settingsOf,analyze,proposeWrap,extendCue,extendAll,wrapAll,shift,serialize,reportCSV,copy};
});
