(function(){'use strict';
const E=window.HakoEngine;const KEY='hako-kyokai-v1';const $=id=>document.getElementById(id);
const EXAMPLE={padding:3,items:[{id:'i1',name:'陶器の小箱',l:105,w:95,h:65,qty:2,orientation:'upright',weight:350},{id:'i2',name:'薄型ノート',l:180,w:125,h:16,qty:2,orientation:'free',weight:130},{id:'i3',name:'カードセット',l:130,w:90,h:12,qty:1,orientation:'free',weight:55}],boxes:[{id:'b1',name:'小型 S',l:210,w:160,h:115,wall:3,tare:120},{id:'b2',name:'標準 M',l:280,w:210,h:160,wall:3,tare:190},{id:'b3',name:'余裕 L',l:325,w:245,h:195,wall:4,tare:270}]};
const colors=['#3d8192','#dba566','#a28ab8','#83a98c','#dc8880','#598dac','#b0ac72','#a8a0a0'];
let state=load();let itemEdit=null,boxEdit=null,selected=null,latest=null,timer=null;
function fresh(){return JSON.parse(JSON.stringify(EXAMPLE));}
function load(){try{let s=JSON.parse(localStorage.getItem(KEY));if(s&&Array.isArray(s.items)&&Array.isArray(s.boxes)&&Number.isFinite(s.padding)&&s.items.every(E.validateItem)&&s.boxes.every(E.validateBox))return s;}catch(_){}return fresh();}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));$('storeStatus').textContent='変更内容はこのブラウザに保存済みです。';}catch(e){$('storeStatus').textContent='保存できないブラウザです。JSON保存をご利用ください。';}}
function id(){return 'x'+Math.random().toString(36).slice(2,10);}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function pretty(v){return Number(v).toLocaleString('ja-JP');}
function toast(message){let el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>el.classList.remove('show'),3500);}
function readForm(form,keys){let o={};for(const key of keys){let elem=form.elements.namedItem(key);o[key]=['l','w','h','qty','weight','wall','tare'].includes(key)?Number(elem.value):elem.value.trim();}return o;}
function fillForm(form,obj,keys){for(const key of keys)form.elements.namedItem(key).value=obj[key];}
function resetForm(kind){if(kind==='item'){itemEdit=null;$('itemSubmit').textContent='＋ 商品を追加';$('itemCancel').hidden=true;$('itemForm').reset();}else{boxEdit=null;$('boxSubmit').textContent='＋ 箱を追加';$('boxCancel').hidden=true;$('boxForm').reset();}}
function renderLists(){
 $('itemList').innerHTML=state.items.length?state.items.map(o=>`<div class="item"><div><strong>${esc(o.name)} × ${o.qty}</strong><small>${o.l} × ${o.w} × ${o.h} mm ・ ${o.weight}g/個 ・ ${o.orientation==='free'?'回転自由':o.orientation==='upright'?'上下固定':'向き固定'}</small></div><div class="tools"><button data-kind="item" data-action="edit" data-id="${esc(o.id)}" class="btn ghost tiny">編集</button><button data-kind="item" data-action="delete" data-id="${esc(o.id)}" class="btn ghost tiny">削除</button></div></div>`).join(''):'<p class="note">商品が未登録です。</p>';
 $('boxList').innerHTML=state.boxes.length?state.boxes.map(o=>`<div class="item"><div><strong>${esc(o.name)}</strong><small>内寸 ${o.l} × ${o.w} × ${o.h} mm ・ 厚 ${o.wall} mm</small></div><div class="tools"><button data-kind="box" data-action="edit" data-id="${esc(o.id)}" class="btn ghost tiny">編集</button><button data-kind="box" data-action="delete" data-id="${esc(o.id)}" class="btn ghost tiny">削除</button></div></div>`).join(''):'<p class="note">箱が未登録です。</p>';
 $('heroBoxCount').textContent=state.boxes.length+' 種類';$('padding').value=state.padding;$('paddingLabel').textContent=state.padding+' mm';
}
function update(){renderLists();save();calculate();}
function calculate(){
 if(!state.items.length||!state.boxes.length){latest=null;selected=null;empty('商品と箱を1種類以上登録してください');return;}
 try{latest=E.plan(state.items,state.boxes,state.padding);if(!latest.results.some(r=>r.boxId===selected))selected=(latest.best||latest.results[0]).boxId;renderResults();}catch(err){empty(err.message);toast(err.message);}
}
function empty(msg){$('recommendTitle').textContent='プランを作成できません';$('recommendDetail').textContent=msg;$('recommendFlag').textContent='要確認';['metricSize','metricFill','metricWeight'].forEach(id=>$(id).textContent='—');$('planList').innerHTML='';$('drawing').textContent=msg;$('stepBody').innerHTML='';$('stepCount').textContent='0点';$('legend').innerHTML='';$('csvExport').disabled=true;}
function current(){return latest&&latest.results.find(r=>r.boxId===selected);}
function renderResults(){let r=current();if(!r)return;let best=latest.best;
 $('recommendTitle').textContent=r.boxName+(r.fit?'':'（未配置あり）');$('recommendDetail').textContent=best?(r.boxId===best.boxId?'外寸が小さい適合候補です':'おすすめの候補：'+best.boxName):'登録箱・商品寸法・余白を見直してください';$('recommendFlag').textContent=r.fit?'配置成功':'未配置あり';
 $('metricSize').textContent=r.size.cm+' cm';$('metricTier').textContent=r.size.label;
 $('metricFill').textContent=r.fill+' %';$('metricWeight').textContent=pretty(r.totalWeight)+' g';$('planCount').textContent=latest.results.length+'候補';
 $('planList').innerHTML=latest.results.map(r=>`<button type="button" class="plan ${r.boxId===selected?'active':''}" data-box="${esc(r.boxId)}" aria-pressed="${r.boxId===selected}"><div><strong>${esc(r.boxName)}</strong><small>外寸 ${r.size.outer.join(' × ')} mm · 3辺 ${r.size.cm} cm · ${r.fill}%占有</small></div><span class="plan-badge ${r.fit?'':'bad'}">${r.fit?(r.size.tier?r.size.tier+'相当':'200超'):`${r.missed.length}点未配置`}</span></button>`).join('');
 $('drawingCaption').textContent=`${r.box.l} × ${r.box.w} × ${r.box.h} mm（箱の内寸）`;
 $('riskNote').textContent=(r.fit?'全商品を配置できました。':r.reason+'。')+' これは体積・形状・簡易支持面だけの近似配置です。輸送時の強度、実際の緩衝材、安全な積載、配送会社の重量・最長辺などは判定していません。';
 $('stepCount').textContent=r.placedCount+'/'+r.itemCount+'点';$('tableIntro').textContent='位置は箱内寸の左奥底を原点とした mm。サイズには予約余白を含みます。';
 $('stepBody').innerHTML=r.placed.map((p,i)=>`<tr><td>${i+1}</td><td>${esc(p.name)} #${p.serial}</td><td>(${p.x}, ${p.y}, ${p.z})</td><td>${p.l} × ${p.w} × ${p.h}</td></tr>`).join('')||'<tr><td colspan="4">配置できる商品がありません</td></tr>';
 $('csvExport').disabled=!r.placed.length;draw(r);
}
function draw(r){
 const b=r.box,scale=Math.min(2.1,300/Math.max(b.l,b.w,b.h,1)),sx=.76*scale,sy=.34*scale,sz=.88*scale;
 function pt(x,y,z){return [400+(x-y)*sx,70+(x+y)*sy+(b.h-z)*sz];}
 function pts(arr){return arr.map(c=>pt(...c).map(n=>Math.round(n*10)/10).join(',')).join(' ');}
 let polys=[];let all=[...r.placed].sort((a,b)=>(a.x+a.y+a.z)-(b.x+b.y+b.z));
 const shape=(p,color,i)=>{const x=p.x,y=p.y,z=p.z,L=p.l,W=p.w,H=p.h;
 const top=[[x,y,z+H],[x+L,y,z+H],[x+L,y+W,z+H],[x,y+W,z+H]];
 const faceX=[[x+L,y,z+H],[x+L,y+W,z+H],[x+L,y+W,z],[x+L,y,z]];
 const faceY=[[x,y+W,z+H],[x+L,y+W,z+H],[x+L,y+W,z],[x,y+W,z]];
 return `<polygon points="${pts(faceY)}" fill="${color}" opacity=".76" stroke="#fff" stroke-width="1"/><polygon points="${pts(faceX)}" fill="${color}" opacity=".56" stroke="#fff" stroke-width="1"/><polygon points="${pts(top)}" fill="${color}" opacity=".96" stroke="#fff" stroke-width="1"/><text x="${pt(x+L/2,y+W/2,z+H)[0]}" y="${pt(x+L/2,y+W/2,z+H)[1]+4}" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">${i+1}</text>`;
 };
 const colorMap=new Map();state.items.forEach((o,i)=>colorMap.set(o.id,colors[i%colors.length]));
 all.forEach((p,i)=>polys.push(shape(p,colorMap.get(p.id)||colors[i%colors.length],i)));
 const edges=[[[0,0,0],[b.l,0,0]],[[0,0,0],[0,b.w,0]],[[0,0,0],[0,0,b.h]],[[b.l,b.w,0],[b.l,0,0]],[[b.l,b.w,0],[0,b.w,0]],[[b.l,b.w,0],[b.l,b.w,b.h]],[[0,b.w,b.h],[0,0,b.h]],[[0,b.w,b.h],[b.l,b.w,b.h]],[[b.l,0,b.h],[b.l,b.w,b.h]],[[b.l,0,b.h],[0,0,b.h]],[[b.l,0,b.h],[b.l,0,0]],[[0,b.w,b.h],[0,b.w,0]]];
 const wire=edges.map(e=>`<line x1="${pt(...e[0])[0]}" y1="${pt(...e[0])[1]}" x2="${pt(...e[1])[0]}" y2="${pt(...e[1])[1]}" stroke="#446f72" stroke-width="1.7" stroke-dasharray="5 5" opacity=".66"/>`).join('');
 const svg=`<svg viewBox="0 0 800 550" xmlns="http://www.w3.org/2000/svg" aria-label="箱詰め配置を斜めから見た概略図"><rect width="800" height="550" fill="transparent"/><polygon points="${pts([[0,0,0],[b.l,0,0],[b.l,b.w,0],[0,b.w,0]])}" fill="#d0dedc" opacity=".7"/>${polys.join('')}${wire}<text x="25" y="515" font-size="13" fill="#647a77">各番号は作業用配置一覧に対応 / 寸法と位置はmm</text></svg>`;
 $('drawing').innerHTML=svg;
 $('legend').innerHTML=state.items.map((o,i)=>`<span><i class="dot" style="background:${colors[i%colors.length]}"></i>${esc(o.name)}</span>`).join('');
}
function download(filename,content,mime){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function csvCell(v){let s=String(v);return '"'+s.replace(/"/g,'""')+'"';}
function exportCSV(){let r=current();if(!r)return;let rows=[['順','箱','商品','個体番号','x mm','y mm','z mm','占有長さ mm','占有幅 mm','占有高さ mm'],...r.placed.map((p,i)=>[i+1,r.boxName,p.name,p.serial,p.x,p.y,p.z,p.l,p.w,p.h])];download('hako-kyokai-layout.csv','\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');toast('配置CSVを書き出しました');}
function attach(){
 $('itemForm').addEventListener('submit',e=>{e.preventDefault();let o=readForm(e.currentTarget,['name','l','w','h','qty','weight','orientation']);o.id=itemEdit||id();if(!E.validateItem(o)||o.l>2000||o.w>2000||o.h>2000){toast('商品情報を確認してください');return;}let count=state.items.reduce((s,x)=>s+x.qty,0)-(itemEdit?(state.items.find(x=>x.id===itemEdit)||{qty:0}).qty:0)+o.qty;if(count>120){toast('商品は合計120点までです');return;}if(itemEdit){state.items=state.items.map(x=>x.id===itemEdit?o:x);}else state.items.push(o);resetForm('item');update();toast('商品を保存しました');});
 $('boxForm').addEventListener('submit',e=>{e.preventDefault();let o=readForm(e.currentTarget,['name','l','w','h','wall','tare']);o.id=boxEdit||id();if(!E.validateBox(o)||[o.l,o.w,o.h].some(n=>n>2000)||o.wall>50){toast('箱の設定を確認してください');return;}if(!boxEdit&&state.boxes.length>=30){toast('箱は30種類までです');return;}if(boxEdit)state.boxes=state.boxes.map(x=>x.id===boxEdit?o:x);else state.boxes.push(o);resetForm('box');update();toast('箱を保存しました');});
 $('itemCancel').addEventListener('click',()=>resetForm('item'));
 $('boxCancel').addEventListener('click',()=>resetForm('box'));
 for(const k of ['item','box'])$(k+'List').addEventListener('click',e=>{let btn=e.target.closest('button[data-action]');if(!btn)return;let list=k==='item'?state.items:state.boxes;let o=list.find(x=>x.id===btn.dataset.id);if(!o)return;if(btn.dataset.action==='edit'){if(k==='item'){itemEdit=o.id;fillForm($('itemForm'),o,['name','l','w','h','qty','weight','orientation']);$('itemSubmit').textContent='変更を保存';$('itemCancel').hidden=false;}else{boxEdit=o.id;fillForm($('boxForm'),o,['name','l','w','h','wall','tare']);$('boxSubmit').textContent='変更を保存';$('boxCancel').hidden=false;}document.getElementById(k+'Form').scrollIntoView({behavior:'smooth',block:'center'});}else{if(k==='item')state.items=list.filter(x=>x.id!==o.id);else state.boxes=list.filter(x=>x.id!==o.id);resetForm(k);update();toast('削除しました');}});
 $('padding').addEventListener('input',e=>{state.padding=Number(e.target.value);$('paddingLabel').textContent=state.padding+' mm';calculate();save();});
 $('planList').addEventListener('click',e=>{let el=e.target.closest('[data-box]');if(!el)return;selected=el.dataset.box;renderResults();});
 $('csvExport').addEventListener('click',exportCSV);
 $('print').addEventListener('click',()=>window.print());
 $('downloadBackup').addEventListener('click',()=>{download('hako-kyokai-backup.json',JSON.stringify({app:'hako-kyokai',version:1,...state},null,2),'application/json');toast('バックアップを保存しました');});
 $('restoreFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>500000)throw Error('ファイルが大きすぎます');let o=JSON.parse(await f.text());if(!o||!Array.isArray(o.items)||!Array.isArray(o.boxes)||o.items.length>120||o.boxes.length>30||!o.items.every(E.validateItem)||!o.boxes.every(E.validateBox)||!Number.isInteger(o.padding)||o.padding<0||o.padding>20||o.items.reduce((s,i)=>s+Number(i.qty),0)>120||o.items.some(i=>[i.l,i.w,i.h].some(n=>n>2000))||o.boxes.some(b=>[b.l,b.w,b.h].some(n=>n>2000)||b.wall>50))throw Error('形式または値が不正です');state={items:o.items,boxes:o.boxes,padding:o.padding};selected=null;resetForm('item');resetForm('box');update();toast('バックアップを復元しました');}catch(err){toast('復元失敗：'+err.message);}finally{e.target.value='';}});
 $('reset').addEventListener('click',()=>{if(!window.confirm('登録した商品・箱をサンプルに戻しますか？'))return;state=fresh();selected=null;resetForm('item');resetForm('box');update();toast('サンプルに戻しました');});
}
attach();renderLists();calculate();
})();
