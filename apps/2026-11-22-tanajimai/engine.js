/* TANAJIMAI engine — no dependencies. Pure, browser/Node compatible. */
(function(root,factory){ const api=factory(); if(typeof module==='object'&&module.exports)module.exports=api; root.TanajimaiEngine=api; })(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MAX_ROWS=120;
const FIELDS=['received','sold','returned','damaged','onHand'];
function asInt(v,max){ const n=Number(v); return typeof v!=='boolean' && v!==null && v!==undefined && !(typeof v==='string' && !v.trim()) && Number.isSafeInteger(n) && n>=0 && n<=max ? n : null; }
function normalizeItem(row){
  const x=row&&typeof row==='object'&&!Array.isArray(row)?row:{};
  return {id:String(x.id||'').slice(0,80), consignor:String(x.consignor||'').trim().slice(0,60), title:String(x.title||'').trim().slice(0,100), sku:String(x.sku||'').trim().slice(0,40), price:x.price, rate:x.rate, received:x.received, sold:x.sold, returned:x.returned, damaged:x.damaged, onHand:x.onHand};
}
function inspect(row){
 const r=normalizeItem(row);const errors=[];
 if(!r.consignor) errors.push('委託元の呼称が空欄');
 if(!r.title) errors.push('商品名が空欄');
 const price=asInt(r.price,10000000),rate=asInt(r.rate,100);
 if(price===null) errors.push('単価は0〜10,000,000円の整数');
 if(rate===null) errors.push('手数料率は0〜100の整数');
 const n={};for(const k of FIELDS){n[k]=asInt(r[k],100000);if(n[k]===null)errors.push(`${k} は0〜100,000の整数`);}
 const valid=!errors.length;
 const diff=valid?n.received-n.sold-n.returned-n.damaged-n.onHand:null;
 const gross=valid?price*n.sold:null;
 const fee=valid?Math.floor(gross*rate/100):null;
 return {...r,...n,price,rate,valid,errors,diff,expected:valid?n.received-n.sold-n.damaged:null,gross,fee,share:valid?gross-fee:null,status:!valid?'invalid':diff===0?'ok':diff>0?'shortage':'overage'};
}
function analyze(rows){
 const items=(Array.isArray(rows)?rows:[]).slice(0,MAX_ROWS).map(inspect);
 const map=new Map();let gross=0,fee=0,share=0,problems=0,unexplained=0,complete=0;
 for(const item of items){
   if(item.status!=='ok')problems++;else complete++;
   if(item.valid){gross+=item.gross;fee+=item.fee;share+=item.share;unexplained+=item.diff;}
   const key=item.consignor||'（未入力）';
   if(!map.has(key))map.set(key,{consignor:key,items:0,gross:0,fee:0,share:0,issues:0,issueNames:[],status:'ready'});
   const a=map.get(key);a.items++;
   if(item.valid){a.gross+=item.gross;a.fee+=item.fee;a.share+=item.share;}
   if(item.status!=='ok'){a.issues++;a.status='hold';a.issueNames.push(item.title||'（商品名未入力）');}
 }
 const consignors=[...map.values()].sort((a,b)=>a.consignor.localeCompare(b.consignor,'ja'));
 return {items,consignors,totals:{rows:items.length,complete,problems,gross,fee,share,unexplained,ready:consignors.filter(c=>c.status==='ready').length,held:consignors.filter(c=>c.status==='hold').length}};
}
function inferredSold(row){
 const x=inspect(row); if(!x.valid)return null;
 const possible=x.received-x.returned-x.damaged-x.onHand;
 return possible>=0&&possible<=x.received? possible : null;
}
function escapeCsv(x){const str=String(x??'');return /[",\r\n]/.test(str)?'"'+str.replaceAll('"','""')+'"':str;}
function makeCsv(result){
 const h=['委託元','商品','SKU','単価円','手数料率%','納品','販売','返却','破損','保管','数量差','状態','売上円','手数料円','委託元受取予定円'];
 const lines=[h,...result.items.map(i=>[i.consignor,i.title,i.sku,i.price??'',i.rate??'',i.received??'',i.sold??'',i.returned??'',i.damaged??'',i.onHand??'',i.diff??'',i.status,i.gross??'',i.fee??'',i.share??''])];
 return '\uFEFF'+lines.map(r=>r.map(escapeCsv).join(',')).join('\r\n')+'\r\n';
}
function makeStatementsCsv(result){const lines=[['委託元','商品数','売上円','手数料円','委託元受取予定円','状態','未照合商品']];for(const c of result.consignors){lines.push([c.consignor,c.items,c.gross,c.fee,c.share,c.status==='hold'?'要照合（支払保留）':'照合済（支払候補）',c.issueNames.join(' / ')])}return '\uFEFF'+lines.map(r=>r.map(escapeCsv).join(',')).join('\r\n')+'\r\n';}
function validateImport(obj){
 if(!obj||typeof obj!=='object'||Array.isArray(obj)||obj.format!=='tanajimai-v1'||!Array.isArray(obj.items))throw Error('対応していないバックアップ形式です');
 if(obj.items.length>MAX_ROWS)throw Error(`登録上限は${MAX_ROWS}商品です`);
 const items=obj.items.map((x,i)=>{const item=normalizeItem(x);item.id=item.id||`import-${i}`;return item;});
 if(items.some(i=>!i.consignor||!i.title))throw Error('委託元・商品名が空欄の行を含みます');
 if(items.some(i=>!inspect(i).valid))throw Error('数値の範囲外・不正なデータを含みます');
 return {title:String(obj.title||'棚じまい台帳').slice(0,80),items};
}
return {MAX_ROWS,normalizeItem,inspect,analyze,inferredSold,makeCsv,makeStatementsCsv,validateImport};
});
