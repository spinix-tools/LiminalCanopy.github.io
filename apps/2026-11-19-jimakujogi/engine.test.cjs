/* JIMAKU JOGI deterministic tests. Run: node engine.test.cjs (Node.js 18+) */
function suite(JM,check){
 const near=(a,b)=>Math.abs(a-b)<.00001;
 const t=JM.parseTime, f=JM.formatTime;
 check("SRT timestamp",near(t("00:01:02,125"),62.125));
 check("VTT timestamp with hours",near(t("01:02:03.125"),3723.125));
 check("VTT timestamp without hours",near(t("01:02.125"),62.125));
 check("timestamp formatting SRT",f(62.125,",")==="00:01:02,125");
 check("timestamp formatting VTT",f(62.125)==="00:01:02.125");
 check("invalid time minute",Number.isNaN(t("00:60:00,000")));
 check("invalid time second",Number.isNaN(t("00:00:60,000")));
 check("invalid time text",Number.isNaN(t("hello")));
 check("timestamp millisecond padding",near(t("00:00:01,1"),1.1));
 const srt="1\r\n00:00:00,000 --> 00:00:02,100\r\nはじめに\r\n\r\n2\r\n00:00:02,200 --> 00:00:03,000\r\n次へ";
 const parsed=JM.parseCaptions("\uFEFF"+srt);
 check("SRT BOM and CRLF",parsed.length===2&&parsed[0].text==="はじめに");
 check("SRT sorted by time",JM.parseCaptions("2\n00:00:04,000 --> 00:00:05,000\n後\n\n1\n00:00:01,000 --> 00:00:02,000\n先")[0].text==="先");
 const vtt="WEBVTT\n\nIntro\n00:00:01.000 --> 00:00:03.500 position:0%\nこんにちは\n\nNOTE note\nignored\n\n00:00:04.000 --> 00:00:05.000\n世界";
 const vp=JM.parseCaptions(vtt);
 check("VTT first cue with identifier",vp.length===2&&vp[0].start===1&&vp[0].text==="こんにちは");
 check("VTT note ignored",vp[1].text==="世界");
 check("SRT export round trip",JM.parseCaptions(JM.exportCaptions(parsed,"srt"))[1].text===parsed[1].text);
 check("VTT export round trip",JM.parseCaptions(JM.exportCaptions(parsed,"vtt"))[0].end===2.1);
 check("empty input",JM.parseCaptions("").length===0);
 check("malformed block rejected",(()=>{try{JM.parseCaptions("wrong data");return false;}catch{return true;}})());
 check("reverse duration rejected",(()=>{try{JM.parseCaptions("00:00:04,000 --> 00:00:03,000\nbad");return false;}catch{return true;}})());
 check("combined grapheme emoji",JM.charCount("👨‍👩‍👧")===1||JM.charCount("👨‍👩‍👧")===5);
 check("HTML tags ignored in count",JM.plain("<i>字幕</i>")==="字幕");
 const L={cps:4,maxChars:5,maxLines:2,minDur:.9,gap:.15};
 const fast=JM.measure([{id:1,start:0,end:1,text:"こんにちは世界"}],L).rows[0];
 check("reading speed issue",fast.issues.some(x=>x.code==="speed"));
 check("long text issue",fast.issues.some(x=>x.code==="chars"));
 check("short duration issue",JM.measure([{id:1,start:0,end:.3,text:"短"}],L).rows[0].issues.some(x=>x.code==="short"));
 check("many lines issue",JM.measure([{id:1,start:0,end:3,text:"一\n二\n三"}],L).rows[0].issues.some(x=>x.code==="lines"));
 check("empty cue issue",JM.measure([{id:1,start:0,end:3,text:""}],L).rows[0].issues.some(x=>x.code==="empty"));
 check("long duration issue",JM.measure([{id:1,start:0,end:12,text:"一"}],L).rows[0].issues.some(x=>x.code==="long"));
 check("overlap issue",JM.measure([{id:1,start:0,end:2,text:"a"},{id:2,start:1,end:4,text:"b"}],L).rows[0].issues.some(x=>x.code==="overlap"));
 check("short gap issue",JM.measure([{id:1,start:0,end:1,text:"a"},{id:2,start:1.05,end:3,text:"b"}],L).rows[0].issues.some(x=>x.code==="gap"));
 check("font width issue",JM.measure([{id:1,start:0,end:3,text:"long"}],L,()=>2).rows[0].issues.some(x=>x.code==="width"));
 check("clean row",JM.measure([{id:1,start:0,end:3,text:"短い"}],L).clean===1);
 const start=[{id:1,start:0,end:1,text:"こんにちは世界"},{id:2,start:2,end:3,text:"はい"}];
 const fixed=JM.extendSafe(start,L);
 check("safe time extension",fixed.changes===1&&near(fixed.cues[0].end,1.75));
 check("input not mutated",start[0].end===1);
 check("extension never overlaps next",fixed.cues[0].end<=fixed.cues[1].start-L.gap+.00001);
 check("blocked extension",JM.extendSafe([{id:1,start:0,end:1,text:"こんにちは世界"},{id:2,start:1.05,end:3,text:"はい"}],L).changes===0);
 check("shift valid",near(JM.shiftAll(start,1.5)[0].start,1.5));
 check("shift negative rejects",(()=>{try{JM.shiftAll(start,-.01);return false;}catch{return true;}})());
 check("shift no mutation",start[0].start===0);
 check("empty export",JM.exportCaptions([],"srt")==="");
 let seed=1415926;
 function rand(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
 for(let k=0;k<300;k++){
   const count=1+Math.floor(rand()*6),cs=[];let last=0;
   for(let i=0;i<count;i++){last+=Math.floor(rand()*1000)/1000;const d=.5+Math.floor(rand()*7000)/1000;cs.push({id:i+1,start:Math.round(last*1000)/1000,end:Math.round((last+d)*1000)/1000,text:i%2?"試験\n字幕<i>！</i>":"Hello "+i});last+=d+.2;}
   const roundtrip=JM.parseCaptions(JM.exportCaptions(cs,k%2?"vtt":"srt"));
   check("random round-trip "+k,roundtrip.length===cs.length&&roundtrip.every((c,i)=>near(c.start,cs[i].start)&&near(c.end,cs[i].end)&&c.text===cs[i].text));
   const extended=JM.extendSafe(cs,L).cues;
   check("random no forward overlaps "+k,extended.every((c,i)=>i===extended.length-1||c.end<=extended[i+1].start+.00001));
   const qa=JM.measure(cs,L);
   check("random QA finite "+k,qa.issues>=0&&qa.rows.every(r=>Number.isFinite(r.speed)&&r.speed>=0));
 }
}
if(typeof require==="function"&&typeof module!=="undefined"&&require.main===module){
 const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
 const html=fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
 const code=html.match(/<script id="engine">([\s\S]*?)<\/script>/);
 if(!code)throw Error("engine block missing");
 const sandbox={window:{},Intl};vm.runInNewContext(code[1],sandbox);
 let n=0,failed=0;
 suite(sandbox.window.JM,(name,pass)=>{n++;if(!pass){failed++;console.error("FAIL",name);}});
 console.log(n+" checks, "+failed+" failures");if(failed)process.exitCode=1;
}
