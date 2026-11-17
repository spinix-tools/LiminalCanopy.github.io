/* KIRIKURI browser UI: everything stays in this browser. */
(function(){'use strict';
const E=window.KiriEngine, storageKey='kirikuri:v1';
const $=id=>document.getElementById(id);
let project=E.demoProject(), result=null, dirty=false;
const escape=s=>String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>'¥'+Number(n).toLocaleString('ja-JP');
const mm=n=>Number(n).toLocaleString('ja-JP')+' mm';
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
function field(kind,index,key,val,type='text'){return `<input data-kind="${kind}" data-index="${index}" data-key="${key}" aria-label="${kind} ${index+1} ${key}" type="${type}" ${type==='number'?'step="1" min="0"':''} value="${escape(val)}">`;}
function renderEditor(){
 ['title','kerf','trim','keepMin'].forEach(k=>{$(k).value=project[k]??'';});
 const pRows=project.parts.map((r,i)=>`<div class="edit-row row-part">${field('parts',i,'name',r.name)}${field('parts',i,'length',r.length,'number')}${field('parts',i,'qty',r.qty,'number')}<button type="button" class="icon-btn" data-del="parts" data-index="${i}" aria-label="部品${i+1}を削除" title="削除">×</button></div>`);
 const oRows=project.offcuts.map((r,i)=>`<div class="edit-row row-offcut">${field('offcuts',i,'name',r.name)}${field('offcuts',i,'length',r.length,'number')}${field('offcuts',i,'qty',r.qty,'number')}<button type="button" class="icon-btn" data-del="offcuts" data-index="${i}" aria-label="端材${i+1}を削除" title="削除">×</button></div>`);
 const bRows=project.purchases.map((r,i)=>`<div class="edit-row row-buy">${field('purchases',i,'name',r.name)}${field('purchases',i,'length',r.length,'number')}${field('purchases',i,'price',r.price,'number')}<button type="button" class="icon-btn" data-del="purchases" data-index="${i}" aria-label="購入材${i+1}を削除" title="削除">×</button></div>`);
 $('parts-rows').innerHTML=pRows.join('');$('offcuts-rows').innerHTML=oRows.join('');$('purchases-rows').innerHTML=bRows.join('');
 $('project-heading').textContent=project.title||'切断を、無駄なく・見える形に。';
}
function markDirty(){dirty=true; $('verify-pill').textContent='入力を変更しました'; $('verify-pill').className='pill gold'; notice('入力が変更されました。「切断計画を計算」で表示を更新してください。');}
function readFile(file,callback){
 if(!file)return;
 if(file.size>1024*1024){notice('ファイルは1MB以内で選択してください。',true);return;}
 const reader=new FileReader();reader.onerror=()=>notice('ファイルが読み込めませんでした。',true);
 reader.onload=()=>{try{callback(String(reader.result));}catch(e){notice(e.message||'読み込みに失敗しました',true);}};
 reader.readAsText(file,'utf-8');
}
function download(name,text,type){
 const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function run(){
 try{result=E.calculate(project);project={...project,...result.project,parts:result.project.parts.map(x=>({name:x.name,length:x.length,qty:x.qty})),offcuts:result.project.offcuts.map(x=>({name:x.name,length:x.length,qty:x.qty})),purchases:result.project.purchases.map(x=>({name:x.name,length:x.length,price:x.price}))};dirty=false;renderEditor();renderResults();notice('計算が完了しました。'+result.best.partCount+'部品の割付を検証済みです。');}
 catch(err){result=null;dirty=true;renderResults();notice(err.message||'計算できませんでした。',true);}
}
function renderResults(){
 if(!result){$('stats').innerHTML='<div class="stat"><div class="lbl">購入見積</div><div class="value">—</div></div><div class="stat"><div class="lbl">使用端材</div><div class="value">—</div></div><div class="stat"><div class="lbl">使用母材</div><div class="value">—</div></div><div class="stat highlight"><div class="lbl">購入差額</div><div class="value">—</div></div>';
 $('compare-body').className='empty';$('compare-body').textContent='入力内容を修正して再計算してください。';$('bars').className='empty';$('bars').textContent='表示できる計画がありません';$('verify-pill').textContent='未計算';$('carry-preview').textContent='計算後に残材を確認できます。';return;}
 const {best,baseline,savings}=result, carry=E.carryForward(result);
 const stats=[['購入見積',yen(best.purchaseCost),'現在の計画'],['手持ち端材を使用',best.usedOffcuts+' 本','購入せずに活用'],['使用母材',best.bins.length+' 本','購入 '+best.boughtCount+'本'],['購入費の差額',savings===null?'比較不可':yen(savings),baseline?'端材なしとの差':'購入材が未登録']];
 $('stats').innerHTML=stats.map((s,i)=>`<div class="stat ${i===3?'highlight':''}"><div class="lbl">${s[0]}</div><div class="value">${s[1]}</div><div class="sub">${s[2]}</div></div>`).join('');
 $('compare-body').className='comparison';
 $('compare-body').innerHTML=`<div class="comp"><h4>端材を使える計画</h4><strong>${yen(best.purchaseCost)}</strong><span>購入材 ${best.boughtCount}本、廃棄相当 ${mm(best.scrap)}</span></div><div class="comp"><h4>購入材だけで切る場合</h4><strong>${baseline?yen(baseline.purchaseCost):'比較不可'}</strong><span>${baseline?'購入材 '+baseline.boughtCount+'本、廃棄相当 '+mm(baseline.scrap):'購入材の候補が必要です'}</span></div>`;
 const check=E.verifyPlan(result.project,best);
 $('verify-pill').textContent=check.ok?'✓ 寸法・数量・金額 照合済':'× 検証エラー';$('verify-pill').className='pill'+(check.ok?'':' gold');
 $('bars').className='';
 $('bars').innerHTML=best.bins.map(bin=>renderBar(bin,result.project)).join('')||'<div class="empty">部品がありません</div>';
 $('carry-preview').textContent=`再利用候補 ${carry.reduce((s,x)=>s+x.qty,0)} 本（${mm(carry.reduce((s,x)=>s+x.qty*x.length,0))}）。切粉・端落とし・短い残りは再利用対象に含めません。`;
}
function renderBar(bin,p){
 let segments=[],notes=[],used=2*p.trim,offset=p.trim;
 const ratio=n=>Math.max(0,100*n/bin.length)+'%';
 segments.push(`<div class="trim-graphic" style="width:${ratio(p.trim)}" title="前端落とし ${p.trim}mm"></div>`);
 bin.parts.forEach((x,i)=>{
  const end=offset+x.length;
  segments.push(`<div class="segment" style="width:${ratio(x.length)}" title="${escape(x.name)} ${x.length}mm"><span class="piece-name">${escape(x.name)}</span><small>${x.length} mm</small></div>`);
  segments.push(`<div class="kerf-graphic" style="width:${ratio(p.kerf)}" title="刃幅 ${p.kerf}mm"></div>`);
  notes.push(`<span class="part-tag">${i+1}. ${escape(x.name)} ${mm(x.length)} ／ 切断位置 ${mm(end)}</span>`);
  used+=x.length+p.kerf;offset=end+p.kerf;
 });
 segments.push(`<div class="leftover ${bin.retained>0?'kept':''}" style="width:${ratio(bin.remaining)}" title="${bin.retained>0?'再利用できる残材':'残り'} ${bin.remaining}mm">${bin.remaining>=120?bin.remaining+'mm':''}</div>`);
 segments.push(`<div class="trim-graphic" style="width:${ratio(p.trim)}" title="後端落とし ${p.trim}mm"></div>`);
 // End trim is a reserved zone at the far end. The illustrated leftover zone has the true usable length.
 return `<article class="bar-card"><div class="bar-title"><strong>#${bin.index} ${bin.kind==='offcut'?'♻ 手持ち':'🛒 購入'} · ${escape(bin.sourceName)} <span class="muted">${mm(bin.length)}</span></strong><span class="right">${bin.kind==='buy'?yen(bin.price)+' ｜ ':''}<span class="${bin.retained>0?'good-label':'warn-label'}">${bin.retained>0?'再利用可能':'再利用対象外'} ${mm(bin.remaining)}</span></span></div><div class="bar-graphic" role="img" aria-label="${escape(bin.sourceName)} の切断図：${escape(bin.parts.map(x=>x.name+' '+x.length+'mm').join('、'))}、余り${bin.remaining}mm">${segments.join('')}</div><div class="bar-details">${notes.join('')}</div></article>`;
}
function requireCurrent(){if(!result||dirty){notice('先に「切断計画を計算」を実行してください。',true);return false;}return true;}
function exportJson(){try{const clean=E.validateProject(project);download('kirikuri-project.json',JSON.stringify(clean,null,2)+'\n','application/json');notice('設定JSONを出力しました。');}catch(err){notice(err.message,true);}}
function carryToNext(){if(!requireCurrent())return; if(!window.confirm('切断作業が完了した前提で、残り材を次案件に引き継ぎます。現在の部品リストを空の1行にします。よろしいですか？'))return;
 const carry=E.carryForward(result); if(carry.length>80||carry.reduce((s,x)=>s+x.qty,0)>160){notice('残材が上限を超えます。CSVで保存し、必要な材料を選んでください。',true);return;}
 project={title:'次の案件',kerf:project.kerf,trim:project.trim,keepMin:project.keepMin,parts:[{name:'新しい部品',length:300,qty:1}],offcuts:carry,purchases:project.purchases.map(s=>({...s}))};result=null;dirty=true;renderEditor();renderResults();notice('残り材を端材欄に引き継ぎました。部品長・数量を編集してください。');window.scrollTo({top:0,behavior:'smooth'});
}
function bind(){
 document.addEventListener('input',e=>{
  const t=e.target;if(t.id==='title'||['kerf','trim','keepMin'].includes(t.id)) {project[t.id]=t.value; if(t.id==='title')$('project-heading').textContent=t.value||'切断を、無駄なく・見える形に。';markDirty();return;}
  if(t.dataset.kind&&t.dataset.key){project[t.dataset.kind][Number(t.dataset.index)][t.dataset.key]=t.value;markDirty();}
 });
 document.addEventListener('click',e=>{
  const btn=e.target.closest('button');if(!btn)return;
  if(btn.dataset.add){const kind=btn.dataset.add;
   if(project[kind].length>=(kind==='parts'?80:kind==='offcuts'?80:30)){notice('種類数の上限です。',true);return;}
   project[kind].push(kind==='parts'?{name:'新しい部品',length:300,qty:1}:kind==='offcuts'?{name:'新しい端材',length:1000,qty:1}:{name:'購入候補',length:1820,price:500});renderEditor();markDirty();return;}
  if(btn.dataset.del){const kind=btn.dataset.del;project[kind].splice(Number(btn.dataset.index),1);renderEditor();markDirty();return;}
 });
 $('calculate').addEventListener('click',run);
 $('demo').addEventListener('click',()=>{if(!window.confirm('入力中の内容をサンプルに戻しますか？'))return;project=E.demoProject();renderEditor();run();});
 $('save').addEventListener('click',()=>{try{const clean=E.validateProject(project);localStorage.setItem(storageKey,JSON.stringify(clean));notice('この端末のブラウザに設定を保存しました。外部送信はありません。');}catch(err){notice('保存できません: '+err.message,true);}});
 $('export-json').addEventListener('click',exportJson);
 $('import-json').addEventListener('click',()=>{$('json-file').value='';$('json-file').click();});
 $('json-file').addEventListener('change',e=>readFile(e.target.files[0],txt=>{const obj=E.validateProject(JSON.parse(txt));project=obj;renderEditor();run();notice('JSON設定を読み込み、計算しました。');}));
 $('csv-parts').addEventListener('click',()=>{$('csv-file').value='';$('csv-file').click();});
 $('csv-file').addEventListener('change',e=>readFile(e.target.files[0],txt=>{project.parts=E.importPartsCsv(txt);renderEditor();run();notice('CSVから部品を取り込みました。');}));
 $('export-cut').addEventListener('click',()=>{if(requireCurrent()){download('kirikuri-cut-list.csv',E.exportCutCsv(result),'text/csv;charset=utf-8');notice('切断順・位置のCSVを出力しました。');}});
 function exportOffcuts(){if(requireCurrent()){download('kirikuri-offcuts-next.csv',E.exportOffcutsCsv(result),'text/csv;charset=utf-8');notice('次の案件に使う端材CSVを出力しました。');}}
 $('export-offcuts').addEventListener('click',exportOffcuts);$('export-offcuts-main').addEventListener('click',exportOffcuts);
 $('apply-offcuts').addEventListener('click',carryToNext);
 $('print').addEventListener('click',()=>{if(requireCurrent())window.print();});
}
try{const saved=localStorage.getItem(storageKey);if(saved)project=E.validateProject(JSON.parse(saved));}catch(e){/* use bundled demo if unavailable */}
renderEditor();bind();run();
})();