(function(){
  'use strict';
  const E=window.SonaesaEngine;
  const STORAGE_KEY='sonaesa-mvp-v1';
  const $=id=>document.getElementById(id);
  const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const money=n=>Math.round(n).toLocaleString('ja-JP')+'円';
  const num=n=>Number(n).toLocaleString('ja-JP',{maximumFractionDigits:2});
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state, scenario=E.shiftDate(today(),90);
  function sample(){
    const day=today();
    return E.normalize({config:E.DEFAULT_CONFIG,items:[
      {id:'seedwater1',category:'water',name:'保存水 2L × 6本',quantity:12,expiry:E.shiftDate(day,420),location:'押入れ下段'},
      {id:'seedwater2',category:'water',name:'飲料水 ペットボトル',quantity:12,expiry:E.shiftDate(day,15),location:'キッチン'},
      {id:'seedfood1',category:'food',name:'レトルトごはん',quantity:14,expiry:E.shiftDate(day,180),location:'食品庫'},
      {id:'seedfood2',category:'food',name:'缶詰',quantity:8,expiry:E.shiftDate(day,20),location:'食品庫'},
      {id:'seedtoilet',category:'toilet',name:'携帯トイレ',quantity:70,expiry:'',location:'玄関収納'}
    ]});
  }
  function announce(message,error=false){$('status').textContent=message;$('status').style.color=error?'#b24b3a':'#557865'}
  function load(){
    try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const parsed=JSON.parse(raw);if(E.validDate(parsed.asOf)&&parsed.asOf>=today())scenario=parsed.asOf;return E.normalize(parsed)}}catch(error){console.warn('Load failed:',error)}
    return sample();
  }
  function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({...state,asOf:scenario}));}catch(error){announce('端末保存に失敗しました。JSONバックアップを保存してください。',true)}}
  function syncFields(){
    const c=state.config;
    for(const key of ['persons','days','budget'])$(key).value=c[key];
    $('asof').value=scenario;
    for(const k of E.KEYS){$('rate-'+k).value=c.rates[k];$('packq-'+k).value=c.packs[k].quantity;$('packp-'+k).value=c.packs[k].price}
  }
  function formatDays(n){return num(Math.round(n*10)/10)}
  function render(){
    const now=E.assess(state,today()),future=E.assess(state,scenario);
    const loss=Math.max(0,now.minDays-future.minDays);
    $('scenario-label').textContent='比較日：'+scenario+' ／ 目標 '+state.config.days+'日';
    $('now-days').textContent=formatDays(now.minDays);
    $('future-days').textContent=formatDays(future.minDays);
    $('lost-days').textContent=formatDays(loss);
    $('now-explain').textContent=now.covered?'設定した目標を満たしています':'目標まで '+formatDays(state.config.days-now.minDays)+' 日分不足';
    $('future-explain').textContent=future.covered?'比較日でも目標を満たす見込み':'比較日の必要量に不足があります';
    $('coverage-cards').innerHTML=E.KEYS.map(key=>{
      const r=future.detail[key],n=now.detail[key];
      return `<div class="coverage-card ${r.short>0?'short':''}"><div class="coverage-header">${E.LABELS[key]}<span>${esc(E.UNITS[key])}で計算</span></div><div class="coverage-numbers"><strong>${num(r.have)} / ${num(r.need)} ${E.UNITS[key]}</strong><span>${r.percent}%</span></div><div class="track" role="meter" aria-label="${E.LABELS[key]}の充足率" aria-valuenow="${r.percent}" aria-valuemin="0" aria-valuemax="100"><div class="fill" style="width:${r.percent}%"></div></div><div class="coverage-extra">今日 ${formatDays(n.days)}日 → 比較日 ${formatDays(r.days)}日<br>${r.short>0?'不足：'+num(r.short)+E.UNITS[key]:'目標達成'}</div></div>`;
    }).join('');
    const plan=E.budgetPlan(state,scenario);
    $('plan-summary').innerHTML=`<div><span class="mini">追加購入の概算</span><br><strong>${money(plan.spent)}</strong> <span class="mini">／ 残り ${money(plan.remaining)}</span></div><div>補充後の最短日数 <strong>${formatDays(plan.minDays)}日</strong> <span class="mini">${plan.complete?'・全カテゴリ目標達成':'・まだ不足あり'}</span></div>`;
    $('plan-body').innerHTML=E.KEYS.map(k=>{
      const n=plan.packsCount[k],p=state.config.packs[k],a=plan.after[k];
      return `<tr><td><strong>${E.LABELS[k]}</strong><small>1パック ${num(p.quantity)} ${E.UNITS[k]} / ${money(p.price)}</small></td><td>${num(n)} パック</td><td>${num(n*p.quantity)} ${E.UNITS[k]}</td><td>${money(n*p.price)}</td><td>${formatDays(a.days)}日 ${a.short?'（残り不足 '+num(a.short)+E.UNITS[k]+'）':'✓'}</td></tr>`;
    }).join('');
    const rotation=E.rotate(state.items,today(),30);
    $('rotation-list').innerHTML=rotation.length?rotation.map(x=>`<span class="rotation-pill ${x.status==='期限切れ'?'expired':''}">${esc(x.status)} · ${esc(x.name)}（${num(x.quantity)}${E.UNITS[x.category]}） · ${esc(x.expiry)}</span>`).join(''):'<span class="empty">30日以内に期限を迎える登録品はありません。</span>';
    $('item-count').textContent=state.items.length+'ロット';
    $('inventory-body').innerHTML=state.items.length?state.items.map(x=>`<tr><td><strong>${E.LABELS[x.category]}：${esc(x.name)}</strong></td><td>${num(x.quantity)} ${E.UNITS[x.category]}</td><td>${esc(x.expiry||'未設定')}</td><td>${esc(x.location||'—')}</td><td><button class="btn tiny" data-action="use" data-id="${x.id}" type="button">1単位使う</button> <button class="btn tiny remove" data-action="delete" data-id="${x.id}" type="button">削除</button></td></tr>`).join(''):'<tr><td colspan="5" class="empty">備蓄がありません。上のフォームから追加できます。</td></tr>';
  }
  function settingsChange(){
    const c=state.config;
    for(const k of ['persons','days','budget']){
      const input=$(k);
      if(input.validity.valid&&input.value!=='')c[k]=Number(input.value);
    }
    for(const k of E.KEYS){
      const rate=$('rate-'+k),qty=$('packq-'+k),price=$('packp-'+k);
      if(rate.validity.valid&&rate.value!=='')c.rates[k]=Number(rate.value);
      if(qty.validity.valid&&qty.value!=='')c.packs[k].quantity=Number(qty.value);
      if(price.validity.valid&&price.value!=='')c.packs[k].price=Math.round(Number(price.value));
    }
    const inputDate=$('asof');
    if(E.validDate(inputDate.value))scenario=inputDate.value;
    render();persist();
  }
  function addItem(event){
    event.preventDefault();
    if(!$('item-form').reportValidity())return;
    if(state.items.length>=500){announce('登録は最大500ロットです。',true);return;}
    const item={id:'l'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9),category:$('item-category').value,
      name:$('item-name').value.trim(),quantity:Number($('item-quantity').value),expiry:$('item-expiry').value,location:$('item-location').value.trim()};
    try{
      state=E.normalize({...state,items:[...state.items,item]});
      persist();render();$('item-form').reset();$('item-quantity').value='2';announce('「'+item.name+'」を追加しました。');
    }catch(e){announce(e.message,true)}
  }
  function inventoryClick(event){
    const button=event.target.closest('button[data-action]');if(!button)return;
    const item=state.items.find(x=>x.id===button.dataset.id);if(!item)return;
    if(button.dataset.action==='delete'){
      if(!window.confirm('「'+item.name+'」を削除しますか？'))return;
      state.items=state.items.filter(x=>x.id!==item.id); announce('「'+item.name+'」を削除しました。');
    }else if(button.dataset.action==='use'){
      const take=Math.min(1,item.quantity);
      item.quantity=Math.round((item.quantity-take)*1000)/1000;
      if(item.quantity<=0)state.items=state.items.filter(x=>x.id!==item.id);
      announce('「'+item.name+'」を '+num(take)+E.UNITS[item.category]+' 使用として減らしました。');
    }
    persist();render();
  }
  function saveFile(content,name,type){
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportJSON(){saveFile(JSON.stringify({...state,asOf:scenario,format:'sonaesa-1'},null,2),'sonaesa-backup.json','application/json;charset=utf-8');announce('JSONバックアップを出力しました。')}
  function exportCSV(){saveFile(E.toCSV(state.items),'sonaesa-stock.csv','text/csv;charset=utf-8');announce('在庫CSVを出力しました。')}
  async function importJSON(event){
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(file.size>1000000){announce('ファイルが大きすぎます（上限1MB）。',true);return;}
    try{const backup=JSON.parse(await file.text());const next=E.normalize(backup);if(!window.confirm('現在の備蓄データを置き換えますか？'))return;
      state=next;scenario=E.validDate(backup.asOf)&&backup.asOf>=today()?backup.asOf:E.shiftDate(today(),90);persist();syncFields();render();announce('バックアップを復元しました。');
    }catch(e){announce('復元できません：'+e.message,true)}
  }
  function reset(){if(!window.confirm('編集内容を消してサンプルに戻しますか？'))return;
    state=sample();scenario=E.shiftDate(today(),90);persist();syncFields();render();announce('サンプルデータに戻しました。');}
  function init(){
    state=load();$('asof').min=today();syncFields();render();
    ['persons','days','budget','asof',...E.KEYS.flatMap(k=>['rate-'+k,'packq-'+k,'packp-'+k])].forEach(k=>$(k).addEventListener('change',settingsChange));
    $('item-form').addEventListener('submit',addItem);
    $('inventory-body').addEventListener('click',inventoryClick);
    $('export-json').addEventListener('click',exportJSON);
    $('export-csv').addEventListener('click',exportCSV);
    $('import-json').addEventListener('click',()=>$('import-file').click());
    $('import-file').addEventListener('change',importJSON);
    $('sample-reset').addEventListener('click',reset);
    $('print').addEventListener('click',()=>window.print());
  }
  document.addEventListener('DOMContentLoaded',init);
})();