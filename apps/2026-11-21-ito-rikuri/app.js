(function(){
'use strict';
const E=window.ItoEngine;
const KEY='ito-rikuri-v1';
const $=id=>document.getElementById(id);
let project=E.makeSample(),selected=project.colors[0].id,tool='pen',history=[],future=[],drawing=false,lastCell=-1,toastTimer;
try {const saved=localStorage.getItem(KEY);if(saved)project=E.validateProject(JSON.parse(saved));}catch(e){console.warn('Stored data ignored:',e.message);}
if(!project.colors.some(c=>c.id===selected))selected=project.colors[0].id;
function persist(){try{localStorage.setItem(KEY,JSON.stringify(project));}catch(e){notify('端末保存できません。JSONで保存してください。');}}
function notify(msg){$('toast').textContent=msg;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3200);}
function snapshot(){history.push(JSON.stringify(project));if(history.length>60)history.shift();future=[];}
function commit(next,msg){project=E.validateProject(next);persist();render();if(msg)notify(msg);}
function undo(){if(!history.length)return;future.push(JSON.stringify(project));project=E.validateProject(JSON.parse(history.pop()));selected=project.colors.some(c=>c.id===selected)?selected:project.colors[0].id;persist();render();}
function redo(){if(!future.length)return;history.push(JSON.stringify(project));project=E.validateProject(JSON.parse(future.pop()));selected=project.colors.some(c=>c.id===selected)?selected:project.colors[0].id;persist();render();}
function el(tag,attrs={},text=null){const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){
if(k==='class')e.className=v;else if(k==='dataset')Object.assign(e.dataset,v);else if(k==='style')Object.assign(e.style,v);else e.setAttribute(k,String(v));}
if(text!==null)e.textContent=text;return e;}
function button(text,fn,klass=''){const b=el('button',{type:'button',class:klass},text);b.addEventListener('click',fn);return b;}
function render(){
const u=E.usage(project);
$('project-title').value=project.title;
$('canvas-summary').textContent=`${project.width} × ${project.height} マス`;
$('total-stitches').textContent=u.stitches.toLocaleString('ja-JP');
$('total-missing').textContent=u.missingColors;
$('project-status').textContent=u.missingColors?`${u.missingColors}色で糸が足りません · 合計 約${u.shortageCm.toFixed(1)}cm不足`:'手持ちの糸で全色まかなえます';
$('project-status').className='status'+(u.missingColors?' warning':'');
$('physical-size').textContent=`仕上がり目安：${u.physicalWidthCm} × ${u.physicalHeightCm} cm ／ 1目あたり約${u.factorCm.toFixed(3)}cm（6本束換算）`;
$('chart').innerHTML=E.svg(project,{symbols:true,cellSize:22});
$('set-width').value=project.width;$('set-height').value=project.height;
$('set-count').value=project.count;$('set-strands').value=project.strands;$('set-waste').value=project.waste;
$('size-preview').textContent=`${project.width}×${project.height}目 / ${project.count}ct`;
const palettes=$('swatches');palettes.replaceChildren();
for(const r of u.rows){
  const b=el('button',{type:'button',class:'swatch'+(r.id===selected?' selected':''),'aria-pressed':String(r.id===selected)});
  const chip=el('span',{class:'swatch-chip',style:{background:r.hex}},r.symbol);
  b.append(chip,document.createTextNode(r.name));b.addEventListener('click',()=>{selected=r.id;renderSwatchesOnly();});palettes.append(b);
}
renderStash(u);renderSuggestions();
$('undo').disabled=history.length===0;$('redo').disabled=future.length===0;
}
function renderSwatchesOnly(){document.querySelectorAll('.swatch').forEach((b,i)=>{const active=project.colors[i].id===selected;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});}
function renderStash(u){
const panel=$('stash-rows');panel.replaceChildren();
for(const r of u.rows){
 const row=el('div',{class:'stash-row'}), name=el('div',{class:'stash-name'});
 const color=el('input',{type:'color',class:'color-edit',value:r.hex,title:`${r.name}の色を変更`});
 color.addEventListener('change',()=>updateColor(r.id,'hex',color.value));
 const text=el('input',{type:'text',class:'stash-nameinput',value:r.name,maxlength:36,'aria-label':`${r.name}の色名`});
 text.addEventListener('change',()=>updateColor(r.id,'name',text.value.trim()||r.name));
 const stock=el('input',{type:'number',class:'stock-input',min:0,max:100000,step:.1,value:r.stockCm,'aria-label':`${r.name}の手持ちcm`});
 stock.addEventListener('change',()=>{const n=Number(stock.value);if(!Number.isFinite(n)||n<0||n>100000){notify('残量は0〜100000cmで入力');render();return;}updateColor(r.id,'stock',n);});
 const needed=el('div',{class:'needed'+(r.shortageCm?' shortage':'')});needed.append(el('strong',{},r.neededCm.toFixed(1)),el('small',{},r.shortageCm?`不足 ${r.shortageCm.toFixed(1)}`:'OK'));
 const first=el('div');name.append(color,text);first.append(name);
 const extra=el('div',{class:'stash-extra'});extra.append(el('span',{style:{color:'#83938f',fontSize:'10px'}},r.symbol+' '+r.stitches+'目'));
 const remove=button('削除',()=>deleteColor(r.id),'mini-remove');remove.setAttribute('aria-label',`${r.name}を削除`);remove.disabled=project.colors.length===1;extra.append(remove);first.append(extra);
 row.append(first,stock,needed);panel.append(row);
}
}
function renderSuggestions(){
const pane=$('suggestions');pane.replaceChildren();
const items=E.suggestions(project);
if(!items.length){pane.append(el('div',{class:'empty'},'不足している色はありません。追加の購入は不要です。'));return;}
for(const s of items){const r=el('div',{class:'swap-item'});r.append(el('div',{class:'swap-title'},`${s.fromName} → ${s.toName||'代替候補なし'}`));r.append(el('p',{},s.toId?`距離 ${s.distance} / ${s.explanation}`:s.explanation));
if(s.toId)r.append(button('図案の全マスを置換',()=>{snapshot();commit(E.replaceColor(project,s.fromId,s.toId),`${s.fromName}を${s.toName}に置き換えました`); }));
pane.append(r);}
}
function updateColor(id,key,value){snapshot();try{const p=E.deepCopy(project);const c=p.colors.find(x=>x.id===id);c[key]=value;commit(p);}catch(e){history.pop();notify(e.message);render();}}
function deleteColor(id){const c=project.colors.find(x=>x.id===id);if(!c||project.colors.length<2)return;const used=project.cells.filter(x=>x===id).length;
if(used&&!confirm(`${c.name}の${used}マスも消去します。続けますか？`))return;
snapshot();let p=E.deepCopy(project);p.colors=p.colors.filter(x=>x.id!==id);p.cells=p.cells.map(x=>x===id?null:x);
if(selected===id)selected=p.colors[0].id;commit(p,`${c.name}を削除しました`);
}
function eventCoords(e){const svg=$('chart').querySelector('svg');if(!svg)return null;const r=svg.getBoundingClientRect();if(!r.width||!r.height)return null;const x=Math.floor((e.clientX-r.left)/r.width*project.width),y=Math.floor((e.clientY-r.top)/r.height*project.height);
if(x<0||x>=project.width||y<0||y>=project.height)return null;return [x,y];}
function mark(e){const xy=eventCoords(e);if(!xy)return;const [x,y]=xy,idx=y*project.width+x;
if(idx===lastCell)return;lastCell=idx;const id=tool==='erase'?null:selected;
if(project.cells[idx]===id)return;
if(!drawing)return;
if(!drawing.modified){snapshot();drawing.modified=true;}
project=tool==='fill'?E.fill(project,x,y,id):E.paint(project,x,y,id);
persist();render();
}
$('chart').addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();drawing={modified:false};lastCell=-1;mark(e);if(tool==='fill')drawing=false;});
$('chart').addEventListener('pointermove',e=>{if(!drawing||tool==='fill')return;e.preventDefault();mark(e);});
document.addEventListener('pointerup',()=>{drawing=false;lastCell=-1;});
document.addEventListener('pointercancel',()=>{drawing=false;lastCell=-1;});
for(const name of ['pen','erase','fill'])$('tool-'+name).addEventListener('click',()=>{tool=name;for(const n of ['pen','erase','fill']){$('tool-'+n).classList.toggle('selected',name===n);$('tool-'+n).setAttribute('aria-pressed',String(name===n));}});
$('undo').addEventListener('click',undo);$('redo').addEventListener('click',redo);
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}else if((e.ctrlKey||e.metaKey)&&(e.shiftKey&&e.key.toLowerCase()==='z'||e.key.toLowerCase()==='y')){e.preventDefault();redo();}});
$('project-title').addEventListener('change',e=>{snapshot();const p=E.deepCopy(project);p.title=e.target.value;commit(p);});
$('apply-settings').addEventListener('click',()=>{try{const w=Number($('set-width').value),h=Number($('set-height').value);let p=E.resize(project,w,h);p.count=Number($('set-count').value);p.strands=Number($('set-strands').value);p.waste=Number($('set-waste').value);p=E.validateProject(p);snapshot();commit(p,'図案の設定を更新しました');}catch(e){notify(e.message);render();}});
$('add-color').addEventListener('click',()=>{if(project.colors.length>=12)return notify('最大12色です。');snapshot();const p=E.deepCopy(project);let id;do{id='c'+Math.random().toString(36).slice(2,10);}while(p.colors.some(c=>c.id===id));p.colors.push({id,name:'新しい糸',hex:'#C9B1D8',stock:0});selected=id;commit(p,'新しい糸を追加しました');});
function download(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function slug(){return (project.title.normalize('NFKC').replace(/[\\/:*?"<>|\s]+/g,'-').slice(0,30)||'ito-rikuri');}
$('save-json').addEventListener('click',()=>download(slug()+'.json',JSON.stringify(project,null,2),'application/json;charset=utf-8'));
$('save-svg').addEventListener('click',()=>download(slug()+'.svg',E.svg(project,{symbols:true,cellSize:28}),'image/svg+xml;charset=utf-8'));
$('save-csv').addEventListener('click',()=>download(slug()+'-threads.csv',E.csv(project),'text/csv;charset=utf-8'));
$('load-json').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;
try{if(f.size>500000)throw Error('500KB以下のJSONを選んでください。');const p=E.validateProject(JSON.parse(await f.text()));snapshot();selected=p.colors[0].id;commit(p,'図案を読み込みました');}catch(err){notify('読み込み失敗: '+err.message);}finally{e.target.value='';}
});
$('reset').addEventListener('click',()=>{if(!confirm('現在の図案をサンプルに戻しますか？（Undoできます）'))return;snapshot();selected='petal';commit(E.makeSample(),'サンプルを復元しました');});
$('print').addEventListener('click',()=>{
const u=E.usage(project),root=$('print-area');root.replaceChildren();root.append(el('h1',{},project.title));root.append(el('small',{},`${project.width}×${project.height}目 / ${project.count}ct / ${project.strands}本取り · 糸量は概算`));
const chart=el('div',{class:'print-chart'});chart.innerHTML=E.svg(project,{symbols:true,cellSize:20});root.append(chart);
const legend=el('div',{class:'legend'});u.rows.filter(r=>r.stitches>0).forEach(r=>legend.append(el('span',{},`${r.symbol} ${r.name}：${r.stitches}目 ／ 約${r.neededCm}cm`)));root.append(legend);
window.print();
});
render();
})();
