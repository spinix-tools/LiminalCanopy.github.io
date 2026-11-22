/* KITMAWASHI engine — pure, dependency-free, MIT. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.KitEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX = {items: 45, kits: 35, bookings: 120};
  const DAY_MS = 86400000;
  function day(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return NaN;
    const n = Date.parse(s + 'T00:00:00.000Z');
    return Number.isFinite(n) && new Date(n).toISOString().slice(0,10) === s ? Math.floor(n / DAY_MS) : NaN;
  }
  function date(n) { return new Date(n * DAY_MS).toISOString().slice(0,10); }
  function plus(s, offset) { return date(day(s) + offset); }
  function safeName(v, max=54) { return String(v ?? '').replace(/[\r\n\t<>]/g, ' ').trim().slice(0,max); }
  function bounded(v, lo, hi) {
    const x = Number(v);
    return Number.isInteger(x) && x >= lo && x <= hi ? x : NaN;
  }
  function validate(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items) || !Array.isArray(raw.kits) || !Array.isArray(raw.bookings)) throw new Error('JSONの構造が正しくありません。');
    for (const kind of ['items','kits','bookings']) if (raw[kind].length > MAX[kind]) throw new Error('登録件数の上限を超えています: ' + kind);
    const unique = (rows, label) => {
      const ids = new Set();
      for (const r of rows) {
        if (!r || typeof r.id !== 'string' || !/^[a-zA-Z0-9_-]{1,36}$/.test(r.id) || ids.has(r.id)) throw new Error(label + 'のIDに重複または不正があります。');
        ids.add(r.id);
      }
    };
    unique(raw.items,'部品'); unique(raw.kits,'キット'); unique(raw.bookings,'予約');
    const items = raw.items.map(x => {
      const name = safeName(x.name), qty = bounded(x.qty, 0, 999);
      if (!name || !Number.isFinite(qty)) throw new Error('部品名または在庫数が不正です。');
      return {id:x.id, name, qty};
    });
    const itemIds = new Set(items.map(x=>x.id));
    const kits = raw.kits.map(x => {
      const name=safeName(x.name), parts={};
      if (!name || !x.parts || typeof x.parts !== 'object' || Array.isArray(x.parts)) throw new Error('キット構成が不正です。');
      for (const [id, n] of Object.entries(x.parts)) {
        if (!itemIds.has(id) || !Number.isFinite(bounded(n,1,99))) throw new Error('キットに不明な部品または不正な数量があります。');
        parts[id]=bounded(n,1,99);
      }
      if (Object.keys(parts).length===0) throw new Error('キットには部品を1つ以上登録してください。');
      return {id:x.id,name,parts};
    });
    const kitIds = new Set(kits.map(x=>x.id));
    const bookings=raw.bookings.map(x => {
      const name=safeName(x.name,60), a=day(x.start), z=day(x.end), qty=bounded(x.qty,1,40);
      if (!name || !kitIds.has(x.kitId) || !Number.isFinite(a) || !Number.isFinite(z) || a>z || z-a>89 || !Number.isFinite(qty) || !['confirmed','proposal'].includes(x.status)) throw new Error('予約の日付・構成・数量が不正です（期間は90日以内）。');
      return {id:x.id,name,kitId:x.kitId,start:x.start,end:x.end,qty,status:x.status};
    });
    return {items,kits,bookings};
  }
  function demand(data, booking) {
    const kit = data.kits.find(k=>k.id===booking.kitId);
    if (!kit) return {};
    return Object.fromEntries(Object.entries(kit.parts).map(([id,n])=>[id,n*booking.qty]));
  }
  function loadAt(data, bookings, d) {
    const used = {};
    for (const b of bookings) {
      if (d < day(b.start) || d > day(b.end)) continue;
      for (const [id,n] of Object.entries(demand(data,b))) used[id]=(used[id]||0)+n;
    }
    return used;
  }
  function issues(data, bookings) {
    const points=new Set();
    for (const b of bookings) for(let d=day(b.start);d<=day(b.end);d++) points.add(d);
    const out=[];
    const stock=Object.fromEntries(data.items.map(x=>[x.id,x.qty]));
    for (const d of [...points].sort((a,b)=>a-b)) {
      const used=loadAt(data,bookings,d);
      for (const [id,n] of Object.entries(used)) {
        if (n>stock[id]) out.push({date:date(d),itemId:id,used:n,stock:stock[id],short:n-stock[id]});
      }
    }
    return out;
  }
  function assess(data, b) {
    const confirmed=data.bookings.filter(x=>x.status==='confirmed' && x.id!==b.id);
    const collisions=issues(data,[...confirmed,b]).filter(x=>day(x.date)>=day(b.start) && day(x.date)<=day(b.end));
    const baseline=issues(data,confirmed);
    const baselineSet=new Set(baseline.map(x=>x.date+'|'+x.itemId));
    const induced=collisions.filter(x=>!baselineSet.has(x.date+'|'+x.itemId) || x.used> (baseline.find(y=>y.date===x.date&&y.itemId===x.itemId)?.used||0));
    return {ok:collisions.length===0, collisions, induced};
  }
  function suggestion(data,b,limit=21) {
    const duration=day(b.end)-day(b.start);
    for(let offset=1;offset<=limit;offset++) {
      const start=plus(b.start,offset), end=plus(start,duration);
      if (assess(data,{...b,start,end}).ok) return {start,end,offset};
    }
    return null;
  }
  function analyse(data) {
    const confirmed=data.bookings.filter(b=>b.status==='confirmed');
    const proposals=data.bookings.filter(b=>b.status==='proposal');
    return {
      confirmedIssues:issues(data,confirmed),
      allIssues:issues(data,data.bookings),
      proposals:proposals.map(b=>({id:b.id,...assess(data,b),suggest:suggestion(data,b)}))
    };
  }
  function demo(today) {
    const origin=Number.isFinite(day(today)) ? today : new Date().toLocaleDateString('sv-SE');
    const items=[
      {id:'battery',name:'予備バッテリー',qty:5}, {id:'mic',name:'ワイヤレスマイク',qty:3},
      {id:'tripod',name:'三脚',qty:4}, {id:'light',name:'LEDライト',qty:3}, {id:'case',name:'ハードケース',qty:2}
    ];
    const kits=[
      {id:'interview',name:'インタビューセット',parts:{battery:2,mic:1,tripod:1}},
      {id:'stream',name:'配信セット',parts:{battery:2,mic:2,tripod:1,light:1,case:1}},
      {id:'lighting',name:'照明セット',parts:{battery:1,light:2,tripod:1}}
    ];
    const bookings=[
      {id:'b1',name:'地域講座',kitId:'interview',start:plus(origin,1),end:plus(origin,3),qty:1,status:'confirmed'},
      {id:'b2',name:'公開収録',kitId:'stream',start:plus(origin,3),end:plus(origin,4),qty:1,status:'confirmed'},
      {id:'b3',name:'映像研究会（候補）',kitId:'interview',start:plus(origin,3),end:plus(origin,5),qty:1,status:'proposal'},
      {id:'b4',name:'校内展示（候補）',kitId:'lighting',start:plus(origin,6),end:plus(origin,7),qty:1,status:'proposal'}
    ];
    return {items,kits,bookings};
  }
  return {day,date,plus,safeName,validate,demand,loadAt,issues,assess,suggestion,analyse,demo,MAX};
});
