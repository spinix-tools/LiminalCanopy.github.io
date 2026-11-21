/* YOHAKU LABEL — local-only editor and print UI, MIT License */
(()=>{'use strict';
const E=window.YohakuEngine;
const $=id=>document.getElementById(id);
const DEFAULT={paper:'A4',landscape:false,labelW:50,labelH:30,marginX:10,marginY:10,gapX:4,gapY:4,mode:'group',skip:'1-3',items:[{name:'青空のしおり',note:'手製本 / 2026',qty:16,color:'#548a90'},{name:'ハーブ石けん',note:'Crafted with care',qty:12,color:'#ba8871'},{name:'小さな花束',note:'thanks for visiting',qty:9,color:'#8d85a8'}]};
const storageKey='yohaku-label-v1';
let state=structuredClone(DEFAULT),layout=null,currentPage=0,toastTimer;
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved&&Array.isArray(saved.items)&&saved.items.length<=E.LIMITS.maxItems)state={...DEFAULT,...saved};}catch(e){}
const keys=['labelW','labelH','marginX','marginY','gapX','gapY'];
function syncControls(){ $('paper').value=state.paper; $('orientation').value=state.landscape?'landscape':'portrait';$('mode').value=state.mode;$('skip').value=state.skip;keys.forEach(k=>$(k).value=state[k]); }
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch(e){ /* private mode / quota: app remains usable */ }}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2700);}
function itemRow(it,i){const row=document.createElement('div');row.className='item-row';row.dataset.index=i;
 row.innerHTML='<input class="swatch" type="color" aria-label="品目の色"><div class="item-main"><input class="item-name" maxlength="80" aria-label="品目名" placeholder="品目名"><input class="note" maxlength="120" aria-label="補足テキスト" placeholder="補足テキスト（任意）"></div><label class="qty-column">枚数<input class="item-qty" type="number" min="0" max="2400" step="1"></label><button class="item-delete" type="button" title="削除" aria-label="この品目を削除">×</button>';
 row.querySelector('.swatch').value=it.color||'#64748b';row.querySelector('.item-name').value=it.name;row.querySelector('.note').value=it.note;row.querySelector('.item-qty').value=it.qty;return row; }
function renderItems(){const el=$('items');el.replaceChildren(...state.items.map(itemRow));}
function svgNode(tag,attrs={},value){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));if(value!==undefined)el.textContent=String(value);return el;}
function clipLines(text,maxUnits,limit=2){let lines=[''];const glyphs=Array.from(text||'');let row=0,used=0;const cost=ch=>/^[\x00-\xff]$/.test(ch)?0.57:1;
 for(const char of glyphs){const w=cost(char);if(used+w>maxUnits&&used>0){if(row===limit-1){lines[row]=lines[row].replace(/.$/u,'…');break;}row++;lines.push('');used=0;}lines[row]+=char;used+=w;}return lines; }
