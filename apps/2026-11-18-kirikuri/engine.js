/* KIRIKURI — offline 1D cutting planner. MIT License. No network calls. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KiriEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_PIECES = 220;
  const MAX_OFFCUTS = 160;
  const cleanName = (v, fallback) => String(v == null ? '' : v).trim().slice(0, 70) || fallback;
  function integer(v, label, min, max) {
    if (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) || !Number.isInteger(Number(v))) {
      throw Error(label + ' は整数で入力してください');
    }
    const n = Number(v);
    if (n < min || n > max) throw Error(label + ' は ' + min + '〜' + max + ' の範囲で入力してください');
    return n;
  }
  function validateProject(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('プロジェクト形式が不正です');
    const project = {
      title: cleanName(raw.title, '無題の切断計画'),
      kerf: integer(raw.kerf, '刃幅', 0, 20),
      trim: integer(raw.trim, '両端の切り落とし幅', 0, 100),
      keepMin: integer(raw.keepMin, '端材として残す最小長', 0, 10000),
      parts: [], offcuts: [], purchases: []
    };
    if (!Array.isArray(raw.parts) || raw.parts.length < 1 || raw.parts.length > 80) throw Error('部品の種類を1〜80件登録してください');
    if (!Array.isArray(raw.offcuts) || raw.offcuts.length > 80) throw Error('端材は80種類以内で登録してください');
    if (!Array.isArray(raw.purchases) || raw.purchases.length > 30) throw Error('購入候補は30種類以内で登録してください');
    let pieceTotal = 0;
    raw.parts.forEach((p, i) => {
      const x = {
        id: 'p' + i,
        name: cleanName(p.name, '部品' + (i + 1)),
        length: integer(p.length, '部品' + (i + 1) + 'の長さ', 1, 20000),
        qty: integer(p.qty, '部品' + (i + 1) + 'の数量', 1, MAX_PIECES)
      };
      pieceTotal += x.qty;
      project.parts.push(x);
    });
    if (pieceTotal > MAX_PIECES) throw Error('合計部品数は' + MAX_PIECES + '個以内にしてください');
    let offcutTotal = 0;
    raw.offcuts.forEach((s, i) => {
      const x = {
        id: 'o' + i, name: cleanName(s.name, '端材' + (i + 1)),
        length: integer(s.length, '端材' + (i + 1) + 'の長さ', 1, 30000),
        qty: integer(s.qty, '端材' + (i + 1) + 'の本数', 1, MAX_OFFCUTS)
      };
      offcutTotal += x.qty;
      project.offcuts.push(x);
    });
    if (offcutTotal > MAX_OFFCUTS) throw Error('端材の合計は' + MAX_OFFCUTS + '本以内にしてください');
    raw.purchases.forEach((s, i) => project.purchases.push({
      id: 'b' + i, name: cleanName(s.name, '購入材' + (i + 1)),
      length: integer(s.length, '購入材' + (i + 1) + 'の長さ', 1, 30000),
      price: integer(s.price, '購入材' + (i + 1) + 'の単価', 0, 10000000)
    }));
    if (project.offcuts.length === 0 && project.purchases.length === 0) throw Error('端材または購入材を1種類以上登録してください');
    const stock = [...project.offcuts, ...project.purchases];
    for (const p of project.parts) {
      if (!stock.some(s => s.length - 2 * project.trim >= p.length + project.kerf)) {
        throw Error('「' + p.name + '」' + p.length + 'mmが切り出せる材料がありません（刃幅と両端落としを含む）');
      }
    }
    return project;
  }
  function piecesFor(project, mode) {
    const pieces = [];
    project.parts.forEach((p, idx) => {
      for (let n = 1; n <= p.qty; n++) pieces.push({ partId:p.id, name:p.name, length:p.length, partIndex:idx, number:n });
    });
    if (mode === 0) pieces.sort((a,b) => b.length - a.length || a.partIndex - b.partIndex);
    if (mode === 1) pieces.sort((a,b) => a.length - b.length || a.partIndex - b.partIndex);
    if (mode === 2) {
      pieces.sort((a,b) => b.length - a.length || a.partIndex-b.partIndex);
      const ordered = [];
      while (pieces.length) { ordered.push(pieces.shift()); if (pieces.length) ordered.push(pieces.pop()); }
      return ordered;
    }
    if (mode === 3) pieces.sort((a,b) => a.partIndex - b.partIndex || a.number - b.number);
    return pieces;
  }
  function planAttempt(project, includeOffcuts, ordering, strategy) {
    const pieces = piecesFor(project, ordering);
    const unused = [];
    if (includeOffcuts) project.offcuts.forEach(s => {
      for (let n = 1; n <= s.qty; n++) unused.push({...s, serial:n});
    });
    const bins=[];
    const kerf=project.kerf, trim=project.trim;
    const capacity=(s)=>s.length-2*trim;
    for (let i=0;i<pieces.length;i++) {
      const part=pieces[i], req=part.length+kerf;
      const options=[];
      for (const bin of bins) if (bin.remaining >= req) {
        options.push({kind:'open', bin, remaining:bin.remaining-req});
      }
      for (let k=0;k<unused.length;k++) if (capacity(unused[k]) >= req) {
        options.push({kind:'offcut', source:unused[k], sourceIndex:k, remaining:capacity(unused[k])-req});
      }
      for (const stock of project.purchases) if (capacity(stock) >= req) {
        let projectedUsed = req;
        const tail = pieces.slice(i+1).sort((a,b)=>b.length-a.length);
        for (const item of tail) if (projectedUsed+item.length+kerf <= capacity(stock)) projectedUsed += item.length+kerf;
        options.push({kind:'buy', source:stock, remaining:capacity(stock)-req, projectedRemaining:capacity(stock)-projectedUsed});
      }
      if (!options.length) return null;
      for (const option of options) {
        let score=0;
        if (option.kind === 'open') score = -200000 + option.remaining * (strategy===1 ? 1 : .2);
        if (option.kind === 'offcut') score = -100000 + option.remaining * (strategy===1 ? 1 : .05);
        if (option.kind === 'buy') {
          if (strategy===0) score = option.source.price*5 + option.projectedRemaining*.7 + option.remaining*.02;
          if (strategy===1) score = option.source.price*3 + option.remaining*.8;
          if (strategy===2) score = option.source.price*2 + option.projectedRemaining*1.1;
          if (strategy===3) score = option.source.price*7 + option.projectedRemaining*.25;
        }
        option.score=score;
      }
      options.sort((a,b)=>a.score-b.score || a.remaining-b.remaining || (a.source?.length||0)-(b.source?.length||0));
      const best=options[0];
      let bin;
      if (best.kind==='open') bin=best.bin;
      else {
        const s=best.source;
        bin = {
          index: bins.length + 1, kind:best.kind, sourceId:s.id, sourceName:s.name,
          serial: best.kind==='offcut' ? s.serial : null,
          length:s.length, price: best.kind==='buy'?s.price:0,
          parts:[], remaining:capacity(s)
        };
        bins.push(bin);
        if (best.kind==='offcut') unused.splice(best.sourceIndex,1);
      }
      bin.parts.push(part);
      bin.remaining -= req;
    }
    const bought = bins.filter(b=>b.kind==='buy');
    const usedOffcuts=bins.filter(b=>b.kind==='offcut');
    const cost=bought.reduce((s,b)=>s+b.price,0);
    let scrap=0, retainedLength=0;
    for (const b of bins) {
      b.cutLoss = b.parts.length*kerf + 2*trim;
      b.retained = b.remaining>=project.keepMin && b.remaining>0 ? b.remaining : 0;
      b.scrap = b.cutLoss + (b.retained>0?0:b.remaining);
      scrap += b.scrap;
      retainedLength += b.retained;
    }
    return {
      bins, unusedOffcuts:unused, purchaseCost:cost, boughtCount:bought.length,
      usedOffcuts:usedOffcuts.length, retainedLength, scrap,
      partCount:pieces.length, finishedLength:pieces.reduce((s,p)=>s+p.length,0),
      method:{ordering,strategy}
    };
  }
  function quality(plan) {
    // Monetary cost has priority; reusable offcut use breaks close material ties.
    return [plan.purchaseCost, plan.scrap, plan.boughtCount, -plan.usedOffcuts, plan.bins.length];
  }
  function better(a,b) {
    if (!b) return true;
    const aq=quality(a),bq=quality(b);
    for (let i=0;i<aq.length;i++) if (aq[i]!==bq[i]) return aq[i]<bq[i];
    return false;
  }
  function search(project, includeOffcuts) {
    let winner=null;
    for (let order=0;order<4;order++) for (let strategy=0;strategy<4;strategy++) {
      const candidate=planAttempt(project, includeOffcuts, order, strategy);
      if (candidate && better(candidate,winner)) winner=candidate;
    }
    return winner;
  }
  function calculate(raw) {
    const project = validateProject(raw);
    const baseline = project.purchases.length ? search(project,false) : null;
    let best = search(project,true);
    if (!best && !baseline) throw Error('割付ができませんでした。購入できる規格材を追加してください');
    if (baseline && (!best || better(baseline,best))) {
      // A purchase-only winner must still preserve every untouched physical offcut.
      best={...baseline, unusedOffcuts:project.offcuts.flatMap(s=>
        Array.from({length:s.qty},(_,i)=>({...s,serial:i+1})))};
    }
    const result={project, best, baseline, savings:baseline?baseline.purchaseCost-best.purchaseCost:null};
    const check=verifyPlan(project,best);
    if (!check.ok) throw Error('内部整合性エラー: '+check.errors.join('、'));
    return result;
  }
  function verifyPlan(project,plan) {
    const errors=[];
    if (!plan) return {ok:false,errors:['計画がありません']};
    const wants=new Map();
    project.parts.forEach(p=>wants.set(p.id,p.qty));
    const usedOffcuts=new Map();
    for(const bin of plan.bins) {
      const source=(bin.kind==='offcut'?project.offcuts:project.purchases).find(s=>s.id===bin.sourceId);
      if (!source) errors.push('材料IDが無効');
      else if (source.length!==bin.length) errors.push('材料長が不一致');
      if (bin.kind==='offcut') usedOffcuts.set(bin.sourceId,(usedOffcuts.get(bin.sourceId)||0)+1);
      const total = project.trim*2 + bin.parts.reduce((n,p)=>n+p.length+project.kerf,0);
      if (total>bin.length) errors.push('材料の長さを超過: '+bin.index);
      if (total+bin.remaining!==bin.length) errors.push('余り寸法が不一致: '+bin.index);
      for(const item of bin.parts) wants.set(item.partId,(wants.get(item.partId)||0)-1);
    }
    for(const [key,n] of wants) if(n!==0) errors.push('部品数量が不一致: '+key);
    for(const s of project.offcuts) if((usedOffcuts.get(s.id)||0)>s.qty) errors.push('端材の使用本数が超過');
    const actualCost=plan.bins.filter(b=>b.kind==='buy').reduce((s,b)=>s+b.price,0);
    if (actualCost!==plan.purchaseCost) errors.push('金額が不一致');
    return {ok:errors.length===0,errors};
  }
  function carryForward(result) {
    const out=[];
    for(const offcut of result.best.unusedOffcuts) {
      out.push({name:offcut.name,length:offcut.length,qty:1});
    }
    for(const bin of result.best.bins) if(bin.retained>0) {
      out.push({name:'残材 '+bin.sourceName+' #'+bin.index,length:bin.retained,qty:1});
    }
    const grouped=new Map();
    out.forEach(s=>{
      const key=s.name+'\u0000'+s.length;
      if(grouped.has(key)) grouped.get(key).qty+=s.qty;
      else grouped.set(key,{...s});
    });
    return [...grouped.values()];
  }
  function parseCsv(text) {
    const rows=[], line=[];
    let field='',quoted=false;
    text=String(text).replace(/^\uFEFF/,'');
    if (text.length>65000) throw Error('CSVは65KB以内にしてください');
    for(let i=0;i<text.length;i++) {
      const ch=text[i];
      if(quoted) {
        if(ch==='"' && text[i+1]==='"') {field+='"';i++;}
        else if(ch==='"') quoted=false;
        else field+=ch;
      } else if(ch==='"' && field==='') quoted=true;
      else if(ch===',') {line.push(field);field='';}
      else if(ch==='\n') {line.push(field.replace(/\r$/,''));rows.push(line.splice(0));field='';}
      else field+=ch;
    }
    if(quoted) throw Error('CSVの引用符が閉じられていません');
    if(field!==''||line.length) {line.push(field.replace(/\r$/,''));rows.push(line);}
    return rows.filter(r=>r.some(c=>c.trim()!==''));
  }
  function importPartsCsv(text) {
    const rows=parseCsv(text);
    if(rows.length===0) throw Error('CSVが空です');
    const first=rows[0].map(s=>s.trim().toLowerCase());
    const hasHeader=first[0]==='name'||first[0]==='品名'||first[0]==='部品'||first[0]==='part';
    const body=hasHeader?rows.slice(1):rows;
    if(!body.length||body.length>80) throw Error('部品CSVは1〜80行で入力してください');
    return body.map((row,i)=>{
      if(row.length<3) throw Error((i+1)+'行目に「品名,長さ,数量」が必要です');
      return {name:cleanName(row[0],'部品'+(i+1)),length:integer(row[1],(i+1)+'行目の長さ',1,20000),qty:integer(row[2],(i+1)+'行目の数量',1,MAX_PIECES)};
    });
  }
  function csvCell(v) {
    let s=String(v??'');
    if (/^[=+@\-\t\r]/.test(s)) s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  }
  const csvLine = cells=>cells.map(csvCell).join(',');
  function exportCutCsv(result) {
    const rows=[['母材No','種類','母材名','元の長さmm','切断順','部品名','部品長mm','刃幅mm','切断位置mm','残材mm','材料単価円']];
    for(const bin of result.best.bins) {
      let position=result.project.trim;
      bin.parts.forEach((part,i)=>{
        position+=part.length;
        rows.push([bin.index,bin.kind==='offcut'?'手持ち':'購入',bin.sourceName,bin.length,i+1,part.name,part.length,result.project.kerf,position,bin.remaining,bin.price]);
        position+=result.project.kerf;
      });
    }
    return '\uFEFF'+rows.map(csvLine).join('\r\n')+'\r\n';
  }
  function exportOffcutsCsv(result) {
    const rows=[['品名','長さ','数量'],...carryForward(result).map(x=>[x.name,x.length,x.qty])];
    return '\uFEFF'+rows.map(csvLine).join('\r\n')+'\r\n';
  }
  function demoProject() {
    return {
      title:'小さな壁面棚（試用データ）',kerf:3,trim:5,keepMin:200,
      parts:[
        {name:'棚柱',length:760,qty:4}, {name:'横桟',length:540,qty:3},
        {name:'補強材',length:320,qty:3}, {name:'小桟',length:180,qty:2}
      ],
      offcuts:[{name:'前回のSPF',length:1110,qty:1},{name:'作業場の端材',length:780,qty:2}],
      purchases:[{name:'SPF 6ft',length:1820,price:480},{name:'SPF 8ft',length:2438,price:690}]
    };
  }
  return {validateProject,calculate,verifyPlan,carryForward,parseCsv,importPartsCsv,exportCutCsv,exportOffcutsCsv,demoProject,MAX_PIECES};
});