(() => {
  'use strict';
  const E = window.KobanEngine;
  const $ = id => document.getElementById(id);
  const esc = v => String(v??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const storageKey='koban-tsunagi-v1';
  const clone = obj => JSON.parse(JSON.stringify(obj));
  let project;
  try { project=E.normalizeProject(JSON.parse(localStorage.getItem(storageKey)) || E.exampleProject()); }
  catch {project=E.exampleProject();}
  let history=null, comparison=null, timer;
  const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify(project));}catch{notify('端末保存が使用できません。JSON保存を利用してください。');}};
  const notify=message=>{const t=$('toast');t.textContent=message;t.classList.add('on');clearTimeout(timer);timer=setTimeout(()=>t.classList.remove('on'),2800);};
  const id=prefix=>prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
  function inputValue(id,value){$(id).value=value;}
  function renderEditor(){
    inputValue('project-title',project.title);
    for(const [k,v] of Object.entries(project.settings)) inputValue('setting-'+k,v);
    $('actor-list').innerHTML=project.actors.map((a,i)=>`<div class="actor-row" data-id="${esc(a.id)}"><label>役名<input data-actor-key="label" maxlength="60" value="${esc(a.label)}" aria-label="出演者${i+1}の役名"></label><label>開始<input data-actor-key="from" type="time" value="${esc(a.from)}" aria-label="${esc(a.label)}開始"></label><label>終了<input data-actor-key="to" type="time" value="${esc(a.to)}" aria-label="${esc(a.label)}終了"></label><button class="mini-icon" data-action="remove-actor" title="出演者を削除" aria-label="出演者${i+1}を削除">×</button></div>`).join('') || '<p class="empty">出演者なし。必要に応じて追加できます。</p>';
    $('scene-list').innerHTML=project.scenes.map((s,i)=>`<div class="scene-card" data-id="${esc(s.id)}"><div class="scene-top"><span class="scene-no">${String(i+1).padStart(2,'0')}</span><input data-scene-key="title" maxlength="100" value="${esc(s.title)}" aria-label="シーン${i+1}の内容"><div class="scene-controls"><button class="mini-icon" title="上へ" aria-label="シーン${i+1}を上へ" data-action="up" ${i===0?'disabled':''}>↑</button><button class="mini-icon" title="下へ" aria-label="シーン${i+1}を下へ" data-action="down" ${i===project.scenes.length-1?'disabled':''}>↓</button><button class="mini-icon" title="削除" aria-label="シーン${i+1}を削除" data-action="remove-scene">×</button></div></div><div class="scene-meta"><label>撮影ロケーション<input data-scene-key="location" maxlength="60" value="${esc(s.location)}"></label><label>撮影分数<input data-scene-key="duration" type="number" min="5" max="240" value="${s.duration}"></label></div><div class="cast-selector"><span>出演</span>${project.actors.length?project.actors.map(a=>`<label class="cast-chip"><input type="checkbox" data-cast="${esc(a.id)}" ${s.cast.includes(a.id)?'checked':''}>${esc(a.label)}</label>`).join(''):'<span class="empty">出演者なし</span>'}</div></div>`).join('') || '<p class="empty">シーンがありません。追加して開始してください。</p>';
  }
  function renderPlan(){
    const plan=E.makePlan(project);
    $('metric-end').textContent=E.minuteLabel(plan.end);
    $('metric-over').textContent=plan.overtime?`終了目安を ${plan.overtime} 分超過`:'終了目安の時間内';
    $('metric-conflict').innerHTML=`${plan.castViolations} <small>件</small>`;
    $('metric-moves').innerHTML=`${plan.moves*project.settings.moveMinutes} / ${plan.waiting} <small>分</small>`;
    $('metric-status').textContent=plan.issues.length ? `${plan.issues.length}件 注意`:'順調';
    $('metric-alerts').textContent=plan.issues.length ? '下の診断を確認してください' : '現在の設定では時間上の警告なし';
    $('issue-count').textContent=plan.issues.length+'件';
    $('issues').innerHTML=plan.issues.length ? plan.issues.map(x=>`<div class="issue ${esc(x.level)}"><span class="issue-mark">${x.level==='error'?'●':'△'}</span><div><b>${esc(x.message)}</b></div></div>`).join(''):'<div class="ok-note">✓ 出演時間・終了時刻について検出された問題はありません。</div>';
    const total=Math.max(1,plan.span);const tt=E.minuteLabel;
    $('timeline').innerHTML=`<div class="time-ruler"><span>${tt(plan.start)}</span><span>${tt(plan.start+Math.round(total/2))}</span><span>${tt(plan.end)}</span></div><div class="track">${plan.blocks.map(b=>{const conflicted=plan.issues.some(x=>x.blockId===b.sceneId&&x.code==='CAST_WINDOW');const width=Math.max(0.001,100*(b.end-b.start)/total);return `<button type="button" class="track-item ${b.kind} ${conflicted?'conflict':''}" style="flex:${width} 1 0" title="${esc(tt(b.start)+'–'+tt(b.end)+' '+b.label)}" data-focus="${esc(b.sceneId||'')}"><b>${esc(b.kind==='scene'?b.label:(b.kind==='lunch'?'休憩':b.kind==='move'?'移動':'待機'))}</b><span>${b.end-b.start}分</span></button>`;}).join('')}</div><div class="block-list">${plan.blocks.map(b=>`<div class="block-row"><span class="block-time">${tt(b.start)}–${tt(b.end)}</span><span class="block-bar ${b.kind}"></span><div><b>${esc(b.label)}</b><p>${esc(b.location||({move:'ロケ地の切替',wait:'出演可能時刻に合わせて調整',lunch:'休憩'}[b.kind]||''))}${b.cast?.length?' · '+esc(b.cast.map(id=>project.actors.find(a=>a.id===id)?.label||'').join(' / ')):''}</p></div><small>${b.end-b.start}分</small></div>`).join('')}</div>`;
    if(comparison){const {before,after,explored}=comparison;const cut=before.score-after.score; $('comparison').hidden=false; $('comparison').innerHTML=`<strong>${cut>0?'✓ 改善候補を採用しました':'現状より条件が良い並びを見つけられませんでした'}</strong>並べ替え候補を${explored}件評価 · 移動 ${before.moves}→${after.moves}回 · 待機 ${before.waiting}→${after.waiting}分 · 出演時間の問題 ${before.castViolations}→${after.castViolations}件 · 終了超過 ${before.overtime}→${after.overtime}分`;}
    else $('comparison').hidden=true;
    $('undo').disabled=!history;
  }
  function render(){renderEditor();renderPlan();persist();}
  function refresh(){comparison=null;history=null;render();}
  function download(filename,text,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);}
  $('project-title').addEventListener('change',e=>{project.title=e.target.value.trim()||'無題の撮影';refresh();});
  for(const key of Object.keys(project.settings))$('setting-'+key).addEventListener('change',e=>{project.settings[key]=e.target.value;project=E.normalizeProject(project);refresh();});
  $('actor-list').addEventListener('change',e=>{const a=project.actors.find(x=>x.id===e.target.closest('[data-id]')?.dataset.id);const key=e.target.dataset.actorKey;if(!a||!key)return;a[key]=e.target.value;project=E.normalizeProject(project);refresh();});
  $('actor-list').addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn)return;const key=btn.closest('[data-id]')?.dataset.id;project.actors=project.actors.filter(a=>a.id!==key);project.scenes.forEach(s=>s.cast=s.cast.filter(c=>c!==key));refresh();notify('出演者を削除しました');});
  $('scene-list').addEventListener('change',e=>{
    const sc=project.scenes.find(x=>x.id===e.target.closest('[data-id]')?.dataset.id);if(!sc)return;
    if(e.target.dataset.cast){const cast=e.target.dataset.cast;sc.cast=e.target.checked?[...sc.cast,cast]:sc.cast.filter(x=>x!==cast);}
    else if(e.target.dataset.sceneKey){sc[e.target.dataset.sceneKey]=e.target.value;}
    project=E.normalizeProject(project);refresh();
  });
  $('scene-list').addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn)return;const item=btn.closest('[data-id]');const i=project.scenes.findIndex(x=>x.id===item?.dataset.id);if(i<0)return;
    if(btn.dataset.action==='remove-scene')project.scenes.splice(i,1);
    else if(btn.dataset.action==='up'&&i>0)[project.scenes[i-1],project.scenes[i]]=[project.scenes[i],project.scenes[i-1]];
    else if(btn.dataset.action==='down'&&i<project.scenes.length-1)[project.scenes[i+1],project.scenes[i]]=[project.scenes[i],project.scenes[i+1]];
    refresh();
  });
  $('timeline').addEventListener('click',e=>{const sc=e.target.closest('[data-focus]');if(sc?.dataset.focus){const card=Array.from(document.querySelectorAll('.scene-card')).find(el=>el.dataset.id===sc.dataset.focus);card?.scrollIntoView({behavior:'smooth',block:'center'});card?.querySelector('input')?.focus({preventScroll:true});}});
  $('add-scene').addEventListener('click',()=>{if(project.scenes.length>=40)return notify('シーンは40件までです');project.scenes.push({id:id('s'),title:'新しいシーン',location:'スタジオ',duration:30,cast:[]});refresh();});
  $('add-actor').addEventListener('click',()=>{if(project.actors.length>=20)return notify('出演者は20件までです');project.actors.push({id:id('a'),label:'出演'+(project.actors.length+1),from:'09:00',to:'18:00'});refresh();});
  $('optimize').addEventListener('click',()=>{const result=E.optimize(project);comparison=result;history=result.improved?clone(project):null;if(result.improved){const lookup=new Map(project.scenes.map(s=>[s.id,s]));project.scenes=result.order.map(id=>lookup.get(id));notify('撮影順を改善しました');}else notify('現在の並びも有力な候補です');render();});
  $('undo').addEventListener('click',()=>{if(!history)return;project=history;history=null;comparison=null;render();notify('元の順番に戻しました');});
  $('reset-demo').addEventListener('click',()=>{if(window.confirm('入力内容を初期サンプルに戻しますか？')){project=E.exampleProject();refresh();notify('サンプルを復元しました');}});
  $('export-json').addEventListener('click',()=>{download('koban-tsunagi-project.json',JSON.stringify(project,null,2),'application/json');notify('JSONを書き出しました');});
  $('export-csv').addEventListener('click',()=>{download('koban-tsunagi-schedule.csv',E.toCsv(project),'text/csv;charset=utf-8');notify('タイムラインCSVを書き出しました');});
  $('print').addEventListener('click',()=>window.print());
  $('import-button').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>1_000_000)throw Error('1 MBを超えるファイルは読み込めません');const data=JSON.parse(await f.text());if(!data||!Array.isArray(data.scenes)||!Array.isArray(data.actors))throw Error('対応していない形式です');project=E.normalizeProject(data);refresh();notify('JSONを読み込みました');}catch(err){notify('読込失敗：'+err.message);}finally{e.target.value='';}});
  render();
})();
