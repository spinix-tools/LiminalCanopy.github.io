/* 箱棚 / HAKODANA - deterministic packaging planner, no network calls. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoxEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const TIERS = [
    [60,2],[80,5],[100,10],[120,15],[140,20],[160,25],[180,30],[200,30]
  ].map(([size,kg])=>({size,kg}));
  const DEFAULT_ITEM = Object.freeze({length:22,width:14,height:7,weight:0.55,padding:1,packingWeight:0.08,upright:false});
  const DEFAULT_BOXES = Object.freeze([
    {id:'demo-1',name:'小箱・60',l:26,w:19,h:13,wall:0.4,weight:0.14,cost:48},
    {id:'demo-2',name:'薄型・60',l:32,w:22,h:6,wall:0.4,weight:0.11,cost:35},
    {id:'demo-3',name:'中箱・80',l:34,w:24,h:17,wall:0.4,weight:0.25,cost:76},
    {id:'demo-4',name:'平箱・80',l:36,w:30,h:14,wall:0.4,weight:0.24,cost:86},
    {id:'demo-5',name:'大箱・100',l:42,w:32,h:23,wall:0.5,weight:0.38,cost:120}
  ]);
  const PERMS = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  const isFiniteInRange = (n,min,max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  function validateItem(i){
    if(!i || typeof i !== 'object') return '商品データがありません';
    for(const key of ['length','width','height']) if(!isFiniteInRange(i[key],0.1,500)) return '商品サイズは0.1〜500cmで入力してください';
    if(!isFiniteInRange(i.weight,0,100)) return '商品重量は0〜100kgで入力してください';
    if(!isFiniteInRange(i.padding,0,30)) return '緩衝材は片側0〜30cmで入力してください';
    if(!isFiniteInRange(i.packingWeight,0,10)) return '緩衝材重量は0〜10kgで入力してください';
    if(typeof i.upright !== 'boolean') return '回転の指定が不正です';
    return null;
  }
  function validateBox(b){
    if(!b || typeof b !== 'object' || typeof b.name !== 'string' || !b.name.trim() || b.name.length>48) return '箱の名前は1〜48文字で入力してください';
    for(const k of ['l','w','h']) if(!isFiniteInRange(b[k],0.1,250)) return '箱の外寸は0.1〜250cmで入力してください';
    if(!isFiniteInRange(b.wall,0,5) || [b.l,b.w,b.h].some(v=>v <= 2*b.wall)) return '板厚は0〜5cm、かつ内寸が正になる値を入力してください';
    if(!isFiniteInRange(b.weight,0,30)) return '箱の重量は0〜30kgで入力してください';
    if(!isFiniteInRange(b.cost,0,1000000)) return '箱の単価は0〜100万円で入力してください';
    return null;
  }
  function fitItem(item, box){
    const inner = [box.l-2*box.wall,box.w-2*box.wall,box.h-2*box.wall];
    const product = [item.length,item.width,item.height];
    const perms = item.upright ? [[0,1,2],[1,0,2]] : PERMS;
    let best=null, closest=null;
    for (const order of perms){
      const oriented=order.map(i=>product[i]);
      const required=oriented.map(v=>v+2*item.padding);
      const spare=required.map((v,i)=>inner[i]-v);
      const shortfall=spare.reduce((acc,v)=>acc+Math.max(-v,0),0);
      const candidate={oriented,required,spare,shortfall,inner};
      if(spare.every(v=>v>=-1e-7)){
        if(!best || Math.min(...spare)>Math.min(...best.spare)+1e-7) best=candidate;
      } else if(!closest || shortfall<closest.shortfall-1e-7) closest=candidate;
    }
    return {fits:!!best, ...(best||closest)};
  }
  function getTier(box,totalWeight){
    const sum=box.l+box.w+box.h;
    if(Math.max(box.l,box.w,box.h)>170 || sum>200+1e-7 || totalWeight>30+1e-7) return null;
    return TIERS.find(t=>sum<=t.size+1e-7 && totalWeight<=t.kg+1e-7)||null;
  }
  function computePlan(item, boxes, fees){
    const problem=validateItem(item);
    if(problem) return {error:problem,rows:[],eligible:[]};
    if(!Array.isArray(boxes) || boxes.length>40 || boxes.some(b=>validateBox(b))) return {error:'箱のデータに不正な値があります',rows:[],eligible:[]};
    const rows=boxes.map(box=>{
      const fitting=fitItem(item,box);
      const totalWeight=item.weight+item.packingWeight+box.weight;
      const tier=getTier(box,totalWeight);
      const shipping=fees && Object.prototype.hasOwnProperty.call(fees,String(tier?.size)) ? fees[tier.size] : null;
      const knownFee=isFiniteInRange(shipping,0,1000000);
      const possible=fitting.fits && !!tier;
      return {
        box, fit:fitting, tier, totalWeight, outerSum:box.l+box.w+box.h,
        possible, shipping:knownFee?shipping:null,
        total: possible&&knownFee ? shipping+box.cost : null,
        reason: !fitting.fits?'内寸に収まりません': !tier?'配送規格の目安を超過':'',
      };
    });
    const eligible=rows.filter(r=>r.possible);
    const fullyPriced=eligible.length>0 && eligible.every(r=>r.total!==null);
    eligible.sort((a,b)=> fullyPriced
      ? a.total-b.total || a.tier.size-b.tier.size || a.box.cost-b.box.cost
      : a.tier.size-b.tier.size || a.outerSum-b.outerSum || a.box.cost-b.box.cost);
    return {error:null, rows, eligible, preferred:eligible[0]||null, fullyPriced};
  }
  return {TIERS,DEFAULT_ITEM,DEFAULT_BOXES,validateItem,validateBox,fitItem,getTier,computePlan};
});