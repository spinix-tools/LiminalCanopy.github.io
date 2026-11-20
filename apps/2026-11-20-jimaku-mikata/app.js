/* 字幕みかた UI. No requests, analytics or external dependencies. */
(()=>{"use strict";
const E=window.Jimaku,$=id=>document.getElementById(id);
const clone=x=>JSON.parse(JSON.stringify(x));
const DEFAULT=()=>({cues:E.parse(E.SAMPLE),baseline:E.parse(E.SAMPLE),selected:0,undo:[],comparison:null,rules:{...E.PRESETS.film}});
let s=DEFAULT();
function status(msg,error=false){$("status").textContent=msg;$("status").className="status"+(error?" error":"");}
function cfg(){return {cps:+$("cps").value,maxLine:+$("maxLine").value,maxLines:2,minDur:+$("minDur").value,gap:+$("gap").value};}
function setInputs(r){for(const key of ["cps","maxLine","minDur","gap"])$(key).value=r[key];}
function ensure(){const r=cfg();if(!Number.isFinite(r.cps)||r.cps<=0||!Number.isInteger(r.maxLine)||r.maxLine<2||r.maxLine>80||r.gap<0||r.minDur<0||r.cps>40)throw Error("検査条件を確認してください");return r;}
function save(){try{localStorage.setItem("jimaku-mikata-v1",JSON.stringify({cues:s.cues,baseline:s.baseline,rules:cfg(),selected:s.selected,comparison:s.comparison}));}catch(e){status("端末への自動保存が利用できません。JSON出力をご利用ください。",true);}}
function history(){s.undo.push({cues:clone(s.cues),comparison:clone(s.comparison)});if(s.undo.length>30)s.undo.shift();}
function toastError(e){status(e.message||String(e),true);}
function download(filename,text,type="text/plain;charset=utf-8"){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function report(cues=s.cues){return E.diagnostics(cues,ensure());}
function summary(){return report();}
function render(){
 let r;try{r=summary();}catch(e){toastError(e);return;}
 $("mCount").textContent=s.cues.length;
 $("mIssues").textContent=r.issueCount;
 $("mBad").textContent=r.items.filter(x=>x.warnings.length).length;
 $("mRate").textContent=(s.cues.length?Math.round(r.cleanCues/s.cues.length*100):100)+"%";
 $("cueTotal").textContent=`(${s.cues.length})`;
 $("undo").disabled=!s.undo.length;
 const filter=$("filter").value;const list=$("cueList");list.replaceChildren();
 for(let i=0;i<s.cues.length;i++){
  const c=s.cues[i],d=r.items[i],bad=d.warnings.length>0;
  if(filter==="bad"&&!bad||filter==="good"&&bad)continue;
  const b=document.createElement("button");b.type="button";b.className="cue"+(i===s.selected?" active":"");b.setAttribute("role","option");b.setAttribute("aria-selected",String(i===s.selected));b.dataset.index=i;
  const head=document.createElement("div");head.className="cue-head";
  const left=document.createElement("strong");left.textContent=`#${i+1}`;
  const right=document.createElement("span");right.className="time";right.textContent=`${E.stamp(Math.max(0,c.start))} — ${Number.isFinite(c.end)&&c.end>=0?E.stamp(c.end):"不正"}`;
  head.append(left,right);b.append(head);
  const p=document.createElement("p");p.textContent=c.text;b.append(p);
  const chips=document.createElement("div");chips.className="chips";
  for(const x of d.warnings.slice(0,3)){const tag=document.createElement("span");tag.className="chip";tag.textContent=x.label;chips.append(tag);}
  if(!bad){const t=document.createElement("span");t.className="chip ok";t.textContent="OK";chips.append(t);}
  if(c.locked){const t=document.createElement("span");t.className="chip lock";t.textContent="固定";chips.append(t);}
  b.append(chips);b.addEventListener("click",()=>{s.selected=i;render();});list.append(b);
 }
 if(!list.children.length){const p=document.createElement("p");p.className="hint";p.textContent="表示する字幕がありません";list.append(p);}
 if(s.selected>=s.cues.length)s.selected=Math.max(0,s.cues.length-1);
 const c=s.cues[s.selected],d=r.items[s.selected];
 for(const field of ["editStart","editEnd","editText","lock","apply"])$(field).disabled=!c;
 if(c){
  $("selectedNum").textContent=`#${s.selected+1} / ${s.cues.length}`;
  $("selectedBadge").textContent=d.warnings.length?`⚠ ${d.warnings.length}件の指摘`:"✓ 検査OK";
  $("editStart").value=E.stamp(Math.max(0,c.start));$("editEnd").value=Number.isFinite(c.end)&&c.end>=0?E.stamp(c.end):"";
  $("editText").value=c.text;$("lock").checked=!!c.locked;
  $("previewText").textContent=c.text;
  $("editHint").textContent=`${d.characters}文字 / ${Math.max(0,d.duration/1000).toFixed(2)}秒 / ${Number.isFinite(d.cps)?d.cps.toFixed(1):"∞"}字/秒`;
  $("detailFoot").textContent=d.warnings.length?d.warnings.map(x=>`⚠ ${x.label}`).join("　"):"この設定での検査指摘はありません。実際の映像・音声でも確認してください。";
 }else{
  $("selectedNum").textContent="字幕なし";$("selectedBadge").textContent="";$("previewText").textContent="";$("detailFoot").textContent="";
 }
 renderComparison();
 save();
}
function renderComparison(){
 const panel=$("comparison");panel.replaceChildren();
 if(!s.comparison){const div=document.createElement("div");div.className="empty";div.textContent="「修正案を作る」で変更前後を比較できます。本文は削除・言い換えしません。";panel.append(div);return;}
 const before=E.diagnostics(s.comparison.before,ensure()),after=report(), a=[["修正前",before,true],["現在",after,false]];
 for(const [label,val,isBefore] of a){const div=document.createElement("div");div.className="compare-tile"+(isBefore?" before":"");
 const labelEl=document.createElement("div");labelEl.className="mini";labelEl.textContent=label;
 const num=document.createElement("strong");num.textContent=val.issueCount+"件";
 const foot=document.createElement("p");foot.textContent=`問題のない字幕 ${val.cleanCues}/${val.cueCount}件`;
 div.append(labelEl,num,foot);panel.append(div);}
}
function resetState(cues){
 s.cues=clone(cues);s.baseline=clone(cues);s.selected=0;s.undo=[];s.comparison=null;
 render();status(`${cues.length}件の字幕を読み込みました。`);
}
function validateProject(x){
 if(!x||!Array.isArray(x.cues)||x.cues.length>10000)throw Error("プロジェクト形式が不正です");
 for(const c of x.cues){if(!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||typeof c.text!=="string"||c.text.length>10000)throw Error("プロジェクト内に不正な字幕があります");}
 return x.cues.map((c,i)=>({id:i+1,start:c.start,end:c.end,text:c.text,locked:!!c.locked,reviewed:!!c.reviewed}));
}
function openProject(x){
 const cues=validateProject(x);s.cues=cues;s.baseline=Array.isArray(x.baseline)?validateProject({cues:x.baseline}):clone(cues);
 s.selected=Number.isInteger(x.selected)?Math.min(Math.max(x.selected,0),Math.max(0,cues.length-1)):0;s.undo=[];s.comparison=null;
 if(x.rules){setInputs({...E.PRESETS.film,...x.rules});}
 render();status("プロジェクトを復元しました");
}
$("file").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>5*1024*1024)throw Error("ファイルは5MB以下にしてください");resetState(E.parse(await f.text()));}catch(err){toastError(err);}finally{e.target.value="";}});
$("load").addEventListener("click",()=>{try{resetState(E.parse($("raw").value));}catch(e){toastError(e);}});
$("sample").addEventListener("click",()=>{resetState(E.parse(E.SAMPLE));$("raw").value="";});
$("preset").addEventListener("change",()=>{setInputs(E.PRESETS[$("preset").value]);render();status(`「${E.PRESETS[$("preset").value].label}」を適用しました`);});
for(const id of ["cps","maxLine","minDur","gap"])$(id).addEventListener("change",()=>{try{ensure();render();status("検査条件を更新しました。");}catch(e){toastError(e);}});
$("filter").addEventListener("change",render);
$("aspect").addEventListener("change",()=>{$("preview").className="preview "+$("aspect").value;});
$("apply").addEventListener("click",()=>{try{
 const start=E.ms($("editStart").value),end=E.ms($("editEnd").value),txt=$("editText").value;
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start)throw Error("開始・終了時刻を確認してください（終了＞開始）");
 if(!txt.trim())throw Error("字幕本文が空です");
 if(txt.length>10000)throw Error("本文が長すぎます");
 const old=s.cues[s.selected];if(!old)return;
 history();s.cues[s.selected]={...old,start,end,text:txt,locked:$("lock").checked};render();status(`#${s.selected+1} を更新しました`);
 }catch(e){toastError(e);}});
