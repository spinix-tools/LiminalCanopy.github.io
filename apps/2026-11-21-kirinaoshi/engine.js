/* KIRINAOSHI engine: pure, browser + Node. Exact integer millimetres. MIT. */
(function(root, factory){ const api=factory(); if(typeof module==='object'&&module.exports)module.exports=api; else root.Kirinaoshi=api; })(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MAX_STOCK=80, MAX_PART=80, MAX_PIECES=250;
const demo=()=>({version:1,title:'小さな棚づくり',kerf:3,reuseMin:150,
 stocks:[{id:'s1',label:'SPF 2×4 / A',length:1820,kind:'new'},{id:'s2',label:'SPF 2×4 / B',length:1820,kind:'new'},{id:'s3',label:'端材 930',length:930,kind:'offcut'}],
 parts:[{id:'p1',label:'棚柱',length:810,qty:2,done:0},{id:'p2',label:'横桟',length:440,qty:3,done:0},{id:'p3',label:'補強',length:295,qty:2,done:0}],history:[],log:[]});
const int=(v,min,max)=>Number.isSafeInteger(Number(v))&&Number(v)>=min&&Number(v)<=max;
function validate(s){
 if(!s||typeof s!=='object'||!Array.isArray(s.stocks)||!Array.isArray(s.parts))throw Error('データ形式が不正です');
 if(s.stocks.length>MAX_STOCK||s.parts.length>MAX_PART)throw Error('材料または部材の登録数が上限です');
 if(!int(s.kerf,0,50)||!int(s.reuseMin,0,20000))throw Error('刃厚または再利用長が不正です');
 let total=0,ids=new Set();
 for(const a of s.stocks){if(!a||typeof a.id!=='string'||ids.has(a.id)||typeof a.label!=='string'||a.label.length>80||!int(a.length,0,20000)||!['new','offcut'].includes(a.kind))throw Error('材料データが不正です');ids.add(a.id)}
 for(const a of s.parts){if(!a||typeof a.id!=='string'||ids.has(a.id)||typeof a.label!=='string'||a.label.length>80||!int(a.length,1,20000)||!int(a.qty,1,100)||!int(a.done,0,a.qty))throw Error('部材データが不正です');ids.add(a.id);total+=a.qty}
 if(total>MAX_PIECES)throw Error('必要部材数は250個以下にしてください');return true;
}
const copy=x=>JSON.parse(JSON.stringify(x));
function remaining(s){return s.parts.flatMap(p=>Array.from({length:p.qty-p.done},(_,i)=>({id:p.id,label:p.label,length:p.length,index:i})));}
function pack(s,mode){
 const pieces=remaining(s);let items=pieces.slice();
 if(mode===0)items.sort((a,b)=>b.length-a.length||a.id.localeCompare(b.id));
 else if(mode===1)items.sort((a,b)=>a.length-b.length||a.id.localeCompare(b.id));
 else items.sort((a,b)=>b.length-a.length||a.id.localeCompare(b.id));
 let boards=s.stocks.map((t,i)=>({...t,initial:t.length,remaining:t.length,cuts:[],order:i}));let missing=[];
 for(const p of items){let eligible=boards.filter(b=>b.remaining>=p.length+s.kerf);
 if(!eligible.length){missing.push(p);continue;}
 eligible.sort((a,b)=>{
  if(mode===1){const aa=a.kind==='offcut'?0:1, bb=b.kind==='offcut'?0:1;if(aa!==bb)return aa-bb;}
  if(mode===2){const aa=a.cuts.length?0:1, bb=b.cuts.length?0:1;if(aa!==bb)return aa-bb;}
  const wa=a.remaining-(p.length+s.kerf),wb=b.remaining-(p.length+s.kerf);
  return wa-wb||(a.kind==='offcut'?0:1)-(b.kind==='offcut'?0:1)||a.order-b.order;
 });
 const b=eligible[0]; b.cuts.push({...p});b.remaining-=p.length+s.kerf;
 }
 boards=boards.filter(b=>b.cuts.length>0);
 const newUsed=boards.filter(b=>b.kind==='new').length;
 const scrap=boards.reduce((a,b)=>a+(b.remaining<s.reuseMin?b.remaining:0),0);
 const stored=boards.reduce((a,b)=>a+(b.remaining>=s.reuseMin?b.remaining:0),0);
 const kerfLoss=boards.reduce((a,b)=>a+b.cuts.length*s.kerf,0);
 const score=[missing.length,newUsed,scrap,-stored];
 return {boards,missing,newUsed,scrap,stored,kerfLoss,score,totalParts:pieces.length,planned:pieces.length-missing.length};
}
function plan(s){validate(s);let candidates=[0,1,2].map(m=>pack(s,m));candidates.sort((a,b)=>{for(let i=0;i<a.score.length;i++){if(a.score[i]!==b.score[i])return a.score[i]-b.score[i]}return 0});const best=candidates[0];return {...best,totalCompleted:s.parts.reduce((sum,p)=>sum+p.done,0),totalRequested:s.parts.reduce((sum,p)=>sum+p.qty,0),unusedStocks:s.stocks.filter(t=>!best.boards.some(b=>b.id===t.id)).length};}
function cut(s,stockId,partId,actualRemaining,success=true){validate(s);const p=plan(s),b=p.boards.find(v=>v.id===stockId);if(!b||!b.cuts.length||b.cuts[0].id!==partId)throw Error('最新計画の各材料の先頭部材を選んでください');
 const stock=s.stocks.find(t=>t.id===stockId),part=s.parts.find(t=>t.id===partId);
 const expected=stock.length-part.length-s.kerf;
 const actual=(actualRemaining===null||actualRemaining===undefined||actualRemaining==='')?expected:Number(actualRemaining);
 if(!int(actual,0,success?expected:stock.length-1))throw Error(`実測残りは0〜${success?expected:stock.length-1} mmで指定してください`);
 const next=copy(s);next.history=Array.isArray(s.history)?s.history.slice(-29):[];
 const snap=copy(s);snap.history=[];next.history.push(snap);
 next.stocks.find(t=>t.id===stockId).length=actual;
 if(success)next.parts.find(t=>t.id===partId).done++;
 if(!Array.isArray(next.log))next.log=[];
 next.log.push({stock:stock.label,part:part.label,cutLength:part.length,expected,actual,loss:Math.max(0,expected-actual),success,at:new Date().toISOString()});
 validate(next);return next;
}
function undo(s){if(!Array.isArray(s.history)||!s.history.length)throw Error('戻せる履歴がありません');const prev=copy(s.history[s.history.length-1]);prev.history=s.history.slice(0,-1);validate(prev);return prev;}
function exportCSV(s){const p=plan(s);const rows=[['種別','材料','材料元長mm','部材','部材長mm','残長mm','備考']];for(const b of p.boards){let left=b.initial;b.cuts.forEach((c,i)=>{left-=c.length+s.kerf;rows.push(['切断',b.label,b.initial,c.label,c.length,left,`${i+1}回目 / 刃厚${s.kerf}mm`]);});}for(const x of p.missing)rows.push(['未配置','','',x.label,x.length,'','材料追加が必要']);
 return '\ufeff'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');}
function importProject(raw){const s=JSON.parse(raw);validate(s);const out={version:1,title:String(s.title||'無題').slice(0,80),kerf:Number(s.kerf),reuseMin:Number(s.reuseMin),stocks:copy(s.stocks),parts:copy(s.parts),log:Array.isArray(s.log)?s.log.slice(-250):[],history:[]};return out;}
return {demo,validate,copy,remaining,plan,cut,undo,exportCSV,importProject};
});
