/* Browser interface for DENPA FUTAAN. MIT. All data remains on this device. */
(function () {
  'use strict';
  const E = window.DenpaEngine;
  const $ = id => document.getElementById(id);
  const safe = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=(n,d=0)=>Number(n).toFixed(d);
  const pct=v=>number(v*100,0)+'%';
  const stored='denpa-futaan-v1';
  let state=E.sample(),mode='ap0',selected=[0,0],drag=null,serial=1,timer;
  function toast(msg){const el=$('toast');el.textContent=msg;el.style.display='block';clearTimeout(timer);timer=setTimeout(()=>el.style.display='none',3300)}
  function saveLocal(){try{localStorage.setItem(stored,JSON.stringify(state));return true}catch(e){return false}}
  function loadLocal(){try{const json=localStorage.getItem(stored);if(json){state=E.validate(JSON.parse(json));return true}}catch(e){}return false}
  function render(){
    const result=E.analyze(state);
    for(const name of ['width','height','band','threshold'])$(name).value=state[name];
    $('wallCount').textContent=state.walls.length;$('zoneCount').textContent=state.zones.length;
    $('scoreA').textContent=pct(result.plans[0].weighted);$('scoreB').textContent=pct(result.plans[1].weighted);
    $('floorA').textContent='床全体 '+pct(result.plans[0].overall);$('floorB').textContent='床全体 '+pct(result.plans[1].overall);
    $('delta').textContent=(result.diff>0?'+':'')+number(result.diff*100,0)+'pt';$('delta').className=result.diff>=0?'positive':'negative';
    $('apsA').textContent=state.plans[0].aps.length+'台';$('apsB').textContent=state.plans[1].aps.length+'台';
    renderWalls();renderZones();renderAPs();renderTables(result);
    renderMap(0);renderMap(1);
    document.querySelectorAll('.mode').forEach(btn=>{btn.classList.toggle('active',btn.dataset.mode===mode);btn.setAttribute('aria-pressed',btn.dataset.mode===mode?'true':'false')});
    const hints={ap0:'Aのルーターを置く',ap1:'Bのルーターを置く',wall:'ドラッグで壁を追加',zone:'ドラッグで部屋を追加'};
    $('hintA').textContent=hints[mode];$('hintB').textContent=hints[mode];
  }
  function renderWalls(){
    $('wallList').innerHTML=state.walls.map((w,i)=>`<div class="item"><div class="item-left"><span>壁 ${i+1} · ${number(Math.hypot(w.x2-w.x1,w.y2-w.y1),1)}m</span></div><select aria-label="壁${i+1}の材質" data-wall-material="${i}">${Object.entries(E.MATERIALS).map(([key,v])=>`<option value="${key}" ${key===w.material?'selected':''}>${v.name} (${v.loss}dB)</option>`).join('')}</select><button class="delete" data-delete-wall="${i}" aria-label="壁${i+1}削除">×</button></div>`).join('')||'<p class="help">壁なし。図面をドラッグして追加。</p>';
  }
  function renderZones(){
    $('zoneList').innerHTML=state.zones.map((z,i)=>`<div class="item"><input aria-label="優先エリア${i+1}の名前" data-zone-name="${i}" maxlength="60" value="${safe(z.name)}"><select aria-label="${safe(z.name)}の重要度" data-zone-priority="${i}"><option value="1" ${z.priority===1?'selected':''}>優先1</option><option value="2" ${z.priority===2?'selected':''}>優先2</option><option value="3" ${z.priority===3?'selected':''}>優先3</option></select><button class="delete" data-delete-zone="${i}" aria-label="エリア${i+1}削除">×</button></div>`).join('')||'<p class="help">部屋なし。床全体の達成率を使います。</p>';
  }
  function renderAPs(){
    $('apList').innerHTML=state.plans.map((p,k)=>`<div class="items-title">${k===0?'現状 A':'移設 B'} <b>${p.aps.length}台</b></div>`+p.aps.map((ap,i)=>`<div class="ap-row"><div class="names"><input type="radio" name="sel${k}" data-select-ap="${k}:${i}" ${selected[k]===i?'checked':''} aria-label="${k?'B':'A'}の${i+1}台目を配置対象にする"> ${i+1}号機</div><div class="coordinates"><label>x<input type="number" min="0" max="${state.width}" step="0.1" value="${number(ap.x,1)}" data-ap-coordinate="${k}:${i}:x"></label><label>y<input type="number" min="0" max="${state.height}" step="0.1" value="${number(ap.y,1)}" data-ap-coordinate="${k}:${i}:y"></label><label>dBm<input type="number" min="0" max="30" step="1" value="${ap.power}" data-ap-coordinate="${k}:${i}:power"></label></div><button class="delete" data-delete-ap="${k}:${i}" aria-label="ルーター${i+1}削除">×</button></div>`).join('')).join('');
  }
  function renderTables(r){
    $('zoneResults').innerHTML=state.zones.map((z,i)=>{const a=r.plans[0].zones[i],b=r.plans[1].zones[i],delta=(b.coverage-a.coverage)*100;return `<tr><td><b>${safe(z.name)}</b><br><small>優先${z.priority}</small></td><td>${pct(a.coverage)}<br><small>${number(a.avg,0)}dBm</small></td><td>${pct(b.coverage)}<br><small>${number(b.avg,0)}dBm</small></td><td class="${delta>=0?'positive':'negative'}"><b>${delta>0?'+':''}${number(delta)}pt</b></td></tr>`}).join('')||'<tr><td colspan="4">重要な部屋を追加するとここに表示されます。</td></tr>';
    const winner=r.diff>=.015?'移設 B が優勢':r.diff<=-.015?'現状 A が優勢':'両案はほぼ同等';
    const worst=state.zones.length?state.zones.map((z,i)=>({name:z.name,value:r.plans[1].zones[i].coverage,priority:z.priority})).sort((a,b)=>a.value-b.value||b.priority-a.priority)[0]:null;
    $('recommendation').innerHTML=`<strong>${winner}</strong><p>重要な部屋の重み付き達成率は、A が <b>${pct(r.plans[0].weighted)}</b>、B が <b>${pct(r.plans[1].weighted)}</b>。これは速度や通信品質の予測ではありません。</p>`+(worst?`<p>移設案で最も達成率が低いのは「<b>${safe(worst.name)}</b>」（${pct(worst.value)}）。ルーターを寄せるか、壁の影響を見直してください。</p>`:'<p>重要な部屋をドラッグで追加すると、部屋ごとに比較できます。</p>')+'<p>次は、候補位置で実機の受信電波（dBm）と通信速度を測って確かめましょう。</p>';
  }
  function heatColor(v){if(v<-78)return '#d9b99a';if(v<-70)return '#e9c8a9';if(v<-62)return '#ecdeac';if(v<-54)return '#a9d4b7';return '#72b8af'}
  function svgMarkup(k){
    const x=n=>n/state.width*960,y=n=>n/state.height*640;
    const g=E.grid(state,k,35),dw=960/g.nx,dh=640/g.ny;
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640" preserveAspectRatio="none" aria-label="プラン${k?'B':'A'}の電波予測図"><rect width="960" height="640" fill="#fafaf5"/>`;
    for(const c of g.items)svg+=`<rect x="${number(c.i*dw,2)}" y="${number(c.j*dh,2)}" width="${number(dw+.6,2)}" height="${number(dh+.6,2)}" fill="${heatColor(c.v)}" opacity="0.8"><title>概算 ${number(c.v,1)} dBm</title></rect>`;
    for(let i=0;i<=6;i++)svg+=`<line x1="${i*160}" x2="${i*160}" y1="0" y2="640" stroke="#fff" stroke-opacity=".22"/><line y1="${i*640/6}" y2="${i*640/6}" x1="0" x2="960" stroke="#fff" stroke-opacity=".22"/>`;
    state.zones.forEach(z=>{svg+=`<rect x="${x(z.x)}" y="${y(z.y)}" width="${x(z.w)}" height="${y(z.h)}" rx="5" fill="#164c47" fill-opacity=".11" stroke="#124943" stroke-width="3" stroke-dasharray="9 6"/><rect x="${x(z.x)+4}" y="${y(z.y)+4}" width="${Math.min(170,Math.max(20,x(z.w)-8))}" height="30" rx="3" fill="#ffffff" fill-opacity=".87"/><text x="${x(z.x)+11}" y="${y(z.y)+25}" font-size="20" font-weight="bold" fill="#1d5045">${safe(z.name.slice(0,9))}</text>`});
    state.walls.forEach(w=>{svg+=`<line x1="${x(w.x1)}" y1="${y(w.y1)}" x2="${x(w.x2)}" y2="${y(w.y2)}" stroke="#fff" stroke-width="11" stroke-linecap="round"/><line x1="${x(w.x1)}" y1="${y(w.y1)}" x2="${x(w.x2)}" y2="${y(w.y2)}" stroke="${w.material==='concrete'?'#394942':'#7b6554'}" stroke-width="7" stroke-linecap="round"/>`});
    state.plans[k].aps.forEach((a,i)=>{svg+=`<g class="ap" data-ap-index="${i}" data-ap-plan="${k}"><circle cx="${x(a.x)}" cy="${y(a.y)}" r="27" fill="${k?'#bd7d42':'#246c58'}" stroke="white" stroke-width="6"/><circle cx="${x(a.x)}" cy="${y(a.y)}" r="7" fill="white"/><text x="${x(a.x)+30}" y="${y(a.y)-18}" font-size="21" fill="#133c33" font-weight="bold" stroke="white" stroke-width="5" paint-order="stroke">AP${i+1}</text></g>`});
    svg+='<rect x="2" y="2" width="956" height="636" fill="none" stroke="#d6d1c4" stroke-width="4"/></svg>';return svg;
  }
  function renderMap(k){$('map'+(k?'B':'A')).innerHTML=svgMarkup(k)}
  function pointFrom(e,svg){const b=svg.getBoundingClientRect();return {x:E.clamp((e.clientX-b.left)/b.width*state.width,0,state.width),y:E.clamp((e.clientY-b.top)/b.height*state.height,0,state.height)}}
  function bindMap(k){const holder=$('map'+(k?'B':'A'));
    holder.addEventListener('pointerdown',e=>{const svg=e.target.closest('svg');if(!svg||!e.isPrimary)return;const pt=pointFrom(e,svg),target=e.target.closest('[data-ap-index]');
      if(target){drag={type:'ap',k,index:Number(target.dataset.apIndex),start:pt};}
      else if(mode==='wall'||mode==='zone'){drag={type:mode,start:pt,k};}
      else{drag={type:'place',start:pt,k};}
      try{svg.setPointerCapture(e.pointerId)}catch(err){}
    });
    holder.addEventListener('pointermove',e=>{if(!drag)return;const svg=holder.querySelector('svg');if(!svg||drag.k!==k)return;const pt=pointFrom(e,svg);
      let preview=svg.querySelector('#preview');if(preview)preview.remove();
      if(drag.type==='wall'){const x=n=>n/state.width*960,y=n=>n/state.height*640;svg.insertAdjacentHTML('beforeend',`<line id="preview" x1="${x(drag.start.x)}" y1="${y(drag.start.y)}" x2="${x(pt.x)}" y2="${y(pt.y)}" stroke="#2d7b61" stroke-width="6" stroke-dasharray="12 7"/>`)}
      if(drag.type==='zone'){const left=Math.min(pt.x,drag.start.x),top=Math.min(pt.y,drag.start.y),w=Math.abs(pt.x-drag.start.x),h=Math.abs(pt.y-drag.start.y);svg.insertAdjacentHTML('beforeend',`<rect id="preview" x="${left/state.width*960}" y="${top/state.height*640}" width="${w/state.width*960}" height="${h/state.height*640}" fill="#2b887b" fill-opacity=".19" stroke="#1b5748" stroke-width="4"/>`)}
      if(drag.type==='ap'){const g=svg.querySelector(`[data-ap-index="${drag.index}"]`);if(g){g.querySelectorAll('circle').forEach(el=>{el.setAttribute('cx',pt.x/state.width*960);el.setAttribute('cy',pt.y/state.height*640)});g.querySelector('text').setAttribute('x',pt.x/state.width*960+30);g.querySelector('text').setAttribute('y',pt.y/state.height*640-18)}}
    });
    holder.addEventListener('pointerup',e=>{if(!drag||drag.k!==k)return;const d=drag;drag=null;const svg=holder.querySelector('svg');const pt=pointFrom(e,svg);
      if(d.type==='ap'){state.plans[d.k].aps[d.index].x=pt.x;state.plans[d.k].aps[d.index].y=pt.y;selected[d.k]=d.index}
      else if(d.type==='wall'){if(Math.hypot(pt.x-d.start.x,pt.y-d.start.y)>.2){state.walls.push({id:'w'+Date.now()+serial++,x1:d.start.x,y1:d.start.y,x2:pt.x,y2:pt.y,material:$('wallMaterial').value});if(state.walls.length>50){state.walls.pop();toast('壁は最大50本です')}}}
      else if(d.type==='zone'){const left=Math.min(pt.x,d.start.x),top=Math.min(pt.y,d.start.y),w=Math.abs(pt.x-d.start.x),h=Math.abs(pt.y-d.start.y);if(w>=.4&&h>=.4){state.zones.push({id:'z'+Date.now()+serial++,x:left,y:top,w,h,name:'部屋 '+(state.zones.length+1),priority:2});if(state.zones.length>20){state.zones.pop();toast('重要エリアは最大20件です')}}}
      else if(d.type==='place'){const dest=mode==='ap1'?1:0;if(state.plans[dest].aps.length===0){state.plans[dest].aps.push({id:'a'+Date.now()+serial++,x:pt.x,y:pt.y,power:16});selected[dest]=0}else{const target=state.plans[dest].aps[Math.min(selected[dest],state.plans[dest].aps.length-1)];target.x=pt.x;target.y=pt.y}}
      render();saveLocal();
    });
    holder.addEventListener('pointercancel',()=>{drag=null;renderMap(k)});
  }
  function download(filename,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  function toCSV(){const r=E.analyze(state);let rows=[['エリア','重要度','面積m2','A 達成率%','A 平均dBm','B 達成率%','B 平均dBm','B-A pt']];state.zones.forEach((z,i)=>{let a=r.plans[0].zones[i],b=r.plans[1].zones[i];rows.push([z.name,z.priority,number(z.w*z.h,2),number(a.coverage*100),number(a.avg,1),number(b.coverage*100),number(b.avg,1),number((b.coverage-a.coverage)*100)])});rows.push(['床全体','',number(r.area,2),number(r.plans[0].overall*100),'',number(r.plans[1].overall*100),'','']);rows.push(['重み付き','', '',number(r.plans[0].weighted*100),'',number(r.plans[1].weighted*100),'',number(r.diff*100)]);return '\ufeff'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n')}
  function importJSON(file){if(!file||file.size>1_000_000){toast('JSONは1MB以下にしてください');return}const reader=new FileReader();reader.onload=()=>{try{const incoming=JSON.parse(String(reader.result));state=E.validate(incoming);selected=[0,0];render();saveLocal();toast('JSONを読み込みました（元の設計は置き換えられました）')}catch(e){toast('読み込み失敗: '+e.message)}};reader.readAsText(file)}
  function listen(){
    ['width','height','band','threshold'].forEach(id=>$(id).addEventListener('change',()=>{const value=id==='band'?$(id).value:Number($(id).value);const candidate=structuredClone(state);candidate[id]=value;
      if(id==='width'||id==='height'){
        const old=state[id];const scale=value/old;
        if(!(value>=3&&value<=(id==='width'?40:30))){toast('寸法は3〜'+(id==='width'?40:30)+'mです');render();return}
        for(const ap of candidate.plans.flatMap(p=>p.aps))ap[id==='width'?'x':'y']*=scale;
        for(const w of candidate.walls){if(id==='width'){w.x1*=scale;w.x2*=scale}else{w.y1*=scale;w.y2*=scale}}
        for(const z of candidate.zones){if(id==='width'){z.x*=scale;z.w*=scale}else{z.y*=scale;z.h*=scale}}
      }
      try{state=E.validate(candidate);render();saveLocal()}catch(e){toast(e.message);render()}
    }));
    document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;render()}));
    $('wallList').addEventListener('click',e=>{const btn=e.target.closest('[data-delete-wall]');if(!btn)return;state.walls.splice(+btn.dataset.deleteWall,1);render();saveLocal()});
    $('wallList').addEventListener('change',e=>{const el=e.target.closest('[data-wall-material]');if(el){state.walls[+el.dataset.wallMaterial].material=el.value;render();saveLocal()}});
    $('zoneList').addEventListener('click',e=>{const btn=e.target.closest('[data-delete-zone]');if(!btn)return;state.zones.splice(+btn.dataset.deleteZone,1);render();saveLocal()});
    $('zoneList').addEventListener('change',e=>{const el=e.target;if(el.dataset.zoneName!==undefined)state.zones[+el.dataset.zoneName].name=el.value.slice(0,60);if(el.dataset.zonePriority!==undefined)state.zones[+el.dataset.zonePriority].priority=+el.value;render();saveLocal()});
    $('apList').addEventListener('change',e=>{const el=e.target;if(el.dataset.selectAp){const [k,i]=el.dataset.selectAp.split(':').map(Number);selected[k]=i;mode=k?'ap1':'ap0';render();return}if(el.dataset.apCoordinate){const [k,i,field]=el.dataset.apCoordinate.split(':');const n=+el.value,max=field==='power'?30:field==='x'?state.width:state.height;if(!Number.isFinite(n)||n<0||n>max){toast('入力値が範囲外です');render();return}state.plans[+k].aps[+i][field]=n;render();saveLocal()}});
    $('apList').addEventListener('click',e=>{const el=e.target.closest('[data-delete-ap]');if(!el)return;const [k,i]=el.dataset.deleteAp.split(':').map(Number);state.plans[k].aps.splice(i,1);selected[k]=0;render();saveLocal()});
    [0,1].forEach(k=>{bindMap(k);$('add'+(k?'B':'A')).addEventListener('click',()=>{const p=state.plans[k];if(p.aps.length>=5){toast('1案のルーターは最大5台です');return}p.aps.push({id:'a'+Date.now()+serial++,x:state.width/2,y:state.height/2,power:16});selected[k]=p.aps.length-1;mode=k?'ap1':'ap0';render();saveLocal();toast('図面をクリックすると新しいルーターを移動できます')})});
    $('sampleBtn').addEventListener('click',()=>{state=E.sample();selected=[0,0];mode='ap0';render();saveLocal();toast('サンプルを復元しました')});
    $('saveBtn').addEventListener('click',()=>toast(saveLocal()?'このブラウザに保存しました':'保存できません。JSON保存をご利用ください'));
    $('exportBtn').addEventListener('click',()=>download('denpa-futaan.json',JSON.stringify(state,null,2),'application/json'));
    $('csvBtn').addEventListener('click',()=>download('denpa-futaan-report.csv',toCSV(),'text/csv;charset=utf-8'));
    $('svgBtn').addEventListener('click',()=>download('denpa-futaan-plan-B.svg',svgMarkup(1),'image/svg+xml;charset=utf-8'));
    $('printBtn').addEventListener('click',()=>window.print());
    $('importFile').addEventListener('change',e=>{importJSON(e.target.files[0]);e.target.value=''});
  }
  loadLocal();listen();render();
  window.__DENPA_TEST__={getState:()=>structuredClone(state),analyze:()=>E.analyze(state)};
})();
