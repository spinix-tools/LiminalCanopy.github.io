/* 受入前チェック: pure validation engine. MIT */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Ukeire = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LIMIT = 100000;
  const DEFAULT_RULES = [
    {name:'商品コード', source:'商品コード', type:'text', required:true, unique:true, max:20, allowed:''},
    {name:'商品名', source:'商品名', type:'text', required:true, unique:false, max:60, allowed:''},
    {name:'単価', source:'単価', type:'nonneg', required:true, unique:false, max:0, allowed:''},
    {name:'在庫', source:'在庫', type:'integer', required:true, unique:false, max:0, allowed:''},
    {name:'発売日', source:'発売日', type:'date', required:false, unique:false, max:0, allowed:''},
    {name:'区分', source:'区分', type:'enum', required:true, unique:false, max:0, allowed:'文具|雑貨|食品'}
  ];
  const SAMPLE = '商品コード,商品名,単価,在庫,発売日,区分\n00123,小さなノート,350,10,2026-11-11,文具\n00124,カードケース,四百,8,2026-13-02,雑貨\n00123,ペン,120,-1,2026-11-12,文具\n00125,"シール,3枚組",150,6,2026-11-09,その他\n00126,,200,12,2026-11-02,文具\n00127,ふせん,300,4,2026-11-11,文具';
  const badPatterns = /(?:\uFFFD|縺|繧|譁|譌|菴|蟄|莨|ã|ã‚)/g;
  function parseCSV(input, delimiter=',') {
    const text = String(input || '').replace(/^\uFEFF/, '');
    if (!['\t',',',';','|'].includes(delimiter)) throw Error('未対応の区切り文字です');
    const rows=[]; const lines=[]; const problems=[];
    let row=[],cell='',quoted=false,closed=false,atStart=true,line=1,rowLine=1;
    for (let i=0; i<text.length; i++) {
      const c=text[i];
      if (quoted) {
        if (c==='"') {
          if(text[i+1]==='"'){cell+='"';i++;} else {quoted=false;closed=true;}
        } else if(c==='\r') {if(text[i+1]==='\n')i++;cell+='\n';line++;}
        else {cell+=c;if(c==='\n')line++;}
        continue;
      }
      if(c==='"' && atStart){quoted=true;atStart=false;continue;}
      if(c==='"'){problems.push({row:rowLine,code:'quote',level:'error',message:'セルの途中に不正な引用符'});cell+=c;closed=false;atStart=false;continue;}
      if(closed && c!==delimiter && c!=='\n' && c!=='\r'){
        problems.push({row:rowLine,code:'quote_tail',level:'error',message:'閉じ引用符の後に余分な文字'});closed=false;
      }
      if(c===delimiter){row.push(cell);cell='';closed=false;atStart=true;}
      else if(c==='\n'||c==='\r'){
        row.push(cell);rows.push(row);lines.push(rowLine);row=[];cell='';closed=false;atStart=true;
        if(c==='\r' && text[i+1]==='\n')i++;
        line++;rowLine=line;
        if(rows.length>LIMIT) throw Error('データ行数の上限を超えました');
      } else {cell+=c;atStart=false;}
    }
    if(quoted) problems.push({row:rowLine,code:'unclosed_quote',level:'error',message:'引用符が閉じられていません'});
    if(row.length || cell.length || (!atStart && text.length)) {row.push(cell);rows.push(row);lines.push(rowLine);}
    return {rows,lines,problems};
  }
  function guessDelimiter(text) {
    const choices=[',','\t',';','|'];
    const scores = choices.map(d=>{
      try { const p=parseCSV(text.slice(0,50000),d); const lens=p.rows.slice(0,40).map(r=>r.length).filter(n=>n>1);
        if(!lens.length)return {d,score:-100};const counts={};lens.forEach(n=>counts[n]=(counts[n]||0)+1);
        return {d,score:Math.max(...Object.values(counts))*3 + Math.min(20,lens.length) + Math.min(10,Math.max(...lens)) - p.problems.length*10};
      }catch{return {d,score:-100};}
    });
    scores.sort((a,b)=>b.score-a.score);return scores[0].score<0?',':scores[0].d;
  }
  function decodeBytes(bytes, encoding='auto') {
    const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
    if(b.length>3*1024*1024)throw Error('ファイルの上限は3MBです');
    const enc=['utf-8','shift_jis','euc-jp','utf-16le'];
    let selected=encoding;
    if(encoding==='auto') {
      if(b[0]===0xEF && b[1]===0xBB && b[2]===0xBF) selected='utf-8';
      else if(b[0]===0xFF && b[1]===0xFE)selected='utf-16le';
      else {
        const candidates=enc.filter(e=>e!=='utf-16le').map(e=>{
          try {const t=new TextDecoder(e,{fatal:true}).decode(b);let score=(t.match(/[ぁ-んァ-ヶ一-龠]/g)||[]).length*2 - (t.match(badPatterns)||[]).length*12;
            if(e==='utf-8')score+=8;
            if(t.includes('\u0000'))score-=500;
            return {e,score};}catch{return {e,score:-1e9};}
        }).sort((a,c)=>c.score-a.score);selected=candidates[0].score > -1e9 ? candidates[0].e : 'utf-8';
      }
    }
    if(!enc.includes(selected))throw Error('未対応の文字コードです');
    let decoded,loss=false;
    try{decoded=new TextDecoder(selected,{fatal:true}).decode(b);}catch{decoded=new TextDecoder(selected).decode(b);loss=true;}
    return {text:decoded.replace(/^\uFEFF/,''),encoding:selected,loss,hasReplacement:decoded.includes('\uFFFD')};
  }
  function normalizeHeader(s){return String(s??'').trim().normalize('NFKC').toLowerCase();}
  function validDate(s){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);if(!m)return false; const y=+m[1],mo=+m[2],d=+m[3];if(y<1||mo<1||mo>12||d<1)return false;const days=new Date(Date.UTC(y,mo,0)).getUTCDate();return d<=days;}
  function validType(v,type){switch(type){
    case 'text':return true;
    case 'integer':return /^-?(?:0|[1-9]\d*)$/.test(v);
    case 'nonneg':return /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(v);
    case 'date':return validDate(v);
    case 'enum':return true;
    default:return false;
  }}
  function excelRisk(v){const t=String(v).trimStart();return /^[=+@\t\r]/.test(t) || (/^-/.test(t) && !/^-\d+(?:\.\d+)?$/.test(t));}
  function spreadsheetRisk(v){return /^0\d+$/.test(v) || /^\d{16,}$/.test(v) || /^\d{1,2}[-/]\d{1,2}$/.test(v) || /^\d+(?:\.\d+)?[eE][+\-]?\d+$/.test(v);}
  function normalizeRules(rules){if(!Array.isArray(rules)||rules.length>60)throw Error('ルールは最大60列です');return rules.map((r,i)=>{
    const name=String(r.name||'').trim();if(!name)throw Error(`${i+1}列目に名前がありません`);
    const type=['text','integer','nonneg','date','enum'].includes(r.type)?r.type:'text';
    return {name,source:String(r.source||''),type,required:!!r.required,unique:!!r.unique,max:Math.max(0,Math.min(10000,Math.floor(Number(r.max)||0))),allowed:String(r.allowed||'')};
  });}
  function analyze(text, rawRules, delimiter='auto') {
    const rules=normalizeRules(rawRules);
    if(new Set(rules.map(r=>normalizeHeader(r.name))).size!==rules.length)throw Error('出力列名が重複しています');
    const d=delimiter==='auto'?guessDelimiter(text):delimiter;
    const parsed=parseCSV(text,d), issues=parsed.problems.map(x=>({...x,col:'',value:''}));
    if(!parsed.rows.length)throw Error('CSVが空です');
    const headers=parsed.rows[0].map(x=>String(x)), width=headers.length;
    const headerKeys=headers.map(normalizeHeader);
    headers.forEach((h,i)=>{
      if(!h.trim())issues.push({row:parsed.lines[0],col:`${i+1}列`,level:'error',code:'header_blank',message:'見出しが空白',value:''});
      if(headerKeys.indexOf(headerKeys[i])!==i)issues.push({row:parsed.lines[0],col:h,level:'error',code:'header_dup',message:'見出しの重複',value:''});
    });
    const colIndices=rules.map(r=>headerKeys.indexOf(normalizeHeader(r.source)));
    rules.forEach((r,i)=>{if(colIndices[i]<0)issues.push({row:parsed.lines[0],col:r.name,level:'error',code:'unmapped',message:'入力列が未対応付けです',value:''});});
    headers.forEach((h,i)=>{if(!colIndices.includes(i))issues.push({row:parsed.lines[0],col:h,level:'warning',code:'unused',message:'出力に含まれない入力列',value:''});});
    const rows=[], goodRows=[], invalidRowIds=new Set();const uniqueSets=rules.map(()=>new Map());
    for(let i=1;i<parsed.rows.length;i++){
      const raw=parsed.rows[i], physical=parsed.lines[i];
      if(raw.length===1&&raw[0].trim()===''){issues.push({row:physical,col:'',level:'warning',code:'empty_line',message:'空行を除外',value:''});continue;}
      const rowIssues=[];
      function add(col,level,code,message,value=''){const issue={row:physical,col,level,code,message,value};issues.push(issue);rowIssues.push(issue);}
      if(raw.length!==width)add('', 'error','column_count',`列数が異なります（${raw.length}列 / 見出し${width}列）`);
      const out=rules.map((r,j)=>{
        const c=colIndices[j],v=c>=0?(raw[c]??''):'';
        if(c<0)return '';
        if(r.required && !v.trim())add(r.name,'error','required','必須項目が空白',v);
        if(v && !validType(v,r.type))add(r.name,'error','type',`形式が違います（${r.type}）`,v);
        if(r.max>0 && [...v].length>r.max)add(r.name,'error','max',`文字数が${r.max}を超過`,v);
        if(v && r.type==='enum' && r.allowed.split('|').map(s=>s.trim()).filter(Boolean).length && !r.allowed.split('|').map(s=>s.trim()).includes(v))add(r.name,'error','enum','許可値リストに存在しません',v);
        if(v && r.unique){const prev=uniqueSets[j].get(v);if(prev!==undefined)add(r.name,'error','duplicate',`重複値（初出は${prev}行）`,v);else uniqueSets[j].set(v,physical);}
        if(v && r.type==='text' && spreadsheetRisk(v))add(r.name,'warning','excel','Excel等で値が変化する恐れ（先頭0・長整数・日付風）',v);
        if(v && excelRisk(v))add(r.name,'warning','formula','表計算ソフトで数式と解釈される恐れ',v);
        if(v.includes('\uFFFD'))add(r.name,'warning','replacement','置換文字があり元データ復元不可の場合があります',v);
        return v;
      });
      if(rowIssues.some(x=>x.level==='error'))invalidRowIds.add(physical);else goodRows.push(out);
      rows.push({line:physical,values:out,issues:rowIssues});
    }
    const headerError=issues.some(x=>x.level==='error' && x.row===parsed.lines[0]);
    // Structural issues with a physical start line block safe export.
    const structuralRows=new Set(parsed.problems.filter(x=>x.level==='error').map(x=>x.row));
    if(structuralRows.size) rows.forEach(r=>{if(structuralRows.has(r.line))invalidRowIds.add(r.line);});
    const approvedRows=headerError?[]:rows.filter(r=>!invalidRowIds.has(r.line)).map(r=>r.values);
    return {delimiter:d,headers,rules,rows,issues,approvedRows,headerError,
      summary:{total:rows.length,accepted:approvedRows.length,rejected:headerError?rows.length:rows.length-approvedRows.length,errors:issues.filter(i=>i.level==='error').length,warnings:issues.filter(i=>i.level==='warning').length}};
  }
  function csvEscape(value,delimiter=','){
    const s=String(value??'');return (s.includes('"')||s.includes('\r')||s.includes('\n')||s.includes(delimiter))?'"'+s.replace(/"/g,'""')+'"':s;
  }
  function toCSV(headers,rows,options={}) {
    const delimiter=options.delimiter==='\t'?'\t':',';
    const eol=options.eol==='LF'?'\n':'\r\n';
    const guard=!!options.guardFormula;
    function serialize(row){return row.map(v=>csvEscape(guard&&excelRisk(v)?"'"+v:v,delimiter)).join(delimiter);}
    return (options.bom===false?'':'\uFEFF')+[serialize(headers),...rows.map(serialize)].join(eol)+eol;
  }
  function issuesCSV(issues){return toCSV(['行','列','重大度','コード','指摘'],issues.map(i=>[i.row,i.col,i.level,i.code,i.message]));}
  function ruleJSON(rules){return JSON.stringify({format:'ukeire-check-rules-v1',rules:normalizeRules(rules)},null,2);}
  function importRuleJSON(text){const obj=JSON.parse(text);if(obj.format!=='ukeire-check-rules-v1')throw Error('対応していないルール形式です');return normalizeRules(obj.rules);}
  return {SAMPLE,DEFAULT_RULES,LIMIT,parseCSV,guessDelimiter,decodeBytes,validDate,validType,excelRisk,spreadsheetRisk,analyze,toCSV,issuesCSV,ruleJSON,importRuleJSON};
});