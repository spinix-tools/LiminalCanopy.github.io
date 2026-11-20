/* 列予報 / RETSU YOHOU — independent, deterministic queue model. MIT License. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.RetsuEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const BLOCK = 15, MAX_PEOPLE = 10000;
  const DEFAULT = Object.freeze({
    title: '週末ミニフェス｜入場受付', start: '10:00', serviceMinutes: 2.2,
    targetWait: 15, seed: 417, slots: [
      [12,3,3],[24,3,4],[39,4,6],[48,4,7],
      [50,4,7],[45,4,7],[34,4,5],[25,4,5],
      [20,4,4],[15,3,4],[12,3,3],[10,2,2]
    ].map(([arrivals,a,b])=>({arrivals,a,b}))
  });
  const clone = v => JSON.parse(JSON.stringify(v));
  const clamp = (v, min, max, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max,Math.max(min,n)) : fallback;
  };
  function normalize(raw) {
    const s = raw && typeof raw === 'object' ? raw : DEFAULT;
    const incoming = Array.isArray(s.slots) && s.slots.length ? s.slots.slice(0,20) : DEFAULT.slots;
    const slots = incoming.map(r=>({
      arrivals: Math.round(clamp(r && r.arrivals,0,500,0)),
      a: Math.round(clamp(r && r.a,0,12,0)),
      b: Math.round(clamp(r && r.b,0,12,0))
    }));
    const total = slots.reduce((n,r)=>n+r.arrivals,0);
    if (total > MAX_PEOPLE) throw new Error('合計来場者は10,000人以下にしてください');
    const start = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s.start)) ? s.start : '10:00';
    return {title:String(s.title || '受付計画').slice(0,80),start,
      serviceMinutes:Math.round(clamp(s.serviceMinutes,0.5,15,2)*10)/10,
      targetWait:Math.round(clamp(s.targetWait,1,90,15)),
      seed:Math.round(clamp(s.seed,1,2147483646,417)), slots};
  }
  function rng(seed){
    let n = seed>>>0;
    return ()=>((n = (Math.imul(n,1664525)+1013904223)>>>0) / 4294967296);
  }
  function people(s) {
    const rand=rng(s.seed), list=[];
    for(let i=0;i<s.slots.length;i++){
      for(let j=0;j<s.slots[i].arrivals;j++){
        const arrive=i*BLOCK+Math.floor(rand()*BLOCK);
        // Each visitor gets a fixed service duration across A/B, making comparisons fair.
        const work=Math.max(1,Math.ceil(s.serviceMinutes*(0.7+rand()*0.6)));
        list.push({arrive,work});
      }
    }
    return list.sort((x,y)=>x.arrive-y.arrive);
  }
  function percentile(values, percent) {
    if (!values.length) return null;
    const v=values.slice().sort((a,b)=>a-b);
    return v[Math.ceil(percent*v.length)-1];
  }
  function simulate(raw, scenario='a', provided=null) {
    const s=normalize(raw);
    if(scenario!=='a' && scenario!=='b') throw new Error('scenarioはa/bのみ');
    const visitors=provided||people(s), n=visitors.length;
    const duration=s.slots.length*BLOCK, horizon=duration+180;
    const line=[], completions=[], waits=[];
    const staffMinutes=s.slots.reduce((sum,slot)=>sum+slot[scenario]*BLOCK,0);
    let arrivalsSeen=0,started=0,completed=0,peakQueue=0,peakAt=0,lastFinished=0;
    const busy=[];
    for(let t=0;t<=horizon;t++){
      while(arrivalsSeen<n && visitors[arrivalsSeen].arrive<=t) arrivalsSeen++;
      for(let j=busy.length-1;j>=0;j--){
        if(busy[j].end<=t){
          const done=busy.splice(j,1)[0];
          completed++;lastFinished=Math.max(lastFinished,done.end);
          waits.push(done.wait);
        }
      }
      const index=Math.min(Math.floor(t/BLOCK),s.slots.length-1);
      const active=s.slots[index][scenario];
      if(t<horizon) while(busy.length<active && started<arrivalsSeen){
        const visitor=visitors[started++];
        busy.push({end:t+visitor.work,wait:t-visitor.arrive});
      }
      const queued=arrivalsSeen-started;
      if(queued>peakQueue){peakQueue=queued;peakAt=t;}
      if((t+1)%BLOCK===0 && t<duration){
        line.push({slot:Math.floor(t/BLOCK),queue:queued,served:completed,
          staff:s.slots[Math.floor(t/BLOCK)][scenario]});
      }
      if(completed===n && t>=duration) break;
    }
    return {scenario,arrivals:n,completed,unfinished:n-completed,
      waiting:arrivalsSeen-started,processing:busy.length,
      avgWait:waits.length?waits.reduce((a,b)=>a+b,0)/waits.length:null,
      p95:percentile(waits,0.95),maxWait:waits.length?Math.max(...waits):null,
      peakQueue,peakAt,staffMinutes,line,lastFinished,
      overtimeMinutes:Math.max(0,lastFinished-duration), duration,
      caveat: '1分粒度・先着順・均一な受付窓口・時間帯ごとのスタッフ数・到着分布を仮定した概算です。'};
  }
  function score(r) {
    // Outstanding arrivals strongly dominate: don't hide a backlog behind a low p95.
    return r.unfinished*10000 + (r.p95??180)*50 + r.peakQueue*0.5 + r.staffMinutes*0.025;
  }
  function propose(raw, maxAdds=48) {
    const s=normalize(raw), arrivals=people(s);
    const current=clone(s);
    current.slots.forEach(r=>r.b=r.a);
    let result=simulate(current,'b',arrivals), steps=0;
    const history=[];
    while(steps<maxAdds && (result.unfinished>0 || result.p95===null || result.p95>s.targetWait)){
      let best=null,base=score(result);
      for(let i=0;i<current.slots.length;i++){
        if(current.slots[i].b>=12)continue;
        current.slots[i].b++;
        const candidate=simulate(current,'b',arrivals);
        const value=score(candidate);
        current.slots[i].b--;
        if(value<base-0.00001 && (!best || value<best.value))best={i,result:candidate,value};
      }
      if(!best) break;
      current.slots[best.i].b++; result=best.result;steps++;
      history.push(best.i);
    }
    return {slots:current.slots.map(r=>r.b),result,steps,
      reached:result.unfinished===0 && result.p95!==null && result.p95<=s.targetWait,history};
  }
  function hhmm(start, minutes) {
    const [h,m]=start.split(':').map(Number);
    const total=(h*60+m+minutes)%(24*60);
    return String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0');
  }
  function csv(raw,resA,resB) {
    const s=normalize(raw);
    const escape=v=>'"'+String(v).replace(/"/g,'""')+'"';
    return '\uFEFF'+['時刻','来場予測(人)','A受付人数','B受付人数','A待機人数(区間末)','B待機人数(区間末)'].map(escape).join(',')+'\r\n'+s.slots.map((slot,i)=>[hhmm(s.start,i*BLOCK),slot.arrivals,slot.a,slot.b,resA.line[i]?.queue??0,resB.line[i]?.queue??0].map(escape).join(',')).join('\r\n')+'\r\n';
  }
  return {DEFAULT, BLOCK, normalize,simulate,propose,people,percentile,hhmm,csv,clone};
});