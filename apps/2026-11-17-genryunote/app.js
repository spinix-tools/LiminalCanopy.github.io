/* GENRYU NOTE — local-only interactive UI. */
(() => {
  'use strict';
  const E = window.GenryuEngine;
  if (!E) { document.body.textContent = '読み込みに失敗しました。engine.jsを確認してください。'; return; }
  const KEY = 'genryu-note-v1';
  const $ = id => document.getElementById(id);
  const statuses = { unresolved:'未判定', reviewing:'検証中', decided:'手動判定済み' };
  const stances = { support:'支持', refute:'反証', context:'参考', mixed:'支持・反証が混在' };
  const origins = { original:'独立起点（暫定）', derived:'引用・転載', unknown:'出所不明' };
  const state = { model: E.blank(), mode:'', editId:'', saved:true };
  let toastTimer;

  function el(tag, cls, value) {
    const out = document.createElement(tag);
    if (cls) out.className = cls;
    if (value != null) out.textContent = String(value);
    return out;
  }
  function button(text, className, handler) {
    const out = el('button', className || 'tiny', text);
    out.type = 'button'; out.addEventListener('click', handler);
    return out;
  }
  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 4100);
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state.model = E.validateModel(JSON.parse(raw));
    } catch (err) {
      state.model = E.blank(); state.saved = false;
      $('save-state').textContent = '保存データを読み込めませんでした。JSONバックアップがあれば復元してください。';
      toast('保存内容の読み込みに失敗しました: ' + err.message);
    }
    render();
  }
  function persist(model) {
    state.model = E.validateModel(model);
    try {
      localStorage.setItem(KEY, JSON.stringify(state.model));
      state.saved = true;
      $('save-state').textContent = 'このブラウザに保存中 · 外部への送信なし';
    } catch {
      state.saved = false;
      $('save-state').textContent = 'ブラウザへの保存不可 · 今回限りの表示です。JSONをダウンロードしてください。';
      toast('端末に保存できません。JSONバックアップをご利用ください。');
    }
    render();
  }
  function id(prefix) {
    const r = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g,'') :
      `${Date.now().toString(36)}${Math.random().toString(36).slice(2,10)}`;
    return `${prefix}-${r}`;
  }
  function render() {
    const model = state.model;
    const list = $('claims'); list.replaceChildren();
    if (!model.claims.length) list.append(el('p','empty-message','論点がまだありません。'));
    for (const c of model.claims) {
      const b = button('', 'claim-card' + (c.id === model.activeClaimId ? ' active' : ''), () => persist({ ...model,activeClaimId:c.id }));
      b.append(el('b','',c.title),el('small','',`${statuses[c.status]} · ${model.sources.filter(s=>s.claimId===c.id).length}資料`));
      if (c.id === model.activeClaimId) b.setAttribute('aria-current','true');
      list.append(b);
    }
    const claim = model.claims.find(c => c.id === model.activeClaimId);
    $('details').classList.toggle('hidden',!claim); $('empty').classList.toggle('hidden',!!claim);
    if (!claim) return;
    $('claim-title').textContent = claim.title;
    $('claim-status').textContent = statuses[claim.status];
    $('claim-note').textContent = claim.note || '補足メモはありません。';
    const a = E.analyze(model, claim.id), metrics = $('metrics'); metrics.replaceChildren();
    for (const [n,label,cls] of [
      [a.total,'登録資料',''],[a.rootCount,'独立起点として記録','highlight'],
      [a.support,'支持のみの起点',''],[a.unknownCount,'出所未確認の資料','warning']
    ]) { const d = el('div','metric '+cls); d.append(el('div','num',n),el('div','lab',label)); metrics.append(d); }
    const familyWrap = $('families'); familyWrap.replaceChildren();
    if (!a.families.length) familyWrap.append(el('p','empty-inline','独立起点として登録された系統はありません。資料を追加してください。'));
    for (const family of a.families) {
      const wrap = el('div','family'); const head = el('div','family-header'); const side = el('div');
      side.append(el('strong','',family.root.title),el('div','family-count',`${family.sources.length}資料 · ひとつの起点として集計`));
      head.append(side,el('span','tag '+family.stance,stances[family.stance]));wrap.append(head);
      for(const item of family.sources) wrap.append(sourceRow(item.source,item.chain.length - 1));
      familyWrap.append(wrap);
    }
    const unknown = $('unknown'); unknown.replaceChildren();
    if(!a.unknown.length) unknown.append(el('p','empty-inline','出所不明の資料はありません。'));
    for (const item of a.unknown) unknown.append(sourceRow(item.source,0));
  }
  function sourceRow(s,depth) {
    const row=el('div','record'); const body=el('div','record-body');
    const line=el('div',depth ? 'indent':'');
    const label=el('div');label.append(el('b','',s.title),el('small','',`${origins[s.origin]} · ${stances[s.stance]}${depth?' · 引用の深さ '+depth:''}`));
    line.append(label);
    if(s.note) line.append(el('p','record-details',s.note));
    if(s.url) { const anchor=el('a','a-link','元ページを開く');anchor.href=s.url;anchor.rel='noopener noreferrer';anchor.target='_blank';line.append(anchor); }
    body.append(line);
    const actions=el('div','record-actions');
    actions.append(button('編集','tiny',()=>openEditor('source',s.id)),button('削除','tiny delete',()=>{
      if(!confirm(`「${s.title}」を削除しますか？\n直接引用していた資料は「出所不明」に変わります。`))return;
      persist(E.detachChildren(state.model,s.id));toast('資料を削除しました。');
    }));
    row.append(body,actions);return row;
  }
  function field(label,id,type,options) {
    const div=el('div','field'), lab=el('label','label',label);lab.htmlFor=id;
    let inp;
    if(type==='textarea'){inp=el('textarea','control');inp.rows=3;}
    else if(type==='select'){
      inp=el('select','control');
      for(const opt of options || []) {const o=el('option','',opt[1]);o.value=opt[0];inp.append(o);}
    } else {inp=el('input','control');inp.type=type||'text';}
    inp.id=id;div.append(lab,inp);return div;
  }
  function fieldsClaim(c) {
    const container=el('div');
    const f=field('調べたい主張・論点 *','f-title','text');f.querySelector('input').maxLength=140;
    container.append(f,field('作業段階','f-status','select',Object.entries(statuses)),field('補足メモ','f-note','textarea'));
    container.querySelector('#f-title').value=c?.title||'';
    container.querySelector('#f-status').value=c?.status||'unresolved';
    container.querySelector('#f-note').value=c?.note||'';
    return container;
  }
  function fieldsSource(s) {
    const container=el('div');
    const f=field('資料名・出典の識別名 *','f-title','text');f.querySelector('input').maxLength=140;
    container.append(f,field('資料URL（任意・http/https）','f-url','url'));
    const grid=el('div','form-grid');
    grid.append(field('この論点への立場','f-stance','select',Object.entries(stances).filter(x=>x[0]!=='mixed')),
      field('出所の分類','f-origin','select',Object.entries(origins)));
    container.append(grid);
    const thisClaim=state.model.activeClaimId;
    // Parent candidates exclude the edited source and all of its descendants.
    const sourceList=state.model.sources.filter(x=>x.claimId===thisClaim);
    const excluded=new Set(s ? [s.id] : []);
    if(s){let changed=true;while(changed){changed=false;for(const x of sourceList)if(x.parentId&&excluded.has(x.parentId)&&!excluded.has(x.id)){excluded.add(x.id);changed=true;}}}
    const options=[['','引用元を選択']].concat(sourceList.filter(x=>!excluded.has(x.id)).map(x=>[x.id,x.title]));
    container.append(field('直接の引用元（「引用・転載」の場合は必須）','f-parent','select',options),
      field('本文根拠・注記（任意）','f-note','textarea'));
    const hint=el('p','input-hint','「独立起点」は自己申告の分類です。出所を確認できなければ「出所不明」にしてください。');container.append(hint);
    container.querySelector('#f-title').value=s?.title||'';
    container.querySelector('#f-url').value=s?.url||'';
    container.querySelector('#f-origin').value=s?.origin||'unknown';
    container.querySelector('#f-stance').value=s?.stance||'context';
    container.querySelector('#f-parent').value=s?.parentId||'';
    container.querySelector('#f-note').value=s?.note||'';
    const updateParent=()=>{
      const derived=container.querySelector('#f-origin').value==='derived';
      const parent=container.querySelector('#f-parent');parent.disabled=!derived;
      if(!derived) parent.value='';
    };
    container.querySelector('#f-origin').addEventListener('change',updateParent);
    updateParent();return container;
  }
  function openEditor(mode, editId='') {
    state.mode=mode;state.editId=editId;
    const found= mode==='claim' ? state.model.claims.find(x=>x.id===editId) : state.model.sources.find(x=>x.id===editId);
    $('editor-title').textContent=(editId?'編集':'新規登録')+(mode==='claim'?' · 論点':' · 資料');
    $('editor-fields').replaceChildren(mode==='claim'?fieldsClaim(found):fieldsSource(found));
    $('editor-error').classList.add('hidden');
    $('editor').showModal();
    $('f-title')?.focus();
  }
  function saveEditor(e) {
    e.preventDefault();
    try {
      const m=state.model, t=$('f-title').value.trim();
      if(!t) throw Error('名称を入力してください。');
      if(state.mode==='claim'){
        const claim={id:state.editId||id('c'),title:t,status:$('f-status').value,note:$('f-note').value};
        const claims=state.editId?m.claims.map(x=>x.id===state.editId?claim:x):[...m.claims,claim];
        persist({...m,claims,activeClaimId:claim.id});
      } else {
        const source={id:state.editId||id('s'),claimId:m.activeClaimId,title:t,url:$('f-url').value.trim(),
          origin:$('f-origin').value, stance:$('f-stance').value,
          parentId:$('f-origin').value==='derived'?$('f-parent').value:'',note:$('f-note').value};
        const sources=state.editId?m.sources.map(x=>x.id===state.editId?source:x):[...m.sources,source];
        persist({...m,sources});
      }
      $('editor').close();toast('記録を更新しました。');
    } catch (err) {
      $('editor-error').textContent=err.message;
      $('editor-error').classList.remove('hidden');
    }
  }
  function downloadable(name,text,mime) {
    const blob=new Blob([text],{type:mime}); const url=URL.createObjectURL(blob);
    const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),700);
  }
  async function copyText(content) {
    try { if(!navigator.clipboard || !navigator.clipboard.writeText) throw Error('clipboard unavailable'); await navigator.clipboard.writeText(content);toast('点検メモをコピーしました。'); }
    catch { const t=el('textarea');t.value=content;t.style.position='fixed';t.style.left='-9999px';document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();toast(ok?'点検メモをコピーしました。':'コピーできませんでした。Markdown保存をご利用ください。'); }
  }
  function currentReport() {return E.markdown(state.model,state.model.activeClaimId);}
  function wire() {
    $('add-claim').addEventListener('click',()=>openEditor('claim'));
    $('empty-add').addEventListener('click',()=>openEditor('claim'));
    $('add-source').addEventListener('click',()=>openEditor('source'));
    $('edit-claim').addEventListener('click',()=>openEditor('claim',state.model.activeClaimId));
    $('delete-claim').addEventListener('click',()=>{
      const c=state.model.claims.find(x=>x.id===state.model.activeClaimId);
      if(!c||!confirm(`論点「${c.title}」と関連資料をすべて削除しますか？`)) return;
      const claims=state.model.claims.filter(x=>x.id!==c.id);
      persist({...state.model,claims,sources:state.model.sources.filter(x=>x.claimId!==c.id),activeClaimId:claims[0]?.id||''});
      toast('論点を削除しました。');
    });
    $('editor-close').addEventListener('click',()=>$('editor').close());
    $('editor-cancel').addEventListener('click',()=>$('editor').close());
    $('edit-form').addEventListener('submit',saveEditor);
    $('load-demo').addEventListener('click',()=>{
      if((state.model.claims.length||state.model.sources.length)&&!confirm('現在の記録を架空データで置き換えますか？必要なら先にJSON保存してください。'))return;
      persist(E.demo());toast('架空データを読み込みました。');
    });
    $('reset-all').addEventListener('click',()=>{
      if(!confirm('記録をすべて消去します。取り消せません。続けますか？'))return;
      persist(E.blank());toast('すべて消去しました。');
    });
    $('export-json').addEventListener('click',()=>downloadable('genryu-note-backup.json',JSON.stringify(state.model,null,2),'application/json;charset=utf-8'));
    $('import-trigger').addEventListener('click',()=>$('import-file').click());
    $('import-file').addEventListener('change',async event=>{
      const file=event.target.files?.[0];event.target.value='';if(!file)return;
      if(file.size>2*1024*1024){toast('2MB以下のJSONを選択してください。');return;}
      try{const parsed=E.validateModel(JSON.parse(await file.text()));
        if((state.model.claims.length||state.model.sources.length)&&!confirm('現在の記録をJSONの内容で上書きしますか？'))return;
        persist(parsed);toast('JSONバックアップを復元しました。');
      }catch(err){toast('読み込みに失敗: '+err.message);}
    });
    $('copy-report').addEventListener('click',()=>copyText(currentReport()));
    $('download-report').addEventListener('click',()=>downloadable('genryu-note-report.md',currentReport(),'text/markdown;charset=utf-8'));
  }
  wire();load();
  window.__GENRYU_TEST__={state,render};
})();
