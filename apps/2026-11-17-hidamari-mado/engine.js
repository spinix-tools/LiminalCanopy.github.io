/* HIDAMARI MADO - solar sampling engine. NOAA approximate solar position.
   Model: flat vertical facade and a horizontal overhang at the point of interest.
   It is not a ray-traced building or weather forecast. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.Hidamari=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const RAD=Math.PI/180, DEG=180/Math.PI;
  const STATUSES=['night','back','obstacle','roof','direct'];
  const DEFAULTS=Object.freeze({lat:35.6812,lon:139.7671,tz:9,facing:180,depth:0.7,clearance:1.8,horizon:10,date:'2026-11-17'});
  const limits={lat:[-89.9,89.9],lon:[-180,180],tz:[-12,14],facing:[0,360],depth:[0,5],clearance:[0.1,10],horizon:[0,89]};
  function finite(v,label,min,max){const n=Number(v);if(v===''||v===null||!Number.isFinite(n)||n<min||n>max)throw Error(label+' の値が範囲外です（'+min+'〜'+max+'）');return n;}
  function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('日付形式は YYYY-MM-DD です');const [y,m,d]=s.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()+1!==m||dt.getUTCDate()!==d)throw Error('存在しない日付です');return {y,m,d};}
  function normalize(input){const c={...DEFAULTS,...(input||{})};for(const k of Object.keys(limits))c[k]=finite(c[k],k,...limits[k]);c.facing=c.facing%360;validDate(c.date);return c;}
  function wrap180(a){return ((a+540)%360)-180;}
  function solarPosition(date,minutes,raw){
    const c=normalize({...raw,date});const {y,m,d}=validDate(date);
    const jan1=Date.UTC(y,0,1),utc=Date.UTC(y,m-1,d),doy=Math.floor((utc-jan1)/86400000)+1;
    const days=((y%4===0&&y%100!==0)||y%400===0)?366:365;
    const gamma=2*Math.PI/days*(doy-1+(minutes/60-12)/24);
    const eq=229.18*(0.000075+0.001868*Math.cos(gamma)-0.032077*Math.sin(gamma)-0.014615*Math.cos(2*gamma)-0.040849*Math.sin(2*gamma));
    const dec=0.006918-0.399912*Math.cos(gamma)+0.070257*Math.sin(gamma)-0.006758*Math.cos(2*gamma)+0.000907*Math.sin(2*gamma)-0.002697*Math.cos(3*gamma)+0.00148*Math.sin(3*gamma);
    const tst=minutes+eq+4*c.lon-60*c.tz;
    const hourAngle=((tst/4-180+540)%360-180)*RAD;
    const lat=c.lat*RAD;
    const sinAlt=Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(hourAngle);
    const altitude=Math.asin(Math.max(-1,Math.min(1,sinAlt)));
    const cosAlt=Math.cos(altitude);
    let azimuth=180;
    if(Math.abs(Math.cos(lat)*cosAlt)>1e-10){
      const cosAz=Math.max(-1,Math.min(1,(Math.sin(dec)-Math.sin(lat)*Math.sin(altitude))/(Math.cos(lat)*cosAlt)));
      const a=Math.acos(cosAz)*DEG;
      azimuth=hourAngle>0?360-a:a;
    }
    return {altitude:altitude*DEG,azimuth,hourAngle:hourAngle*DEG};
  }
  function classify(pos,raw){
    const c=normalize(raw);
    if(pos.altitude<=0)return 'night';
    const delta=wrap180(pos.azimuth-c.facing);
    if(Math.abs(delta)>=90)return 'back';
    if(pos.altitude<=c.horizon)return 'obstacle';
    // Sunray reaches the overhang plane h metres higher; check its outward projection.
    if(c.depth>0){
      const outward=c.clearance/Math.tan(pos.altitude*RAD)*Math.cos(delta*RAD);
      if(outward<=c.depth)return 'roof';
    }
    return 'direct';
  }
  function hhmm(min){return String(Math.floor(min/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0');}
  function intervals(samples,status){const found=[];let start=null;for(let i=0;i<=samples.length;i++){
    const on=i<samples.length&&samples[i].status===status;
    if(on&&start===null)start=samples[i].minute;
    if(!on&&start!==null){const end=samples[i-1].minute+samples[i-1].step;found.push({start,end,label:hhmm(start)+'–'+hhmm(end%1440)});start=null;}
  }return found;}
  function analyze(input,step=5){const c=normalize(input);if(!Number.isInteger(step)||step<1||60%step!==0)throw Error('ステップは60の約数（1〜60）');
    const counts=Object.fromEntries(STATUSES.map(x=>[x,0]));const samples=[];
    for(let minute=0;minute<1440;minute+=step){const sun=solarPosition(c.date,minute+step/2,c);const status=classify(sun,c);counts[status]+=step;samples.push({minute,step,status,altitude:sun.altitude,azimuth:sun.azimuth});}
    return {config:c,counts,samples,direct:intervals(samples,'direct'),sunHours:counts.direct/60,frontHours:(counts.direct+counts.obstacle+counts.roof)/60,daylightHours:(1440-counts.night)/60};
  }
  function yearly(input){const c=normalize(input),year=validDate(c.date).y;return Array.from({length:12},(_,i)=>{
    const date=year+'-'+String(i+1).padStart(2,'0')+'-15';const a=analyze({...c,date},10);return {month:i+1,date,directMinutes:a.counts.direct,frontMinutes:a.counts.direct+a.counts.obstacle+a.counts.roof,daylightMinutes:1440-a.counts.night};
  });}
  return {DEFAULTS,normalize,validDate,solarPosition,classify,analyze,yearly,intervals,hhmm,wrap180};
});