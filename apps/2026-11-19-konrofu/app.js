(function(){
"use strict";
const e=KonroEngine;
const $=id=>document.getElementById(id);
const key="konrofu-plan-v1";
const names={hand:"手作業",burner:"コンロ",oven:"オーブン",rice:"炊飯器",none:"置く"};
const colors=["c0","c1","c2","c3","c4","c5"];
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
let state;
try{const raw=localStorage.getItem(key);state=raw?JSON.parse(raw):e.copy(e.defaults);e.validate(state);}catch(_){state=e.copy(e.defaults);}
function persist(){try{localStorage.setItem(key,JSON.stringify(state));}catch(_){}}
function selectOptions(values,current){return values.map(x=>'<option value="'+esc(x[0])+'"'+(x[0]===current?' selected':'')+'>'+esc(x[1])+'</option>').join("");}
function nextId(){return "step-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);}
function setup(){
 $("serve").value=state.serve;
 for(const k of ["hand","burner","oven","rice"])$(k).value=state.capacity[k];
}
function renderSteps(){
 const list=$("step-list");list.innerHTML="";
 const dishes=[...new Set(state.steps.map(s=>s.dish))];
 state.steps.forEach((s,index)=>{
  const prev=[["","なし"]].concat(state.steps.filter(t=>t.id!==s.id&&t.dish===s.dish).map(t=>[t.id,t.name]));
  const row=document.createElement("div");row.className="step-row";
  row.innerHTML='<label>料理 <input data-field="dish" data-i="'+index+'" maxlength="50" value="'+esc(s.dish)+'" list="dish-names"></label>'+
   '<label>工程 <input data-field="name" data-i="'+index+'" maxlength="60" value="'+esc(s.name)+'"></label>'+
   '<label>分 <input type="number" min="1" max="180" data-field="mins" data-i="'+index+'" value="'+s.mins+'"></label>'+
   '<label>設備 <select data-field="resource" data-i="'+index+'">'+selectOptions(Object.keys(names).map(k=>[k,names[k]]),s.resource)+'</select></label>'+
   '<label>前工程 <select data-field="after" data-i="'+index+'">'+selectOptions(prev,s.after)+'</select></label>'+
   '<label class="attention"><input type="checkbox" data-field="attention" data-i="'+index+'" '+(s.attention?"checked":"")+'>手も使う</label>'+
   '<button type="button" class="remove" data-remove="'+index+'" title="工程を削除" aria-label="'+esc(s.name)+' を削除">×</button>';
  list.appendChild(row);
 });
 let dl=$("dish-names");if(!dl){dl=document.createElement("datalist");dl.id="dish-names";list.appendChild(dl);}
 dl.innerHTML=dishes.map(d=>'<option value="'+esc(d)+'"></option>').join("");
 const after=$("add-after");after.innerHTML=selectOptions([["","なし（最初の工程）"]].concat(state.steps.map(t=>[t.id,t.dish+" / "+t.name])),"");
}
function renderTimeline(s){
 const dishes=[...new Set(state.steps.map(x=>x.dish))],min=Math.min(s.from-2,-20),range=0-min;
 const ticks=[];const startTick=Math.ceil(min/15)*15;
 for(let t=startTick;t<=0;t+=15){ticks.push('<span style="left:'+((t-min)/range*100).toFixed(2)+'%">'+esc(e.clock(state.serve,t))+'</span>');}
 $("axis").innerHTML=ticks.join("");
 $("timeline").innerHTML=s.items.map(item=>{
   const left=((item.start-min)/range*100).toFixed(3),width=(item.mins/range*100).toFixed(3);
   const css=colors[dishes.indexOf(item.dish)%colors.length];
   return '<div class="plan-row"><div class="plan-name" title="'+esc(item.dish+' / '+item.name)+'"><strong>'+esc(item.dish)+'</strong><br>'+esc(item.name)+'</div>'+
    '<div class="plan-track"><div class="plan-bar '+css+'" title="'+esc(item.name+" "+e.clock(state.serve,item.start)+"〜"+e.clock(state.serve,item.end))+'" style="left:'+left+'%;width:'+width+'%">'+(item.mins/range>.07?item.mins+"分":"")+'</div></div></div>';
 }).join("");
 $("plan-summary").textContent=s.items.length+"工程 · "+s.dishes.length+"品";
 $("metric-start").textContent=e.clock(state.serve,s.from);
 $("metric-span").innerHTML=s.span+'<i> 分</i>';
 $("metric-hold").innerHTML=s.maxHold+'<i> 分</i>';
 $("hold-notes").innerHTML=s.dishes.filter(d=>d.hold>15).map(d=>'<p>♨ '+esc(d.name)+' は提供まで約'+d.hold+'分待ちます。盛り付け順や保温方法を確認してください。</p>').join("");
 const legend=document.querySelector(".legend");
 legend.innerHTML=dishes.map((d,i)=>'<span><i class="swatch '+colors[i%colors.length]+'"></i>'+esc(d)+'</span>').join("");
}
function renderCompare(){
 const c=e.comparison(state),base=c.base;
 const arr=[
  ["いまの台所",base,0],
  ["コンロ ＋1口",c.withBurner,1],
  ["調理者 ＋1人",c.withHelper,1]
 ];
 $("compare").innerHTML=arr.map(([title,s,alt])=>{
  let saved=base.span-s.span,txt=alt?(saved>0?"開始を"+saved+"分遅くできる":"調理時間は変わらず"):"現在の設備構成";
  return '<div class="compare-item '+(!alt?'featured':'')+'"><h4>'+title+'</h4><strong>'+s.span+'<small> 分</small></strong><p>'+txt+'</p></div>';
 }).join("");
}
function render(){
 renderSteps();
 const el=$("error");
 try{
  const s=e.solve(state);
  el.hidden=true;
  renderTimeline(s);renderCompare();persist();
 }catch(err){
  el.hidden=false;el.textContent="⚠ "+err.message+"（工程を編集して解決してください）";
  for(const id of ["timeline","axis","compare","hold-notes"])$(id).innerHTML="";
  for(const id of ["metric-start","metric-span","metric-hold"])$(id).textContent="—";
  $("plan-summary").textContent="計算できません";
  persist();
 }
}
function updateField(i,field,value){
 if(!state.steps[i])return;
 const old=state.steps[i],prevDish=old.dish;
 if(field==="mins")value=Number(value);
 if(field==="attention")value=Boolean(value);
 old[field]=value;
 if(field==="dish"&&prevDish!==value){for(const t of state.steps)if(t.after===old.id&&t.dish!==value)t.after="";if(old.after&&state.steps.find(t=>t.id===old.after)?.dish!==value)old.after="";}
 render();
}
$("step-list").addEventListener("change",ev=>{
 const el=ev.target;if(!el.dataset.field)return;
 const i=Number(el.dataset.i),f=el.dataset.field;
 updateField(i,f,f==="attention"?el.checked:el.value);
});
$("step-list").addEventListener("click",ev=>{
 const el=ev.target.closest("[data-remove]");if(!el)return;
 const idx=Number(el.dataset.remove),gone=state.steps[idx];if(!gone)return;
 if(state.steps.length===1){alert("工程を最低1つ残してください");return;}
 state.steps.splice(idx,1);for(const s of state.steps)if(s.after===gone.id)s.after=gone.after||"";
 render();
});
for(const id of ["serve","hand","burner","oven","rice"]){
 $(id).addEventListener("change",()=>{
  state.serve=$("serve").value;
  for(const k of ["hand","burner","oven","rice"])state.capacity[k]=Number($(k).value);
  render();
 });
}
$("add-form").addEventListener("submit",ev=>{
 ev.preventDefault();
 const dish=$("add-dish").value.trim(),name=$("add-name").value.trim(),mins=Number($("add-mins").value);
 if(!dish||!name||!Number.isInteger(mins)||mins<1||mins>180)return;
 let after=$("add-after").value;
 if(after&&state.steps.find(t=>t.id===after)?.dish!==dish)after="";
 if(state.steps.length>=45){alert("工程は最大45件です");return;}
 state.steps.push({id:nextId(),dish,name,mins,resource:$("add-resource").value,attention:$("add-attention").checked,after});
 $("add-name").value="";$("add-after").value="";render();
});
function download(name,content,type){
 const blob=new Blob([content],{type:type||"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$("export-json").onclick=()=>download("konrofu-plan.json",JSON.stringify(state,null,2),"application/json");
$("export-csv").onclick=()=>{try{download("konrofu-timeline.csv",e.csv(state),"text/csv;charset=utf-8");}catch(err){alert(err.message);}};
$("import-json").onchange=async ev=>{
 const file=ev.target.files?.[0];if(!file)return;
 try{
  if(file.size>100000){throw Error("ファイルが大きすぎます");}
  const next=JSON.parse(await file.text());e.validate(next);state=next;setup();render();
 }catch(err){alert("読み込めません: "+err.message);}finally{ev.target.value="";}
};
$("reset").onclick=()=>{if(confirm("編集した工程をデモに戻しますか？")){state=e.copy(e.defaults);setup();render();}};
$("print").onclick=()=>window.print();
setup();render();
})();