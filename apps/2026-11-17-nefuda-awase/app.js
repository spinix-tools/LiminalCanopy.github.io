(() => {
  'use strict';
  const E = window.LabelEngine;
  const STORAGE = 'nefuda-awase-v1';
  const sample = () => ({
    version: 1,
    config: { ...E.defaults },
    items: [
      { name:'真鍮のブローチ', price:1800, qty:5, note:'手作り・税込' },
      { name:'小さな陶器の花器', price:3200, qty:4, note:'一点もの' },
      { name:'紙のしおり 3枚セット', price:500, qty:6, note:'オリジナル' }
    ]
  });
  const $ = id => document.getElementById(id);
  const el = (tag, className, text) => { const n=document.createElement(tag); if(className)n.className=className; if(text!==undefined)n.textContent=text; return n; };
  let state = sample(), editingIndex = -1, currentPage = 0, calibration = false;
  let toastTimer;
  function notify(msg) { $('toast').textContent=msg; $('toast').style.display='block'; clearTimeout(toastTimer); toastTimer=setTimeout(()=>{$('toast').style.display='none';},3300); }
  function store() { try { localStorage.setItem(STORAGE,JSON.stringify(state)); } catch(err) { console.warn('Local storage unavailable',err); } }
  function load() { try { const data=JSON.parse(localStorage.getItem(STORAGE)); if(data && data.version===1){ const config=E.validConfig(data.config); const items=E.normalizedItems(data.items); state={version:1,config,items};} }catch(e){console.warn('Saved data ignored',e);} }
  function syncConfig() {
    document.querySelectorAll('[data-conf]').forEach(field => {field.value=state.config[field.dataset.conf];});
    $('guides').checked=Boolean(state.config.guides);
    const match = Object.entries(E.presets).find(([k,p]) => Object.keys(p).every(f=>p[f]===state.config[f]));
    $('preset').value=match?match[0]:'custom';
  }
  function renderItems() {
    const container=$('items'); container.replaceChildren();
    $('productCount').textContent=`${state.items.length}種類`;
    if (!state.items.length) container.append(el('div','hint','商品がありません。「商品を追加」から始めてください。'));
    state.items.forEach((item,i)=>{
      const row=el('div','item');
      const content=el('div','item-content');
      content.append(el('div','item-name',item.name));
      content.append(el('div','item-detail',`¥${item.price.toLocaleString('ja-JP')} · ${item.qty}枚${item.note?' · '+item.note:''}`));
      const edit=el('button','btn tiny','編集');edit.type='button';edit.dataset.action='edit';edit.dataset.index=i;
      const remove=el('button','btn tiny','削除');remove.type='button';remove.dataset.action='remove';remove.dataset.index=i;remove.setAttribute('aria-label',`${item.name}を削除`);
      row.append(content,edit,remove);container.append(row);
    });
  }
  function makeTag(item, pos, guides, empty=false) {
    const tag=el('div','tag'+(!guides?' noguides':'')+(empty?' empty-tag':''));
    tag.style.left=`${pos.x}mm`;tag.style.top=`${pos.y}mm`;tag.style.width=`${pos.width}mm`;tag.style.height=`${pos.height}mm`;
    if(item){
      tag.append(el('div','name',item.name));
      const price=el('div','price');price.append(el('span','yen','¥'));price.append(document.createTextNode(item.price.toLocaleString('ja-JP')));
      tag.append(price);
      if(item.note)tag.append(el('div','note',item.note));
    }
    return tag;
  }
  function sheetFor(items, layout, index, testMode=false) {
    const sheet=el('div','sheet');
    sheet.dataset.page=String(index+1);
    if(testMode){
      layout.positions.forEach((pos,i)=>{
        const tag=makeTag({name:`位置確認 ${i+1}`,price:0,note:`${pos.x.toFixed(1)}, ${pos.y.toFixed(1)} mm`},pos,true);
        tag.querySelector('.price').textContent='＋';
        sheet.append(tag);
      });
      const line=el('div','cal-line');line.style.left='15mm';line.style.top='282mm';line.style.width='100mm';line.style.height='.3mm';sheet.append(line);
      const lab=el('div','cal-label','← 100mmを定規で確認 →');lab.style.left='15mm';lab.style.top='274mm';sheet.append(lab);
    } else {
      layout.positions.forEach((pos,i)=>{
        if(items[i]) sheet.append(makeTag(items[i],pos,layout.config.guides));
      });
    }
    const foot=el('div','sheet-label',testMode?'位置確認シート｜印刷倍率100%、余白なし':`値札あわせ · ${index+1} / ${layout.sheets}`);
    sheet.append(foot);
    return sheet;
  }
  function renderOutput() {
    const warning=$('warning');warning.replaceChildren();
    const preview=$('preview'),print=$('printArea');preview.replaceChildren();print.replaceChildren();
    try{
      const layout=E.paginate(state.items,state.config);
      $('totalTags').textContent=layout.total;
      $('totalPages').textContent=layout.sheets;
      $('perSheet').textContent=layout.capacity;
      $('calibrate').textContent=calibration?'値札に戻す':'試し刷りモード';
      $('status').textContent=calibration?'試し刷り確認':'印刷レイアウト';
      $('printBtn').disabled=layout.overflow||(!calibration && !layout.total);
      if(layout.overflow)warning.append(el('div','error','一部の札がA4用紙の外に出ています。寸法・余白・補正値を見直してください。印刷を無効にしました。'));
      else if(!layout.total&&!calibration)warning.append(el('div','hint','商品を登録すると、ここに値札が表示されます。'));
      else warning.append(el('div','good',calibration?'位置確認シート：実測値と印刷位置を比べて補正してください。':'A4の範囲内に配置できています。印刷倍率100%を選んでください。'));
      if(calibration){ currentPage=0;preview.append(sheetFor([],layout,0,true));print.append(sheetFor([],layout,0,true));$('pageIndicator').textContent='位置確認：1枚'; }
      else if(layout.sheets){
        currentPage=Math.min(currentPage,layout.sheets-1);
        preview.append(sheetFor(layout.pages[currentPage],layout,currentPage));
        layout.pages.forEach((contents,i)=>print.append(sheetFor(contents,layout,i)));
        $('pageIndicator').textContent=`${currentPage+1} / ${layout.sheets} ページ`;
      }else{$('pageIndicator').textContent='0 / 0 ページ';currentPage=0;}
      $('prevPage').disabled=calibration||currentPage===0;
      $('nextPage').disabled=calibration||currentPage>=layout.sheets-1;
    }catch(error){
      warning.append(el('div','error',error.message));$('status').textContent='設定を確認してください';
      $('printBtn').disabled=true;$('totalTags').textContent='—';$('totalPages').textContent='—';$('pageIndicator').textContent='—';
      $('prevPage').disabled=true;$('nextPage').disabled=true;
    }
  }
  function render(){renderItems();syncConfig();renderOutput();}
  function edit(index){
    editingIndex=index;
    const value=index>=0?state.items[index]:{name:'',price:'',qty:1,note:''};
    $('modalTitle').textContent=index>=0?'商品を編集':'商品を追加';
    $('editName').value=value.name;$('editPrice').value=value.price;$('editQty').value=value.qty;$('editNote').value=value.note;
    $('editorMask').classList.add('open');$('editName').focus();
  }
  function close(){ $('editorMask').classList.remove('open');editingIndex=-1; }
  function download(text,name,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
  function readFile(file,handler){
    if(!file)return;
    if(file.size>1024*1024){notify('1MBを超えるファイルは読み込めません。');return;}
    const reader=new FileReader();reader.onload=()=>{try{handler(String(reader.result));}catch(err){notify('読み込みエラー: '+err.message);}};reader.onerror=()=>notify('ファイルを読み込めませんでした。');reader.readAsText(file,'UTF-8');
  }
  $('addProduct').addEventListener('click',()=>edit(-1));
  $('cancelEdit').addEventListener('click',close);
  $('editorMask').addEventListener('click',e=>{if(e.target===$('editorMask'))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  $('editForm').addEventListener('submit',e=>{
    e.preventDefault();
    try{
      const item=E.normalizedItems([{name:$('editName').value,price:$('editPrice').value,qty:$('editQty').value,note:$('editNote').value}])[0];
      const proposed = state.items.slice();
      if(editingIndex>=0) proposed[editingIndex]=item; else proposed.push(item);
      // Validate without mutating the current project on failure.
      E.paginate(proposed,state.config);
      state.items=proposed;
      close();store();render();notify('商品を保存しました。');
    }catch(err){notify(err.message);}
  });
  $('items').addEventListener('click',e=>{
    const btn=e.target.closest('button[data-action]');if(!btn)return;
    const i=Number(btn.dataset.index);if(btn.dataset.action==='edit')edit(i);
    else{state.items.splice(i,1);currentPage=0;store();render();notify('商品を削除しました。');}
  });
  $('preset').addEventListener('change',e=>{
    if(E.presets[e.target.value]){state.config={...state.config,...E.presets[e.target.value]};currentPage=0;store();render();}
  });
  document.querySelectorAll('[data-conf]').forEach(field=>field.addEventListener('change',()=>{
    state.config[field.dataset.conf]=field.value;
    // Keep numeric inputs numeric in storage, invalid values display an error.
    const val=Number(field.value);state.config[field.dataset.conf]=field.value.trim()===''?NaN:val;
    store();syncConfig();renderOutput();
  }));
  $('guides').addEventListener('change',e=>{state.config.guides=e.target.checked;store();renderOutput();});
  $('prevPage').addEventListener('click',()=>{currentPage=Math.max(0,currentPage-1);renderOutput();});
  $('nextPage').addEventListener('click',()=>{currentPage++;renderOutput();});
  $('calibrate').addEventListener('click',()=>{calibration=!calibration;renderOutput();});
  $('printBtn').addEventListener('click',()=>{if(!$('printBtn').disabled)window.print();});
  $('exportCSV').addEventListener('click',()=>{try{download(E.exportCSV(state.items),'nefuda-products.csv','text/csv;charset=utf-8');}catch(e){notify(e.message);}});
  $('importCSV').addEventListener('click',()=>$('csvFile').click());
  $('csvFile').addEventListener('change',e=>{readFile(e.target.files[0],s=>{const items=E.importCSV(s);E.paginate(items,state.config);state.items=items;currentPage=0;calibration=false;store();render();notify(`${items.length}種類を読み込みました。`);});e.target.value='';});
  $('exportJSON').addEventListener('click',()=>download(JSON.stringify(state,null,2),'nefuda-project.json','application/json;charset=utf-8'));
  $('importJSON').addEventListener('click',()=>$('jsonFile').click());
  $('jsonFile').addEventListener('change',e=>{readFile(e.target.files[0],s=>{const data=JSON.parse(s);if(data.version!==1)throw new Error('対応していない設定ファイルです。');const config=E.validConfig(data.config), items=E.normalizedItems(data.items);E.paginate(items,config);state={version:1,config,items};currentPage=0;calibration=false;store();render();notify('設定を復元しました。');});e.target.value='';});
  $('reset').addEventListener('click',()=>{if(!window.confirm('保存済みの商品と設定をサンプルで上書きしますか？'))return;state=sample();currentPage=0;calibration=false;store();render();notify('サンプルに戻しました。');});
  load();render();
})();