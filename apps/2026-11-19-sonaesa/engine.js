/* そなえ差分 — pure, dependency-free planning engine. Units: L, meals, toilet uses. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SonaesaEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KEYS = ['water', 'food', 'toilet'];
  const LABELS = {water:'飲料水',food:'食事',toilet:'携帯トイレ'};
  const UNITS = {water:'L',food:'食',toilet:'回'};
  const DEFAULT_CONFIG = {
    persons: 2, days: 7, rates:{water:3,food:3,toilet:5}, budget:5000,
    packs:{water:{quantity:2,price:150},food:{quantity:1,price:300},toilet:{quantity:10,price:650}}
  };
  const MAX_ITEMS=500;
  const round = x => Math.round((x + Number.EPSILON)*1000)/1000;
  const clamp = (value, fallback, min, max) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
  };
  function validDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s+'T12:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===s;
  }
  function shiftDate(s, days) {
    if(!validDate(s)) throw new Error('不正な日付');
    const d=new Date(s+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+days);
    return d.toISOString().slice(0,10);
  }
  function normalize(raw) {
    if(!raw || typeof raw!=='object' || Array.isArray(raw)) throw new Error('JSON形式が不正です');
    const c=raw.config || {};
    const rates=c.rates || {};
    const packs=c.packs || {};
    const config={
      persons:clamp(c.persons,2,1,20),days:clamp(c.days,7,1,30),
      budget:clamp(c.budget,5000,0,10000000), rates:{},packs:{}
    };
    config.persons=Math.floor(config.persons); config.days=Math.floor(config.days); config.budget=Math.floor(config.budget);
    for(const key of KEYS) {
      config.rates[key]=clamp(rates[key],DEFAULT_CONFIG.rates[key],0.01,50);
      const p=packs[key]||{};
      config.packs[key]={quantity:clamp(p.quantity,DEFAULT_CONFIG.packs[key].quantity,.01,100000),price:Math.round(clamp(p.price,DEFAULT_CONFIG.packs[key].price,1,10000000))};
    }
    const arr=raw.items;
    if(!Array.isArray(arr) || arr.length>MAX_ITEMS) throw new Error('備蓄データの件数が不正です');
    const seen=new Set();
    const items=arr.map((v,i)=>{
      if(!v || typeof v!=='object' || !KEYS.includes(v.category)) throw new Error(`${i+1}件目の分類が不正です`);
      const name=String(v.name||'').trim().slice(0,80);
      const qty=Number(v.quantity);
      const expiry=v.expiry == null ? '' : String(v.expiry);
      if(!name || !Number.isFinite(qty) || qty<=0 || qty>1e6 || (expiry && !validDate(expiry))) throw new Error(`${i+1}件目の内容が不正です`);
      const id = (typeof v.id==='string' && /^[a-zA-Z0-9_-]{1,50}$/.test(v.id) && !seen.has(v.id)) ? v.id : `row_${i}`;
      if(seen.has(id)) throw new Error('IDが重複しました'); seen.add(id);
      return {id,category:v.category,name,quantity:round(qty),expiry,location:String(v.location||'').slice(0,80)};
    });
    return {config,items};
  }
  function requirement(config,key){return round(config.persons * config.days * config.rates[key]);}
  function available(items,asOf) {
    if(!validDate(asOf)) throw new Error('評価日の形式が不正です');
    const result={water:0,food:0,toilet:0};
    for(const item of items){
      if(!KEYS.includes(item.category)) continue;
      if(!item.expiry || item.expiry>=asOf) result[item.category]+=item.quantity;
    }
    for(const key of KEYS) result[key]=round(result[key]);
    return result;
  }
  function assess(state,asOf){
    const config=state.config, totals=available(state.items,asOf), detail={};
    let minimum=Infinity;
    for(const k of KEYS){
      const daily=config.persons*config.rates[k],need=requirement(config,k),have=totals[k];
      const days=round(have/daily);
      detail[k]={name:LABELS[k],unit:UNITS[k],daily:round(daily),need,have,short:round(Math.max(0,need-have)),days,
        percent:Math.min(100,Math.round(have/need*100))};
      minimum=Math.min(minimum,days);
    }
    return {asOf,detail,minDays:round(minimum),covered:minimum>=config.days};
  }
  function budgetPlan(state, asOf){
    const config=state.config, report=assess(state,asOf), totals={};
    const packsCount={water:0,food:0,toilet:0};
    let remaining=config.budget, spent=0;
    for(const key of KEYS) totals[key]=report.detail[key].have;
    for(let step=0;step<10000;step++){
      const candidates=KEYS.filter(k=>{
        const p=config.packs[k]; return totals[k]+1e-8 < requirement(config,k) && p.price<=remaining;
      });
      if(!candidates.length)break;
      candidates.sort((a,b)=>{
        const da=totals[a]/(config.persons*config.rates[a]);
        const db=totals[b]/(config.persons*config.rates[b]);
        if(Math.abs(da-db)>1e-8)return da-db;
        // Tie: cost per additional usable day, prefer economically efficient pack.
        const pa=config.packs[a],pb=config.packs[b];
        const ia=Math.min(pa.quantity,Math.max(0,requirement(config,a)-totals[a]))/(config.persons*config.rates[a]);
        const ib=Math.min(pb.quantity,Math.max(0,requirement(config,b)-totals[b]))/(config.persons*config.rates[b]);
        return pa.price/ia - pb.price/ib || KEYS.indexOf(a)-KEYS.indexOf(b);
      });
      const k=candidates[0],p=config.packs[k];
      packsCount[k]++; totals[k]=round(totals[k]+p.quantity);
      spent+=p.price;remaining-=p.price;
    }
    const after=Object.fromEntries(KEYS.map(k=>[k,{have:totals[k],days:round(totals[k]/(config.persons*config.rates[k])),short:round(Math.max(0,requirement(config,k)-totals[k]))}]));
    return {packsCount,spent,remaining,after,minDays:Math.min(...KEYS.map(k=>after[k].days)),complete:KEYS.every(k=>after[k].short===0)};
  }
  function rotate(items, today, windowDays=30){
    if(!validDate(today))throw new Error('評価日の形式が不正です');
    const cutoff=shiftDate(today,windowDays);
    return items.filter(item=>item.expiry && item.expiry<=cutoff)
      .map(item=>({...item,status:item.expiry<today?'期限切れ':'期限間近'}))
      .sort((a,b)=>a.expiry.localeCompare(b.expiry)||a.name.localeCompare(b.name,'ja'));
  }
  function csvCell(value){
    let s=String(value==null?'':value);
    // Prevent spreadsheet formula execution on import.
    if(/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  }
  function toCSV(items){
    const rows=[['分類','品名','数量','単位','期限','保管場所'],...items.map(x=>[LABELS[x.category],x.name,x.quantity,UNITS[x.category],x.expiry,x.location])];
    return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
  }
  return {KEYS,LABELS,UNITS,DEFAULT_CONFIG,normalize,validDate,shiftDate,available,assess,budgetPlan,rotate,toCSV,requirement};
});