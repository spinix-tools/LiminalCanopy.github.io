/* KOTOORI interactive editor — plain browser APIs, no network requests */
(function () {
  'use strict';
  const E = window.KotooriEngine;
  if (!E) throw new Error('engine.js が必要です');
  const key = 'kotoori:project:v1';
  const $ = id => document.getElementById(id);
  let project;
  let selected = 0;
  let readMode = false;
  const names = ['表紙','2ページ','3ページ','4ページ','5ページ','6ページ','7ページ','裏表紙'];

  function announce(message) { $('status').textContent = message; }
  function initialProject() {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved) return E.parseJSON(saved);
    } catch (_) { /* blocked storage: still usable */ }
    return E.makeDefault();
  }
  function persist() {
    try { window.localStorage.setItem(key, E.serialize(project)); announce('✓ 自動保存済み'); }
    catch (_) { announce('自動保存不可 · JSON保存推奨'); }
  }
  function node(tag, cls, content) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (content !== undefined) el.textContent = content;
    return el;
  }
  function renderPanel(index, printing) {
    const p = project.pages[index];
    const outer = node(printing ? 'div' : 'button', printing ? 'panel' : 'reader-item');
    if (!printing) { outer.type = 'button'; outer.setAttribute('aria-label', `${index+1}ページを編集`); }
    if (index === selected) outer.classList.add('selected');
    outer.style.setProperty('--page-bg', E.palette(project.paper));
    outer.style.backgroundColor = E.palette(project.paper);
    outer.dataset.page = String(index+1);
    const rotator = node('div', 'panel-rotator');
    if (p.image) {
      const img = node('img');
      img.alt = '';
      img.src = p.image;
      rotator.appendChild(img);
    }
    const content = node('div', `panel-content ${project.direction}${p.image ? ' has-image' : ''}`);
    const title = node('h3', '', p.title);
    const body = node('p', '', p.body);
    content.append(title, body);
    rotator.appendChild(content);
    outer.appendChild(rotator);
    if (printing) {
      const num = node('span','small-number', String(index+1));
      outer.appendChild(num);
      outer.addEventListener('click', () => pick(index));
    } else {
      outer.appendChild(node('span','label-number',`${index+1} / ${names[index]}`));
      outer.addEventListener('click', () => pick(index));
    }
    return outer;
  }
  function inspectOverflow() {
    // Compare real DOM dimensions; this is a warning, not automatic pagination.
    let bad = [];
    document.querySelectorAll('#sheet .panel').forEach(el => {
      const content = el.querySelector('.panel-content');
      const overflow = content.scrollWidth > content.clientWidth + 3 || content.scrollHeight > content.clientHeight + 3;
      el.classList.toggle('overflow', overflow);
      if (overflow) bad.push(Number(el.dataset.page));
    });
    bad.sort((a,b) => a-b);
    $('sheetWarning').textContent = bad.length ? `⚠ ${bad.join('・')}ページで文字がはみ出している可能性があります。文字サイズか本文を調整してください。` : '✓ 文字は各ページの表示領域に収まっています（画面上の参考判定）。';
    $('pageWarning').textContent = bad.includes(selected+1) ? '⚠ このページは文字が切れる可能性があります。' : '';
  }
  function draw() {
    const sheet = $('sheet');
    sheet.replaceChildren();
    sheet.style.setProperty('--type-size', String(project.fontSize));
    sheet.classList.toggle('guides', project.guides);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        const index = E.logicalIndex(row,col);
        const panel = renderPanel(index, true);
        if (row === 0) panel.classList.add('top');
        sheet.appendChild(panel);
      }
    }
    sheet.appendChild(node('div','cut-line'));
    const reader = $('reader');
    reader.replaceChildren();
    for (let i = 0; i < 8; i++) reader.appendChild(renderPanel(i,false));
    $('main').classList.toggle('reading',readMode);
    $('sheetMode').setAttribute('aria-pressed',String(!readMode));
    $('readMode').setAttribute('aria-pressed',String(readMode));
    const m = E.metrics(project);
    $('summary').textContent = `${m.pages}ページ · ${m.characters}文字 · 写真${m.images}枚`;
    $('fontValue').textContent = `${project.fontSize}px`;
    requestAnimationFrame(inspectOverflow);
  }
  function drawNav() {
    const list = $('pageList');
    list.replaceChildren();
    project.pages.forEach((p,i) => {
      const b = node('button','page-choice');
      b.type = 'button';
      b.setAttribute('aria-current',i === selected ? 'page':'false');
      b.classList.toggle('selected',i === selected);
      b.appendChild(node('b','',String(i+1).padStart(2,'0')));
      b.appendChild(node('span','',`${names[i]}\n${p.title || '（未入力）'}`));
      b.addEventListener('click',()=>pick(i));
      list.appendChild(b);
    });
  }
  function drawFields() {
    const p = project.pages[selected];
    $('selectedTitle').textContent = `${selected+1} · ${names[selected]}`;
    $('bookName').value = project.name;
    $('titleInput').value = p.title;
    $('bodyInput').value = p.body;
    $('textCount').textContent = `${Array.from(p.title+p.body).length}文字 / このページ`;
    $('removeImage').disabled = !p.image;
    $('direction').value = project.direction;
    $('paper').value = project.paper;
    $('fontSize').value = String(project.fontSize);
    $('guides').checked = project.guides;
    $('imageInput').value = '';
  }
  function renderAll() { drawNav(); drawFields(); draw(); }
  function pick(i) { selected = i; renderAll(); }
  function changedContents() {
    project.pages[selected].title = $('titleInput').value;
    project.pages[selected].body = $('bodyInput').value;
    $('textCount').textContent = `${Array.from(project.pages[selected].title+project.pages[selected].body).length}文字 / このページ`;
    persist(); draw(); drawNav();
  }
  function download(name, content, mime) {
    const blob = new Blob([content],{type:mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  async function readPicture(file) {
    if (!file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 12582912) { announce('画像はPNG/JPEG/WebP・12MB以下にしてください'); return; }
    const pageIndex = selected;
    try {
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        await new Promise((resolve,reject) => { img.onload=resolve; img.onerror=reject; img.src=url; });
        const w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) throw new Error('画像を開けません');
        const scale = Math.min(1,900/Math.max(w,h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1,Math.round(w*scale)); canvas.height=Math.max(1,Math.round(h*scale));
        const ctx=canvas.getContext('2d'); if (!ctx) throw new Error('画像処理できません');
        ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height);
        project.pages[pageIndex].image = canvas.toDataURL('image/jpeg',.76);
      } finally { URL.revokeObjectURL(url); }
      persist(); renderAll(); announce('✓ 写真を追加しました');
    } catch (_) { announce('画像の読込に失敗しました'); }
  }
  function wire() {
    $('titleInput').addEventListener('input',changedContents);
    $('bodyInput').addEventListener('input',changedContents);
    $('bookName').addEventListener('input',()=>{project.name=$('bookName').value;persist();});
    $('direction').addEventListener('change',()=>{project.direction=$('direction').value;persist();draw();});
    $('paper').addEventListener('change',()=>{project.paper=$('paper').value;persist();draw();});
    $('fontSize').addEventListener('input',()=>{project.fontSize=Number($('fontSize').value);$('fontValue').textContent=project.fontSize+'px';persist();draw();});
    $('guides').addEventListener('change',()=>{project.guides=$('guides').checked;persist();draw();});
    $('imageInput').addEventListener('change',e=>{void readPicture(e.target.files[0]);});
    $('removeImage').addEventListener('click',()=>{project.pages[selected].image='';persist();renderAll();});
    $('clearPage').addEventListener('click',()=>{if(!window.confirm('このページの文章・画像を削除しますか？')) return;project.pages[selected]={title:'',body:'',image:''};persist();renderAll();});
    $('sheetMode').addEventListener('click',()=>{readMode=false;draw();});
    $('readMode').addEventListener('click',()=>{readMode=true;draw();});
    $('printBtn').addEventListener('click',()=>{readMode=false;draw();window.print();});
    $('exportBtn').addEventListener('click',()=>download(E.safeFile(project.name)+'.json', E.serialize(project), 'application/json;charset=utf-8'));
    $('importBtn').addEventListener('click',()=>$('jsonFile').click());
    $('jsonFile').addEventListener('change',async e=>{
      const file=e.target.files[0]; if(!file)return;
      try { if(file.size>16000000)throw new Error('JSONファイルが大きすぎます');
        const next=E.parseJSON(await file.text());project=next;selected=0;persist();renderAll();announce('✓ プロジェクトを読み込みました');
      } catch(error) { announce('読み込めません: '+String(error.message).slice(0,70)); }
      e.target.value='';
    });
    $('newBtn').addEventListener('click',()=>{if(!window.confirm('編集中の内容を新しい空の作品に置き換えますか？ 必要なら先にJSON保存してください。'))return;
      project=E.makeDefault();project.name='無題の折本';project.pages=project.pages.map(()=>({title:'',body:'',image:''}));selected=0;persist();renderAll();});
    $('demoBtn').addEventListener('click',()=>{if(!window.confirm('現在の作品を見本に置き換えますか？'))return;
      project=E.makeDefault();selected=0;persist();renderAll();});
    window.addEventListener('beforeprint',()=>{if(readMode){readMode=false;draw();}});
  }
  project=initialProject();
  wire();
  renderAll();
})();
