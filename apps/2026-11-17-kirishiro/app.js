(function () {
  'use strict';
  const API = window.KIRISHIRO;
  const STORE_KEY = 'kirishiro-project-v1';
  const byId = id => document.getElementById(id);
  const $ = (sel, root=document) => root.querySelector(sel);
  const INITIAL = {
    title:'小さな棚を作る',kerf:3,trim:0,minKeep:300,cutFee:0,
    parts:[{label:'棚板',length:800,qty:2},{label:'支柱',length:550,qty:2},{label:'補強',length:300,qty:2}],
    offcuts:[{label:'前回の残り A',length:1200,qty:1},{label:'前回の残り B',length:980,qty:1}],
    products:[{label:'2×4材 6ft',length:1820,price:650},{label:'2×4材 8ft',length:2440,price:980}]
  };
  const TYPES={parts:{type:'part',fields:[['label','部材名','text'],['length','長さ mm','number'],['qty','本数','number']]},offcuts:{type:'stock',fields:[['label','手持ち材','text'],['length','長さ mm','number'],['qty','本数','number']]},products:{type:'product',fields:[['label','購入候補','text'],['length','長さ mm','number'],['price','単価 円','number']]}};
  let last=null;
  function escape(s) {return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function message(text,error=false) {const el=byId('status');el.textContent=text;el.className='status'+(error?' error':'');}
  function row(type,data={}) {
    const config=TYPES[type];
    const box=document.createElement('div');box.className='item-row '+config.type;box.dataset.type=type;
    for(const [key,label,inputType] of config.fields) {
      const field=document.createElement('div');const labelEl=document.createElement('label');
      labelEl.textContent=label;const input=document.createElement('input');input.dataset.key=key;input.type=inputType;
      if(inputType==='number'){input.step=key==='length'?'0.1':'1';input.min=key==='qty'||key==='price'?'0':'1';input.max=key==='qty'?'100':'1000000';input.inputMode='decimal';}
      else input.maxLength=60;
      input.value=data[key]??'';
      labelEl.appendChild(input);field.appendChild(labelEl);box.appendChild(field);
    }
    const del=document.createElement('button');del.type='button';del.className='trash';del.textContent='×';del.title='この行を削除';del.setAttribute('aria-label','この行を削除');del.addEventListener('click',()=>{box.remove();invalidate();});box.appendChild(del);
    byId(type).appendChild(box);
  }
  function fill(raw) {
    for(const key of Object.keys(TYPES)) {byId(key).replaceChildren();(raw[key]||[]).forEach(x=>row(key,x));}
    for (const field of ['title','kerf','trim','minKeep','cutFee']) byId(field).value=raw[field]??'';
    invalidate();
  }
  function read() {
    const raw={};
    for(const id of ['title','kerf','trim','minKeep','cutFee']) raw[id]=byId(id).value;
    for(const type of Object.keys(TYPES)) raw[type]=Array.from(byId(type).children).map(box=>{
      const out={};box.querySelectorAll('input').forEach(input=>out[input.dataset.key]=input.value);return out;
    });
    return API.normalize(raw);
  }
  function invalidate(){last=null;byId('output').hidden=true;byId('blank').hidden=false;}
  function download(text,filename,typ){const blob=new Blob([text],{type:typ});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);}
  function render(res) {
    const p=res.plan;
    byId('blank').hidden=true;byId('output').hidden=false;
    const ja=n=>'¥'+Math.round(n).toLocaleString('ja-JP');
    const metrics=[['材料＋加工費',ja(p.totalCost),true],['新しく買う材',p.buyCount+' 本'],['手持ち利用',p.bins.length-p.buyCount+' 本'],['部材数',p.partCount+' 本'],['歩留まり',p.efficiency+'%'],['再利用できる残材',p.usable+' mm']];
    byId('metrics').innerHTML=metrics.map(([label,value,total])=>`<div class="metric${total?' total':''}"><span>${label}</span><strong>${value}</strong></div>`).join('');
    byId('count').textContent=p.bins.length+' 材料';
    byId('notice').textContent=`材料費 ${ja(p.buyTotal)} ＋加工費 ${ja(p.cutCost)}。刃厚損失 ${p.bladeLoss}mm、端面余裕 ${p.trimLoss}mm、保存基準未満の端材 ${p.scrap}mm。${res.alternativesTried}通りのヒューリスティック探索結果であり、厳密な最安・最少ロスの保証はありません。`;
    const parent=byId('bars');parent.replaceChildren();
    p.bins.forEach((b,i)=>{
      const article=document.createElement('article');article.className='stock-visual';
      const header=document.createElement('div');header.className='stock-head';
      header.innerHTML=`<div><span class="tag ${b.source==='purchase'?'buy':''}">${b.source==='purchase'?'購入':'手持ち'}</span> <strong>${escape(b.label)}</strong></div><small>${b.length} mm${b.source==='purchase'?' / '+ja(b.price):''}</small>`;article.appendChild(header);
      const diagram=document.createElement('div');diagram.className='bar';diagram.setAttribute('role','img');diagram.setAttribute('aria-label',b.label+' '+b.length+'mm。'+b.pieces.map(x=>x.label+' '+x.length+'mm').join('、')+'。残り'+b.left+'mm');
      for(const piece of b.pieces){const el=document.createElement('span');el.className='segment';el.style.flex=piece.length+' 1 0';el.textContent=piece.length>=b.length*.10?piece.length+'mm':'';el.title=piece.label+' '+piece.length+'mm';diagram.appendChild(el);}
      const residual=document.createElement('span');residual.className='segment drop';residual.style.flex=Math.max(0,b.length-b.pieces.reduce((s,x)=>s+x.length,0))+' 1 0';residual.textContent=b.left>=b.length*.1?b.left+'mm':'';residual.title='残材 '+b.left+'mm';diagram.appendChild(residual);article.appendChild(diagram);
      const detail=document.createElement('div');detail.className='pieces';detail.textContent=`切る順：${b.pieces.map((x,j)=>(j+1)+'. '+x.label+' '+x.length+'mm').join(' → ')}　/　残り ${b.left}mm${b.left>=res.project.minKeep?'（保管候補）':'（基準未満）'}`;article.appendChild(detail);
      parent.appendChild(article);
    });
  }
  function action(fn){try {fn();}catch(e){message(e.message||'処理に失敗しました',true);}}
  byId('add-part').addEventListener('click',()=>row('parts',{label:'新しい部材',length:400,qty:1}));
  byId('add-offcut').addEventListener('click',()=>row('offcuts',{label:'手持ち材',length:600,qty:1}));
  byId('add-product').addEventListener('click',()=>row('products',{label:'購入候補',length:1820,price:600}));
  for(const type of Object.keys(TYPES)) byId(type).addEventListener('input',invalidate);
  for(const id of ['title','kerf','trim','minKeep','cutFee']) byId(id).addEventListener('input',invalidate);
  byId('calculate').addEventListener('click',()=>action(()=>{
    const result=API.bestPlan(read());last=result;render(result);message('木取り計画を作成しました。実際の切断前に寸法をご確認ください。');
    byId('result-panel').scrollIntoView({behavior:'smooth',block:'start'});
  }));
  byId('save').addEventListener('click',()=>action(()=>{
    const val=read();localStorage.setItem(STORE_KEY,JSON.stringify(val));message('この端末のブラウザに保存しました。別端末との同期はしません。');
  }));
  byId('export').addEventListener('click',()=>action(()=>{
    const raw=read();download(JSON.stringify(raw,null,2),'kirishiro-project.json','application/json;charset=utf-8');message('JSONファイルを書き出しました。');
  }));
  byId('import').addEventListener('click',()=>byId('file').click());
  byId('file').addEventListener('change',async e=>{
    const file=e.target.files&&e.target.files[0];if(!file)return;
    try{if(file.size>300000)throw new Error('JSONファイルが大きすぎます（最大300KB）');const obj=API.normalize(JSON.parse(await file.text()));fill(obj);message('JSONファイルを読み込みました。計算ボタンで再計算してください。');}
    catch(err){message('読み込み失敗：'+err.message,true);}finally{e.target.value='';}
  });
  byId('reset').addEventListener('click',()=>{
    if(!window.confirm('入力内容をサンプルに戻しますか？この端末の保存も削除します。'))return;
    try{localStorage.removeItem(STORE_KEY);}catch(_){/* private mode may reject */}fill(INITIAL);message('サンプルデータに戻しました。');
  });
  byId('csv').addEventListener('click',()=>{if(!last)return;download(API.toCSV(last),'kirishiro-plan.csv','text/csv;charset=utf-8');message('CSVを書き出しました。');});
  byId('copy').addEventListener('click',async()=>{
    if(!last)return;try{await navigator.clipboard.writeText(API.summary(last));message('計画をコピーしました。');}
    catch(_){message('コピーが使えない環境です。印刷またはCSV出力をご利用ください。',true);}
  });
  byId('print').addEventListener('click',()=>{if(last)window.print();});
  let restored=false;
  try {const saved=localStorage.getItem(STORE_KEY);if(saved){fill(API.normalize(JSON.parse(saved)));restored=true;}}catch(_){/* storage disabled or invalid */}
  if(!restored) fill(INITIAL);
  message(restored?'保存済みの計画を読み込みました。':'サンプルが入力されています。計算を試してみてください。');
})();