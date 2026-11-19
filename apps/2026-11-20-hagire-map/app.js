(function () {
  'use strict';
  const Engine=window.Hagire;
  const KEY='hagire-map-v1';
  const $=id=>document.getElementById(id);
  const $$=(sel,root=document)=>Array.from(root.querySelectorAll(sel));
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let project,plan=null,undo=null,sequence=0;
  function fresh(){return {name:'新しい作品',gap:5,stocks:[],parts:[]}}
  function makeId(pre){return pre+'-'+Date.now().toString(36)+'-'+(++sequence)}
  function getInitial(){try{const s=localStorage.getItem(KEY);if(s){const p=JSON.parse(s);Engine.validate(p);return p}}catch(e){}return Engine.sample()}
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(project));}catch(e){message('端末保存に失敗しました（ブラウザの設定をご確認ください）',true)}}
  function message(s,bad=false){const el=$('status');el.textContent=s;el.style.color=bad?'#a63f39':'#497e56'}
  function input(kind,item,field,type='text',min=null,max=null){
    const el=document.createElement('input');el.type=type;el.dataset.kind=kind;el.dataset.id=item.id;el.dataset.field=field;
    if(type==='checkbox'){el.checked=!!item[field];el.setAttribute('aria-label','90度回転を許可');}
    else {el.value=item[field];if(min!==null)el.min=min;if(max!==null)el.max=max;if(type==='number')el.step='any';el.setAttribute('aria-label',field);}
    return el;
  }
  function cell(tr,child,cls){const td=document.createElement('td');if(cls)td.className=cls;td.append(child);tr.append(td);}
  function redrawRows(){
    $('stockRows').replaceChildren();$('partRows').replaceChildren();
    for(const s of project.stocks){
      const tr=document.createElement('tr');
      cell(tr,input('stocks',s,'name'));cell(tr,input('stocks',s,'material'));
      const sel=document.createElement('select');sel.dataset.kind='stocks';sel.dataset.id=s.id;sel.dataset.field='kind';
      for(const [v,t] of [['scrap','端切れ'],['new','新品']]){const o=document.createElement('option');o.value=v;o.textContent=t;o.selected=s.kind===v;sel.append(o)}cell(tr,sel);
      cell(tr,input('stocks',s,'w','number',1,10000));cell(tr,input('stocks',s,'h','number',1,10000));cell(tr,input('stocks',s,'qty','number',1,24));
      cell(tr,delButton('stocks',s.id));$('stockRows').append(tr);
    }
    for(const p of project.parts){
      const tr=document.createElement('tr');
      cell(tr,input('parts',p,'name'));cell(tr,input('parts',p,'material'));
      cell(tr,input('parts',p,'w','number',1,10000));cell(tr,input('parts',p,'h','number',1,10000));cell(tr,input('parts',p,'qty','number',1,60));cell(tr,input('parts',p,'allowance','number',0,100));cell(tr,input('parts',p,'rotate','checkbox'),'check-cell');
      cell(tr,delButton('parts',p.id));$('partRows').append(tr);
    }
    $('stockCount').textContent=project.stocks.length;$('partCount').textContent=project.parts.length;
    $('projectName').value=project.name;$('gap').value=project.gap;
  }
  function delButton(kind,id){const b=document.createElement('button');b.type='button';b.className='delete';b.title='この行を削除';b.setAttribute('aria-label','削除');b.textContent='×';b.dataset.deleteKind=kind;b.dataset.deleteId=id;return b}
  function edit(ev){const el=ev.target;const {kind,id,field}=el.dataset;if(!kind)return;
    const record=project[kind].find(x=>x.id===id);if(!record)return;
    record[field]=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;
    calculate(false);
  }
  function element(type,attrs={},content){const e=document.createElement(type);for(const [k,v] of Object.entries(attrs)){if(k==='class')e.className=v;else e.setAttribute(k,v)}if(content!==undefined)e.textContent=String(content);return e}
  const NS='http://www.w3.org/2000/svg';
  function svgEl(tag,attrs={},txt){const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));if(txt!==undefined)e.textContent=String(txt);return e}
  const colors=['#9bc1af','#d6b7a4','#abc2d7','#dbce9a','#b9b0ca','#c6d4ae','#e4bac0','#acc9c5'];
  function colorFor(material){let n=0;for(const ch of material)n=(n*31+ch.charCodeAt(0))>>>0;return colors[n%colors.length]}
  function drawSheet(s){
    const svg=svgEl('svg',{viewBox:`0 0 ${s.w} ${s.h}`,'aria-label':`${s.name}の裁断配置`,role:'img'});
    svg.append(svgEl('rect',{x:0,y:0,width:s.w,height:s.h,fill:'#e9f3eb',stroke:'#4b8060','stroke-width':Math.max(1,Math.min(s.w,s.h)*.004)}));
    for(const f of s.free){svg.append(svgEl('rect',{x:f.x,y:f.y,width:f.w,height:f.h,fill:'#e1eee2',stroke:'#9fbda7','stroke-dasharray':'6 5','stroke-width':1.5}));}
    for(const p of s.placements){
      svg.append(svgEl('rect',{x:p.x,y:p.y,width:p.w,height:p.h,fill:colorFor(p.material),stroke:'#fff','stroke-width':Math.max(1,Math.min(s.w,s.h)*.005)}));
      const fsize=Math.min(22,Math.max(8,Math.min(p.w/6,p.h/2.8)));
      if(p.w>50 && p.h>32){
        svg.append(svgEl('text',{x:p.x+p.w/2,y:p.y+p.h/2-3,'text-anchor':'middle','font-size':fsize,'font-weight':'700',fill:'#254338'},p.name.length>14?p.name.slice(0,13)+'…':p.name));
        svg.append(svgEl('text',{x:p.x+p.w/2,y:p.y+p.h/2+fsize,'text-anchor':'middle','font-size':Math.max(8,fsize*.7),fill:'#36594b'},`${Math.round(p.w)} × ${Math.round(p.h)}`+(p.rotated?' ↻':'')));
      }
    }
    return svg;
  }
  function present(){
    $('placedMetric').textContent=plan?`${plan.placedCount} / ${plan.requestedCount}`:'–';
    $('sheetsMetric').textContent=plan?`${plan.used.length} 枚`:'–';
    $('scrapMetric').textContent=plan?plan.scrapsUsed:'–';
    $('effMetric').textContent=plan?`${(100*plan.efficiency).toFixed(1)}%`:'–';
    $('missingMetric').textContent=plan?`${plan.unplaced.length} 個`:'–';
    $('commit').disabled=!plan||plan.unplaced.length>0||plan.placedCount===0||Engine.nextInventory(plan,50).length>80;
    $('undo').disabled=!undo;
    const missing=$('unplaced');missing.hidden=!plan||!plan.unplaced.length;
    if(plan&&plan.unplaced.length){
      const items=plan.unplaced.map(p=>p.name+' ('+p.material+')').slice(0,12);
      missing.textContent=`未配置 ${plan.unplaced.length}個：${items.join('、')}${plan.unplaced.length>12?' ほか':''}。対応する布の不足や配置の限界があります。`;
    }
    $('diagrams').replaceChildren();
    if(!plan||!plan.used.length){$('diagrams').append(element('div',{class:'empty'},'布とパーツを追加すると、ここに裁断マップが表示されます。'));return}
    for(const [i,s] of plan.used.entries()){
      const card=element('article',{class:'sheet-card'});
      const header=element('header');const names=element('div');names.append(element('h3',{},`${i+1}. ${s.name}`),element('p',{},`${s.material} · ${s.w} × ${s.h} mm`));
      const pill=element('span',{class:'type-pill'+(s.kind==='new'?' new':'')},s.kind==='new'?'新品':'端切れ');header.append(names,pill);
      const frame=element('div',{class:'sheet-frame'});frame.append(drawSheet(s));
      const meta=element('div',{class:'sheet-meta'});meta.append(element('span',{},`${s.placements.length} パーツ`),element('span',{},`利用率 ${(100*s.placements.reduce((a,p)=>a+p.w*p.h,0)/(s.w*s.h)).toFixed(1)}%`));
      card.append(header,frame,meta);$('diagrams').append(card);
    }
    const n=plan.used.reduce((t,s)=>t+s.free.filter(r=>r.w>=50&&r.h>=50).length,0);
    $('carryMessage').textContent=`使用した布から、各辺50mm以上の余り ${n} 枚を端切れとして残します。未使用の布はそのまま持ち越し。実際に切った後だけ確定してください。`;
  }
  function calculate(report=false){
    try{
      plan=Engine.optimize(project);
      const check=Engine.checkLayout(plan,project.gap);
      if(!check.valid)throw new Error('裁断図の幾何検証エラー: '+check.errors[0]);
      $('errors').hidden=true;present();persist();
      if(report)message(`計算完了：${plan.placedCount}個配置 / ${plan.unplaced.length}個未配置`);
    }catch(e){plan=null;$('errors').hidden=false;$('errors').textContent=e.message;present();if(report)message('入力値を確認してください',true)}
  }
  function download(text,mime,file){const b=new Blob([text],{type:mime});const url=URL.createObjectURL(b);const a=document.createElement('a');a.href=url;a.download=file;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);message(`${file} を出力しました`)}
  function safeName(){return (project.name||'hagire-map').replace(/[^a-zA-Z0-9ぁ-ゖァ-ヶ一-龠ー_-]/g,'-').slice(0,32)||'hagire-map'}
  function csvValue(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}
  function exportCsv(){if(!plan){message('有効な計画がありません',true);return}const rows=[['布名','生地','分類','布の幅mm','布の高さmm','パーツ','個体番号','裁断幅mm','裁断高さmm','左上Xmm','左上Ymm','回転']];
    for(const s of plan.used)for(const p of s.placements)rows.push([s.name,s.material,s.kind,s.w,s.h,p.name,p.number,p.w,p.h,p.x,p.y,p.rotated?'あり':'なし']);
    download('\ufeff'+rows.map(r=>r.map(csvValue).join(',')).join('\r\n'),'text/csv;charset=utf-8',safeName()+'-cutlist.csv');}
  function exportSvg(){if(!plan||!plan.used.length){message('出力する図面がありません',true);return}
    const cols=2,w=790,hmargin=78,maxW=730;let y=18;
    const out=svgEl('svg',{xmlns:NS,width:maxW+40,height:10,viewBox:'0 0 770 10'});
    out.append(svgEl('rect',{x:0,y:0,width:770,height:10,fill:'#fff'}));
    for(const [i,s] of plan.used.entries()){
      const scale=Math.min(maxW/s.w,440/s.h);const sh=s.h*scale;
      out.append(svgEl('text',{x:20,y:y+18,'font-size':15,fill:'#26352d','font-weight':'bold'},`${i+1}. ${s.name} / ${s.w} × ${s.h} mm`));
      const g=svgEl('g',{transform:`translate(20 ${y+29}) scale(${scale})`});
      for(const child of Array.from(drawSheet(s).children))g.append(child.cloneNode(true));out.append(g);
      y+=sh+hmargin;
    }
    out.setAttribute('height',String(y+10));out.setAttribute('viewBox',`0 0 770 ${y+10}`);
    download('<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(out),'image/svg+xml;charset=utf-8',safeName()+'-cutmap.svg');
  }
  function importProject(data){Engine.validate(data);project={name:typeof data.name==='string'?data.name.slice(0,70):'読み込んだ作品',gap:data.gap,stocks:data.stocks,parts:data.parts};undo=null;redrawRows();calculate(true);message('プロジェクトを読み込みました')}
  function ready(){
    project=getInitial();redrawRows();calculate();
    for(const id of ['stockRows','partRows']){
      $(id).addEventListener('input',edit);$(id).addEventListener('change',edit);
      $(id).addEventListener('click',e=>{const b=e.target.closest('[data-delete-kind]');if(!b)return;project[b.dataset.deleteKind]=project[b.dataset.deleteKind].filter(x=>x.id!==b.dataset.deleteId);redrawRows();calculate(true)});
    }
    $('projectName').addEventListener('input',e=>{project.name=e.target.value;calculate()});
    $('gap').addEventListener('input',e=>{project.gap=Number(e.target.value);calculate()});
    $('addStock').addEventListener('click',()=>{const material=project.parts[0]?.material||project.stocks[0]?.material||'コットン';project.stocks.push({id:makeId('s'),name:'端切れ',material,kind:'scrap',w:300,h:220,qty:1});redrawRows();calculate(true)});
    $('addPart').addEventListener('click',()=>{const material=project.stocks[0]?.material||'コットン';project.parts.push({id:makeId('p'),name:'新しいパーツ',material,w:120,h:100,qty:1,allowance:10,rotate:true});redrawRows();calculate(true)});
    $('demo').addEventListener('click',()=>{project=Engine.sample();undo=null;redrawRows();calculate(true);message('サンプルを読み込みました')});
    $('fresh').addEventListener('click',()=>{project=fresh();undo=null;redrawRows();calculate(true);message('新規プロジェクトを作成しました')});
    $('calculate').addEventListener('click',()=>calculate(true));
    $('csv').addEventListener('click',exportCsv);$('svg').addEventListener('click',exportSvg);
    $('saveJson').addEventListener('click',()=>download(JSON.stringify(project,null,2),'application/json;charset=utf-8',safeName()+'.json'));
    $('loadJson').addEventListener('click',()=>$('jsonFile').click());
    $('jsonFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>512000)throw new Error('JSONは500KB以下にしてください');importProject(JSON.parse(await f.text()))}catch(err){message('読込エラー：'+err.message,true)}e.target.value=''});
    $('print').addEventListener('click',()=>window.print());
    $('commit').addEventListener('click',()=>{if(!plan||plan.unplaced.length||!plan.placedCount)return;
      const remaining=Engine.nextInventory(plan,50);if(remaining.length>80){message('更新後の布が80種類を超えるため確定できません',true);return}
      undo=JSON.parse(JSON.stringify(project));project.stocks=remaining;project.parts=[];redrawRows();calculate();message(`裁断完了として在庫を更新しました：残り ${remaining.length}枚。誤操作なら「確定を取り消す」で戻せます。`)});
    $('undo').addEventListener('click',()=>{if(!undo)return;project=undo;undo=null;redrawRows();calculate();message('裁断確定を取り消して元の在庫に戻しました')});
  }
  document.addEventListener('DOMContentLoaded',ready);
})();
