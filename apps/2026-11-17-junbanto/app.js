(function(){
'use strict';
const E=window.JUNBANTO, STORE='junbanto-local-v1';
const app=document.getElementById('app'), toast=document.getElementById('toast');
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=x=>x?new Date(x).toLocaleString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
const empty=(msg)=>`<div class="empty"><div class="big">◌</div><p>${e(msg)}</p></div>`;
const iso=()=>new Date().toISOString();
let state,view='home',selectedTemplate=null,selectedRun=null,historyRun=null;
function notify(message){toast.textContent=message;toast.style.display='block';clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.style.display='none',4100);}
function load(){try{const data=localStorage.getItem(STORE);if(data){const parsed=JSON.parse(data);E.validateState(parsed);return parsed;}}catch(err){setTimeout(()=>notify('保存済みデータを読めません。バックアップがあれば復元してください。'),150);}return E.initial();}
state=load();
function save(){try{localStorage.setItem(STORE,JSON.stringify(state));return true;}catch(err){notify('このブラウザでは保存できません。JSONを書き出してください。');return false;}}
function setView(next){view=next;render();window.scrollTo({top:0,behavior:'instant'});}
function findTemplate(id){return state.templates.find(x=>x.id===id)}
function findRun(id){return state.runs.find(x=>x.id===id)}
function badge(run){if(run.status==='completed')return '<span class="pill">完了</span>';if(run.status==='incomplete')return '<span class="pill danger">未完了</span>';return '<span class="pill warn">進行中</span>';}
function home(){
 const active=state.runs.filter(x=>x.status==='active');
 return `<div class="flex between"><div><div class="eyebrow">YOUR PLAYBOOKS</div><h2 class="section" style="margin:0 0 12px">使う手順書を選ぶ</h2></div><button class="btn amber" data-action="create-template">＋ 手順書を作る</button></div>
 ${active.length?`<div class="highlight"><h3 style="margin:0">🟡 進行中のチェック</h3><div class="muted small" style="margin-bottom:10px">途中の結果は、手順書を変更してもそのまま残ります。</div>${active.map(r=>`<div class="flex between" style="padding:7px 0"><span><b>${e(r.templateTitle)}</b> <span class="small muted">${e(when(r.startedAt))}</span></span><button class="btn slim primary" data-action="open-run" data-id="${e(r.id)}">続きを開く</button></div>`).join('')}</div><div class="line"></div>`:''}
 <div class="grid">${state.templates.map(t=>`<article class="panel"><div class="eyebrow">${t.id.startsWith('example-')?'SAMPLE / 編集して使えます':'MY PROCEDURE'}</div><h3>${e(t.title)}</h3><p class="muted small">${e(t.description||'説明はまだありません。')}</p><div class="flex" style="margin:15px 0 18px"><span class="pill">${t.steps.length} ステップ</span><span class="pill warn">必須 ${t.steps.filter(s=>s.critical).length}</span></div><div class="flex"><button class="btn primary" data-action="start" data-id="${e(t.id)}">▶ 実行する</button><button class="btn" data-action="edit-template" data-id="${e(t.id)}">編集</button><button class="btn slim" data-action="duplicate" data-id="${e(t.id)}">複製</button></div></article>`).join('')}</div>
 <div class="under">※ 入力例は業務安全・法令遵守を保証するものではありません。必須項目と判断基準を各現場の実情に合わせて調整してください。</div>`;
}
function runView(){
 const runs=state.runs.filter(x=>x.status==='active');if(!runs.length)return `<h2 class="section">実行中のチェック</h2>${empty('進行中の実行はありません。「手順書」から開始してください。')}<div class="flex" style="margin-top:20px"><button class="btn primary" data-view="home">手順書へ</button></div>`;
 let run=findRun(selectedRun);if(!run||run.status!=='active'){run=runs[runs.length-1];selectedRun=run.id;}
 const a=E.assess(run);
 const statuses=[['pending','未着手'],['done','実施済'],['blocked','要対応'],['skipped','対象外']];
 return `<div class="flex between"><div><div class="eyebrow">LIVE CHECKLIST</div><h2 class="section" style="margin:0">${e(run.templateTitle)}</h2><div class="small muted">開始：${e(when(run.startedAt))} · 開始時の手順を固定して記録</div></div>${badge(run)}</div>
 ${runs.length>1?`<div class="panel" style="margin:16px 0"><label for="run-picker">表示する実行を選択</label><select id="run-picker" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:10px">${runs.map(x=>`<option value="${e(x.id)}" ${x.id===run.id?'selected':''}>${e(x.templateTitle)} — ${e(when(x.startedAt))}</option>`).join('')}</select></div>`:''}
 <section class="panel" style="margin:18px 0"><div class="flex between"><div><strong>${a.done} / ${a.total} 実施済</strong><div class="small muted">必須を残したまま完了にはできません。</div></div><div class="pill ${a.eligible?'':'warn'}">${a.eligible?'完了可能':'確認が必要'}</div></div><div class="progress"><span style="width:${a.rate}%"></span></div><div class="stats"><div class="stat"><strong>${a.done}</strong><span>実施済</span></div><div class="stat"><strong>${a.blocked}</strong><span>要対応</span></div><div class="stat"><strong>${a.pending}</strong><span>未着手</span></div><div class="stat"><strong>${a.skipped}</strong><span>対象外</span></div></div></section>
 <h2 class="section">手順をひとつずつ記録</h2>
 ${run.steps.map((s,i)=>`<section class="stepcard" data-status="${e(s.status)}"><div class="flex"><div class="stepnum">${i+1}</div><div style="flex:1;min-width:160px"><h3 style="margin:0">${e(s.title)}</h3><span class="${s.critical?'critical':'small muted'}">${s.critical?'● 必須項目':'○ 通常項目'}</span></div></div><div class="question"><b>完了の判断：</b>${e(s.criteria||'設定なし')}</div><div class="statusbar">${statuses.filter(([status])=>!s.critical||status!=='skipped').map(([v,label])=>`<button class="statusbtn ${s.status===v?'selected':''}" data-action="status" data-id="${e(s.id)}" data-value="${v}" aria-pressed="${s.status===v?'true':'false'}">${label}</button>`).join('')}</div><div class="field" style="margin:13px 0 0"><label for="note-${e(s.id)}">メモ${!s.critical?'（対象外にする場合は理由が必須）':''}</label><textarea id="note-${e(s.id)}" data-note="${e(s.id)}" rows="2" placeholder="判断の根拠・残っている課題など">${e(s.note)}</textarea></div></section>`).join('')}
 <div class="panel"><h3>終了する前に</h3><p class="muted small">「完了」は未着手・要対応がゼロの場合だけ。「未完了として終了」は未解決の状態をそのまま履歴に残します。</p>${a.eligible?'<p class="notice">すべての項目を記録しました。完了として保存できます。</p>':`<p class="notice attention">未着手 ${a.pending}件、要対応 ${a.blocked}件。完了とは記録できません。</p>`}<div class="flex" style="margin-top:15px"><button class="btn primary" data-action="complete" ${a.eligible?'':'disabled'}>✓ 完了として終了</button><button class="btn warn" data-action="incomplete">未完了として終了</button><button class="btn" data-action="report" data-id="${e(run.id)}">記録をMD出力</button></div></div>`;
}
function templateEditor(){let t=findTemplate(selectedTemplate);if(!t)return `<h2>対象が見つかりません</h2><button class="btn" data-view="home">戻る</button>`;
 return `<div class="flex between"><div><div class="eyebrow">PROCEDURE EDITOR</div><h2 class="section" style="margin:0 0 15px">手順書を編集</h2></div><button class="btn" data-view="home">← 一覧へ</button></div>
 <div class="panel wide"><div class="field"><label for="template-title">手順書名</label><input type="text" id="template-title" maxlength="100" value="${e(t.title)}"></div><div class="field"><label for="template-desc">説明</label><textarea id="template-desc" maxlength="600">${e(t.description)}</textarea></div><div class="flex"><button class="btn primary" data-action="save-template">手順書名・説明を保存</button><button class="btn warn" data-action="delete-template">手順書を削除</button></div></div>
 <h2 class="section">項目と完了条件</h2><p class="muted small">実行中・終了済みの記録は、ここを編集しても変更されません。</p>
 ${t.steps.map((s,i)=>`<div class="stepcard" data-edit-step="${e(s.id)}"><div class="flex between"><b>${i+1} / ${t.steps.length}</b><div class="flex"><button class="btn slim" data-action="move-step" data-id="${e(s.id)}" data-dir="-1" ${i===0?'disabled':''}>↑</button><button class="btn slim" data-action="move-step" data-id="${e(s.id)}" data-dir="1" ${i===t.steps.length-1?'disabled':''}>↓</button><button class="btn slim warn" data-action="delete-step" data-id="${e(s.id)}" ${t.steps.length===1?'disabled':''}>削除</button></div></div><div class="field"><label>項目名</label><input type="text" maxlength="160" data-field="title" value="${e(s.title)}"></div><div class="field"><label>完了の判断条件</label><textarea maxlength="500" rows="2" data-field="criteria">${e(s.criteria)}</textarea></div><div class="inline-check"><input type="checkbox" data-field="critical" id="critical-${e(s.id)}" ${s.critical?'checked':''}><label for="critical-${e(s.id)}">必須項目（対象外にできません）</label></div><div style="margin-top:12px"><button class="btn slim" data-action="save-step" data-id="${e(s.id)}">この項目を保存</button></div></div>`).join('')}
 <div class="flex" style="margin-top:15px"><button class="btn amber" data-action="add-step">＋ 項目を追加</button><button class="btn" data-view="home">一覧へ戻る</button></div>`;
}
function historyView(){
 const rows=state.runs.filter(x=>x.status!=='active').slice().reverse();
 const run=findRun(historyRun);
 if(run&&run.status!=='active'){const a=E.assess(run);return `<div class="flex between"><h2 class="section">${e(run.templateTitle)} · 実行記録</h2><button class="btn" data-action="history-back">← 記録一覧</button></div><div class="panel"><div class="flex between">${badge(run)}<span class="muted small">${e(when(run.startedAt))} ～ ${e(when(run.endedAt))}</span></div><div class="stats"><div class="stat"><strong>${a.done}</strong><span>実施済</span></div><div class="stat"><strong>${a.blocked}</strong><span>要対応</span></div><div class="stat"><strong>${a.pending}</strong><span>未着手</span></div></div>${run.steps.map((s,i)=>`<div class="history"><b>${i+1}. ${e(s.title)}</b> <span class="pill ${s.status==='blocked'?'danger':s.status==='done'?'':'warn'}">${({done:'実施済',pending:'未着手',blocked:'要対応',skipped:'対象外'})[s.status]}</span><div class="small muted">判断条件：${e(s.criteria)}</div>${s.note?`<div class="small">メモ：${e(s.note)}</div>`:''}</div>`).join('')}<div class="flex" style="margin-top:19px"><button class="btn primary" data-action="report" data-id="${e(run.id)}">Markdownを保存</button><button class="btn" data-action="copy-report" data-id="${e(run.id)}">文章をコピー</button><button class="btn warn" data-action="delete-run" data-id="${e(run.id)}">記録を削除</button></div></div>`;}
 return `<div class="flex between"><div><div class="eyebrow">RUN HISTORY</div><h2 class="section" style="margin:0">実行記録</h2></div><span class="pill">${rows.length}件</span></div><div class="panel" style="margin-top:20px">${rows.length?rows.map(r=>`<div class="history flex between"><div><div>${badge(r)} <b>${e(r.templateTitle)}</b></div><div class="muted small">${e(when(r.startedAt))} · 実施済 ${E.assess(r).done}/${r.steps.length}</div></div><button class="btn slim" data-action="history-detail" data-id="${e(r.id)}">詳細を見る</button></div>`).join(''):empty('終了した記録はまだありません。')}</div>`;
}
function backupView(){return `<div class="eyebrow">DATA PORTABILITY</div><h2 class="section" style="margin:0 0 15px">手元に残す・ほかの端末へ移す</h2><div class="grid"><section class="panel"><h3>バックアップを保存</h3><p class="muted small">手順書と実行記録を1つのJSONファイルとして保存します。後から読み込めます。</p><button class="btn primary" data-action="export">↓ JSONを書き出す</button></section><section class="panel"><h3>バックアップを復元</h3><p class="muted small">読み込むと、このブラウザの現在のデータを置き換えます。大事なデータは事前に書き出してください。</p><label class="btn" style="display:inline-flex;cursor:pointer">↑ JSONを選択<input type="file" id="import-file" accept=".json,application/json" style="display:none"></label></section></div><div class="panel" style="margin-top:17px"><h3>保存の仕組み</h3><p class="muted small">ブラウザの localStorage に保存。アプリを削除・履歴消去・プライベートブラウズ終了した場合は消えることがあります。複数端末間の自動同期はありません。共有が必要ならJSONファイルを自分で安全に受け渡してください。</p><p class="muted small">個人情報や機密情報を入力しない運用を推奨。データを外部サーバーに送信する処理はありません。</p></div>`;}
function render(){document.querySelectorAll('.navbtn').forEach(x=>x.classList.toggle('active',x.dataset.view===view||(view==='editor'&&x.dataset.view==='home')));app.innerHTML=view==='home'?home():view==='run'?runView():view==='history'?historyView():view==='backup'?backupView():templateEditor();}
function patchTemplate(fn){const t=findTemplate(selectedTemplate);if(!t)return;fn(t);t.updatedAt=iso();save();render();}
function download(content,name,type){const b=new Blob([content],{type});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);}
function report(runId){const r=findRun(runId);if(!r)return;download(E.markdown(r),`junbanto-${r.startedAt.slice(0,10)}-${r.id.slice(0,8)}.md`,'text/markdown;charset=utf-8');notify('Markdownレポートを保存しました');}
function onAction(node){const a=node.dataset.action,id=node.dataset.id;try{
  if(a==='create-template'){const t=E.newTemplate('新しい手順書');state.templates.push(t);selectedTemplate=t.id;save();setView('editor');}
  else if(a==='edit-template'){selectedTemplate=id;setView('editor');}
  else if(a==='duplicate'){const t=findTemplate(id);if(!t)return;const copy=JSON.parse(JSON.stringify(t));copy.id=E.uid();copy.title=E.clip(t.title+'（コピー）',100);copy.steps.forEach(x=>x.id=E.uid());copy.updatedAt=iso();state.templates.push(copy);save();selectedTemplate=copy.id;setView('editor');notify('複製しました');}
  else if(a==='start'){const t=findTemplate(id);if(!t)return;const run=E.beginRun(t);state.runs.push(run);selectedRun=run.id;save();setView('run');}
  else if(a==='open-run'){selectedRun=id;setView('run');}
  else if(a==='status'){
    const r=findRun(selectedRun);if(!r)return;const note=document.getElementById('note-'+id)?.value||'';
    const fresh=E.updateStep(r,id,node.dataset.value,note);state.runs[state.runs.findIndex(x=>x.id===r.id)]=fresh;save();render();
  }
  else if(a==='complete'||a==='incomplete'){const r=findRun(selectedRun);if(!r)return;const kind=a==='complete'?'completed':'incomplete';if(kind==='incomplete'&&!confirm('未対応の項目を残したまま「未完了」として終了しますか？'))return;const fresh=E.closeRun(r,kind);state.runs[state.runs.findIndex(x=>x.id===r.id)]=fresh;save();historyRun=r.id;setView('history');notify(kind==='completed'?'完了として記録しました':'未完了のまま記録しました');}
  else if(a==='save-template'){patchTemplate(t=>{t.title=E.clip(document.getElementById('template-title').value,100)||t.title;t.description=E.clip(document.getElementById('template-desc').value,600)});notify('手順書を保存しました');}
  else if(a==='add-step'){patchTemplate(t=>{if(t.steps.length>=80)throw Error('80項目を超えて追加できません');t.steps.push({id:E.uid(),title:'新しい確認項目',criteria:'完了とみなす条件',critical:true})});notify('項目を追加しました');}
  else if(a==='save-step'){const el=app.querySelector(`[data-edit-step="${CSS.escape(id)}"]`);if(!el)return;patchTemplate(t=>{const s=t.steps.find(x=>x.id===id);if(!s)return;const name=E.clip(el.querySelector('[data-field=title]').value,160);if(!name)throw Error('項目名を入力してください');s.title=name;s.criteria=E.clip(el.querySelector('[data-field=criteria]').value,500);s.critical=el.querySelector('[data-field=critical]').checked});notify('項目を保存しました');}
  else if(a==='delete-step'){if(!confirm('この項目を削除しますか？既存の実行記録は変更されません。'))return;patchTemplate(t=>{if(t.steps.length===1)throw Error('最後の1項目は削除できません');t.steps=t.steps.filter(s=>s.id!==id)});}
  else if(a==='move-step'){patchTemplate(t=>{const i=t.steps.findIndex(x=>x.id===id),j=i+Number(node.dataset.dir);if(i<0||j<0||j>=t.steps.length)return;[t.steps[i],t.steps[j]]=[t.steps[j],t.steps[i]]});}
  else if(a==='delete-template'){if(!confirm('手順書を削除しますか？以前の実行記録は残ります。'))return;state.templates=state.templates.filter(t=>t.id!==selectedTemplate);save();setView('home');notify('手順書を削除しました');}
  else if(a==='history-detail'){historyRun=id;render();}
  else if(a==='history-back'){historyRun=null;render();}
  else if(a==='delete-run'){if(!confirm('この記録を完全に削除しますか？'))return;state.runs=state.runs.filter(x=>x.id!==id);save();historyRun=null;render();}
  else if(a==='report')report(id);
  else if(a==='copy-report'){const r=findRun(id);if(!r)return;if(navigator.clipboard?.writeText){navigator.clipboard.writeText(E.markdown(r)).then(()=>notify('コピーしました')).catch(()=>report(id));}else report(id);}
  else if(a==='export'){download(JSON.stringify(state,null,2),'junbanto-backup-'+new Date().toISOString().slice(0,10)+'.json','application/json;charset=utf-8');notify('バックアップを保存しました');}
}catch(err){notify(err.message||'処理に失敗しました');}}
document.addEventListener('click',ev=>{const btn=ev.target.closest('button[data-action],button[data-view]');if(!btn)return;if(btn.dataset.view){setView(btn.dataset.view);return;}onAction(btn);});
app.addEventListener('change',async ev=>{
 if(ev.target.id==='run-picker'){selectedRun=ev.target.value;render();return;}
 if(ev.target.matches('textarea[data-note]')){
   try{const r=findRun(selectedRun);if(!r)return;const step=r.steps.find(s=>s.id===ev.target.dataset.note);if(!step)return;
    const requested=String(ev.target.value).trim();
    const status=step.status==='skipped'&&!requested?'pending':step.status;
    const fresh=E.updateStep(r,step.id,status,requested);state.runs[state.runs.findIndex(x=>x.id===r.id)]=fresh;save();
    if(status!==step.status){render();notify('対象外の理由が消えたため未着手に戻しました');}}
   catch(err){notify(err.message);}
 }
 if(ev.target.id==='import-file'){
   const file=ev.target.files?.[0];if(!file)return;if(file.size>2*1024*1024){notify('2MBを超えるファイルは読み込めません');return;}
   try{const imported=JSON.parse(await file.text());E.validateState(imported);if(!confirm('現在の手順書と履歴をバックアップで置き換えますか？'))return;state=imported;selectedRun=null;selectedTemplate=null;historyRun=null;save();setView('home');notify('バックアップを復元しました');}catch(err){notify('復元できません: '+(err.message||'形式不明'));}
 }
});
render();
})();
