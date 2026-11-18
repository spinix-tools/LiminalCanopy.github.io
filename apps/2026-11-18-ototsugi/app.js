(() => {
'use strict';
const E=window.OtoEngine, STORAGE='oto-tsugi-v1', $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const classes={keep:'維持',relabel:'同種差替',new:'新規',remove:'取外し',rewire:'要差替',phantom:'48V要確認'};
let project,selected,analysis,toastTimer;
try{project=E.normalize(JSON.parse(localStorage.getItem(STORAGE)))}catch(_){project=E.sample();}
selected=project.acts[0]?.id||null;
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(project));}catch(_){notify('端末内の保存領域が使用できません。JSON保存をご利用ください。')}}
function notify(s){$('notice').textContent=s;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('notice').textContent='',4300)}
function update(){persist();render()}
function active(){return project.acts.find(x=>x.id===selected)}
function index(){return project.acts.findIndex(x=>x.id===selected)}
function editField(actId,inputId,field,val){const act=project.acts.find(a=>a.id===actId),input=act?.inputs.find(v=>v.id===inputId);if(input){input[field]=field==='lock'?Number(val)||0:field==='phantom'?!!val:val;update();}}
function render(){
  analysis=E.plan(project);
  $('show-title').value=project.title;$('capacity').value=project.capacity;
  const max=project.acts.reduce((n,a)=>Math.max(n,a.inputs.length),0);
  $('metric-acts').innerHTML=`<strong>${project.acts.length}</strong><span>出演組数</span>`;
  $('metric-inputs').innerHTML=`<strong>${max}<small> / ${project.capacity}</small></strong><span>最大入力数</span>`;
  $('metric-changes').innerHTML=`<strong>${analysis.issues.length?'!':analysis.transitions}</strong><span>転換操作（参考）</span>`;
  $('act-tabs').innerHTML=project.acts.map((a,i)=>`<button class="act-tab ${a.id===selected?'active':''}" data-action="select" data-id="${escape(a.id)}">${String(i+1).padStart(2,'0')} · ${escape(a.name)}</button>`).join('');
  const a=active();
  if(!a)$('act-editor').innerHTML='<div class="empty">出演枠を追加して計画を始めてください。</div>';
  else {
    const rows=a.inputs.map((inp,j)=>`<tr data-input="${escape(inp.id)}"><td><input aria-label="音源${j+1}" data-field="label" value="${escape(inp.label)}" maxlength="70"></td><td><select aria-label="分類${j+1}" data-field="family">${E.FAMILIES.map(f=>`<option ${inp.family===f?'selected':''}>${f}</option>`).join('')}</select></td><td><input aria-label="48V ${j+1}" data-field="phantom" type="checkbox" ${inp.phantom?'checked':''}></td><td><select aria-label="固定ch ${j+1}" data-field="lock"><option value="0">自動</option>${Array.from({length:project.capacity},(_,i)=>`<option value="${i+1}" ${inp.lock===i+1?'selected':''}>${i+1} ch</option>`).join('')}</select></td><td><button aria-label="入力を削除" data-action="del-input" data-id="${escape(inp.id)}" class="tiny-delete">×</button></td></tr>`).join('');
    $('act-editor').innerHTML=`<div class="act-head"><input class="act-name" id="act-name" aria-label="出演枠名" value="${escape(a.name)}" maxlength="70"><button data-action="up" class="ghost" title="順番を上へ" ${index()===0?'disabled':''}>↑</button><button data-action="down" class="ghost" title="順番を下へ" ${index()===project.acts.length-1?'disabled':''}>↓</button><button data-action="duplicate" class="ghost" title="複製">複製</button><button data-action="del-act" class="ghost warn" title="削除">削除</button></div>
    <div class="subheading"><strong>入力回線 ${a.inputs.length}本</strong><small>48Vと固定chは現場で要確認</small></div><div class="table-scroll"><table class="inputs-table"><thead><tr><th>音源ラベル</th><th>分類</th><th>48V</th><th>固定</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="act-buttons"><button data-action="add-input" class="primary">＋ 入力追加</button><button data-action="preset-vocal" class="ghost">＋ ボーカル</button><button data-action="preset-di" class="ghost">＋ DI</button></div>`;
  }
  $('order-suggestion').innerHTML='';
  const sug=E.suggestOrder(project);
  if(sug)$('order-suggestion').innerHTML=`<div class="proposal"><strong>出演順を変えられる場合の提案</strong><p>${sug.names.map(escape).join(' → ')}<br>参考スコア −${sug.saving}（音楽的な出演順や時間条件は考慮しません）</p><button data-action="apply-order" class="primary">提案順を適用</button></div>`;
  renderMatrix();renderChanges();
}
function renderMatrix(){
  const head=$('patch-table').querySelector('thead'),body=$('patch-table').querySelector('tbody');
  head.innerHTML=`<tr><th>CH</th>${analysis.steps.map((s,i)=>`<th>${i+1}. ${escape(s.act.name)}</th>`).join('')}</tr>`;
  body.innerHTML=Array.from({length:project.capacity},(_,i)=>`<tr><td>${String(i+1).padStart(2,'0')}</td>${analysis.steps.map((s,j)=>{
      if(!s.channels)return '<td class="status-phantom">—<small>割当不可</small></td>';
      const v=s.channels[i],before=j?analysis.steps[j-1]?.channels?.[i]:null,mode=j?E.transition(before,v).kind:(v?'new':'empty');
      return `<td class="status-${mode}">${v?escape(v.label):'—'}${v?`<small>${escape(v.family)} ${v.phantom?'· 48V ⚠':''} ${v.lock?'· 固定':''}</small>`:''}</td>`;
  }).join('')}</tr>`).join('');
  $('scoreline').innerHTML=`<span>概算スコア：<strong>${analysis.totalScore??'計算不可'}</strong>（小さいほど変更少／重みは独自基準）</span><span>空き回線：最大 ${Math.max(0,project.capacity-Math.max(0,...project.acts.map(a=>a.inputs.length)))}ch</span>`;
}
function renderChanges(){
  let html=analysis.issues.length?`<div class="alert">${analysis.issues.map(escape).join('<br>')}</div>`:'';
  const valid=analysis.steps.filter((s,i)=>i>0&&s.channels);
  if(!valid.length)html+='<div class="empty">2組以上の出演枠を登録すると、組間の変更点が表示されます。</div>';
  else html+='<div class="changes-grid">'+valid.map(s=>{
    let items=s.changes.map(c=>`<li class="${c.kind==='phantom'?'flag':''}">CH${String(c.ch).padStart(2,'0')}：${escape(c.from)} → ${escape(c.to)} <b>(${classes[c.kind]||c.kind})</b></li>`).join('');
    if(!items)items='<li>入力回線に変更はありません。</li>';
    return `<article class="change-card"><h3>${escape(s.act.name)} の転換<span>${s.changes.length}件 / 参考${s.score}点</span></h3><ul>${items}</ul></article>`;
  }).join('')+'</div>';
  html+='<p class="hint" style="margin-top:13px">※ 最初の組のパッチは仕込み扱いです。無音化、機器別48V操作、ステージ箱の結線、ケーブル経路、ミュート、ゲインとハウスルールは別途必ず確認してください。</p>';
  $('changeover-content').innerHTML=html;
}
function getNotes(){return analysis.steps.map((s,i)=>{
  if(!i)return `[仕込み] ${s.act.name}：入力 ${s.act.inputs.length}本`;
  if(!s.channels)return `[${s.act.name}] 割当不能`;
  return `[${s.act.name}] 変更 ${s.changes.length}件\n`+s.changes.map(c=>`CH${c.ch}: ${c.from} -> ${c.to} (${classes[c.kind]||c.kind})`).join('\n');
}).join('\n\n')+'\n\n※実際の結線・48V・ミュート操作は会場担当者の確認が必要です。';}
function download(name,content,mime){const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function nextId(){return E.uid()+Date.now().toString(36).slice(-3)}
$('show-title').addEventListener('change',e=>{project.title=e.target.value.trim()||'名称未設定';update()});
$('capacity').addEventListener('change',e=>{project.capacity=Number(e.target.value);update()});
$('act-editor').addEventListener('change',e=>{
  if(e.target.id==='act-name'){if(active())active().name=e.target.value.trim()||'無題';update();return;}
  const tr=e.target.closest('tr[data-input]');if(tr&&e.target.dataset.field)editField(selected,tr.dataset.input,e.target.dataset.field,e.target.type==='checkbox'?e.target.checked:e.target.value);
});
$('act-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-action=select]');if(b){selected=b.dataset.id;render()}});
$('act-editor').addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b)return;const a=active();if(!a)return;
  switch(b.dataset.action){
    case 'up':case 'down':{const i=index(),k=i+(b.dataset.action==='up'?-1:1);if(k<0||k>=project.acts.length)return;[project.acts[i],project.acts[k]]=[project.acts[k],project.acts[i]];break;}
    case 'duplicate':{if(project.acts.length>=12){notify('出演枠は12組までです');return;}const duplicate={id:nextId(),name:a.name+' コピー',inputs:a.inputs.map(v=>({...v,id:nextId()}))};project.acts.splice(index()+1,0,duplicate);selected=duplicate.id;break;}
    case 'del-act':{if(!window.confirm('この出演枠を削除しますか？'))return;project.acts.splice(index(),1);selected=project.acts[0]?.id||null;break;}
    case 'del-input':{a.inputs=a.inputs.filter(v=>v.id!==b.dataset.id);break;}
    case 'add-input':case 'preset-vocal':case 'preset-di':{if(a.inputs.length>=32){notify('1組32入力までです');return;}const special=b.dataset.action;const tpl=special==='preset-vocal'?{label:'Vocal',family:'Vocal',phantom:false}:special==='preset-di'?{label:'DI',family:'Bass',phantom:true}:{label:'Input '+(a.inputs.length+1),family:'Other',phantom:false};a.inputs.push({id:nextId(),...tpl,lock:0});break;}
  }update();
});
$('add-act').addEventListener('click',()=>{if(project.acts.length>=12){notify('出演枠は12組までです');return;}const a={id:nextId(),name:`出演 ${project.acts.length+1}`,inputs:[]};project.acts.push(a);selected=a.id;update()});
$('order-suggestion').addEventListener('click',e=>{if(e.target.dataset.action!=='apply-order')return;const sug=E.suggestOrder(project);if(!sug)return;project.acts.sort((a,b)=>sug.order.indexOf(a.id)-sug.order.indexOf(b.id));update();notify('出演順を更新しました')});
$('save-file').addEventListener('click',()=>download('oto-tsugi-project.json',JSON.stringify(project,null,2),'application/json'));
$('csv-file').addEventListener('click',()=>{if(analysis.issues.length){notify('割当エラーを直してからCSV出力してください');return;}download('oto-tsugi-patch.csv',E.csv(analysis),'text/csv;charset=utf-8')});
$('print-file').addEventListener('click',()=>window.print());
$('copy-notes').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(getNotes());notify('転換メモをコピーしました')}catch(_){download('oto-tsugi-notes.txt',getNotes(),'text/plain');notify('テキストファイルで保存しました')}});
$('load-file').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1e6)throw Error('1MB以下のJSONを指定してください');const next=E.normalize(JSON.parse(await file.text()));project=next;selected=project.acts[0]?.id||null;update();notify('JSONを読み込みました')}catch(err){notify('読込失敗: '+err.message)}e.target.value=''});
$('sample').addEventListener('click',()=>{if(!window.confirm('現在の計画をサンプルで置き換えますか？'))return;project=E.sample();selected=project.acts[0].id;update()});
$('new-project').addEventListener('click',()=>{if(!window.confirm('現在の計画を空の状態にしますか？'))return;project={title:'新しい公演',capacity:16,acts:[]};selected=null;update()});
render();
})();