function createSVG(layout,page,drawGuides=true){
 const s=svgNode('svg',{xmlns:'http://www.w3.org/2000/svg',width:`${layout.pageWidth}mm`,height:`${layout.pageHeight}mm`,viewBox:`0 0 ${layout.pageWidth} ${layout.pageHeight}`,role:'img','aria-label':`ラベル配置 ${page.number}枚目`});
 s.appendChild(svgNode('rect',{x:0,y:0,width:layout.pageWidth,height:layout.pageHeight,fill:'#fff'}));
 for(const cell of page.cells){if(cell.sku===null)continue;const it=layout.items[cell.sku],x=cell.x,y=cell.y,w=layout.labelW,h=layout.labelH;
 const g=svgNode('g');g.appendChild(svgNode('rect',{x,y,width:w,height:h,fill:'#fff',stroke:drawGuides?'#a2adb6':'none','stroke-width':'.22','stroke-dasharray':drawGuides?'1.5 1.25':''}));
 g.appendChild(svgNode('rect',{x:x+1.4,y:y+1.4,width:Math.max(.8,w-2.8),height:2.4,fill:it.color,rx:1}));
 const mainSize=Math.min(4.4,Math.max(2.5,h*.17));const subSize=Math.min(2.75,Math.max(1.9,h*.10));const units=(w-8)/(mainSize*.95);
 const lines=clipLines(it.name,units,h>=26?2:1);
 lines.forEach((line,index)=>g.appendChild(svgNode('text',{x:x+4,y:y+Math.min(h*.43,12)+index*(mainSize+1),fill:'#21343b','font-family':'sans-serif','font-size':mainSize,'font-weight':700},line)));
 const subtitle=clipLines(it.note,Math.max(4,(w-8)/(subSize*.9)),1)[0];
 if(subtitle)g.appendChild(svgNode('text',{x:x+4,y:y+h-4.3,fill:'#61737a','font-family':'sans-serif','font-size':subSize},subtitle));
 s.appendChild(g);
 }
 return s;
}
function renderPicker(){const el=$('slotPicker');el.replaceChildren();if(!layout||!layout.cols||layout.slots>150){el.textContent='面数が確定するとここに表示されます。';return;}el.style.gridTemplateColumns=`repeat(${layout.cols},minmax(0,1fr))`;
 const selected=new Set(E.parseSkipped(state.skip,layout.slots).skipped);const count=Math.min(layout.slots,150);
 for(let i=1;i<=count;i++){const b=document.createElement('button');b.className='slot'+(selected.has(i)?' selected':'');b.type='button';b.dataset.slot=i;b.textContent=i;b.title=selected.has(i)?`位置${i}：使用済み（押すと解除）`:`位置${i}：未使用（押すと使用済み）`;b.setAttribute('aria-pressed',String(selected.has(i)));el.appendChild(b);}
}
function render(){layout=E.plan(state,state.items);const valid=layout.ok;
 $('layoutBadge').textContent=valid?`${layout.cols}列 × ${layout.rows}行`:'要調整';$('layoutBadge').style.background=valid?'#e4f4eb':'#fae5df';$('layoutBadge').style.color=valid?'#2c7c5d':'#a5523d';
 $('statTotal').textContent=valid?layout.total.toLocaleString('ja-JP'):'—';$('statSheets').textContent=valid?layout.pages.length:'—';$('statUnused').textContent=valid?layout.unused:'—';
 $('errors').hidden=valid;if(!valid){const ul=document.createElement('ul');layout.errors.forEach(err=>{const li=document.createElement('li');li.textContent=err;ul.appendChild(li);});$('errors').replaceChildren(ul);}
 currentPage=valid?Math.max(0,Math.min(currentPage,layout.pages.length-1)):0;
 $('svgWrap').replaceChildren();if(valid)$('svgWrap').appendChild(createSVG(layout,layout.pages[currentPage]));
 else {const d=document.createElement('div');d.textContent='設定を見直すとプレビューが表示されます。';d.style.cssText='padding:60px 20px;color:#8e9d9b;text-align:center';$('svgWrap').append(d);}
 $('pageInfo').textContent=valid?`${currentPage+1} / ${layout.pages.length} 枚目`:'— / —';
 $('prevPage').disabled=!valid||currentPage===0;$('nextPage').disabled=!valid||currentPage===layout.pages.length-1;
 ['printBtn','svgBtn','csvBtn'].forEach(id=>$(id).disabled=!valid);renderPicker();persist();}
function updateFromControls(){state.paper=$('paper').value;state.landscape=$('orientation').value==='landscape';state.mode=$('mode').value;state.skip=$('skip').value;keys.forEach(k=>state[k]=$(k).value);currentPage=0;render();}
['paper','orientation','mode','skip',...keys].forEach(k=>$(k).addEventListener('input',updateFromControls));
$('items').addEventListener('input',e=>{const row=e.target.closest('.item-row');if(!row)return;const it=state.items[Number(row.dataset.index)];if(!it)return;
 const cls=e.target.classList;if(cls.contains('swatch'))it.color=e.target.value;if(cls.contains('item-name'))it.name=e.target.value;if(cls.contains('note'))it.note=e.target.value;if(cls.contains('item-qty'))it.qty=Number(e.target.value);currentPage=0;render();});
