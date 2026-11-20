/* キット整列 UI. All user data remains in this browser unless exported manually. */
(() => {
  'use strict';
  const E = window.KitEngine;
  const STORAGE = 'kit-seiretsu-project-v1';
  const $ = id => document.getElementById(id);
  const h = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let data = E.demoData();
  let analysis, activeTab = 'planning', selectedPick = null;
  let toastTimer;

  function notice(message, error = false) {
    const el = $('toast'); el.textContent = message; el.classList.toggle('error', error); el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 4500);
  }
  function boot() {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) data = E.validateProject(JSON.parse(raw));
    } catch (error) { notice('保存済みデータを読み込めませんでした。サンプルで起動しました。' + error.message, true); }
    $('bookingStart').value = E.dateOffset(1); $('bookingEnd').value = E.dateOffset(1);
    bind(); render();
  }
  function persist() {
    try { localStorage.setItem(STORAGE, JSON.stringify(data)); }
    catch (error) { notice('端末への自動保存に失敗。JSONでバックアップしてください。', true); }
  }
  function mutate(callback, success = '保存しました') {
    try {
      const next = structuredClone(data); callback(next);
      const checked = E.validateProject(next);
      data = checked; persist(); render();
      if (success) notice(success);
      return true;
    } catch (error) { notice(error.message, true); return false; }
  }
  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('[data-tab]').forEach(button => {
      const active = button.dataset.tab === tab;
      button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    for (const pane of ['planning','gear','pick','data']) $('panel-' + pane).hidden = pane !== tab;
    if (tab === 'pick') renderPick();
  }
  function startOfLocalDay(s) { const [year, month, date] = s.split('-').map(Number); return new Date(year, month - 1, date); }
  function formatDay(s) { const d = startOfLocalDay(s); return `${d.getMonth()+1}/${d.getDate()} (${['日','月','火','水','木','金','土'][d.getDay()]})`; }
  function render() {
    analysis = E.analyze(data);
    $('statBookings').textContent = String(analysis.stats.bookings);
    $('statItems').textContent = String(analysis.stats.items);
    $('statBlocked').textContent = String(analysis.stats.blocked);
    $('statPurchases').textContent = String(analysis.stats.purchases);
    updateSelects(); renderBookings(); renderShortages(); renderItems(); renderKits(); renderKitInputs(); renderPurchase(); renderPick();
  }
  function updateSelects() {
    const kitValue = $('bookingKit').value;
    $('bookingKit').innerHTML = data.kits.map(k => `<option value="${h(k.id)}">${h(k.name)}</option>`).join('') || '<option value="">まずキットを登録してください</option>';
    if (data.kits.some(k => k.id === kitValue)) $('bookingKit').value = kitValue;
    const former = selectedPick || $('pickBooking').value;
    const sorted = [...analysis.bookings].sort((a,b) => a.start.localeCompare(b.start));
    $('pickBooking').innerHTML = sorted.map(b => `<option value="${h(b.id)}">${h(b.title)}｜${h(formatDay(b.start))}</option>`).join('') || '<option value="">予定がありません</option>';
    selectedPick = sorted.some(b => b.id === former) ? former : (sorted[0]?.id || null);
    if (selectedPick) $('pickBooking').value = selectedPick;
    $('bookingSubmit').disabled = data.kits.length === 0;
  }
  function renderBookings() {
    const ordered = [...analysis.bookings].sort((a,b)=>a.start.localeCompare(b.start));
    $('bookingList').innerHTML = ordered.length ? ordered.map(b => {
      const day = startOfLocalDay(b.start), dateLabel = `${day.getMonth()+1}月`;
      const status = b.blocked ? '<span class="tag warning">不足あり</span>' : b.completed ? '<span class="tag complete">準備OK</span>' : '<span class="tag">数量OK</span>';
      return `<div class="booking-card ${b.blocked?'blocked':''}"><div class="date-tile"><span>${dateLabel}</span><b>${day.getDate()}</b></div>
      <div><div class="booking-name">${h(b.title)}</div><span class="booking-meta">${h(b.kitName)} × ${b.copies} · ${h(formatDay(b.start))} – ${h(formatDay(b.end))}</span>
      <div class="booking-foot">${status}<span class="booking-meta">確認 ${b.checkedCount}/${b.itemCount}</span></div></div>
      <div class="card-actions"><button type="button" class="icon-btn" data-action="pick-booking" data-id="${b.id}">確認</button><button type="button" class="icon-btn" data-action="edit-booking" data-id="${b.id}">編集</button><button type="button" class="icon-btn danger" data-action="remove-booking" data-id="${b.id}">削除</button></div></div>`;
    }).join('') : '<div class="empty">まだ予定がありません。右のフォームから追加できます。</div>';
  }
  function renderShortages() {
    const target = $('shortagePanel');
    if (!analysis.calendar.length) { target.innerHTML = '<div class="empty">予定を登録すると、日別の在庫競合をここに表示します。</div>'; return; }
    const count = analysis.stats.shortageDays;
    const banner = count ? `<div class="summary-banner warn"><span>!</span><div><b>不足する日が ${count} 日あります</b><p>同日に重なる予定の必要数と総在庫を比較しています。上限超過の品目を確認してください。</p></div></div>`
      : '<div class="summary-banner"><span>✓</span><div><b>登録した予定に数量不足はありません</b><p>ただし破損・紛失・搬入時間は別途確認してください。</p></div></div>';
    const rows = analysis.shortages.slice(0, 70).map(s => `<tr><td>${h(formatDay(s.date))}</td><td>${h(s.itemName)}</td><td>${s.requested} / ${s.stock}</td><td><span class="delta">${s.shortage}不足</span></td></tr>`).join('');
    target.innerHTML = banner + (count ? `<div class="table-wrap"><table class="shortage-table"><thead><tr><th>日付</th><th>備品</th><th>必要 / 在庫</th><th>超過</th></tr></thead><tbody>${rows}</tbody></table></div>${analysis.shortages.length>70?`<p class="muted paragraph">最初の70件を表示中。全${analysis.shortages.length}件はCSVへ。</p>`:''}`
      : `<div class="empty">確認した ${analysis.calendar.length} 日間は、すべて在庫の範囲内です。</div>`);
  }
  function renderItems() {
    $('itemList').innerHTML = data.items.length ? data.items.map(item => `<div class="item-row"><div class="item-icon">▣</div><div class="row-body"><strong>${h(item.name)}</strong><p>${h(item.place||'保管場所未設定')}</p></div><div class="row-qty">${item.stock}<span>${h(item.unit)}</span></div><div class="row-actions"><button class="icon-btn" type="button" data-action="edit-item" data-id="${item.id}">編集</button><button class="icon-btn danger" type="button" data-action="remove-item" data-id="${item.id}">削除</button></div></div>`).join('') : '<div class="empty">備品を追加してください。</div>';
  }
  function renderKits() {
    const items = new Map(data.items.map(i=>[i.id,i]));
    $('kitList').innerHTML = data.kits.length ? data.kits.map(k => `<div class="kit-row"><div class="item-icon">▤</div><div class="row-body"><strong>${h(k.name)}</strong><div class="kit-badges">${k.lines.map(l=>`<span>${h(items.get(l.itemId)?.name)} ×${l.qty}</span>`).join('')}</div></div><div class="row-actions"><button class="icon-btn" data-action="edit-kit" data-id="${k.id}" type="button">編集</button><button class="icon-btn danger" data-action="remove-kit" data-id="${k.id}" type="button">削除</button></div></div>`).join('') : '<div class="empty">まず備品を登録してから、キットを作成してください。</div>';
  }
  function renderKitInputs(lines) {
    const preserved = lines || Object.fromEntries([...document.querySelectorAll('.kit-qty')].map(el => [el.dataset.id, el.value]));
    $('kitLineInputs').innerHTML = data.items.length ? data.items.map(item => `<div class="kit-line"><div><span>${h(item.name)}</span><small>在庫 ${item.stock}${h(item.unit)}</small></div><input class="kit-qty" type="number" aria-label="${h(item.name)}の使用数" data-id="${item.id}" min="0" max="9999" step="1" value="${h(preserved[item.id] ?? '0')}"></div>`).join('') : '<div class="empty">先に備品を登録してください</div>';
    $('kitForm').querySelector('button[type="submit"]').disabled = !data.items.length;
  }
  function renderPurchase() {
    $('purchasePanel').innerHTML = analysis.purchases.length ? `<div class="summary-banner warn"><span>!</span><div><b>${analysis.purchases.length} 品目の追加・借用を検討</b><p>ピーク日に必要な数と現有数との差です。日ごとの不足数を累積していません。</p></div></div>
    <div class="table-wrap"><table><thead><tr><th>備品</th><th>在庫</th><th>最大同時必要</th><th>追加数</th></tr></thead><tbody>${analysis.purchases.map(x=>`<tr><td><strong>${h(x.name)}</strong><br><small class="muted">${h(formatDay(x.peakDate))}</small></td><td>${x.stock}</td><td>${x.peak}</td><td class="purchase-number">+${x.add}<small>${h(x.unit)}</small></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="summary-banner"><span>✓</span><div><b>今の予定に追加備品は不要です</b><p>在庫が足りている状態です。実際の破損・故障は別途点検しましょう。</p></div></div>';
  }
  function renderPick() {
    const b = analysis?.bookings.find(b => b.id === selectedPick);
    if (!b) { $('pickContent').innerHTML = '<div class="empty">予定を登録すると確認リストを作れます。</div>'; $('pickSidebar').innerHTML = ''; $('exportPick').disabled = true; $('printPick').disabled = true; return; }
    $('exportPick').disabled = false; $('printPick').disabled = false;
    const lines = b.lines.map(l => `<label class="pick-line ${l.shortage?'warn':''}"><input type="checkbox" data-pick-item="${l.itemId}" ${l.checked?'checked':''} aria-label="${h(l.itemName)}の現物確認">
      <span><span class="pick-name">${h(l.itemName)}</span><span class="pick-place">${h(l.place||'保管場所未設定')}</span>${l.shortage?`<span class="warn-text">同日需要が在庫を${l.shortage}${h(l.unit)}超過</span>`:''}</span><span class="pick-count">${l.required}<small> ${h(l.unit)}</small></span></label>`).join('');
    $('pickContent').innerHTML = `<h2 class="print-heading">${h(b.title)} — 持ち出し確認</h2>${b.blocked?'<div class="summary-banner warn"><span>!</span><div><b>備品が不足しています</b><p>チェック完了だけで数量不足は解消しません。先に追加・予定調整を行ってください。</p></div></div>':''}
      <div class="booking-meta" style="margin-bottom:17px">${h(b.kitName)} × ${b.copies} / ${h(formatDay(b.start))} – ${h(formatDay(b.end))}</div>${lines}`;
    const pct = b.itemCount ? Math.round(100*b.checkedCount/b.itemCount) : 0;
    $('pickSidebar').innerHTML = `<div class="progress"><span style="width:${pct}%"></span></div><p class="pick-status">現物確認 <strong>${b.checkedCount} / ${b.itemCount}</strong> 項目（${pct}%）</p>
      <div class="notice ${b.blocked?'':'good'}">${b.blocked?'⚠ 在庫不足があります。確認を終えても「準備OK」にはなりません。':b.completed?'✓ 在庫数量と現物チェックの両方が揃いました。':'✓ 必要在庫は足りています。現物の状態・数量を確認してください。'}</div>`;
  }
  function resetBookingForm() { $('bookingForm').reset(); $('bookingId').value = ''; $('bookingFormHeading').textContent='新しい予定を追加'; $('bookingSubmit').innerHTML='予定を保存する <span>↗</span>'; $('bookingCancel').hidden=true; $('bookingStart').value=E.dateOffset(1); $('bookingEnd').value=E.dateOffset(1); }
  function resetItemForm() { $('itemForm').reset(); $('itemId').value=''; $('itemFormHeading').textContent='備品を登録'; $('itemCancel').hidden=true; $('itemStock').value='1'; $('itemUnit').value='個'; }
  function resetKitForm() { $('kitForm').reset(); $('kitId').value=''; $('kitFormHeading').textContent='キットを登録'; $('kitCancel').hidden=true; renderKitInputs(Object.create(null)); }
  function submitBooking(event) {
    event.preventDefault(); const oldId=$('bookingId').value, kitId=$('bookingKit').value;
    const b = {id:oldId||E.createId('plan'),title:$('bookingTitle').value,kitId,copies:Number($('bookingCopies').value),start:$('bookingStart').value,
      end:$('bookingEnd').value,note:$('bookingNote').value,checked:oldId&&data.bookings.find(x=>x.id===oldId)?.kitId===kitId ? (data.bookings.find(x=>x.id===oldId).checked) : []};
    if(mutate(p => { if(oldId) {const i=p.bookings.findIndex(x=>x.id===oldId); if(i<0) throw new Error('予定が見つかりません'); p.bookings[i]=b;} else p.bookings.push(b); }, oldId?'予定を更新しました':'予定を追加しました')) resetBookingForm();
  }
  function submitItem(event) {
    event.preventDefault(); const old=$('itemId').value;
    const i={id:old||E.createId('gear'),name:$('itemName').value,stock:Number($('itemStock').value),unit:$('itemUnit').value,place:$('itemPlace').value};
    if(mutate(p=>{if(old){const n=p.items.findIndex(x=>x.id===old); if(n<0)throw new Error('備品が見つかりません');p.items[n]=i;}else p.items.push(i);}, old?'備品を更新しました':'備品を追加しました')) resetItemForm();
  }
  function submitKit(event) {
    event.preventDefault(); const old=$('kitId').value;
    const lines=[...document.querySelectorAll('.kit-qty')].map(el=>({itemId:el.dataset.id,qty:Number(el.value)})).filter(x=>x.qty!==0);
    const k={id:old||E.createId('kit'),name:$('kitName').value,lines};
    if(mutate(p=>{if(old){const n=p.kits.findIndex(x=>x.id===old);if(n<0)throw new Error('キットが見つかりません');p.kits[n]=k;}else p.kits.push(k);},old?'キットを更新しました':'キットを追加しました')) resetKitForm();
  }
  function delegate(event) {
    const button=event.target.closest('[data-action]'); if(!button)return;
    const {action,id}=button.dataset;
    if(action==='edit-booking') {
      const b=data.bookings.find(x=>x.id===id);if(!b)return; switchTab('planning');
      $('bookingId').value=b.id;$('bookingTitle').value=b.title;$('bookingKit').value=b.kitId;$('bookingCopies').value=b.copies;$('bookingStart').value=b.start;$('bookingEnd').value=b.end;$('bookingNote').value=b.note;
      $('bookingFormHeading').textContent='予定を編集';$('bookingSubmit').innerHTML='変更を保存する <span>↗</span>';$('bookingCancel').hidden=false;$('bookingTitle').focus();
    } else if(action==='pick-booking'){selectedPick=id; switchTab('pick');$('pickBooking').value=id;renderPick();}
    else if(action==='remove-booking') { if(!confirm('この予定を削除しますか？'))return; mutate(p=>{p.bookings=p.bookings.filter(x=>x.id!==id)},'予定を削除しました');resetBookingForm();}
    else if(action==='edit-item') {const i=data.items.find(x=>x.id===id);if(!i)return;switchTab('gear');$('itemId').value=i.id;$('itemName').value=i.name;$('itemStock').value=i.stock;$('itemUnit').value=i.unit;$('itemPlace').value=i.place;$('itemFormHeading').textContent='備品を編集';$('itemCancel').hidden=false;$('itemName').focus();}
    else if(action==='remove-item') {
      if(data.kits.some(k=>k.lines.some(l=>l.itemId===id))){notice('この備品はキットで使われています。先にキットを編集してください。',true);return;}
      if(!confirm('備品を削除しますか？'))return;mutate(p=>{p.items=p.items.filter(x=>x.id!==id)},'備品を削除しました');resetItemForm();
    } else if(action==='edit-kit'){const k=data.kits.find(x=>x.id===id);if(!k)return;switchTab('gear');$('kitId').value=k.id;$('kitName').value=k.name;$('kitFormHeading').textContent='キットを編集';$('kitCancel').hidden=false;renderKitInputs(Object.fromEntries(k.lines.map(l=>[l.itemId,l.qty])));$('kitName').focus();}
    else if(action==='remove-kit') {
      if(data.bookings.some(b=>b.kitId===id)){notice('このキットを使う予定があります。先に予定を編集・削除してください。',true);return;}
      if(!confirm('キットを削除しますか？'))return;mutate(p=>{p.kits=p.kits.filter(x=>x.id!==id)},'キットを削除しました');resetKitForm();
    }
  }
  function download(name, content, mime) {
    const url=URL.createObjectURL(new Blob([content],{type:mime}));
    const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
    notice(`${name} をダウンロードしました`);
  }
  function jsonDownload(){download('kit-seiretsu-backup.json',JSON.stringify(data,null,2)+'\n','application/json;charset=utf-8');}
  function bind() {
    document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));
    $('bookingForm').addEventListener('submit',submitBooking); $('itemForm').addEventListener('submit',submitItem); $('kitForm').addEventListener('submit',submitKit);
    $('bookingCancel').addEventListener('click',resetBookingForm);$('itemCancel').addEventListener('click',resetItemForm);$('kitCancel').addEventListener('click',resetKitForm);
    document.addEventListener('click',delegate);
    $('pickBooking').addEventListener('change',e=>{selectedPick=e.target.value;renderPick();});
    $('pickContent').addEventListener('change',event=>{const input=event.target.closest('[data-pick-item]');if(!input)return;const id=selectedPick,itemId=input.dataset.pickItem;mutate(p=>{const b=p.bookings.find(x=>x.id===id);if(!b)throw new Error('予定が見つかりません');b.checked=b.checked.filter(x=>x!==itemId);if(input.checked)b.checked.push(itemId)},null);});
    $('downloadJson').addEventListener('click',jsonDownload);$('exportData2').addEventListener('click',jsonDownload);
    $('exportShortage').addEventListener('click',()=>download('kit-seiretsu-shortages.csv',E.shortageCsv(analysis),'text/csv;charset=utf-8'));
    $('exportPurchase').addEventListener('click',()=>download('kit-seiretsu-additional-gear.csv',E.purchaseCsv(analysis),'text/csv;charset=utf-8'));
    $('exportPick').addEventListener('click',()=>{if(selectedPick)download('kit-seiretsu-picklist.csv',E.pickCsv(analysis,selectedPick),'text/csv;charset=utf-8');});
    $('printPick').addEventListener('click',()=>{document.body.classList.add('print-pick');window.print();});
    window.addEventListener('afterprint',()=>document.body.classList.remove('print-pick'));
    $('resetData').addEventListener('click',()=>{if(!confirm('現在のデータを削除し、サンプルへ戻しますか？'))return;data=E.demoData();selectedPick=null;persist();resetBookingForm();resetItemForm();resetKitForm();render();switchTab('planning');notice('サンプルデータに戻しました');});
    $('importData').addEventListener('change',async event=>{
      const file=event.target.files?.[0];event.target.value='';if(!file)return;
      if(file.size>200000){notice('JSONは200KB以下にしてください',true);return;}
      try {const parsed=E.validateProject(JSON.parse(await file.text()));
        if(!confirm('現在のデータを置換しますか？必要なら先にバックアップしてください。'))return;
        data=parsed;selectedPick=null;persist();resetBookingForm();resetItemForm();resetKitForm();render();notice('バックアップを復元しました');
      }catch(error){notice('読み込めませんでした：'+error.message,true);}
    });
  }
  boot();
})();
