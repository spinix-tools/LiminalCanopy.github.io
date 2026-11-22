/* TANAJIMAI browser app. All data remains in this browser unless explicitly exported. */
(function(){
'use strict';
const E=window.TanajimaiEngine;
const KEY='tanajimai:v1';
const DEMO={title:'秋の小さなZINE市（サンプル）',items:[
{id:'demo-1',consignor:'灯台文庫',title:'海辺のZINE',sku:'Z-001',price:850,rate:20,received:15,sold:9,returned:5,damaged:0,onHand:1},
{id:'demo-2',consignor:'灯台文庫',title:'栞セット',sku:'B-002',price:350,rate:20,received:20,sold:12,returned:7,damaged:0,onHand:0},
{id:'demo-3',consignor:'青い窓',title:'ポストカード（5枚）',sku:'C-010',price:700,rate:15,received:12,sold:6,returned:6,damaged:0,onHand:0},
{id:'demo-4',consignor:'青い窓',title:'小冊子「音の地図」',sku:'Z-019',price:1200,rate:15,received:8,sold:4,returned:3,damaged:1,onHand:0},
{id:'demo-5',consignor:'庭の標本室',title:'植物図版カード',sku:'P-031',price:500,rate:25,received:16,sold:10,returned:5,damaged:0,onHand:1},
{id:'demo-6',consignor:'庭の標本室',title:'ミニポスター',sku:'P-032',price:900,rate:25,received:10,sold:3,returned:5,damaged:0,onHand:2}
]};
const $=id=>document.getElementById(id);
const yen=n=>'¥'+Math.round(n).toLocaleString('ja-JP');
const clone=o=>JSON.parse(JSON.stringify(o));
let state=clone(DEMO), counter=0;
function notify(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>t.classList.remove('show'),3400);}
function persist(){try{localStorage.setItem(KEY,JSON.stringify({format:'tanajimai-v1',title:state.title,items:state.items}));return true;}catch{return false;}}
function restore(){try{const raw=localStorage.getItem(KEY);if(raw){state=E.validateImport(JSON.parse(raw));return true;}}catch(e){notify('保存データを読み込めませんでした。サンプルで起動しました。');}return false;}
function dom(tag,cls,txt){const el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=String(txt);return el;}
function inp(value,field,index,klass,type){const el=dom('input',klass||'');el.value=value??'';el.dataset.field=field;el.dataset.index=index;el.setAttribute('aria-label',`商品${index+1} ${field}`);if(type==='number'){el.type='number';el.step='1';el.min='0';el.max=field==='rate'?'100':field==='price'?'10000000':'100000';el.inputMode='numeric';}else {el.maxLength=field==='consignor'?60:field==='title'?100:40;}return el;}
function fieldCell(tr,node){const td=dom('td');td.append(node);tr.append(td);return td;}
function renderRows(result){const body=$('itemsBody');body.replaceChildren();
 result.items.forEach((r,index)=>{
   const tr=dom('tr',r.status==='invalid'?'invalid-row':r.status==='ok'?'':'warning-row');tr.dataset.itemid=r.id;
   const meta=dom('div','item-meta');meta.append(inp(state.items[index].consignor,'consignor',index,'owner-input','text'),inp(state.items[index].title,'title',index,'title-input','text'),inp(state.items[index].sku,'sku',index,'sku-input','text'));fieldCell(tr,meta);
   for(const fld of ['price','rate','received','sold','returned','damaged','onHand'])fieldCell(tr,inp(state.items[index][fld],fld,index,'cell-num'+(fld==='price'?' wide':''),'number'));
   const tag=dom('div','status-cell '+r.status);
   if(r.status==='invalid'){tag.textContent='入力確認';tag.title=r.errors.join(' / ');}else if(r.diff===0){tag.textContent='✓ 一致';tag.title='数量差0';}else{tag.textContent=(r.diff>0?'+':'')+r.diff+' 個';tag.title=r.diff>0?'未配分の在庫があり不足が疑われます':'入力合計が納品数を超えています';}
   fieldCell(tr,tag);
   const actions=dom('div','row-buttons');const suggest=dom('button','mini-btn','販売数を逆算');suggest.dataset.action='suggest';suggest.dataset.index=index;suggest.title='現物の残数から販売数の候補を表示し、確認後に反映します';
   const del=dom('button','mini-btn danger','削除');del.dataset.action='remove';del.dataset.index=index;actions.append(suggest,del);fieldCell(tr,actions);
   body.append(tr);
 });$('empty').hidden=result.items.length!==0;$('countLimit').textContent=`${result.items.length} / ${E.MAX_ROWS} 品目`;
}
function vendorCard(c){
 const box=dom('article','vendor-card');const top=dom('div','vendor-top'),names=dom('div');names.append(dom('h3','',c.consignor),dom('small','',c.items+'品目の照合'));const tag=dom('span','status-pill '+(c.status==='ready'?'ok':'hold'),c.status==='ready'?'✓ 照合済':'! 要照合・保留');top.append(names,tag);box.append(top);
 const money=dom('div');money.append(dom('div','money',yen(c.share)),dom('small','','委託元受取予定（参考）'));box.append(money);
 const d=dom('div','vendor-details');d.append(dom('span','',`売上 ${yen(c.gross)}`),dom('span','',`手数料 ${yen(c.fee)}`));box.append(d);
 if(c.issues)box.append(dom('div','vendor-problem',`${c.issues}品目を要照合：${c.issueNames.join('、')}。数量が一致するまで精算しないでください。`));
 return box;
}
function render(){
 const result=E.analyze(state.items);
 $('eventTitle').value=state.title;
 $('mItems').textContent=String(result.totals.rows);$('mProblems').textContent=String(result.totals.problems);$('mSales').textContent=yen(result.totals.gross);$('mPayout').textContent=yen(result.totals.share);
 renderRows(result);const area=$('consignors');area.replaceChildren(...result.consignors.map(vendorCard));if(!result.consignors.length)area.append(dom('p','', '商品を登録すると委託元の精算候補を表示します。'));
}
function updated(){persist();render();}
function newItem(){return {id:'item-'+Date.now()+'-'+(++counter),consignor:'新しい委託元',title:'新しい商品',sku:'',price:500,rate:20,received:1,sold:0,returned:0,damaged:0,onHand:1};}
function download(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=dom('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function downloadJson(){download('tanajimai-backup.json',JSON.stringify({format:'tanajimai-v1',title:state.title,items:state.items},null,2),'application/json;charset=utf-8');notify('台帳のJSONを保存しました。');}
$('itemsBody').addEventListener('change',ev=>{const el=ev.target;if(!el.matches('input[data-field]'))return;const idx=Number(el.dataset.index),key=el.dataset.field;if(!state.items[idx])return;state.items[idx][key]=el.value;updated();});
$('itemsBody').addEventListener('click',ev=>{const btn=ev.target.closest('button[data-action]');if(!btn)return;const index=Number(btn.dataset.index),row=state.items[index];if(!row)return;
 if(btn.dataset.action==='remove'){if(confirm(`「${row.title}」を台帳から削除しますか？`)){state.items.splice(index,1);updated();notify('商品を削除しました');}}
 if(btn.dataset.action==='suggest'){const n=E.inferredSold(row);if(n===null){notify('入力値を確認してください。逆算できません。');return;}const msg=`「${row.title}」の販売候補は ${n} 個です。\n（納品 − 返却 − 破損 − 保管）\n現在の販売記録 ${row.sold} 個を ${n} 個に変更しますか？\n\n※レシートと照合してから確定してください。`;if(confirm(msg)){row.sold=n;updated();notify('販売数の候補を適用しました。実売上の確認が必要です。');}}
 });
function add(){if(state.items.length>=E.MAX_ROWS){notify('登録上限120品目です');return;}state.items.push(newItem());updated();$('itemsTable').scrollIntoView({behavior:'smooth',block:'center'});notify('商品を追加しました');}
$('addBtn').addEventListener('click',add);$('emptyAdd').addEventListener('click',add);
$('eventTitle').addEventListener('change',e=>{state.title=String(e.target.value).slice(0,80);persist();});
$('demoBtn').addEventListener('click',()=>{if(confirm('現在の台帳をデモ内容に置き換えますか？ 必要なら先にJSON保存してください。')){state=clone(DEMO);updated();notify('デモに戻しました');}});
$('newBtn').addEventListener('click',()=>{if(confirm('空の台帳に切り替えますか？ 現在の内容は上書きされます。')){state={title:'新しい委託販売台帳',items:[]};updated();notify('空の台帳を作成しました');}});
$('csvBtn').addEventListener('click',()=>{download('tanajimai-items.csv',E.makeCsv(E.analyze(state.items)),'text/csv;charset=utf-8');notify('商品明細CSVを保存しました');});
$('statementBtn').addEventListener('click',()=>{download('tanajimai-settlements.csv',E.makeStatementsCsv(E.analyze(state.items)),'text/csv;charset=utf-8');notify('精算候補CSVを保存しました');});
$('jsonBtn').addEventListener('click',downloadJson);
$('printBtn').addEventListener('click',()=>window.print());
$('importInput').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>2000000)throw Error('2MB以下のJSONを指定してください');const parsed=E.validateImport(JSON.parse(await f.text()));if(!confirm(`${parsed.items.length}品目の台帳を読み込み、現在のデータを置き換えますか？`))return;state=parsed;updated();notify('JSONを読み込みました');}catch(err){notify('読込失敗: '+err.message);}finally{e.target.value='';}});
restore();render();
})();
