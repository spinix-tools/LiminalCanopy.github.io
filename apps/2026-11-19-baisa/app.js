/* BAISA: Browser controller. No network requests. MIT. */
(function(){
'use strict';
const E=window.BaisaEngine;
const $=id=>document.getElementById(id);
const STORAGE='baisa-project-v1';
let mode='phase', current=null, saving=true;
function readBatch(letter){const l=letter.toLowerCase();return {name:$('name-'+l).value,csv:$('csv-'+l).value,yellow:$('yellow-'+l).value,crack:$('crack-'+l).value,drop:$('drop-'+l).value};}
function writeBatch(letter,v){const l=letter.toLowerCase();for(const k of ['name','csv','yellow','crack','drop'])$(''+k+'-'+l).value=String(v[k]??'');}
function project(){return {schema:1,mode,batches:[readBatch('a'),readBatch('b')]};}
function apply(v){if(!v||v.schema!==1||!Array.isArray(v.batches)||v.batches.length!==2)throw Error('このアプリのプロジェクトJSONではありません');
  for(const b of v.batches){if(!b||typeof b.csv!=='string'||b.csv.length>400000)throw Error('JSONのCSVデータが不正または大きすぎます');E.validate(b);}
  writeBatch('a',v.batches[0]);writeBatch('b',v.batches[1]);mode=['phase','crack','elapsed'].includes(v.mode)?v.mode:'phase';updateMode();render();}
function updateMode(){document.querySelectorAll('.mode').forEach(b=>{const on=b.dataset.mode===mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on?'true':'false');});}
function setText(id,value){$(id).textContent=value;}
function signed(n,unit){return (n>0?'+':'')+n.toFixed(1)+unit;}
function make(tag,attrs,parent){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const k of Object.keys(attrs||{}))node.setAttribute(k,String(attrs[k]));if(parent)parent.appendChild(node);return node;}
function svgChart(c){
  const W=920,H=363,left=58,right=22,top=24,bottom=52,ww=W-left-right,hh=H-top-bottom;
  const vals=c.rows.flatMap(q=>[q.a,q.b]);let ymin=Math.floor((Math.min(...vals)-7)/10)*10,ymax=Math.ceil((Math.max(...vals)+7)/10)*10;
  if(ymax<=ymin)ymax=ymin+10;
  const sx=i=>left+ww*i/100,sy=y=>top+hh-(y-ymin)*hh/(ymax-ymin);
  const svg=make('svg',{viewBox:'0 0 '+W+' '+H,xmlns:'http://www.w3.org/2000/svg',role:'img','aria-label':'バッチAとBの温度プロファイル比較'});
  const grid=make('g',{},svg);
  for(let i=0;i<=5;i++){const y=top+hh*i/5;make('line',{x1:left,y1:y,x2:W-right,y2:y,stroke:'#e5eae4','stroke-width':1},grid);const t=make('text',{x:left-11,y:y+4,'text-anchor':'end',fill:'#76877b','font-size':12},grid);t.textContent=String((ymax-(ymax-ymin)*i/5).toFixed(0));}
  for(let i=0;i<=5;i++){const x=sx(i*20);make('line',{x1:x,y1:top,x2:x,y2:top+hh,stroke:'#e9ede7','stroke-dasharray':'3 5'},grid);const t=make('text',{x,y:H-20,'text-anchor':'middle',fill:'#75877a','font-size':12},grid);const ax=c.min+(c.max-c.min)*i/5;t.textContent=c.mode==='phase'?Math.round(ax)+'%':(c.mode==='crack'&&ax>0?'+':'')+E.formatTime(Math.abs(ax))+(c.mode==='crack'&&ax<0?'前':'');}
  if(c.mode==='phase'){for(let i=1;i<=2;i++){const x=sx(i*100/3);make('line',{x1:x,y1:top,x2:x,y2:top+hh,stroke:'#b2bdb2','stroke-width':1.3,'stroke-dasharray':'6 5'},svg);const txt=make('text',{x:x+6,y:top+13,fill:'#76877b','font-size':10},svg);txt.textContent=i===1?'黄変':'1ハゼ';}}
  const points=k=>c.rows.map((v,i)=>sx(i).toFixed(2)+','+sy(v[k]).toFixed(2)).join(' ');
  make('polyline',{points:points('a'),stroke:'#cc8551',fill:'none','stroke-width':3.7,'stroke-linecap':'round','stroke-linejoin':'round'},svg);
  make('polyline',{points:points('b'),stroke:'#458b76',fill:'none','stroke-width':3.4,'stroke-dasharray':'9 5','stroke-linecap':'round','stroke-linejoin':'round'},svg);
  const index=Number($('cursor').value);const row=c.rows[index];const x=sx(index);
  make('line',{x1:x,y1:top,x2:x,y2:top+hh,stroke:'#8e9d91','stroke-width':1.5,'stroke-dasharray':'5 4'},svg);
  for(const [key,color] of [['a','#cc8551'],['b','#458b76']]){make('circle',{cx:x,cy:sy(row[key]),r:6,fill:'#fff',stroke:color,'stroke-width':3},svg);}
  const yl=make('text',{x:15,y:15,fill:'#76877b','font-size':11},svg);yl.textContent='豆温 (°C)';
  $('chart').replaceChildren(svg);$('chart').setAttribute('aria-label','焙煎温度比較。平均温度差'+c.mae.toFixed(1)+'度');
  return svg;
}
function updateCursor(){if(!current)return;svgChart(current);const row=current.rows[Number($('cursor').value)];
  const pos=current.mode==='phase'?row.x.toFixed(0)+'%':(current.mode==='crack'&&row.x>0?'+':'')+E.formatTime(Math.abs(row.x))+(current.mode==='crack'&&row.x<0?'前':'');
  setText('cursor-label',pos);
  setText('cursor-detail','A '+E.formatTime(row.ta)+' · '+row.a.toFixed(1)+'°C　/　B '+E.formatTime(row.tb)+' · '+row.b.toFixed(1)+'°C　→　差 '+signed(row.diff,'°C'));
}
function summary(c){const tbody=$('summary-rows');tbody.replaceChildren();for(const [key,p] of [['A',c.A],['B',c.B]]){
  const tr=document.createElement('tr');for(const v of [key+' / '+p.name,E.formatTime(p.yellow),E.formatTime(p.crack),E.formatTime(p.drop),p.dtr.toFixed(1)+'%',p.temps.drop.toFixed(1)+'°C']){const td=document.createElement('td');td.textContent=v;tr.appendChild(td);}tbody.appendChild(tr);
}}
function render(){
 try{const c=E.compare(readBatch('a'),readBatch('b'),mode);current=c;$('error').hidden=true;
   setText('mae',c.mae.toFixed(1)+'°C');setText('max-gap',c.maxGap.toFixed(1)+'°C');setText('max-at','比較軸 '+(c.mode==='phase'?c.maxAt.toFixed(0)+'%':E.formatTime(Math.abs(c.maxAt))));
   setText('dtr',signed(c.gapDtr,'pt'));setText('drop-gap',signed(c.gapDrop,'°C'));
   setText('axis-note',mode==='phase'?'工程の進捗 (%) · 各工程を等幅に正規化':mode==='crack'?'1ハゼを0秒に揃えて比較':'投入からの経過秒数で比較');
   const phase=$('phase-grid');phase.hidden=mode!=='phase';
   for(const [id,key] of [['phase-dry','dry'],['phase-maillard','maillard'],['phase-develop','develop']])setText(id,c.part[key]!=null?c.part[key].toFixed(1)+'°C':'—');
   summary(c);updateCursor();
   if(saving)try{localStorage.setItem(STORAGE,JSON.stringify(project()));}catch(_e){}
 }catch(e){current=null;$('error').textContent=e.message;$('error').hidden=false;setText('mae','—');setText('max-gap','—');setText('dtr','—');setText('drop-gap','—');$('chart').replaceChildren();setText('cursor-detail','入力を修正してください');}
}
function download(name,content,mime){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function safeRun(fn){try{fn();}catch(e){$('error').textContent=e.message;$('error').hidden=false;}}
for(const id of ['name-a','name-b','csv-a','csv-b','yellow-a','yellow-b','crack-a','crack-b','drop-a','drop-b'])$(id).addEventListener('input',render);
for(const s of ['a','b'])$('file-'+s).addEventListener('change',async ev=>{const file=ev.target.files[0];if(!file)return;if(file.size>400000){safeRun(()=>{throw Error('CSVは400KB以下にしてください');});return;}safeRun(async()=>{try{$('csv-'+s).value=await file.text();render();}catch(e){$('error').textContent=e.message;$('error').hidden=false;}});ev.target.value='';});
document.querySelectorAll('.mode').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;updateMode();render();}));
$('cursor').addEventListener('input',updateCursor);
$('demo').addEventListener('click',()=>{writeBatch('a',E.DEMO[0]);writeBatch('b',E.DEMO[1]);mode='phase';updateMode();render();});
$('export-csv').addEventListener('click',()=>safeRun(()=>{if(!current)throw Error('比較が有効な場合のみ出力できます');download('baisa-comparison.csv','\uFEFF'+E.exportCsv(current),'text/csv;charset=utf-8');}));
$('export-json').addEventListener('click',()=>safeRun(()=>download('baisa-project.json',JSON.stringify(project(),null,2)+'\n','application/json')));
$('export-svg').addEventListener('click',()=>safeRun(()=>{if(!current)throw Error('比較が有効な場合のみ出力できます');const svg=$('chart').querySelector('svg');download('baisa-roast-curves.svg',new XMLSerializer().serializeToString(svg),'image/svg+xml;charset=utf-8');}));
$('import-json').addEventListener('change',async ev=>{const file=ev.target.files[0];if(!file)return;try{if(file.size>800000)throw Error('JSONは800KB以下にしてください');const v=JSON.parse(await file.text());apply(v);}catch(e){$('error').textContent=e.message;$('error').hidden=false;}ev.target.value='';});
$('print').addEventListener('click',()=>window.print());
try{const s=localStorage.getItem(STORAGE);if(s){saving=false;apply(JSON.parse(s));saving=true;}else throw Error('no saved data');}
catch(_e){saving=true;writeBatch('a',E.DEMO[0]);writeBatch('b',E.DEMO[1]);mode='phase';updateMode();render();}
})();
