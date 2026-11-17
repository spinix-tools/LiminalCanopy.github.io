/* 畑リレー / HATAKE RELAY — deterministic offline rotation planner. MIT License. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Hatake = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FAMILIES = Object.freeze({
    sol:'ナス科', bra:'アブラナ科', leg:'マメ科', cuc:'ウリ科', all:'ヒガンバナ科', api:'セリ科', ast:'キク科', oth:'その他'
  });
  const CROPS = Object.freeze([
    {id:'tomato',name:'トマト',family:'sol',area:0.8}, {id:'eggplant',name:'ナス',family:'sol',area:0.8},
    {id:'pepper',name:'ピーマン',family:'sol',area:0.5}, {id:'potato',name:'ジャガイモ',family:'sol',area:1.0},
    {id:'cabbage',name:'キャベツ',family:'bra',area:0.8}, {id:'broccoli',name:'ブロッコリー',family:'bra',area:0.8},
    {id:'radish',name:'ダイコン',family:'bra',area:0.7}, {id:'komatsuna',name:'コマツナ',family:'bra',area:0.3},
    {id:'pea',name:'エンドウ',family:'leg',area:0.6}, {id:'edamame',name:'エダマメ',family:'leg',area:0.6},
    {id:'cucumber',name:'キュウリ',family:'cuc',area:0.7}, {id:'pumpkin',name:'カボチャ',family:'cuc',area:1.6},
    {id:'onion',name:'タマネギ',family:'all',area:0.5}, {id:'leek',name:'ネギ',family:'all',area:0.3},
    {id:'carrot',name:'ニンジン',family:'api',area:0.4}, {id:'parsley',name:'パセリ',family:'api',area:0.2},
    {id:'lettuce',name:'レタス',family:'ast',area:0.4}, {id:'sunflower',name:'ヒマワリ',family:'ast',area:0.7},
    {id:'spinach',name:'ホウレンソウ',family:'oth',area:0.3}, {id:'corn',name:'トウモロコシ',family:'oth',area:1.0}
  ]);
  const cropById = Object.fromEntries(CROPS.map(c => [c.id,c]));
  const MAX = 10;
  function crop(id) { return cropById[id] || null; }
  function isFamily(id) { return Object.prototype.hasOwnProperty.call(FAMILIES,id); }
  function pairScore(bed, item, year) {
    const c = crop(item.crop);
    if (!c) throw Error('不明な作物');
    if (!Number.isFinite(bed.area) || bed.area <= 0) throw Error('区画面積が不正です');
    let repeat = 0, yearsAgo = null;
    const past = Array.isArray(bed.history) ? bed.history : [];
    for (let i = 0; i < 3; i++) {
      if (past[i] === c.family) {
        const p = [100, 42, 16][i];
        if (p > repeat) {repeat = p; yearsAgo = i+1;}
      }
    }
    const shortfall = Math.max(0,c.area - bed.area);
    const areaPenalty = Math.round(shortfall * 65 * 10) / 10;
    return {score:Math.round((repeat + areaPenalty)*10)/10, repeat, areaPenalty, yearsAgo, areaEnough:shortfall < 1e-8};
  }
  function emptyState() {return {year:2027, beds:[], wants:[], plan:{}, locks:{}};}
  function demoState() {
    return {
      year:2027,
      beds:[
        {id:'b1',name:'北の畝',area:1.2,history:['sol','bra','leg']},
        {id:'b2',name:'中央の畝',area:1.0,history:['bra','leg','sol']},
        {id:'b3',name:'南の畝',area:1.5,history:['leg','sol','bra']},
        {id:'b4',name:'プランター',area:0.6,history:['cuc','all','ast']}
      ],
      wants:[{id:'w1',crop:'tomato'},{id:'w2',crop:'cabbage'},{id:'w3',crop:'edamame'},{id:'w4',crop:'lettuce'}],
      plan:{w1:'b1',w2:'b2',w3:'b3',w4:'b4'},locks:{}
    };
  }
  const safeName = str => String(str == null ? '' : str).trim().slice(0,28);
  function normalizeState(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('有効な設定JSONではありません');
    const year = Number(input.year);
    if (!Number.isInteger(year) || year < 2020 || year > 2100) throw Error('計画年は2020〜2100にしてください');
    if (!Array.isArray(input.beds) || !Array.isArray(input.wants) || input.beds.length > MAX || input.wants.length > MAX) throw Error('区画・作物は各10件以内にしてください');
    const ids = new Set();
    function uniqueId(id,prefix) {
      if (typeof id !== 'string' || !new RegExp('^'+prefix+'[a-zA-Z0-9_-]{1,30}$').test(id) || ids.has(id)) throw Error('IDが不正または重複しています');
      ids.add(id);return id;
    }
    const beds = input.beds.map(b=>{
      const id=uniqueId(b.id,'b'), name=safeName(b.name), area=Number(b.area);
      if (!name || !Number.isFinite(area) || area < 0.1 || area > 1000) throw Error('区画名または面積が不正です');
      if (!Array.isArray(b.history) || b.history.length !== 3 || b.history.some(f=> f !== '' && !isFamily(f))) throw Error('過去の科の記録が不正です');
      return {id,name,area,history:[...b.history]};
    });
    const wants = input.wants.map(w=>{
      const id=uniqueId(w.id,'w'); if (!crop(w.crop)) throw Error('作物の指定が不正です');
      return {id,crop:w.crop};
    });
    const bedIds=new Set(beds.map(b=>b.id)), wantIds=new Set(wants.map(w=>w.id));
    const plan={},locks={};
    for (const [dst,src] of [[plan,input.plan],[locks,input.locks]]) {
      if (src && typeof src === 'object' && !Array.isArray(src)) {
        for (const [w,b] of Object.entries(src)) if (wantIds.has(w) && bedIds.has(b)) dst[w]=b;
      }
    }
    for (const src of [plan,locks]) {if (new Set(Object.values(src)).size !== Object.values(src).length) throw Error('同じ区画の重複割当があります');}
    for (const [w,b] of Object.entries(locks)) if (plan[w] !== b) throw Error('固定した区画と計画が一致しません');
    return {year,beds,wants,plan,locks};
  }
  function evaluate(state, plan=state.plan) {
    const beds=Object.fromEntries(state.beds.map(b=>[b.id,b]));
    const detail=[]; let total=0, repeats=0, tight=0, placed=0;
    for(const w of state.wants){
      const b=beds[plan[w.id]];
      if(!b) continue;
      const score=pairScore(b,w,state.year);
      total+=score.score; repeats += Number(score.repeat>0); tight+=Number(!score.areaEnough); placed++;
      detail.push({wish:w.id,bed:b.id,crop:w.crop,...score});
    }
    return {total:Math.round(total*10)/10, repeats,tight,placed,detail,unassigned:state.wants.length-placed};
  }
  function optimize(input) {
    const s=normalizeState(input), n=s.beds.length, m=s.wants.length;
    if(!m || !n) throw Error('先に区画と作物を登録してください');
    if(m>n) throw Error('作物数が区画数を超えています（1区画1作物）');
    const used=new Set(),fixed={};
    for(const w of s.wants){
      const b=s.locks[w.id];
      if(b){if(used.has(b)) throw Error('固定区画が重複しています');used.add(b);fixed[w.id]=b;}
    }
    const freeBeds=s.beds.filter(b=>!used.has(b.id)), freeWants=s.wants.filter(w=>!fixed[w.id]);
    const N=freeBeds.length, M=freeWants.length;
    // Exact minimum-cost assignment for <=10 beds; deterministic tie-breaking by bed order.
    const dp = new Map([[0,{score:0,assign:[] }]]);
    for(let j=0;j<M;j++){
      const next=new Map();
      for(const [mask,entry] of dp){
        for(let k=0;k<N;k++){
          if(mask&(1<<k)) continue;
          const nm=mask|(1<<k), cost=pairScore(freeBeds[k],freeWants[j],s.year).score;
          const candidate={score:Math.round((entry.score+cost)*10)/10,assign:[...entry.assign,freeBeds[k].id]};
          const prev=next.get(nm);
          if(!prev || candidate.score < prev.score-1e-8) next.set(nm,candidate);
        }
      }
      dp.clear();for(const [k,v] of next)dp.set(k,v);
    }
    let best=null;
    for(const result of dp.values()) if(!best || result.score < best.score-1e-8) best=result;
    if(!best)throw Error('配置を計算できませんでした');
    const proposed={...fixed};freeWants.forEach((w,i)=>proposed[w.id]=best.assign[i]);
    return {plan:proposed,metrics:evaluate(s,proposed),previous:evaluate(s),isExact:true};
  }
  function csvCell(v){const s=String(v??'');return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
  function exportCSV(s) {
    const bmap=Object.fromEntries(s.beds.map(b=>[b.id,b]));
    const lines=[['計画年','区画','面積㎡','作物','科','前年','2年前','3年前','重複リスク','面積不足'].join(',')];
    for(const w of s.wants){const bed=bmap[s.plan[w.id]],c=crop(w.crop);const d=bed?pairScore(bed,w,s.year):null;
      lines.push([s.year,bed?.name||'未配置',bed?.area||'',c.name,FAMILIES[c.family],...(bed?.history||['','','']).map(f=>FAMILIES[f]||''),d?.repeat||0,d?(!d.areaEnough?'あり':'なし'):''].map(csvCell).join(','));}
    return '\uFEFF'+lines.join('\r\n')+'\r\n';
  }
  return {FAMILIES,CROPS,MAX,crop,pairScore,emptyState,demoState,normalizeState,evaluate,optimize,exportCSV};
});