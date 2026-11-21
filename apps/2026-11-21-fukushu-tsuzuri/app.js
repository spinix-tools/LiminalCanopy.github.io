/* Controller: all data remains in the user's browser; no external requests. */
(() => {
  'use strict';
  const E = window.FukushuEngine, KEY = 'fukushu-tsuzuri-v1';
  const $ = id => document.getElementById(id);
  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => Number(n).toLocaleString('ja-JP');
  const dateLocal = () => { const d = new Date(); const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0,10); };
  let state = {bank: E.sampleBank(), chosenTopics: ['分数','国語','理科'], planIds: [], asOf:dateLocal(), count:6, minutes:10};
  let current = null;
  function notify(s) { $('toast').textContent = s; clearTimeout(notify.timer); notify.timer = setTimeout(() => $('toast').textContent = '', 5000); }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { notify('端末保存に失敗しました。JSONバックアップをご利用ください'); } }
  function restore() {
    try {
      const raw = localStorage.getItem(KEY); if (!raw) return;
      const v = JSON.parse(raw); const bank = E.validateBank(v.bank);
      state = {bank, chosenTopics:Array.isArray(v.chosenTopics) ? v.chosenTopics.filter(x => typeof x === 'string') : [],
        planIds:Array.isArray(v.planIds) ? v.planIds.filter(x => typeof x === 'string') : [],
        asOf:E.dateValid(v.asOf)?v.asOf:dateLocal(),count:Math.max(1,Math.min(30,Number(v.count)||6)),minutes:Math.max(1,Math.min(120,Number(v.minutes)||10))};
    } catch (_) { notify('以前のデータが読み取れないためサンプルを開きました'); }
  }
  function topics() { return [...new Set(state.bank.map(q => q.topic))].sort((a,b)=>a.localeCompare(b,'ja')); }
  function syncTopics() {
    const all = topics();
    // Empty is a deliberate 'none selected' choice.
    state.chosenTopics = state.chosenTopics.filter(t => all.includes(t));
    return all;
  }
  function readControls() {
    state.count = Math.max(1, Math.min(30, Number($('count').value)||6));
    state.minutes = Math.max(1, Math.min(120, Number($('minutes').value)||10));
    state.asOf = E.dateValid($('asof').value)?$('asof').value:dateLocal();
    $('count').value = state.count; $('minutes').value = state.minutes;
  }
  function replan() {
    readControls(); const all = syncTopics();
    current = E.plan(state.bank,{count:state.count, minutes:state.minutes, asOf:state.asOf, topics:state.chosenTopics});
    state.planIds = current.questions.map(q=>q.id); persist(); render();
    if (!all.length) notify('まず問題バンクに問題を追加してください');
  }
  function currentFromIds() {
    const ordered = state.planIds.map(id => state.bank.find(q=>q.id === id)).filter(Boolean);
    const secs = ordered.reduce((s,q)=>s+q.seconds,0);
    return {...E.plan(state.bank,{count:state.count,minutes:state.minutes,asOf:state.asOf,topics:[]}),
      questions:ordered.map(q=>({...q,...E.priority(q,state.asOf)})), seconds:secs,
      warning:ordered.length < state.count?`希望${state.count}問に対して${ordered.length}問です（時間上限・登録数・単元を確認）`:''};
  }
  function render() {
    const all = syncTopics();
    $('count').value = state.count; $('minutes').value = state.minutes; $('asof').value = state.asOf;
    $('bank-count').textContent = `(${state.bank.length})`;
    $('topic-filters').innerHTML = all.length ? all.map(t=> `<label class="chip"><input type="checkbox" class="topic-check" value="${esc(t)}" ${state.chosenTopics.includes(t)?'checked':''}><span>${esc(t)}</span></label>`).join('') : '<span class="muted">単元がありません</span>';
    current = currentFromIds();
    $('plan-count').textContent = `${current.questions.length}問 · 約${(current.seconds/60).toFixed(1)}分`;
    $('plan-reason').textContent = '直近の出題、正答率、単元の偏りを考慮して候補を選びます。';
    $('warning').hidden = !current.warning; $('warning').textContent = current.warning;
    $('plan-list').innerHTML = current.questions.length ? current.questions.map((q,i)=>`<article class="question"><div class="n">${String(i+1).padStart(2,'0')}</div><div class="info"><div class="qmeta"><span class="tag">${esc(q.topic)} · ${['','基礎','標準','発展'][q.difficulty]}</span><span class="subtle">${q.seconds}秒</span></div><div class="qtext">${esc(q.prompt)}</div><div class="qbottom"><span>${q.attempts ? `正答率 ${Math.round(q.correct/q.attempts*100)}%`:'新規問題'} · ${q.lastUsed||'未実施'}</span><span class="why">${q.due ? '● 復習候補':'○ 最近出題'}</span></div></div></article>`).join('') : '<div class="empty">条件に合う問題がありません。単元と想定時間を確認してください。</div>';
    $('feedback').innerHTML = current.questions.length ? current.questions.map((q,i)=>`<div class="feedback-row" data-id="${esc(q.id)}"><span class="short" title="${esc(q.prompt)}">${i+1}. ${esc(q.prompt)}</span><label>受験数<input type="number" min="1" max="9999" class="attempt-count" placeholder="例 25"></label><label>正解数<input type="number" min="0" max="9999" class="correct-count" placeholder="例 18"></label></div>`).join('') : '<div class="muted">出題候補を選ぶと集計欄が表示されます。</div>';
    renderBank();
  }
  function renderBank() {
    const term = $('search').value.trim().toLocaleLowerCase();
    const list = state.bank.filter(q => (q.topic+' '+q.prompt+' '+q.answer).toLocaleLowerCase().includes(term));
    $('search-count').textContent = `${list.length}件`;
    $('bank-list').innerHTML = list.map(q=> {const p=E.priority(q,state.asOf);
      return `<article class="bankitem"><span class="tag">${esc(q.topic)}</span><h3>${esc(q.prompt)}</h3><div class="detail"><span>${q.seconds}秒</span><span>正答 ${q.attempts ? Math.round(q.correct/q.attempts*100)+'%':'未集計'}</span><span>${p.due?'復習対象':'間隔内'}</span></div><div class="actions"><span class="tiny muted">${esc(q.answer)}</span><div class="buttons"><button type="button" data-edit="${esc(q.id)}">編集</button><button type="button" data-remove="${esc(q.id)}">削除</button></div></div></article>`;
    }).join('') || '<div class="empty">問題が見つかりません</div>';
  }
  function clearForm() {
    $('edit-id').value=''; $('topic').value=''; $('prompt').value=''; $('answer').value='';
    $('seconds').value=90; $('difficulty').value=2; $('save-question').textContent='＋ 問題を保存';
  }
  function edit(id) {
    const q=state.bank.find(x=>x.id===id); if(!q)return;
    $('edit-id').value=q.id; $('topic').value=q.topic; $('prompt').value=q.prompt;
    $('answer').value=q.answer; $('seconds').value=q.seconds; $('difficulty').value=q.difficulty;
    $('save-question').textContent='変更を保存';
    $('topic').scrollIntoView({behavior:'smooth',block:'center'});
  }
  function saveQuestion() {
    const id=$('edit-id').value || E.makeId(); const old=state.bank.find(q=>q.id===id);
    if(!old && state.bank.length >= E.MAX) return notify('問題登録は300件までです');
    try {
      const q=E.parseQuestion({id, topic:$('topic').value,prompt:$('prompt').value,answer:$('answer').value,
        seconds:Number($('seconds').value),difficulty:Number($('difficulty').value),attempts:old?.attempts||0,
        correct:old?.correct||0,lastUsed:old?.lastUsed||''});
      state.bank=old?state.bank.map(x=>x.id===id?q:x):[...state.bank,q];
      if(!state.chosenTopics.includes(q.topic))state.chosenTopics.push(q.topic);
      clearForm();replan();notify('問題を保存しました');
    }catch(e){notify(e.message);}
  }
  function saveFeedback() {
    const rows=[...document.querySelectorAll('.feedback-row')];let changed=0;
    try {
      let next=state.bank;
      for(const row of rows){
        const a=row.querySelector('.attempt-count').value, c=row.querySelector('.correct-count').value;
        if(a==='' && c==='')continue;
        if(a==='' || c==='')throw Error('受験数と正解数はセットで入力してください');
        next=E.recordAggregate(next,row.dataset.id,Number(a),Number(c),state.asOf);changed++;
      }
      if (!changed) return notify('集計数を入力してください');
      state.bank=next; persist(); replan(); notify(`${changed}問の集計を追加しました。次回候補を更新しました`);
    } catch(e) { notify(e.message); }
  }
  function download(name, content, mime='text/plain;charset=utf-8') {
    const blob=new Blob([content],{type:mime}), url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function exportJSON() { download('fukushu-tsuzuri-backup.json',JSON.stringify({version:1,...state},null,2),'application/json;charset=utf-8');notify('JSONバックアップを出力しました'); }
  function exportCSV() { download('fukushu-bank.csv',E.toCSV([['ID','単元','問題','解答','秒数','難易度','累計受験','累計正解','最終実施日'], ...state.bank.map(q=>[q.id,q.topic,q.prompt,q.answer,q.seconds,q.difficulty,q.attempts,q.correct,q.lastUsed])]),'text/csv;charset=utf-8'); }
  function exportPlanCSV() { download('fukushu-sheet.csv',E.toCSV([['番号','単元','問題','解答','想定秒数','出題理由'],...current.questions.map((q,i)=>[i+1,q.topic,q.prompt,q.answer,q.seconds,q.due?'復習候補':'間隔内'])]),'text/csv;charset=utf-8'); }
  function printSheet(answers) {
    if(!current.questions.length) return notify('印刷する問題がありません');
    $('print-area').innerHTML=`<h1>復習つづり｜${answers?'解答・採点用':'問題用紙'}</h1><div class="printmeta"><span>実施日：${esc(state.asOf)}</span><span>${current.questions.length}問 / 約${(current.seconds/60).toFixed(1)}分</span>${answers?'':'<span>なまえ：________________</span>'}</div>`+
      current.questions.map((q,i)=>`<section class="pitem"><span class="pnum">${i+1}.</span>${esc(q.prompt)}${answers?`<p class="panswer">正答：${esc(q.answer)}</p>`:'<div class="blank"></div>'}</section>`).join('');
    window.print();
  }
  async function importJSON(file) {
    if(!file)return;
    try {
      if(file.size>2*1024*1024)throw Error('2MB以下のJSONを選択してください');
      const data=JSON.parse(await file.text()); const bank=E.validateBank(data.bank);
      const asOf=E.dateValid(data.asOf)?data.asOf:dateLocal();
      state={bank,chosenTopics:Array.isArray(data.chosenTopics)?data.chosenTopics.filter(x=>typeof x==='string'):[],
        planIds:Array.isArray(data.planIds)?data.planIds.filter(x=>typeof x==='string'):[],
        asOf,count:Math.max(1,Math.min(30,Number(data.count)||6)),minutes:Math.max(1,Math.min(120,Number(data.minutes)||10))};
      persist();clearForm();render();notify(`${bank.length}問を復元しました`);
    }catch(e){notify('読み込み中止：'+e.message);}finally{$('import-json').value='';}
  }
  function attach() {
    $('new-plan').addEventListener('click',replan);
    $('topic-filters').addEventListener('change', e => {if(!e.target.matches('.topic-check'))return;
      state.chosenTopics = [...$('topic-filters').querySelectorAll('.topic-check:checked')].map(x=>x.value);replan();});
    $('count').addEventListener('change',replan);$('minutes').addEventListener('change',replan);$('asof').addEventListener('change',replan);
    $('save-question').addEventListener('click',saveQuestion);$('cancel-edit').addEventListener('click',clearForm);
    $('bank-list').addEventListener('click',e=>{
      const btn=e.target.closest('button');if(!btn)return;
      if(btn.dataset.edit)edit(btn.dataset.edit);
      if(btn.dataset.remove){const id=btn.dataset.remove; state.bank=state.bank.filter(q=>q.id!==id);
        state.planIds=state.planIds.filter(x=>x!==id);replan();notify('問題を削除しました');}
    });
    $('search').addEventListener('input',renderBank);
    $('save-feedback').addEventListener('click',saveFeedback);
    $('export-json').addEventListener('click',exportJSON);$('export-csv').addEventListener('click',exportCSV);
    $('plan-csv').addEventListener('click',exportPlanCSV);
    $('print-questions').addEventListener('click',()=>printSheet(false));
    $('print-answers').addEventListener('click',()=>printSheet(true));
    $('import-json').addEventListener('change',e=>importJSON(e.target.files[0]));
    $('reset-demo').addEventListener('click',()=>{
      if(!confirm('問題バンクと集計を初期サンプルに戻します。よろしいですか？'))return;
      state={bank:E.sampleBank(),chosenTopics:['分数','国語','理科'],planIds:[],asOf:dateLocal(),count:6,minutes:10};clearForm();render();replan();notify('初期サンプルに戻しました');
    });
  }
  restore();attach();if(!state.planIds.length)replan();else render();
  window.fukushuDebug={getState:()=>JSON.parse(JSON.stringify(state)),replan}; // local debugging only
})();
