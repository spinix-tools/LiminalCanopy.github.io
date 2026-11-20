/* RETSU SABAKI simulation kernel — no dependencies, no network */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RetsuEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SLOTS = 6, SLOT_MIN = 30, DURATION = 180, SNAP = 10;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const finite = (value, fallback) => Number.isFinite(Number(value)) && value !== '' && value !== null ? Number(value) : fallback;
  const round = (n, digits = 1) => Number(n.toFixed(digits));
  function defaults() {
    return {
      title: '週末の体験ブース', start: '10:00',
      arrivals: [17, 27, 36, 33, 23, 12],
      base: [4, 4, 4, 4, 4, 4],
      plan: [4, 5, 6, 5, 4, 4],
      minutes: 4.5, variation: 30, surge: 20,
      capacity: 18, runs: 80, seed: 4021
    };
  }
  function normalize(raw) {
    const d = defaults(), x = raw && typeof raw === 'object' ? raw : {};
    const arr = (key, lo, hi) => Array.from({length:SLOTS}, (_,i) =>
      clamp(Math.round(finite(Array.isArray(x[key]) ? x[key][i] : undefined, d[key][i])), lo, hi));
    return {
      title: String(x.title || d.title).slice(0,70), start: /^([01]\d|2[0-3]):[0-5]\d$/.test(x.start) ? x.start : d.start,
      arrivals:arr('arrivals',0,150), base:arr('base',1,8), plan:arr('plan',1,8),
      minutes:clamp(finite(x.minutes,d.minutes),0.5,30),
      variation:clamp(finite(x.variation,d.variation),0,90),
      surge:clamp(finite(x.surge,d.surge),0,90),
      capacity:clamp(Math.round(finite(x.capacity,d.capacity)),1,200),
      runs:clamp(Math.round(finite(x.runs,d.runs)),10,300),
      seed:clamp(Math.round(finite(x.seed,d.seed)),1,2147483646)
    };
  }
  function rng32(seed) {
    let state = seed >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function visitorsFor(x, seed) {
    const r = rng32(seed), guests = [];
    for (let s=0;s<SLOTS;s++) {
      const n = Math.max(0, Math.round(x.arrivals[s] * (1 + x.surge/100 * (r()*2-1))));
      for (let i=0;i<n;i++) {
        const t = (s + (i + 0.1 + r()*.8)/Math.max(n,1)) * SLOT_MIN;
        const service = x.minutes * (1 + x.variation/100 * (r()*2-1));
        guests.push({t,service});
      }
    }
    guests.sort((a,b)=>a.t-b.t);
    return guests;
  }
  function percentile(values,p) {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a,b)=>a-b);
    const pos = (sorted.length-1)*p, lo=Math.floor(pos), hi=Math.ceil(pos);
    return sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo);
  }
  function runOnce(guests, staff, capacity) {
    const nServers=Math.max(...staff), ends=Array(nServers).fill(Infinity);
    const waits=[], traces=[], arrivalAt=[], completeAt=[];
    let pos=0, head=0, time=0, peak=0, snapshot=0, closedOpen=0, lastEnd=0;
    const queue=[];
    // Invariant: queue[head..] is FIFO waiting; a finite ends[i] is a busy desk.
    while (pos<guests.length || head<queue.length || ends.some(Number.isFinite) || snapshot<=DURATION) {
      let next=Infinity;
      if (pos<guests.length) next=Math.min(next,guests[pos].t);
      for (const e of ends) if(e<next) next=e;
      if (snapshot<=DURATION) next=Math.min(next,snapshot);
      if (!Number.isFinite(next)) break;
      time=next;
      for (let s=0;s<ends.length;s++) if (ends[s]<=time+1e-8) {lastEnd=Math.max(lastEnd,ends[s]); ends[s]=Infinity;}
      while (pos<guests.length && guests[pos].t<=time+1e-8) queue.push(guests[pos++]);
      const active=staff[Math.min(SLOTS-1,Math.floor(time/SLOT_MIN))];
      for (let s=0;s<active && head<queue.length;s++) {
        if (!Number.isFinite(ends[s])) {
          const guest=queue[head++];
          waits.push(Math.max(0,time-guest.t)); arrivalAt.push(guest.t);
          const end=time+guest.service; ends[s]=end; completeAt.push(end);
        }
      }
      const waiting=queue.length-head;
      peak=Math.max(peak,waiting);
      if (Math.abs(time-snapshot)<1e-7 && snapshot<=DURATION) {
        traces.push(waiting);
        if (snapshot===DURATION) closedOpen=waiting+ends.filter(Number.isFinite).length;
        snapshot+=SNAP;
      }
      // The final slot's staffing continues after closing solely to drain the backlog.
      if (head>500) {queue.splice(0,head);head=0;}
    }
    return {waits,peak,traces,closedOpen,lastEnd,total:guests.length,arrivalAt,completeAt};
  }
  function aggregate(x, schedule, series) {
    const totals={waits:[],peaks:[],closed:[],overtime:[],traces:Array(DURATION/SNAP+1).fill(0)};
    let above=0,total=0, queueOverflow=0;
    for (const guests of series) {
      const r=runOnce(guests,schedule,x.capacity);
      totals.waits.push(...r.waits); totals.peaks.push(r.peak);
      totals.closed.push(r.closedOpen); totals.overtime.push(Math.max(0,r.lastEnd-DURATION));
      r.traces.forEach((q,i)=>totals.traces[i]+=q);
      above+=r.waits.filter(w=>w>15).length;
      total+=r.total;
      if (r.peak>x.capacity) queueOverflow++;
    }
    const avg = a => a.reduce((s,v)=>s+v,0)/Math.max(1,a.length);
    return {
      visitors:round(total/series.length), mean:round(avg(totals.waits)),
      p90:round(percentile(totals.waits,.9)), over15:round(100*above/Math.max(1,total)),
      peak:round(avg(totals.peaks)), peakP90:round(percentile(totals.peaks,.9)),
      overflow:round(100*queueOverflow/series.length),
      closing:round(avg(totals.closed)), overtime:round(avg(totals.overtime)),
      trace:totals.traces.map(v=>round(v/series.length)),
      personHours:round(schedule.reduce((s,n)=>s+n,0)*.5),
    };
  }
  function compare(raw) {
    const x=normalize(raw);
    const samples=Array.from({length:x.runs},(_,i)=>visitorsFor(x,x.seed+i*1013904223));
    const baseline=aggregate(x,x.base,samples);
    const proposal=aggregate(x,x.plan,samples);
    return {config:x,baseline,proposal,
      savedWait:round(baseline.p90-proposal.p90),
      extraHours:round(proposal.personHours-baseline.personHours)};
  }
  function suggest(raw) {
    const x=normalize(raw), samples=Array.from({length:Math.min(40,x.runs)},(_,i)=>visitorsFor(x,x.seed+i*1013904223));
    const current=aggregate(x,x.base,samples);
    let choice=null;
    for (let i=0;i<SLOTS;i++) {
      if (x.base[i]>=8) continue;
      const staff=x.base.slice();staff[i]++;
      const test=aggregate(x,staff,samples);
      const gain=current.p90-test.p90;
      const score=gain + (current.closing-test.closing)*.15 + (current.overflow-test.overflow)*.005;
      if (!choice || score>choice.score) choice={slot:i,staff,score,gain,metric:test};
    }
    return choice && choice.score>0.001 ? choice : null;
  }
  return {SLOTS,SLOT_MIN,DURATION,defaults,normalize,rng32,visitorsFor,runOnce,compare,suggest,percentile};
});