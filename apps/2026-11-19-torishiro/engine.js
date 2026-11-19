/* TORISHIRO — transparent rectilinear field-of-view approximation. No dependencies. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TORISHIRO=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const SENSORS={full:[36,24],apsc:[23.5,15.6],canon:[22.3,14.9],mft:[17.3,13],one:[13.2,8.8]};
const DEFAULTS=Object.freeze({title:'陶器のオンライン販売写真',sensor:'full',orientation:'landscape',focal:50,distance:150,subjectW:40,subjectH:30,subjectD:15,offsetX:0,offsetY:0,margin:12,backdropW:180,backdropH:160,backdropGap:50,roomDepth:290,operator:55});
const LIMITS={focal:[8,500],distance:[20,1500],subjectW:[1,600],subjectH:[1,600],subjectD:[0,400],offsetX:[-500,500],offsetY:[-500,500],margin:[0,40],backdropW:[10,1200],backdropH:[10,1200],backdropGap:[0,600],roomDepth:[50,2400],operator:[0,400]};
const LENSES=[24,28,35,40,50,70,85,100,135];
function finite(n){return typeof n==='number'&&Number.isFinite(n)}
function clamp(v,a,b){return Math.min(b,Math.max(a,v))}
function normalize(input){const s={...DEFAULTS};if(!input||typeof input!=='object'||Array.isArray(input))return s;
if(typeof input.title==='string')s.title=input.title.trim().slice(0,80)||DEFAULTS.title;
if(Object.prototype.hasOwnProperty.call(SENSORS,input.sensor))s.sensor=input.sensor;
if(['landscape','portrait'].includes(input.orientation))s.orientation=input.orientation;
for(const [key,[min,max]] of Object.entries(LIMITS)){const v=typeof input[key]==='string'&&input[key].trim()!==''?Number(input[key]):input[key];if(finite(v))s[key]=clamp(v,min,max)}return s;}
function sensorDims(s){const a=SENSORS[s.sensor]||SENSORS.full;return s.orientation==='portrait'?[a[1],a[0]]:[a[0],a[1]]}
function minimumDistance(raw,focalOverride){const s=normalize(raw);const [sw,sh]=sensorDims(s);const f=focalOverride??s.focal;const safe=1-2*s.margin/100;const extentX=Math.abs(s.offsetX)+s.subjectW/2;const extentY=Math.abs(s.offsetY)+s.subjectH/2;return s.subjectD/2+Math.max(2*f*extentX/(sw*safe),2*f*extentY/(sh*safe));}
function distanceBounds(raw,focalOverride){const s=normalize(raw);const [sw,sh]=sensorDims(s);const f=focalOverride??s.focal;const min=minimumDistance(s,f);const bgMax=Math.min(s.backdropW*f/sw-s.backdropGap,s.backdropH*f/sh-s.backdropGap);
const roomMax=s.roomDepth-s.backdropGap-s.operator;return {min,max:Math.min(bgMax,roomMax),bgMax,roomMax,feasible:min<=Math.min(bgMax,roomMax)+1e-8};}
function calculate(raw){const s=normalize(raw);const [sw,sh]=sensorDims(s);const near=s.distance-s.subjectD/2;const back=s.distance+s.backdropGap;const safe=1-2*s.margin/100;
const field={width:sw*s.distance/s.focal,height:sh*s.distance/s.focal};const front={width:sw*near/s.focal,height:sh*near/s.focal};const backdrop={width:sw*back/s.focal,height:sh*back/s.focal};
const angle={horizontal:2*Math.atan(sw/(2*s.focal))*180/Math.PI,vertical:2*Math.atan(sh/(2*s.focal))*180/Math.PI};
const left=s.offsetX-s.subjectW/2,right=s.offsetX+s.subjectW/2,bottom=s.offsetY-s.subjectH/2,top=s.offsetY+s.subjectH/2;
const safeHalfX=front.width*safe/2,safeHalfY=front.height*safe/2;
const subjectFits=near>0&&left>=-safeHalfX-1e-8&&right<=safeHalfX+1e-8&&bottom>=-safeHalfY-1e-8&&top<=safeHalfY+1e-8;
const backgroundFits=backdrop.width<=s.backdropW+1e-8&&backdrop.height<=s.backdropH+1e-8;
const roomUsed=s.distance+s.backdropGap+s.operator;const roomFits=roomUsed<=s.roomDepth+1e-8;
const min=minimumDistance(s);const bounds=distanceBounds(s);
const extentX=Math.abs(s.offsetX)+s.subjectW/2,extentY=Math.abs(s.offsetY)+s.subjectH/2;
const maxFocal=Math.min(sw*near*safe/(2*extentX),sh*near*safe/(2*extentY));const minFocal=Math.max(sw*back/s.backdropW,sh*back/s.backdropH);
return {settings:s,sensor:{width:sw,height:sh},near,back,field,front,backdrop,angle,subjectFits,backgroundFits,roomFits,allFits:subjectFits&&backgroundFits&&roomFits,roomUsed,roomFree:s.roomDepth-roomUsed,marginHorizontal:safeHalfX-extentX,marginVertical:safeHalfY-extentY,backgroundFreeW:s.backdropW-backdrop.width,backgroundFreeH:s.backdropH-backdrop.height,requiredDistance:min,bounds,maxFocal,minFocal};}
function candidates(raw){const s=normalize(raw);return LENSES.map(f=>{const cfg={...s,focal:f};const result=calculate(cfg);const bounds=distanceBounds(cfg);return {focal:f,now:result.allFits,subject:result.subjectFits,backdrop:result.backgroundFits,room:result.roomFits,minDistance:bounds.min,maxDistance:bounds.max,feasible:bounds.feasible};});}
function csvCell(v){let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function toCSV(raw){const r=calculate(raw);const f=(n)=>Number(n.toFixed(2));const data=[['項目','値','単位'],['計画名',r.settings.title,''],['センサー',r.settings.sensor,''],['向き',r.settings.orientation,''],['レンズ',r.settings.focal,'mm'],['撮影距離',r.settings.distance,'cm'],['被写体幅',r.settings.subjectW,'cm'],['被写体高さ',r.settings.subjectH,'cm'],['被写体奥行',r.settings.subjectD,'cm'],['余白率',r.settings.margin,'%/片側'],['被写体面の写る幅',f(r.front.width),'cm'],['被写体面の写る高さ',f(r.front.height),'cm'],['背景面の写る幅',f(r.backdrop.width),'cm'],['背景面の写る高さ',f(r.backdrop.height),'cm'],['背景紙幅',r.settings.backdropW,'cm'],['背景紙高さ',r.settings.backdropH,'cm'],['必要室内奥行',f(r.roomUsed),'cm'],['被写体',r.subjectFits?'OK':'要調整',''],['背景紙',r.backgroundFits?'OK':'要調整',''],['部屋',r.roomFits?'OK':'要調整','']];return '\uFEFF'+data.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n'}
function exportJSON(raw){return JSON.stringify({app:'torishiro',version:1,settings:normalize(raw)},null,2)}
function importJSON(text){if(typeof text!=='string'||text.length>50000)throw Error('読み込みファイルの容量が大きすぎます。');let obj;try{obj=JSON.parse(text)}catch{throw Error('JSON形式を確認してください。')}if(!obj||obj.app!=='torishiro'||obj.version!==1||!obj.settings||typeof obj.settings!=='object'||Array.isArray(obj.settings))throw Error('TORISHIRO形式の設定ファイルではありません。');for(const key of Object.keys(LIMITS)){const v=obj.settings[key];if(v!==undefined&&(!finite(v)||v<LIMITS[key][0]||v>LIMITS[key][1]))throw Error('数値の範囲が不正です: '+key);}if(obj.settings.sensor!==undefined&&!Object.hasOwn(SENSORS,obj.settings.sensor))throw Error('センサーが不正です。');if(obj.settings.orientation!==undefined&&!['landscape','portrait'].includes(obj.settings.orientation))throw Error('向きが不正です。');if(obj.settings.title!==undefined&&(typeof obj.settings.title!=='string'||obj.settings.title.length>80))throw Error('計画名が不正です。');return normalize(obj.settings)}
return {SENSORS,DEFAULTS,LIMITS,LENSES,normalize,sensorDims,minimumDistance,distanceBounds,calculate,candidates,toCSV,exportJSON,importJSON};});