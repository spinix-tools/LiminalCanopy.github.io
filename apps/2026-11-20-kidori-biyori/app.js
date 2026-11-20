'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const projectDefault = () => Kidori.copy(Kidori.sample);
  let state = projectDefault(), mode = 'offcut', output = {}, savedNotice = false;
  try { const raw = localStorage.getItem('kidori-biyori-v1'); if(raw) { const parsed = JSON.parse(raw); if (!Kidori.validate(parsed).length) state = parsed; } } catch (_) { /* Storage may be disabled on file:// */ }
  const yen = n => `${Math.round(n).toLocaleString('ja-JP')} 円`;
  const mm = n => Number(n.toFixed(1)).toLocaleString('ja-JP');
  function persist() { try {localStorage.setItem('kidori-biyori-v1',JSON.stringify(state));} catch (_) {} }
  function toast(message){ $('notification').textContent = message; clearTimeout(toast.t); toast.t = setTimeout(()=>{$('notification').textContent='';},3800); }
  function rowInput(kind,i,key,value,type='text',min='') { return `<input aria-label="${esc(key)}" data-kind="${kind}" data-i="${i}" data-key="${key}" type="${type}" ${type==='number'?`min="${min}" step="${key==='price'||key==='qty'?'1':'0.5'}"`:''} value="${esc(value)}">`; }
  function renderTables() {
    $('stocks').innerHTML = state.stocks.map((s,i)=>`<tr><td>${rowInput('stocks',i,'name',s.name)}</td><td><select data-kind="stocks" data-i="${i}" data-key="kind"><option value="offcut" ${s.kind==='offcut'?'selected':''}>手持ち端材</option><option value="new" ${s.kind==='new'?'selected':''}>新材</option></select></td><td>${rowInput('stocks',i,'w',s.w,'number',1)}</td><td>${rowInput('stocks',i,'h',s.h,'number',1)}</td><td>${rowInput('stocks',i,'qty',s.qty,'number',1)}</td><td>${rowInput('stocks',i,'price',s.price,'number',0)}</td><td><button class="remove" data-remove="stocks" data-i="${i}" aria-label="材料を削除">×</button></td></tr>`).join('');
    $('parts').innerHTML = state.parts.map((p,i)=>`<tr><td>${rowInput('parts',i,'name',p.name)}</td><td>${rowInput('parts',i,'w',p.w,'number',1)}</td><td>${rowInput('parts',i,'h',p.h,'number',1)}</td><td>${rowInput('parts',i,'qty',p.qty,'number',1)}</td><td><input type="checkbox" data-kind="parts" data-i="${i}" data-key="grain" ${p.grain?'checked':''} aria-label="木目固定"></td><td><button class="remove" data-remove="parts" data-i="${i}" aria-label="部品を削除">×</button></td></tr>`).join('');
    ['kerf','margin','minReuse'].forEach(key => $(key).value = state[key]);
  }
  function selectMode(next) { mode = next; ['offcut','yield'].forEach(key=>{ const b = $(key === 'offcut' ? 'cardOffcut' : 'cardYield'); b.classList.toggle('selected',key===mode); b.setAttribute('aria-pressed',String(key===mode)); }); renderMap(); }
  function recalc() {
    output = { offcut: Kidori.plan(state,'offcut'), yield: Kidori.plan(state,'yield') };
    const error = output.offcut.error;
    $('error').hidden = !error; $('error').textContent = error || '';
    for (const key of ['offcut','yield']) {
      const p=output[key], id=key==='offcut'?'Offcut':'Yield';
      $( 'cost' + id ).textContent = p.error ? '入力を確認' : yen(p.cost);
      $( 'stats' + id ).textContent = p.error ? '—' : `割付 ${p.placed.length} 個 / 未割付 ${p.unplaced.length} 個　・　新材 ${p.newCount} 枚　・　手持ち端材 ${p.offcutCount} 枚　・　使用面積率 ${(p.utilization*100).toFixed(1)}%　・　保存可能な端材 ${p.remainders.length} 枚`;
    }
    if (!error) { $('badge').textContent = output.offcut.cost < output.yield.cost ? 'Aの購入額が低め' : output.yield.cost < output.offcut.cost ? 'Bの購入額が低め' : '購入想定額は同額'; }
    else $('badge').textContent = '';
    renderMap(); persist();
  }
  function svgFor(s, index) {
    const w = Number(s.w), h=Number(s.h);
    const tags=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" aria-label="${esc(s.name)}の板取り図" role="img">`,`<rect width="${w}" height="${h}" fill="#c6c9c1"/>`];
    const margin=Number(state.margin);
    if(w>2*margin&&h>2*margin) tags.push(`<rect x="${margin}" y="${margin}" width="${w-2*margin}" height="${h-2*margin}" fill="#e4e7df"/>`);
    for(const r of s.free) tags.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#d7ecdb" stroke="#8eb9a4" stroke-width="1"/>`);
    const colors=['#6aac94','#80b1cc','#e7bb77','#b79acb','#9cc68f','#dc9a93'];
    for(const part of s.pieces) {
      const fs = Math.min(26,Math.max(10,Math.min(part.w,part.h)*0.18));
      const label=esc(part.name).slice(0,24);
      tags.push(`<rect x="${part.x}" y="${part.y}" width="${part.w}" height="${part.h}" fill="${colors[part.partIndex%colors.length]}" stroke="#1a4d43" stroke-width="2"/><text x="${part.x+part.w/2}" y="${part.y+part.h/2-fs*.1}" font-size="${fs}" font-weight="bold" text-anchor="middle" fill="#163b37">${label}</text><text x="${part.x+part.w/2}" y="${part.y+part.h/2+fs*1.05}" font-size="${Math.max(9,fs*.76)}" text-anchor="middle" fill="#173c36">${mm(part.w)} × ${mm(part.h)}${part.rotated?' ↻':''}</text>`);
    }
    tags.push('</svg>'); return tags.join('');
  }
  function renderMap() {
    const p = output[mode];
    $('activeCaption').textContent = mode === 'offcut' ? 'A / 端材優先' : 'B / 歩留まり優先';
    if (!p || p.error) { $('layouts').innerHTML = `<p class="empty">条件を修正すると板取り図を表示します。</p>`; $('warning').textContent=''; return; }
    $('warning').textContent = p.unplaced.length ? `⚠ ${p.unplaced.length}個を割り付けできませんでした：${p.unplaced.slice(0,7).map(x=>`${x.name} (${x.w}×${x.h})`).join('、')}${p.unplaced.length>7?'ほか':''}。材料数・寸法・木目・刃幅を確認してください。` : '';
    $('layouts').innerHTML = p.stocks.length ? p.stocks.map((s,i)=>`<article class="sheet"><h3>${esc(s.name)} <span class="small">#${s.copyNumber} / ${s.kind==='offcut'?'手持ち':'新材'}</span></h3><p class="sheetmeta">${mm(s.w)} × ${mm(s.h)} mm ・ 部品${s.pieces.length}個</p>${svgFor(s,i)}<p class="sheetfoot">残る矩形 ${s.free.length}区画 / 基準以上 ${s.free.filter(r=>r.w>=state.minReuse&&r.h>=state.minReuse).length}区画</p></article>`).join('') : '<p class="empty">部品を割付できる材料がありません。</p>';
  }
  function blobDownload(name, content, type) {const url=URL.createObjectURL(new Blob([content],{type})); const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),800);}
  function csv(rows){return '\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');}
  document.body.addEventListener('change',e=>{
    const t=e.target, kind=t.dataset.kind, i=Number(t.dataset.i), key=t.dataset.key;
    if(kind && key && state[kind] && state[kind][i]) {state[kind][i][key] = t.type==='checkbox' ? t.checked : t.type==='number' ? (t.value===''?NaN:Number(t.value)) : t.value; recalc();}
    else if(['kerf','margin','minReuse'].includes(t.id)){state[t.id]=t.value===''?NaN:Number(t.value);recalc();}
  });
  document.body.addEventListener('click',e=>{
    const button=e.target.closest('[data-remove]');if(!button)return;
    const k=button.dataset.remove, i=Number(button.dataset.i); if(state[k].length===1){toast('最後の1行は削除できません');return;}state[k].splice(i,1);renderTables();recalc();
  });
  $('addStock').onclick=()=>{if(state.stocks.length>=30){toast('材料は30行までです');return;}state.stocks.push({name:'追加材料',kind:'offcut',w:600,h:400,qty:1,price:0});renderTables();recalc();};
  $('addPart').onclick=()=>{if(state.parts.length>=60){toast('部品は60行までです');return;}state.parts.push({name:'追加部品',w:300,h:200,qty:1,grain:false});renderTables();recalc();};
  ['offcut','yield'].forEach(k=>$(k==='offcut'?'cardOffcut':'cardYield').onclick=()=>selectMode(k));
  $('reset').onclick=()=>{if(!confirm('現在の入力をサンプルへ戻しますか？'))return;state=projectDefault();renderTables();recalc();toast('サンプルを読み込みました');};
  $('saveJson').onclick=()=>blobDownload('kidori-project.json',JSON.stringify(state,null,2),'application/json;charset=utf-8');
  $('loadJson').onclick=()=>$('filePick').click();
  $('filePick').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>1000000)throw Error('ファイルは1MB以内にしてください');const v=JSON.parse(await f.text());const errs=Kidori.validate(v);if(errs.length)throw Error(errs.join(' / '));state=v;renderTables();recalc();toast('プロジェクトを読み込みました');}catch(err){toast('読み込み失敗: '+err.message);}e.target.value='';};
  $('exportCsv').onclick=()=>{const p=output[mode];if(!p||p.error)return toast('先に入力を修正してください');blobDownload('kidori-parts.csv',csv([['材料','部品','個体番号','x(mm)','y(mm)','横(mm)','縦(mm)','回転'],...p.placed.map(x=>[p.stocks.find(s=>s.instanceIndex===x.stockIndex)?.name||'',x.name,x.serial,x.x,x.y,x.w,x.h,x.rotated?'あり':'なし'])]),'text/csv;charset=utf-8');};
  $('exportRemnants').onclick=()=>{const p=output[mode];if(!p||p.error)return toast('先に入力を修正してください');blobDownload('kidori-remnants.csv',csv([['元材料','横(mm)','縦(mm)','面積(mm2)','種別'],...p.remainders.map(x=>[x.name,x.w,x.h,x.w*x.h,x.kind==='offcut'?'端材':'新材から'])]),'text/csv;charset=utf-8');};
  $('exportSvg').onclick=()=>{const p=output[mode];if(!p||p.error||!p.stocks.length)return toast('出力できる板取り図がありません');const sheet=p.stocks[0];blobDownload('kidori-first-sheet.svg',svgFor(sheet,0),'image/svg+xml;charset=utf-8');toast('先頭の材料の図を出力しました（全体は印刷）');};
  $('print').onclick=()=>window.print();
  renderTables();recalc();selectMode(mode);
})();
