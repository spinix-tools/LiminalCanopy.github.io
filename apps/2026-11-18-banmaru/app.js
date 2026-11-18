/* BANMARU UI — runs entirely on the user's device */
(() => {
  'use strict';
  const E = window.BANMARU;
  const $ = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const STORAGE = 'banmaru-settings-v1';
  const demo = () => ({version:1, minGap:2, seed:1627,
    members:[
      {id:'P01',name:'メンバー01',roles:'*',unavailable:'2026-12-12',past:2,max:2},
      {id:'P02',name:'メンバー02',roles:'見守り,受付',unavailable:'2026-12-19',past:0,max:3},
      {id:'P03',name:'メンバー03',roles:'*',unavailable:'',past:1,max:2},
      {id:'P04',name:'メンバー04',roles:'設営,受付',unavailable:'2026-12-05',past:0,max:3},
      {id:'P05',name:'メンバー05',roles:'*',unavailable:'2026-12-26',past:2,max:2},
      {id:'P06',name:'メンバー06',roles:'見守り,設営',unavailable:'',past:0,max:3},
      {id:'P07',name:'メンバー07',roles:'*',unavailable:'',past:1,max:2},
      {id:'P08',name:'メンバー08',roles:'*',unavailable:'2026-12-05',past:0,max:3}
    ],
    shifts:[
      {id:'S01',date:'2026-12-05',title:'冬の見守り',role:'見守り',need:2,locked:'P01'},
      {id:'S02',date:'2026-12-05',title:'会場準備',role:'設営',need:2,locked:''},
      {id:'S03',date:'2026-12-12',title:'冬の見守り',role:'見守り',need:2,locked:''},
      {id:'S04',date:'2026-12-19',title:'地域バザー',role:'受付',need:2,locked:''},
      {id:'S05',date:'2026-12-19',title:'会場準備',role:'設営',need:2,locked:''},
      {id:'S06',date:'2026-12-26',title:'冬の見守り',role:'見守り',need:2,locked:''}
    ]
  });
  function loadStored(){try {const raw=localStorage.getItem(STORAGE);if(raw){const s=JSON.parse(raw);E.normalize(s);return s;}} catch(e) {} return demo();}
  let data=loadStored(), result=null;
  function persist(){try {localStorage.setItem(STORAGE,JSON.stringify(data));}catch(e) { /* storage disabled in some browsers */ }}
  function warn(msg){$('error').hidden=!msg;$('error').textContent=msg||'';}
  function cell(type,value,field,i,label,kind='member',cls='') {return `<input aria-label="${safe(label)}" type="${type}" class="${cls}" data-kind="${kind}" data-row="${i}" data-field="${field}" value="${safe(value)}" ${type==='number'?'min="0" max="100" step="1"':''}>`;}
  function renderMembers(){
    $('memberCount').textContent=`${data.members.length}名`;
    $('memberRows').innerHTML=data.members.map((m,i)=>`<tr><td><span class="idtag">${safe(m.id)}</span>${cell('text',m.name,'name',i,`${m.id} 表示名`,'member','namefield')}</td><td>${cell('text',m.roles,'roles',i,`${m.id} 対応役割`,'member','rolecell')}</td><td>${cell('text',m.unavailable,'unavailable',i,`${m.id} 不可日`,'member','datecell')}</td><td>${cell('number',m.past,'past',i,`${m.id} 過去回数`,'member','smallcell')}</td><td>${cell('number',m.max,'max',i,`${m.id} 今回上限`,'member','smallcell')}</td><td><button class="xbutton" data-remove="member" data-row="${i}" aria-label="${safe(m.id)}を削除">×</button></td></tr>`).join('');
  }
  function renderShifts(){
    $('shiftCount').textContent=`${data.shifts.length}枠`;
    $('shiftRows').innerHTML=data.shifts.map((s,i)=>`<tr><td>${cell('date',s.date,'date',i,`枠${i+1} 日付`,'shift','datecell')}${cell('text',s.title,'title',i,`枠${i+1} 活動名`,'shift')}</td><td>${cell('text',s.role,'role',i,`枠${i+1} 役割`,'shift','rolecell')}</td><td>${cell('number',s.need,'need',i,`枠${i+1} 必要人数`,'shift','smallcell')}</td><td>${cell('text',s.locked,'locked',i,`枠${i+1} 固定ID`,'shift','rolecell')}</td><td><button class="xbutton" data-remove="shift" data-row="${i}" aria-label="枠${i+1}を削除">×</button></td></tr>`).join('');
  }
  function updateSelect(){
    const selection=$('exclude').value;
    $('exclude').innerHTML='<option value="">欠席する人を選択</option>'+data.members.map(m=>`<option value="${safe(m.id)}">${safe(m.name)} (${safe(m.id)})</option>`).join('');
    if(data.members.some(m=>m.id===selection)) $('exclude').value=selection;
  }
  function renderForm(){
    $('gapText').textContent=`${data.minGap}日`;
    $('seed').value=data.seed;
    renderMembers();renderShifts();updateSelect();persist();
  }
  function receiveEdit(e) {
    const t=e.target;
    if(t.dataset?.kind){
      const key=t.dataset.kind==='member'?'members':'shifts';
      const item=data[key][Number(t.dataset.row)];if(!item)return;
      item[t.dataset.field]=t.value;
      persist();warn('');
    }
  }
  function makePlan(scroll=false){
    data.seed=Number($('seed').value);
    try {
      result=E.solve(data,{seed:data.seed});
      warn('');renderResult(result);persist();
      if(scroll) $('results').scrollIntoView({behavior:'smooth',block:'start'});
    } catch(e) {result=null;warn(e.message);$('filled').textContent='—';$('missing').textContent='—';$('spread').textContent='—';$('roster').innerHTML='<div class="empty">入力内容を確認すると当番表が表示されます。</div>';}
  }
  function renderResult(r){
    $('filled').textContent=`${r.filled} / ${r.totalSlots}`;
    $('missing').textContent=String(r.missing);
    $('fillRate').textContent=`${Math.round(100*r.filled/Math.max(1,r.totalSlots))}%`;
    $('fillBar').style.width=`${100*r.filled/Math.max(1,r.totalSlots)}%`;
    $('statusLine').textContent=r.missing?'不足はオレンジ色で表示します':'すべての枠が埋まりました';
    const loads=r.loads.filter(m=>m.id!==r.excluded);
    const vals=loads.map(m=>m.total);
    $('spread').textContent=String(Math.max(...vals,0)-Math.min(...vals,0));
    $('roster').innerHTML=r.plan.map(s=>`<div class="rosterrow"><div class="datebox">${safe(s.date.slice(5).replace('-',' / '))}<small>${safe(s.title)}</small></div><div><div class="rowtitle">${safe(s.role)} <span class="idtag" style="display:inline">${s.assigned.length} / ${s.need}名</span></div><div class="pills">${s.assigned.map(id=>{const m=r.members.find(m=>m.id===id);return `<span class="pill ${s.locked.includes(id)?'fixed':''}" title="${safe(id)}">${safe(m?.name??id)}</span>`}).join('')}${s.missing?`<span class="pill missing">あと ${s.missing}名 必要</span>`:''}</div></div></div>`).join('');
    const upper=Math.max(...r.loads.map(m=>m.total),1);
    $('loadBars').innerHTML='<div class="barlegend"><span><i></i> 過去</span><span><i class="new"></i> 今回</span></div>'+r.loads.map(m=>`<div class="loadrow"><span class="loadname" title="${safe(m.id)}">${safe(m.name)}</span><div class="loadtrack"><div class="loadpast" style="width:${100*m.past/upper}%"></div><div class="loadcurrent" style="width:${100*m.current/upper}%"></div></div><span class="loadnumber">${m.past}+${m.current}</span></div>`).join('');
    $('whatifResult').textContent='欠席者を選ぶと比較結果が出ます。';
    updateSelect();
  }
  function simulate(){
    if(!result){warn('先に当番表を作成してください');return;}
    const id=$('exclude').value;
    if(!id){$('whatifResult').textContent='欠席者を選んでください。';return;}
    try {
      const after=E.solve(data,{seed:Number(data.seed),excluded:id});
      const previous=result;
      const worse=after.plan.filter((s,i)=>s.missing>previous.plan[i].missing).map(s=>`${s.date.slice(5)} ${s.role}`);
      const name=data.members.find(m=>m.id===id)?.name||id;
      $('whatifResult').innerHTML=`<b>${safe(name)} を除いた場合</b><br>充足数：${previous.filled} → <strong>${after.filled} / ${after.totalSlots}</strong><br>不足枠：${previous.missing} → <strong>${after.missing}</strong>${worse.length?`<br>新しく不足が増える枠：${worse.map(safe).join('、')}`:'<br>新たに不足が増える枠はありません。'}`;
    } catch(e) {$('whatifResult').textContent=e.message;}
  }
  function download(filename, text, mime){
    const blob=new Blob([text],{type:mime});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  document.body.addEventListener('input',receiveEdit);
  document.body.addEventListener('click',e=>{
    const b=e.target.closest('button[data-remove]');if(!b)return;
    const key=b.dataset.remove==='member'?'members':'shifts';
    data[key].splice(Number(b.dataset.row),1);renderForm();makePlan();
  });
  $('addMember').addEventListener('click',()=>{
    if(data.members.length>=40){warn('メンバーは最大40名です');return;}
    const used=new Set(data.members.map(m=>m.id));let n=1;while(used.has(`P${String(n).padStart(2,'0')}`)) n++;
    data.members.push({id:`P${String(n).padStart(2,'0')}`,name:`メンバー${String(n).padStart(2,'0')}`,roles:'*',unavailable:'',past:0,max:2});renderForm();
  });
  $('addShift').addEventListener('click',()=>{
    if(data.shifts.length>=60){warn('当番枠は最大60件です');return;}
    const used=new Set(data.shifts.map(s=>s.id));let n=1;while(used.has(`S${String(n).padStart(2,'0')}`))n++;
    const date=data.shifts.at(-1)?.date||'2026-12-05';
    data.shifts.push({id:`S${String(n).padStart(2,'0')}`,date,title:'新しい当番',role:'見守り',need:1,locked:''});renderForm();
  });
  $('gapMinus').onclick=()=>{data.minGap=Math.max(0,Number(data.minGap)-1);renderForm();};
  $('gapPlus').onclick=()=>{data.minGap=Math.min(14,Number(data.minGap)+1);renderForm();};
  $('seed').addEventListener('input',()=>{data.seed=$('seed').value;persist();});
  $('generate').onclick=()=>makePlan(true);
  $('generateHero').onclick=()=>makePlan(true);
  $('simulate').onclick=simulate;
  $('exportCsv').onclick=()=>{if(!result){warn('先に計算してください');return;}download('banmaru-roster.csv',E.csv(result),'text/csv;charset=utf-8');};
  $('save').onclick=()=>{try{E.normalize(data);download('banmaru-settings.json',JSON.stringify({...data,version:1},null,2),'application/json;charset=utf-8');warn('');}catch(e){warn(e.message);}};
  $('load').onclick=()=>$('loadFile').click();
  $('loadFile').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try{if(file.size>300000)throw Error('JSONファイルは300KB以下にしてください');const incoming=JSON.parse(await file.text());E.normalize(incoming);data={...incoming,seed:incoming.seed||1627};renderForm();makePlan();warn('');}
    catch(err){warn(`読込できませんでした：${err.message}`);}finally{e.target.value='';}
  });
  $('print').onclick=()=>{if(!result){warn('先に計算してください');return;}window.print();};
  $('reset').onclick=()=>{if(!window.confirm('現在の設定をサンプルに戻しますか？'))return;data=demo();renderForm();makePlan();};
  renderForm();makePlan();
})();