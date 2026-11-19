/* HINATAMADO calculation engine — no network, no dependencies. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Hinata = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const RAD = Math.PI / 180;
  const PRESETS = Object.freeze({
    tokyo: {lat: 35.68, lon: 139.76, tz: 9, face: 180},
    osaka: {lat: 34.69, lon: 135.50, tz: 9, face: 180},
    sapporo: {lat: 43.06, lon: 141.35, tz: 9, face: 180},
    fukuoka: {lat: 33.59, lon: 130.40, tz: 9, face: 180}
  });
  const DEFAULT = Object.freeze({
    lat: 35.68, lon: 139.76, tz: 9, face: 180,
    width: 180, height: 190, overhang: 65,
    wallHeight: 0, wallDistance: 250,
    nearX: 0, nearDepth: 25, nearHeight: 60,
    farX: 0, farDepth: 100, farHeight: 60,
    date: '2026-11-19'
  });
  function clamp(v, min, max, fallback) {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }
  function isValidDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y,m,d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y,m-1,d));
    return dt.getUTCFullYear()===y && dt.getUTCMonth()===m-1 && dt.getUTCDate()===d && y>=1900 && y<=2100;
  }
  function normalize(o) {
    const v={...DEFAULT,...(o && typeof o==='object' ? o : {})};
    const ranges={lat:[-65,65],lon:[-180,180],tz:[-12,14],face:[0,360],
      width:[30,1000],height:[50,500],overhang:[0,400],wallHeight:[0,1500],wallDistance:[10,3000],
      nearX:[-500,500],nearDepth:[0,500],nearHeight:[0,450],farX:[-500,500],farDepth:[0,500],farHeight:[0,450]};
    for (const [k,[min,max]] of Object.entries(ranges)) v[k]=clamp(v[k],min,max,DEFAULT[k]);
    v.date=isValidDate(v.date)?v.date:DEFAULT.date;
    return v;
  }
  function dateParts(dateStr) {
    if (!isValidDate(dateStr)) throw new Error('日付は1900〜2100年の有効な日を入力してください');
    const [y,m,d] = dateStr.split('-').map(Number);
    const day=Math.round((Date.UTC(y,m-1,d)-Date.UTC(y,0,1))/86400000)+1;
    const leap=new Date(Date.UTC(y,1,29)).getUTCMonth()===1;
    return {y,m,d,day,days:leap?366:365};
  }
  // NOAA GML General Solar Position Calculations; angle from north, clockwise.
  function solarPosition(dateStr, minute, latitude, longitude, timezone) {
    const p=dateParts(dateStr), gamma=(2*Math.PI/p.days)*(p.day-1+(minute/60-12)/24);
    const eot=229.18*(0.000075+0.001868*Math.cos(gamma)-0.032077*Math.sin(gamma)-0.014615*Math.cos(2*gamma)-0.040849*Math.sin(2*gamma));
    const decl=0.006918-0.399912*Math.cos(gamma)+0.070257*Math.sin(gamma)-0.006758*Math.cos(2*gamma)+0.000907*Math.sin(2*gamma)-0.002697*Math.cos(3*gamma)+0.00148*Math.sin(3*gamma);
    const ha=(minute+eot+4*longitude-60*timezone)/4*RAD-Math.PI;
    const lat=latitude*RAD;
    const sinAlt=Math.sin(lat)*Math.sin(decl)+Math.cos(lat)*Math.cos(decl)*Math.cos(ha);
    const altitude=Math.asin(Math.max(-1,Math.min(1,sinAlt)))/RAD;
    const azimuth=(Math.atan2(Math.sin(ha),Math.cos(ha)*Math.sin(lat)-Math.tan(decl)*Math.cos(lat))/RAD+180+360)%360;
    return {altitude,azimuth,declination:decl/RAD,equationOfTime:eot};
  }
  const REASONS={sun:'直射',night:'夜間',back:'方角',side:'左右の枠',top:'上枠',eave:'庇・上階',wall:'前方の壁'};
  function lightAt(solar, cfg, position) {
    if (solar.altitude<=0) return 'night';
    const delta= ((solar.azimuth-cfg.face+540)%360-180)*RAD;
    const c=Math.cos(delta);
    if (c<=0.00001) return 'back';
    const depth=position.depth/100, x=position.x/100, y=position.height/100;
    const faceOffset=depth*Math.sin(delta)/c;
    if (Math.abs(x+faceOffset)>=cfg.width/200) return 'side';
    const slope=Math.tan(solar.altitude*RAD)/c;
    if (y+depth*slope>=cfg.height/100) return 'top';
    if (y+(depth+cfg.overhang/100)*slope>=cfg.height/100) return 'eave';
    if (cfg.wallHeight>0 && y+(depth+cfg.wallDistance/100)*slope<=cfg.wallHeight/100) return 'wall';
    return 'sun';
  }
  function position(cfg,prefix) {
    return {x:cfg[prefix+'X'],depth:cfg[prefix+'Depth'],height:cfg[prefix+'Height']};
  }
  function simulate(raw, dateStr, step=10) {
    const cfg=normalize(raw), date=dateStr||cfg.date;
    if (!isValidDate(date)) throw new Error('日付不正');
    if (![5,10,15,20,30,60].includes(step)) throw new Error('未対応の間隔');
    const items=[], counts={near:{},far:{}},mins={near:0,far:0};
    for (let minute=0;minute<1440;minute+=step) {
      const sun=solarPosition(date,minute+step/2,cfg.lat,cfg.lon,cfg.tz);
      const near=lightAt(sun,cfg,position(cfg,'near'));
      const far=lightAt(sun,cfg,position(cfg,'far'));
      counts.near[near]=(counts.near[near]||0)+1;
      counts.far[far]=(counts.far[far]||0)+1;
      if (near==='sun') mins.near+=step;
      if (far==='sun') mins.far+=step;
      items.push({minute,altitude:sun.altitude,azimuth:sun.azimuth,near,far});
    }
    return {date,step,items,counts,mins, cfg};
  }
  function monthly(raw,year) {
    const cfg=normalize(raw), y=Number(year)||Number(cfg.date.slice(0,4));
    if (y<1900 || y>2100) throw new Error('年不正');
    return Array.from({length:12},(_,i)=>({month:i+1,...simulate(cfg,[y,String(i+1).padStart(2,'0'),'21'].join('-'),10).mins}));
  }
  function windows(result, key='near') {
    const out=[];let start=null;
    for (let i=0;i<=result.items.length;i++) {
      const active=i<result.items.length && result.items[i][key]==='sun';
      if (active && start===null) start=i*result.step;
      if (!active && start!==null) {out.push([start,i*result.step]);start=null;}
    }
    return out;
  }
  function timeLabel(min) {return String(Math.floor(min/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0');}
  function csv(result) {
    const rows=['date,time,altitude_deg,azimuth_deg,near,far'];
    for(const r of result.items){rows.push([result.date,timeLabel(r.minute),r.altitude.toFixed(2),r.azimuth.toFixed(2),r.near,r.far].join(','));}
    return '\uFEFF'+rows.join('\r\n')+'\r\n';
  }
  return {DEFAULT,PRESETS,REASONS,normalize,isValidDate,dateParts,solarPosition,lightAt,position,simulate,monthly,windows,timeLabel,csv};
});