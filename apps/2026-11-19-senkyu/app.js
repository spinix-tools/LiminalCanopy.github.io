(function(){'use strict';
const E=window.Senkyu,KEY='senkyu:project:v1', $=s=>document.querySelector(s),esc=E.escapeXml;
let state,selected,toastTimer=0,fromChoice=null,toChoice=null;
try{const raw=localStorage.getItem(KEY);state=raw?E.normalize(JSON.parse(raw)):E.sample();}catch(e){state=E.sample();}
selected=state.devices[0]?.id||null;
function notice(s){const el=$('#toast');el.textContent=s;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2900);}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){ /* storage optional: JSON export remains available */ }}
function commit(){state=E.normalize(state);save();render();}
function option(value,label,chosen){return `<option value="${esc(value)}" ${value===chosen?'selected':''}>${esc(label)}</option>`;}
function download(name,content,mime){const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
function render(){const a=E.analyze(state);state=a.project;renderStats(a);renderDevices();renderCanvas(a);renderConnectSelects();renderCables(a);renderImpact(a);renderGuides();$('#projectName').value=state.project;$('#slack').value=state.slack;}
function renderStats(a){const cells=[['機材数',a.project.devices.length,'SOURCE / RELAY / SINK',''],['配線数',a.project.cables.length,'接続経路',''],['要修正',a.errors,`${a.warnings}件の距離ガイド注意` ,a.errors?'danger':'good'],['信号未到達',a.unreached,`到達 ${a.reachable} / 受信先 ${a.destinations.length}`,a.unreached?'danger':'good']];$('#stats').innerHTML=cells.map(x=>`<div class="metric"><div class="metricLabel">${x[0]}</div><div class="metricValue ${x[3]}">${x[1]}</div><div class="metricNote">${x[2]}</div></div>`).join('');}
function renderDevices(){const d=state.devices.find(x=>x.id===selected);if(!d)selected=state.devices[0]?.id||null;const item=state.devices.find(x=>x.id===selected);$('#deviceCount').textContent=`${state.devices.length} DEVICES`;
 $('#deviceList').innerHTML=state.devices.map(x=>`<div class="deviceItem ${x.id===selected?'active':''}"><button data-select="${esc(x.id)}"><span class="dname">${esc(x.name)}</span><span class="dmeta">${x.kind==='source'?'送信元':x.kind==='sink'?'受信先':'中継'} · ${x.ports.length}端子</span></button><button class="remove" aria-label="${esc(x.name)}を削除" data-rmdev="${esc(x.id)}">×</button></div>`).join('')||'<p class="aside">「＋」で機材を追加してください。</p>';
 const box=$('#deviceEditor');box.style.display=item?'grid':'none';if(!item)return;
 $('#editName').value=item.name;$('#editKind').value=item.kind;$('#editX').value=item.x;$('#editY').value=item.y;
 $('#portsList').innerHTML=item.ports.map(p=>`<div class="portItem"><span><b>${p.dir.toUpperCase()}</b> ${esc(p.name)}</span><span>${p.type} <button aria-label="端子を削除" data-rmport="${esc(p.id)}">×</button></span></div>`).join('')||'<span class="aside">端子がありません。</span>';
}
function renderCanvas(a){$('#svgMount').innerHTML=E.diagramSvg(state);$('#dragLayer').innerHTML=state.devices.map(d=>`<div class="dragZone ${d.id===selected?'active':''}" data-drag="${esc(d.id)}" tabindex="0" role="button" aria-label="${esc(d.name)}の位置を移動" style="left:${d.x}px;top:${d.y}px"></div>`).join('');}
function renderConnectSelects(){const fdev=$('#fromDev'),tdev=$('#toDev'),fport=$('#fromPort'),tport=$('#toPort');const prevF=fromChoice||fdev.value,prevT=toChoice||tdev.value;
 const sources=state.devices.filter(d=>d.ports.some(p=>p.dir==='out')),targets=state.devices.filter(d=>d.ports.some(p=>p.dir==='in'));
 fdev.innerHTML=sources.map(d=>option(d.id,d.name,d.id===prevF?d.id:'')).join('');tdev.innerHTML=targets.map(d=>option(d.id,d.name,d.id===prevT?d.id:'')).join('');
 fromChoice=fdev.value;toChoice=tdev.value;const f=state.devices.find(d=>d.id===fromChoice),t=state.devices.find(d=>d.id===toChoice);
 const fp=fport.value,tp=tport.value;fport.innerHTML=(f?.ports||[]).filter(p=>p.dir==='out').map(p=>option(p.id,p.name+' · '+p.type,fp)).join('');tport.innerHTML=(t?.ports||[]).filter(p=>p.dir==='in').map(p=>option(p.id,p.name+' · '+p.type,tp)).join('');
 $('#btnAddCable').disabled=!(fport.value&&tport.value);
}
function renderCables(a){$('#cableCount').textContent=`${state.cables.length} CABLES`;
 $('#cableList').innerHTML=state.cables.map((c,i)=>{const s=a.lines[i],cls=s.errors.length?'bad':s.warnings.length?'warn':'',label=s.errors.length?'要修正':s.warnings.length?'要確認':'OK';return `<div class="cableItem ${cls}"><div class="cableHeading"><span class="cableName">C${String(i+1).padStart(2,'0')} · ${esc(s.source?.device.name||'不明')} → ${esc(s.target?.device.name||'不明')}</span><span class="pill ${cls}">${label}</span></div><div class="dmeta">${esc(s.source?.port.name||'不明')} → ${esc(s.target?.port.name||'不明')}</div><div class="cableFields"><label>経路 m<input type="number" data-cable="${esc(c.id)}" data-field="route" min="0" max="10000" step="0.1" value="${c.route}"></label><label>手持ち m<input type="number" data-cable="${esc(c.id)}" data-field="stock" min="0" max="10000" step="0.1" value="${c.stock}"></label><button data-rmcable="${esc(c.id)}" aria-label="ケーブルを削除">×</button></div><div class="dmeta" style="margin-top:6px">必要 ${s.required}m（余長込） / 不足 ${s.shortage.toFixed(1)}m</div>${s.errors.length||s.warnings.length?`<p>${esc([...s.errors,...s.warnings].join(' / '))}</p>`:''}</div>`;}).join('')||'<p class="aside">まだ接続がありません。</p>';
 const previous=state.failed;$('#failed').innerHTML='<option value="">取り外しなし（通常）</option>'+state.cables.map((c,i)=>option(c.id,`C${i+1} · ${a.lines[i].source?.device.name||'不明'} → ${a.lines[i].target?.device.name||'不明'}`,previous)).join('');
}
function renderImpact(a){const normal=a.destinations.map(d=>`<span class="${d.online?'good':'danger'}">${esc(d.name)}：${d.online?'推定到達':'未到達'}</span>`).join(' / ');$('#impact').innerHTML=state.failed?`<strong>影響する受信先：${a.impacts.length}件</strong><div>${a.impacts.length?a.impacts.map(esc).join('・'):'通常時に到達していた受信先への追加影響なし'}</div><div>通常時：${normal||'受信先なし'}</div>`:`<div>通常時：${normal||'受信先なし'}</div><div class="aside">取り外すケーブルを選ぶと、接続経路の差分を表示します。</div>`;}
function renderGuides(){$('#guideGrid').innerHTML=E.TYPES.map(t=>`<label>${t} · 参考距離 m<input data-guide="${t}" type="number" step="0.1" min="0.1" max="10000" value="${state.guides[t]}"></label>`).join('');}
function on(id,event,fn){$(id).addEventListener(event,fn);}
on('#btnSample','click',()=>{state=E.sample();selected=state.devices[0].id;commit();notice('見本を再読み込みしました');});
on('#btnNew','click',()=>{state={project:'新しい配線計画',devices:[],cables:[],slack:20,guides:{...E.GUIDE},failed:null};selected=null;commit();notice('新しい計画を作成しました');});
on('#btnAddDevice','click',()=>{if(state.devices.length>=40)return notice('機材は40台までです');const i=state.devices.length;const d=E.makeDevice($('#preset').value,50+((i%3)*290),80+(Math.floor(i/3)%5)*135);state.devices.push(d);selected=d.id;commit();});
on('#deviceList','click',e=>{const s=e.target.closest('[data-select]'),r=e.target.closest('[data-rmdev]');if(s){selected=s.dataset.select;renderDevices();renderCanvas(E.analyze(state));}if(r){const id=r.dataset.rmdev;state.devices=state.devices.filter(d=>d.id!==id);state.cables=state.cables.filter(c=>c.from.device!==id&&c.to.device!==id);selected=state.devices[0]?.id||null;commit();}});
on('#editName','change',e=>{const d=state.devices.find(d=>d.id===selected);if(d){d.name=e.target.value||'機材';commit();}});
on('#editKind','change',e=>{const d=state.devices.find(d=>d.id===selected);if(d){d.kind=e.target.value;commit();}});
for(const k of ['X','Y'])on('#edit'+k,'change',e=>{const d=state.devices.find(d=>d.id===selected);if(d){d[k.toLowerCase()]=Number(e.target.value);commit();}});
on('#portsList','click',e=>{const r=e.target.closest('[data-rmport]');if(!r)return;const d=state.devices.find(d=>d.id===selected);if(!d)return;const id=r.dataset.rmport;d.ports=d.ports.filter(p=>p.id!==id);state.cables=state.cables.filter(c=>!(c.from.device===d.id&&c.from.port===id)&&!(c.to.device===d.id&&c.to.port===id));commit();});
on('#btnAddPort','click',()=>{const d=state.devices.find(d=>d.id===selected);if(!d||d.ports.length>=12)return notice('機材なし、または端子上限12個です');const n=$('#newPortName').value.trim();if(!n)return notice('端子名を入力してください');d.ports.push({id:'p_'+Math.random().toString(36).slice(2,10),name:n,type:$('#newPortType').value,dir:$('#newPortDir').value});$('#newPortName').value='';commit();});
on('#fromDev','change',()=>{fromChoice=$('#fromDev').value;renderConnectSelects();});on('#toDev','change',()=>{toChoice=$('#toDev').value;renderConnectSelects();});
on('#btnAddCable','click',()=>{if(state.cables.length>=100)return notice('ケーブル上限100本です');const from={device:$('#fromDev').value,port:$('#fromPort').value},to={device:$('#toDev').value,port:$('#toPort').value};if(!E.portFor(state,from)||!E.portFor(state,to))return notice('端子を選択してください');state.cables.push({id:'c_'+Math.random().toString(36).slice(2,10),from,to,route:Number($('#route').value),stock:Number($('#stock').value)});commit();});
on('#cableList','click',e=>{const r=e.target.closest('[data-rmcable]');if(r){state.cables=state.cables.filter(c=>c.id!==r.dataset.rmcable);if(state.failed===r.dataset.rmcable)state.failed=null;commit();}});
on('#cableList','change',e=>{const input=e.target.closest('[data-cable]');if(!input)return;const c=state.cables.find(c=>c.id===input.dataset.cable);if(c){c[input.dataset.field]=Math.max(0,Number(input.value)||0);commit();}});
on('#failed','change',e=>{state.failed=e.target.value||null;commit();});
on('#slack','change',e=>{state.slack=Number(e.target.value);commit();});on('#guideGrid','change',e=>{if(e.target.dataset.guide){state.guides[e.target.dataset.guide]=Number(e.target.value);commit();}});
on('#projectName','change',e=>{state.project=e.target.value;commit();});
on('#btnExport','click',()=>download('senkyu-project.json',JSON.stringify(state,null,2),'application/json;charset=utf-8'));
on('#btnJsonBottom','click',()=>download('senkyu-project.json',JSON.stringify(state,null,2),'application/json;charset=utf-8'));
on('#btnCsv','click',()=>download('senkyu-cables.csv',E.cableCsv(state),'text/csv;charset=utf-8'));
on('#btnSvg','click',()=>download('senkyu-signal-map.svg',E.diagramSvg(state),'image/svg+xml;charset=utf-8'));
on('#btnImport','click',()=>$('#fileInput').click());on('#fileInput','change',async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>2e6)throw Error('JSONは2MBまでです');state=E.normalize(JSON.parse(await f.text()));selected=state.devices[0]?.id||null;commit();notice('JSONを読み込みました');}catch(err){notice('読込エラー: '+err.message);}e.target.value='';});
on('#btnPrint','click',()=>window.print());
// Pointer move uses only the actual device cards: no coordinate system or network calls required.
let dragging=null;
on('#dragLayer','pointerdown',e=>{const el=e.target.closest('[data-drag]');if(!el)return;const d=state.devices.find(d=>d.id===el.dataset.drag);if(!d)return;selected=d.id;const stage=$('#canvasStage').getBoundingClientRect();dragging={id:d.id,el,dx:e.clientX-stage.left-d.x,dy:e.clientY-stage.top-d.y};el.setPointerCapture(e.pointerId);});
on('#dragLayer','pointermove',e=>{if(!dragging)return;const d=state.devices.find(d=>d.id===dragging.id);if(!d)return;const stage=$('#canvasStage').getBoundingClientRect();d.x=Math.round(Math.max(0,Math.min(820,e.clientX-stage.left-dragging.dx)));d.y=Math.round(Math.max(0,Math.min(590,e.clientY-stage.top-dragging.dy)));dragging.el.style.left=d.x+'px';dragging.el.style.top=d.y+'px';$('#svgMount').innerHTML=E.diagramSvg(state);});
on('#dragLayer','pointerup',()=>{if(dragging){dragging=null;commit();}});on('#dragLayer','pointercancel',()=>{if(dragging){dragging=null;commit();}});
on('#dragLayer','keydown',e=>{const el=e.target.closest('[data-drag]');if(!el)return;const d=state.devices.find(d=>d.id===el.dataset.drag);if(!d)return;const speed=e.shiftKey?20:10;let change=true;switch(e.key){case'ArrowRight':d.x+=speed;break;case'ArrowLeft':d.x-=speed;break;case'ArrowUp':d.y-=speed;break;case'ArrowDown':d.y+=speed;break;default:change=false;}if(change){e.preventDefault();selected=d.id;commit();}});
render();
})();
