/* YOHAKU LABEL — pure layout engine, MIT License. No network dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.YohakuEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LIMITS = { maxItems: 60, maxLabels: 2400, maxPages: 100, maxSlots: 600 };
  const PAPER = { A4: [210, 297], letter: [215.9, 279.4] };
  function integer(v) { return Number.isInteger(Number(v)) && Number.isFinite(Number(v)); }
  function number(v) { return Number(v); }
  function parseSkipped(input, slots) {
    const out = new Set();
    const raw = String(input || '').trim();
    if (!raw) return { skipped: out, errors: [] };
    const errors = [];
    for (const token of raw.split(/[、,\s]+/).filter(Boolean)) {
      const match = /^(\d+)(?:\s*[-〜~]\s*(\d+))?$/.exec(token);
      if (!match) { errors.push(`使用済み位置「${token}」は 1-3,7 の形式で指定してください。`); continue; }
      const from = Number(match[1]); const to = match[2] ? Number(match[2]) : from;
      if (from < 1 || to < from || to > slots) {
        errors.push(`使用済み位置「${token}」は1〜${slots}の範囲にしてください。`); continue;
      }
      for (let i = from; i <= to; i++) out.add(i);
    }
    return { skipped: out, errors };
  }
  function compressSkipped(numbers) {
    const values = [...new Set(numbers)].sort((a,b)=>a-b).filter(n=>Number.isInteger(n)&&n>0);
    const parts=[];
    for(let i=0;i<values.length;i++){
      const a=values[i];let b=a;
      while (i+1<values.length && values[i+1]===b+1) b=values[++i];
      parts.push(a===b?String(a):`${a}-${b}`);
    }
    return parts.join(',');
  }
  function sequence(items, mode) {
    const result = [];
    if (mode === 'round') {
      const left = items.map(item=>item.qty);
      while (left.some(n=>n>0)) {
        for (let i=0;i<items.length;i++) if (left[i]>0) {result.push(i);left[i]--;}
      }
    } else {
      items.forEach((item,i)=>{for(let j=0;j<item.qty;j++)result.push(i);});
    }
    return result;
  }
  function plan(config, inputItems) {
    const errors=[];
    const paper=PAPER[config.paper];
    if (!paper) errors.push('用紙を選択してください。');
    const landscape = Boolean(config.landscape);
    const [pw, ph] = paper || PAPER.A4;
    const pageWidth = landscape ? ph : pw; const pageHeight = landscape ? pw : ph;
    const labelW=number(config.labelW),labelH=number(config.labelH),gapX=number(config.gapX),gapY=number(config.gapY),marginX=number(config.marginX),marginY=number(config.marginY);
    for (const [name,value,min,max] of [['横幅',labelW,12,200],['高さ',labelH,12,200],['横間隔',gapX,0,30],['縦間隔',gapY,0,30],['左右余白',marginX,0,50],['上下余白',marginY,0,50]]) {
      if (!Number.isFinite(value)||value<min||value>max) errors.push(`${name}は${min}〜${max} mmで設定してください。`);
    }
    const list=Array.isArray(inputItems)?inputItems:[];
    if (list.length>LIMITS.maxItems) errors.push(`品目は${LIMITS.maxItems}件までです。`);
    const items=list.map((it,i)=>({name:String(it.name||'').trim().slice(0,80),note:String(it.note||'').trim().slice(0,120),qty:Number(it.qty),color:/^#[0-9a-fA-F]{6}$/.test(it.color||'')?it.color:'#64748b'}));
    for (let i=0;i<items.length;i++) {
      if (!items[i].name) errors.push(`${i+1}番の品名を入力してください。`);
      if (!integer(items[i].qty)||items[i].qty<0||items[i].qty>LIMITS.maxLabels) errors.push(`${i+1}番の枚数は0〜${LIMITS.maxLabels}の整数にしてください。`);
    }
    const total=items.reduce((s,it)=>s+ (Number.isFinite(it.qty)&&it.qty>=0?it.qty:0),0);
    if (total>LIMITS.maxLabels) errors.push(`合計枚数は${LIMITS.maxLabels}枚までです。`);
    if (total===0) errors.push('1枚以上のラベルを設定してください。');
    const usableW=pageWidth-2*marginX,usableH=pageHeight-2*marginY;
    const cols=Number.isFinite(labelW+gapX)&&labelW+gapX>0 ? Math.max(0,Math.floor((usableW+gapX+1e-7)/(labelW+gapX))) : 0;
    const rows=Number.isFinite(labelH+gapY)&&labelH+gapY>0 ? Math.max(0,Math.floor((usableH+gapY+1e-7)/(labelH+gapY))) : 0;
    const slots=cols*rows;
    if (!slots) errors.push('用紙にラベルが1枚も収まりません。サイズと余白を調整してください。');
    if (slots>LIMITS.maxSlots) errors.push('1シートの面数が多すぎます。ラベルサイズを大きくしてください。');
    const parsed=parseSkipped(config.skip||'', slots);
    errors.push(...parsed.errors);
    if (parsed.skipped.size>=slots && slots>0) errors.push('最初のシートの全位置が使用済みです。');
    if (errors.length) return {ok:false,errors,cols,rows,slots,skipped:[...parsed.skipped],pageWidth,pageHeight};
    const order=sequence(items,config.mode==='round'?'round':'group');
    const pageCount=Math.ceil((total+parsed.skipped.size)/slots);
    if (pageCount>LIMITS.maxPages) return {ok:false,errors:[`ページ数は${LIMITS.maxPages}枚までです。`],cols,rows,slots,pageWidth,pageHeight};
    const pages=[];let cursor=0;
    for(let pageIndex=0;pageIndex<pageCount;pageIndex++) {
      const cells=[];
      for(let slot=1;slot<=slots;slot++) {
        const isSkipped=pageIndex===0&&parsed.skipped.has(slot);
        const sku=isSkipped||cursor>=order.length ? null : order[cursor++];
        cells.push({slot,sku,skipped:isSkipped,col:(slot-1)%cols,row:Math.floor((slot-1)/cols),
          x:marginX+((slot-1)%cols)*(labelW+gapX),y:marginY+Math.floor((slot-1)/cols)*(labelH+gapY)});
      }
      pages.push({number:pageIndex+1,cells,used:cells.filter(c=>c.sku!==null).length});
    }
    return {ok:true,errors:[],pageWidth,pageHeight,labelW,labelH,gapX,gapY,marginX,marginY,cols,rows,slots,pages,total,items,skipped:[...parsed.skipped].sort((a,b)=>a-b),unused:pageCount*slots-total-parsed.skipped.size,
      utilized:Math.round(100*total/(pageCount*slots-parsed.skipped.size))};
  }
  function toCSV(layout){
    if(!layout.ok) return '';
    const esc=x=>'"'+String(x).replace(/"/g,'""')+'"';
    const out=['sheet,position,item,subtitle'];
    for(const p of layout.pages)for(const c of p.cells)if(c.sku!==null){const item=layout.items[c.sku];out.push([p.number,c.slot,item.name,item.note].map(esc).join(','));}
    return '\ufeff'+out.join('\r\n')+'\r\n';
  }
  return {plan,parseSkipped,compressSkipped,sequence,toCSV,PAPER,LIMITS};
});