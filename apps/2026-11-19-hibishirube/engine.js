/* ひびしるべ — pure, dependency-free model helpers (MIT) */
(function(root,factory){ const api=factory(); if(typeof module==='object'&&module.exports) module.exports=api; root.HibiEngine=api; })(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const ROOMS=['玄関','居室','キッチン','浴室','洗面・トイレ','廊下','ベランダ','その他'];
const PHASES=['入居時','退去時'];
const KINDS=['傷','汚れ','破損','水回り','設備','その他'];
const SEVERITIES=['軽微','要確認','要対応'];
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(Number(n))?Number(n):min));
const id=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
const cleanText=(value,max=200)=>String(value??'').slice(0,max);
const empty=()=>({version:1,title:'私の住まいの点検',records:[]});
function pin(input={}){return {id:cleanText(input.id||id(),64),x:clamp(input.x),y:clamp(input.y),kind:KINDS.includes(input.kind)?input.kind:'その他',severity:SEVERITIES.includes(input.severity)?input.severity:'要確認',note:cleanText(input.note,500)};}
function record(input={}){return {id:cleanText(input.id||id(),64),room:ROOMS.includes(input.room)?input.room:'その他',phase:PHASES.includes(input.phase)?input.phase:PHASES[0],label:cleanText(input.label||'写真',80),recordedOn:/^\d{4}-\d{2}-\d{2}$/.test(input.recordedOn||'')?input.recordedOn:'',image:(typeof input.image==='string'&&/^data:image\/(jpeg|png|webp);base64,/i.test(input.image)&&input.image.length<4500000)?input.image:'',pins:Array.isArray(input.pins)?input.pins.slice(0,60).map(pin):[]};}
function normalize(input){if(!input||typeof input!=='object'||Array.isArray(input)||input.version!==1||!Array.isArray(input.records)||input.records.length>80) throw Error('非対応の保存ファイルです（version 1 の records 配列が必要）');const records=input.records.map(record); if(new Set(records.map(r=>r.id)).size!==records.length) throw Error('写真IDが重複しています');return {version:1,title:cleanText(input.title||'私の住まいの点検',100),records};}
function withPin(rec,point){let normalized=record(rec),next=pin(point);return {...normalized,pins:[...normalized.pins,next]};}
function removePin(rec,pinId){return {...record(rec),pins:rec.pins.filter(x=>x.id!==pinId)};}
function findMatch(project,rec){return project.records.find(x=>x.room===rec.room&&x.phase!==(rec.phase)&&x.id!==rec.id)||null;}
function stats(project){const p=normalize(project);const issues=p.records.flatMap(r=>r.pins.map(x=>({...x,room:r.room,phase:r.phase,recordId:r.id})));const byRoom=Object.fromEntries(ROOMS.map(room=>[room,{photos:p.records.filter(r=>r.room===room).length,issues:issues.filter(x=>x.room===room).length}]));return {photos:p.records.length,issues:issues.length,unresolved:issues.filter(x=>x.severity!=='軽微').length,withImages:p.records.filter(x=>!!x.image).length,byRoom};}
function csv(project){const rows=[['部屋','時点','写真ラベル','登録日（撮影日時ではない）','印番号','分類','重要度','メモ','x(%)','y(%)']];for(const r of normalize(project).records){if(!r.pins.length){rows.push([r.room,r.phase,r.label,r.recordedOn,'','','','','','']);continue;}r.pins.forEach((p,i)=>rows.push([r.room,r.phase,r.label,r.recordedOn,i+1,p.kind,p.severity,p.note,Math.round(p.x*1000)/10,Math.round(p.y*1000)/10]));}return '\ufeff'+rows.map(row=>row.map(x=>'"'+String(x??'').replaceAll('"','""')+'"').join(',')).join('\r\n');}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function safeFilename(value){return cleanText(value,60).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').trim()||'記録';}
function pinLabel(p){return `${p.kind}／${p.severity}${p.note?'：'+p.note:''}`;}
return {ROOMS,PHASES,KINDS,SEVERITIES,clamp,id,cleanText,empty,pin,record,normalize,withPin,removePin,findMatch,stats,csv,esc,safeFilename,pinLabel};
});
