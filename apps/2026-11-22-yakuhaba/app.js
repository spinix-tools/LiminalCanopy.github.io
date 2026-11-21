/* 訳幅ものさし: browser controller. No analytics / remote APIs. */
(()=>{'use strict';
const E=window.Yakuhaba, LANGS=E.LANGS, $=id=>document.getElementById(id);
const html=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
let project,selected=0,enabled=['ja','en','zh','ko','de','fr'],diagnostics=[];
let storageEnabled=true;
try{const old=localStorage.getItem('yakuhaba-project-v1');project=old?E.loadProject(old):E.sampleProject();const saved=JSON.parse(localStorage.getItem('yakuhaba-langs-v1')||'null');if(Array.isArray(saved)&&saved.some(x=>LANGS.includes(x)))enabled=LANGS.filter(x=>saved.includes(x));}catch(e){project=E.sampleProject();storageEnabled=false;}
function measureFactory(item){ctx.font=`${item.fontSize}px system-ui, sans-serif`;const cache=new Map();return s=>{if(cache.has(s))return cache.get(s);const w=ctx.measureText(s).width;cache.set(s,w);return w;};}
function analyze(){diagnostics=E.report(project.items,enabled,measureFactory);return diagnostics;}
function itemResults(i){const r=project.items[i];return diagnostics.filter(d=>d.id===r.id);}
function severity(i){const x=itemResults(i);if(x.some(e=>e.status==='overflow'))return 'overflow';if(x.some(e=>e.status==='missing'))return 'missing';if(x.some(e=>e.status==='tight'))return 'tight';return 'ok';}
function tag(status){return {overflow:['はみ出し','st-overflow'],missing:['未入力','st-missing'],tight:['ぎりぎり','st-tight'],ok:['収まる','st-ok']}[status]||['—','st-missing'];}
function persist(){try{localStorage.setItem('yakuhaba-project-v1',JSON.stringify(project));localStorage.setItem('yakuhaba-langs-v1',JSON.stringify(enabled));storageEnabled=true;}catch(e){storageEnabled=false;}}
let toastTimer;
function notice(msg){$('toast').textContent=msg;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').textContent='',5000);}
function renderToggles(){ $('languageToggles').innerHTML=LANGS.map(l=>`<label class="${enabled.includes(l)?'active':''}"><input type="checkbox" value="${l}" ${enabled.includes(l)?'checked':''} aria-label="${html(E.NAMES[l])}">${l.toUpperCase()}</label>`).join(''); }
function renderMetrics(){const over=diagnostics.filter(d=>d.status==='overflow').length,miss=diagnostics.filter(d=>d.status==='missing').length,tight=diagnostics.filter(d=>d.status==='tight').length;
$('countAll').textContent=diagnostics.length;$('countOver').textContent=over;$('countMissing').textContent=miss;$('countFit').textContent=diagnostics.length-over-miss-tight;
$('itemCount').textContent=project.items.length;}
function renderList(){const filter=$('filterStatus').value;
const rows=project.items.map((r,i)=>({r,i,sev:severity(i)})).filter(x=>filter==='all'||(filter==='ok'?x.sev==='ok':x.sev===filter));
$('elementList').innerHTML=rows.length?rows.map(({r,i,sev})=>{const t=tag(sev);return `<button type="button" data-index="${i}" class="element ${i===selected?'selected':''}" aria-pressed="${i===selected}"><span class="element-num">${String(i+1).padStart(2,'0')}</span><span><span class="element-name">${html(r.label)}</span><span class="element-dim">${r.width} × ${r.height} px · ${r.fontSize}px · ${r.maxLines}行以内</span></span><span class="element-status ${t[1]}">${t[0]}</span></button>`;}).join(''):'<div class="preview-empty">条件に合う要素はありません</div>';}
function renderInspector(){const row=project.items[selected];if(!row){$('inspector').innerHTML='<div class="preview-empty">「要素を追加」から始めてください</div>';return;}
const basic=(key,label,step='1')=>`<label class="field">${label}<input data-field="${key}" type="number" step="${step}" value="${html(row[key])}" aria-label="${label}"></label>`;
$('inspector').innerHTML=`<div class="inspector-body"><label class="field">要素名<input data-field="label" type="text" maxlength="100" value="${html(row.label)}"></label><label class="field">管理キー<input data-field="id" type="text" maxlength="60" value="${html(row.id)}"></label><div class="dim-grid">${basic('width','幅 W（px）')}${basic('height','高さ H（px）')}${basic('fontSize','文字サイズ（px）')}${basic('padding','内側余白（px）')}${basic('maxLines','最大行数')}${basic('lineHeight','行間（倍率）','0.05')}</div><p class="mini-help">文字幅はこの端末のシステムフォントで測定。行折り返しは文字単位の近似です。</p><div class="translations-label"><span>翻訳テキスト</span><span>${LANGS.length} 言語</span></div><div class="translations">${LANGS.map(l=>`<label class="field">${html(E.NAMES[l])}<textarea data-lang="${l}" spellcheck="false" aria-label="${html(E.NAMES[l])} 翻訳">${html(row.texts[l])}</textarea></label>`).join('')}</div><div class="inspector-bottom"><button type="button" class="delete" id="deleteItem">× この要素を削除</button><span class="guidance" id="resizeAdvice"></span></div><div class="resize-controls"><button type="button" class="subtle" id="fitHeight">必要な高さに合わせる</button><button type="button" class="subtle" id="fitWidth">必要な幅に合わせる</button></div></div>`;
renderAdvice();}
function renderAdvice(){const advice=$('resizeAdvice');if(!advice)return;const entries=itemResults(selected),problem=entries.filter(r=>r.status==='overflow');
const largestH=Math.max(0,...problem.map(v=>v.requiredHeight)),largestW=Math.max(0,...problem.map(v=>v.requiredWidth||0));
const element=project.items[selected]; advice.textContent=problem.length?`推奨高 ≥ ${largestH}px / 推奨幅 ≥ ${largestW||'算定不可'}px`:'選択言語での幅・高さを判定済み';
const bh=$('fitHeight'),bw=$('fitWidth');if(bh)bh.disabled=!problem.length||largestH>600||largestH<=element.height;if(bw)bw.disabled=!largestW||largestW>1200||largestW<=element.width;
}
function renderPreviews(){const item=project.items[selected];if(!item){$('previews').innerHTML='';return;}
$('previews').innerHTML=LANGS.map(lang=>{const inspect=E.audit(item,lang,measureFactory(item)),t=tag(inspect.status),text=item.texts[lang];
// Preview uses exactly the CSS font family and explicit pixel dimensions measured by the engine.
return `<article class="preview-card ${inspect.status==='overflow'?'over':''}"><div class="preview-head"><span class="preview-lang">${lang.toUpperCase()} · ${html(E.NAMES[lang])}</span><span class="element-status ${t[1]}">${t[0]}</span></div><div class="preview-frame"><div lang="${lang}" class="preview-box ${inspect.status==='overflow'?'overflow-box':''}" style="width:${item.width}px;height:${item.height}px;font-size:${item.fontSize}px;line-height:${item.lineHeight};padding:${item.padding}px;">${html(text||'（未入力）')}</div></div><div class="preview-foot"><span>必要 ${inspect.count}行 / 許容 ${inspect.allowedLines}行</span><strong>${inspect.status==='overflow'?`高さ ${inspect.requiredHeight}px〜`:inspect.status==='missing'?'未入力':inspect.status==='tight'?'余裕に注意':'収まる見込み'}</strong></div></article>`;}).join('');}
function refresh(redrawEditor=false){analyze();renderMetrics();renderList();if(redrawEditor)renderInspector();else renderAdvice();renderPreviews();persist();}
function uniqueId(base){let candidate=(base||'element').slice(0,45),i=2;while(project.items.some(r=>r.id===candidate))candidate=(base||'element').slice(0,40)+'-'+(i++);return candidate;}
function addItem(){if(project.items.length>=100)return notice('要素は最大100件です');const r=E.normalize({id:uniqueId('new-item'),label:'新しい案内',width:210,height:65,ja:'',en:''},project.items.length);
project.items.push(r);selected=project.items.length-1;$('filterStatus').value='all';refresh(true);notice('新しい表示要素を追加しました');}
function dl(text,type,name){const b=new Blob([text],{type}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
$('addItem').onclick=addItem;
$('elementList').addEventListener('click',e=>{const b=e.target.closest('button[data-index]');if(!b)return;selected=Number(b.dataset.index);renderList();renderInspector();renderPreviews();});
$('filterStatus').onchange=renderList;
$('inspector').addEventListener('input',e=>{const el=e.target;const row=project.items[selected];if(!row)return;
if(el.dataset.lang){row.texts[el.dataset.lang]=el.value;refresh(false);}else if(el.dataset.field){const field=el.dataset.field;
if(field==='label')row.label=el.value.slice(0,100);else if(field==='id'){const v=el.value.slice(0,60);if(v&&project.items.every((x,i)=>i===selected||x.id!==v))row.id=v;}
else{const bounds={width:[40,1200],height:[20,600],fontSize:[9,64],padding:[0,120],maxLines:[1,12],lineHeight:[1,2.5]};const [min,max]=bounds[field];const n=Number(el.value);if(el.value.trim()&&Number.isFinite(n))row[field]=Math.min(max,Math.max(min,n));}
refresh(false);}});
$('inspector').addEventListener('change',e=>{const field=e.target.dataset.field;if(field && project.items[selected])e.target.value=project.items[selected][field];});
$('inspector').addEventListener('click',e=>{
if(e.target.id==='deleteItem') {if(project.items.length===1)return notice('最低1件は残してください');project.items.splice(selected,1);selected=Math.min(selected,project.items.length-1);refresh(true);notice('削除しました');}
if(e.target.id==='fitHeight'||e.target.id==='fitWidth'){
 const row=project.items[selected],entries=itemResults(selected).filter(x=>x.status==='overflow');
 if(e.target.id==='fitHeight'){const h=Math.max(...entries.map(x=>x.requiredHeight));if(h<=600)row.height=Math.max(row.height,h);}
 else{const w=Math.max(...entries.map(x=>x.requiredWidth||0));if(w>0&&w<=1200)row.width=Math.max(row.width,w);}
 refresh(true);notice('表示エリアの寸法を調整しました');}
});
$('duplicateItem').onclick=()=>{if(project.items.length>=100)return notice('要素は最大100件です');const source=project.items[selected],copy=E.normalize({...source,...source.texts,id:uniqueId(source.id+'-copy'),label:source.label+' コピー'});project.items.splice(selected+1,0,copy);selected++;refresh(true);notice('複製しました');};
$('languageToggles').addEventListener('change',e=>{if(e.target.type!=='checkbox')return;const wanted=LANGS.filter(l=>[...$('languageToggles').querySelectorAll('input:checked')].some(el=>el.value===l));if(!wanted.length){e.target.checked=true;notice('最低1言語を選択してください');return;}
enabled=wanted;renderToggles();refresh(false);});
$('projectTitle').oninput=e=>{project.title=e.target.value.slice(0,120);persist();};
$('saveJson').onclick=()=>dl(JSON.stringify({version:1,...project},null,2),'application/json;charset=utf-8','yakuhaba-project.json');
$('exportCsv').onclick=()=>dl(E.serializeCSV(project.items),'text/csv;charset=utf-8','yakuhaba-strings.csv');
$('exportIssues').onclick=()=>{analyze();dl(E.auditCSV(diagnostics),'text/csv;charset=utf-8','yakuhaba-qa.csv');notice(`${diagnostics.length}件の判定をCSVに書き出しました`);};
$('importBtn').onclick=()=>$('fileInput').click();
$('fileInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2000000)throw Error('ファイルが2MBを超えています');const text=await file.text();
const next=file.name.toLowerCase().endsWith('.csv')?{title:file.name.replace(/\.csv$/i,''),items:E.parseCSV(text)}:E.loadProject(text);
if(!next.items.length)throw Error('有効な表示要素がありません');if(next.items.length>100)throw Error('100件を超えています');
const used=new Set();next.items.forEach((r,i)=>{if(used.has(r.id)){r.id+=`-${i+1}`;}used.add(r.id);});
project=next;selected=0;$('projectTitle').value=project.title;$('filterStatus').value='all';refresh(true);notice(`${project.items.length}件を読み込みました`);
}catch(err){notice('読込失敗: '+err.message);}finally{e.target.value='';}});
$('resetDemo').onclick=()=>{if(!confirm('現在の編集内容をサンプルで上書きしますか？'))return;project=E.sampleProject();selected=0;enabled=[...LANGS];$('projectTitle').value=project.title;$('filterStatus').value='all';renderToggles();refresh(true);notice('サンプルを復元しました');};
$('printReport').onclick=()=>window.print();
$('projectTitle').value=project.title;renderToggles();refresh(true);
if(!storageEnabled)notice('この環境では端末保存が使えません。JSONで保存してください');
})();