$("draft").addEventListener("click",()=>{try{
 const r=ensure();history();const before=clone(s.cues),draft=E.autoDraft(s.cues,r);
 s.cues=draft.cues;s.comparison={before};render();
 const still=report().items.filter(x=>x.warnings.length).length;
 status(`${draft.changed}件を修正しました。未解決の字幕：${still}件（音声との同期は必ず人が確認）。`);
 }catch(e){toastError(e);}});
$("undo").addEventListener("click",()=>{const h=s.undo.pop();if(!h)return;s.cues=h.cues;s.comparison=h.comparison;render();status("直前の編集を取り消しました");});
$("revert").addEventListener("click",()=>{history();s.cues=clone(s.baseline);s.comparison=null;render();status("最後に読み込んだ字幕データに戻しました");});
$("exportSrt").addEventListener("click",()=>{try{download("jimaku-mikata.srt","\uFEFF"+E.encodeSrt(s.cues),"text/plain;charset=utf-8");status("SRTを書き出しました");}catch(e){toastError(e);}});
$("exportVtt").addEventListener("click",()=>{try{download("jimaku-mikata.vtt",E.encodeVtt(s.cues),"text/vtt;charset=utf-8");status("VTTを書き出しました");}catch(e){toastError(e);}});
$("exportCsv").addEventListener("click",()=>{try{download("jimaku-mikata-qc.csv",E.csvReport(s.cues,report()),"text/csv;charset=utf-8");status("CSVを書き出しました");}catch(e){toastError(e);}});
$("saveProject").addEventListener("click",()=>{download("jimaku-mikata.json",JSON.stringify({version:1,cues:s.cues,baseline:s.baseline,rules:cfg(),selected:s.selected},null,2),"application/json");status("JSONを書き出しました");});
$("importProject").addEventListener("click",()=>$("projectFile").click());
$("projectFile").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>5*1024*1024)throw Error("5MB以下のJSONにしてください");openProject(JSON.parse(await f.text()));}catch(err){toastError(err);}finally{e.target.value="";}});
try{const raw=localStorage.getItem("jimaku-mikata-v1");if(raw){openProject(JSON.parse(raw));status("端末に保存されていた作業を復元しました");}else{setInputs(s.rules);render();status("サンプル字幕を読み込みました。編集して試せます。");}}
catch(e){s=DEFAULT();setInputs(s.rules);render();status("保存情報は復元できませんでした。サンプルから開始します。",true);}
})();
