/* 分岐灯 interactive UI. All data remains inside the browser. */
(() => {
'use strict';
const E=window.BunkiEngine, KEY='bunki-akari-v1';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let project, report, run;
try {const saved=localStorage.getItem(KEY);project=saved?E.clean(JSON.parse(saved)):E.demo();}
catch {project=E.demo();}
const resetRun=()=>{run={next:project.start,trail:[],visited:[],status:'active',minutes:0};};
function notify(message,bad=false){const el=$('flash');el.textContent=message;el.className='flash'+(bad?' error':'');}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(project));}catch{notify('端末への自動保存が使えません。JSONで保存してください。',true);}}
function recompute(){report=E.audit(project);resetRun();persist();render();}
function destinations(selected){return `<option value="" ${!selected?'selected':''}>要設定</option><option value="END" ${selected==='END'?'selected':''}>✓ 完了</option>` + project.questions.map(q=>`<option value="${esc(q.id)}" ${selected===q.id?'selected':''}>${esc(q.id+' / '+q.title.slice(0,20))}</option>`).join('');}
function renderStats(){const s=report.stats;const data=[['質問数',s.questions,'編集できる質問'],['到達できる質問',s.reachable,s.questions+'件中'],['要修正',s.issueErrors,'行き先・終了不可など'],['注意',s.issueWarnings,'ループ・孤立など']];$('stats').innerHTML=data.map((d,i)=>`<div class="stat ${i===2&&d[1]?'bad':''}"><small>${d[0]}</small><strong>${d[1]}</strong><span>${d[2]}</span></div>`).join('');}
function renderQuestions(){
 $('question-list').innerHTML=project.questions.map(q=>`<article class="question-card ${report.reachable.includes(q.id)?'':'unreachable'}" data-qcard="${esc(q.id)}">
 <div class="question-top"><span class="qid">${esc(q.id)}</span><span class="mini">${report.reachable.includes(q.id)?'到達可能':'未到達'}</span></div>
 <div class="question-fields"><label>質問文<input data-field="title" data-id="${esc(q.id)}" maxlength="160" value="${esc(q.title)}"></label><label>回答時間（分）<input data-field="minutes" data-id="${esc(q.id)}" type="number" min="0" max="30" step="0.5" value="${q.minutes}"></label></div>
 <div class="options-head">選択肢 <span>→</span> 行き先</div>
 ${q.options.map((o,i)=>`<div class="choice-row"><span class="idx">${i+1}</span><input aria-label="${esc(q.id)} 選択肢${i+1}" data-field="option-label" data-id="${esc(q.id)}" data-index="${i}" maxlength="100" value="${esc(o.label)}"><span class="arrow">↳</span><select aria-label="${esc(q.id)} 選択肢${i+1}の行き先" data-field="next" data-id="${esc(q.id)}" data-index="${i}">${destinations(o.next)}</select><button type="button" class="xbtn" title="選択肢を削除" aria-label="${esc(q.id)} 選択肢${i+1}を削除" data-action="delete-option" data-id="${esc(q.id)}" data-index="${i}">×</button></div>`).join('')}
 <div class="choice-controls"><button type="button" class="btn secondary compact" data-action="add-option" data-id="${esc(q.id)}">＋ 選択肢</button><button type="button" class="btn danger compact" data-action="delete-question" data-id="${esc(q.id)}">質問を削除</button></div>
 </article>`).join('');
 $('add-question').disabled=project.questions.length>=E.MAX_QUESTIONS;
}
function renderAudit(){const s=report.stats;
 $('audit-status').className='pill'+(s.issueErrors?' bad':s.issueWarnings?' warning':'');
 $('audit-status').textContent=s.issueErrors?`${s.issueErrors}件 要修正`:s.issueWarnings?`${s.issueWarnings}件 注意`:'問題なし';
 $('issue-list').innerHTML=report.issues.length?report.issues.map(i=>`<div class="issue ${i.level}"><span class="issue-icon">${i.level==='error'?'!':'△'}</span><div><b>${esc(i.id?i.id+' — '+i.code:i.code)}</b><p>${esc(i.message)}</p></div></div>`).join(''):'<div class="okblock">✓ 検出可能な構造上の問題はありません。実機での文言・操作テストも行ってください。</div>';
}
function renderMap(){ $('route-map').innerHTML=project.questions.map(q=>`<div class="route-node ${report.reachable.includes(q.id)?'':'dim'}"><span class="route-tag">${esc(q.id)}</span><div class="route-text"><b>${esc(q.title||'（未設定）')}</b><p>${q.options.map(o=>`${esc(o.label||'？')} → <strong>${esc(o.next==='END'?'完了':o.next||'未設定')}</strong>`).join('　/　')}</p></div></div>`).join('');}
function renderCases(){const {cases,truncated,stats}=report;
 $('path-list').innerHTML=`<p class="help">開始から各選択肢をたどり、完了・不明な行き先・ループを探索（最大${E.MAX_CASES}経路）。同じ質問への再訪でその経路を停止します。</p><p class="help">完了ケース ${stats.finished}/${stats.cases} ・ 最短 ${stats.shortest??'—'}問 ・ 最長 ${stats.longest??'—'}問 ・ 時間 ${stats.timeMin===null?'—':stats.timeMin.toFixed(1)}〜${stats.timeMax===null?'—':stats.timeMax.toFixed(1)}分${truncated?'（探索上限あり）':''}</p>`+
 cases.slice(0,12).map((c,i)=>`<div class="case"><b>CASE ${String(i+1).padStart(2,'0')}</b> <span class="case-status ${c.status}">${c.status==='end'?'完了':c.status==='loop'?'循環':'行先不明'}</span><p>${esc(c.path.map(s=>s.id+'「'+s.answer+'」').join(' → '))}${c.status==='end'?' → 完了':' → '+esc(c.last)}</p></div>`).join('')+(cases.length>12?`<p class="more">ほか${cases.length-12}件。すべての探索ケースは診断CSVで確認できます。</p>`:'');}
