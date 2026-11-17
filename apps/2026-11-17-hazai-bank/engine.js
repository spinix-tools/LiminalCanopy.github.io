/* 端材バンク — deterministic offline 1D cutting-plan engine; MIT License */
(function(root, factory) {
  const lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else root.HazaiEngine = lib;
})(typeof globalThis === 'object' ? globalThis : this, function() {
  'use strict';
  const MAX_BARS = 120;
  const MAX_PIECES = 300;
  const MAX_LENGTH = 100000;
  const integer = (x, min, max, label) => {
    const n = Number(x);
    if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`${label} は ${min}〜${max} の整数で入力してください`);
    return n;
  };
  const plain = (x, fallback) => typeof x === 'string' ? x.trim().slice(0, 80) || fallback : fallback;
  function normalized(input) {
    if (!input || !Array.isArray(input.stock) || !Array.isArray(input.cuts)) throw new Error('在庫と必要部材の配列が必要です');
    const kerf = integer(input.kerf ?? 3, 0, 50, '刃幅');
    const trim = integer(input.trim ?? 0, 0, 100, '端切り');
    const minOffcut = integer(input.minOffcut ?? 200, 1, MAX_LENGTH, '再利用下限');
    const stock = input.stock.map((v,i) => ({
      id: plain(v.id, `s${i}`), label: plain(v.label, `材 ${i + 1}`),
      length: integer(v.length, 1, MAX_LENGTH, '在庫長'),
      qty: integer(v.qty, 1, MAX_BARS, '在庫本数'),
      kind: v.kind === 'offcut' ? 'offcut' : 'new'
    }));
    const cuts = input.cuts.map((v,i) => ({
      id: plain(v.id, `p${i}`), label: plain(v.label, `部材 ${i + 1}`),
      length: integer(v.length, 1, MAX_LENGTH, '部材長'),
      qty: integer(v.qty, 1, MAX_PIECES, '部材数')
    }));
    if (new Set(stock.map(v=>v.id)).size !== stock.length || new Set(cuts.map(v=>v.id)).size !== cuts.length) throw new Error('IDが重複しています');
    if (stock.reduce((s,v)=>s+v.qty, 0) > MAX_BARS) throw new Error(`在庫は合計${MAX_BARS}本以内にしてください`);
    if (cuts.reduce((s,v)=>s+v.qty, 0) > MAX_PIECES) throw new Error(`部材は合計${MAX_PIECES}個以内にしてください`);
    if (!stock.length || !cuts.length) throw new Error('在庫と必要部材を1行以上登録してください');
    if (stock.some(v=>v.length - 2*trim < 0)) throw new Error('端切りの合計が在庫長を超えています');
    return {stock,cuts,kerf,trim,minOffcut};
  }
  function plan(input) {
    const data = normalized(input);
    let sequence = 0;
    const available = data.stock.flatMap(v => Array.from({length:v.qty}, (_,k)=>({
      key:`${v.id}:${k + 1}`, stockId:v.id, label:v.label, kind:v.kind, length:v.length,
      available:v.length - 2*data.trim, used:0, parts:[]
    })));
    const parts = data.cuts.flatMap(v => Array.from({length:v.qty}, (_,k)=>({
      key:`${v.id}:${k+1}`, cutId:v.id, label:v.label, length:v.length,
      required:v.length+data.kerf, index:sequence++
    }))).sort((a,b)=>b.required-a.required || a.index-b.index);
    const opened = [];
    const missing = [];
    for (const piece of parts) {
      // Use already opened bar when possible (best remaining fit).
      const reused = opened.filter(v => v.available-v.used >= piece.required)
          .sort((a,b)=>(a.available-a.used)-(b.available-b.used) || a.key.localeCompare(b.key))[0];
      let bar = reused;
      if (!bar) {
        // Opening a remnant precedes opening a full-length stick; prefer tighter fit in each category.
        const next = available.filter(v=>v.available>=piece.required)
          .sort((a,b)=>(a.kind==='offcut'?0:1)-(b.kind==='offcut'?0:1) || (a.available-piece.required)-(b.available-piece.required) || a.key.localeCompare(b.key))[0];
        if (next) {
          available.splice(available.indexOf(next),1);
          opened.push(next);
          bar=next;
        }
      }
      if (!bar) { missing.push(piece); continue; }
      bar.parts.push(piece);
      bar.used+=piece.required;
    }
    const bars=opened.map(v => {
      const rem=v.available-v.used;
      return {
        key:v.key, stockId:v.stockId, label:v.label, kind:v.kind, length:v.length,
        usable:v.available, used:v.used, leftover:rem,
        reusable: rem>=data.minOffcut,
        parts:v.parts.map(p=>({key:p.key,cutId:p.cutId,label:p.label,length:p.length})),
        cuts:v.parts.length
      };
    });
    const usedStock = Object.create(null);
    for (const v of bars) usedStock[v.stockId]=(usedStock[v.stockId]||0)+1;
    const totalPart=bars.reduce((n,v)=>n+v.parts.reduce((s,p)=>s+p.length,0),0);
    const totalStock=bars.reduce((n,v)=>n+v.length,0);
    const saved=bars.filter(v=>v.reusable).reduce((n,v)=>n+v.leftover,0);
    const waste=totalStock-totalPart-saved;
    return {
      ...data, bars, missing:missing.map(p=>({key:p.key,cutId:p.cutId,label:p.label,length:p.length})),
      usedStock, totalPart, totalStock, saved, waste,
      yieldRatio:totalStock ? totalPart/totalStock : 0,
      complete:missing.length===0,
      unusedCount:available.length,
      method:'長い部材から順に、開封済み最小余地→端材優先で新規開封するヒューリスティック（最適解の保証なし）'
    };
  }
  function settle(state, result, nowISO) {
    if (!result || !result.complete || !result.bars?.length) throw new Error('全件割付済みの計画だけ在庫へ反映できます');
    const snapshot = JSON.parse(JSON.stringify(state));
    const before = normalized(state);
    const remaining=before.stock.map(v=>({...v,qty:v.qty-(result.usedStock[v.id]||0)})).filter(v=>v.qty>0);
    const offcuts=result.bars.filter(v=>v.reusable).map((v,i)=>({
      id:`off-${Date.now()}-${i}`, label:`${v.label} の端材`,length:v.leftover,qty:1,kind:'offcut'
    }));
    const next={...snapshot, stock:[...remaining,...offcuts], cuts:[], undo:snapshot,
      lastReceipt:{at:nowISO || new Date().toISOString(), consumed:result.bars.length, produced:offcuts.length,
        parts:result.bars.reduce((s,v)=>s+v.parts.length,0)}};
    if (next.stock.reduce((s,v)=>s+v.qty,0)>MAX_BARS) throw new Error('端材反映後の在庫が上限を超えます。必要なら下限を上げてください');
    return next;
  }
  function csvCell(v) { let s=String(v??''); if (/^\s*[=+@-]/.test(s)) s="'"+s; return /[",\r\n]/.test(s) ? `"${s.replace(/"/g,'""')}"`:s; }
  function csv(result) {
    const rows=[['材料','在庫ID','由来','材料長mm','部材','部材長mm','端材長mm','判定']];
    for(const bar of result.bars) {
      bar.parts.forEach((part,i)=>rows.push([bar.label,bar.key,bar.kind,bar.length,part.label,part.length,i===0?bar.leftover:'',i===0?(bar.reusable?'再利用':'スクラップ'):'']));
    }
    for(const piece of result.missing) rows.push(['','', '', '',piece.label,piece.length,'','未割付']);
    return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
  }
  return {plan,normalized,settle,csv};
});
