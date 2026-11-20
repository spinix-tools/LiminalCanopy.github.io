/* ひづけ仕分け — file operations remain inside this browser; no fetch() */
(() => {
  'use strict';
  const C = window.HizukeCore;
  const $ = id => document.getElementById(id);
  let rows = [], selected = null, busy = false;
  const urls = new Map();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const formatSize = n => n >= 1048576 ? (n/1048576).toFixed(1)+' MB' : (n/1024).toFixed(0)+' KB';
  const labelSource = src => ({'exif-original':'EXIF 撮影日時','exif-digitized':'EXIF デジタル化日時','filename-approved':'ファイル名を採用','filename-candidate':'ファイル名から推定','manual':'手動で設定','unknown':'日付不明','unverified':'保留'}[src]||'保留');
  const thumbnail = row => { if(!urls.has(row.id)) urls.set(row.id,URL.createObjectURL(row.file));return urls.get(row.id); };
  const clearUrls=()=>{for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();};
  const notice=msg=>{ $('notice').textContent=msg; };
  function savePrefs() { try {localStorage.setItem('hizuke-pref-v1',JSON.stringify({prefix:$('prefix').value,omitDuplicates:$('omit').checked}));}catch(_){} }
  function loadPrefs() {try{let p=JSON.parse(localStorage.getItem('hizuke-pref-v1')||'{}');if(typeof p.prefix==='string')$('prefix').value=p.prefix;if(typeof p.omitDuplicates==='boolean')$('omit').checked=p.omitDuplicates;}catch(_){} }
  function setBusy(flag) {busy=flag;const active=rows.length>0;for(const b of ['zip','csv','json','demo','clear'])$(b).disabled=flag||(['zip','csv','json'].includes(b)&&!active);$('files').disabled=flag;}
  function render() {
    $('nTotal').textContent=rows.length;
    $('nExif').textContent=rows.filter(r=>r.source.startsWith('exif-')).length;
    $('nReview').textContent=rows.filter(r=>!C.validDate(r.date)).length;
    $('nDuplicate').textContent=rows.filter(r=>r.duplicateOf).length;
    const f=$('filter').value;
    const filtered=rows.filter(r=>f==='all'||(f==='review'&&!C.validDate(r.date))||(f==='confirmed'&&C.validDate(r.date))||(f==='duplicates'&&r.duplicateOf));
    const container=$('rows');
    if(!rows.length)container.innerHTML='<div class="empty"><span>▧</span><b>写真を追加すると、ここに一覧が表示されます</b><p>サンプルから試すこともできます。</p></div>';
    else if(!filtered.length)container.innerHTML='<div class="empty"><b>該当する写真がありません</b></div>';
    else container.innerHTML=filtered.map(row=>{
      const found=row.source.startsWith('exif-');
      const maybe=row.guess&&!C.validDate(row.date);
      const tags=`<span class="tag ${found?'exif':maybe?'pending':''}">${esc(labelSource(found?row.source:maybe?'filename-candidate':row.source))}</span>${row.duplicateOf?`<span class="tag duplicate">#${row.duplicateOf} と完全一致</span>`:''}<span class="tag">${formatSize(row.size)}</span>`;
      return `<article class="photo-row ${selected===row.id?'selected':''}" data-id="${row.id}" tabindex="0"><img class="thumb" alt="" src="${esc(thumbnail(row))}"><div class="photo-content"><div class="filename">${esc(row.name)}</div><div class="tags">${tags}</div><div class="editline"><input type="date" value="${esc(row.date)}" min="1900-01-01" max="2100-12-31" aria-label="${esc(row.name)}の日付">${maybe?`<button class="approve" type="button">候補 ${esc(row.guess.date)} を採用</button>`:''}<button class="clear-date" type="button">保留に戻す</button></div></div></article>`;
    }).join('');
    for(const el of container.querySelectorAll('.photo-row')){
      const id=Number(el.dataset.id), row=rows.find(r=>r.id===id);
      el.addEventListener('click',e=>{if(e.target.closest('button,input'))return;selected=id;render();});
      el.addEventListener('keydown',e=>{if(e.target!==el)return;if(e.key==='Enter'){selected=id;render();}});
      el.querySelector('input').addEventListener('change',e=>{if(!C.setManualDate(row,e.target.value))notice('無効な日付です');selected=id;render();});
      el.querySelector('.clear-date').addEventListener('click',()=>{C.setManualDate(row,'');selected=id;render();});
      const approve=el.querySelector('.approve');if(approve)approve.addEventListener('click',()=>{C.acceptFilename(row);selected=id;render();});
    }
    const r=rows.find(x=>x.id===selected)||rows[0];
    if(r){selected=r.id;$('preview').innerHTML=`<img alt="選択した写真のプレビュー" src="${esc(thumbnail(r))}">`;
      $('details').innerHTML=`<b>${esc(r.name)}</b><br>${esc(labelSource(r.source))} · ${esc(r.date||'未確定')} ${esc(r.time||'')}<br>${r.guess?'ファイル名の候補：'+esc(r.guess.date)+'（未承認の場合は保留）<br>':''}${r.duplicateOf?'#'+r.duplicateOf+' とバイト単位で一致<br>':''}元データは編集されません。`;
    } else { $('preview').innerHTML='<div class="preview-placeholder">写真を選んでください</div>';$('details').textContent='EXIF撮影日時を優先し、無い場合は名前から候補だけ抽出します。'; }
    const bins=new Map();for(const r of rows)if(C.validDate(r.date)){const k=r.date.slice(0,7);bins.set(k,(bins.get(k)||0)+1);}
    const items=[...bins].sort((a,b)=>a[0].localeCompare(b[0]));const top=Math.max(1,...items.map(x=>x[1]));
    $('timeline').innerHTML=items.length?items.map(([k,v])=>`<div class="bar-row"><b>${esc(k)}</b><div class="track"><span style="width:${Math.round(v/top*100)}%"></span></div><b>${v}</b></div>`).join(''):'<p class="hint">日付が確定すると、ここに分布が表示されます。</p>';
    const plan=C.planRows(rows,{prefix:$('prefix').value,omitDuplicates:$('omit').checked});
    const n=plan.filter(r=>!r.skipped).length, missing=plan.filter(r=>!r.date&&!r.skipped).length;
    $('summary').innerHTML=rows.length?`<b>${n}枚</b>をZIPに出力（保留 ${missing}枚）<br>除外：${rows.length-n}枚 ／ 写真容量：約${formatSize(rows.filter((_,i)=>!plan[i].skipped).reduce((s,r)=>s+r.size,0))}<br><small>画像はオリジナルをそのまま格納。重複検出はバイト一致のみ。</small>`:'対象写真を追加してください。';
    setBusy(busy);
  }
  async function addFiles(list) {
    const files=[...list];if(!files.length)return;
    if(rows.length+files.length>80){notice('一度に扱える写真は80枚までです');return;}
    const accepted=files.filter(f=>/^image\/(jpeg|png|webp)$/.test(f.type)||/\.(jpe?g|png|webp)$/i.test(f.name));
    if(accepted.length!==files.length){notice('JPEG・PNG・WebP画像のみ読み込めます');return;}
    const total=rows.reduce((s,r)=>s+r.size,0)+accepted.reduce((s,f)=>s+f.size,0);
    if(total>200*1024*1024 || accepted.some(f=>f.size>20*1024*1024)){notice('上限は合計200MB・1ファイル20MBです');return;}
    setBusy(true);notice('撮影日時と完全一致を確認しています…');
    try {
      let next=Math.max(0,...rows.map(r=>r.id));
      for(const file of accepted){
        const b=new Uint8Array(await file.slice(0,256*1024).arrayBuffer());
        rows.push(C.normalizeEntry({name:file.name,size:file.size,file,exif:C.exifDate(b)},next++));
      }
      await C.findDuplicates(rows);
      selected=rows[0]?.id||null;
      notice(`${accepted.length}枚を追加しました。ファイル名の候補は未確定のままです。`);
    } catch(e) {notice('読み込みエラー: '+e.message);}
    finally {setBusy(false);render();}
  }
  function download(data,name,type) {const blob=data instanceof Blob?data:new Blob([data],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
  async function exportZip() {
    if(!rows.length)return;
    setBusy(true);notice('ZIPを作成しています…');
    try {
      const plan=C.planRows(rows,{prefix:$('prefix').value,omitDuplicates:$('omit').checked});
      const entries=[];
      for(let i=0;i<rows.length;i++)if(!plan[i].skipped)entries.push({name:plan[i].path,bytes:new Uint8Array(await rows[i].file.arrayBuffer())});
      entries.push({name:'manifest.csv',bytes:new TextEncoder().encode(C.manifestCSV(plan))});
      entries.push({name:'manifest.json',bytes:new TextEncoder().encode(JSON.stringify({created:'local',note:'元ファイルのEXIFは変更していません。日付ソースはmanifest.csvを参照。',files:plan},null,2))});
      download(C.makeZIP(entries),'hizuke-shiwake.zip','application/zip');
      notice(`${entries.length-2}枚の写真をZIPに保存しました。`);
    } catch(e) {notice('ZIP出力エラー: '+e.message);} finally {setBusy(false);render();}
  }
  async function demo() {
    setBusy(true);notice('サンプル画像を準備しています…');
    try {
      const create=(label,color)=>new Promise(resolve=>{
        const canvas=document.createElement('canvas');canvas.width=600;canvas.height=390;
        const c=canvas.getContext('2d');c.fillStyle=color;c.fillRect(0,0,600,390);
        c.fillStyle='#ffffffcc';c.beginPath();c.arc(480,90,55,0,Math.PI*2);c.fill();
        c.fillStyle='#184b3e';c.beginPath();c.moveTo(0,330);c.lineTo(160,115);c.lineTo(345,330);c.fill();
        c.fillStyle='#2e7a65';c.beginPath();c.moveTo(270,360);c.lineTo(420,175);c.lineTo(600,360);c.fill();
        c.fillStyle='white';c.font='bold 34px sans-serif';c.fillText(label,24,55);
        canvas.toBlob(resolve,'image/png');
      });
      const a=await create('SPRING / 2024','#a2d3be');
      const b=await create('AUTUMN / 2023','#e5ba92');
      const c=await create('UNKNOWN','#92afcb');
      // Duplicate: identical image bytes, different name.
      const files=[new File([a],'IMG_20240415_123000.png',{type:'image/png'}),new File([b],'2023-11-05_memories.png',{type:'image/png'}),new File([c],'scan_no_date.png',{type:'image/png'}),new File([a],'copy_20240415.png',{type:'image/png'})];
      setBusy(false);await addFiles(files);
    }catch(e){notice('サンプル生成エラー: '+e.message);setBusy(false);}
  }
  function clearAll(){clearUrls();rows=[];selected=null;$('files').value='';notice('一覧をクリアしました。元の写真ファイルには影響しません。');render();}
  $('files').addEventListener('change',e=>addFiles(e.target.files));
  const dz=$('dropzone');
  dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('is-drag');});
  dz.addEventListener('dragleave',()=>dz.classList.remove('is-drag'));
  dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('is-drag');addFiles(e.dataTransfer.files);});
  $('demo').addEventListener('click',demo);$('clear').addEventListener('click',clearAll);
  $('filter').addEventListener('change',render);
  $('prefix').addEventListener('input',()=>{savePrefs();render();});$('omit').addEventListener('change',()=>{savePrefs();render();});
  $('zip').addEventListener('click',exportZip);
  $('csv').addEventListener('click',()=>download(C.manifestCSV(C.planRows(rows,{prefix:$('prefix').value,omitDuplicates:$('omit').checked})),'hizuke-manifest.csv','text/csv;charset=utf-8'));
  $('json').addEventListener('click',()=>download(JSON.stringify({app:'hizuke-shiwake',note:'写真バイト列は含まれません',files:C.planRows(rows,{prefix:$('prefix').value,omitDuplicates:$('omit').checked})},null,2),'hizuke-manifest.json','application/json'));
  loadPrefs();render();
})();