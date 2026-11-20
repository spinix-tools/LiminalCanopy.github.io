/* SURIWAKE GRAPH — dependency-free rendering and validation engine. MIT License. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Suriwake = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_CATEGORIES = 16, MAX_SERIES = 6, MAX_VALUE = 1000000000;
  const PALETTE = ['#a9c4ef', '#f7bb7d', '#99d6bc', '#d6b9ee', '#e8cd66', '#b9c8ca'];
  const PATTERNS = ['斜線', 'ドット', '縦線', '格子', '横線', '波線'];
  const sample = () => ({
    version: 1, title: '地区イベントの来場手段（架空データ）', note: '資料用サンプル・架空の数値',
    mode: 'grouped', monochrome: true,
    series: ['春', '秋'],
    categories: [
      { label: '徒歩', values: [45, 58] }, { label: '自転車', values: [32, 24] },
      { label: '公共交通', values: [52, 61] }, { label: '自家用車', values: [28, 22] },
    ],
  });
  const escapeXml = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
  const validLabel = v => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 60;
  const validValue = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_VALUE;
  const validNumberString = v => typeof v === 'string' && /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(v.trim()) && validValue(Number(v));
  function validate(model) {
    const errors = [], warnings = [];
    if (!model || typeof model !== 'object' || Array.isArray(model)) return {errors:['プロジェクト形式が不正です'], warnings};
    if (!validLabel(model.title) || model.title.length > 100) errors.push('タイトルを1〜60文字で入力してください');
    if (typeof model.note !== 'string' || model.note.length > 180) errors.push('注記は180文字以内にしてください');
    if (!['grouped','stacked'].includes(model.mode)) errors.push('グラフ形式が不正です');
    if (typeof model.monochrome !== 'boolean') errors.push('表示方式が不正です');
    if (!Array.isArray(model.series) || model.series.length < 1 || model.series.length > MAX_SERIES) errors.push('系列数は1〜6件にしてください');
    if (!Array.isArray(model.categories) || model.categories.length < 1 || model.categories.length > MAX_CATEGORIES) errors.push('項目数は1〜16件にしてください');
    if (errors.length) return {errors, warnings};
    model.series.forEach((s, i) => { if (!validLabel(s)) errors.push(`系列${i+1}の名称が不正です`); });
    const uniq = xs => new Set(xs.map(s => String(s).trim())).size === xs.length;
    if (!uniq(model.series)) warnings.push('系列名が重複しています。区別しやすい名前を付けてください');
    model.categories.forEach((c, i) => {
      if (!c || !validLabel(c.label)) errors.push(`項目${i+1}の名称が不正です`);
      if (!c || !Array.isArray(c.values) || c.values.length !== model.series.length || c.values.some(v => !validValue(v))) errors.push(`項目${i+1}の数値は0以上10億以下の有限数にしてください`);
    });
    if (model.categories.every(c => c && Array.isArray(c.values) && c.values.every(v => v === 0))) warnings.push('すべて0です。図の棒は表示されません');
    if (model.categories.every(c => c && validLabel(c.label)) && !uniq(model.categories.map(c=>c.label))) warnings.push('項目名が重複しています');
    if (model.series.length >= 5) warnings.push('系列が多いため、印刷時に凡例・模様を判別できるか試し刷りしてください');
    if (model.mode === 'stacked' && model.categories.some(c => c && Array.isArray(c.values) && c.values.some(v=>v>0 && v<5))) warnings.push('小さな積上げ区間には数値を直接表示できないことがあります。下の数値表も併記してください');
    return { errors, warnings };
  }
  function parseCSV(raw) {
    if (typeof raw !== 'string' || raw.length > 150000) throw new Error('CSVが大きすぎます（150KB以内）');
    const s = raw.replace(/^\uFEFF/, ''), rows=[];
    let row=[], field='', quote=false, afterQuote=false;
    for (let i=0;i<s.length;i++) {
      const ch=s[i];
      if (quote) { if(ch==='"') { if(s[i+1]==='"') { field+='"';i++; } else { quote=false;afterQuote=true; } } else field+=ch; }
      else if (ch==='"' && !afterQuote && field==='') quote=true;
      else if (ch===',') {row.push(field);field='';afterQuote=false;}
      else if (ch==='\n'||ch==='\r') { if(ch==='\r'&&s[i+1]==='\n')i++; row.push(field); rows.push(row);row=[];field='';afterQuote=false;}
      else if (afterQuote) { if(ch!==' '&&ch!=='\t')throw new Error('引用符の後に不正な文字があります'); }
      else { if(ch==='"')throw new Error('CSVの引用符が不正です');field+=ch; }
    }
    if (quote) throw new Error('CSVの引用符が閉じていません');
    if (field!==''||row.length) {row.push(field);rows.push(row);}
    while (rows.length && rows.at(-1).every(x=>x===''))rows.pop();
    return rows;
  }
  function toModelFromCSV(raw, base=sample()) {
    const rows=parseCSV(raw);
    if (rows.length<2) throw new Error('見出しと1行以上の数値が必要です');
    const cols=rows[0].length;
    if (cols<2||cols>MAX_SERIES+1) throw new Error('項目列＋1〜6系列が必要です');
    if (rows.length-1>MAX_CATEGORIES) throw new Error('項目は16件以下にしてください');
    if (rows.some((r)=>r.length!==cols)) throw new Error('CSVの列数が揃っていません');
    const model={version:1,title:base.title,note:base.note,mode:base.mode,monochrome:base.monochrome,
      series:rows[0].slice(1).map(x=>x.trim()),
      categories:rows.slice(1).map(r=>({label:r[0].trim(),values:r.slice(1).map(v=>{if(!validNumberString(v))throw new Error(`不正な数値: ${v.slice(0,25)}`);return Number(v);})}))};
    const check=validate(model);if(check.errors.length)throw new Error(check.errors.join(' / '));return model;
  }
  function csvCell(value, protect=true) {
    let s=String(value ?? '');
    if(protect && /^[\s\u0000-\u001f]*[=+@\-]/.test(s))s="'"+s;
    return /[,"\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
  }
  function toCSV(model) {
    const {errors}=validate(model); if(errors.length)throw new Error(errors.join('; '));
    return [ ['項目',...model.series].map(v=>csvCell(v)).join(','), ...model.categories.map(c=>[csvCell(c.label),...c.values.map(v=>csvCell(v,false))].join(',')) ].join('\r\n')+'\r\n';
  }
  const linear = u => {u=u/255;return u<=0.04045?u/12.92:Math.pow((u+0.055)/1.055,2.4);};
  function luminance(hex) {
    if(!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('カラーコードが不正です');
    const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
    return .2126*linear(rgb[0])+.7152*linear(rgb[1])+.0722*linear(rgb[2]);
  }
  const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  function niceCeil(n) {
    if(n<=0)return 1;
    const pow=Math.pow(10,Math.floor(Math.log10(n)));const v=n/pow;
    return (v<=1?1:v<=2?2:v<=2.5?2.5:v<=5?5:10)*pow;
  }
  function format(n){return Number(n).toLocaleString('ja-JP',{maximumFractionDigits:4});}
  const defs = [
    '<path d="M-2 8L8 -2M2 12L12 2" stroke="#182b37" stroke-width="1.8"/>',
    '<circle cx="3" cy="3" r="1.6" fill="#182b37"/>',
    '<path d="M4 0V8" stroke="#182b37" stroke-width="1.8"/>',
    '<path d="M4 0V8M0 4H8" stroke="#182b37" stroke-width="1.5"/>',
    '<path d="M0 4H8" stroke="#182b37" stroke-width="1.8"/>',
    '<path d="M0 5Q2 1 4 5T8 5" fill="none" stroke="#182b37" stroke-width="1.7"/>',
  ];
  function patternsSvg(n){return `<defs>${Array.from({length:n},(_,i)=>`<pattern id="sw-${i}" width="8" height="8" patternUnits="userSpaceOnUse">${defs[i]}</pattern>`).join('')}</defs>`;}
  function renderSvg(model) {
    const {errors}=validate(model); if(errors.length)throw new Error(errors.join('; '));
    const grouped=model.mode==='grouped', count=model.series.length;
    const rowH=grouped?Math.max(58, count*27+18):62;
    const W=980,H=210+model.categories.length*rowH, left=185, chartW=650, top=115;
    const maxData=Math.max(0,...model.categories.map(c=>grouped?Math.max(...c.values):c.values.reduce((a,b)=>a+b,0)));
    const axisMax=niceCeil(maxData), parts=[`<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="sw-title sw-desc" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
      `<title id="sw-title">${escapeXml(model.title)}</title><desc id="sw-desc">${escapeXml(model.note)}。項目${model.categories.length}、系列${count}。模様と文字で系列を識別する棒グラフ。</desc>`,
      `<rect width="${W}" height="${H}" fill="#ffffff"/>`,patternsSvg(count),
      `<text x="28" y="38" font-family="sans-serif" font-weight="700" fill="#1a2b36" font-size="23">${escapeXml(model.title)}</text>`,
      `<text x="28" y="66" font-family="sans-serif" fill="#526572" font-size="14">${escapeXml(model.note)}</text>`];
    for(let j=0;j<=4;j++){let x=left+j*chartW/4, val=axisMax*j/4;
      parts.push(`<line x1="${x}" y1="${top-17}" x2="${x}" y2="${top+rowH*model.categories.length}" stroke="#dbe2e6" stroke-width="1"/>`);
      parts.push(`<text x="${x}" y="${top-28}" font-family="sans-serif" font-size="13" text-anchor="middle" fill="#4c5b65">${format(val)}</text>`);
    }
    const shape=(x,y,w,h,k)=>{
      if(w<=0)return '';
      const b=model.monochrome?'#ffffff':PALETTE[k];
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${b}" stroke="#27343c" stroke-width="1"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sw-${k})"/>`;
    };
    model.categories.forEach((c,i)=>{
      const y=top+i*rowH;
      parts.push(`<text x="${left-13}" y="${y+(grouped?23:30)}" font-family="sans-serif" font-weight="650" font-size="16" text-anchor="end" fill="#263640">${escapeXml(c.label)}</text>`);
      if(i%2)parts.push(`<rect x="${left}" y="${y-8}" width="${chartW}" height="${rowH}" fill="#f7fafb" opacity="0.35"/>`);
      if(grouped)c.values.forEach((v,k)=>{
        const barY=y+k*27+1, width=(v/axisMax)*chartW;
        parts.push(shape(left,barY,width,20,k));
        const labelText=`${model.series[k]} ${format(v)}`;
        const labelX=Math.min(left+chartW+8,left+width+8);
        const anchor=labelX>left+chartW-90?'end':'start';
        const tx=anchor==='end'?W-24:labelX;
        parts.push(`<text x="${tx}" y="${barY+15}" font-family="sans-serif" font-size="12" fill="#1c2d35" text-anchor="${anchor}">${escapeXml(labelText)}</text>`);
      });
      else{
        let offset=0;
        const total=c.values.reduce((a,b)=>a+b,0);
        c.values.forEach((v,k)=>{
          const w=(v/axisMax)*chartW;
          parts.push(shape(left+offset,y+5,w,31,k));
          if(w>=44)parts.push(`<text x="${left+offset+w/2}" y="${y+25}" font-family="sans-serif" font-size="13" font-weight="700" text-anchor="middle" fill="#101820" stroke="#ffffff" stroke-width="3" paint-order="stroke">${escapeXml(format(v))}</text>`);
          offset+=w;
        });
        parts.push(`<text x="${Math.min(left+offset+8,left+chartW+8)}" y="${y+26}" font-family="sans-serif" font-size="13" fill="#17252e">合計 ${escapeXml(format(total))}</text>`);
      }
    });
    const legendY=top+rowH*model.categories.length+35;
    parts.push(`<line x1="25" y1="${legendY-24}" x2="955" y2="${legendY-24}" stroke="#d6dfe4"/>`);
    const legCount=Math.min(3,count);
    model.series.forEach((s,i)=>{
      const col=i%legCount,row=Math.floor(i/legCount),x=32+col*307,y=legendY+row*26;
      parts.push(shape(x,y-12,32,18,i),`<text x="${x+42}" y="${y+2}" font-size="14" fill="#293d47" font-family="sans-serif">${escapeXml(s)} · ${PATTERNS[i]}</text>`);
    });
    parts.push(`<text x="32" y="${H-19}" font-size="12" font-family="sans-serif" fill="#64717b">SURIWAKE GRAPH · 実際の印刷では必ず試し刷りを確認</text></svg>`);
    return parts.join('');
  }
  function safeImport(json){
    if(typeof json!=='string'||json.length>50000)throw new Error('JSONが大きすぎます');
    let model; try{model=JSON.parse(json);}catch{throw new Error('JSONの解析に失敗しました');}
    const {errors}=validate(model);if(errors.length)throw new Error(errors.join(' / '));
    return {version:1,title:model.title,note:model.note,mode:model.mode,monochrome:model.monochrome,series:[...model.series],categories:model.categories.map(c=>({label:c.label,values:[...c.values]}))};
  }
  return {MAX_CATEGORIES,MAX_SERIES,PALETTE,PATTERNS,sample,escapeXml,validate,parseCSV,toModelFromCSV,csvCell,toCSV,luminance,contrast,niceCeil,renderSvg,safeImport};
});
