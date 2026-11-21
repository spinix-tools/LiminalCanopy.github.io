/* HAKOAWASE interaction layer: no network access, browser-local persistence only. */
(() => {
  'use strict';
  const H=window.HakoEngine;
  const STORAGE_KEY='hakoawase-mvp-v1';
  const defaultState=()=>({
    padding:0.5,
    items:[
      {id:'i1',name:'マグカップ箱',w:12,d:12,h:13,qty:2,upright:true},
      {id:'i2',name:'茶葉ギフト',w:18,d:10,h:6,qty:2,upright:false},
      {id:'i3',name:'カードケース',w:18,d:13,h:1,qty:1,upright:false}
    ],
    boxes:[
      {id:'b1',name:'スリム',w:24,d:19,h:16,price:85},
      {id:'b2',name:'レギュラー',w:30,d:23,h:20,price:130},
      {id:'b3',name:'ゆったり',w:36,d:28,h:26,price:190}
    ]
  });
  const $=id=>document.getElementById(id);
  const esc=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=x=>(x/10).toFixed(x%10?1:0);
  const palette=['#ea7759','#4b8d85','#7e82c2','#b3a066','#987dba','#78a6bc','#cf8c9c','#83a46c','#c49f76','#728fa0','#aa737e','#b2ab94','#7795a8','#ad7969','#8c8e68','#a18eae'];
  let state=defaultState(), calculation=null, chosenId=null, progress=0, dirty=false, toastTimer;
  function notify(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3300);}
  function inputAttr(v){return esc(v);}
  function rowItem(item){
    return `<article class="input-row" data-kind="items" data-id="${esc(item.id)}">
      <div class="rowtop"><input aria-label="商品名" class="name-input" data-field="name" maxlength="36" value="${inputAttr(item.name)}" placeholder="商品名"><button class="del" data-action="delete" title="商品を削除" aria-label="${esc(item.name)}を削除">×</button></div>
      <div class="field-grid"><label>幅 <span>cm</span><input data-field="w" type="number" min="0.1" max="200" step="0.1" value="${inputAttr(item.w)}"></label><label>奥行 <span>cm</span><input data-field="d" type="number" min="0.1" max="200" step="0.1" value="${inputAttr(item.d)}"></label><label>高さ <span>cm</span><input data-field="h" type="number" min="0.1" max="200" step="0.1" value="${inputAttr(item.h)}"></label><label>数量 <span>個</span><input data-field="qty" type="number" min="1" max="24" step="1" value="${inputAttr(item.qty)}"></label></div>
      <label class="toggle"><input data-field="upright" type="checkbox" ${item.upright?'checked':''}><span class="toggle-track"></span><span>天地固定 <small>（横に倒さない）</small></span></label>
    </article>`;
  }
  function rowBox(box){
    return `<article class="input-row" data-kind="boxes" data-id="${esc(box.id)}">
      <div class="rowtop"><input aria-label="箱の名前" class="name-input" data-field="name" maxlength="36" value="${inputAttr(box.name)}" placeholder="箱の名前"><button class="del" data-action="delete" title="箱を削除" aria-label="${esc(box.name)}を削除">×</button></div>
      <div class="field-grid"><label>内幅 <span>cm</span><input data-field="w" type="number" min="0.1" max="200" step="0.1" value="${inputAttr(box.w)}"></label><label>内奥行 <span>cm</span><input data-field="d" type="number" min="0.1" max="200" step="0.1" value="${inputAttr(box.d)}"></label><label>内高さ <span>cm</span><input data-field="h" type="number" min="0.1" max="200" step="0.1" value="${inputAttr(box.h)}"></label><label>箱単価 <span>円</span><input data-field="price" type="number" min="0" max="100000" step="1" value="${inputAttr(box.price)}"></label></div>
    </article>`;
  }
  function renderEditors(){ $('itemRows').innerHTML=state.items.map(rowItem).join('');$('boxRows').innerHTML=state.boxes.map(rowBox).join('');$('padding').value=state.padding; $('paddingOut').textContent=Number(state.padding).toFixed(1)+' cm'; }
  function markDirty(){dirty=true;$('stale').textContent='● 編集内容が未反映です';}
  function parseState(candidate){
    if(!candidate||typeof candidate!=='object'||!Array.isArray(candidate.items)||!Array.isArray(candidate.boxes))throw new Error('設定形式が正しくありません。');
    if(candidate.items.length<1||candidate.items.length>16||candidate.boxes.length<1||candidate.boxes.length>12) throw new Error('登録数の上限を確認してください。');
    const items=candidate.items.map((a,i)=>({id:'i'+(i+1),name:String(a.name||'商品').slice(0,36),w:Number(a.w),d:Number(a.d),h:Number(a.h),qty:Number(a.qty),upright:!!a.upright}));
    const boxes=candidate.boxes.map((a,i)=>({id:'b'+(i+1),name:String(a.name||'箱').slice(0,36),w:Number(a.w),d:Number(a.d),h:Number(a.h),price:Number(a.price)}));
    const padding=Number(candidate.padding);
    H.compare(items,boxes,padding); // Validate before accepting unknown JSON.
    return {items,boxes,padding};
  }
  function readSaved(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)state=parseState(JSON.parse(raw));}catch(err){console.warn('Stored values ignored:',err.message);}}
  function onEditor(event){
    const field=event.target.closest('[data-field]');if(!field)return;
    const row=field.closest('[data-kind]');if(!row)return;
    const array=state[row.dataset.kind],record=array.find(a=>a.id===row.dataset.id);if(!record)return;
    const value=field.type==='checkbox'?field.checked:field.type==='number'?Number(field.value):field.value;
    record[field.dataset.field]=value;
    markDirty();
  }
  function onDelete(event){const btn=event.target.closest('[data-action="delete"]');if(!btn)return;
    const row=btn.closest('[data-kind]');const key=row.dataset.kind;
    if(state[key].length<=1){notify('商品も箱も最低1件は必要です。');return;}
    state[key]=state[key].filter(a=>a.id!==row.dataset.id);renderEditors();markDirty();
  }
  function newId(prefix){return prefix+Math.random().toString(36).slice(2,10);}
  function renderSummary(model){const fit=model.results.filter(r=>r.allFit);
    $('summary').innerHTML=`<div class="stat"><span>商品数</span><strong>${model.units.length}<small>個</small></strong></div><div class="stat"><span>全件入った箱</span><strong>${fit.length}<small> / ${model.results.length}種類</small></strong></div><div class="stat"><span>最安の適合箱</span><strong>${model.recommended?'¥'+Number(model.recommended.box.price).toLocaleString('ja-JP'):'なし'}</strong></div>`;
  }
  function renderCards(model){ $('compareCards').innerHTML=model.results.map((r,i)=>{
    const status=r.allFit?'全部入る候補':`${r.placed.length}/${r.total}個配置`;const extra=r.allFit?`${Math.round(r.fillRate*100)}% 使用`:`${r.rejected.length}個が未配置`;
    const active=(chosenId===r.box.id)?'selected':'';
    return `<button class="compare-card ${active}" data-boxid="${esc(r.box.id)}" aria-pressed="${chosenId===r.box.id}"><span class="card-number">0${i+1} <span>${r.allFit?'FIT':'PARTIAL'}</span></span><span class="card-main"><strong>${esc(r.box.name)}</strong><b>¥${Number(r.box.price).toLocaleString('ja-JP')}</b></span><span class="card-dims">内寸 ${r.box.w} × ${r.box.d} × ${r.box.h} cm</span><span class="card-foot"><span class="status ${r.allFit?'ok':'warn'}">${status}</span><span>${extra}</span></span></button>`;
  }).join('');}
  function svg(model,count){
    const r=model;const W=640,H=390;const B=r.carton;
    const s=Math.min((W-100)/((B.w+B.d)*.86),(H-95)/((B.w+B.d)*.34+B.h*.90));
    const xo=(W-(B.w+B.d)*.86*s)/2+B.d*.86*s;
    const yo=32+B.h*.90*s;
    const P=(x,y,z)=>[xo+(x-y)*.86*s,yo+(x+y)*.34*s-z*.90*s];
    const points=arr=>arr.map(v=>v.map(n=>n.toFixed(1)).join(',')).join(' ');
    const line=(a,b)=>`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
    let out=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(r.box.name)}の梱包模式図" xmlns="http://www.w3.org/2000/svg">`;
    out+=`<defs><pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#e6e8e3" stroke-width=".8"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#grid)"/>`;
    out+=`<g fill="none" stroke="#afb8ae" stroke-width="1.8" stroke-dasharray="6 5">`;
    const c0=P(0,0,0),cx=P(B.w,0,0),cy=P(0,B.d,0),cxy=P(B.w,B.d,0);
    const t0=P(0,0,B.h),tx=P(B.w,0,B.h),ty=P(0,B.d,B.h),txy=P(B.w,B.d,B.h);
    for(const [a,b] of [[c0,cx],[cx,cxy],[cxy,cy],[cy,c0],[c0,t0],[cx,tx],[cy,ty],[cxy,txy],[t0,tx],[tx,txy],[txy,ty],[ty,t0]])out+=line(a,b);
    out+='</g>';
    const shown=r.placed.slice(0,count).sort((a,b)=>(a.x+a.y+a.z)-(b.x+b.y+b.z));
    for(const a of shown){
      const color=palette[a.sourceIndex%palette.length];
      const x=a.x,y=a.y,z=a.z,w=a.w,d=a.d,h=a.h;
      const A=P(x,y,z+h),C=P(x+w,y,z+h),D=P(x+w,y+d,z+h),E=P(x,y+d,z+h);
      const Cb=P(x+w,y,z),Db=P(x+w,y+d,z),Eb=P(x,y+d,z);
      out+=`<g stroke="#263b35" stroke-width="1.25" stroke-linejoin="round"><title>${esc(a.name)}</title><polygon points="${points([C,D,Db,Cb])}" fill="${color}" fill-opacity=".68"/><polygon points="${points([E,D,Db,Eb])}" fill="${color}" fill-opacity=".83"/><polygon points="${points([A,C,D,E])}" fill="${color}"/></g>`;
      const center=P(x+w/2,y+d/2,z+h);
      out+=`<text x="${center[0]}" y="${center[1]+4}" text-anchor="middle" fill="#fff" stroke="#334" stroke-opacity=".2" stroke-width="2" paint-order="stroke" font-size="12" font-weight="800">${a.sourceIndex+1}</text>`;
    }
    out+=`<g font-size="13" font-weight="700" fill="#60766b"><text x="16" y="24">W ${fmt(B.w)} cm</text><text x="16" y="43">D ${fmt(B.d)} cm</text><text x="16" y="62">H ${fmt(B.h)} cm</text></g></svg>`;
    return out;
  }
  function draw(){
    if(!calculation)return;
    const r=calculation.results.find(v=>v.box.id===chosenId)||calculation.results[0];
    progress=Math.min(progress,r.placed.length);$('chosenTitle').textContent=r.box.name+' / 配置図';
    $('chosenDetail').textContent=r.allFit?'全商品を配置できた候補':'一部の商品の配置が見つかりませんでした';
    $('drawing').innerHTML=svg(r,progress);
    $('stepRange').max=String(r.placed.length);$('stepRange').value=String(progress);$('stepCount').textContent=`${progress} / ${r.placed.length}`;
    $('prevStep').disabled=progress===0;$('nextStep').disabled=progress===r.placed.length;
    $('packingSteps').innerHTML=r.placed.map((p,i)=>`<li class="${i<progress?'seen':''}"><span class="step-index">${String(i+1).padStart(2,'0')}</span><span class="step-name">${esc(p.name)}</span><span class="step-coord">(${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)}) cm</span></li>`).join('')+(r.rejected.length?`<li class="unpacked">未配置：${esc(r.rejected.map(a=>a.name).join('、'))}</li>`:'');
  }
  function calculate(){
    try{
      const result=H.compare(state.items,state.boxes,state.padding);
      for(const r of result.results) if(!H.verify(r))throw new Error('配置の検算に失敗しました。');
      calculation=result; chosenId=(result.recommended||result.results[0]).box.id;progress=(result.recommended||result.results[0]).placed.length;
      renderSummary(result);renderCards(result);draw();dirty=false;$('stale').textContent='';
    }catch(err){notify(err.message);$('stale').textContent='⚠ 入力内容をご確認ください';}
  }
  function download(name,text,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),800);}
  const csvCell=s=>'"'+String(s??'').replace(/"/g,'""')+'"';
  function exportCsv(){if(!calculation||dirty){calculate();if(dirty)return;}const r=calculation.results.find(v=>v.box.id===chosenId);
    const header=['箱名','商品名','個体ID','X(cm)','Y(cm)','Z(cm)','幅(cm)','奥行(cm)','高さ(cm)','結果'];
    const lines=[header];r.placed.forEach(p=>lines.push([r.box.name,p.name,p.id,fmt(p.x),fmt(p.y),fmt(p.z),fmt(p.w),fmt(p.d),fmt(p.h),'配置']));
    r.rejected.forEach(p=>lines.push([r.box.name,p.name,p.id,'','','','','','','未配置']));
    download('hakoawase-placement.csv','\ufeff'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');notify('配置CSVを書き出しました。');
  }
  function register(){
    $('itemRows').addEventListener('input',onEditor);$('itemRows').addEventListener('change',onEditor);$('itemRows').addEventListener('click',onDelete);
    $('boxRows').addEventListener('input',onEditor);$('boxRows').addEventListener('change',onEditor);$('boxRows').addEventListener('click',onDelete);
    $('addItem').addEventListener('click',()=>{if(state.items.length>=16){notify('商品は最大16種類です。');return;}state.items.push({id:newId('i'),name:'新しい商品',w:10,d:8,h:5,qty:1,upright:false});renderEditors();markDirty();});
    $('addBox').addEventListener('click',()=>{if(state.boxes.length>=12){notify('箱は最大12種類です。');return;}state.boxes.push({id:newId('b'),name:'新しい箱',w:35,d:25,h:20,price:150});renderEditors();markDirty();});
    $('padding').addEventListener('input',e=>{state.padding=Number(e.target.value);$('paddingOut').textContent=state.padding.toFixed(1)+' cm';markDirty();});
    $('calculate').addEventListener('click',calculate);
    $('compareCards').addEventListener('click',e=>{const card=e.target.closest('[data-boxid]');if(!card)return;chosenId=card.dataset.boxid;const r=calculation.results.find(v=>v.box.id===chosenId);progress=r.placed.length;renderCards(calculation);draw();});
    $('stepRange').addEventListener('input',e=>{progress=Number(e.target.value);draw();});
    $('prevStep').addEventListener('click',()=>{progress=Math.max(0,progress-1);draw();});
    $('nextStep').addEventListener('click',()=>{const r=calculation.results.find(v=>v.box.id===chosenId);progress=Math.min(r.placed.length,progress+1);draw();});
    $('save').addEventListener('click',()=>{try{state=parseState(state);localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderEditors();notify('この端末に設定を保存しました。');}catch(e){notify('保存できませんでした：'+e.message);}});
    $('exportJson').addEventListener('click',()=>{try{parseState(state);download('hakoawase-settings.json',JSON.stringify({version:1,...state},null,2),'application/json');notify('設定JSONを書き出しました。');}catch(e){notify(e.message);}});
    $('exportCsv').addEventListener('click',exportCsv);
    $('importJson').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1024*1024)throw new Error('1MB以下のJSONを指定してください。');state=parseState(JSON.parse(await file.text()));renderEditors();calculate();notify('設定を読み込みました。');}catch(err){notify('読み込み失敗：'+err.message);}finally{e.target.value='';}});
    $('reset').addEventListener('click',()=>{if(!confirm('現在の入力をデモ内容に戻しますか？'))return;state=defaultState();renderEditors();calculate();notify('デモを復元しました。');});
    $('print').addEventListener('click',()=>window.print());
    $('helpBtn').addEventListener('click',()=>$('helpDialog').showModal());
    $('closeHelp').addEventListener('click',()=>$('helpDialog').close());$('closeHelp2').addEventListener('click',()=>$('helpDialog').close());
  }
  readSaved();renderEditors();register();calculate();
})();