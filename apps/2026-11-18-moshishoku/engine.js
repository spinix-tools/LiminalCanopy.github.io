/* MOSHISHOKU planning engine: deterministic, side-effect free. MIT */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MoshiEngine = api;
})(typeof globalThis === 'object' ? globalThis : this, function() {
  'use strict';
  const clamp = (x, lo, hi, fallback) => Number.isFinite(Number(x)) ? Math.min(hi, Math.max(lo, Number(x))) : fallback;
  const integer = (x, lo, hi, fallback) => Math.floor(clamp(x, lo, hi, fallback));
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  function validDate(s) {
    if (!ISO.test(String(s || ''))) return false;
    const d = new Date(s + 'T00:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === s;
  }
  function addDays(s, count) {
    const d = new Date(s + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + count);
    return d.toISOString().slice(0,10);
  }
  function normalize(raw) {
    const x = raw && typeof raw === 'object' ? raw : {};
    const start = validDate(x.start) ? x.start : new Date().toISOString().slice(0,10);
    const people = integer(x.people, 1, 12, 2);
    const days = integer(x.days, 1, 14, 3);
    const food = (Array.isArray(x.food) ? x.food : []).slice(0, 150).map((f, i) => ({
      id: String(f.id || 'f' + i).slice(0,80),
      name: String(f.name || '食品').slice(0,70),
      portions: integer(f.portions, 0, 500, 0),
      mode: ['ready', 'water', 'heat'].includes(f.mode) ? f.mode : 'ready',
      waterMl: integer(f.waterMl, 0, 2000, 0),
      heat: integer(f.heat, 0, 3, 0),
      category: ['staple', 'protein', 'vegetable', 'other'].includes(f.category) ? f.category : 'other',
      expiry: validDate(f.expiry) ? f.expiry : '',
    }));
    return {start, people, days, waterL:clamp(x.waterL,0,2000,24), reserveL:clamp(x.reserveL,0,10,2.5), cookWaterMl:integer(x.cookWaterMl,0,20000,1000), heatSlots:integer(x.heatSlots,0,200,4), food};
  }
  function plan(raw) {
    const s = normalize(raw);
    const targetWaterL = s.people * s.days * 3; // Japan government-publicized screening target
    const reserveTotalMl = s.reserveL * s.people * s.days * 1000;
    const remainingForCookingMl = Math.max(0, Math.floor(s.waterL * 1000 - reserveTotalMl));
    const state = s.food.map((f, index) => ({...f, index, left:f.portions}));
    const days = [];
    let fulfilled = 0, needed = s.people * s.days * 3, plannedCookMl=0, plannedHeat=0;
    const chosen = new Map();
    let waterLeft = remainingForCookingMl;
    for(let di=0; di<s.days; di++) {
      const date=addDays(s.start,di);
      const day = {date, meals:[], usedWaterMl:0, usedHeat:0, usedCategories:new Set()};
      const dayBudget=Math.min(s.cookWaterMl, waterLeft);
      for(let mealNo=0;mealNo<3;mealNo++) {
        const meal={name:['朝','昼','夜'][mealNo], items:[], covered:0, short:s.people};
        let tries=0;
        while(meal.short>0 && tries++ < 150) {
          const candidates=state.filter(f=>f.left>0 && (!f.expiry || f.expiry>=date))
            .map(f=>{
              const waterCost=f.mode==='water'?f.waterMl:0;
              const heatCost=f.mode==='heat'?Math.max(1,f.heat):0;
              const maxW=waterCost ? Math.floor((dayBudget-day.usedWaterMl)/waterCost) : 500;
              const maxH=heatCost ? Math.floor((s.heatSlots-day.usedHeat)/heatCost) : 500;
              return {...f, waterCost,heatCost,can:Math.min(f.left,meal.short,maxW,maxH)};
            }).filter(f=>f.can>0);
          if(!candidates.length) break;
          candidates.sort((a,b)=>{
            // Deadline-first, then diversify within each day; no invented nutrition scores.
            const ea=a.expiry || '9999-12-31', eb=b.expiry || '9999-12-31';
            const x=ea.localeCompare(eb); if(x) return x;
            const va=day.usedCategories.has(a.category)?1:0, vb=day.usedCategories.has(b.category)?1:0;
            if(va!==vb) return va-vb;
            const ca=a.waterCost + a.heatCost*250, cb=b.waterCost+b.heatCost*250;
            return ca-cb || a.index-b.index;
          });
          const f=candidates[0], qty=f.can;
          const stock=state[f.index]; stock.left-=qty;
          day.usedWaterMl+=qty*f.waterCost;
          day.usedHeat+=qty*f.heatCost;
          day.usedCategories.add(f.category);
          chosen.set(f.id,(chosen.get(f.id)||0)+qty);
          meal.items.push({id:f.id,name:f.name,qty,mode:f.mode,category:f.category});
          meal.covered+=qty; meal.short-=qty; fulfilled+=qty;
        }
        day.meals.push(meal);
      }
      waterLeft-=day.usedWaterMl;
      plannedCookMl+=day.usedWaterMl; plannedHeat+=day.usedHeat;
      day.usedCategories=[...day.usedCategories];
      days.push(day);
    }
    const short=needed-fulfilled;
    const shopping=[];
    if(short) shopping.push({name:'追加の食品（1人1食換算）',amount:short,unit:'食分'});
    const waterShort=Math.max(0,targetWaterL-s.waterL);
    if(waterShort) shopping.push({name:'備蓄水（1人1日3L目安との差）',amount:Number(waterShort.toFixed(1)),unit:'L'});
    const unusable=state.filter(f=>f.left>0 && f.expiry && f.expiry<s.start).map(f=>f.name);
    const rotation=s.food.filter(f=>f.portions>0 && f.expiry && f.expiry>=s.start && f.expiry<=addDays(s.start,60))
      .sort((a,b)=>a.expiry.localeCompare(b.expiry)).map(f=>({name:f.name,expiry:f.expiry,remaining:Math.max(0, (state.find(g=>g.index===s.food.indexOf(f))||{}).left || 0)}));
    const warnings=[];
    if(s.waterL < targetWaterL) warnings.push('水の備蓄が公的な目安（1人1日3L）を下回っています。');
    if(s.waterL < s.reserveL*s.people*s.days) warnings.push('設定した最低確保水量も満たさず、調理用水は0mLで計画します。');
    if(short) warnings.push('食数が不足。期限・加熱枠・調理用水の制約が原因の場合もあります。');
    if(unusable.length) warnings.push('計画開始日時点で賞味期限を過ぎた品を計画から除外しました（安全判定ではありません）。');
    if(days.some(d=>d.usedCategories.length<=1)) warnings.push('食品カテゴリが少ない日があります。栄養バランスの評価は行いません。');
    return {settings:s,days,fulfilled,needed,short,targetWaterL,waterShort,remainingForCookingMl,plannedCookMl,plannedHeat,rotation,unusable,shopping,warnings,remaining:state.map(f=>({id:f.id,name:f.name,left:f.left}))};
  }
  function safeCsvCell(v) {
    let str=String(v===undefined?'':v);
    // Protect spreadsheet users from formula execution; preserve CSV quoting.
    if (/^[\s]*[=+@\-]/.test(str)) str="'"+str;
    return '"'+str.replace(/"/g,'""')+'"';
  }
  function csv(rows) {return '\uFEFF'+rows.map(r=>r.map(safeCsvCell).join(',')).join('\r\n')+'\r\n';}
  function shoppingCsv(report) {return csv([['品目','不足量','単位'],...report.shopping.map(x=>[x.name,x.amount,x.unit])]);}
  function planCsv(report) {return csv([['日付','食事','食品','食数','不足食数','調理用水mL（当日合計）','加熱枠（当日合計）'],...report.days.flatMap(d=>d.meals.flatMap(m=>(m.items.length?m.items:[{name:'（割当なし）',qty:0}]).map(f=>[d.date,m.name,f.name,f.qty,m.short,d.usedWaterMl,d.usedHeat])))]);}
  function example(start) {return normalize({start,people:2,days:3,waterL:18,reserveL:2.5,cookWaterMl:1000,heatSlots:4,food:[
    {id:'a',name:'乾パン',portions:5,mode:'ready',category:'staple',expiry:addDays(start,120)},
    {id:'b',name:'ツナ缶',portions:4,mode:'ready',category:'protein',expiry:addDays(start,40)},
    {id:'c',name:'アルファ米（水戻し）',portions:5,mode:'water',waterMl:160,category:'staple',expiry:addDays(start,280)},
    {id:'d',name:'温めるレトルト',portions:4,mode:'heat',heat:1,category:'protein',expiry:addDays(start,180)},
    {id:'e',name:'野菜ジュース',portions:3,mode:'ready',category:'vegetable',expiry:addDays(start,20)},
    {id:'f',name:'シリアル',portions:4,mode:'ready',category:'staple',expiry:addDays(start,210)}
  ]});}
  return {normalize,plan,example,addDays,validDate,csv,shoppingCsv,planCsv};
});