$('items').addEventListener('click',e=>{if(!e.target.closest('.item-delete'))return;const row=e.target.closest('.item-row');state.items.splice(Number(row.dataset.index),1);renderItems();render();});
$('addItem').addEventListener('click',()=>{if(state.items.length>=E.LIMITS.maxItems)return toast('品目は最大60件です');state.items.push({name:'新しいラベル',note:'',qty:1,color:'#4d8780'});renderItems();render();$('items').lastElementChild.querySelector('.item-name').focus();});
$('slotPicker').addEventListener('click',e=>{const b=e.target.closest('button[data-slot]');if(!b||!layout||!layout.slots)return;const skipped=new Set(E.parseSkipped(state.skip,layout.slots).skipped);const n=Number(b.dataset.slot);if(skipped.has(n))skipped.delete(n);else skipped.add(n);state.skip=E.compressSkipped([...skipped]);$('skip').value=state.skip;render();});
$('prevPage').addEventListener('click',()=>{currentPage=Math.max(0,currentPage-1);render();});$('nextPage').addEventListener('click',()=>{if(layout&&layout.ok)currentPage=Math.min(layout.pages.length-1,currentPage+1);render();});
function download(name,mime,contents){const blob=new Blob([contents],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);toast(`${name} を保存しました`);}
$('csvBtn').addEventListener('click',()=>{if(layout?.ok)download('yohaku-placement.csv','text/csv;charset=utf-8',E.toCSV(layout));});
$('svgBtn').addEventListener('click',()=>{if(!layout?.ok)return;const s=createSVG(layout,layout.pages[currentPage]);download(`yohaku-sheet-${currentPage+1}.svg`,'image/svg+xml;charset=utf-8',new XMLSerializer().serializeToString(s));});
$('saveJson').addEventListener('click',()=>download('yohaku-project.json','application/json;charset=utf-8',JSON.stringify(state,null,2)));
$('loadJson').addEventListener('click',()=>$('jsonFile').click());
$('jsonFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>100000)throw Error('ファイルが大きすぎます。');const raw=JSON.parse(await file.text());if(!raw||!Array.isArray(raw.items)||raw.items.length>E.LIMITS.maxItems||!['A4','letter'].includes(raw.paper))throw Error('設定ファイルの形式が正しくありません。');const restored={...structuredClone(DEFAULT),...raw};const chk=E.plan(restored,restored.items);if(!chk.ok)throw Error(chk.errors[0]);state=restored;currentPage=0;syncControls();renderItems();render();toast('設定を読み込みました');}catch(err){toast(`読込失敗：${err.message}`);}finally{e.target.value='';}});
$('reset').addEventListener('click',()=>{if(!confirm('入力内容をサンプルに戻しますか？'))return;state=structuredClone(DEFAULT);currentPage=0;syncControls();renderItems();render();toast('サンプルに戻しました');});
$('printBtn').addEventListener('click',()=>{if(!layout?.ok)return;const el=$('printArea');el.replaceChildren();for(const page of layout.pages){const container=document.createElement('div');container.className='print-sheet';container.style.width=layout.pageWidth+'mm';container.style.height=layout.pageHeight+'mm';container.appendChild(createSVG(layout,page));el.append(container);}let style=$('dynamicPage');if(!style){style=document.createElement('style');style.id='dynamicPage';document.head.append(style);}style.textContent=`@page{size:${state.paper==='letter'?'letter':'A4'} ${state.landscape?'landscape':'portrait'};margin:0}`;window.print();});
syncControls();renderItems();render();
})();