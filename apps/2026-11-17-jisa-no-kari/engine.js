/* 時差の借り / JISA NO KARI — pure time-zone-aware scheduling engine (MIT). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.JisaEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ZONES = [
    { label:'東京', zone:'Asia/Tokyo' }, { label:'大阪', zone:'Asia/Tokyo' },
    { label:'ソウル', zone:'Asia/Seoul' }, { label:'シンガポール', zone:'Asia/Singapore' },
    { label:'上海', zone:'Asia/Shanghai' }, { label:'ムンバイ', zone:'Asia/Kolkata' },
    { label:'ドバイ', zone:'Asia/Dubai' }, { label:'ロンドン', zone:'Europe/London' },
    { label:'パリ', zone:'Europe/Paris' }, { label:'ベルリン', zone:'Europe/Berlin' },
    { label:'ニューヨーク', zone:'America/New_York' }, { label:'シカゴ', zone:'America/Chicago' },
    { label:'ロサンゼルス', zone:'America/Los_Angeles' }, { label:'サンパウロ', zone:'America/Sao_Paulo' },
    { label:'シドニー', zone:'Australia/Sydney' }, { label:'オークランド', zone:'Pacific/Auckland' },
  ];
  const DEFAULTS = [
    { id:'t', label:'東京', zone:'Asia/Tokyo', start:'09:00', end:'18:00' },
    { id:'l', label:'ロンドン', zone:'Europe/London', start:'09:00', end:'18:00' },
    { id:'n', label:'ニューヨーク', zone:'America/New_York', start:'09:00', end:'18:00' },
  ];
  const dtfCache = new Map();
  function formatter(zone) {
    if (!dtfCache.has(zone)) dtfCache.set(zone, new Intl.DateTimeFormat('en-GB', {
      timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', hourCycle:'h23', weekday:'short'
    }));
    return dtfCache.get(zone);
  }
  function parts(ms, zone) {
    const obj = {};
    for (const part of formatter(zone).formatToParts(new Date(ms))) if (part.type !== 'literal') obj[part.type] = part.value;
    return {date:`${obj.year}-${obj.month}-${obj.day}`, time:`${obj.hour}:${obj.minute}`,
      hour:Number(obj.hour), minute:Number(obj.minute), weekday:obj.weekday,
      label:`${obj.month}/${obj.day} ${obj.hour}:${obj.minute}`};
  }
  function parseDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('日付はYYYY-MM-DDで入力してください。');
    const ms=Date.parse(iso+'T00:00:00Z');
    if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0,10)!==iso) throw new Error('日付が正しくありません。');
    return ms;
  }
  function plusDays(iso, n) { return new Date(parseDate(iso)+n*86400000).toISOString().slice(0,10); }
  function minutes(str) {
    if (!/^([01]\d|2[0-3]):(00|15|30|45)$/.test(str)) throw new Error('時間は15分単位のHH:MMで入力してください。');
    const [h,m]=str.split(':').map(Number); return h*60+m;
  }
  function validate(config) {
    if (!config || !Array.isArray(config.people) || config.people.length<2 || config.people.length>6) throw new Error('拠点は2〜6件にしてください。');
    parseDate(config.date);
    if (!Number.isInteger(config.weeks)||config.weeks<1||config.weeks>8) throw new Error('回数は1〜8回です。');
    if (![30,60,90].includes(config.duration)) throw new Error('会議時間は30、60、90分です。');
    const ids=new Set();
    config.people.forEach(p=>{
      if (!p.id || ids.has(p.id) || typeof p.label!=='string'||!p.label.trim()||p.label.length>40) throw new Error('拠点の名前またはIDが不正です。');
      ids.add(p.id);
      if (!ZONES.some(z=>z.zone===p.zone)) throw new Error('未対応のタイムゾーンです。');
      if (minutes(p.end)<=minutes(p.start)) throw new Error('勤務終了は開始より後にしてください（深夜をまたぐ勤務は非対応）。');
    });
    if (!config.people.some(p=>p.id===config.baseId)) throw new Error('基準拠点を選んでください。');
    return true;
  }
  // Enumerate actual UTC instants and select those whose *local* date matches.
  // This is safe across skipped or repeated clock hours at DST transitions.
  function candidates(date, zone, duration) {
    const midnight=parseDate(date), out=[];
    for (let t=midnight-16*3600000;t<midnight+40*3600000;t+=30*60000) {
      const p=parts(t,zone);
      if (p.date===date && p.minute%30===0) out.push(t);
    }
    return out;
  }
  // Non-working 15-minute slices receive increasing costs. Local weekend
  // costs are based on each participant's date, not the organizer's date.
  function burden(startMs, duration, person) {
    const workStart=minutes(person.start), workEnd=minutes(person.end);
    let cost=0, outMinutes=0, nightMinutes=0, weekendMinutes=0;
    for(let delta=0;delta<duration;delta+=15) {
      const p=parts(startMs+delta*60000, person.zone);
      const mm=p.hour*60+p.minute;
      const weekend=p.weekday==='Sat'||p.weekday==='Sun';
      const out=mm<workStart||mm>=workEnd;
      const night=mm<7*60||mm>=22*60;
      if (out) {cost+=3;outMinutes+=15;}
      if (night) {cost+=9;nightMinutes+=15;}
      if (weekend) {cost+=12;weekendMinutes+=15;}
      // Tiny tie break promotes midday and avoids unneeded 9am / 6pm edges.
      if (!out && !weekend) cost+=Math.abs(mm+7.5-13*60)/720;
    }
    return {cost:Math.round(cost*100)/100,outMinutes,nightMinutes,weekendMinutes};
  }
  function planRank(totals) {
    const max=Math.max(...totals), min=Math.min(...totals), sum=totals.reduce((a,b)=>a+b,0);
    return max*5 + (max-min)*2 + sum*.25;
  }
  function build(config) {
    validate(config);
    const base=config.people.find(p=>p.id===config.baseId);
    const weekly=[];
    for (let w=0;w<config.weeks;w++) {
      const date=plusDays(config.date,w*7);
      let rows=candidates(date,base.zone,config.duration).map(utc=>{
        const costs=config.people.map(p=>burden(utc,config.duration,p));
        return {utc, costs, total:costs.reduce((s,x)=>s+x.cost,0), worst:Math.max(...costs.map(x=>x.cost))};
      });
      rows.sort((a,b)=>a.total-b.total || a.worst-b.worst || a.utc-b.utc);
      if (!rows.length) throw new Error('該当する開始時刻がありません。');
      weekly.push({date,rows});
    }
    const comfort=weekly.map(w=>w.rows[0]);
    // Beam search maintains diverse accumulated-burden profiles, not just best
    // immediate slot; capped search is a heuristic, not a global optimum proof.
    let beam=[{totals:config.people.map(()=>0),chosen:[],rank:0}];
    for(let w=0;w<weekly.length;w++) {
      const rows=weekly[w].rows;
      const shortlist=new Map();
      rows.slice(0,24).forEach(r=>shortlist.set(r.utc,r));
      [...rows].sort((a,b)=>a.worst-b.worst||a.total-b.total).slice(0,12).forEach(r=>shortlist.set(r.utc,r));
      const next=[];
      for(const state of beam) for(const slot of shortlist.values()) {
        const totals=state.totals.map((v,i)=>v+slot.costs[i].cost);
        next.push({totals,chosen:[...state.chosen,slot],rank:planRank(totals)});
      }
      next.sort((a,b)=>a.rank-b.rank || a.chosen.reduce((s,x)=>s+x.total,0)-b.chosen.reduce((s,x)=>s+x.total,0));
      const unique=new Set(); const kept=[];
      // Keep some variety via rounded cost-profile bucketing.
      for(const state of next) {
        const key=state.totals.map(x=>Math.round(x/4)).join('/');
        if(unique.has(key)) continue;
        unique.add(key);kept.push(state);
        if(kept.length>=160) break;
      }
      beam=kept;
    }
    const fair=beam[0].chosen;
    return {
      comfort: summarize('comfort',comfort,config),
      fair: summarize('fair',fair,config),
      config,
    };
  }
  function summarize(id,slots,config) {
    const totals=config.people.map((p,i)=>({id:p.id,label:p.label,
      cost:Math.round(slots.reduce((s,x)=>s+x.costs[i].cost,0)*100)/100,
      outMinutes:slots.reduce((s,x)=>s+x.costs[i].outMinutes,0),
      weekendMinutes:slots.reduce((s,x)=>s+x.costs[i].weekendMinutes,0),
      nightMinutes:slots.reduce((s,x)=>s+x.costs[i].nightMinutes,0)}));
    return {id,slots,total:Math.round(totals.reduce((s,x)=>s+x.cost,0)*100)/100,
      max:Math.max(...totals.map(x=>x.cost)),range:Math.round((Math.max(...totals.map(x=>x.cost))-Math.min(...totals.map(x=>x.cost)))*100)/100,
      totals};
  }
  function stamp(ms){return new Date(ms).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');}
  function escapeIcs(s){return String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');}
  function ics(plan,config) {
    validate(config);
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//JISA NO KARI//JP','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
    plan.slots.forEach((slot,i)=>{
      const id=stamp(slot.utc)+'-'+i+'@jisa-no-kari.local';
      const details=config.people.map(p=>{const l=parts(slot.utc,p.zone);return `${p.label} ${l.date} ${l.time}`;}).join(' / ');
      lines.push('BEGIN:VEVENT','UID:'+id,'DTSTAMP:'+stamp(slot.utc),
        'DTSTART:'+stamp(slot.utc),'DTEND:'+stamp(slot.utc+config.duration*60000),
        'SUMMARY:'+escapeIcs('国際チーム定例会（候補）'),
        'DESCRIPTION:'+escapeIcs(details+' / 候補日時。参加者の承認・カレンダー競合確認は別途必要。'),
        'END:VEVENT');
    });
    return lines.concat('END:VCALENDAR','').join('\r\n');
  }
  function csv(plan,config){
    const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const rows=[['回','基準日','UTC開始','UTC終了',...config.people.flatMap(p=>[p.label+' 現地開始',p.label+' 負担点'])]];
    plan.slots.forEach((slot,i)=>rows.push([i+1,parts(slot.utc,config.people.find(p=>p.id===config.baseId).zone).date,
      new Date(slot.utc).toISOString(),new Date(slot.utc+config.duration*60000).toISOString(),
      ...config.people.flatMap((p,k)=>{const t=parts(slot.utc,p.zone);return [t.date+' '+t.time,slot.costs[k].cost];})]));
    return '\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n');
  }
  function proposal(plan,config){
    return ['国際チーム定例会の候補（各拠点の現地時間）',
      ...plan.slots.map((s,i)=>`${i+1}回目: ${config.people.map(p=>{const a=parts(s.utc,p.zone);const b=parts(s.utc+config.duration*60000,p.zone);return `${p.label} ${a.date} ${a.time}–${b.time}`;}).join(' / ')}`),
      '※計算上の候補です。休日・休暇・既存予定・参加者の同意は別途ご確認ください。'].join('\n');
  }
  return {ZONES,DEFAULTS,parts,parseDate,plusDays,minutes,candidates,burden,validate,build,ics,csv,proposal};
});