function renderRun(){
 if(run.status!=='active') { $('run-panel').innerHTML=`<div class="finished ${run.status==='end'?'':'stop'}"><strong>${run.status==='end'?'✓ 完了に到達しました':'! 経路が停止しました'}</strong><p>${esc(run.status==='loop'?'同じ質問を再訪しました。選択肢によっては循環します。':run.status==='broken'?'行き先が未設定か、削除された質問を参照しています。':'この経路は正常に完了します。')}</p><small>${run.trail.length}問 / 回答時間 ${run.minutes.toFixed(1)}分</small></div><div class="run-trail">${esc(run.trail.map(t=>t.id+'：'+t.answer).join(' → ')||'—')}</div>`;return;}
 const q=project.questions.find(x=>x.id===run.next);
 if(!q){run.status='broken';renderRun();return;}
 $('run-panel').innerHTML=`<span class="run-meta">STEP ${String(run.trail.length+1).padStart(2,'0')} / ${esc(q.id)}</span><h3 class="run-title">${esc(q.title||'質問文が未設定です')}</h3>${q.options.map((o,i)=>`<button type="button" class="run-choice" data-action="choose" data-index="${i}">↳ ${esc(o.label||'（選択肢名なし）')}</button>`).join('')}<div class="run-trail">これまでの経路：${esc(run.trail.map(t=>t.id+'：'+t.answer).join(' → ')||'まだありません')}</div>`;
}
function render(){
 $('project-name').value=project.name;
 $('start-question').innerHTML=project.questions.map(q=>`<option value="${esc(q.id)}" ${q.id===project.start?'selected':''}>${esc(q.id+' — '+q.title.slice(0,26))}</option>`).join('');
 renderStats();renderQuestions();renderAudit();renderMap();renderCases();renderRun();
}
function changeField(el){const q=project.questions.find(q=>q.id===el.dataset.id);if(!q)return;
 const field=el.dataset.field,i=Number(el.dataset.index);
 if(field==='title')q.title=el.value.slice(0,160);
 if(field==='minutes')q.minutes=Math.min(30,Math.max(0,Number(el.value)||0));
 if(field==='option-label')q.options[i].label=el.value.slice(0,100);
 if(field==='next')q.options[i].next=el.value;
 recompute();
}
function makeId(){const used=new Set(project.questions.map(q=>q.id));let i=1;while(used.has('q'+i))i++;return 'q'+i;}
function download(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function summary(){const s=report.stats;return [`【${project.name}｜分岐点検】`,`質問: ${s.questions}／到達: ${s.reachable}／要修正: ${s.issueErrors}／注意: ${s.issueWarnings}`, ...report.issues.map(i=>`[${i.level}] ${i.id} ${i.message}`),'注意: 設計上の検査であり、実フォームでの動作を保証しません。'].join('\n');}
function choose(i){if(run.status!=='active')return;const q=project.questions.find(q=>q.id===run.next);if(!q||!q.options[i])return;
 run.visited.push(q.id);run.trail.push({id:q.id,answer:q.options[i].label});run.minutes+=q.minutes;
 const next=q.options[i].next;run.next=next;
 if(next===E.END)run.status='end';else if(!project.questions.some(q=>q.id===next))run.status='broken';else if(run.visited.includes(next))run.status='loop';
 renderRun();}
$('question-list').addEventListener('change',e=>{const el=e.target.closest('[data-field]');if(el)changeField(el);});
$('question-list').addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el)return;const id=el.dataset.id;const q=project.questions.find(q=>q.id===id);if(!q)return;
 if(el.dataset.action==='add-option'){if(q.options.length>=E.MAX_OPTIONS){notify('選択肢は1質問あたり5件までです。',true);return;}q.options.push({label:'新しい選択肢',next:''});}
 if(el.dataset.action==='delete-option'){if(q.options.length===1){notify('選択肢は最低1件必要です。',true);return;}q.options.splice(Number(el.dataset.index),1);}
 if(el.dataset.action==='delete-question'){if(project.questions.length===1){notify('質問は最低1件必要です。',true);return;}project.questions=project.questions.filter(x=>x.id!==id);if(project.start===id)project.start=project.questions[0].id;/* incoming edges remain visible as broken */}
 recompute();});
