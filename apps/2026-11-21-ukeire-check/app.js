(()=>{
'use strict';
const E=window.Ukeire;
const $=id=>document.getElementById(id);
const types=[['text','文字列'],['integer','整数（負数可）'],['nonneg','0以上の数値'],['date','日付 YYYY-MM-DD'],['enum','選択肢']];
const state={rules:E.DEFAULT_RULES.map(r=>({...r})),bytes:null,result:null,filter:'all',filename:'sample.csv'};
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;}
function setStatus(msg,bad=false){$('decodeStatus').textContent=msg;$('decodeStatus').classList.toggle('bad',bad);}
function markStale(){state.result=null;$('checkedAt').textContent='入力・ルール変更後は再点検が必要です';$('downloadValid').disabled=true;$('downloadIssues').disabled=true;}
function headerNames(){try{const d=getDelimiter();return E.parseCSV($('csvInput').value.slice(0,100000),d==='auto'?E.guessDelimiter($('csvInput').value):d).rows[0]||[];}catch{return [];}}
function getDelimiter(){return $('delimiter').value==='\\t'?'\t':$('delimiter').value;}
function makeInput(val,type,handler){const n=el('input');n.type=type;n.value=val;n.addEventListener('change',()=>{handler(n.type==='checkbox'?n.checked:n.value);markStale();});return n;}
function renderRules(){
  const tbody=$('ruleRows');tbody.replaceChildren();const heads=headerNames();
  state.rules.forEach((rule,i)=>{
    const tr=el('tr');let td=el('td');const name=makeInput(rule.name,'text',v=>{rule.name=v;});name.setAttribute('aria-label',`出力列${i+1}の名前`);td.append(name);tr.append(td);
    td=el('td');const sel=el('select','source-select');sel.setAttribute('aria-label',`${rule.name}の入力列`);let op=el('option','', '未対応付け');op.value='';sel.append(op);
    const opts=[...new Set([...heads,rule.source].filter(Boolean))];opts.forEach(h=>{const o=el('option','',h);o.value=h;sel.append(o);});sel.value=rule.source;sel.addEventListener('change',()=>{rule.source=sel.value;markStale();});td.append(sel);tr.append(td);
    td=el('td');const type=el('select');type.setAttribute('aria-label',`${rule.name}の検証型`);types.forEach(([value,label])=>{const o=el('option','',label);o.value=value;type.append(o);});type.value=rule.type;type.addEventListener('change',()=>{rule.type=type.value;markStale();});td.append(type);tr.append(td);
    for(const key of ['required','unique']) {td=el('td');const cb=el('input');cb.type='checkbox';cb.checked=!!rule[key];cb.setAttribute('aria-label',`${rule.name} ${key==='required'?'必須':'重複禁止'}`);cb.addEventListener('change',()=>{rule[key]=cb.checked;markStale();});td.append(cb);tr.append(td);}
    td=el('td');const max=makeInput(rule.max||0,'number',v=>{rule.max=+v;});max.min='0';max.max='10000';max.setAttribute('aria-label',`${rule.name}の最大文字数`);td.append(max);tr.append(td);
    td=el('td');const allowed=makeInput(rule.allowed,'text',v=>{rule.allowed=v;});allowed.setAttribute('aria-label',`${rule.name}の許可値`);td.append(allowed);tr.append(td);
    td=el('td');const del=el('button','small-delete','×');del.setAttribute('aria-label',`${rule.name}を削除`);del.addEventListener('click',()=>{state.rules.splice(i,1);markStale();renderRules();});td.append(del);tr.append(td);
    tbody.append(tr);
  });
}
function autoMap(){const heads=headerNames();const lookup=new Map(heads.map(h=>[String(h).trim().normalize('NFKC').toLowerCase(),h]));state.rules.forEach(r=>r.source=lookup.get(r.name.trim().normalize('NFKC').toLowerCase())||'');renderRules();markStale();}
function refreshIssues(){const tbody=$('issueRows');tbody.replaceChildren();const all=state.result?state.result.issues:[];const list=all.filter(x=>state.filter==='all'||x.level===state.filter);
  if(!list.length){const tr=el('tr');const td=el('td','blank',all.length?'この種類の指摘はありません':'指摘はありません');td.colSpan=5;tr.append(td);tbody.append(tr);return;}
  list.slice(0,120).forEach(issue=>{const tr=el('tr');const values=[issue.row,issue.col,issue.level==='error'?'エラー':'注意',issue.message,String(issue.value||'').slice(0,64)];values.forEach((v,i)=>{const td=el('td');if(i===2)td.append(el('span','severity '+issue.level,v));else td.textContent=String(v);tr.append(td);});tbody.append(tr);});
  if(list.length>120){const tr=el('tr');const td=el('td','blank',`表示は先頭120件です。全${list.length}件はレポートCSVに保存してください。`);td.colSpan=5;tr.append(td);tbody.append(tr);}
}
function refreshPreview(){const t=$('preview');t.replaceChildren();if(!state.result)return;const r=state.result;const head=el('thead'),hr=el('tr');r.rules.forEach(rule=>hr.append(el('th','',rule.name)));head.append(hr);t.append(head);const body=el('tbody');r.approvedRows.slice(0,5).forEach(row=>{const tr=el('tr');row.forEach(v=>tr.append(el('td','',v)));body.append(tr);});if(!r.approvedRows.length){const tr=el('tr'),td=el('td','blank',r.headerError?'見出しにエラーがあるため出力を停止しました':'受入可能行がありません');td.colSpan=Math.max(1,r.rules.length);tr.append(td);body.append(tr);}t.append(body);}
function runCheck(){try{
  if(!$('csvInput').value.trim())throw Error('CSVの本文を入力してください');
  if(new Blob([$('csvInput').value]).size>3*1024*1024)throw Error('CSVの上限は3MBです');
  const result=E.analyze($('csvInput').value,state.rules,getDelimiter());state.result=result;
  $('statTotal').textContent=result.summary.total.toLocaleString('ja-JP');$('statAccepted').textContent=result.summary.accepted.toLocaleString('ja-JP');$('statRejected').textContent=result.summary.rejected.toLocaleString('ja-JP');$('statIssues').textContent=`${result.summary.errors} / ${result.summary.warnings}`;
  const st=$('summary');const blocked=result.headerError;
  st.classList.toggle('warn',blocked || !!result.summary.errors);
  st.textContent=blocked?'見出し・列対応に問題があるためCSV書き出しを停止しました。指摘一覧を確認してください。':`${result.summary.total}行のうち${result.summary.accepted}行が受入可能です。${result.summary.rejected}行はエラーのため除外されます。警告のみの行は出力対象です。区切り: ${result.delimiter==='\t'?'タブ':result.delimiter}`;
  $('downloadValid').disabled=blocked||!result.approvedRows.length;$('downloadIssues').disabled=!result.issues.length;
  $('checkedAt').textContent='点検済み · 出力は点検時点の内容です';refreshIssues();refreshPreview();
  }catch(err){state.result=null;$('summary').textContent='点検できません: '+err.message;$('summary').classList.add('warn');$('downloadValid').disabled=true;$('downloadIssues').disabled=true;}
}
function download(text,name,mime='text/csv;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type:mime}));const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function readFile(file){if(!file)return;try{
  if(file.size>3*1024*1024)throw Error('3MBまでのCSVに対応します');state.bytes=new Uint8Array(await file.arrayBuffer());state.filename=file.name;
  loadDecoded();$('fileInfo').textContent=`${file.name} / ${Math.ceil(file.size/1024)}KB`;
  }catch(err){setStatus(err.message,true);}}
