/* IHON SHIORI / Textual Witness Comparison Engine (MIT) */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.IhonEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LIMIT = 160;
  const MAX_CHARS = 25000;
  const TYPES = ['原本画像の転記', '電子翻刻', '校訂本文', '翻訳', 'その他／未確認'];
  const STATUSES = ['未確認', '差異を記録', '原資料を再確認', '保留'];
  function validateText(t) {
    if (typeof t !== 'string' || t.length > MAX_CHARS) throw Error('本文は各25,000文字以内にしてください');
    const lines = t.replace(/\r\n?/g, '\n').split('\n');
    if (lines.length > LIMIT) throw Error('本文は各160行以内にしてください');
    return lines;
  }
  function normalize(t) {
    return String(t).normalize('NFKC').replace(/[\p{P}\p{Z}\s]/gu, '');
  }
  function rowKind(a,b) {
    if (a === null) return 'added';
    if (b === null) return 'removed';
    if (a === b) return 'same';
    if (normalize(a) === normalize(b)) return 'surface';
    return 'changed';
  }
  function substitutionCost(a,b) {
    if (a === b) return 0;
    if (normalize(a) === normalize(b)) return 0.25;
    const A=Array.from(a),B=Array.from(b);
    let p=0,s=0;
    while(p<A.length && p<B.length && A[p]===B[p])p++;
    while(s<A.length-p && s<B.length-p && A[A.length-1-s]===B[B.length-1-s])s++;
    const shared=(p+s)/Math.max(1,A.length,B.length);
    return 1.8 - 1.35*shared;
  }
  function align(textA,textB) {
    const a = validateText(textA), b = validateText(textB);
    const n=a.length,m=b.length, dp=Array.from({length:n+1},()=>new Float64Array(m+1)), op=Array.from({length:n+1},()=>new Uint8Array(m+1));
    for(let i=1;i<=n;i++){dp[i][0]=i;op[i][0]=2;}
    for(let j=1;j<=m;j++){dp[0][j]=j;op[0][j]=3;}
    for(let i=1;i<=n;i++) for(let j=1;j<=m;j++) {
      const pair=dp[i-1][j-1]+substitutionCost(a[i-1],b[j-1]);
      const del=dp[i-1][j]+1, ins=dp[i][j-1]+1;
      if(pair<=del && pair<=ins){dp[i][j]=pair;op[i][j]=1;}
      else if(del<=ins){dp[i][j]=del;op[i][j]=2;}
      else {dp[i][j]=ins;op[i][j]=3;}
    }
    const rows=[];let i=n,j=m;
    while(i>0||j>0){let A=null,B=null, ai=null,bi=null;
      const o=op[i][j];
      if(o===1){A=a[i-1];B=b[j-1];ai=i;bi=j;i--;j--;}
      else if(o===2){A=a[i-1];ai=i;i--;}
      else if(o===3){B=b[j-1];bi=j;j--;}
      else throw Error('比較処理に失敗しました');
      rows.push({a:A,b:B,ai,bi,kind:rowKind(A,B)});
    }
    rows.reverse();
    return rows.map((r,index)=>({...r,index,key:JSON.stringify([r.ai,r.bi,r.a,r.b])}));
  }
  function summary(rows,notes={}) {
    const v=rows.filter(r=>r.kind!=='same');
    return {rows:rows.length,variants:v.length, surface:v.filter(r=>r.kind==='surface').length,
      added:v.filter(r=>r.kind==='added').length,removed:v.filter(r=>r.kind==='removed').length,
      changed:v.filter(r=>r.kind==='changed').length,
      reviewed:v.filter(r=>notes[r.key]?.status && notes[r.key].status!=='未確認').length};
  }
  function charParts(a,b) {
    const A=Array.from(String(a)),B=Array.from(String(b));let p=0,s=0;
    while(p<A.length&&p<B.length&&A[p]===B[p])p++;
    while(s<A.length-p&&s<B.length-p&&A[A.length-1-s]===B[B.length-1-s])s++;
    return {a:[A.slice(0,p).join(''),A.slice(p,A.length-s).join(''),A.slice(A.length-s).join('')],
      b:[B.slice(0,p).join(''),B.slice(p,B.length-s).join(''),B.slice(B.length-s).join('')]};
  }
  function csvCell(value){let s=String(value??'');if(/^[\s\uFEFF]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
  function toCsv(rows,notes){const data=[['A行','B行','区分','A本文','B本文','判定','メモ']];for(const r of rows){if(r.kind==='same')continue;let z=notes[r.key]||{};data.push([r.ai??'',r.bi??'',r.kind,r.a??'',r.b??'',z.status||'未確認',z.note||'']);}return '\uFEFF'+data.map(row=>row.map(csvCell).join(',')).join('\r\n');}
  function mdText(v){return String(v??'').replace(/\\/g,'\\\\').replace(/([*_`\[\]<>])/g,'\\$1').replace(/\r?\n/g,' ');}
  function toMarkdown(project,rows){
    const a=project.metaA,b=project.metaB,notes=project.notes||{};
    const lines=['# 校異点検メモ','','※機械的な行対応は原本の同一性・優劣・史実を判定しません。',
      '',`- A: ${mdText(a.label)} / ${mdText(a.type)} / 参照: ${mdText(a.ref)}`,
      `- B: ${mdText(b.label)} / ${mdText(b.type)} / 参照: ${mdText(b.ref)}`,''];
    for(const r of rows){if(r.kind==='same')continue;const z=notes[r.key]||{};
      lines.push(`## 差異 ${r.index+1} (${r.kind})`,`- A ${r.ai===null?'—':'L'+r.ai}: ${mdText(r.a??'〔該当行なし〕')}`,
        `- B ${r.bi===null?'—':'L'+r.bi}: ${mdText(r.b??'〔該当行なし〕')}`,
        `- 状態: ${mdText(z.status||'未確認')}`,`- 注記: ${mdText(z.note||'')}`,'');
    }
    return lines.join('\n');
  }
  function validateProject(x){
    if(!x||typeof x!=='object'||x.version!==1||!x.metaA||!x.metaB)throw Error('対応するプロジェクト形式ではありません');
    validateText(x.textA); validateText(x.textB);
    const meta=(v)=>({label:String(v.label||'').slice(0,100),type:TYPES.includes(v.type)?v.type:TYPES[4],ref:String(v.ref||'').slice(0,300)});
    const rows=align(x.textA,x.textB);const allowed=new Set(rows.map(r=>r.key));let notes={};
    if(x.notes&&typeof x.notes==='object')for(const [key,v] of Object.entries(x.notes)){
      if(allowed.has(key)&&v&&typeof v==='object')notes[key]={status:STATUSES.includes(v.status)?v.status:STATUSES[0],note:String(v.note||'').slice(0,1500)};
    }
    return {version:1,metaA:meta(x.metaA),metaB:meta(x.metaB),textA:x.textA,textB:x.textB,notes};
  }
  function demo(){return validateProject({version:1,
    metaA:{label:'架空短編・初稿（デモ）',type:'電子翻刻',ref:'仮想資料 A／この例文はオリジナル'},
    metaB:{label:'架空短編・改稿（デモ）',type:'校訂本文',ref:'仮想資料 B／この例文はオリジナル'},
    textA:'駅前の灯が、ひとつ消えた。\n彼は地図を折り、橋へ向かった。\n時計は午後六時を指していた。\n雨が上がると、街は静かになった。\n彼女は手紙を机に置いた。',
    textB:'駅前の灯がひとつ消えた。\n彼は地図を開き、橋へ向かった。\n雨が上がると、街は静かになった。\n彼女は手紙を窓辺に置いた。\n窓の外では汽笛が鳴った。',notes:{}});}
  return {LIMIT,MAX_CHARS,TYPES,STATUSES,align,summary,normalize,charParts,csvCell,toCsv,toMarkdown,validateText,validateProject,demo};
});
