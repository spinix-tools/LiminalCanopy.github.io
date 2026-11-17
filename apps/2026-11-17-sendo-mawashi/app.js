/* SENDO MAWASHI — UI, no dependencies or network calls */
(function () {
  'use strict';
  const E = window.SendoEngine;
  const KEY = 'sendo-mawashi.v1';
  const $ = sel => document.querySelector(sel);
  let state, lastForecast;
  const yen = n => '¥' + Math.round(n).toLocaleString('ja-JP');
  const fmt = n => Number(n).toLocaleString('ja-JP');
  const el = (tag, attrs = {}, content = '') => {
    const node = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) {
      if(k === 'className') node.className=v;
      else if(k === 'title') node.title=v;
      else if(k === 'type') node.type=v;
      else if(k === 'datasetAction') node.dataset.action=v;
      else node.setAttribute(k,v);
    }
    if(content !== undefined && content !== null) node.textContent=String(content);
    return node;
  };
  const clear = node => node.replaceChildren();
  function td(row, value, strong = false) {
    const cell=el('td');
    if(strong) cell.append(el('strong',{},value)); else cell.textContent=String(value);
    row.append(cell);return cell;
  }
  function alertMessage(msg, error = false) {
    const node=$('#toast'); node.textContent=msg;node.style.background=error?'#993c28':'#173b2b';node.classList.remove('hide');
    clearTimeout(alertMessage.timer);alertMessage.timer=setTimeout(()=>node.classList.add('hide'),4200);
  }
  function guarded(fn) { try { fn(); } catch (e) { alertMessage(e.message || String(e),true); } }
  function save() { try { localStorage.setItem(KEY,JSON.stringify(state)); } catch(e) { alertMessage('保存に失敗しました。JSONでバックアップしてください',true); } }
  function load() {
    try {
      const raw=localStorage.getItem(KEY);
      return raw ? E.create(...((s)=>[s.products,s.lots,s.movements])(JSON.parse(raw))) : E.defaultState();
    } catch(e) { alertMessage('以前の保存内容を読み込めないため、デモを表示します',true); return E.defaultState(); }
  }
  function options() { return {start:$('#start').value,days:Number($('#days').value),weekend:Number($('#weekend').value),uplift:Number($('#uplift').value),window:2}; }
  function pill(date) {
    const n=E.dayNumber(date)-E.dayNumber(E.today());
    return n<0?'期限経過':n===0?'今日まで':n===1?'あと1日':`あと${n}日`;
  }
  function renderSelections(){
    for(const id of ['#lot-product','#move-product']) {
      const select=$(id), old=select.value;clear(select);
      for(const p of state.products) select.append(el('option',{value:p.id},p.name));
      if(state.products.some(p=>p.id===old)) select.value=old;
    }
  }
  function renderProducts(){
    const body=$('#product-rows');clear(body);
    for(const p of state.products) {
      const row=el('tr');td(row,p.name+' / '+p.unit,true);td(row,fmt(p.daily));td(row,yen(p.cost));td(row,yen(p.price));
      const actions=el('td',{className:'cell-action no-print'});
      actions.append(el('button',{type:'button',className:'tiny light',datasetAction:'edit-product','data-id':p.id},'編集'),el('button',{type:'button',className:'tiny danger',datasetAction:'delete-product','data-id':p.id},'削除'));
      row.append(actions);body.append(row);
    }
    if(!state.products.length){const row=el('tr');row.append(el('td',{colspan:'5',className:'empty'},'商品を登録してください'));body.append(row);}
  }
  function renderLots(){
    const body=$('#lots-rows');clear(body);
    const list=E.sortLots(state.lots);
    $('#lot-count').textContent=fmt(list.length)+'ロット';
    for(const l of list) {
      const p=state.products.find(p=>p.id===l.productId), row=el('tr');
      td(row,(p?.name||'不明')+' / '+l.label,true);td(row,l.expiry);td(row,fmt(l.qty)+' '+(p?.unit||''));
      const risk=td(row,pill(l.expiry));if(E.dayNumber(l.expiry)<=E.dayNumber(E.today())+2)risk.style.color='#b24f32';
      const actions=el('td',{className:'cell-action no-print'});
      actions.append(el('button',{type:'button',className:'tiny light',datasetAction:'edit-lot','data-id':l.id},'編集'),el('button',{type:'button',className:'tiny danger',datasetAction:'delete-lot','data-id':l.id},'削除'));
      row.append(actions);body.append(row);
    }
    if(!list.length){const row=el('tr');row.append(el('td',{colspan:'5',className:'empty'},'登録されたロットはありません'));body.append(row);}
  }
  function drawChart(rows){
    const host=$('#chart');clear(host);
    const NS='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 720 242');svg.setAttribute('preserveAspectRatio','none');
    const append=(tag, attrs, content) => {const x=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))x.setAttribute(k,v);if(content!==undefined)x.textContent=content;svg.append(x);return x;};
    const left=48,right=694,top=21,bottom=200;
    const maximum=Math.max(1,...rows.map(r=>Math.max(r.stock,r.waste,r.shortage)));
    for(let k=0;k<=4;k++){
      const y=bottom-(bottom-top)*k/4;
      append('line',{x1:left,y1:y,x2:right,y2:y,stroke:'#deebe0','stroke-width':'1'});
      append('text',{x:38,y:y+4,'font-size':11,fill:'#819588','text-anchor':'end'},String(Math.round(maximum*k/4)));
    }
    const bw=(right-left)/Math.max(rows.length,1),bar=Math.max(3,Math.min(16,bw*.22));
    rows.forEach((r,i)=>{
      const center=left+bw*(i+.5), yval=v=>Math.max(0,(bottom-top)*v/maximum);
      for (const [v,offset,color] of [[r.stock,-bar,'#397f61'],[r.waste,0,'#e29d84'],[r.shortage,bar,'#e2c477']]) {
        if(!v)continue;
        const rect=append('rect',{x:center+offset-bar/2,y:bottom-yval(v),width:bar,height:yval(v),fill:color,rx:2});
        rect.appendChild(document.createElementNS(NS,'title')).textContent=r.date+': '+v;
      }
      if (rows.length<=16 || i%Math.ceil(rows.length/12)===0)
        append('text',{x:center,y:224,'font-size':10,fill:'#61736c','text-anchor':'middle'},r.date.slice(5));
    });host.append(svg);
  }
  function renderForecast(){
    const pair=E.compare(state,options());lastForecast=pair;
    const {base,promo}=pair;
    $('#metric-stock').textContent=fmt(state.lots.reduce((s,l)=>s+l.qty,0));
    $('#metric-waste').textContent=fmt(base.summary.waste);
    $('#metric-waste-note').textContent=base.options.days+'日間の数量（予測）';
    $('#metric-saved').textContent=fmt(pair.savedWaste);
    $('#metric-missing').textContent=fmt(base.summary.shortage);
    $('#base-waste').textContent=fmt(base.summary.waste)+' 点';
    $('#promo-waste').textContent=fmt(promo.summary.waste)+' 点';
    $('#base-money').textContent='仕入原価ベース '+yen(base.summary.wasteCost);
    $('#promo-money').textContent='仕入原価ベース '+yen(promo.summary.wasteCost);
    const pct=Math.round(promo.options.uplift*100);
    $('#insight').textContent=`期限2日前から日販が${pct}%増えた場合、廃棄見込み ${fmt(pair.savedWaste)} 点削減、売上見込み差 ${yen(pair.extraRevenue)}。これは仮定上の比較で、値引き後の利益や需要増を保証しません。`;
    drawChart(base.rows);
    const body=$('#forecast-rows');clear(body);
    base.rows.forEach(r=>{const tr=el('tr');td(tr,r.date);td(tr,r.sold);td(tr,r.waste);td(tr,r.shortage);td(tr,r.stock);body.append(tr);});
    const risk=$('#risk-list');clear(risk);
    const sorted=state.lots.filter(l=>base.lossByLot[l.id]>0).sort((a,b)=>base.lossByLot[b.id]-base.lossByLot[a.id]).slice(0,8);
    if (!sorted.length)risk.append(el('p',{className:'empty'},'現状予測で期限ロスはありません'));
    const max=Math.max(1,...sorted.map(l=>base.lossByLot[l.id]));
    for (const l of sorted) {
      const p=state.products.find(p=>p.id===l.productId), row=el('div',{className:'riskrow'}), title=el('div');
      title.append(el('b',{},p.name+' / '+l.label),el('br'),el('small',{},l.expiry+'まで'));
      const bar=el('div',{className:'riskbar'});bar.append(el('span',{style:`width:${Math.round(100*base.lossByLot[l.id]/max)}%`}));title.append(bar);
      row.append(title,el('span',{className:'riskqty'},base.lossByLot[l.id]+' '+p.unit));risk.append(row);
    }
  }
  function renderMovements(){
    const body=$('#movement-rows');clear(body);
    for(const m of [...state.movements].reverse().slice(0,8)){
      const p=state.products.find(p=>p.id===m.productId), row=el('tr');
      td(row,m.date);td(row,m.kind==='sale'?'販売・使用':'廃棄');td(row,p?.name||'不明');td(row,m.qty);body.append(row);
    }
    if(!state.movements.length){const r=el('tr');r.append(el('td',{colspan:'4',className:'empty'},'実績はまだありません'));body.append(r);}
    $('#undo').disabled=!state.movements.length;
  }
  function render() { renderSelections();renderProducts();renderLots();renderMovements();renderForecast(); }
  function resetProduct(){ $('#product-form').reset();$('#product-id').value='';$('#product-form-title').textContent='商品を追加'; }
  function resetLot(){ $('#lot-form').reset();$('#lot-id').value='';$('#lot-form-title').textContent='ロットを追加'; }
  function update(next,msg){state=E.create(next.products,next.lots,next.movements);save();render();if(msg)alertMessage(msg);}
  function bind(){
    $('#run').addEventListener('click',()=>guarded(()=>{renderForecast();alertMessage('シミュレーションを更新しました');}));
    ['#start','#days','#weekend','#uplift'].forEach(sel=>$(sel).addEventListener('change',()=>guarded(renderForecast)));
    $('#product-form').addEventListener('submit',ev=>{ev.preventDefault();guarded(()=>{
      const input={id:$('#product-id').value||undefined,name:$('#product-name').value,unit:$('#product-unit').value,daily:$('#product-daily').value,cost:$('#product-cost').value,price:$('#product-price').value};
      const p=E.product(input), next=E.create(state.products,state.lots,state.movements);
      if(input.id) next.products[next.products.findIndex(x=>x.id===input.id)]=p;else next.products.push(p);
      update(next,'商品を保存しました');resetProduct();
    });});
    $('#lot-form').addEventListener('submit',ev=>{ev.preventDefault();guarded(()=>{
      const input={id:$('#lot-id').value||undefined,productId:$('#lot-product').value,label:$('#lot-label').value,qty:$('#lot-qty').value,expiry:$('#lot-expiry').value};
      const l=E.lot(input),next=E.create(state.products,state.lots,state.movements);
      if(input.id) next.lots[next.lots.findIndex(x=>x.id===input.id)]=l;else next.lots.push(l);
      update(next,'ロットを保存しました');resetLot();
    });});
    $('#product-reset').addEventListener('click',resetProduct);$('#lot-reset').addEventListener('click',resetLot);
    $('#product-rows').addEventListener('click',ev=>guarded(()=>{
      const btn=ev.target.closest('button[data-action]');if(!btn)return;
      const p=state.products.find(p=>p.id===btn.dataset.id);if(!p)return;
      if(btn.dataset.action==='edit-product'){
        $('#product-id').value=p.id;$('#product-name').value=p.name;$('#product-unit').value=p.unit;$('#product-daily').value=p.daily;$('#product-cost').value=p.cost;$('#product-price').value=p.price;$('#product-form-title').textContent='商品を編集';$('#product-form').scrollIntoView({behavior:'smooth',block:'center'});
      } else if(btn.dataset.action==='delete-product'){
        if(state.lots.some(l=>l.productId===p.id) || state.movements.some(m=>m.productId===p.id))throw new Error('ロットや履歴がある商品は削除できません');
        if(confirm(p.name+'を削除しますか？'))update({...state,products:state.products.filter(x=>x.id!==p.id)},'商品を削除しました');
      }
    }));
    $('#lots-rows').addEventListener('click',ev=>guarded(()=>{
      const btn=ev.target.closest('button[data-action]');if(!btn)return;
      const l=state.lots.find(l=>l.id===btn.dataset.id);if(!l)return;
      if(btn.dataset.action==='edit-lot'){
        $('#lot-id').value=l.id;$('#lot-product').value=l.productId;$('#lot-label').value=l.label;$('#lot-qty').value=l.qty;$('#lot-expiry').value=l.expiry;$('#lot-form-title').textContent='ロットを編集';$('#lot-form').scrollIntoView({behavior:'smooth',block:'center'});
      } else if(btn.dataset.action==='delete-lot'){
        if(state.movements.some(m=>m.allocations.some(a=>a.lotId===l.id)))throw new Error('操作履歴があるロットは削除できません');
        if(confirm(l.label+'を削除しますか？'))update({...state,lots:state.lots.filter(x=>x.id!==l.id)},'ロットを削除しました');
      }
    }));
    $('#movement-form').addEventListener('submit',ev=>{ev.preventDefault();guarded(()=>{
      const result=E.transact(state,{productId:$('#move-product').value,qty:$('#move-qty').value,date:$('#move-date').value,kind:$('#move-kind').value});
      update(result.state, '実績を記録しました（'+result.movement.allocations.length+'ロットから減算）');$('#move-qty').value='';
    });});
    $('#undo').addEventListener('click',()=>guarded(()=>update(E.undoLast(state),'最後の実績記録を取り消しました')));
    $('#export-json').addEventListener('click',()=>download('sendo-mawashi-backup.json',JSON.stringify(state,null,2),'application/json'));
    $('#export-csv').addEventListener('click',()=>download('sendo-mawashi-lots.csv',E.toCSV(state.lots.map(l=>({...l,productName:state.products.find(p=>p.id===l.productId)?.name||''})),[['商品','productName'],['ロット','label'],['数量','qty'],['期限','expiry']]),'text/csv'));
    $('#export-forecast').addEventListener('click',()=>guarded(()=>download('sendo-mawashi-forecast.csv',E.toCSV(lastForecast.base.rows,[['日付','date'],['販売','sold'],['期限ロス','waste'],['欠品','shortage'],['期末在庫','stock'],['売上予測','revenue']]),'text/csv')));
    $('#import-json').addEventListener('change',async e=>{
      const f=e.target.files?.[0];if(!f)return;
      try{if(f.size>2e6)throw new Error('2MB以下のJSONファイルを選択してください');
        const s=JSON.parse(await f.text()),next=E.create(s.products,s.lots,s.movements||[]);
        if(!confirm('現在の在庫データをJSONの内容で置き換えますか？'))return;
        update(next,'JSONデータを復元しました');resetLot();resetProduct();
      }catch(err){alertMessage('復元できません: '+err.message,true);}finally{e.target.value='';}
    });
    $('#print').addEventListener('click',()=>window.print());
    $('#demo-reset').addEventListener('click',()=>{if(confirm('すべての入力と記録をデモデータに戻しますか？')){update(E.defaultState(),'デモを復元しました');resetLot();resetProduct();}});
  }
  function download(name,content,type){
    const b=new Blob([content],{type:type+';charset=utf-8'}),url=URL.createObjectURL(b),a=el('a',{href:url,download:name});
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    alertMessage(name+' を書き出しました');
  }
  function init(){
    $('#start').value=E.today();$('#move-date').value=E.today();$('#lot-expiry').value=E.after(E.today(),3);
    state=load();bind();render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();