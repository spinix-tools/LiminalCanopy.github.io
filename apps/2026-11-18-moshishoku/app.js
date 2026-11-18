(()=>{
  'use strict';
  const E=window.MoshiEngine;
  const $=id=>document.getElementById(id);
  const fields=['people','days','start','waterL','reserveL','cookWaterMl','heatSlots'];
  const storeKey='moshishokutaku.v1';
  const now=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  let state=E.example(now());
  try { const saved=localStorage.getItem(storeKey); if(saved) state=E.normalize(JSON.parse(saved)); } catch(_) {}
  const txt=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=String(text);if(cls)e.className=cls;return e;};
  const clear=e=>{e.replaceChildren();return e;};
  const format=n=>Number(n).toLocaleString('ja-JP');
  const modeLabel={ready:'そのまま',water:'水戻し',heat:'加熱'};
  const catLabel={staple:'主食',protein:'主菜',vegetable:'副菜',other:'その他'};
  let toastTimer;
  function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2300);}
  function persist(){try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){toast('保存に失敗。JSON書き出しをご利用ください。');}}
  function renderInputs(){fields.forEach(id=>$(id).value=state[id]);}
  function readSettings(){for(const id of fields)state[id]=$(id).value;state=E.normalize(state);persist();render();}
  function updateMode(){const mode=$('mode').value;$('waterField').hidden=mode!=='water';$('heatField').hidden=mode!=='heat';}
  function clearForm(){ $('foodForm').reset();$('editId').value='';$('add').textContent='+ 食品を追加';$('cancelEdit').hidden=true;updateMode(); }
  function editItem(f){$('editId').value=f.id;$('name').value=f.name;$('portions').value=f.portions;$('mode').value=f.mode;$('category').value=f.category;$('waterMl').value=f.waterMl||160;$('heat').value=f.heat||1;$('expiry').value=f.expiry;$('add').textContent='変更を保存';$('cancelEdit').hidden=false;updateMode();$('name').focus();}
  function renderItems(){const target=clear($('items'));$('itemCount').textContent=state.food.length;
    if(!state.food.length){target.append(txt('div','食品がありません。「サンプルで試す」または上のフォームから追加してください。','empty'));return;}
    for(const f of state.food){const row=txt('div','','item');const info=txt('button','','itemInfo');info.type='button';info.append(txt('strong',f.name),txt('small',`${f.portions}食分 ・ ${modeLabel[f.mode]} ・ ${catLabel[f.category]}${f.expiry?' ・ '+f.expiry:''}`));info.addEventListener('click',()=>editItem(f));
      const del=txt('button','削除','delete');del.type='button';del.setAttribute('aria-label',f.name+'を削除');del.addEventListener('click',()=>{state.food=state.food.filter(x=>x.id!==f.id);persist();clearForm();render();toast('食品を削除しました');});row.append(info,del);target.append(row);}
  }
  function renderPlan(){const r=E.plan(state);$('coverage').textContent=Math.round(100*r.fulfilled/r.needed)+'%';$('coverageSub').textContent=`${r.fulfilled} / ${r.needed} 食分`;$('coverageBar').style.width=Math.round(100*r.fulfilled/r.needed)+'%';$('shortage').textContent=format(r.short);$('waterShort').textContent=format(Number(r.waterShort.toFixed(1)));
    const warn=clear($('warn')); if(!r.warnings.length)warn.append(txt('div','✓ 入力上の不足・制約警告はありません。実際の備蓄の安全性を保証しません。','okay'));else r.warnings.forEach(w=>warn.append(txt('div','!  '+w,'warning')));
    const box=clear($('daysPanel'));
    for(const [i,d] of r.days.entries()){const card=txt('article','','daycard');const head=txt('div','','dayhead');head.append(txt('strong',`${i+1}日目  ${d.date}`),txt('span',`調理用水 ${d.usedWaterMl}mL / 加熱 ${d.usedHeat}枠`));card.append(head);
      for(const meal of d.meals){const row=txt('div','','meal');row.append(txt('div',meal.name,'mealLabel'));const foods=txt('div','','mealItems');if(meal.items.length){for(const it of meal.items)foods.append(txt('span',`${it.name} ×${it.qty}`));}else foods.append(txt('span','割当なし','muted'));row.append(foods,txt('span',meal.short?'不足 '+meal.short:'完了',meal.short?'mealShort':'complete'));card.append(row);}box.append(card);}
    const shopping=clear($('shopping'));if(!r.shopping.length)shopping.append(txt('div','✓ 登録条件上の不足なし','okay'));else {const table=txt('table','','minitable');for(const it of r.shopping){const tr=document.createElement('tr');tr.append(txt('td',it.name),txt('td',`${format(it.amount)} ${it.unit}`,'bad'));table.append(tr);}shopping.append(table);}
    const rotation=clear($('rotation'));if(!r.rotation.length)rotation.append(txt('div','60日以内に期限を迎える登録食品はありません。','empty'));else{const table=txt('table','','minitable');for(const f of r.rotation){const tr=document.createElement('tr');tr.append(txt('td',f.name),txt('td',f.expiry));table.append(tr);}rotation.append(table);}
    return r;
  }
  function render(){renderInputs();renderItems();return renderPlan();}
  function download(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  fields.forEach(id=>$(id).addEventListener('change',readSettings));$('mode').addEventListener('change',updateMode);
  $('foodForm').addEventListener('submit',e=>{e.preventDefault();const existing=$('editId').value;const id=existing || `id-${Date.now()}-${Math.floor(Math.random()*1e8)}`;
    const item={id,name:$('name').value.trim(),portions:Number($('portions').value),mode:$('mode').value,category:$('category').value,waterMl:Number($('waterMl').value),heat:Number($('heat').value),expiry:$('expiry').value};
    if(!item.name || !(item.portions>=1 && item.portions<=500)){toast('名前と1〜500の食数を入力してください');return;}
    if(existing)state.food=state.food.map(x=>x.id===existing?item:x);else {if(state.food.length>=150){toast('食品は最大150件です');return;}state.food.push(item);}
    state=E.normalize(state);persist();clearForm();render();toast(existing?'食品を更新しました':'食品を追加しました');});
  $('cancelEdit').addEventListener('click',clearForm);
  $('sample').addEventListener('click',()=>{state=E.example(now());clearForm();persist();render();toast('サンプルを読み込みました');});
  $('reset').addEventListener('click',()=>{state=E.normalize({start:now(),food:[],people:2,days:3,waterL:18,reserveL:2.5,cookWaterMl:1000,heatSlots:4});clearForm();persist();render();toast('入力を初期化しました');});
  $('save').addEventListener('click',()=>download('moshishoku-settings.json',JSON.stringify(state,null,2),'application/json;charset=utf-8'));
  $('planCsv').addEventListener('click',()=>download('moshishoku-plan.csv',E.planCsv(E.plan(state)),'text/csv;charset=utf-8'));
  $('shoppingCsv').addEventListener('click',()=>download('moshishoku-shopping.csv',E.shoppingCsv(E.plan(state)),'text/csv;charset=utf-8'));
  $('print').addEventListener('click',()=>window.print());
  $('import').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1024*1024)throw new Error('1MBを超えています');const raw=JSON.parse(await file.text());if(!raw || !Array.isArray(raw.food))throw new Error('食品配列がありません');state=E.normalize(raw);clearForm();persist();render();toast('JSONを読み込みました');}catch(err){toast('読込失敗: '+err.message);}finally{e.target.value='';}});
  updateMode();render();
})();
