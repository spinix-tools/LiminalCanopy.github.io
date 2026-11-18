/* PATABAKO interface — no external network calls, no tracking. */
(function () {
  'use strict';
  const E = window.PataEngine;
  const $ = id => document.getElementById(id);
  const keys = ['productW','productD','productH','gap','quantity','sheetCost'];
  const STORAGE = 'patabako:v1';
  const PRESETS = {
    accessory: { productW:60, productD:48, productH:28, gap:2, quantity:24, sheetCost:32, autoRotate:true },
    soap: { productW:85, productD:55, productH:32, gap:1.5, quantity:40, sheetCost:28, autoRotate:true },
    gift: { productW:140, productD:105, productH:60, gap:3, quantity:12, sheetCost:45, autoRotate:true }
  };
  let current;
  let toastTimer;
  function inputs() {
    const result = {};
    for (const key of keys) result[key] = $(key).value;
    result.autoRotate = $('autoRotate').checked;
    return E.normalize(result);
  }
  function fill(config) {
    const safe = E.normalize(config);
    for (const key of keys) $(key).value = safe[key];
    $('autoRotate').checked = safe.autoRotate;
    update();
  }
  function save() { try { localStorage.setItem(STORAGE, JSON.stringify(current.input)); } catch(e) { /* local file may disallow storage */ } }
  function update() {
    current = E.geometry(inputs());
    $('pagesPerBox').innerHTML = `${current.tile.count}<small>枚</small>`;
    $('totalCost').textContent = '¥' + current.cost.toLocaleString('ja-JP');
    $('totalQty').textContent = current.input.quantity + '個 / 合計' + current.sheets + '枚';
    $('netSize').textContent = `${Math.round(current.width)} × ${Math.round(current.height)}`;
    $('tileLabel').textContent = `A4 ${current.tile.cols}列 × ${current.tile.rows}行 / ${current.tile.count}枚`;
    $('svgPreview').innerHTML = E.svg(current, {showTiles:true});
    $('innerSpec').innerHTML = `<strong>想定内寸：</strong> ${current.w} × ${current.d} × ${current.h} mm · ${current.rotated ? '90°回転して配置' : '標準向き'} · 面積利用率（概算）${(current.fillRatio*100).toFixed(1)}%`;
    $('warning').replaceChildren(...current.warnings.map(message=>{ const p=document.createElement('p');p.textContent='※ '+message;return p; }));
    for (const button of document.querySelectorAll('[data-preset]')) button.classList.remove('active');
    const matched = Object.entries(PRESETS).find(([,value]) => keys.every(key => value[key] === current.input[key]) && value.autoRotate === current.input.autoRotate);
    if (matched) document.querySelector(`[data-preset="${matched[0]}"]`).classList.add('active');
    save();
  }
  function notification(message) {
    $('toast').textContent = message;
    $('toast').style.display='block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>$('toast').style.display='none', 2800);
  }
  function download(name,text,type) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob([text],{type}));
    link.href = url; link.download=name;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),600);
    notification(name+' を保存しました');
  }
  function preparePrint() {
    const parent=$('printArea');
    parent.replaceChildren();
    for (const page of current.tile.pages) {
      const sheet=document.createElement('div');
      sheet.className='print-sheet';
      sheet.innerHTML = E.svg(current,{page})+`<div class="print-caption">ぱた箱 · ${page.index}/${current.tile.count} · ${page.col}列 ${page.row}行 · 8mm重ね</div>`;
      parent.appendChild(sheet);
    }
    return parent.childElementCount;
  }
  function start() {
    for (const key of keys) $(key).addEventListener('input',update);
    $('autoRotate').addEventListener('change',update);
    document.querySelectorAll('[data-preset]').forEach(el=>el.addEventListener('click',()=>fill(PRESETS[el.dataset.preset])));
    $('downloadSvg').addEventListener('click',()=>download('patabako-tray.svg',E.svg(current,{showTiles:false,export:true}),'image/svg+xml;charset=utf-8'));
    $('downloadCsv').addEventListener('click',()=>download('patabako-estimate.csv','\uFEFF'+E.csv(current),'text/csv;charset=utf-8'));
    $('saveJson').addEventListener('click',()=>download('patabako-project.json',JSON.stringify({schema:'patabako/v1',config:current.input},null,2),'application/json'));
    $('loadJson').addEventListener('click',()=>$('loadFile').click());
    $('loadFile').addEventListener('change',async ev=>{
      const file=ev.target.files[0]; if (!file) return;
      try {
        if (file.size>100000) throw Error('100KBを超えるファイルは読み込めません');
        const data=JSON.parse(await file.text());
        if (data.schema!=='patabako/v1' || !data.config || typeof data.config!=='object') throw Error('ぱた箱の設定JSONではありません');
        fill(data.config); notification('設定を読み込みました');
      } catch(error) { notification('読み込み失敗: '+error.message); }
      ev.target.value='';
    });
    $('reset').addEventListener('click',()=>{fill(E.DEFAULT);notification('初期値に戻しました');});
    $('printTiles').addEventListener('click',()=>{preparePrint();window.print();});
    window.addEventListener('beforeprint',preparePrint);
    let stored=null;
    try { stored=JSON.parse(localStorage.getItem(STORAGE)||'null'); } catch(e) { /* ignore malformed stored settings */ }
    fill(stored && typeof stored==='object'?stored:E.DEFAULT);
  }
  start();
  window.PataApp = { getCurrent:()=>current,preparePrint,fill };
})();
