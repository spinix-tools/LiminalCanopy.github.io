/* JISA-TENBIN: deterministic, dependency-free time-zone planning core. MIT. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.JisaEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MS = 60000;
  const formatters = new Map();
  const ZONES = [
    'Asia/Tokyo', 'Asia/Seoul', 'Asia/Singapore', 'Asia/Kolkata', 'Asia/Kathmandu',
    'Asia/Taipei', 'Asia/Dubai', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
    'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'America/Sao_Paulo',
    'Australia/Sydney', 'Pacific/Auckland', 'Pacific/Honolulu'
  ];
  function formatter(zone) {
    if (!formatters.has(zone)) formatters.set(zone, new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }));
    return formatters.get(zone);
  }
  function localParts(utcMs, zone) {
    const parts = Object.fromEntries(formatter(zone).formatToParts(new Date(utcMs))
      .filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
    const date = [parts.year, String(parts.month).padStart(2,'0'), String(parts.day).padStart(2,'0')].join('-');
    const weekday = new Date(Date.UTC(parts.year, parts.month-1, parts.day)).getUTCDay();
    return { ...parts, date, weekday, minuteOfDay: parts.hour*60+parts.minute };
  }
  function validZone(zone) { try { formatter(zone); return true; } catch { return false; } }
  function asUTC(date, minutes) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
    const [y,m,d] = date.split('-').map(Number);
    const time=Date.UTC(y,m-1,d,0,0);
    if (new Date(time).toISOString().slice(0,10)!==date) return NaN;
    return time + minutes*MS;
  }
  function datePlusDays(date, days) { return new Date(asUTC(date,0)+days*86400000).toISOString().slice(0,10); }
  function localToUTC(date, minute, zone) {
    const target=asUTC(date, minute);
    if (!Number.isFinite(target) || !validZone(zone) || minute<0 || minute>=1440) return null;
    let guess=target;
    const seen=new Set();
    for(let i=0;i<8;i++) {
      if(seen.has(guess)) break;
      seen.add(guess);
      const p=localParts(guess,zone);
      const actual=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);
      const drift=target-actual;
      if(drift===0) return guess;
      guess+=drift;
    }
    return null; // Non-existent DST wall-clock time (spring forward)
  }
  function offsetMinutes(utcMs,zone) {
    const p=localParts(utcMs,zone);
    return Math.round((Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute)-utcMs)/MS);
  }
  function timeLabel(minute) { return `${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`; }
  function localLabel(ms, zone) {
    const p=localParts(ms,zone);
    return `${p.date} ${timeLabel(p.minuteOfDay)}`;
  }
  function validate(c) {
    const errors=[];
    if(!c || !Array.isArray(c.people) || c.people.length<2 || c.people.length>8) errors.push('参加拠点は2〜8件にしてください');
    if(!c || !validZone(c.anchor)) errors.push('基準タイムゾーンが無効です');
    if(!c || !Number.isInteger(c.weeks) || c.weeks<2 || c.weeks>12) errors.push('回数は2〜12回にしてください');
    if(!c || ![30,60,90].includes(c.duration)) errors.push('会議時間は30・60・90分から選んでください');
    if(!c || !Number.isFinite(asUTC(c.date,0))) errors.push('初回日付が無効です');
    if(c && c.pinnedMinute!==null && c.pinnedMinute!==undefined && (!Number.isInteger(c.pinnedMinute) || c.pinnedMinute<0 || c.pinnedMinute>=1440 || c.pinnedMinute%30)) errors.push('固定時刻が無効です');
    if(c && Array.isArray(c.people)) for(let i=0;i<c.people.length;i++) {
      const p=c.people[i];
      if(!p || !p.name || String(p.name).trim().length>35) errors.push(`拠点${i+1}の名称を1〜35文字にしてください`);
      if(!p || !validZone(p.zone)) errors.push(`拠点${i+1}のタイムゾーンが無効です`);
      if(!p || !Number.isInteger(p.start) || !Number.isInteger(p.end) || p.start<0 || p.end>1440 || p.start>=p.end) errors.push(`拠点${i+1}の勤務時間を確認してください`);
      if(!p || !Number.isFinite(p.history) || p.history<0 || p.history>100) errors.push(`拠点${i+1}の過去負担は0〜100にしてください`);
    }
    return errors;
  }
  // One "burden hour" equals one hour outside working hours; night / weekend hours cost more.
  function burdenAt(utcStart, duration, person) {
    let penalty=0, outsideMinutes=0, weekendMinutes=0, nightMinutes=0;
    for(let minute=0;minute<duration;minute+=15) {
      const p=localParts(utcStart+(minute+7)*MS,person.zone);
      const weekend=p.weekday===0 || p.weekday===6;
      const outside=p.minuteOfDay<person.start || p.minuteOfDay>=person.end || weekend;
      const night=p.minuteOfDay<7*60 || p.minuteOfDay>=22*60;
      const step=Math.min(15,duration-minute);
      if(outside) {
        outsideMinutes+=step;
        penalty+=(step/60)*(weekend?2.1:night?1.8:1);
      }
      if(weekend) weekendMinutes+=step;
      if(night) nightMinutes+=step;
    }
    return {points:Math.round(penalty*100)/100,outsideMinutes,weekendMinutes,nightMinutes};
  }
  function evalSlot(utcStart, c, minute) {
    const detail=c.people.map(p=>({ ...burdenAt(utcStart,c.duration,p), local:localLabel(utcStart,p.zone), offset:offsetMinutes(utcStart,p.zone) }));
    return { utcStart, minute, detail, sum:Math.round(detail.reduce((s,d)=>s+d.points,0)*100)/100,
      max:Math.max(...detail.map(d=>d.points)) };
  }
  function candidateSlots(date,c) {
    const candidates=[];
    for(let minute=0;minute<1440;minute+=30) {
      const utcStart=localToUTC(date,minute,c.anchor);
      if(utcStart!==null) candidates.push(evalSlot(utcStart,c,minute));
    }
    return candidates;
  }
  function byLowSum(a,b) { return a.sum-b.sum || a.max-b.max || a.minute-b.minute; }
  function metric(plan,c) {
    const added=c.people.map((_,i)=>Math.round(plan.reduce((sum,s)=>sum+s.detail[i].points,0)*100)/100);
    const totals=added.map((d,i)=>Math.round((d+c.people[i].history)*100)/100);
    const totalAdded=Math.round(added.reduce((s,d)=>s+d,0)*100)/100;
    const max=Math.max(...totals);
    const gap=Math.round((max-Math.min(...totals))*100)/100;
    return {added,totals,totalAdded,max,gap};
  }
  function build(c) {
    const errors=validate(c);
    if(errors.length) return {errors};
    const dates=Array.from({length:c.weeks},(_,w)=>datePlusDays(c.date,w*7));
    const all=dates.map(d=>candidateSlots(d,c));
    if(!all[0].length) return {errors:['開始日に候補がありません']};
    const first=all[0].slice().sort(byLowSum)[0];
    const chosen=c.pinnedMinute===null || c.pinnedMinute===undefined ? first : all[0].find(s=>s.minute===c.pinnedMinute);
    if(!chosen) return {errors:['指定時刻は夏時間の切替などで存在しません']};
    const anchored=all.map((choices,w)=>choices.find(s=>s.minute===chosen.minute) || choices.slice().sort((a,b)=>Math.abs(a.minute-chosen.minute)-Math.abs(b.minute-chosen.minute))[0]);
    const utc=dates.map((_,w)=>evalSlot(chosen.utcStart+w*7*86400000,c,localParts(chosen.utcStart+w*7*86400000,c.anchor).minuteOfDay));
    const debt=c.people.map(p=>p.history);
    const rotated=[];
    for(let w=0;w<c.weeks;w++) {
      const opts=all[w];
      const ordered=opts.slice().sort((a,b)=> {
        function cost(o) {
          const after=debt.map((d,i)=>d+o.detail[i].points);
          const max=Math.max(...after), min=Math.min(...after);
          const total=after.reduce((s,v)=>s+v,0);
          return max + 0.58*(max-min) + 0.14*total;
        }
        return cost(a)-cost(b) || a.sum-b.sum || a.max-b.max || a.minute-b.minute;
      });
      const slot=ordered[0]; rotated.push(slot);
      debt.forEach((_,i)=> {debt[i]=Math.round((debt[i]+slot.detail[i].points)*100)/100;});
    }
    const results=[
      {id:'anchor',name:'主催地の時刻を固定',desc:'初回の基準タイムゾーンの壁時計時刻を毎週守る',slots:anchored},
      {id:'utc',name:'UTC時刻を固定',desc:'初回のUTC時刻を毎週守る（夏時間で現地時刻が変化）',slots:utc},
      {id:'rotate',name:'負担をならす輪番',desc:'過去負担も加算し、毎週の最大負担と格差を抑える近似選択',slots:rotated}
    ].map(p=>({...p,metrics:metric(p.slots,c), transitions:p.slots.map((s,w)=>w>0 ? c.people.map((person,i)=>s.detail[i].offset!==p.slots[w-1].detail[i].offset?i:-1).filter(i=>i>=0) : [])}));
    return {errors:[],results,candidates:all[0],chosenMinute:chosen.minute,dates};
  }
  function toCSV(c,plan) {
    const quote=v=>'"'+String(v).replace(/"/g,'""')+'"';
    const head=['回','UTC開始','UTC終了','基準時刻',...c.people.flatMap(p=>[`${p.name} 現地時刻`,`${p.name} 負担点`])];
    const lines=[head.map(quote).join(',')];
    plan.slots.forEach((s,w)=>lines.push([w+1,new Date(s.utcStart).toISOString(),new Date(s.utcStart+c.duration*MS).toISOString(),localLabel(s.utcStart,c.anchor),...s.detail.flatMap(d=>[d.local,d.points])].map(quote).join(',')));
    return '\uFEFF'+lines.join('\r\n');
  }
  function icsEscape(s) { return String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;'); }
  function toICS(c,plan) {
    const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const fmt=ms=>new Date(ms).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//JISA TENBIN//Offline Planning//JA','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
    plan.slots.forEach((s,i)=> {
      const desc=c.people.map((p,j)=>`${p.name}: ${s.detail[j].local} (負担 ${s.detail[j].points})`).join('\n');
      lines.push('BEGIN:VEVENT','UID:jt-'+(s.utcStart)+'-'+i+'@offline.invalid','DTSTAMP:'+stamp,'DTSTART:'+fmt(s.utcStart),'DTEND:'+fmt(s.utcStart+c.duration*MS),'SUMMARY:'+icsEscape('時差てんびん / 国際チーム会議'), 'DESCRIPTION:'+icsEscape(`${plan.name}\n${desc}`),'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n')+'\r\n';
  }
  function defaultConfig(today) {
    const utcDay=(today||new Date()).toISOString().slice(0,10);
    const day=new Date(utcDay+'T00:00:00Z').getUTCDay();
    const delta=((3-day+7)%7)||7;
    return {date:datePlusDays(utcDay,delta),weeks:6,duration:60,anchor:'Asia/Tokyo',pinnedMinute:null,people:[
      {name:'東京',zone:'Asia/Tokyo',start:540,end:1080,history:0},
      {name:'ロンドン',zone:'Europe/London',start:540,end:1080,history:0},
      {name:'ニューヨーク',zone:'America/New_York',start:540,end:1080,history:0}
    ]};
  }
  return {ZONES,localParts,localToUTC,offsetMinutes,datePlusDays,burdenAt,evalSlot,candidateSlots,validate,build,toCSV,toICS,defaultConfig,timeLabel,localLabel};
});