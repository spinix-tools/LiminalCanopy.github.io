/* 巡り皿 / MEGURI ZARA — deterministic, dependency-free planning engine. MIT */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MeguriEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TYPES = ['issue', 'return', 'supply', 'discard'];
  function integer(value, min, max, name) {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`${name} は ${min}〜${max} の整数で入力してください`);
    return n;
  }
  function cleanText(value, length = 64) {
    return String(value == null ? '' : value).trim().slice(0, length);
  }
  function normalizePlan(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.slots)) throw new Error('計画データを読み込めません');
    if (data.slots.length < 1 || data.slots.length > 24) throw new Error('時間枠は1〜24個です');
    const p = {
      title: cleanText(data.title, 60) || '地域イベントのリユース食器計画',
      initial: integer(data.initial, 0, 100000, '初期清潔在庫'),
      rate: integer(data.rate, 0, 100, '回収率'),
      delay: integer(data.delay, 1, 24, '回収までの時間枠'),
      deposit: integer(data.deposit, 0, 10000, '預り金'),
      slots: data.slots.map((s, i) => {
        if (!s || typeof s !== 'object') throw new Error(`${i + 1}枠目が不正です`);
        return { label: cleanText(s.label, 24) || `${i + 1}枠目`, demand: integer(s.demand, 0, 100000, '想定提供数'), supply: integer(s.supply, 0, 100000, '清潔食器の補充数') };
      })
    };
    const total = p.slots.reduce((n, s) => n + s.demand + s.supply, p.initial);
    if (total > 1000000) throw new Error('合計100万点以下で計画してください');
    return p;
  }
  function requiredInitial(raw) {
    const p = normalizePlan(raw);
    let cumulative = 0, need = 0;
    for (const s of p.slots) {
      cumulative += s.demand - s.supply;
      need = Math.max(need, cumulative);
    }
    return need;
  }
  function simulate(raw) {
    const p = normalizePlan(raw);
    let clean = p.initial, dirty = 0, outside = 0, issued = 0, returned = 0, unmet = 0, replenished = 0;
    const due = new Array(p.slots.length).fill(0);
    let late = 0;
    const rows = [];
    for (let i = 0; i < p.slots.length; i++) {
      const s = p.slots[i];
      const gotBack = due[i];
      outside -= gotBack;
      dirty += gotBack;
      returned += gotBack;
      clean += s.supply;
      replenished += s.supply;
      const before = clean;
      const served = Math.min(clean, s.demand);
      clean -= served;
      outside += served;
      issued += served;
      const shortage = s.demand - served;
      unmet += shortage;
      const expected = Math.floor(served * p.rate / 100);
      const futureSlot = i + p.delay;
      if (futureSlot < due.length) due[futureSlot] += expected;
      else late += expected;
      rows.push({label:s.label, demand:s.demand, supply:s.supply, before, served, shortage, returns:gotBack, clean, dirty, outside, held:outside * p.deposit});
    }
    const demand = p.slots.reduce((sum, s) => sum + s.demand, 0);
    return {rows, demand, issued, returned, unmet, clean, dirty, outside, late, replenished,
      required:requiredInitial(p), held:outside*p.deposit, refunds:returned*p.deposit,
      receivedDeposits:issued*p.deposit, initial:p.initial, rate:p.rate,
      conservation: p.initial + replenished === clean + dirty + outside};
  }
  function normalizeLog(log) {
    if (!log || typeof log !== 'object') throw new Error('実績データが不正です');
    const start = integer(log.start, 0, 100000, '実績開始在庫');
    if (!Array.isArray(log.entries) || log.entries.length > 5000) throw new Error('記録は5000件以内です');
    const entries = log.entries.map((e, i) => {
      if (!e || !TYPES.includes(e.type)) throw new Error(`記録${i + 1}の種別が不正です`);
      return { type:e.type, qty:integer(e.qty, 1, 100000, '記録点数'), at:cleanText(e.at, 32) || '', note:cleanText(e.note, 80) };
    });
    return {start,entries};
  }
  function replayLog(raw, deposit) {
    const log=normalizeLog(raw), fee=integer(deposit,0,10000,'預り金');
    let clean=log.start, out=0, dirty=0, discarded=0, supplied=0, issued=0, returned=0;
    const history=[];
    log.entries.forEach((e,i)=>{
      if(e.type==='issue') {
        if(e.qty>clean) throw new Error(`記録${i+1}: 清潔な在庫が足りません（残 ${clean}）`);
        clean-=e.qty;out+=e.qty;issued+=e.qty;
      } else if (e.type==='return') {
        if(e.qty>out) throw new Error(`記録${i+1}: 貸出中の数を超える返却です（残 ${out}）`);
        out-=e.qty;dirty+=e.qty;returned+=e.qty;
      } else if (e.type==='supply') {clean+=e.qty;supplied+=e.qty;}
      else { if (e.qty>clean) throw new Error(`記録${i+1}: 廃棄数が清潔在庫を超えます`);clean-=e.qty;discarded+=e.qty; }
      history.push({ ...e, clean, out, dirty });
    });
    return {clean,out,dirty,discarded,supplied,issued,returned,history, held:out*fee,
      conservation:log.start+supplied===clean+out+dirty+discarded};
  }
  function appendEntry(log, entry, deposit) {
    const base=normalizeLog(log);
    const e={ type:entry.type, qty:entry.qty, at:entry.at || new Date().toISOString().slice(0,16).replace('T',' '), note:entry.note || '' };
    const next={start:base.start,entries:[...base.entries,e]};
    replayLog(next,deposit);
    return normalizeLog(next);
  }
  function demo() {
    return {plan:{title:'秋の地域マルシェ / リユースカップ',initial:180,rate:85,delay:2,deposit:200,slots:[
      {label:'10:00',demand:25,supply:0},{label:'11:00',demand:45,supply:0},
      {label:'12:00',demand:75,supply:0},{label:'13:00',demand:90,supply:120},
      {label:'14:00',demand:75,supply:0},{label:'15:00',demand:60,supply:120},
      {label:'16:00',demand:45,supply:0},{label:'17:00',demand:20,supply:0}
    ]},log:{start:180,entries:[]}};
  }
  return { normalizePlan, requiredInitial, simulate, normalizeLog, replayLog, appendEntry, demo };
});
