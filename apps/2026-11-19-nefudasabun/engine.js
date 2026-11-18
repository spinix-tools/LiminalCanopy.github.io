/* 値札差分 / NEFUDA SABUN — deterministic data engine; MIT */
(function(root,factory){ const api=factory(); if(typeof module==='object'&&module.exports) module.exports=api; root.NefuEngine=api; })(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const LIMIT=3000;
function parseCSV(text){
  if(typeof text!=='string') throw Error('CSVは文字列で指定してください');
  text=text.replace(/^\uFEFF/,'');
  if(!text.trim()) throw Error('CSVが空です');
  const records=[]; let line=1,rowLine=1,field='',row=[],quoted=false,closed=false;
  const finishField=()=>{row.push(field);field='';closed=false;};
  const finishRow=()=>{finishField();records.push({values:row,line:rowLine});row=[];rowLine=line;};
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else {quoted=false;closed=true;}} else if(c==='\r'){field+='\n'; if(text[i+1]==='\n')i++;line++;}else if(c==='\n'){field+='\n';line++;}else field+=c;continue;}
    if(c==='"'){if(field!==''||closed)throw Error(`CSV ${line}行: 引用符の位置が不正です`);quoted=true;}
    else if(c===','){finishField();}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;line++;finishRow();rowLine=line;}
    else if(closed){if(c===' '||c==='\t') { /* tolerate spaces after closing quote */ } else throw Error(`CSV ${line}行: 閉じ引用符の後に文字があります`);}
    else field+=c;
  }
  if(quoted)throw Error('CSVの引用符が閉じていません');
  if(field!==''||row.length||closed)finishRow();
  while(records.length&&records.at(-1).values.every(x=>x===''))records.pop();
  if(!records.length)throw Error('CSVに見出しがありません');
  const headers=records.shift().values.map(s=>s.trim());
  if(headers.some(x=>!x))throw Error('空の列見出しがあります');
  if(new Set(headers).size!==headers.length)throw Error('同名の列見出しがあります');
  if(records.length>LIMIT)throw Error(`CSVは${LIMIT}行以内にしてください`);
  for(const rec of records){if(rec.values.length!==headers.length)throw Error(`CSV ${rec.line}行: 列数${rec.values.length}が見出しの${headers.length}列と一致しません`);}
  return {headers,rows:records};
}
function normalSku(v){return String(v??'').normalize('NFKC').trim().toUpperCase();}
function price(v,allowEmpty=false){let s=String(v??'').normalize('NFKC').trim().replace(/[¥￥\s,]/g,'');if(!s&&allowEmpty)return null;if(!/^\d+$/.test(s))return null;const n=Number(s);return Number.isSafeInteger(n)?n:null;}
function headerGuess(headers,role){const names={sku:['sku','商品コード','商品番号','商品id','品番','コード','id'],name:['商品名','品名','name','商品','名称'],price:['税込価格','販売価格','売価','価格','price','単価'],cost:['原価','仕入価格','cost','仕入単価']};const norm=v=>v.normalize('NFKC').toLowerCase().replace(/[\s_\-]/g,'');return headers.find(h=>names[role].some(a=>norm(a)===norm(h)))??'';}
function compare(oldTable,newTable,mapping){
  if(!oldTable||!newTable)throw Error('変更前と変更後の両方のCSVを入力してください');
  for(const side of ['old','new']) for(const k of ['sku','name','price'])if(!mapping[side]?.[k]||!(side==='old'?oldTable:newTable).headers.includes(mapping[side][k]))throw Error(`${side==='old'?'変更前':'変更後'}の${k}列を指定してください`);
  const issues=[];
  const prepare=(table,map,side)=>{
    const ix={};for(const k of ['sku','name','price','cost'])ix[k]=map[k]?table.headers.indexOf(map[k]):-1;
    const list=table.rows.map((r,i)=>{const get=k=>ix[k]<0?'':r.values[ix[k]];const key=normalSku(get('sku'));const amount=price(get('price'));const c=ix.cost<0||!get('cost').trim()?null:price(get('cost'));return {key,name:get('name').trim(),amount,c,raw:r.values,line:r.line,side,row:i+1,invalid:(!key||amount===null||(ix.cost>=0&&get('cost').trim()&&c===null))};});
    const grouped=new Map();for(const r of list)if(r.key){if(!grouped.has(r.key))grouped.set(r.key,[]);grouped.get(r.key).push(r);}
    for(const r of list){if(!r.key)issues.push(`${side==='old'?'変更前':'変更後'} ${r.line}行: 商品コードが空白`);if(r.amount===null)issues.push(`${side==='old'?'変更前':'変更後'} ${r.line}行: 価格は0以上の整数で入力`);if(ix.cost>=0&&r.raw[ix.cost].trim()&&r.c===null)issues.push(`${side==='old'?'変更前':'変更後'} ${r.line}行: 原価が不正`);if(r.key&&grouped.get(r.key).length>1){r.invalid=true;}}
    for(const [key,group] of grouped)if(group.length>1)issues.push(`${side==='old'?'変更前':'変更後'}: 商品コード「${key}」が${group.length}件重複（全件除外）`);
    return {list,valid:new Map(list.filter(r=>!r.invalid).map(r=>[r.key,r]))};
  };
  const a=prepare(oldTable,mapping.old,'old'),b=prepare(newTable,mapping.new,'new');
  const keys=new Set([...a.valid.keys(),...b.valid.keys()]),entries=[];
  for(const key of keys){const before=a.valid.get(key)??null,after=b.valid.get(key)??null;
    const changes=[];if(before&&after){if(before.name!==after.name)changes.push('商品名');if(before.amount!==after.amount)changes.push('税込価格');if(before.c!==after.c)changes.push('原価');}
    const kind=!before?'added':!after?'removed':changes.length?'changed':'same';
    const warnings=[];
    if(after?.c!==null&&after&&after.c>=after.amount)warnings.push('原価≧販売価格');
    if(before&&after&&before.amount>0&&Math.abs(after.amount-before.amount)/before.amount>=0.2)warnings.push('価格変動20%以上');
    entries.push({key,kind,before,after,changes,warnings,delta:before&&after?after.amount-before.amount:null,printable:!!after&&(kind==='added'||(kind==='changed'&&(changes.includes('税込価格')||changes.includes('商品名'))))});
  }
  const counts={added:0,removed:0,changed:0,same:0,issues:issues.length};for(const e of entries)counts[e.kind]++;
  return {entries,issues,counts,excluded:{old:a.list.filter(r=>r.invalid).length,new:b.list.filter(r=>r.invalid).length}};
}
function csvValue(value){let s=String(value??'');if(/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;if(/[",\r\n]/.test(s))s='"'+s.replace(/"/g,'""')+'"';return s;}
function toCSV(rows){return '\uFEFF'+rows.map(row=>row.map(csvValue).join(',')).join('\r\n')+'\r\n';}
function auditRows(data,checked=new Set()){
 const rows=[['判定','確認','商品コード','変更項目','旧商品名','新商品名','旧価格','新価格','価格差','旧原価','新原価','注意','旧CSV行','新CSV行']];
 for(const e of data.entries)if(e.kind!=='same')rows.push([({added:'新規',removed:'削除',changed:'変更'})[e.kind],checked.has(e.key)?'確認済':'未確認',e.key,e.changes.join('/'),e.before?.name,e.after?.name,e.before?.amount,e.after?.amount,e.delta??'',e.before?.c,e.after?.c,e.warnings.join('/'),e.before?.line??'',e.after?.line??'']);
 for(const issue of data.issues)rows.push(['要修正','','','','','','','','','','',issue,'','']);return rows;
}
return {parseCSV,normalSku,price,headerGuess,compare,toCSV,auditRows,LIMIT};
});
