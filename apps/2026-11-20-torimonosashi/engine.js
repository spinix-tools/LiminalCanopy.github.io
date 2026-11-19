/* とりものさし / TORI MONOSASHI — pure calculation and data validation. MIT */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ToriEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const DEFAULT_A = {start:'2026-03-01',end:'2026-05-31'};
  const DEFAULT_B = {start:'2026-09-01',end:'2026-11-30'};
  const DEMO = {
    version: VERSION,
    sessions: [
      {id:'d1',date:'2026-03-05',site:'川沿い',minutes:90,complete:true,sightings:[{species:'シジュウカラ',count:3},{species:'スズメ',count:8},{species:'カワセミ',count:1}]},
      {id:'d2',date:'2026-03-16',site:'川沿い',minutes:90,complete:true,sightings:[{species:'スズメ',count:6}]},
      {id:'d3',date:'2026-03-27',site:'近所の公園',minutes:75,complete:true,sightings:[{species:'シジュウカラ',count:2},{species:'メジロ',count:1}]},
      {id:'d4',date:'2026-04-08',site:'川沿い',minutes:105,complete:true,sightings:[{species:'シジュウカラ',count:1},{species:'スズメ',count:4}]},
      {id:'d5',date:'2026-04-19',site:'近所の公園',minutes:80,complete:true,sightings:[{species:'メジロ',count:2}]},
      {id:'d6',date:'2026-05-03',site:'川沿い',minutes:60,complete:true,sightings:[{species:'シジュウカラ',count:1},{species:'スズメ',count:2}]},
      {id:'d7',date:'2026-09-02',site:'川沿い',minutes:25,complete:true,sightings:[{species:'シジュウカラ',count:2},{species:'スズメ',count:3}]},
      {id:'d8',date:'2026-09-14',site:'近所の公園',minutes:30,complete:true,sightings:[{species:'シジュウカラ',count:1},{species:'メジロ',count:1}]},
      {id:'d9',date:'2026-09-29',site:'川沿い',minutes:20,complete:true,sightings:[{species:'スズメ',count:2}]},
      {id:'d10',date:'2026-10-11',site:'川沿い',minutes:30,complete:true,sightings:[{species:'シジュウカラ',count:2},{species:'カワセミ',count:1}]},
      {id:'d11',date:'2026-10-25',site:'近所の公園',minutes:25,complete:true,sightings:[{species:'シジュウカラ',count:1}]},
      {id:'d12',date:'2026-11-06',site:'川沿い',minutes:25,complete:true,sightings:[{species:'シジュウカラ',count:1},{species:'スズメ',count:3}]},
      {id:'d13',date:'2026-11-08',site:'川沿い',minutes:15,complete:false,sightings:[{species:'カワセミ',count:2}]}
    ]
  };
  const clone = v => JSON.parse(JSON.stringify(v));
  const tidy = x => String(x == null ? '' : x).normalize('NFKC').trim();
  function dateOK(x) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(x))) return false;
    const d = new Date(`${x}T00:00:00Z`);
    return !isNaN(d.getTime()) && d.toISOString().slice(0,10) === x;
  }
  function parseSightings(text) {
    const names = new Map();
    String(text).replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean).forEach((line,n)=>{
      const cols=line.split(/[,，\t]/).map(tidy);
      if(cols.length !== 2 || !cols[0] || cols[0].length > 70 || !/^\d+$/.test(cols[1])) throw Error(`${n+1}行目は「鳥名,羽数」で入力してください`);
      const count=Number(cols[1]);
      if (!Number.isSafeInteger(count) || count < 1 || count > 9999) throw Error(`${n+1}行目の羽数は1〜9999にしてください`);
      names.set(cols[0], (names.get(cols[0])||0)+count);
      if(names.get(cols[0]) > 9999 || names.size > 70) throw Error('同じ鳥の羽数または種数が上限を超えました');
    });
    return [...names].map(([species,count])=>({species,count}));
  }
  function normalizeSession(raw) {
    if(!raw || typeof raw !== 'object') throw Error('観察データがありません');
    const date=String(raw.date||'');
    const site=tidy(raw.site);
    const minutes=Number(raw.minutes);
    if(!dateOK(date)) throw Error('日付が正しくありません');
    if(!site || site.length>60) throw Error('場所ラベルは1〜60文字にしてください（正確な住所は不要）');
    if(!Number.isInteger(minutes)|| minutes<1 || minutes>1440) throw Error('観察時間は1〜1440分にしてください');
    if(typeof raw.complete !== 'boolean') throw Error('完全記録かどうかを指定してください');
    const input=Array.isArray(raw.sightings)?raw.sightings:[];
    if(input.length>70) throw Error('一度の観察は70種以内にしてください');
    const seen=new Set();
    const sightings=input.map(s=>{
      const species=tidy(s?.species), count=Number(s?.count);
      if(!species||species.length>70||seen.has(species)) throw Error('鳥名の空白・重複・長さを確認してください');
      if(!Number.isInteger(count)||count<1||count>9999) throw Error('羽数は1〜9999にしてください');
      seen.add(species);return {species,count};
    });
    return {id: String(raw.id||'').slice(0,90), date,site,minutes,complete:raw.complete,sightings};
  }
  function normalizeProject(raw) {
    if(!raw||raw.version!==VERSION||!Array.isArray(raw.sessions)) throw Error('このJSONは対応形式ではありません');
    if(raw.sessions.length>1000) throw Error('観察記録は1000件以内です');
    const ids=new Set();
    const sessions=raw.sessions.map(x=>{
      const s=normalizeSession(x);
      if(!s.id || ids.has(s.id)) throw Error('観察IDが空白か重複しています');
      ids.add(s.id); return s;
    });
    return {version:VERSION,sessions};
  }
  function normalizePeriod(x) {
    const start=String(x?.start||''),end=String(x?.end||'');
    if(!dateOK(start)||!dateOK(end)||start>end) throw Error('期間の日付・順序を確認してください');
    return {start,end};
  }
  function speciesList(sessions) { return [...new Set(sessions.flatMap(s=>s.sightings.map(x=>x.species)))].sort((a,b)=>a.localeCompare(b,'ja')); }
  // Wilson 95% score interval: descriptive uncertainty for a Bernoulli proportion.
  function wilson(success,total) {
    if(total===0) return null;
    const z=1.96,p=success/total,z2=z*z,den=1+z2/total;
    const mid=(p+z2/(2*total))/den;
    const radius=z*Math.sqrt(p*(1-p)/total+z2/(4*total*total))/den;
    return {lo:Math.max(0,mid-radius),hi:Math.min(1,mid+radius)};
  }
  function summarize(sessions,{start,end},species,site='') {
    const records=sessions.filter(s=>s.date>=start&&s.date<=end&&(!site||s.site===site));
    const full=records.filter(s=>s.complete);
    const partial=records.length-full.length;
    const n=full.length, minutes=full.reduce((a,s)=>a+s.minutes,0);
    const present=full.filter(s=>s.sightings.some(o=>o.species===species));
    const seen=present.length,individuals=present.reduce((a,s)=>a+s.sightings.find(o=>o.species===species).count,0);
    const hours=minutes/60;
    return {n,partial,minutes,hours,present:seen,individuals, rate:n?seen/n:null, interval:wilson(seen,n), perHour:hours?individuals/hours:null};
  }
  function compare(project,opts) {
    const a=normalizePeriod(opts.a),b=normalizePeriod(opts.b), species=tidy(opts.species),site=tidy(opts.site||'');
    if(!species) throw Error('比較する鳥を選んでください');
    const left=summarize(project.sessions,a,species,site),right=summarize(project.sessions,b,species,site);
    return {a:left,b:right,species,site,delta: left.rate!==null&&right.rate!==null?right.rate-left.rate:null,
      caveats:[...(left.n<5||right.n<5?['片方の完全記録が5件未満です。割合は不安定です。']:[]),
      ...(left.n===0||right.n===0?['比較期間に完全記録がないため、未発見の扱いは判断できません。']:[]),
      ...(left.hours>0&&right.hours>0&&(Math.max(left.hours,right.hours)/Math.min(left.hours,right.hours)>2)?['期間の観察時間が2倍超異なります。単純な羽数合計は比較しないでください。']:[])]};
  }
  function monthly(sessions,species,site='') {
    const map=new Map();
    for (const s of sessions) {
      if(!s.complete || (site&&s.site!==site)) continue;
      const k=s.date.slice(0,7);
      if(!map.has(k))map.set(k,{month:k,n:0,present:0,minutes:0});
      const r=map.get(k); r.n++;r.minutes+=s.minutes;
      if(s.sightings.some(v=>v.species===species))r.present++;
    }
    return [...map.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(r=>({...r,rate:r.present/r.n}));
  }
  function csvCell(input){let v=String(input??'');if(/^[\s]*[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';}
  function toCSV(sessions){
    const lines=[['date','site','minutes','complete','species','count']];
    for(const s of sessions){
      if(!s.sightings.length) lines.push([s.date,s.site,s.minutes,s.complete?'yes':'no','','']);
      for(const o of s.sightings)lines.push([s.date,s.site,s.minutes,s.complete?'yes':'no',o.species,o.count]);
    }
    return '\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
  }
  function demo(){return clone(DEMO);}
  return {VERSION,DEFAULT_A,DEFAULT_B,demo,dateOK,parseSightings,normalizeSession,normalizeProject,normalizePeriod,speciesList,wilson,summarize,compare,monthly,toCSV};
});