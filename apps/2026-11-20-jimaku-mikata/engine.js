/* 字幕みかた — local-only subtitle QC engine. Pure functions for browser and Node. */
(function(global,factory){const api=factory(); if(typeof module!=="undefined"&&module.exports)module.exports=api; global.Jimaku=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const SAMPLE=`1
00:00:01,000 --> 00:00:03,000
今週は地域の図書館で開催される
小さな朗読会をご紹介します。

2
00:00:03,050 --> 00:00:04,100
参加した方々がどんな本を持ち寄り、どんな話を聞かせてくれたのかをお伝えします。

3
00:00:04,900 --> 00:00:08,300
会場では、世代をこえて
物語を楽しむ声が広がりました。

4
00:00:08,310 --> 00:00:09,300
最後に、次回のお知らせです。

5
00:00:10,000 --> 00:00:14,000
来月の土曜日も、同じ場所で開かれます。`;
const PRESETS={
 film:{label:"映画字幕の目安",cps:4,maxLine:16,maxLines:2,minDur:1000,gap:100},
 research:{label:"比較用・6文字/秒",cps:6,maxLine:20,maxLines:2,minDur:850,gap:100},
 social:{label:"短尺動画（仮設定）",cps:8,maxLine:14,maxLines:2,minDur:650,gap:80},
};
function ms(t){
 if(typeof t==="number")return Number.isFinite(t)?t:NaN;
 const m=String(t||"").trim().match(/^(?:(\d+):)?([0-5]?\d):([0-5]\d)[,.](\d{1,3})$/);
 if(!m)return NaN;
 return ((+(m[1]||0)*3600)+(+m[2]*60)+(+m[3]))*1000+Number(m[4].padEnd(3,"0"));
}
function stamp(n,sep=","){
 if(!Number.isFinite(n)||n<0)throw Error("時刻は0以上で入力してください");
 const x=Math.round(n);const pad=(a,d=2)=>String(a).padStart(d,"0");
 return `${pad(Math.floor(x/3600000))}:${pad(Math.floor(x%3600000/60000))}:${pad(Math.floor(x%60000/1000))}${sep}${pad(x%1000,3)}`;
}
function parse(src){
 const input=String(src||"").replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n").trim();
 if(!input)return [];
 const vtt=/^WEBVTT(?:[ \t].*)?(?:\n|$)/.test(input);
 const lines=input.split("\n");
 const cues=[];let i=vtt?1:0;
 while(i<lines.length){
  const line=lines[i].trim();
  if(!line){i++;continue;}
  if(vtt && /^(NOTE|STYLE|REGION)(?:\s|$)/.test(line)){while(i<lines.length&&lines[i].trim())i++;continue;}
  let id="";let timeLine=line;
  if(!timeLine.includes("-->")){id=line; i++;timeLine=(lines[i]||"").trim();}
  const tm=timeLine.match(/^(\d{1,3}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,3}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})(?:\s+.*)?$/);
  if(!tm){throw Error(`${i+1}行目: 字幕の時刻が読めません（SRT/VTT形式を確認）`);}
  const start=ms(tm[1]),end=ms(tm[2]);i++;
  const text=[];
  while(i<lines.length&&lines[i].trim()!==""){text.push(lines[i]);i++;}
  if(!text.length)throw Error(`${i+1}行目: 字幕本文がありません`);
  cues.push({id:cues.length+1,start,end,text:text.join("\n"),locked:false,reviewed:false});
 }
 return cues;
}
function graphemes(s){
 const str=String(s||"");
 if(typeof Intl!=="undefined"&&Intl.Segmenter)return [...new Intl.Segmenter("ja",{granularity:"grapheme"}).segment(str)].map(x=>x.segment);
 return Array.from(str);
}
function visible(s){return String(s||"").replace(/<[^>]*>/g,"").replace(/&(?:amp|lt|gt|nbsp);/g," ").replace(/\s/g,"");}
function count(s){return graphemes(visible(s)).length;}
function linesOf(s){return String(s||"").replace(/\r/g,"").split("\n");}
function rules(input){const r={...PRESETS.film,...(input||{})};for(const x of ["cps","maxLine","maxLines","minDur","gap"])if(!Number.isFinite(+r[x])||+r[x]<0)throw Error("検査条件が不正です"); if(r.cps<=0||r.maxLine<1||r.maxLines<1)return null;return r;}
function diagnostics(cues,r0){
 const r=rules(r0);if(!r)throw Error("検査条件が不正です");
 const result=[];let sum=0;
 for(let i=0;i<cues.length;i++){
  const c=cues[i],p=cues[i-1],dur=c.end-c.start,num=count(c.text),cps=dur>0?num/(dur/1000):Infinity;
  const len=linesOf(c.text).map(count);const warnings=[];
  if(!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||dur<=0)warnings.push({code:"time",label:"時刻不正"});
  else{
   if(cps>r.cps+1e-8)warnings.push({code:"cps",label:"表示速度"});
   if(dur<r.minDur)warnings.push({code:"short",label:"短すぎる表示"});
  }
  if(len.length>r.maxLines)warnings.push({code:"lines",label:"行数超過"});
  if(len.some(n=>n>r.maxLine))warnings.push({code:"width",label:"行幅超過"});
  if(p&&c.start<p.end)warnings.push({code:"overlap",label:"前字幕と重複"});
  else if(p&&c.start-p.end<r.gap)warnings.push({code:"gap",label:"前字幕との間隔"});
  sum+=warnings.length;
  result.push({id:c.id,duration:dur,characters:num,cps,lines:len,warnings});
 }
 return {items:result,issueCount:sum,cueCount:cues.length,cleanCues:result.filter(x=>!x.warnings.length).length};
}
function breakLines(text,maxLine,maxLines=2){
 const str=String(text||"").replace(/\s*\n\s*/g,"").trim();
 const arr=graphemes(str),N=arr.length;
 if(N<=maxLine)return str;
 const K=Math.max(1,Math.floor(maxLines)); const dp=Array.from({length:K+1},()=>new Map());dp[0].set(0,{cost:0,path:[]});
 const weakStart=/^[、。！？）」』】〕、・ぁぃぅぇぉゃゅょっァィゥェォャュョッ]/;
 const weakEnd=/[（「『【〔]$/;
 const particleStart=/^[はがをにへとでやも、。！？]/;
 for(let k=1;k<=K;k++)for(const [start,prior] of dp[k-1]){
  for(let end=start+1;end<=Math.min(N,start+maxLine);end++){
   const segment=arr.slice(start,end).join(""),next=arr[end]||"";
   let penalty=Math.pow(maxLine-(end-start),2)*.09 + (end<N?2:0);
   if(weakStart.test(next))penalty+=50;
   if(particleStart.test(next))penalty+=9;
   if(weakEnd.test(segment))penalty+=40;
   if(/[、。！？]$/.test(segment))penalty-=4;
   if(end===N)penalty-=2;
   const cost=prior.cost+penalty;
   if(!dp[k].has(end)||cost<dp[k].get(end).cost)dp[k].set(end,{cost,path:[...prior.path,segment]});
  }
 }
 let best=null;
 for(let k=1;k<=K;k++){const v=dp[k].get(N);if(v&&(!best||v.cost<best.cost))best=v;}
 if(!best){const chunks=[];for(let j=0;j<N;j+=maxLine)chunks.push(arr.slice(j,j+maxLine).join(""));return chunks.join("\n");}
 return best.path.join("\n");
}
function autoDraft(cues,r0){
 const r=rules(r0);
 const updated=cues.map(c=>({...c}));const notes=[];
 for(let i=0;i<updated.length;i++){
  const c=updated[i];
  if(c.locked){notes.push({id:c.id,status:"locked",text:"固定中"});continue;}
  const b=breakLines(c.text,r.maxLine,r.maxLines);
  if(b!==c.text)c.text=b;
  const next=updated[i+1];
  let possible=next?next.start-r.gap:Infinity;
  const required=Math.max(r.minDur,Math.ceil(count(c.text)/r.cps*1000));
  const wish=Math.max(c.end,c.start+required);
  if(Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start && (next ? possible>=c.end : true)){
   c.end=Math.max(c.end,Math.min(wish,possible));
  }
  const changed=c.end!==cues[i].end||c.text!==cues[i].text;
  const d=diagnostics([c],r).items[0];
  notes.push({id:c.id,status:changed?"changed":"unchanged",text:c.end<c.start+required?"発話との同期を保ったままでは延長不足":"",remaining:d.warnings.map(x=>x.code)});
 }
 return {cues:updated,notes,changed:notes.filter(x=>x.status==="changed").length};
}
function encodeSrt(cues){
 return cues.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}`).join("\n\n")+"\n";
}
function encodeVtt(cues){
 return "WEBVTT\n\n"+cues.map(c=>`${stamp(c.start,".")} --> ${stamp(c.end,".")}\n${c.text}`).join("\n\n")+"\n";
}
function csvReport(cues,report){
 const cell=x=>`"${String(x??"").replace(/"/g,'""')}"`;
 const out=[["番号","開始","終了","秒","文字数","字/秒","検査","固定","本文"].map(cell).join(",")];
 cues.forEach((c,i)=>out.push([i+1,stamp(c.start),stamp(c.end),(report.items[i].duration/1000).toFixed(2),report.items[i].characters,report.items[i].cps.toFixed(1),report.items[i].warnings.map(x=>x.label).join("|"),c.locked?"固定":"",c.text].map(cell).join(",")));
 return "\uFEFF"+out.join("\r\n");
}
return {SAMPLE,PRESETS,ms,stamp,parse,graphemes,count,visible,linesOf,diagnostics,breakLines,autoDraft,encodeSrt,encodeVtt,csvReport,rules};
});
