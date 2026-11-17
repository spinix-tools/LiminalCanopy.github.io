/* かりぐみ / KARI GUMI UI | Vanilla JS; entirely local */
(()=>{
"use strict";
const core=window.KariCore;
if(!core)throw new Error("engine.js が読み込めませんでした");
const KEY="karigumi-project-v1";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateText=s=>String(s).replace("T"," ");
let project=load(),filter="",manifestId=null,toastTimer=null;
function load(){
 try{const x=localStorage.getItem(KEY);if(x){const p=JSON.parse(x);if(core.check(p).length===0)return p;}}catch(e){console.warn("Local data unavailable:",e)}
 return core.sample();
}
function save(){
 try{localStorage.setItem(KEY,JSON.stringify(project));$("storageState")?.remove();}catch(e){
  if(!$("storageState")){const p=document.createElement("p");p.id="storageState";p.className="tiny";p.style.color="#a74635";p.textContent="端末内保存を利用できません。JSON出力でバックアップしてください。";$("resetData").before(p);}
 }
}
function toast(s){
 $("toast").textContent=s;$("toast").classList.add("show");
 if(toastTimer)clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("toast").classList.remove("show"),3200);
}
function download(name,content,type){
 const blob=new Blob([content],{type}),url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),250);
}
function uid(prefix){return prefix+"-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);}
function nextTimes(){
 const d=new Date();d.setDate(d.getDate()+1);d.setHours(10,0,0,0);
 return [core.fmt(d.getTime()),core.fmt(d.getTime()+90*60000)];
}
function resetItemForm(){
 $("itemId").value="";$("itemName").value="";$("itemStock").value=1;$("itemBuffer").value=15;
 $("itemSave").textContent="備品を追加";
}
function renderItems(){
 $("itemList").innerHTML=project.items.map(item=>`<div class="item">
  <div><div class="item-name">${esc(item.name)}</div><div class="item-meta">在庫 ${item.stock} 個 ・ 前後 各 ${item.buffer} 分</div></div>
  <div class="item-buttons"><button class="btn small" type="button" data-action="editItem" data-id="${esc(item.id)}">編集</button><button class="btn small danger" type="button" data-action="removeItem" data-id="${esc(item.id)}">削除</button></div>
 </div>`).join("");
}
function renderNeeds(initial=null){
 const old={};
 document.querySelectorAll("[data-need]").forEach(n=>old[n.dataset.need]=Number(n.value)||0);
 const selected=initial||old;
 $("needsList").innerHTML=project.items.map(item=>`<label class="need">
 <span>${esc(item.name)}<small>在庫 ${item.stock} / 前後 各${item.buffer}分</small></span>
 <input type="number" inputmode="numeric" min="0" max="999" value="${Number(selected[item.id])||0}" data-need="${esc(item.id)}" aria-label="${esc(item.name)}の必要数">
 </label>`).join("");
}
function resetPlanForm(){
 $("planId").value="";$("planTitle").value="";
 const [s,e]=nextTimes();$("planStart").value=s;$("planEnd").value=e;
 $("planSave").textContent="予約を確定";
 renderNeeds({});
 $("probeResult").className="probe";$("probeResult").textContent="入力後に空き状況を確認できます。";
 $("suggestions").innerHTML="";
}
function readPlan(){
 const needs={};
 for(const el of document.querySelectorAll("[data-need]")){
  if(el.value.trim()==="")continue;
  const n=Number(el.value);
  if(!Number.isInteger(n)||n<0||n>999)throw Error("備品の必要数は0～999の整数で入力してください。");
  if(n>0)needs[el.dataset.need]=n;
 }
 return {id:$("planId").value||uid("e"),title:$("planTitle").value.trim(),start:$("planStart").value,end:$("planEnd").value,needs};
}
function probe(){
 let candidate;
 try{candidate=readPlan();}catch(e){showProbe(false,e.message,[]);return null;}
 const status=core.availability(project,candidate,$("planId").value||null);
 if(status.errors.length){showProbe(false,status.errors.slice(0,2).join(" / "),[]);return null;}
 if(status.ok){
  showProbe(true,"✓ この時間帯にすべての備品を確保できます。",[]);
 }else{
  const detail=status.shortages.map(x=>`${x.name} +${x.shortage}個`).join("、");
  const slots=core.suggestions(project,candidate,$("planId").value||null,4,7);
  showProbe(false,"必要数が在庫を超えます：" +detail,slots);
 }
 return {candidate,status};
}
function showProbe(ok,message,slots){
 const e=$("probeResult");e.className="probe "+(ok?"good":"bad");e.textContent=message;
 $("suggestions").innerHTML=slots.length?
 `<div style="font-size:12px;font-weight:800;margin:13px 0 5px">空いている代替時間（先着順）</div>`+
 slots.map((s,i)=>`<div class="suggestion"><time>${esc(dateText(s.start))} ～ ${esc(s.end.slice(11))}</time><button class="btn small" type="button" data-action="useSlot" data-idx="${i}">採用</button></div>`).join("")+
 `<p class="tiny muted" style="margin:6px 0">元の開始時刻から30分刻み、7日先まで探索</p>`:"";
 $("suggestions").dataset.slots=JSON.stringify(slots);
}
function submitPlan(e){
 e.preventDefault();
 const result=probe();if(!result||!result.status.ok){toast("備品と日時を確認してください。");return;}
 const id=$("planId").value;
 if(id){const index=project.events.findIndex(x=>x.id===id);if(index===-1){toast("編集元が見つかりません");return;}project.events[index]=result.candidate;}
 else if(project.events.length>=120){toast("予定は120件までです。");return;}
 else project.events.push(result.candidate);
 save();renderAll();resetPlanForm();toast("予定を保存しました。");
}
function submitItem(e){
 e.preventDefault();
 const id=$("itemId").value;
 const item={id:id||uid("i"),name:$("itemName").value.trim(),stock:Number($("itemStock").value),buffer:Number($("itemBuffer").value)};
 if(!item.name||item.name.length>60||!Number.isInteger(item.stock)||item.stock<1||item.stock>999||!Number.isInteger(item.buffer)||item.buffer<0||item.buffer>480){toast("備品名・在庫数・準備時間を確認してください。");return;}
 if(id){const idx=project.items.findIndex(x=>x.id===id);if(idx<0)return;project.items[idx]=item;}
 else if(project.items.length>=32){toast("備品は32種類までです。");return;}
 else project.items.push(item);
 save();renderAll();resetItemForm();toast(id?"備品を更新しました。":"備品を追加しました。");
}
function editItem(id){
 const x=project.items.find(v=>v.id===id);if(!x)return;
 $("itemId").value=x.id;$("itemName").value=x.name;$("itemStock").value=x.stock;$("itemBuffer").value=x.buffer;
 $("itemSave").textContent="備品を更新";$("itemForm").scrollIntoView({behavior:"smooth",block:"center"});
}
function deleteItem(id){
 if(project.events.some(e=>e.needs[id]>0)){toast("この備品を使用する予定があります。予定の必要数を先に削除してください。");return;}
 if(project.items.length<=1){toast("備品を1種類以上残してください。");return;}
 const x=project.items.find(v=>v.id===id);if(!x||!confirm("備品「"+x.name+"」を削除しますか？"))return;
 project.items=project.items.filter(v=>v.id!==id);
 save();renderAll();resetItemForm();toast("備品を削除しました。");
}
function editEvent(id){
 const e=project.events.find(x=>x.id===id);if(!e)return;
 $("planId").value=e.id;$("planTitle").value=e.title;$("planStart").value=e.start;$("planEnd").value=e.end;
 renderNeeds(e.needs);$("planSave").textContent="変更を保存";probe();$("planForm").scrollIntoView({behavior:"smooth",block:"start"});
}
function removeEvent(id){
 const x=project.events.find(v=>v.id===id);
 if(!x||!confirm("予定「"+x.title+"」を削除しますか？"))return;
 project.events=project.events.filter(v=>v.id!==id);
 if(manifestId===id)manifestId=null;
 save();renderAll();resetPlanForm();toast("予定を削除しました。");
}
function renderStats(){
 const stats=core.trace(project);
 $("statItems").textContent=project.items.length;
 $("statEvents").textContent=project.events.length;
 const n=stats.filter(x=>x.shortage>0).length;
 $("statShortage").textContent=n;$("shortageMetric").classList.toggle("alert",n>0);
 const health=$("health");
 if(n===0){health.className="health";health.innerHTML="<div><b>✓ すべての予定で在庫以内です</b><p>準備・片付け時間も含めた最大同時使用数を確認済み</p></div><span style='font-size:22px'>✓</span>";}
 else{
  health.className="health warn";health.innerHTML=`<div><b>⚠ ${n}種類で在庫が不足しています</b><p>JSON読込・在庫変更などで生じた超過を検出。予定を調整してください。</p></div>`;
 }
 $("pressure").innerHTML=stats.map(x=>{
  const ratio=x.stock?Math.round(x.peak/x.stock*100):0;
  const isOver=x.shortage>0;
  const detail=isOver?`<strong style="color:#a74635">不足 ${x.shortage} 個</strong>`:"在庫内";
  const times=isOver&&x.segments.length?`<small>不足時間例：${esc(dateText(core.fmt(x.segments[0].start)))} ～ ${esc(dateText(core.fmt(x.segments[0].end)))}</small>`:"";
  return `<div class="capacity"><div class="capacity-head"><b>${esc(x.name)}</b><span>最大 ${x.peak} / 在庫 ${x.stock}　${detail}</span></div><div class="bar"><div class="${isOver?"over":""}" style="width:${Math.min(100,ratio)}%"></div></div>${times}</div>`;
 }).join("");
}
function renderEvents(){
 const events=[...project.events].sort((a,b)=>core.ms(a.start)-core.ms(b.start));
 const subset=events.filter(e=>!filter || (core.ms(e.start)<core.ms(filter+"T00:00")+86400000&&core.ms(e.end)>core.ms(filter+"T00:00")));
 $("eventList").innerHTML=!subset.length?`<div class="empty"><span style="font-size:24px">◷</span><strong>表示できる予定がありません</strong>${filter?"表示日を変えるか「すべて」を選択してください。":"左のフォームから予定を追加してください。"}</div>`:
 subset.map(e=>{
   const chips=Object.entries(e.needs).map(([id,q])=>{const item=project.items.find(i=>i.id===id);return `<span class="chip">${esc(item?.name||id)} ×${q}</span>`;}).join("");
   return `<article class="event"><div></div><div><div class="event-head"><div><h4>${esc(e.title)}</h4><div class="time">${esc(dateText(e.start))} – ${esc(dateText(e.end))}</div></div><div class="event-actions"><button type="button" class="btn small" data-action="manifest" data-id="${esc(e.id)}">持ち出し表</button><button type="button" class="btn small" data-action="editEvent" data-id="${esc(e.id)}">編集</button><button type="button" class="btn danger small" data-action="deleteEvent" data-id="${esc(e.id)}">削除</button></div></div><div class="chips">${chips}</div></div></article>`;
 }).join("");
}
function renderManifest(){
 const e=project.events.find(x=>x.id===manifestId);
 if(!e){$("manifest").innerHTML='<div class="empty">予定を選択すると持ち出し表が表示されます。</div>';return;}
 const rows=Object.entries(e.needs).map(([id,q])=>{
  const item=project.items.find(x=>x.id===id);
  return `<tr><td><input type="checkbox" aria-label="${esc(item?.name||id)}の持ち出し確認" style="width:17px"></td><td>${esc(item?.name||id)}</td><td>${q}</td></tr>`;
 }).join("");
 $("manifest").innerHTML=`<div class="manifest"><h4>${esc(e.title)}</h4><div class="tiny muted">${esc(dateText(e.start))} ～ ${esc(dateText(e.end))}</div><table><thead><tr><th style="width:24px">✓</th><th>備品</th><th>必要数</th></tr></thead><tbody>${rows}</tbody></table><p class="tiny muted">受け渡し時は現物の数・状態・返却先を別途確認してください。</p><button id="printManifest" class="btn primary small" type="button">この持ち出し表を印刷</button></div>`;
}
function renderAll(){renderItems();renderNeeds();renderStats();renderEvents();renderManifest();}
$("itemForm").addEventListener("submit",submitItem);
$("planForm").addEventListener("submit",submitPlan);
$("itemCancel").addEventListener("click",resetItemForm);
$("planCancel").addEventListener("click",resetPlanForm);
$("checkBtn").addEventListener("click",probe);
$("dayFilter").addEventListener("change",e=>{filter=e.target.value;renderEvents();});
$("showAll").addEventListener("click",()=>{filter="";$("dayFilter").value="";renderEvents();});
document.addEventListener("click",e=>{
 const target=e.target.closest("[data-action]");
 if(!target)return;
 const action=target.dataset.action,id=target.dataset.id;
 if(action==="editItem")editItem(id);
 if(action==="removeItem")deleteItem(id);
 if(action==="editEvent")editEvent(id);
 if(action==="deleteEvent")removeEvent(id);
 if(action==="manifest"){manifestId=id;renderManifest();$("manifestPanel").scrollIntoView({behavior:"smooth",block:"center"});}
 if(action==="useSlot"){
  const slots=JSON.parse($("suggestions").dataset.slots||"[]"),slot=slots[Number(target.dataset.idx)];
  if(slot){$("planStart").value=slot.start;$("planEnd").value=slot.end;probe();}
 }
 if(target.id==="printManifest")window.print();
});
$("exportJson").addEventListener("click",()=>{download("karigumi-project.json",JSON.stringify(project,null,2),"application/json;charset=utf-8");toast("JSONを出力しました。");});
$("exportCsv").addEventListener("click",()=>{download("karigumi-schedule.csv",core.csv(project),"text/csv;charset=utf-8");toast("CSVを出力しました。");});
$("importBtn").addEventListener("click",()=>$("importFile").click());
$("importFile").addEventListener("change",async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>1000000)throw Error("1MB以下のJSONを選択してください。");
  const p=JSON.parse(await file.text());
  const errors=core.check(p);if(errors.length)throw Error(errors[0]);
  if(!confirm("現在のデータを読み込んだJSONで置き換えますか？"))return;
  project={version:1,items:p.items,events:p.events};
  manifestId=null;filter="";$("dayFilter").value="";
  save();renderAll();resetPlanForm();resetItemForm();toast("JSONを読み込みました。");
 }catch(err){toast("読込失敗：" +err.message);}
 finally{e.target.value="";}
});
$("resetData").addEventListener("click",()=>{
 if(!confirm("現在の内容をサンプルに戻しますか？必要なら先にJSONを保存してください。"))return;
 project=core.sample();manifestId=null;filter="";$("dayFilter").value="";
 save();renderAll();resetPlanForm();resetItemForm();toast("サンプルに戻しました。");
});
renderAll();resetPlanForm();resetItemForm();
})();