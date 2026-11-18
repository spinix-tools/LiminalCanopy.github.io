(function(){
  'use strict';
  const E=window.SABUNMON;
  const $=id=>document.getElementById(id);
  let report=null, approved=new Set(), filter='all', visible=30;
  const demoOld=`商品コード,商品名,販売価格,在庫数,カテゴリ
A-001,柚子ジャム,980,24,食品
A-002,手染めハンカチ,1800,18,雑貨
A-003,陶器マグ,2400,9,食器
A-004,ポストカード5枚,500,80,紙もの
A-005,アロマキャンドル,1600,11,雑貨
A-006,はちみつ,1200,14,食品`;
  const demoNew=`商品コード,商品名,販売価格,在庫数,カテゴリ
A-006,はちみつ,1200,14,食品
A-001,柚子ジャム,1080,20,食品
A-002,手染めハンカチ,180,18,雑貨
A-003,陶器マグ,2400,0,食器
A-004,ポストカード5枚,500,75,紙もの
A-007,メッセージカード,350,30,紙もの`;
  const escaped=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const typeLabels={added:'追加',removed:'削除',modified:'変更',unchanged:'変更なし'};
  const getConfig=()=>({key:$('keySelect').value,price:$('priceSelect').value,stock:$('stockSelect').value,name:$('nameSelect').value,threshold:Number($('threshold').value),trimKeys:$('trimKeys').checked});
  function say(msg,ok=false){const el=$('message');el.hidden=false;el.className='message'+(ok?' ok':'');el.textContent=msg;}
  function clearMsg(){$('message').hidden=true;}
  function countInputs(){
    for(const [txt,out] of [['oldCsv','oldRows'],['newCsv','newRows']]){
      try{$(out).textContent=E.parseCSV($(txt).value).records.length.toLocaleString('ja-JP')+'行';}
      catch{$(out).textContent=$(txt).value?'編集中':'未読込';}
    }
  }
  function refreshSelectors(){
    let p;
    try{p=E.parseCSV($('oldCsv').value);}catch{return;}
    const cols=p.headers;
    try{const other=E.parseCSV($('newCsv').value);if(cols.some(x=>!other.headers.includes(x)))return;}catch{return;}
    const g=E.suggest(cols);
    [['keySelect',g.key,false],['priceSelect',g.price,true],['stockSelect',g.stock,true],['nameSelect',g.name,true]].forEach(([id,guess,optional])=>{
      const el=$(id), prior=el.value, prevOptions=Array.from(el.options).map(x=>x.value);
      el.replaceChildren();
      const make=(val,text)=>{const op=document.createElement('option');op.value=val;op.textContent=text;el.appendChild(op);};
      if(optional)make('','指定しない');
      else make('','キーを選択');
      cols.forEach(h=>make(h,h));
      const wanted=prevOptions.length>1&&cols.includes(prior)?prior:guess;
      el.value=wanted||'';
    });
  }
  function invalidate(){report=null;approved.clear();visible=30;countInputs();refreshSelectors();clearMsg();paint();}
  function loadDemo(){
    $('oldCsv').value=demoOld;$('newCsv').value=demoNew;
    $('oldFilename').textContent='架空サンプル（更新前）';$('newFilename').textContent='架空サンプル（更新後）';
    invalidate();runCompare(false);
  }
  function runCompare(scroll=true){
    try{
      const a=E.parseCSV($('oldCsv').value),b=E.parseCSV($('newCsv').value);
      const next=E.compare(a,b,getConfig());
      report=next;approved.clear();visible=30;filter='all';$('searchBox').value='';
      document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x.dataset.filter==='all'));
      paint();
      let tip='照合完了。データ '+(next.before.records.length+next.after.records.length).toLocaleString('ja-JP')+'行を比較しました。変更は選択して承認するまで更新案に反映されません。';
      if(!next.price||!next.stock)tip+=' ※価格・在庫列の未設定項目はリスク診断の対象外です。';
      say(tip,true);
      if(scroll)$('results').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(e){report=null;approved.clear();paint();say(e.message);}
  }
  function sortedItems(){
    if(!report)return [];
    const search=$('searchBox').value.trim().toLowerCase();
    const order={blocked:0,high:1,review:2,none:3};
    return report.items.filter(x=>{
      if(x.type==='unchanged')return false;
      if(filter==='danger'&&!['blocked','high'].includes(x.severity))return false;
      if(filter==='approved'&&!approved.has(x.id))return false;
      if(['modified','added','removed'].includes(filter)&&x.type!==filter)return false;
      if(!search)return true;
      const name=(x.newRow||x.oldRow)?.[report.name]||'';
      return x.id.toLowerCase().includes(search)||String(name).toLowerCase().includes(search);
    }).sort((a,b)=>(order[a.severity]-order[b.severity]) || a.id.localeCompare(b.id,'ja'));
  }
  function cardFor(x){
    const idx=report.items.indexOf(x), r=x.newRow||x.oldRow;
    const name=report.name?r[report.name]:'';
    let diffs=[];
    if(x.type==='modified'){
      diffs=x.changed.slice(0,6).map(h=>`<span>${escaped(h)} : <b>${escaped(x.oldRow[h])}</b><i>→</i><strong>${escaped(x.newRow[h])}</strong></span>`);
      if(x.changed.length>6)diffs.push(`<span>ほか${x.changed.length-6}列</span>`);
    } else if(x.type==='added')diffs=[`<span>更新後にのみ存在 / ${escaped(report.price?`価格 ${r[report.price]}`:'新商品')}</span>`];
    else diffs=['<span>更新前にのみ存在</span>'];
    const reasons=x.reasons.map(escaped).join(' ／ ');
    const blocking=x.blocked.map(escaped).join(' ／ ');
    const badge=x.severity==='blocked'?'<span class="pill blocked">適用不可</span>':x.severity==='high'?'<span class="pill high">要注意</span>':'';
    return `<article class="change-card ${x.severity}"><div><div class="change-top"><span class="sku">${escaped(x.id)}</span><strong>${escaped(name)}</strong><span class="pill ${x.type}">${typeLabels[x.type]}</span>${badge}</div>${reasons?`<p class="change-reason">⚑ ${reasons}</p>`:''}${blocking?`<p class="change-reason error">⛔ ${blocking}</p>`:''}<div class="field-diff">${diffs.join('')}</div></div><label class="approve-label"><input type="checkbox" data-index="${idx}" ${approved.has(x.id)?'checked':''} ${x.blocked.length?'disabled':''} aria-label="${escaped(x.id)}の更新を承認">${approved.has(x.id)?'承認済み':'承認する'}</label></article>`;
  }
  function paint(){
    const counts=report?.counts||{};
    [['mModified','modified'],['mAdded','added'],['mRemoved','removed']].forEach(([id,key])=>{$(id).textContent=report?counts[key]:'—';});
    $('mDanger').textContent=report?counts.high+counts.blocked:'—';
    const total=report?counts.modified+counts.added+counts.removed:0;
    const approvedCount=report?report.items.filter(x=>x.type!=='unchanged'&&approved.has(x.id)&&!x.blocked.length).length:0;
    $('approvalCount').textContent=`${approvedCount} / ${total}`;
    $('approvalBar').style.width=(total?100*approvedCount/total:0)+'%';
    $('resultMark').textContent=report?`計 ${report.items.length} 商品を照合`:'サンプルを試す ↗';
    $('reviewHint').textContent=report?`${total} 件の更新候補。重大リスクを先頭に表示します。`:'CSVを比較すると変更が並びます。';
    for(const id of ['exportStagedBtn','exportAuditBtn','exportOriginalBtn','approveSafeBtn'])$(id).disabled=!report;
    const list=$('reviewList');
    if(!report){list.innerHTML='<div class="empty-panel"><span class="empty-symbol">≋</span><h4>まだ差分はありません</h4><p>「サンプルを読み込む」を押すと、価格の急落・在庫ゼロなどの例を確認できます。</p></div>';$('listCap').textContent='';return;}
    const items=sortedItems(), shown=items.slice(0,visible);
    if(items.length===0)list.innerHTML='<div class="empty-panel"><span class="empty-symbol">✓</span><h4>条件に一致する変更はありません</h4><p>検索やフィルターを変更してください。</p></div>';
    else list.innerHTML=shown.map(cardFor).join('');
    const cap=$('listCap');cap.replaceChildren();
    cap.append(document.createTextNode(`${shown.length} / ${items.length} 件を表示 `));
    if(shown.length<items.length){const b=document.createElement('button');b.className='btn btn-outline';b.type='button';b.textContent='さらに30件表示 ↓';b.addEventListener('click',()=>{visible+=30;paint();});cap.append(b);}
  }
  function download(filename, text){
    const blob=new Blob(['\uFEFF',text],{type:'text/csv;charset=utf-8'});
    const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),2000);
  }
  function exportStaged(){
    if(!report)return;
    const rows=E.stagedRows(report,approved);
    download('sabunmon_approved_update.csv',E.toCSV(report.headers,rows));
    say(`承認済み${approved.size}件を反映した更新案（${rows.length}行）を生成しました。未承認の変更は旧データを維持します。`,true);
  }
  function exportAudit(){if(!report)return;const rows=E.auditRows(report,approved);const headers=['商品コード','種別','判定','承認','対象列','旧値','新値','理由'];download('sabunmon_review_log.csv',E.toCSV(headers,rows,true));say('確認履歴CSVを書き出しました。外部での承認の証明ではなく、現在の画面状態の記録です。',true);}
  function exportOriginal(){if(!report)return;download('sabunmon_before_backup.csv',E.toCSV(report.headers,report.before.records));say('比較時点の更新前CSVをバックアップとして書き出しました。',true);}
  async function readFile(id,target,filenameId){
    const file=$(id).files?.[0];if(!file)return;
    if(file.size>3000000){say('ファイルが大きすぎます（最大3MB）。');$(id).value='';return;}
    try{const bytes=await file.arrayBuffer();const decoded=new TextDecoder($('encoding').value,{fatal:true}).decode(bytes);$(target).value=decoded;$(filenameId).textContent=file.name;invalidate();}
    catch(e){say('文字コードを確認してください。Shift_JISのCSVは右下の読み込み文字コードを切り替えて、再度選択してください。');}
  }
  $('demoBtn').addEventListener('click',loadDemo);
  $('compareBtn').addEventListener('click',()=>runCompare());
  $('oldFile').addEventListener('change',()=>readFile('oldFile','oldCsv','oldFilename'));
  $('newFile').addEventListener('change',()=>readFile('newFile','newCsv','newFilename'));
  for(const id of ['oldCsv','newCsv'])$(id).addEventListener('input',()=>{invalidate();$(id==='oldCsv'?'oldFilename':'newFilename').textContent='直接入力';});
  for(const id of ['keySelect','priceSelect','stockSelect','nameSelect','threshold','trimKeys'])$(id).addEventListener('change',()=>{if(report){report=null;approved.clear();paint();say('照合条件が変更されました。「差分を診断する」を押してください。');}});
  $('threshold').addEventListener('input',()=>{$('thresholdLabel').textContent=$('threshold').value+'%';});
  document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click',()=>{filter=btn.dataset.filter;visible=30;document.querySelectorAll('.filter').forEach(el=>el.classList.toggle('active',el===btn));paint();}));
  $('searchBox').addEventListener('input',()=>{visible=30;paint();});
  $('reviewList').addEventListener('change',e=>{
    const ch=e.target.closest('input[type="checkbox"][data-index]');if(!ch||!report)return;
    const x=report.items[Number(ch.dataset.index)];if(!x||x.blocked.length)return;
    if(ch.checked)approved.add(x.id);else approved.delete(x.id);
    paint();
  });
  $('approveSafeBtn').addEventListener('click',()=>{
    if(!report)return;
    report.items.filter(x=>x.type!=='unchanged'&&x.severity==='review'&&!x.blocked.length).forEach(x=>approved.add(x.id));
    paint();say('通常の変更候補をまとめて承認しました。削除・大幅値動き・在庫ゼロ・値不正は自動承認しません。',true);
  });
  $('exportStagedBtn').addEventListener('click',exportStaged);
  $('exportAuditBtn').addEventListener('click',exportAudit);
  $('exportOriginalBtn').addEventListener('click',exportOriginal);
  loadDemo();
})();
