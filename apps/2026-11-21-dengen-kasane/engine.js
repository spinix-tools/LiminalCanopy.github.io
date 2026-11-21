/* DENGEN KASANE — deterministic offline planning core. No wiring advice. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.DengenEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STEP = 15;
  const MAX_MINUTES = 24 * 60;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+v) ? +v : lo));
  const int = (v, lo, hi) => Math.trunc(clamp(v, lo, hi));
  const roundStep = v => Math.round(v / STEP) * STEP;
  const id = () => Math.random().toString(36).slice(2, 10);
  const tstr = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const mins = t => { const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : NaN; };
  const sample = () => ({
    version: 1, title: '週末マルシェ / A区画', from: 9 * 60, to: 17 * 60, limitW: 2450, reservePct: 10,
    circuits: [
      {id: 'A', name: 'A：調理系', capW: 1500},
      {id: 'B', name: 'B：冷蔵・照明', capW: 1500}
    ],
    devices: [
      {id:'d1', name:'ホットプレート', circuit:'A', qty:1, watts:1100, peakWatts:1100, start:10*60, end:15*60, flexible:false, slack:0},
      {id:'d2', name:'湯沸かしポット', circuit:'A', qty:1, watts:1200, peakWatts:1200, start:11*60, end:11*60+30, flexible:true, slack:90},
      {id:'d3', name:'保温器', circuit:'A', qty:1, watts:160, peakWatts:160, start:10*60, end:16*60, flexible:false, slack:0},
      {id:'d4', name:'冷蔵ショーケース', circuit:'B', qty:1, watts:280, peakWatts:600, start:9*60, end:17*60, flexible:false, slack:0},
      {id:'d5', name:'照明・レジ', circuit:'B', qty:1, watts:100, peakWatts:100, start:9*60, end:17*60, flexible:false, slack:0},
      {id:'d6', name:'試食トースター', circuit:'B', qty:1, watts:500, peakWatts:500, start:11*60, end:12*60, flexible:true, slack:60}
    ]
  });
  const esc = x => String(x ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('データ形式が正しくありません。');
    const from = roundStep(int(raw.from, 0, 1425));
    const to = roundStep(int(raw.to, 15, 1440));
    if (to <= from) throw Error('終了時刻は開始時刻より後にしてください。');
    const sourceCircuits = Array.isArray(raw.circuits) ? raw.circuits : [];
    if (!sourceCircuits.length || sourceCircuits.length > 8) throw Error('回路数は1〜8にしてください。');
    const seen = new Set();
    const circuits = sourceCircuits.map((c, i) => {
      let key = String(c.id ?? '').trim();
      if (!key || seen.has(key)) key = `C${i+1}`;
      seen.add(key);
      return {id: key, name:String(c.name ?? `系統${i+1}`).slice(0,45), capW:int(c.capW, 100, 30000)};
    });
    const sourceDevices = Array.isArray(raw.devices) ? raw.devices : [];
    if (sourceDevices.length > 80) throw Error('機器は最大80件です。');
    const dseen = new Set();
    const devices = sourceDevices.map((d,i) => {
      let key=String(d.id??'').trim(); if(!key || dseen.has(key)) key=`dev${i+1}`; dseen.add(key);
      const start=roundStep(int(d.start,from,to-STEP));
      const end=roundStep(int(d.end,from+STEP,to));
      if(end<=start) throw Error(`${String(d.name??`機器${i+1}`)}: 終了時刻が開始時刻以前です。`);
      return {id:key,name:String(d.name??`機器${i+1}`).slice(0,70),circuit:seen.has(String(d.circuit))?String(d.circuit):circuits[0].id,
        qty:int(d.qty,1,20), watts:int(d.watts,0,15000),peakWatts:int(d.peakWatts??d.watts,0,30000),start,end,
        flexible:!!d.flexible,slack:roundStep(int(d.slack,0,240))};
    });
    return {version:1,title:String(raw.title??'新しい計画').slice(0,100),from,to,limitW:int(raw.limitW,100,100000),reservePct:int(raw.reservePct,0,50),circuits,devices};
  }
  function makeSlots(plan) {
    const p=normalize(plan), count=(p.to-p.from)/STEP;
    const slots=Array.from({length:count}, (_,i)=>({time:p.from+i*STEP, byCircuit:Object.fromEntries(p.circuits.map(c=>[c.id,0])), total:0, running:[], peakDevice:[]}));
    for(const d of p.devices) {
      for(const s of slots) {
        if(s.time>=d.start && s.time<d.end) {
          const first=s.time===d.start;
          // Conservative 15-min planning bin: assume nameplate start peak lasts through bin.
          const w=(first?Math.max(d.watts,d.peakWatts):d.watts)*d.qty;
          s.byCircuit[d.circuit]+=w; s.total+=w; s.running.push(d.id); if(first && d.peakWatts>d.watts) s.peakDevice.push(d.id);
        }
      }
    }
    return {p,slots};
  }
  function analyze(raw) {
    const {p,slots}=makeSlots(raw);
    const allowed=Math.floor(p.limitW*(1-p.reservePct/100));
    const warnings=[], overloadAt=[];
    let maxTotal=0, maxRatio=0, totalExcess=0, overloadSlots=0, energyWh=0;
    const circuitMax=Object.fromEntries(p.circuits.map(c=>[c.id,0]));
    const circuitLoad=Object.fromEntries(p.circuits.map(c=>[c.id,0]));
    slots.forEach(s=>{
      energyWh+=s.total*STEP/60; maxTotal=Math.max(maxTotal,s.total);
      let issue=false;
      if(s.total>allowed){issue=true;totalExcess+=s.total-allowed;maxRatio=Math.max(maxRatio,s.total/allowed);}
      for(const c of p.circuits){
        const load=s.byCircuit[c.id]; circuitMax[c.id]=Math.max(circuitMax[c.id],load); circuitLoad[c.id]+=load*STEP/60;
        if(load>c.capW){issue=true;totalExcess+=load-c.capW;maxRatio=Math.max(maxRatio,load/c.capW);}
      }
      if(issue){overloadSlots++;overloadAt.push(s.time);}
    });
    for(const c of p.circuits){
      if(circuitMax[c.id]>c.capW) warnings.push(`${c.name} が最大 ${circuitMax[c.id].toLocaleString()}W（上限 ${c.capW.toLocaleString()}W）`);
    }
    if(maxTotal>allowed)warnings.push(`会場全体は最大 ${maxTotal.toLocaleString()}W（予備率込み目安 ${allowed.toLocaleString()}W）`);
    for(const d of p.devices){
      if(d.qty*d.peakWatts>p.circuits.find(c=>c.id===d.circuit).capW)
        warnings.push(`「${d.name}」単体の起動時仮定 ${d.qty*d.peakWatts}W が系統上限を超過`);
    }
    return {p,slots,allowed,maxTotal,circuitMax,circuitLoad,overloadSlots,overloadAt,totalExcess,maxRatio,energyWh,warnings,
      score:overloadSlots*1e6+totalExcess*100+maxRatio*100};
  }
  function candidateStarts(p,d) {
    const duration=d.end-d.start;
    const left=Math.max(p.from,d.start-d.slack),right=Math.min(p.to-duration,d.start+d.slack);
    const result=[];
    for(let t=left;t<=right;t+=STEP)result.push(t);
    return result;
  }
  function suggest(raw) {
    const original=normalize(raw), initial=analyze(original);
    let bestPlan=structuredCopy(original), current=initial;
    // Deterministic coordinate descent, no false claim of global optimum.
    for(let pass=0;pass<5;pass++) {
      let changed=false;
      const sequence=[...bestPlan.devices].filter(d=>d.flexible&&d.slack>=STEP).sort((a,b)=>(b.watts*b.qty-a.watts*a.qty)||a.id.localeCompare(b.id));
      for(const device of sequence){
        const idx=bestPlan.devices.findIndex(d=>d.id===device.id);
        const from=bestPlan.devices[idx].start, duration=bestPlan.devices[idx].end-from;
        let bestStart=from, bestValue=current.score;
        // Anchor every proposed shift to the ORIGINAL user-entered start time.
        // Otherwise repeated passes can drift past the permitted ±slack.
        const origin=original.devices.find(x=>x.id===device.id);
        for(const time of candidateStarts(bestPlan,origin)){
          if(time===from)continue;
          const test=structuredCopy(bestPlan); test.devices[idx].start=time;test.devices[idx].end=time+duration;
          const a=analyze(test);
          if(a.score<bestValue-0.000001){bestValue=a.score;bestStart=time;}
        }
        if(bestStart!==from){ bestPlan.devices[idx].start=bestStart;bestPlan.devices[idx].end=bestStart+duration; current=analyze(bestPlan);changed=true; }
      }
      if(!changed)break;
    }
    const shifts=original.devices.flatMap(d=>{const after=bestPlan.devices.find(x=>x.id===d.id);return after.start!==d.start?[{id:d.id,name:d.name,from:d.start,to:after.start}]:[];});
    return {original:initial,plan:bestPlan,result:current,shifts,improved:current.score<initial.score};
  }
  function structuredCopy(v){return JSON.parse(JSON.stringify(v));}
  function toCSV(raw){
    const p=normalize(raw),head=['機器','系統','台数','通常W/台','起動時想定W/台','開始','終了','移動可','許容分'],
    quote=x=>{ const t=String(x??''); const guarded=/^[\s]*[=+@-]/.test(t)?'\''+t:t; return '"'+guarded.replace(/"/g,'""')+'"'; };
    const rows=p.devices.map(d=>[d.name,p.circuits.find(c=>c.id===d.circuit)?.name??'',d.qty,d.watts,d.peakWatts,tstr(d.start),tstr(d.end),d.flexible?'可':'固定',d.slack]);
    return '\uFEFF'+[head,...rows].map(row=>row.map(quote).join(',')).join('\r\n');
  }
  return {STEP,clamp,int,roundStep,tstr,mins,sample,esc,normalize,makeSlots,analyze,suggest,toCSV,structuredCopy,candidateStarts};
});
