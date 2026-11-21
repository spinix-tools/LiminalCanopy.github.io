/* SASHIKAE ROOM UI - no network calls or third-party dependencies. */
(() => {
  'use strict';
  const E = globalThis.SashikaeEngine;
  const byId = id => document.getElementById(id);
  const OLD = `# 第一場・開場前\n葵：開演は明日の七時です。\n渚：明日なら、まだ準備ができますね。\n葵：客席の照明を確認して。\n渚：分かりました。\n（渚、舞台袖へ向かう）\n葵：このポスターは壁に貼ります。\n\n# 第二場・幕間\n渚：お客様をこちらへご案内します。\n葵：少し待ってください。\n渚：はい、待ちます。`;
  const NEW = `# 第一場・開場前\n葵：開演は今夜の七時です。\n渚：明日なら、まだ準備ができますね。\n葵：客席の照明と非常口を確認して。\n渚：分かりました。\n（渚、舞台袖へ急ぐ）\n葵：このポスターは壁に貼ります。\n葵：受付の案内も並べてください。\n\n# 第二場・幕間\n渚：お客様をこちらへご案内します。\n葵：少し待ってください。`;
  const KEY = 'sashikae-room.v1';
  let report = null, role = 'ALL';
  function node(tag, cls, text) {
    const e=document.createElement(tag);
    if (cls) e.className=cls;
    if (text !== undefined && text !== null) e.textContent=String(text);
    return e;
  }
  function say(msg, isError=false) {const n=byId('notice');n.textContent=msg;n.className='notice'+(isError?' error':'');}
  function getProject(){return {schema:1,title:'差し替え照合室',old:byId('oldDraft').value,new:byId('newDraft').value};}
  function setProject(project) {
    if(!project || project.schema!==1 || typeof project.old!=='string' || typeof project.new!=='string') throw Error('非対応のJSON形式です（schema: 1、old/new文字列が必要）');
    byId('oldDraft').value=project.old;
    byId('newDraft').value=project.new;
    updateCounts();
    perform(false);
  }
  function updateCounts() {
    for(const id of ['old','new']){
      const value=byId(id+'Draft').value.trim();
      byId(id+'Count').textContent=(value?value.split(/\r?\n/).filter(x=>x.trim()&&!/^\s*#/.test(x)).length:0)+' 行 · '+value.length.toLocaleString('ja-JP')+' 字';
    }
  }
  function download(filename,text,type) {
    const url=URL.createObjectURL(new Blob([text],{type}));
    const a=node('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const lineText = x => x ? (x.kind==='dialogue'?x.speaker+'：':'')+x.text : '—';
  function sceneLine(type, obj) {
    const cell=node('div','line-box '+type), cap=node('small','',type==='old'?'旧稿 / BEFORE':'新稿 / AFTER');
    cell.append(cap,node('p','',lineText(obj)));
    return cell;
  }
  function renderChanges(rows) {
    const list=byId('changeList');list.replaceChildren();
    byId('changeTotal').textContent=rows.length;
    if(!rows.length){list.append(node('div','empty','この役の直接的な変更はありません。'));return;}
    for(const c of rows) {
      const card=node('article','change-card');
      const top=node('div','card-top');
      top.append(node('span','chip '+c.type,({change:'書き換え',add:'追加',delete:'削除'})[c.type]));
      top.append(node('small','',c.scene+' / '+c.role));
      const pair=node('div','line-pair');pair.append(sceneLine('old',c.old),sceneLine('new',c.now));
      card.append(top,pair);list.append(card);
    }
  }
  function renderCues(rows) {
    const list=byId('cueList');list.replaceChildren();
    byId('cueTotal').textContent=rows.length;
    if(!rows.length){list.append(node('div','empty','この役の受け確認候補はありません。'));return;}
    for(const c of rows) {
      const card=node('article','cue-card');
      card.append(node('strong','',c.scene+' · '+c.role+'の受け確認'));
      card.append(node('p','', '旧・前台詞：'+lineText(c.oldCue)));
      card.append(node('p','', '新・前台詞：'+lineText(c.newCue)));
      card.append(node('p','response','続く台詞（文面は同じ）：'+lineText(c.response)));
      list.append(card);
    }
  }
  function setRole(next) {
    role=next;
    for(const b of byId('roleFilters').querySelectorAll('button')) b.setAttribute('aria-pressed',String(b.dataset.role===next));
    if(!report)return;
    const view=E.filter(report,role);
    renderChanges(view.changes);renderCues(view.cues);
    byId('reportDesc').textContent=(role==='ALL'?'全役':role+' 担当')+'の確認票 · '+view.changes.length+'件の変更 / '+view.cues.length+'件の受け確認';
  }
  function renderReport() {
    byId('mChange').textContent=report.counts.change;
    byId('mAdd').textContent=report.counts.add;
    byId('mDelete').textContent=report.counts.delete;
    byId('mCue').textContent=report.cues.length;
    const box=byId('roleFilters');box.replaceChildren();
    for(const item of ['ALL',...report.roles]) {
      const button=node('button','role-button',item==='ALL'?'すべての役':item);
      button.type='button';button.dataset.role=item;
      button.setAttribute('aria-pressed',String(item===role));
      button.addEventListener('click',()=>setRole(item));box.append(button);
    }
    if(role!=='ALL'&&!report.roles.includes(role))role='ALL';
    setRole(role);
  }
  function perform(scroll=false) {
    try{
      report=E.compare(byId('oldDraft').value,byId('newDraft').value);
      renderReport();
      say('照合しました。変更'+report.changes.length+'件、受け確認候補'+report.cues.length+'件。');
      if(scroll)byId('report').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(err){say('入力を確認してください：'+err.message,true);}
  }
  async function importPlain(input,target) {
    const file=input.files?.[0];if(!file)return;
    try{
      if(file.size>200000)throw Error('テキストファイルは200KB以下にしてください');
      target.value=await file.text();updateCounts();perform(false);say(file.name+' を読み込みました。');
    }catch(err){say(err.message,true);}finally{input.value='';}
  }
  async function importJSON(input) {
    const file=input.files?.[0];if(!file)return;
    try{
      if(file.size>400000)throw Error('JSONファイルは400KB以下にしてください');
      const project=JSON.parse(await file.text());setProject(project);say('保存した台本を復元しました。');
    }catch(err){say('読み込みできません：'+err.message,true);}finally{input.value='';}
  }
  function init() {
    byId('oldDraft').addEventListener('input',updateCounts);
    byId('newDraft').addEventListener('input',updateCounts);
    byId('oldFile').addEventListener('change',e=>importPlain(e.target,byId('oldDraft')));
    byId('newFile').addEventListener('change',e=>importPlain(e.target,byId('newDraft')));
    byId('jsonInput').addEventListener('change',e=>importJSON(e.target));
    byId('compareBtn').addEventListener('click',()=>perform(true));
    byId('csvBtn').addEventListener('click',()=>{if(!report)return;download('sashikae-report.csv',E.buildCSV(report,role),'text/csv;charset=utf-8');say('絞り込み中の確認票をCSVに出力しました。');});
    byId('jsonBtn').addEventListener('click',()=>{download('sashikae-project.json',JSON.stringify(getProject(),null,2),'application/json;charset=utf-8');say('JSONを書き出しました。');});
    byId('printBtn').addEventListener('click',()=>window.print());
    byId('saveBtn').addEventListener('click',()=>{try{localStorage.setItem(KEY,JSON.stringify(getProject()));say('この端末のブラウザに保存しました。');}catch(err){say('保存できません：'+err.message,true);}});
    byId('sampleBtn').addEventListener('click',()=>{if(!confirm('現在の入力をサンプルで置き換えますか？'))return;setProject({schema:1,old:OLD,new:NEW});say('サンプルを復元しました。');});
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();perform(true);}});
    try{const raw=localStorage.getItem(KEY);if(raw)setProject(JSON.parse(raw));else setProject({schema:1,old:OLD,new:NEW});}
    catch(err){setProject({schema:1,old:OLD,new:NEW});say('保存情報を読み込めなかったため、サンプルを表示しています。');}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
