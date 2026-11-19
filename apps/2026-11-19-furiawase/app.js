/* ふりあわせ — browser UI, offline only; never uses fetch or persistent storage. */
(function(){'use strict';
const E=window.FuriEngine;
const S={docs:{payouts:null,banks:null},map:{payouts:null,banks:null},files:{payouts:null,banks:null},manual:{},result:null,payouts:[],banks:[],errors:[]};
const $=(id)=>document.getElementById(id);
const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(n)=> n===null||n===undefined?'—':new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(n);
const LAB={id:'精算ID',date:'精算日',gross:'売上総額',fee:'手数料',refund:'返金',adjustment:'調整額',net:'振込予定額',amount:'入金額',memo:'摘要'};
const STATUS={auto:'自動一致',manual:'手動確認済',ambiguous:'候補の重複',mismatch:'精算の計算不一致',missing:'対応入金なし'};
function msg(text,type='ok'){const n=$('notice');n.textContent=text;n.className='notice '+type;}
function mappingUI(kind){
  const host=$(kind==='payouts'?'p-map':'b-map');host.innerHTML='';
  const doc=S.docs[kind];if(!doc)return;
  const fields=Object.keys(E.ALIASES[kind]);
  for(const k of fields){
    const label=document.createElement('label');label.textContent=LAB[k]+((k==='date'||(kind==='banks'&&k==='amount'))?' *':'');
    const sel=document.createElement('select');sel.dataset.kind=kind;sel.dataset.field=k;
    sel.innerHTML='<option value="-1">未指定</option>'+doc.headers.map((x,i)=>`<option value="${i}">${esc(x)}</option>`).join('');
    sel.value=String(S.map[kind][k]);label.append(sel);host.append(label);
  }
}
function loadText(kind,text,name){
  try{
    S.docs[kind]=E.csvParse(text);S.map[kind]=E.guessMap(S.docs[kind].headers,kind);S.manual={};
    const lines=S.docs[kind].rows.length;
    $(kind==='payouts'?'p-info':'b-info').textContent=`${name} ／ ${lines}行・${S.docs[kind].headers.length}列`;
    mappingUI(kind);
    render();
  }catch(err){
    S.docs[kind]=null;S.map[kind]=null;mappingUI(kind);
    $(kind==='payouts'?'p-info':'b-info').textContent='読み込み失敗';render();msg(`${name}: ${err.message}`,'error');
  }
}
async function loadFile(kind,file){
  if(!file)return;
  if(file.size>2*1024*1024){msg('CSVは2MB以内にしてください','error');return;}
  try{
    const data=await file.arrayBuffer(); S.files[kind]={data,name:file.name};
    const text=new TextDecoder($('encoding').value,{fatal:true}).decode(data);
    loadText(kind,text,file.name);
  }catch(e){msg('CSVの文字コードを確認してください: '+e.message,'error');}
}
function rerenderDecoded(){for(const kind of ['payouts','banks'])if(S.files[kind]){
  try{loadText(kind,new TextDecoder($('encoding').value,{fatal:true}).decode(S.files[kind].data),S.files[kind].name)}
  catch(e){msg('文字コードの変換に失敗しました: '+e.message,'error');}
}}
function render(){
  const p=E.convert(S.docs.payouts,S.map.payouts||{},'payouts');
  const b=E.convert(S.docs.banks,S.map.banks||{},'banks');
  S.payouts=p.items;S.banks=b.items;S.errors=[...p.errors.map(x=>'精算: '+x),...b.errors.map(x=>'銀行: '+x)];
  if(!S.docs.payouts||!S.docs.banks){
    S.result=null;['m-auto','m-manual','m-review','m-bank'].forEach(id=>$(id).textContent='—');$('download').disabled=true;
    $('results').innerHTML='<div class="empty">左右のCSVを読み込むと、ここに照合結果が並びます。</div>';
    $('unmatched').textContent='—';return;
  }
  S.result=E.reconcile(S.payouts,S.banks,{lag:$('lag').value,tolerance:$('tolerance').value,manual:S.manual});
  const {stats}=S.result;
  $('m-auto').textContent=stats.auto;$('m-manual').textContent=stats.manual;
  $('m-review').textContent=stats.ambiguous+stats.missing+stats.mismatch;
  $('m-bank').textContent=stats.unmatchedBank;
  $('download').disabled=false;
  const errorNote=S.errors.length?` / 不正行: ${S.errors.length}件（照合から除外） ${S.errors.slice(0,2).join('、')}`:'';
  msg(`精算 ${stats.totalPayout}件・銀行 ${stats.totalBank}件を照合しました。自動一致 ${stats.auto}件、要確認 ${stats.ambiguous+stats.missing+stats.mismatch}件。${errorNote}`,S.errors.length?'error':'ok');
  renderRows();renderUnmatched();
}
function renderRows(){
  if(!S.result)return;
  const filter=$('filter').value;const query=$('search').value.trim().toLowerCase();
  let rows=S.result.rows.filter(r=>(filter==='all'||(filter==='review'&& !['auto','manual'].includes(r.status))||r.status===filter) && (`${r.id} ${r.date} ${r.net} ${r.gross??''}`.toLowerCase().includes(query)));
  const host=$('results');
  if(!rows.length){host.innerHTML='<div class="empty">条件に一致する精算明細はありません。</div>';return;}
  const capped=rows.length>500;rows=rows.slice(0,500);
  host.innerHTML=rows.map(r=>{
    const matched=r.bankIndex!==null;const bank=matched?S.banks[r.bankIndex]:null;
    const status=(STATUS[r.status]||'未判定')+(r.mismatch && r.status==='manual'?'（計算差あり）':'');
    let reason='';
    if(r.status==='mismatch')reason=`計算 ${money(r.calc)} / CSV記載 ${money(r.reported)}。自動一致を停止`;
    else if(r.status==='ambiguous')reason=`候補 ${r.candidates.length}件。どの入金か確認してください`;
    else if(r.status==='missing')reason=r.near?.length?`近い金額: ${money(S.banks[r.near[0].j].amount)}（差額 ${money(r.near[0].gap)}）`:'指定した期間・金額に一致する入金なし';
    else if(r.status==='manual')reason=`手動で選択 / 差額 ${money(r.gap)}`+(r.mismatch?` / 精算計算差 ${money(r.reported-r.calc)}`:'');
    else reason=`入金日 ${bank.date} / 差額 ${money(r.gap)}`;
    const choices=S.banks.map((b,i)=>({b,i})).filter(x=>!S.result.taken.has(x.i)||x.i===r.bankIndex);
    const opts=choices.map(({b,i})=>`<option value="${i}" ${i===r.bankIndex?'selected':''}>${esc(b.date)} · ${money(b.amount)} · ${esc(b.memo.slice(0,20))}</option>`).join('');
    return `<article class="entry ${matched?'matched':'review'}" data-p="${r.index}">
      <div><span class="tiny">SETTLEMENT ID</span><strong>${esc(r.id)}</strong><span class="date">${esc(r.date)} / 精算日</span></div>
      <div><span class="tiny">EXPECTED PAYOUT</span><span class="net">${money(r.net)}</span><span class="date">売上 ${money(r.gross)} / 手数料 ${money(r.fee)}</span></div>
      <div><span class="badge-status ${matched?'':'bad'}">${esc(status)}</span><div class="reason">${esc(reason)}</div></div>
      <div><span class="tiny">BANK SIDE</span><strong>${bank?money(bank.amount):'未確定'}</strong><span class="date">${bank?esc(bank.date+' / '+bank.memo):' — '}</span></div>
      <div class="manual-tools"><span class="tiny">人の目で確認</span><select aria-label="${esc(r.id)} の銀行入金" data-select="${r.index}"><option value="">銀行入金を選ぶ…</option>${opts}</select><button data-assign="${r.index}">この入金に結び付ける</button>${r.status==='manual'?`<button class="clear" data-clear="${r.index}">解除</button>`:''}</div>
    </article>`;
  }).join('')+(capped?'<div class="empty">先頭500件を表示中。CSV出力には全件が含まれます。</div>':'');
}
function renderUnmatched(){
  const host=$('unmatched');if(!S.result){host.textContent='—';return;}
  if(!S.result.unmatched.length){host.innerHTML='<div class="empty">未対応の銀行明細はありません。</div>';return;}
  host.innerHTML=S.result.unmatched.slice(0,200).map(b=>`<div class="bankrow"><span>${esc(b.date)}</span><b>${money(b.amount)}</b><em>${esc(b.memo)}</em></div>`).join('')+(S.result.unmatched.length>200?'<p>残りはCSVで確認してください。</p>':'');
}
function download(name,text,type='text/csv;charset=utf-8'){const blob=new Blob([type.includes('csv')?'\uFEFF':'',text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportResults(){if(!S.result)return;
 const head=['区分','精算ID','精算日','売上','手数料','返金','調整','計算額','CSV記載額','照合判定','銀行入金日','銀行額','銀行摘要','差額','メモ'];
 const rows=S.result.rows.map(r=>{const b=r.bankIndex!==null?S.banks[r.bankIndex]:null;
 return ['精算',r.id,r.date,r.gross,r.fee,r.refund,r.adjustment,r.calc,r.reported,STATUS[r.status],b?.date,b?.amount,b?.memo,r.gap,r.mismatch?'計算額と記載額が不一致':r.status==='ambiguous'?'候補が複数':r.status==='missing'?'対応未確定':''];});
 for(const b of S.result.unmatched)rows.push(['銀行未対応','','','','','','','','','銀行明細未対応',b.date,b.amount,b.memo,'','']);
 download('furiawase-review.csv',E.csvEncode([head,...rows]));
}
function reset(){S.docs={payouts:null,banks:null};S.map={payouts:null,banks:null};S.files={payouts:null,banks:null};S.manual={};S.errors=[];for(const k of ['p','b']){$(k+'-file').value='';$(k+'-info').textContent='未読込';}mappingUI('payouts');mappingUI('banks');render();msg('明細を破棄しました。サンプルまたはCSVを読み込んでください。');}
$('demo').addEventListener('click',()=>{S.files={payouts:null,banks:null};loadText('payouts',E.samplePayouts,'サンプル精算.csv');loadText('banks',E.sampleBanks,'サンプル銀行.csv');$('result-title').scrollIntoView({behavior:'smooth',block:'start'});});
$('reset').addEventListener('click',reset);
$('p-file').addEventListener('change',e=>loadFile('payouts',e.target.files[0]));
$('b-file').addEventListener('change',e=>loadFile('banks',e.target.files[0]));
$('encoding').addEventListener('change',rerenderDecoded);
for(const id of ['lag','tolerance'])$(id).addEventListener('input',render);
for(const id of ['filter','search'])$(id).addEventListener('input',renderRows);
for(const kind of ['p','b'])$(kind+'-map').addEventListener('change',e=>{if(e.target.matches('select[data-field]')){S.map[e.target.dataset.kind][e.target.dataset.field]=Number(e.target.value);S.manual={};render();}});
$('results').addEventListener('click',e=>{
 const a=e.target.closest('[data-assign]');const c=e.target.closest('[data-clear]');
 if(a){const index=Number(a.dataset.assign);const sel=$('results').querySelector(`select[data-select="${index}"]`);if(!sel||sel.value===''){msg('銀行明細を選択してください。','error');return;}S.manual[index]=Number(sel.value);render();}
 if(c){delete S.manual[Number(c.dataset.clear)];render();}
});
$('download').addEventListener('click',exportResults);$('print').addEventListener('click',()=>window.print());
$('templateP').addEventListener('click',()=>download('template-settlement.csv',E.samplePayouts));
$('templateB').addEventListener('click',()=>download('template-bank.csv',E.sampleBanks));
render();
})();