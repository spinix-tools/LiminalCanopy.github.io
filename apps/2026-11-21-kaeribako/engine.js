/* かえり箱 / KAERIBAKO — deterministic, dependency-free planning engine */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.KaeribakoEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_DAYS = 120;
  const MAX_ROUTES = 16;
  const MAX_EXTRAS = 120;

  function integer(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0,10) === value;
  }
  function dayISO(start, offset) {
    const date = new Date(`${start}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0,10);
  }
  function dayOfWeek(start, offset) {
    return new Date(`${dayISO(start,offset)}T00:00:00Z`).getUTCDay();
  }
  function normalize(input) {
    const raw = input && typeof input === 'object' ? input : {};
    const usedIds = new Set();
    const routes = (Array.isArray(raw.routes) ? raw.routes : []).slice(0, MAX_ROUTES).map((r, idx) => {
      r = r && typeof r === 'object' ? r : {};
      let id = String(r.id ?? `r${idx + 1}`).replace(/[^a-zA-Z0-9_-]/g,'').slice(0, 24) || `r${idx + 1}`;
      while(usedIds.has(id)) id += 'x';
      usedIds.add(id);
      return {
        id,
        name: String(r.name ?? `配送先${idx+1}`).trim().slice(0, 36) || `配送先${idx+1}`,
        weekdays: [...new Set((Array.isArray(r.weekdays) ? r.weekdays : []).map(Number).filter(x=>Number.isInteger(x) && x>=0 && x<=6))].sort(),
        qty: integer(r.qty,0,2000,0),
        returnDays: integer(r.returnDays,1,60,4),
        washDays: integer(r.washDays,0,30,1),
        lossPct: integer(r.lossPct,0,100,0),
      };
    });
    const extras = (Array.isArray(raw.extras) ? raw.extras : []).slice(0, MAX_EXTRAS).map((x, i)=>{
      x = x && typeof x === 'object' ? x : {};
      return { id: String(x.id ?? `e${i+1}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0,24) || `e${i+1}`,
        date: String(x.date ?? ''), routeId: String(x.routeId ?? ''), qty: integer(x.qty,0,2000,0) };
    }).filter(x=>validDate(x.date) && routes.some(r=>r.id===x.routeId));
    const what = raw.whatIf && typeof raw.whatIf === 'object' ? raw.whatIf : {};
    return {
      version: 1,
      startDate: validDate(raw.startDate) ? raw.startDate : '2026-11-24',
      days: integer(raw.days,7,MAX_DAYS,35),
      initialStock: integer(raw.initialStock,0,1000000,110),
      routes,
      extras,
      whatIf: {
        extraStock: integer(what.extraStock,0,1000000,0),
        returnDaysCut: integer(what.returnDaysCut,0,30,0),
        washDaysCut: integer(what.washDaysCut,0,30,0),
      }
    };
  }
  function example() {
    return normalize({
      startDate:'2026-11-24', days:35, initialStock:110,
      routes:[
        { id:'shop-a',name:'店舗A（惣菜）', weekdays:[1,3,5],qty:34,returnDays:4,washDays:1,lossPct:3 },
        { id:'shop-b',name:'店舗B（青果）', weekdays:[2,4,6],qty:28,returnDays:6,washDays:1,lossPct:2 },
        { id:'market',name:'直売所', weekdays:[2,5],qty:18,returnDays:3,washDays:2,lossPct:5 },
      ],
      extras:[{id:'e1', date:'2026-12-04',routeId:'shop-b',qty:24}],
      whatIf:{ extraStock:30,returnDaysCut:2,washDaysCut:1 }
    });
  }
  function adjustedRoute(r, what) {
    return { ...r, returnDays: Math.max(1, r.returnDays - what.returnDaysCut), washDays: Math.max(0, r.washDays - what.washDaysCut) };
  }
  function makeSchedule(cfg) {
    const days = Array.from({length:cfg.days}, (_,i)=>({ index:i,date:dayISO(cfg.startDate,i), orders:[] }));
    for(const day of days) {
      const dow = dayOfWeek(cfg.startDate,day.index);
      cfg.routes.forEach(r=>{
        const extra = cfg.extras.filter(x=>x.routeId===r.id && x.date===day.date).reduce((a,x)=>a+x.qty,0);
        const regular = r.weekdays.includes(dow) ? r.qty : 0;
        if (regular+extra > 0) day.orders.push({routeId:r.id,routeName:r.name,regular,extra,qty:regular+extra});
      });
    }
    return days;
  }
  function recovered(qty, lossPct) {
    return Math.max(0, Math.min(qty, Math.round(qty*(100-lossPct)/100)));
  }
  function requiredStock(config, which='base') {
    const cfg=normalize(config), scenario=which==='whatIf';
    const routes = new Map(cfg.routes.map(r=>[r.id,scenario?adjustedRoute(r,cfg.whatIf):r]));
    const arrivals = Array(cfg.days+92).fill(0);
    let outstanding=0,peak=0, peakDay=0, totalDemand=0;
    const schedule=makeSchedule(cfg);
    for(const day of schedule) {
      outstanding-=arrivals[day.index];
      for(const o of day.orders) {
        const r=routes.get(o.routeId);
        outstanding+=o.qty;
        totalDemand+=o.qty;
        const availableDay=day.index+r.returnDays+r.washDays;
        if(availableDay < arrivals.length) arrivals[availableDay]+=recovered(o.qty,r.lossPct);
      }
      if(outstanding>peak) {peak=outstanding;peakDay=day.index;}
    }
    return { required:peak, peakDate:dayISO(cfg.startDate,peakDay),totalDemand};
  }
  function simulate(config, which='base', overrideStock=null) {
    const cfg=normalize(config), scenario=which==='whatIf';
    const what=scenario?cfg.whatIf:{extraStock:0,returnDaysCut:0,washDaysCut:0};
    const initial=overrideStock===null ? cfg.initialStock+what.extraStock : integer(overrideStock,0,2000000,0);
    const routeMap=new Map(cfg.routes.map(r=>[r.id,adjustedRoute(r,what)]));
    const arrivals=Array.from({length:cfg.days+92},()=>[]);
    const records=[], routeStats=Object.fromEntries(cfg.routes.map(r=>[r.id,{id:r.id,name:r.name,demand:0,shipped:0,shortage:0,lost:0}]));
    let available=initial,cumulativeLoss=0,returnedTotal=0,shippedTotal=0,shortageTotal=0,demandTotal=0;
    let daysWithShortage=0, firstShortage=null;
    for(const day of makeSchedule(cfg)) {
      const incoming=arrivals[day.index];
      const returned=incoming.reduce((s,x)=>s+x.qty,0);
      returnedTotal+=returned;
      available+=returned;
      const opening=available;
      let demand=0,shipped=0,shortage=0;
      for(const order of day.orders) {
        const r=routeMap.get(order.routeId);
        const actual=Math.min(available,order.qty);
        const unmet=order.qty-actual;
        const recoverQty=recovered(actual,r.lossPct);
        const lost=actual-recoverQty;
        const backDay=day.index+r.returnDays;
        const readyDay=backDay+r.washDays;
        if(recoverQty) arrivals[readyDay].push({qty:recoverQty,backDay,routeId:r.id});
        available-=actual;
        demand+=order.qty;shipped+=actual;shortage+=unmet;cumulativeLoss+=lost;
        const stat=routeStats[r.id];
        stat.demand+=order.qty;stat.shipped+=actual;stat.shortage+=unmet;stat.lost+=lost;
      }
      if(shortage) {daysWithShortage++;if(!firstShortage) firstShortage=day.date;}
      shippedTotal+=shipped;shortageTotal+=shortage;demandTotal+=demand;
      // Recovered crates, still at the customer / on the return leg, vs at the washing station.
      let inTransit=0,inWash=0;
      for(let t=day.index+1;t<arrivals.length;t++) for(const a of arrivals[t]) {
        if(day.index < a.backDay) inTransit+=a.qty;
        else inWash+=a.qty;
      }
      records.push({index:day.index,date:day.date,weekday:dayOfWeek(cfg.startDate,day.index),opening,
        returned,demand,shipped,shortage,available,inTransit,inWash,cumulativeLoss});
    }
    const need=requiredStock(cfg,which);
    return {
      initial,records,routeStats:Object.values(routeStats),daysWithShortage,firstShortage,
      totalDemand:demandTotal,totalShipped:shippedTotal,totalShortage:shortageTotal,
      totalReturned:returnedTotal,expectedLoss:cumulativeLoss,
      requiredStock:need.required,peakDate:need.peakDate,additionalNeeded:Math.max(0,need.required-initial),
      serviceRate:demandTotal?shippedTotal/demandTotal:1,
    };
  }
  function compare(config) {
    const cfg=normalize(config);
    return {config:cfg,base:simulate(cfg),whatIf:simulate(cfg,'whatIf')};
  }
  function csvRows(records) {
    const head=['日付','曜日番号','返却済み入荷','当日需要','出荷','欠品','出荷後手元','戻り待ち','洗浄待ち','累積想定損失'];
    const data=records.map(r=>[r.date,r.weekday,r.returned,r.demand,r.shipped,r.shortage,r.available,r.inTransit,r.inWash,r.cumulativeLoss]);
    return [head,...data].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
  }
  return {integer,validDate,dayISO,dayOfWeek,normalize,example,makeSchedule,recovered,requiredStock,simulate,compare,csvRows};
});