function loadDecoded(){if(!state.bytes)return;try{
  const x=E.decodeBytes(state.bytes,$('encoding').value);$('csvInput').value=x.text;
  setStatus(`読込: ${x.encoding} ／ ${x.loss||x.hasReplacement?'文字の置換が検出されました。原本の内容を確認してください。':'重大な復号エラーなし'}。推定に誤りがないか確認してください。`,x.loss||x.hasReplacement);
  markStale();autoMap();
 }catch(err){setStatus('復号できません: '+err.message,true);}}
function sample(){state.bytes=null;state.filename='sample.csv';$('csvInput').value=E.SAMPLE;$('fileInfo').textContent='検証用の架空商品データ';setStatus('サンプルはUTF-8の架空データです。誤った価格・日付、重複コード等が入っています。');autoMap();runCheck();}
$('sample').addEventListener('click',sample);
$('file').addEventListener('change',ev=>readFile(ev.target.files[0]));
$('encoding').addEventListener('change',()=>{if(state.bytes)loadDecoded();else setStatus('テキスト直接入力の場合、文字コード設定は適用されません。');});
$('delimiter').addEventListener('change',()=>{autoMap();markStale();});
$('csvInput').addEventListener('input',()=>{state.bytes=null;markStale();});
$('autoMap').addEventListener('click',autoMap);
$('addRule').addEventListener('click',()=>{if(state.rules.length>=60){alert('最大60列までです');return;}state.rules.push({name:'新しい列'+(state.rules.length+1),source:'',type:'text',required:false,unique:false,max:0,allowed:''});markStale();renderRules();});
$('exportRules').addEventListener('click',()=>{try{download(E.ruleJSON(state.rules),'ukeire-rules.json','application/json;charset=utf-8');}catch(err){alert(err.message);}});
$('importRules').addEventListener('change',async ev=>{try{const f=ev.target.files[0];if(!f)return;if(f.size>100000)throw Error('ルールJSONは100KBまでです');state.rules=E.importRuleJSON(await f.text());markStale();renderRules();}catch(err){alert('ルール読み込み失敗: '+err.message);}});
$('check').addEventListener('click',runCheck);
document.querySelectorAll('[data-filter]').forEach(n=>n.addEventListener('click',()=>{state.filter=n.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===n));refreshIssues();}));
$('downloadValid').addEventListener('click',()=>{const r=state.result;if(!r||r.headerError||!r.approvedRows.length)return;
  const output=E.toCSV(r.rules.map(x=>x.name),r.approvedRows,{bom:$('bom').checked,guardFormula:$('guard').checked});
  download(output,'ukeire-approved.csv');});
$('downloadIssues').addEventListener('click',()=>{if(state.result)download(E.issuesCSV(state.result.issues),'ukeire-findings.csv');});
renderRules();sample();
})();