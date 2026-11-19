(function(){'use strict';
const E=window.HakoEngine,KEY='hakoyoh-v1';
const $=id=>document.getElementById(id);
const defaults=()=>({padding:0.5,reserve:50,items:[
{id:'i1',name:'文庫本セット',w:15,d:11,h:4,qty:2,g:230,upright:false},
{id:'i2',name:'陶器の小皿',w:12,d:12,h:3,qty:1,g:340,upright:true},
{id:'i3',name:'メッセージカード',w:14,d:10,h:1,qty:1,g:25,upright:false}
],boxes:[
{id:'b1',name:'小型箱 S',w:25,d:18,h:12,ow:27,od:20,oh:13,maxG:2000,postage:750,material:65,tare:115},
{id:'b2',name:'中型箱 M',w:30,d:24,h:18,ow:32,od:26,oh:19,maxG:5000,postage:1040,material:110,tare:180},
{id:'b3',name:'大型箱 L',w:37,d:30,h:23,ow:39,od:32,oh:24,maxG:10000,postage:1380,material:165,tare:260}
]});
let state;let chosenId=null;let stage=-1;let current=null;
function safe(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function asYen(n){return '¥'+Number(n).toLocaleString('ja-JP');}
function load(){try{const v=localStorage.getItem(KEY);if(v)return E.validateProject(JSON.parse(v));}catch(e){console.warn('復元不可:',e.message);}return defaults();}
function store(){try{localStorage.setItem(KEY,JSON.stringify(state));$('lastSave').textContent='この端末に保存済み';}catch(e){$('lastSave').textContent='端末保存できません';}}
function textInput(kind,i,key,val,type='number',step='1'){const nums={w:'幅',d:'奥行',h:'高さ',qty:'個数',g:'重量',ow:'外幅',od:'外奥',oh:'外高',maxG:'耐荷重',postage:'送料',material:'箱代',tare:'箱重量'};
 const unit=['w','d','h','ow','od','oh'].includes(key)?'cm':(['g','maxG','tare'].includes(key)?'g':(['postage','material'].includes(key)?'円':''));
 return `<label>${nums[key]||key}${unit?` <span class="unitnote">${unit}</span>`:''}<input type="${type}" data-kind="${kind}" data-index="${i}" data-key="${key}" value="${safe(val)}" min="${['postage','material','tare','g'].includes(key)?0:1}" ${step==='0.1'?'step="0.1"':'step="1"'}></label>`;
}
function renderEditors(){
 $('items').innerHTML=state.items.map((it,i)=>`<article class="editor-row"><div class="rowtop"><span class="rowtag">ITEM ${String(i+1).padStart(2,'0')}</span><input aria-label="商品名${i+1}" data-kind="items" data-index="${i}" data-key="name" value="${safe(it.name)}" maxlength="60"><button type="button" class="delete" data-delete-kind="items" data-delete-index="${i}" aria-label="商品${i+1}を削除">×</button></div><div class="fieldgrid">${['w','d','h','qty','g'].map(k=>textInput('items',i,k,it[k],'number',['w','d','h'].includes(k)?'0.1':'1')).join('')}</div><label class="checkline"><input type="checkbox" data-kind="items" data-index="${i}" data-key="upright" ${it.upright?'checked':''}> 上下を維持する（立てたまま）</label></article>`).join('');
 $('boxes').innerHTML=state.boxes.map((b,i)=>`<article class="editor-row"><div class="rowtop"><span class="rowtag">BOX ${String(i+1).padStart(2,'0')}</span><input aria-label="箱名${i+1}" data-kind="boxes" data-index="${i}" data-key="name" value="${safe(b.name)}" maxlength="60"><button type="button" class="delete" data-delete-kind="boxes" data-delete-index="${i}" aria-label="箱${i+1}を削除">×</button></div><div class="rowcaption">内寸（実際に物が入る寸法）</div><div class="fieldgrid boxgrid">${['w','d','h','maxG','tare'].map(k=>textInput('boxes',i,k,b[k],'number',['w','d','h'].includes(k)?'0.1':'1')).join('')}</div><div class="boxsecondary"><div class="rowcaption">外寸と料金（送料・箱代は入力値）</div><div class="fieldgrid boxgrid">${['ow','od','oh','postage','material'].map(k=>textInput('boxes',i,k,b[k],'number',['ow','od','oh'].includes(k)?'0.1':'1')).join('')}</div></div></article>`).join('');
 $('padding').value=state.padding;$('reserve').value=state.reserve;
}
function renderReport(){
 try{current=E.inspect(state);$('error').hidden=true;store();}
 catch(e){$('error').textContent=e.message;$('error').hidden=false;$('stats').innerHTML='';$('candidates').innerHTML='';$('diagram').innerHTML='<div class="empty">入力値を確認してください。</div>';$('manifest').innerHTML='';$('chosenName').textContent='―';$('progress').max=0;$('progress').value=0;['downloadCsv','downloadSvg','print'].forEach(id=>$(id).disabled=true);return;}
 const {results,count,grossProduct,recommendation}=current;
 $('stats').innerHTML=`<div class="stat"><span>梱包する商品</span><strong>${count}<small>点</small></strong><span>${state.items.length}種類</span></div><div class="stat"><span>商品重量の合計</span><strong>${(grossProduct/1000).toFixed(2)}<small>kg</small></strong><span>箱・予備重量は別</span></div><div class="stat"><span>配置できた箱</span><strong>${results.filter(r=>r.valid).length}<small> / ${results.length}</small></strong><span>簡易探索の結果</span></div>`;
 if(!results.some(r=>r.id===chosenId)){chosenId=(recommendation||results[0]).id;stage=-1;}
 $('candidates').innerHTML=results.map((b,i)=>{
  const reason=b.valid?`配置OK · ${b.fillPercent}%充填 · ${b.tier}サイズ相当 · ${(b.weight/1000).toFixed(2)}kg`:(b.reasons.join(' / ')||'要確認');
  return `<button class="candidate ${b.id===chosenId?'selected':''}" type="button" data-select="${safe(b.id)}" aria-pressed="${b.id===chosenId}"><span class="mark">${b.valid?'✓':'!'}</span><span><span class="candtitle">${safe(b.name)} ${b.valid&&b===recommendation?'<span class="good">· 推奨</span>':''}</span><span class="candmeta ${b.valid?'':'bad'}">${safe(reason)}<br>内寸 ${b.w} × ${b.d} × ${b.h}cm / 外寸合計 ${(b.ow+b.od+b.oh).toFixed(1)}cm</span></span><span class="candprice">${asYen(b.cost)}<small>入力送料＋箱代</small></span></button>`;
 }).join('');
 renderDiagram();
}
function renderDiagram(){const b=current?.results.find(x=>x.id===chosenId);if(!b){return;}
 const n=b.packed.placed.length;if(stage<0)stage=n;stage=Math.min(Math.max(stage,0),n);
 $('diagram').innerHTML=E.layoutSvg(b,b.packed.placed,stage);
 $('progress').max=n;$('progress').value=stage;$('stepCount').textContent=`${stage} / ${n}`;
 $('chosenName').textContent=b.name + (b.valid?' · 配置OK':' · 要確認');
 const shown=b.packed.placed.slice(0,stage);
 $('manifest').innerHTML=shown.length?shown.map((p,i)=>`<div class="manifestrow"><strong>${i+1}. ${safe(p.name)} #${p.unit}</strong><span>位置 x${p.x} · y${p.y} · z${p.z} / ${p.w}×${p.d}×${p.h}cm</span></div>`).join(''):'<div class="manifestrow"><span>スライダーを動かすと配置手順が表示されます。</span></div>';
 ['downloadCsv','downloadSvg','print'].forEach(id=>$(id).disabled=!n);
}
function download(name,text,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function add(kind){if((kind==='items'&&state.items.length>=20)||(kind==='boxes'&&state.boxes.length>=12)){alert('登録件数の上限です。');return;}
 const uid=kind.slice(0,1)+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
 if(kind==='items')state.items.push({id:uid,name:'新しい商品',w:10,d:10,h:5,qty:1,g:100,upright:false});
 else state.boxes.push({id:uid,name:'追加の箱',w:25,d:20,h:15,ow:27,od:22,oh:17,maxG:2000,postage:800,material:70,tare:100});
 renderEditors();renderReport();
}
function installEditor(kind){$(kind).addEventListener('change',e=>{const t=e.target,k=t.dataset.key,i=Number(t.dataset.index);if(!k||!Number.isInteger(i)||!state[kind][i])return;
 state[kind][i][k]=k==='upright'?t.checked: (k==='name'?t.value:Number(t.value));renderEditors();renderReport();});
 $(kind).addEventListener('click',e=>{const btn=e.target.closest('[data-delete-kind]');if(!btn)return;const row=btn.dataset.deleteKind,i=Number(btn.dataset.deleteIndex);if(state[row].length<=1){alert('最低1行は必要です。');return;}state[row].splice(i,1);renderEditors();renderReport();});
}
$('addItem').addEventListener('click',()=>add('items'));
$('addBox').addEventListener('click',()=>add('boxes'));
installEditor('items');installEditor('boxes');
for(const k of ['padding','reserve'])$(k).addEventListener('change',e=>{state[k]=Number(e.target.value);renderEditors();renderReport();});
$('candidates').addEventListener('click',e=>{const btn=e.target.closest('[data-select]');if(!btn)return;chosenId=btn.dataset.select;stage=-1;renderReport();});
$('progress').addEventListener('input',e=>{stage=Number(e.target.value);renderDiagram();});
$('prevStep').addEventListener('click',()=>{stage=Math.max(0,stage-1);renderDiagram();});
$('nextStep').addEventListener('click',()=>{stage=Math.min(Number($('progress').max),stage+1);renderDiagram();});
$('downloadCsv').addEventListener('click',()=>{const b=current.results.find(x=>x.id===chosenId);download('hakoyoh-packing.csv',E.makeCSV(b),'text/csv;charset=utf-8');});
$('downloadSvg').addEventListener('click',()=>{const b=current.results.find(x=>x.id===chosenId);download('hakoyoh-layout.svg',E.layoutSvg(b,b.packed.placed,b.packed.placed.length),'image/svg+xml;charset=utf-8');});
$('exportJson').addEventListener('click',()=>{try{E.validateProject(state);download('hakoyoh-project.json',JSON.stringify({version:1,...state},null,2),'application/json;charset=utf-8');}catch(e){alert('入力値を修正してください: '+e.message);}});
$('importJson').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;
 try{if(file.size>1000000)throw new Error('1MB以下のJSONにしてください。');const raw=JSON.parse(await file.text());const loaded=E.validateProject(raw);state=loaded;chosenId=null;stage=-1;renderEditors();renderReport();}
 catch(error){alert('読み込み失敗: '+error.message);}
});
$('reset').addEventListener('click',()=>{if(!confirm('編集内容と端末内の保存を消し、デモ設定に戻しますか？'))return;try{localStorage.removeItem(KEY);}catch(e){}state=defaults();chosenId=null;stage=-1;renderEditors();renderReport();});
$('print').addEventListener('click',()=>window.print());
state=load();renderEditors();renderReport();
})();