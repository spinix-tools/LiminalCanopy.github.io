(function () {
  'use strict';
  const E = window.SikaiEngine;
  const KEY = 'sign-sikai:project:v1';
  const $ = (q) => document.querySelector(q);
  const esc = v => String(v).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = n => Number(n).toFixed(1).replace(/\.0$/,'');
  const n2 = n => Number(n).toFixed(2);
  let project;
  try { project = E.validate(JSON.parse(localStorage.getItem(KEY))); }
  catch (_) { project = E.demo(); }
  let selectedId=project.signs[0].id;
  let rays=true, labels=true, dragging=null, toastTimer=null;
  const fieldNames={x:'X',y:'Y',w:'幅',h:'奥行',z:'高さ',letterMm:'文字mm'};
  const keys={visitors:['x','y'],obstacles:['x','y','w','h','z'],signs:['x','y','z','letterMm']};
  const statusName={good:'視認目安',small:'文字が小さい',blocked:'遮蔽あり'};
  function toast(s){
    const el=$('#toast');el.textContent=s;el.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3000);
  }
  function save(){try{localStorage.setItem(KEY,JSON.stringify(project));}catch(_){toast('端末への保存は利用できません。JSONを書き出してください');}}
  function commit(next,notice){
    try{const validated=E.validate(next);project=validated;if(!project.signs.some(s=>s.id===selectedId))selectedId=project.signs[0].id;save();render();if(notice)toast(notice);return true;}
    catch(ex){toast(ex.message);return false;}
  }
  const clone=()=>JSON.parse(JSON.stringify(project));
  function download(filename,contents,mime){
    const blob=new Blob([contents],{type:mime});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function metrics(){
    const r=E.evaluate(project);const items=[
      ['判定した視線',String(r.total),'立位 + 座位',''],
      ['視認の目安を満たす',r.good+' / '+r.total,r.total?Math.round(r.good/r.total*100)+'%':'—','green'],
      ['文字が小さい',String(r.small),'角度しきい値未達','amber'],
      ['遮蔽される',String(r.blocked),'什器との交差','red']
    ];
    $('#summary').innerHTML=items.map(([label,value,sub,tone])=>`<div class="metric ${tone}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`).join('');
  }
  function editList(kind){
    const list=project[kind], fields=keys[kind];
    $('#count-'+kind).textContent=list.length;
    $('#list-'+kind).innerHTML=list.length?list.map(o=>{
      const selected=kind==='signs' && selectedId===o.id;
      return `<div class="obj ${selected?'selected':''}"><div class="obj-top"><button class="obj-title" data-select="${esc(o.id)}" data-kind="${kind}" title="選択">${esc(o.name)}${selected?'  ◉':''}</button><button class="obj-btn" data-del="${esc(o.id)}" data-kind="${kind}" title="削除" aria-label="${esc(o.name)}を削除">×</button></div><div class="obj-fields"><label class="field name-field"><span>名称</span><input data-kind="${kind}" data-id="${esc(o.id)}" data-field="name" value="${esc(o.name)}" maxlength="70" aria-label="${esc(o.name)}の名称"></label>${fields.map(k=>`<label class="field"><span>${fieldNames[k]}</span><input data-kind="${kind}" data-id="${esc(o.id)}" data-field="${k}" value="${esc(o[k])}" type="number" step="0.05" aria-label="${esc(o.name)}の${fieldNames[k]}"></label>`).join('')}</div></div>`;
    }).join(''):'<div class="empty">まだ登録されていません</div>';
  }
  function fillForm(){
    document.querySelectorAll('[data-top]').forEach(input=>{
      const chain=input.dataset.top.split('.');input.value=chain.reduce((x,k)=>x[k],project);
    });
    for(const kind of ['visitors','obstacles','signs'])editList(kind);
  }
  function drawMap(){
    const svg=$('#floor'),W=840,H=Math.max(440,Math.min(690,840*project.room.height/project.room.width));
    const pad=46, cell=Math.min((W-2*pad)/project.room.width,(H-2*pad)/project.room.height);
    const offsetX=(W-cell*project.room.width)/2,offsetY=(H-cell*project.room.height)/2;
    const cx=x=>offsetX+x*cell,cy=y=>offsetY+y*cell;
    const rectSvg=o=>`<rect x="${cx(o.x)}" y="${cy(o.y)}" width="${o.w*cell}" height="${o.h*cell}" rx="2" fill="#d9c3a5" stroke="#b89052" stroke-width="1.6" />`;
    let s=`<title>サイン視界の平面図</title><rect x="0" y="0" width="${W}" height="${H}" fill="#f8faf8"/>`;
    for(let x=0;x<=project.room.width;x++){const p=cx(x);s+=`<line x1="${p}" x2="${p}" y1="${cy(0)}" y2="${cy(project.room.height)}" stroke="#e7eee9" stroke-width="1"/>`;if(x%2===0)s+=`<text x="${p}" y="${cy(0)-12}" text-anchor="middle" font-size="10" fill="#8ca69b">${x}m</text>`;}
    for(let y=0;y<=project.room.height;y++){const p=cy(y);s+=`<line x1="${cx(0)}" x2="${cx(project.room.width)}" y1="${p}" y2="${p}" stroke="#e7eee9" stroke-width="1"/>`;if(y%2===0)s+=`<text x="${cx(0)-14}" y="${p+3}" text-anchor="end" font-size="10" fill="#8ca69b">${y}</text>`;}
    s+=`<rect x="${cx(0)}" y="${cy(0)}" width="${project.room.width*cell}" height="${project.room.height*cell}" fill="none" stroke="#a0b9aa" stroke-width="2"/>`;
    const selected=project.signs.find(x=>x.id===selectedId);
    if(rays && selected){
      for(const v of project.visitors){
        for(const [i,eye] of [project.settings.eyeStanding,project.settings.eyeSeated].entries()){
          const r=E.evaluateOne(v,selected,project.obstacles,eye,project.settings.minAngle);
          const color={good:'#18a286',small:'#e6ad47',blocked:'#d46965'}[r.status];
          const dx=selected.y-v.y,dy=-(selected.x-v.x),len=Math.hypot(dx,dy)||1,offset=i?2.6:-2.6;
          const ox=dx/len*offset,oy=dy/len*offset;
          s+=`<line x1="${cx(v.x)+ox}" y1="${cy(v.y)+oy}" x2="${cx(selected.x)+ox}" y2="${cy(selected.y)+oy}" stroke="${color}" stroke-width="${i?1.7:2.6}" ${r.status==='good'?'':'stroke-dasharray="5,5"'} opacity="0.85"/>`;
        }
      }
    }
    for(const o of project.obstacles){
      s+=`<g class="draggable" data-drag="obstacles" data-id="${esc(o.id)}">${rectSvg(o)}<rect x="${cx(o.x)}" y="${cy(o.y)}" width="${o.w*cell}" height="${o.h*cell}" fill="transparent"/>${labels?`<text x="${cx(o.x+o.w/2)}" y="${cy(o.y+o.h/2)-3}" text-anchor="middle" font-size="10" font-weight="700" fill="#805d32" pointer-events="none">${esc(o.name)}</text><text x="${cx(o.x+o.w/2)}" y="${cy(o.y+o.h/2)+12}" text-anchor="middle" font-size="10" fill="#805d32" pointer-events="none">H ${o.z}m</text>`:''}</g>`;
    }
    for(const v of project.visitors){
      s+=`<g class="draggable" data-drag="visitors" data-id="${esc(v.id)}"><circle cx="${cx(v.x)}" cy="${cy(v.y)}" r="14" fill="#e4f4fa" stroke="#388ea9" stroke-width="2"/><circle cx="${cx(v.x)}" cy="${cy(v.y)}" r="5" fill="#388ea9"/>${labels?`<text x="${cx(v.x)}" y="${cy(v.y)+26}" font-size="12" text-anchor="middle" fill="#226c80" font-weight="700" pointer-events="none">${esc(v.name)}</text>`:''}</g>`;
    }
    for(const a of project.signs){
      const sel=a.id===selectedId,p=cx(a.x),q=cy(a.y);
      s+=`<g class="draggable" data-drag="signs" data-id="${esc(a.id)}"><circle cx="${p}" cy="${q}" r="${sel?17:14}" fill="${sel?'#0d8c72':'#d7f2e6'}" stroke="${sel?'#0b725f':'#139778'}" stroke-width="3"/><path d="M ${p-5} ${q-6} L ${p+5} ${q-6} L ${p+5} ${q+4} L ${p} ${q+9} L ${p-5} ${q+4} Z" fill="${sel?'#fff':'#137e69'}"/>${labels?`<text x="${p}" y="${q-24}" font-size="12" font-weight="800" text-anchor="middle" fill="#0c7260" pointer-events="none">${esc(a.name)}</text>`:''}</g>`;
    }
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.innerHTML=s;
    svg.dataset.W=W;svg.dataset.H=H;svg.dataset.cell=cell;svg.dataset.offsetX=offsetX;svg.dataset.offsetY=offsetY;
  }
  function resultView(){
    const sel=$('#selected-sign');sel.innerHTML=project.signs.map(s=>`<option value="${esc(s.id)}" ${s.id===selectedId?'selected':''}>${esc(s.name)}</option>`).join('');
    const all=E.evaluate(project).all.filter(x=>x.signId===selectedId);
    $('#selected-metrics').innerHTML=[['good','視認目安'],['small','文字小'],['blocked','遮蔽']].map(([key,label])=>`<div><b>${all.filter(x=>x.status===key).length}</b><span>${label}</span></div>`).join('');
    const visitors=project.visitors.map(v=>{
      const items=all.filter(x=>x.visitorId===v.id),a=items[0],b=items[1];
      const cell=r=>`<div class="diag-one"><span class="status ${r.status}">${statusName[r.status]}</span><small>${r.posture} · ${n2(r.distance)}m<br>視角 ${r.arcmin.toFixed(1)}′${r.blocker?`<br>遮蔽：${esc(r.blocker.name)}`:''}</small></div>`;
      return `<div class="diag-card"><div class="diag-top"><strong>${esc(v.name)}</strong><small>${esc(v.x)}, ${esc(v.y)} m</small></div><div class="diag-duo">${cell(a)}${cell(b)}</div></div>`;
    }).join('');
    $('#diagnosis').innerHTML=visitors||'<p class="empty">観察地点を追加してください</p>';
    const recs=E.planForSign(project,selectedId,3);
    $('#recommendations').innerHTML=recs.length?recs.map((r,i)=>`<div class="rec"><span class="rec-rank">0${i+1}</span><div class="rec-content"><b>X ${num(r.x)}m · Y ${num(r.y)}m</b><small>目安 ${r.before.good} → ${r.good} / ${project.visitors.length*2}　移動 ${num(r.movement)}m</small></div><button data-move="${i}" aria-label="案${i+1}を適用">適用</button></div>`).join(''):'<div class="empty">現在地より評価が高い候補は見つかりませんでした</div>';
    window.__sikaiSuggestions=recs;
  }
  function render(){fillForm();metrics();drawMap();resultView();$('#btn-rays').classList.toggle('active',rays);$('#btn-rays').setAttribute('aria-pressed',rays);$('#btn-rays').textContent='視線 '+(rays?'ON':'OFF');$('#btn-labels').classList.toggle('active',labels);$('#btn-labels').setAttribute('aria-pressed',labels);$('#btn-labels').textContent='ラベル '+(labels?'ON':'OFF');}
  document.addEventListener('change',ev=>{
    const el=ev.target;
    if(el.matches('[data-top]')){
      const path=el.dataset.top.split('.'),next=clone();let obj=next;for(let i=0;i<path.length-1;i++)obj=obj[path[i]];
      obj[path[path.length-1]]=el.type==='number'?Number(el.value):el.value;
      if(!commit(next))render();
    }else if(el.matches('[data-kind][data-id][data-field]')){
      const next=clone(),obj=next[el.dataset.kind].find(o=>o.id===el.dataset.id);if(!obj)return;
      obj[el.dataset.field]=el.type==='number'?Number(el.value):el.value;
      if(!commit(next))render();
    }
  });
  document.addEventListener('click',ev=>{
    const b=ev.target.closest('button');if(!b)return;
    if(b.dataset.add){
      const k=b.dataset.add,next=clone();if(next[k].length>=(k==='signs'?20:30)){toast('登録件数の上限です');return;}
      const newId=E.makeId(k==='visitors'?'v':k==='obstacles'?'o':'s',next[k]);
      if(k==='visitors')next[k].push({id:newId,name:'新しい観察地点',x:1,y:1});
      if(k==='obstacles')next[k].push({id:newId,name:'新しい什器',x:2,y:2,w:1.4,h:1,z:1.5});
      if(k==='signs'){next[k].push({id:newId,name:'新しいサイン',x:project.room.width-1,y:1,z:1.5,letterMm:30});selectedId=newId;}
      commit(next,'追加しました。数値や配置図を編集できます');
    }else if(b.dataset.del){
      const k=b.dataset.kind,next=clone();if((k==='visitors'||k==='signs')&&next[k].length===1){toast('少なくとも1件必要です');return;}
      next[k]=next[k].filter(o=>o.id!==b.dataset.del);commit(next,'削除しました');
    }else if(b.dataset.select){
      if(b.dataset.kind==='signs'){selectedId=b.dataset.select;render();}else toast('図面上でドラッグして地点を動かせます');
    }else if(b.dataset.move){
      const p=window.__sikaiSuggestions?.[Number(b.dataset.move)];if(!p)return;
      const next=clone(),o=next.signs.find(x=>x.id===selectedId);o.x=p.x;o.y=p.y;commit(next,'改善候補の位置に移動しました');
    }
  });
  $('#selected-sign').addEventListener('change',ev=>{selectedId=ev.target.value;render()});
  $('#btn-rays').addEventListener('click',()=>{rays=!rays;render()});
  $('#btn-labels').addEventListener('click',()=>{labels=!labels;render()});
  $('#btn-recommend').addEventListener('click',()=>{resultView();toast('配置候補を再計算しました')});
  $('#btn-export-json').addEventListener('click',()=>download('sign-sikai-project.json',JSON.stringify(project,null,2),'application/json'));
  $('#btn-csv').addEventListener('click',()=>download('sign-sikai-report.csv',E.reportCsv(project),'text/csv;charset=utf-8'));
  $('#btn-svg').addEventListener('click',()=>{
    const svg=$('#floor').cloneNode(true);for(const g of svg.querySelectorAll('[data-drag]')){g.removeAttribute('data-drag');g.removeAttribute('data-id');}
    svg.setAttribute('xmlns','http://www.w3.org/2000/svg');const xml='<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(svg);
    download('sign-sikai-floor.svg',xml,'image/svg+xml;charset=utf-8');
  });
  $('#btn-print').addEventListener('click',()=>window.print());
  $('#btn-reset').addEventListener('click',()=>{if(confirm('編集内容を破棄してサンプルに戻しますか？')){selectedId='s1';commit(E.demo(),'デモに戻しました');}});
  $('#file-json').addEventListener('change',async ev=>{
    const f=ev.target.files?.[0];if(!f)return;
    try{if(f.size>1000000)throw Error('JSONは1MBまでです');const obj=E.validate(JSON.parse(await f.text()));selectedId=obj.signs[0].id;commit(obj,'JSONを読み込みました');}
    catch(err){toast('読み込み失敗：'+err.message)}finally{ev.target.value='';}
  });
  const svg=$('#floor');
  function pointerToWorld(ev){
    const point=svg.createSVGPoint();point.x=ev.clientX;point.y=ev.clientY;
    const inv=svg.getScreenCTM()?.inverse();if(!inv)return null;
    const pt=point.matrixTransform(inv);return {x:(pt.x-Number(svg.dataset.offsetX))/Number(svg.dataset.cell),y:(pt.y-Number(svg.dataset.offsetY))/Number(svg.dataset.cell)};
  }
  svg.addEventListener('pointerdown',ev=>{
    const el=ev.target.closest('[data-drag]');if(!el)return;
    const kind=el.dataset.drag,id=el.dataset.id,point=pointerToWorld(ev),obj=project[kind].find(x=>x.id===id);if(!point||!obj)return;
    dragging={pointerId:ev.pointerId,kind,id,dx:point.x-obj.x,dy:point.y-obj.y,dirty:false};
    if(kind==='signs')selectedId=id;
    svg.setPointerCapture(ev.pointerId);render();
  });
  svg.addEventListener('pointermove',ev=>{
    if(!dragging||dragging.pointerId!==ev.pointerId)return;
    const pt=pointerToWorld(ev);if(!pt)return;
    const next=clone(),obj=next[dragging.kind].find(x=>x.id===dragging.id);if(!obj)return;
    const maxX=project.room.width-(obj.w||0),maxY=project.room.height-(obj.h||0);
    const x=Math.max(0,Math.min(maxX,Math.round((pt.x-dragging.dx)*20)/20));
    const y=Math.max(0,Math.min(maxY,Math.round((pt.y-dragging.dy)*20)/20));
    if(obj.x===x&&obj.y===y)return;
    obj.x=x;obj.y=y;
    try{project=E.validate(next);dragging.dirty=true;render();}catch(_){/* Skip impossible drag */}
  });
  function finishDrag(ev){if(!dragging||dragging.pointerId!==ev.pointerId)return;if(dragging.dirty)save();dragging=null;}
  svg.addEventListener('pointerup',finishDrag);svg.addEventListener('pointercancel',finishDrag);
  render();
})();
