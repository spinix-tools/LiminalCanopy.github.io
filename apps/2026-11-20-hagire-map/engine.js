/* HAGIRE MAP packing engine — local, deterministic, no external dependencies */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Hagire = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_DIM = 10000;
  const isNum = v => typeof v === 'number' && Number.isFinite(v);
  function requireDim(v, context) {
    if (!isNum(v) || v <= 0 || v > MAX_DIM) throw new Error(context + 'は1〜10000 mmの数値にしてください');
  }
  function validate(project) {
    if (!project || !Array.isArray(project.stocks) || !Array.isArray(project.parts)) throw new Error('保存形式が正しくありません');
    if (project.stocks.length > 80 || project.parts.length > 100) throw new Error('材料は80種類、パーツは100種類までです');
    const gap = Number(project.gap);
    if (!Number.isFinite(gap) || gap < 0 || gap > 50) throw new Error('裁断間隔は0〜50 mmにしてください');
    const ids = new Set();
    let stockCount = 0, partCount = 0;
    for (const [i, s] of project.stocks.entries()) {
      if (!s || typeof s.id !== 'string' || !s.id || ids.has('s'+s.id)) throw new Error('材料IDに重複があります');
      ids.add('s'+s.id);
      if (typeof s.name !== 'string' || !s.name.trim() || typeof s.material !== 'string' || !s.material.trim()) throw new Error(`材料${i+1}の名称と生地を入力してください`);
      requireDim(s.w, `材料${i+1}の幅`); requireDim(s.h, `材料${i+1}の高さ`);
      if (!Number.isInteger(s.qty) || s.qty < 1 || s.qty > 24) throw new Error('材料数量は1〜24にしてください');
      if (s.kind !== 'scrap' && s.kind !== 'new') throw new Error('材料種別が不正です');
      stockCount += s.qty;
    }
    for (const [i, p] of project.parts.entries()) {
      if (!p || typeof p.id !== 'string' || !p.id || ids.has('p'+p.id)) throw new Error('パーツIDに重複があります');
      ids.add('p'+p.id);
      if (typeof p.name !== 'string' || !p.name.trim() || typeof p.material !== 'string' || !p.material.trim()) throw new Error(`パーツ${i+1}の名称と生地を入力してください`);
      requireDim(p.w, `パーツ${i+1}の幅`); requireDim(p.h, `パーツ${i+1}の高さ`);
      if (!Number.isInteger(p.qty) || p.qty < 1 || p.qty > 60) throw new Error('パーツ数量は1〜60にしてください');
      if (!isNum(p.allowance) || p.allowance < 0 || p.allowance > 100) throw new Error('縫い代は0〜100 mmにしてください');
      if (typeof p.rotate !== 'boolean') throw new Error('回転可否が不正です');
      if (p.w + 2*p.allowance > MAX_DIM || p.h + 2*p.allowance > MAX_DIM) throw new Error('縫い代込みの寸法は10000 mm以内です');
      partCount += p.qty;
    }
    if (stockCount > 100 || partCount > 160) throw new Error('一度に扱える材料は100枚、パーツは160個までです');
    return project;
  }
  function packVariant(project, ordering, split) {
    const gap = Number(project.gap);
    const sheets = [];
    for (const stock of project.stocks) {
      for (let i = 0; i < stock.qty; i++) {
        sheets.push({ parentId: stock.id, index: i+1, id: `${stock.id}~${i+1}`, name: stock.name, material: stock.material, kind: stock.kind, w: stock.w, h: stock.h,
          free: [{x:0,y:0,w:stock.w,h:stock.h}], placements: [] });
      }
    }
    const parts = [];
    for (const p of project.parts) for (let i=0; i<p.qty; i++) {
      const w=p.w+2*p.allowance, h=p.h+2*p.allowance;
      parts.push({ id:`${p.id}~${i+1}`, parentId:p.id, number:i+1, name:p.name, material:p.material, w,h, allowRotate:p.rotate, allowance:p.allowance });
    }
    const metrics = {
      area:p=>p.w*p.h, long:p=>Math.max(p.w,p.h), perimeter:p=>p.w+p.h,
      input:()=>0
    };
    const orderBy=metrics[ordering]||metrics.area;
    parts.sort((a,b)=>orderBy(b)-orderBy(a) || b.w*b.h-a.w*a.h || a.id.localeCompare(b.id));
    const unplaced=[];
    for(const p of parts) {
      let best=null;
      for(const s of sheets) {
        if (s.material !== p.material) continue;
        for(let i=0;i<s.free.length;i++) {
          const f=s.free[i];
          const rotations=[{w:p.w,h:p.h,rotated:false}];
          if(p.allowRotate && p.w!==p.h) rotations.push({w:p.h,h:p.w,rotated:true});
          for(const r of rotations) {
            if(r.w>f.w+1e-8 || r.h>f.h+1e-8) continue;
            // Priority: consume scraps, then consolidate on already-used sheets, then smallest suitable space.
            const score=[s.kind==='scrap'?0:1, s.placements.length ? 0:1, f.w*f.h-r.w*r.h, Math.max(f.w-r.w,f.h-r.h), s.w*s.h, s.id, i];
            if(!best || compare(score,best.score)<0) best={s,i,f,r,score};
          }
        }
      }
      if(!best) { unplaced.push(p); continue; }
      const {s,i,f,r}=best;
      s.free.splice(i,1);
      s.placements.push({id:p.id,parentId:p.parentId,number:p.number,name:p.name,material:p.material, x:f.x,y:f.y,w:r.w,h:r.h,rotated:r.rotated,allowance:p.allowance});
      const horizontal = split==='horizontal';
      let next;
      if(horizontal) {
        next=[{x:f.x+r.w+gap,y:f.y,w:f.w-r.w-gap,h:r.h}, {x:f.x,y:f.y+r.h+gap,w:f.w,h:f.h-r.h-gap}];
      } else {
        next=[{x:f.x+r.w+gap,y:f.y,w:f.w-r.w-gap,h:f.h}, {x:f.x,y:f.y+r.h+gap,w:r.w,h:f.h-r.h-gap}];
      }
      for(const v of next) if(v.w>0.00001 && v.h>0.00001) s.free.push(v);
    }
    const used=sheets.filter(s=>s.placements.length);
    const cutArea=used.reduce((t,s)=>t+s.placements.reduce((a,p)=>a+p.w*p.h,0),0);
    const stockArea=used.reduce((t,s)=>t+s.w*s.h,0);
    const scrapsUsed=used.filter(s=>s.kind==='scrap').length;
    return { sheets, used, unplaced, cutArea, stockArea, scrapsUsed, newUsed:used.filter(s=>s.kind==='new').length, placedCount:parts.length-unplaced.length,
      requestedCount:parts.length, efficiency:stockArea?cutArea/stockArea:0, ordering, split };
  }
  function compare(a,b) {
    for(let i=0; i<a.length; i++) {
      if(a[i]===b[i]) continue;
      return a[i] < b[i] ? -1:1;
    }
    return 0;
  }
  function objective(x) {return [x.unplaced.length,x.newUsed,x.used.length,x.stockArea,-x.scrapsUsed]}
  function optimize(project) {
    validate(project);
    let best=null;
    for(const ordering of ['area','long','perimeter','input']) for(const split of ['horizontal','vertical']) {
      const c=packVariant(project,ordering,split);
      if(!best || compare(objective(c),objective(best))<0) best=c;
    }
    return best;
  }
  function checkLayout(plan, gap=0) {
    let valid=true;
    const errors=[];
    for(const s of plan.sheets) {
      for(const a of s.placements) {
        if(a.x < -1e-8 || a.y < -1e-8 || a.x+a.w>s.w+1e-8 || a.y+a.h>s.h+1e-8){valid=false; errors.push('境界超過:'+a.id)}
      }
      for(let i=0;i<s.placements.length;i++) for(let j=i+1;j<s.placements.length;j++) {
        const a=s.placements[i],b=s.placements[j];
        if(!(a.x+a.w+gap<=b.x+1e-8 || b.x+b.w+gap<=a.x+1e-8 || a.y+a.h+gap<=b.y+1e-8 || b.y+b.h+gap<=a.y+1e-8)){
          valid=false;errors.push('重複:'+a.id+'/'+b.id);
        }
      }
    }
    return {valid,errors};
  }
  // Applies only the inventory consequences. Unused sheets remain whole. Tiny remnants are intentionally excluded.
  function nextInventory(plan, minSide=50) {
    if(plan.unplaced.length) throw new Error('未配置のパーツがあるため確定できません');
    const stocks=[];
    for(const s of plan.sheets) {
      if(!s.placements.length){
        stocks.push({id:`remain-${s.id}`,name:s.name,material:s.material,kind:s.kind,w:s.w,h:s.h,qty:1});
        continue;
      }
      let ix=0;
      for(const r of s.free) if(r.w>=minSide && r.h>=minSide) {
        ix++;
        stocks.push({id:`off-${s.id}-${ix}`,name:`${s.name} 端材${ix}`,material:s.material,kind:'scrap',w:r.w,h:r.h,qty:1});
      }
    }
    return stocks;
  }
  function sample() {
    return { name:'巾着とポーチを端切れから作る', gap:5, stocks:[
      {id:'s1',name:'生成り端切れ A',material:'生成りリネン',kind:'scrap',w:460,h:310,qty:1},
      {id:'s2',name:'生成り端切れ B',material:'生成りリネン',kind:'scrap',w:330,h:260,qty:1},
      {id:'s3',name:'生成り新反',material:'生成りリネン',kind:'new',w:900,h:600,qty:1},
      {id:'s4',name:'紺端切れ',material:'紺コットン',kind:'scrap',w:360,h:280,qty:1}
    ], parts:[
      {id:'p1',name:'巾着 表（2枚）',material:'生成りリネン',w:185,h:205,qty:2,allowance:10,rotate:false},
      {id:'p2',name:'ポーチ マチ',material:'生成りリネン',w:250,h:95,qty:2,allowance:10,rotate:true},
      {id:'p3',name:'タグ',material:'生成りリネン',w:65,h:35,qty:3,allowance:5,rotate:true},
      {id:'p4',name:'内布',material:'紺コットン',w:135,h:105,qty:2,allowance:10,rotate:true}
    ]};
  }
  return { validate,optimize,packVariant,checkLayout,nextInventory,sample };
});
