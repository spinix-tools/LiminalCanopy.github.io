/* ふりあわせ — pure reconciliation engine; no network, no dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FuriEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ALIASES = {
    payouts: {
      id: ['振込id','振込番号','精算id','管理番号','id','payout_id','payout id','reference'],
      date: ['精算日','振込日','日付','date','payout date','created'],
      gross: ['売上','売上総額','総売上','gross','gross_amount','sales'],
      fee: ['手数料','決済手数料','fee','fees'],
      refund: ['返金','返金額','refund','refunds'],
      adjustment: ['調整','調整額','adjustment','adjustments'],
      net: ['入金予定額','振込額','純額','差引額','net','net_amount','amount']
    },
    banks: {
      date: ['入金日','日付','取引日','date','value date'],
      amount: ['入金額','金額','amount','credit','入金'],
      memo: ['摘要','名義','メモ','備考','description','memo','reference']
    }
  };
  function norm(s) { return String(s ?? '').trim().toLowerCase().replace(/[\s_＿‐－-]/g, ''); }
  function csvParse(src) {
    const s = String(src || '').replace(/^\uFEFF/, '');
    const rows = []; let row = [], cell = '', inQuote = false;
    for (let i=0; i<s.length; i++) {
      const c=s[i];
      if (inQuote) {
        if (c==='"' && s[i+1]==='"') { cell+='"'; i++; }
        else if (c==='"') inQuote=false;
        else cell+=c;
      } else if (c==='"') { if (cell.trim()!=='') throw Error('CSVの引用符の位置が不正です'); inQuote=true; }
      else if (c===',') { row.push(cell.trim()); cell=''; }
      else if (c==='\n' || c==='\r') { if (c==='\r' && s[i+1]==='\n') i++; row.push(cell.trim()); if (row.some(x=>x!=='')) rows.push(row); row=[]; cell=''; }
      else cell+=c;
    }
    if (inQuote) throw Error('CSVの引用符が閉じられていません');
    row.push(cell.trim()); if (row.some(x=>x!=='')) rows.push(row);
    if (rows.length<2) throw Error('ヘッダーと1行以上のデータが必要です');
    const headers=rows.shift();
    if (!headers.length || headers.some(x=>!x)) throw Error('CSVヘッダーが空です');
    if (rows.length>5000) throw Error('一度に読み込めるのは5,000行までです');
    return {headers,rows:rows.map(r=>headers.map((_,i)=>r[i]??''))};
  }
  function guessMap(headers, kind) {
    const out={};
    for(const [field,names] of Object.entries(ALIASES[kind])) {
      out[field]=headers.findIndex(h=>names.some(name=>norm(name)===norm(h)));
    }
    return out;
  }
  function amount(s) {
    let v=String(s??'').trim().replace(/[￥¥,，\s円]/g,'');
    if (!v) return null;
    if (/^\([\d.]+\)$/.test(v)) v='-'+v.slice(1,-1);
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(v)) return null;
    const n=Number(v);
    return Number.isSafeInteger(n) ? n : null;
  }
  function dateISO(s) {
    const t=String(s??'').trim().replace(/[年月]/g,'/').replace(/日/g,'').replace(/-/g,'/');
    const m=/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(t);
    if (!m) return null;
    const y=+m[1],mo=+m[2],d=+m[3];
    const date=new Date(Date.UTC(y,mo-1,d));
    if (date.getUTCFullYear()!==y||date.getUTCMonth()!==mo-1||date.getUTCDate()!==d) return null;
    return [y,String(mo).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
  }
  function daysBetween(a,b) {return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);}
  function convert(doc,mapping,kind) {
    if (!doc) return {items:[],errors:[]};
    let errors=[];
    function col(row,key){let i=mapping[key];return Number.isInteger(i)&&i>=0 ? (row[i]??''):'';}
    if (mapping.date<0 || (kind==='banks'&&mapping.amount<0) || (kind==='payouts' && mapping.net<0 && mapping.gross<0)) {
      return {items:[],errors:['必須列（日付・金額）が指定されていません']};
    }
    const items=[];
    doc.rows.forEach((row,n)=>{
      const date=dateISO(col(row,'date'));
      if (!date){errors.push(`${n+2}行目: 日付が不正です`);return;}
      if (kind==='banks') {
        const value=amount(col(row,'amount'));
        if(value===null){errors.push(`${n+2}行目: 入金額が不正です`);return;}
        items.push({index:n,id:`B${n+2}`,date,amount:value,memo:col(row,'memo')});
        return;
      }
      const rawGross=String(col(row,'gross')).trim(),rawNet=String(col(row,'net')).trim();
      const gross=amount(rawGross);
      const reported=amount(rawNet);
      if (rawGross && gross===null){errors.push(`${n+2}行目: 売上が不正です`);return;}
      if (rawNet && reported===null){errors.push(`${n+2}行目: 振込額が不正です`);return;}
      if(gross===null && reported===null){errors.push(`${n+2}行目: 売上と振込額の両方が不正です`);return;}
      const optional={};
      for(const key of ['fee','refund','adjustment']) {
        const raw=col(row,key);
        const v=raw===''?0:amount(raw);
        if (v===null) {errors.push(`${n+2}行目: ${key}の金額が不正です`);return;}
        optional[key]=v;
      }
      const calc=gross===null?null:gross-optional.fee-optional.refund+optional.adjustment;
      if(calc!==null&&!Number.isSafeInteger(calc)){errors.push(`${n+2}行目: 計算結果が範囲外です`);return;}
      const net=reported===null?calc:reported;
      items.push({index:n,id:col(row,'id')||`P${n+2}`,date,gross,net,calc,reported,fee:optional.fee,refund:optional.refund,adjustment:optional.adjustment,mismatch:calc!==null&&reported!==null&&calc!==reported});
    });
    return {items,errors};
  }
  function reconcile(payouts,banks,options={}) {
    const lag=Math.max(0,Math.min(60,Math.floor(Number(options.lag??7)||0)));
    const tolerance=Math.max(0,Math.min(100000,Math.floor(Number(options.tolerance??0)||0)));
    const manual=options.manual || {};
    const taken=new Set(); const decisions=new Map();
    for(let i=0;i<payouts.length;i++){
      const b=Number(manual[payouts[i].index]);
      if(manual[payouts[i].index]!==undefined&&Number.isInteger(b)&&b>=0&&b<banks.length&&!taken.has(b)) {
        taken.add(b); decisions.set(i,{bankIndex:b,method:'manual',gap:banks[b].amount-payouts[i].net});
      }
    }
    const eligible=(p,b)=>!p.mismatch && daysBetween(p.date,b.date)>=0 && daysBetween(p.date,b.date)<=lag && Math.abs(p.net-b.amount)<=tolerance;
    let keepGoing=true;
    while(keepGoing){
      keepGoing=false;
      const pool=[]; const counts=new Map();
      for(let i=0;i<payouts.length;i++){
        if(decisions.has(i)||payouts[i].mismatch)continue;
        const choices=banks.map((b,j)=>!taken.has(j)&&eligible(payouts[i],b)?j:-1).filter(j=>j>=0);
        for(const j of choices)counts.set(j,(counts.get(j)||0)+1);
        if(choices.length===1)pool.push({i,j:choices[0]});
      }
      for(const p of pool)if(counts.get(p.j)===1){taken.add(p.j);decisions.set(p.i,{bankIndex:p.j,method:'auto',gap:banks[p.j].amount-payouts[p.i].net});keepGoing=true;}
    }
    const rows=payouts.map((p,i)=>{
      if(decisions.has(i)) return {...p,...decisions.get(i),status:decisions.get(i).method};
      const candidates=banks.map((b,j)=>!taken.has(j)&&eligible(p,b)?j:-1).filter(j=>j>=0);
      const near=banks.map((b,j)=>({j,gap:b.amount-p.net,day:daysBetween(p.date,b.date)}))
        .filter(x=>!taken.has(x.j)&&x.day>=0&&x.day<=lag&&Math.abs(x.gap)<=Math.max(1000,Math.abs(p.net)*.1))
        .sort((a,b)=>Math.abs(a.gap)-Math.abs(b.gap)||a.day-b.day).slice(0,2);
      return {...p,bankIndex:null,method:null,gap:null,candidates,near,status:p.mismatch?'mismatch':candidates.length?'ambiguous':'missing'};
    });
    const stats={auto:rows.filter(x=>x.status==='auto').length,manual:rows.filter(x=>x.status==='manual').length,ambiguous:rows.filter(x=>x.status==='ambiguous').length,mismatch:rows.filter(x=>x.status==='mismatch').length,missing:rows.filter(x=>x.status==='missing').length,unmatchedBank:banks.length-taken.size,totalPayout:payouts.length,totalBank:banks.length};
    return {rows,stats,taken,unmatched:banks.filter((_,i)=>!taken.has(i)),lag,tolerance};
  }
  function csvEncode(rows) {
    function safe(v){let s=String(v??'');if(/^[\t\r\n\s]*[=+@-]/.test(s)&&!/^-?\d+(?:\.\d+)?$/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
    return rows.map(row=>row.map(safe).join(',')).join('\r\n')+'\r\n';
  }
  const samplePayouts='精算ID,精算日,売上,手数料,返金,調整,入金予定額\nSET-A,2026/10/25,10000,300,0,0,9700\nSET-B,2026/11/03,7500,220,500,0,6780\nSET-C,2026/11/04,10000,300,0,0,9700\nSET-D,2026/11/05,10000,300,0,0,9700\nSET-E,2026/11/06,4000,120,0,0,3880\nSET-F,2026/11/07,5000,150,0,0,4850\nSET-G,2026/11/08,3000,80,0,0,3000';
  const sampleBanks='入金日,入金額,摘要\n2026/10/27,9700,決済代行振込A\n2026/11/04,6780,決済代行振込B\n2026/11/05,9700,決済代行振込C\n2026/11/06,9700,決済代行振込D\n2026/11/09,3780,決済代行差額100円\n2026/11/09,2300,別の入金';
  return {csvParse,guessMap,amount,dateISO,daysBetween,convert,reconcile,csvEncode,samplePayouts,sampleBanks,ALIASES};
});
