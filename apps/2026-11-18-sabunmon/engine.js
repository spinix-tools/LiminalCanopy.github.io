/* SABUNMON — deterministic browser/Node CSV review engine. MIT. */
(function(root, factory){
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SABUNMON = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';
  const MAX_CHARS = 3000000, MAX_ROWS = 10000;
  function parseCSV(input){
    if (typeof input !== 'string' || !input.trim()) throw Error('CSVが空です。');
    if (input.length > MAX_CHARS) throw Error('CSVは1ファイル300万文字以下にしてください。');
    let text=input.replace(/^\uFEFF/, '');
    const rows=[]; let row=[], value='', quoted=false, closed=false, atStart=true, line=1;
    const pushCell=()=>{ row.push(value); value=''; atStart=true; closed=false; };
    const pushRow=()=>{
      pushCell();
      if(row.some(x=>x!=='')) rows.push(row);
      row=[];
      if(rows.length > MAX_ROWS+1) throw Error('CSVはヘッダーを除いて1万行までです。');
    };
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(quoted){
        if(c==='"') {if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}
        else {value+=c; if(c==='\n')line++;}
      }else if(c===','){pushCell();}
      else if(c==='\r'||c==='\n') { if(c==='\r'&&text[i+1]==='\n')i++; pushRow();line++; }
      else if(c==='"'&&atStart&&!closed){quoted=true;atStart=false;}
      else if(c==='"'||closed) throw Error(`${line}行目：引用符の位置が不正です。`);
      else{value+=c;atStart=false;}
    }
    if(quoted) throw Error('CSVの引用符が閉じられていません。');
    if(row.length || value!=='') pushRow();
    if(rows.length < 2) throw Error('ヘッダーと1行以上のデータが必要です。');
    const headers=rows.shift();
    if(headers.some(h=>!h.trim())) throw Error('空の列見出しがあります。');
    if(new Set(headers).size!==headers.length) throw Error('重複する列見出しがあります。');
    rows.forEach((r,i)=>{if(r.length!==headers.length) throw Error(`データ${i+2}行目：列数がヘッダーと異なります（${r.length}/${headers.length}）。`);});
    const records=rows.map((r)=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])));
    return {headers,records};
  }
  function quoteCell(x){let s=String(x??'');return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
  function toCSV(headers,records,excelSafe=false){
    const safe=(v)=>{
      let s=String(v??'');
      if(excelSafe && /^[\s]*[=+@\-\t\r]/u.test(s))s="'"+s;
      return quoteCell(s);
    };
    return [headers.map(safe).join(','),...records.map(r=>headers.map(h=>safe(r[h])).join(','))].join('\r\n')+'\r\n';
  }
  function normKey(s,trim){return trim?String(s).trim():String(s);}
  function toNumber(s,integer=false){
    const raw=String(s??'').normalize('NFKC').replace(/[¥￥\s]/g,'');
    if(raw.includes(',') && !/^\d{1,3}(,\d{3})+(?:\.\d+)?$/.test(raw))return null;
    const plain=raw.replace(/,/g,'');
    if(!plain || !(integer?/^\d+$/:/^\d+(?:\.\d+)?$/).test(plain))return null;
    const n=Number(plain); return Number.isFinite(n)&&n<=Number.MAX_SAFE_INTEGER?n:null;
  }
  function guess(headers,terms){
    return headers.find(h=>terms.some(t=>h.toLowerCase()===t.toLowerCase()))||'';
  }
  function suggest(headers){
    return {key:guess(headers,['商品コード','SKU','sku','商品ID','品番','product_code','id']),name:guess(headers,['商品名','名称','name','product_name']),price:guess(headers,['販売価格','価格','税込価格','price','price_jpy']),stock:guess(headers,['在庫数','在庫','stock','quantity','qty'])};
  }
  function indexRecords(parsed,key,trim,side){
    const index=new Map();
    parsed.records.forEach((row,i)=>{
      const id=normKey(row[key],trim);
      if(!id) throw Error(`${side}データ${i+2}行目：キーが空です。`);
      if(index.has(id))throw Error(`${side}データ：キー「${id}」が重複しています（${index.get(id).line}行目と${i+2}行目）。`);
      index.set(id,{row,line:i+2});
    });
    return index;
  }
  function compare(oldCsv,newCsv,options={}){
    const before= typeof oldCsv==='string'?parseCSV(oldCsv):oldCsv;
    const after= typeof newCsv==='string'?parseCSV(newCsv):newCsv;
    const oh=before.headers,nh=after.headers;
    const onlyOld=oh.filter(h=>!nh.includes(h)),onlyNew=nh.filter(h=>!oh.includes(h));
    if(onlyOld.length||onlyNew.length)throw Error(`列構成が一致しません。旧のみ: ${onlyOld.join('・')||'なし'} ／ 新のみ: ${onlyNew.join('・')||'なし'}。列名を揃えてください。`);
    const g=suggest(oh), key=options.key||g.key;
    if(!key||!oh.includes(key))throw Error('一致する商品コード（キー列）を選択してください。');
    const price=options.price===undefined?g.price:options.price,stock=options.stock===undefined?g.stock:options.stock;
    const name=options.name===undefined?g.name:options.name;
    for(const c of [price,stock,name])if(c&&!oh.includes(c))throw Error(`列「${c}」が見つかりません。`);
    const threshold=options.threshold===undefined?25:Number(options.threshold);
    if(!Number.isFinite(threshold)||threshold<1||threshold>100)throw Error('価格変動の警告閾値は1〜100%にしてください。');
    const trim=Boolean(options.trimKeys);
    const oldIndex=indexRecords(before,key,trim,'旧');const newIndex=indexRecords(after,key,trim,'新');
    const result=[];
    for(const [id,o] of oldIndex){
      const n=newIndex.get(id);
      const oldRow=o.row,newRow=n?.row||null;
      const changed=n?oh.filter(h=>h!==key&&oldRow[h]!==newRow[h]):[];
      result.push({id,oldRow,newRow,changed,type:!n?'removed':changed.length?'modified':'unchanged'});
    }
    for(const [id,n] of newIndex){if(!oldIndex.has(id))result.push({id,oldRow:null,newRow:n.row,changed:oh.filter(h=>h!==key),type:'added'});}
    for(const item of result){
      const reason=[],blocked=[];const o=item.oldRow,n=item.newRow;
      if(item.type==='removed')reason.push('商品が一覧から消えています');
      if(item.type==='added')reason.push('新商品を追加');
      if(n && item.type!=='unchanged'){
        if(price){
          const next=toNumber(n[price]);
          if(next===null)blocked.push('販売価格の数値が不正');
          else if(next===0)reason.push('販売価格が0円');
          if(o && item.changed.includes(price)){
            const prev=toNumber(o[price]);
            if(prev===null)reason.push('旧価格を数値として読めない');
            else if(prev>0 && next!==null){
              const pct=(next-prev)/prev*100;
              item.priceChangePct=pct;
              if(Math.abs(pct)>=threshold)reason.push(`価格が${Math.abs(pct).toFixed(1)}%${pct>0?'上昇':'下落'}`);
            }else if(prev===0&&next>0){reason.push('無料から有料への変更');}
          }
        }
        if(stock){
          const next=toNumber(n[stock],true);
          if(next===null)blocked.push('在庫数の整数値が不正');
          if(o && item.changed.includes(stock)){
            const prev=toNumber(o[stock],true);
            if(next===0&&prev!==null&&prev>0)reason.push('在庫が0になりました');
            if(next!==null&&prev!==null&&prev>0&&next<prev*0.5)reason.push('在庫が半分未満に減少');
          }
        }
      }
      item.reasons=reason;item.blocked=blocked;
      item.severity=blocked.length?'blocked':(item.type==='removed'||reason.some(x=>/価格が|無料から|在庫が0/.test(x))?'high':(reason.length||item.type==='modified'?'review':'none'));
    }
    const counts={added:0,removed:0,modified:0,unchanged:0,high:0,blocked:0};
    result.forEach(x=>{counts[x.type]++;if(x.severity==='high')counts.high++;if(x.severity==='blocked')counts.blocked++;});
    return {headers:oh, before, after, key,price,stock,name,threshold,trimKeys:trim,items:result,counts};
  }
  function stagedRows(report, approved){
    const accepted=approved instanceof Set?approved:new Set(approved||[]);
    const out=[];
    for(const item of report.items){
      const yes=accepted.has(item.id)&&!item.blocked.length;
      if(item.type==='removed'){if(!yes)out.push(item.oldRow);}
      else if(item.type==='added'){if(yes)out.push(item.newRow);}
      else if(item.type==='modified')out.push(yes?item.newRow:item.oldRow);
      else out.push(item.oldRow);
    }
    return out;
  }
  function auditRows(report,approved){
    const accepted=approved instanceof Set?approved:new Set(approved||[]);
    const out=[];
    for(const x of report.items){
      if(x.type==='unchanged')continue;
      const ok=accepted.has(x.id)&&!x.blocked.length;
      const fields=x.type==='modified'?x.changed:['(行全体)'];
      for(const field of fields){out.push({商品コード:x.id,種別:x.type,判定:x.severity,承認:ok?'承認':'未承認',対象列:field,旧値:field==='(行全体)'?'':(x.oldRow?.[field]??''),新値:field==='(行全体)'?'':(x.newRow?.[field]??''),理由:[...x.reasons,...x.blocked].join(' / ')});}
    }
    return out;
  }
  return {parseCSV,toCSV,toNumber,suggest,compare,stagedRows,auditRows,MAX_ROWS};
});
