/* きりしろ — browser + Node, no dependencies. 1D heuristic, not an exact solver. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KIRISHIRO = api;
})(typeof globalThis === 'object' ? globalThis : this, function() {
  'use strict';
  const MAX_PARTS = 250, MAX_BARS = 150;
  const num = (v) => typeof v === 'string' && v.trim() === '' ? NaN : Number(v);
  const strict = (v, label, min, max, integer = false) => {
    const n = num(v);
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw new Error(label + ' は ' + min + '〜' + max + (integer ? ' の整数' : '') + 'で入力してください');
    return n;
  };
  const round = n => Math.round(n * 1000) / 1000;
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('プロジェクトの形式が正しくありません');
    const project = {
      title: String(raw.title || 'マイ木取り計画').slice(0, 80),
      kerf: strict(raw.kerf, '刃厚', 0, 20),
      trim: strict(raw.trim, '端面の余裕', 0, 60),
      minKeep: strict(raw.minKeep, '保存する端材の最低長', 0, 2000),
      cutFee: strict(raw.cutFee, '1カットの加工費', 0, 100000),
      parts: [], offcuts: [], products: []
    };
    if (!Array.isArray(raw.parts) || raw.parts.length < 1 || raw.parts.length > 50) throw new Error('部材は1〜50行必要です');
    if (!Array.isArray(raw.offcuts) || raw.offcuts.length > 40) throw new Error('手持ち材は40行以内にしてください');
    if (!Array.isArray(raw.products) || raw.products.length < 1 || raw.products.length > 20) throw new Error('購入候補は1〜20行必要です');
    let partCount = 0, offcutCount = 0;
    raw.parts.forEach((x, i) => {
      const label = String(x.label || '部材' + (i+1)).trim().slice(0, 60) || '部材' + (i+1);
      const length = strict(x.length, '部材 ' + label + ' の長さ', 1, 100000);
      const qty = strict(x.qty, '部材 ' + label + ' の本数', 1, 100, true);
      partCount += qty;
      project.parts.push({ label, length, qty });
    });
    raw.offcuts.forEach((x, i) => {
      const label = String(x.label || '手持ち' + (i+1)).trim().slice(0, 60) || '手持ち' + (i+1);
      const length = strict(x.length, '手持ち材の長さ', 1, 100000);
      const qty = strict(x.qty, '手持ち材の本数', 0, 100, true);
      offcutCount += qty;
      project.offcuts.push({ label, length, qty });
    });
    raw.products.forEach((x, i) => {
      const label = String(x.label || '購入候補' + (i+1)).trim().slice(0, 60) || '購入候補' + (i+1);
      project.products.push({ label, length: strict(x.length, '購入候補の長さ', 1, 100000), price: strict(x.price, '1本の価格', 0, 1000000) });
    });
    if (partCount > MAX_PARTS) throw new Error('総部材数は250本以内で入力してください');
    if (offcutCount > MAX_BARS) throw new Error('手持ち材は150本以内で入力してください');
    const longest = Math.max(...project.offcuts.map(x=>x.length), ...project.products.map(x=>x.length));
    const impossible = project.parts.find(x=>x.length + project.kerf + 2*project.trim > longest + 1e-8);
    if (impossible) throw new Error('「' + impossible.label + '」を切り出せる長さの材料がありません（刃厚・端面の余裕を含む）');
    return project;
  }
  function run(project, variant) {
    let all = [];
    project.parts.forEach((p, i) => { for (let q=0; q<p.qty; q++) all.push({label:p.label, length:p.length, key:i + '-' + q}); });
    const order = variant % 3;
    if (order === 0) all.sort((a,b)=>b.length-a.length || a.key.localeCompare(b.key));
    else if (order === 1) all.sort((a,b)=>a.length-b.length || a.key.localeCompare(b.key));
    else all.sort((a,b)=>b.length-a.length || a.key.localeCompare(b.key));
    if (order === 2) { const a=all.slice(); all=[]; while(a.length) { all.push(a.shift()); if(a.length) all.push(a.pop()); } }
    let unopened=[];
    project.offcuts.forEach((p, i)=>{for(let q=0;q<p.qty;q++) unopened.push({source:'offcut',label:p.label,length:p.length,price:0, id:'o-'+i+'-'+q});});
    const bins=[];
    const enough=(b,p)=>b.left+1e-8>=p.length+project.kerf;
    const newbin=(base)=>({source:base.source, label:base.label,length:base.length,price:base.price,id:base.id||'n-'+bins.length,left:base.length-2*project.trim,pieces:[]});
    const chooseExisting=(p)=>{
      const opts=bins.filter(b=>enough(b,p));
      opts.sort((a,b)=> variant % 2===0 ? a.left-b.left : b.left-a.left);
      return opts[0];
    };
    for (const part of all) {
      let bin = chooseExisting(part);
      if (!bin) {
        const fits = unopened.filter(x=>x.length-2*project.trim+1e-8>=part.length+project.kerf);
        if (fits.length) {
          fits.sort((a,b)=>variant%4 < 2 ? a.length-b.length : b.length-a.length);
          const selected=fits[0];
          unopened.splice(unopened.indexOf(selected),1);
          bin=newbin(selected);
        } else {
          const candidates = project.products.filter(x=>x.length-2*project.trim+1e-8>=part.length+project.kerf);
          if (!candidates.length) return null;
          const mode = variant % 6;
          candidates.sort((a,b)=>{
            const score = (x) => mode===0||mode===1 ? x.price : mode===2||mode===3 ? x.price/x.length : mode===4 ? x.length : -x.length;
            return score(a)-score(b) || a.price-b.price || a.length-b.length;
          });
          bin=newbin({...candidates[0],source:'purchase'});
        }
        bins.push(bin);
      }
      bin.pieces.push({label:part.label,length:part.length});
      bin.left=round(bin.left-part.length-project.kerf);
    }
    const buy = bins.filter(x=>x.source==='purchase');
    const buyTotal = round(buy.reduce((s,x)=>s+x.price,0));
    const cutCount = bins.reduce((s,x)=>s+x.pieces.length,0);
    const cutCost = round(cutCount*project.cutFee);
    const partLength = round(bins.reduce((s,x)=>s+x.pieces.reduce((t,p)=>t+p.length,0),0));
    const bladeLoss = round(project.kerf*cutCount);
    const trimLoss = round(project.trim*2*bins.length);
    const usable = round(bins.reduce((s,x)=>s+(x.left>=project.minKeep?x.left:0),0));
    const scrap = round(bins.reduce((s,x)=>s+(x.left>=project.minKeep?0:x.left),0));
    const totalLength=round(bins.reduce((s,x)=>s+x.length,0));
    return { bins:bins.map(({source,label,length,price,left,pieces,id})=>({source,label,length,price,left,pieces,id})),
      partCount:cutCount,partLength,buyCount:buy.length,buyTotal,cutCost,totalCost:round(buyTotal+cutCost),
      bladeLoss,trimLoss, usable, scrap,unusedOffcut:unopened.length,totalLength,
      efficiency:totalLength?round(100*partLength/totalLength):0,variant};
  }
  const rank = p => [p.totalCost,p.scrap,p.totalLength,p.buyCount];
  function bestPlan(raw) {
    const project=normalize(raw);
    const plans=[];
    for(let k=0;k<12;k++) { const p=run(project,k); if(p) plans.push(p); }
    if(!plans.length) throw new Error('計画を作れませんでした。購入候補の長さをご確認ください');
    plans.sort((a,b)=>{
      const aa=rank(a),bb=rank(b);
      for(let i=0;i<aa.length;i++) if(aa[i]!==bb[i]) return aa[i]-bb[i];
      return a.variant-b.variant;
    });
    const chosen=plans[0];
    const other=plans[plans.length-1];
    return {project,plan:chosen, alternativesTried:plans.length,range:{lowestCost:chosen.totalCost,highestCost:other.totalCost},algorithm:'12パターンの逐次詰め込み探索（最適解保証なし）'};
  }
  function summary(result) {
    const {project,plan}=result;
    const lines=[`# ${project.title} — きりしろ切断計画`, `材料費 ¥${plan.buyTotal.toLocaleString('ja-JP')} / 加工費 ¥${plan.cutCost.toLocaleString('ja-JP')} / 計 ¥${plan.totalCost.toLocaleString('ja-JP')}`, `購入 ${plan.buyCount} 本 / 手持ち活用 ${plan.bins.length-plan.buyCount} 本 / 部材 ${plan.partCount} 本`, `刃厚 ${project.kerf}mm / 端面の余裕 ${project.trim}mm×両端 / 保存する端材 ${project.minKeep}mm以上`, '', '切断計画（数値はmm）'];
    plan.bins.forEach((b,i)=>{lines.push(`${i+1}. ${b.source==='offcut'?'手持ち':'購入'} ${b.label} ${b.length}mm${b.source==='purchase'?' ¥'+b.price:''}`); b.pieces.forEach((p,j)=>lines.push(`   ${j+1}) ${p.label} ${p.length}mm + 刃厚 ${project.kerf}mm`));lines.push(`   残り ${b.left}mm${b.left >= project.minKeep?'（保管候補）':'（端材基準未満）'}`)});
    lines.push('', '※1次元・同一材質/断面・直角切りのみ。各部材ごとに刃厚1回を保守的に計上しています。','※ヒューリスティック計画のため最適解を保証しません。実際の加工前に寸法・素材と機械安全を確認してください。');
    return lines.join('\n');
  }
  function toCSV(result) {
    const data=[['材料番号','種別','材料名','元材長mm','カット順','部材名','部材長mm','刃厚mm','残材mm']];
    result.plan.bins.forEach((b,i)=>b.pieces.forEach((p,j)=>data.push([i+1,b.source==='offcut'?'手持ち':'購入',b.label,b.length,j+1,p.label,p.length,result.project.kerf,j===b.pieces.length-1?b.left:''])));
    const q=x=>{let t=String(x);if(/^[=+\-@\t\r]/.test(t)) t="\u0027"+t;return '"'+t.replace(/"/g,'""')+'"';};
    return '\ufeff'+data.map(row=>row.map(q).join(',')).join('\r\n');
  }
  return {normalize,bestPlan,summary,toCSV};
});