$('run-panel').addEventListener('click',e=>{const el=e.target.closest('[data-action="choose"]');if(el)choose(Number(el.dataset.index));});
$('restart-run').addEventListener('click',()=>{resetRun();renderRun();});
$('add-question').addEventListener('click',()=>{if(project.questions.length>=E.MAX_QUESTIONS)return;const id=makeId();project.questions.push({id,title:'新しい質問',minutes:0.5,options:[{label:'はい',next:E.END},{label:'いいえ',next:E.END}]});recompute();document.querySelector(`[data-qcard="${id}"]`)?.scrollIntoView({behavior:'smooth',block:'center'});});
$('project-name').addEventListener('change',e=>{project.name=e.target.value.slice(0,140);recompute();});
$('start-question').addEventListener('change',e=>{project.start=e.target.value;recompute();});
$('reset-demo').addEventListener('click',()=>{project=E.demo();recompute();notify('サンプルを読み込みました。');});
$('new-project').addEventListener('click',()=>{project={version:1,name:'新しい分岐フォーム',start:'q1',questions:[{id:'q1',title:'最初の質問',minutes:0.5,options:[{label:'はい',next:E.END},{label:'いいえ',next:E.END}]}]};recompute();notify('新規プロジェクトを作成しました。');});
$('export-json').addEventListener('click',()=>download('bunki-akari-project.json',JSON.stringify(project,null,2),'application/json;charset=utf-8'));
$('export-csv').addEventListener('click',()=>download('bunki-akari-audit.csv',E.csvReport(report),'text/csv;charset=utf-8'));
$('import-json').addEventListener('click',()=>$('file-input').click());
$('file-input').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;
 try{if(f.size>200000)throw Error('JSONファイルは200KB以下にしてください。');const data=E.clean(JSON.parse(await f.text()));project=data;recompute();notify('JSONを読み込みました。');}
 catch(err){notify('読み込み失敗: '+err.message,true);}finally{e.target.value='';}});
$('copy-summary').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(summary());notify('診断メモをコピーしました。');}catch{notify('コピー不可の環境です。CSV出力をご利用ください。',true);}});
report=E.audit(project);resetRun();render();
})();
