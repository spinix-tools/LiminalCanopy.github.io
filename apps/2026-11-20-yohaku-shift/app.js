/* YOHAKU SHIFT browser UI — all processing is local */
(() => {
'use strict';
const E=window.YohakuEngine;
const $=sel=>document.querySelector(sel);
const sample={
 eventName:'川辺マルシェのお手伝い',eventDate:'2026-12-06',rest:15,
 people:[
  {id:'p1',name:'Aさん',roles:'受付,案内',available:'09:00-12:00,13:00-16:30',maxMinutes:240},
  {id:'p2',name:'Bさん',roles:'受付,物販',available:'09:00-17:00',maxMinutes:240},
  {id:'p3',name:'Cさん',roles:'案内,物販',available:'09:00-13:00',maxMinutes:180},
  {id:'p4',name:'Dさん',roles:'*',available:'10:00-16:30',maxMinutes:240},
  {id:'p5',name:'Eさん',roles:'受付,案内',available:'09:00-11:30,12:30-17:00',maxMinutes:240},
  {id:'p6',name:'Fさん',roles:'物販,案内',available:'10:30-17:00',maxMinutes:240},
  {id:'p7',name:'Gさん',roles:'受付',available:'09:00-13:00',maxMinutes:180},
 ],
 shifts:[
  {id:'s1',role:'受付',start:'09:00',end:'10:30',count:2,critical:true},
  {id:'s2',role:'案内',start:'09:00',end:'10:30',count:1,critical:false},
  {id:'s3',role:'物販',start:'10:45',end:'12:15',count:2,critical:true},
  {id:'s4',role:'受付',start:'11:00',end:'12:00',count:1,critical:false},
  {id:'s5',role:'案内',start:'13:00',end:'14:30',count:2,critical:false},
  {id:'s6',role:'物販',start:'14:45',end:'16:15',count:2,critical:true}
 ], locks:[]
};
let data=JSON.parse(JSON.stringify(sample));let result=null;let serial=100;
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function banner(text,error=false){const node=$('#message');node.textContent=text;node.className='notice'+(error?' error':'');}
function nextId(prefix){serial++;while(data.people.some(p=>p.id===prefix+serial)||data.shifts.some(s=>s.id===prefix+serial))serial++;return prefix+serial;}
function download(name,text,type){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function invalidate(){result=null;$('#heroFill').textContent='—';$('#heroBar').style.width='0%';$('#heroStatus').textContent='未計算';$('#stats').replaceChildren();$('#assignmentGrid').replaceChildren();banner('入力内容が変わりました。「自動で割り当てる」で再計算してください。');}
function renderEditors(){
 $('#eventName').value=data.eventName||'';$('#eventDate').value=data.eventDate||'';$('#rest').value=data.rest;
 $('#peopleCount').textContent=data.people.length+'名';$('#shiftCount').textContent=data.shifts.length+'枠';
 $('#peopleBody').innerHTML=data.people.map(p=>`<tr data-id="${escapeHTML(p.id)}"><td><input data-field="name" aria-label="仮名" maxlength="40" value="${escapeHTML(p.name)}"></td><td><input data-field="roles" aria-label="可能な役割" maxlength="120" value="${escapeHTML(p.roles)}"></td><td><input data-field="available" aria-label="参加可能な時間帯" maxlength="180" value="${escapeHTML(p.available)}"></td><td><input type="number" min="0" max="1440" data-field="maxMinutes" aria-label="上限時間（分）" value="${escapeHTML(p.maxMinutes)}"></td><td><button class="kill" data-delete="person" aria-label="参加者を削除">×</button></td></tr>`).join('');
 $('#shiftsBody').innerHTML=data.shifts.map(s=>`<tr data-id="${escapeHTML(s.id)}"><td><input data-field="role" aria-label="役割" maxlength="60" value="${escapeHTML(s.role)}"></td><td><input type="time" data-field="start" aria-label="開始時刻" value="${escapeHTML(s.start)}"></td><td><input type="time" data-field="end" aria-label="終了時刻" value="${escapeHTML(s.end)}"></td><td><input type="number" min="1" max="5" data-field="count" aria-label="必要人数" value="${escapeHTML(s.count)}"></td><td class="check"><input type="checkbox" data-field="critical" aria-label="重要枠" ${s.critical?'checked':''}></td><td><button class="kill" data-delete="shift" aria-label="枠を削除">×</button></td></tr>`).join('');
}
function setChange(e){const t=e.target;const tr=t.closest('tr[data-id]');if(!tr||!t.dataset.field)return;
 const list=t.closest('#peopleBody')?'people':'shifts', item=data[list].find(x=>x.id===tr.dataset.id);if(!item)return;
 const field=t.dataset.field;item[field]=field==='critical'?t.checked:['maxMinutes','count'].includes(field)?Number(t.value):t.value;
 invalidate();
}
function renderResult(){
 if(!result)return;
 if(!result.ok){banner(result.errors.join(' / '),true);$('#stats').replaceChildren();$('#assignmentGrid').replaceChildren();return;}
 const fill=result.total?Math.round(result.coverage/result.total*100):100;
 $('#heroFill').textContent=fill+'%';$('#heroBar').style.width=fill+'%';$('#heroStatus').textContent=result.coverage+' / '+result.total+' 席 配置済み';
 banner(result.warnings.length?result.warnings.join(' / '):'計算完了：時間・役割・休憩・上限を確認済み。'+(result.method==='exhaustive search'?' この規模では最適解を探索しました。':''));
 const empty=result.total-result.coverage;
 const active=Object.values(result.load).filter(x=>x>0).length;
 $('#stats').innerHTML=`<div class="stat"><strong>${fill}%</strong><span>席の充足率</span></div><div class="stat"><strong>${empty}</strong><span>未配置の席</span></div><div class="stat"><strong>${active}人</strong><span>担当に入る人数</span></div>`;
 const groups=data.shifts.map(s=>{
  const a=result.assignments.filter(x=>x.shiftId===s.id);
  const seatRows=a.map((row,i)=>{
   const opts=['<option value="">— 未配置 / 固定解除 —</option>',...data.people.map(p=>`<option value="${escapeHTML(p.id)}" ${p.id===row.person?'selected':''}>${escapeHTML(p.name)}</option>`)].join('');
   return `<div class="seat"><span>#${i+1}</span><select data-seat="${escapeHTML(row.seat)}" aria-label="${escapeHTML(s.role)} ${i+1}席の担当者">${opts}</select><span class="${row.locked?'locked':row.person?'':'missing'}">${row.locked?'固定':row.person?'':'未配置'}</span></div>`;
  }).join('');
  return `<section class="shiftcard"><div class="shiftcard-head"><strong>${escapeHTML(s.role)} ${s.critical?'<span class="critical">重要</span>':''}</strong><small>${escapeHTML(s.start)}–${escapeHTML(s.end)} ・ ${s.count}名必要</small></div>${seatRows}</section>`;
 }).join('');
 const loads=data.people.map(p=>{
  const used=result.load[p.id]||0, pct=p.maxMinutes?Math.min(100,Math.round(used/p.maxMinutes*100)):0;
  return `<div class="loadbar"><span>${escapeHTML(p.name)}</span><span class="track"><span style="width:${pct}%"></span></span><small>${used}/${p.maxMinutes}分</small></div>`;
 }).join('');
 $('#assignmentGrid').innerHTML=groups+`<h3 style="font-size:15px;margin:23px 0 11px">担当時間のバランス</h3>${loads}`;
}
function calculate(){result=E.solve(data);renderResult();}
function switchSeat(e){const el=e.target;if(!el.matches('select[data-seat]'))return;
 const previous=data.locks.slice();data.locks=data.locks.filter(x=>x.seat!==el.dataset.seat);
 if(el.value)data.locks.push({seat:el.dataset.seat,person:el.value});
 const v=E.inspect(data);const issue=E.validateAssignments(v,new Map(v.lockMap));
 if(issue.length){data.locks=previous;renderResult();banner('この固定はできません: '+issue.join(' / '),true);return;}
 calculate();
}
function importFile(file){if(!file)return;if(file.size>1024*1024){banner('1MBを超えるJSONは読み込めません',true);return;}
 const reader=new FileReader();reader.onload=()=>{
  try {const parsed=JSON.parse(reader.result);if(!parsed||!Array.isArray(parsed.people)||!Array.isArray(parsed.shifts))throw Error('必要な項目がありません');
    const v=E.inspect(parsed);if(v.errors.length)throw Error(v.errors.join(' / '));
    data={...v.data,eventName:String(parsed.eventName||''),eventDate:String(parsed.eventDate||'')};renderEditors();calculate();banner('JSONから読み込みました。必要に応じて再編集してください。');
  }catch(err){banner('JSON読込エラー：'+err.message,true);}
 };reader.readAsText(file);}
$('#eventName').addEventListener('input',e=>{data.eventName=e.target.value;});
$('#eventDate').addEventListener('change',e=>{data.eventDate=e.target.value;});
$('#rest').addEventListener('input',e=>{data.rest=Number(e.target.value);invalidate();});
$('#peopleBody').addEventListener('input',setChange);$('#shiftsBody').addEventListener('input',setChange);
$('#peopleBody').addEventListener('click',e=>{const t=e.target.closest('button[data-delete]');if(!t)return;data.people=data.people.filter(x=>x.id!==t.closest('tr').dataset.id);data.locks=data.locks.filter(l=>data.people.some(p=>p.id===l.person));renderEditors();invalidate();});
$('#shiftsBody').addEventListener('click',e=>{const t=e.target.closest('button[data-delete]');if(!t)return;const del=t.closest('tr').dataset.id;data.shifts=data.shifts.filter(x=>x.id!==del);data.locks=data.locks.filter(l=>!l.seat.startsWith(del+'#'));renderEditors();invalidate();});
$('#addPerson').addEventListener('click',()=>{data.people.push({id:nextId('p'),name:'新しい担当',roles:'*',available:'09:00-17:00',maxMinutes:180});renderEditors();invalidate();});
$('#addShift').addEventListener('click',()=>{data.shifts.push({id:nextId('s'),role:'案内',start:'09:00',end:'10:00',count:1,critical:false});renderEditors();invalidate();});
$('#solve').addEventListener('click',calculate);
$('#demo').addEventListener('click',()=>{data=JSON.parse(JSON.stringify(sample));localStorage.removeItem('yohaku-shift-v1');renderEditors();calculate();});
$('#assignmentGrid').addEventListener('change',switchSeat);
$('#save').addEventListener('click',()=>{try{localStorage.setItem('yohaku-shift-v1',JSON.stringify(data));banner('この端末のブラウザ内に保存しました（他端末とは同期されません）。');}catch(err){banner('保存できませんでした: '+err.message,true);}});
$('#clearStorage').addEventListener('click',()=>{try{localStorage.removeItem('yohaku-shift-v1');banner('このアプリの端末内保存を消去しました。現在の入力は残っています。');}catch(err){banner('消去に失敗しました: '+err.message,true);}});
$('#exportJson').addEventListener('click',()=>download('yohaku-shift.json',JSON.stringify(data,null,2),'application/json;charset=utf-8'));
$('#importJson').addEventListener('change',e=>{importFile(e.target.files[0]);e.target.value='';});
$('#exportCsv').addEventListener('click',()=>{if(!result?.ok){banner('先に配置を計算してください。',true);return;}download('yohaku-shift.csv',E.exportCSV(data,result),'text/csv;charset=utf-8');});
$('#print').addEventListener('click',()=>{if(!result?.ok){banner('先に配置を計算してください。',true);return;}window.print();});
try{const s=localStorage.getItem('yohaku-shift-v1');if(s){const parsed=JSON.parse(s),v=E.inspect(parsed);if(!v.errors.length){data={...v.data,eventName:String(parsed.eventName||''),eventDate:String(parsed.eventDate||'')};}}}catch(_err){}
renderEditors();calculate();
})();
