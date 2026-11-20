/* MAGARI PASS interactive UI. No network calls. */
(() => {
'use strict';
const E=globalThis.MagariEngine;
const $=id=>document.getElementById(id);
const numberFields=['hallLength','hallWidth','turnWidth','riseLength','ceiling','itemLength','itemDepth','itemHeight','clearance'];
const obsMap={x:'obsX',y:'obsY',w:'obsW',h:'obsH'};
const presets={sofa:[190,65,85],fridge:[68,72,175],shelf:[110,45,195],box:[90,65,70]};
const cacheKey='magari-pass-v1';
let model=E.normalize(E.DEFAULT), results={}, selection='normal',playTimer=null,poses=[];
function fmt(n){return Number(n.toFixed(1)).toLocaleString('ja-JP')}
function read(){const p=E.normalize(model);for(const key of numberFields)p[key]=Number($(key).value);p.grid=Number($('grid').value);p.obstacle.enabled=$('obstacleEnabled').checked;for(const k in obsMap)p.obstacle[k]=Number($(obsMap[k]).value);return p;}
function fill(p){model=E.normalize(p);for(const k of numberFields)$(k).value=model[k];$('grid').value=String(model.grid);$('obstacleEnabled').checked=model.obstacle.enabled;for(const k in obsMap)$(obsMap[k]).value=model.obstacle[k];}
function persist(){try{localStorage.setItem(cacheKey,JSON.stringify(model));}catch(_){}}
function stop(){if(playTimer){clearInterval(playTimer);playTimer=null;}$('play').textContent='▶ 再生';}
function calculate(){stop();const p=read(),errors=E.validate(p);if(errors.length){$('feedback').textContent=errors.join('、');return false;}model=p;persist();$('feedback').textContent='';results={normal:E.solve({...p,mode:'normal'}),side:E.solve({...p,mode:'side'})};render();return true;}
function statusLabel(r){return r.status==='found'?'候補あり':r.status==='not-found'?'未発見':r.status==='headroom'?'高さ注意':r.status==='start'?'入口に置けない':r.status==='goal'?'終端に置けない':'要確認';}
function showCards(){let html='';for(const [key,tag,title] of [['normal','A','通常姿勢'],['side','B','横倒し姿勢']]){
  const r=results[key],f=r.footprint;const found=r.status==='found';const desc=key==='normal'?'床：長さ × 奥行':'床：長さ × 高さ（横倒し可能な場合のみ）';
  html+=`<button type="button" data-mode="${key}" class="option ${selection===key?'selected':''}" aria-pressed="${selection===key}"><div class="option-header"><div class="option-name">${tag}｜${title}<small>${desc}</small></div><span class="option-status ${found?'good':r.status==='not-found'?'warn':''}">${statusLabel(r)}</span></div><div class="option-number">${fmt(f.L)} × ${fmt(f.D)} <small style="font-size:12px;font-weight:600">cm</small></div><div class="option-detail">搬送時の高さ ${fmt(f.upright)}cm　/　探索 ${fmt(r.expanded)} 状態</div></button>`;
}
$('comparison').innerHTML=html;for(const b of $('comparison').querySelectorAll('button'))b.onclick=()=>{stop();selection=b.dataset.mode;render();};}
function pointStr(pt){return `${pt[0].toFixed(2)},${(model.riseLength-pt[1]).toFixed(2)}`;}
function polygon(points){return points.map(pointStr).join(' ');}
function draw(r){
  const p=model,L=p.hallLength,H=p.riseLength,hw=p.hallWidth,tw=p.turnWidth,scale=1;
  let points=`0,${H} ${L},${H} ${L},0 ${L-tw},0 ${L-tw},${H-hw} 0,${H-hw}`;
  let shape=`<polygon points="${points}" fill="#e6f2ed" stroke="#527e6d" stroke-width="3" stroke-linejoin="round"/>`;
  let grid='';for(let x=0;x<=L;x+=50)grid+=`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#d8e2da" opacity=".35"/>`;
  for(let y=0;y<=H;y+=50)grid+=`<line x1="0" y1="${y}" x2="${L}" y2="${y}" stroke="#d8e2da" opacity=".35"/>`;
  const dark=`<rect x="0" y="0" width="${L-tw}" height="${H-hw}" fill="#e5eae2"/>`;
  const o=p.obstacle, obstacle=o.enabled?`<rect x="${o.x}" y="${H-o.y-o.h}" width="${o.w}" height="${o.h}" fill="#bc6e51" stroke="#994f36" stroke-width="1" rx="2"/><text x="${o.x+o.w/2}" y="${H-o.y-o.h-7}" text-anchor="middle" font-size="12" fill="#96563c">突起</text>`:'';
  const f=r.footprint;
  poses=r.path||[];
  const slider=$('stepRange');slider.max=Math.max(0,poses.length-1);slider.value=poses.length?String(poses.length-1):'0';slider.disabled=!poses.length;
  let route=poses.length?`<polyline points="${poses.map(v=>pointStr([v.x,v.y])).join(' ')}" fill="none" stroke="#eab84e" stroke-width="5" opacity=".96" stroke-linecap="round" stroke-linejoin="round"/>`:'';
  const labels=`<text x="8" y="${H-12}" font-size="14" fill="#35594f">入口 →</text><text x="${L-tw/2}" y="15" font-size="14" text-anchor="middle" fill="#35594f">↑ 搬入先</text><text x="${Math.max(7,(L-tw)/2)}" y="${H-hw+18}" font-size="12" text-anchor="middle" fill="#849c90">横通路：${hw}cm</text><text x="${L+9}" y="${H/2}" font-size="12" fill="#52786b">縦通路 ${tw}cm</text>`;
  $('diagram').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -35 ${L+92} ${H+65}" aria-label="通路の縮尺図と家具の搬入位置" role="img"><rect x="-14" y="-35" width="${L+92}" height="${H+65}" fill="#fcfdfa"/><g>${grid}</g>${dark}${shape}${obstacle}${route}${labels}<g id="moving-item"></g></svg>`;
  updatePose();
}
function updatePose(){const r=results[selection],path=r.path||[],k=Math.min(Number($('stepRange').value),Math.max(0,path.length-1));const group=document.getElementById('moving-item');
  if(!group){return;}if(!path.length){group.innerHTML='';$('poseLabel').textContent='表示位置：経路未発見';$('poseDetail').textContent='—';$('prevPose').disabled=$('nextPose').disabled=$('play').disabled=true;return;}
  const pose=path[k],poly=E.corners(pose.x,pose.y,r.footprint.L,r.footprint.D,pose.a);
  group.innerHTML=`<polygon points="${polygon(poly)}" fill="#166d60" fill-opacity=".78" stroke="#124c44" stroke-width="2.5"/><line x1="${pose.x}" y1="${model.riseLength-pose.y}" x2="${(pose.x+Math.cos(pose.a*Math.PI/180)*r.footprint.L/3).toFixed(2)}" y2="${(model.riseLength-pose.y-Math.sin(pose.a*Math.PI/180)*r.footprint.L/3).toFixed(2)}" stroke="white" stroke-width="3" stroke-linecap="round"/><circle cx="${pose.x}" cy="${model.riseLength-pose.y}" r="3" fill="white"/>`;
  $('poseLabel').textContent=`表示位置：${k+1} / ${path.length}`;$('poseDetail').textContent=`座標 ${fmt(pose.x)}, ${fmt(pose.y)}cm ・角度 ${pose.a}°`;
  $('prevPose').disabled=k===0;$('nextPose').disabled=k>=path.length-1;$('play').disabled=path.length<=1;
}
function explanation(r){const found=r.status==='found';let text='';
  if(found){const s=E.sampleStats(model,r);text=`<p><strong>この向きでは2D経路候補が見つかりました。</strong> 格子探索で${fmt(r.expanded)}状態を調べ、${s.points}地点の経路を表示しています。スライダーで曲がり角での姿勢を確かめられます。</p><div class="metrics"><span class="metric">移動の概算<b>${fmt(s.length)} cm</b></span><span class="metric">向きの変更<b>${fmt(s.turns)} 回</b></span><span class="metric">家具の高さ<b>${fmt(s.footprint.upright)} cm</b></span></div>`;}
  else text=`<p><strong>経路候補を確認できませんでした。</strong> ${r.message||''}</p><p>比較カードで別の姿勢に切り替えるか、通路・突起・余裕寸法の実測値を見直し、5cm格子で再検索してください。</p>`;
  text+=`<p style="color:#657b72;font-size:12px">実物では手すり・ドアの開き・吊り上げ・段差・持ち手・設置先の奥行、家具を傾けた時の重心、安全な作業人数を別途確認してください。横倒しできない機器はBを使わないでください。</p>`;
  $('explanation').innerHTML=text;
}
function render(){showCards();$('diagramTitle').textContent=selection==='normal'?'通常姿勢の搬入経路':'横倒し姿勢の搬入経路';draw(results[selection]);explanation(results[selection]);}
function download(name,mime,data){const blob=new Blob([data],{type:mime});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function serialize(){return JSON.stringify({app:'magari-pass',version:1,project:model},null,2);}
$('calculate').onclick=calculate;
$('exportJson').onclick=()=>download('magari-pass-project.json','application/json;charset=utf-8',serialize());
$('downloadSvg').onclick=()=>{const svg=$('diagram').querySelector('svg');if(!svg)return;download('magari-pass-route.svg','image/svg+xml;charset=utf-8',`<?xml version="1.0" encoding="UTF-8"?>\n${svg.outerHTML}`);};
$('print').onclick=()=>window.print();
$('reset').onclick=()=>{if(!confirm('入力した寸法を初期状態に戻しますか？'))return;fill(E.DEFAULT);document.querySelectorAll('.chip').forEach(b=>b.classList.toggle('active',b.dataset.preset==='sofa'));calculate();};
$('importJson').onchange=async ev=>{const file=ev.target.files?.[0];if(!file)return;try{if(file.size>250000)throw Error('JSONのサイズが大きすぎます');const data=JSON.parse(await file.text());if(data.app!=='magari-pass'||data.version!==1||!data.project||typeof data.project!=='object')throw Error('このアプリのJSONではありません');const proposed=E.normalize(data.project),err=E.validate(proposed);if(err.length)throw Error(err.join('、'));fill(proposed);calculate();$('feedback').textContent='JSONを復元しました';}catch(e){$('feedback').textContent=`読み込み失敗: ${e.message}`;}finally{ev.target.value='';}};
for(const b of document.querySelectorAll('.chip'))b.onclick=()=>{const a=presets[b.dataset.preset];if(!a)return;[$('itemLength').value,$('itemDepth').value,$('itemHeight').value]=a;for(const btn of document.querySelectorAll('.chip'))btn.classList.toggle('active',btn===b);calculate();};
$('stepRange').oninput=()=>{stop();updatePose();};
$('prevPose').onclick=()=>{$('stepRange').value=Math.max(0,Number($('stepRange').value)-1);stop();updatePose();};
$('nextPose').onclick=()=>{$('stepRange').value=Math.min(Number($('stepRange').max),Number($('stepRange').value)+1);stop();updatePose();};
$('play').onclick=()=>{if(playTimer){stop();return;}if(Number($('stepRange').value)>=Number($('stepRange').max))$('stepRange').value=0;$('play').textContent='⏸ 停止';playTimer=setInterval(()=>{let next=Number($('stepRange').value)+1;if(next>Number($('stepRange').max)){stop();return;}$('stepRange').value=next;updatePose();},240);};
window.addEventListener('beforeunload',stop);
try{const saved=localStorage.getItem(cacheKey);if(saved){let p=E.normalize(JSON.parse(saved));if(!E.validate(p).length)model=p;}}catch(_){/* private mode */}
fill(model);calculate();
})();