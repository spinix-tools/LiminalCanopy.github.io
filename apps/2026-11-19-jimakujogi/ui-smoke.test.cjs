/* Run: node ui-smoke.test.cjs. Minimal DOM event smoke tests (not a browser rendering test). */
function runUiSmoke(html, check){
  const eng=html.match(/<script id="engine">([\s\S]*?)<\/script>/);
  const app=html.match(/<script id="app">([\s\S]*?)<\/script>/);
  check("engine and app sections",!!eng&&!!app);
  if(!eng||!app)return;
  const win={};new Function("window",eng[1])(win);
  const handlers={},elements={},saved=[];
  const initial={cps:"7",maxChars:"16",maxLines:"2",minDur:".9",gap:".12",topSafe:"10",bottomSafe:"20",rightSafe:"18",ratio:"portrait",preset:"short",shift:".5"};
  function get(id){
    if(!elements[id])elements[id]={id,value:initial[id]||"",textContent:"",innerHTML:"",style:{},classList:{toggle(){}},addEventListener(ev,fn){handlers[id+":"+ev]=fn;},querySelector(){return {focus(){},select(){}};}};
    return elements[id];
  }
  const doc={getElementById:get,createElement(tag){
    if(tag==="canvas")return {getContext:()=>({measureText:s=>({width:Array.from(s).length*14})})};
    return {style:{},click(){saved.push(this.download);},remove(){}};
  },body:{append(){}}};
  const nop=()=>{};
  new Function("window","document","performance","requestAnimationFrame","cancelAnimationFrame","setTimeout","clearTimeout","Blob","URL",app[1])(
    win,doc,{now:()=>0},nop,nop,nop,nop,function(parts){this.parts=parts;},{createObjectURL:()=>"blob:local",revokeObjectURL:nop}
  );
  check("initial sample has six cues",get("cueCount").textContent===6);
  check("initial QA flags errors",get("issueCount").textContent>0);
  handlers["add:click"]();check("add cue",get("cueCount").textContent===7);
  handlers["undo:click"]();check("undo add",get("cueCount").textContent===6);
  handlers["clear:click"]();check("clear cues",get("cueCount").textContent===0);
  handlers["undo:click"]();check("undo clear",get("cueCount").textContent===6);
  get("preset").value="learning";handlers["preset:change"].call(get("preset"));check("learning preset",get("cps").value===4);
  handlers["extend:click"]();check("safe extension retains cues",get("cueCount").textContent===6);
  get("shift").value="1";handlers["shiftBtn:click"]();check("global shift",get("cueList").innerHTML.includes("00:00:01.000"));
  get("ratio").value="landscape";handlers["ratio:change"].call(get("ratio"));check("landscape safe area",get("rightSafe").value===4);
  handlers["srt:click"]();handlers["vtt:click"]();handlers["csv:click"]();
  check("three export actions",saved.length===3&&saved[0].endsWith(".srt")&&saved[1].endsWith(".vtt")&&saved[2].endsWith(".csv"));
}
if(typeof require==="function"&&typeof module!=="undefined"&&require.main===module){
 const fs=require("node:fs"),path=require("node:path");
 const html=fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
 let n=0,f=0;runUiSmoke(html,(name,ok)=>{n++;if(!ok){f++;console.error("FAIL",name);}});
 console.log(n+" checks, "+f+" failures (DOM mock)");if(f)process.exitCode=1;
}
