/* SENKYU: pure offline AV preflight rules. MIT. */
(function(root, factory){ const api=factory(); if(typeof module==='object'&&module.exports)module.exports=api; root.Senkyu=api; })(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const TYPES=['HDMI','SDI','XLR','LAN','USB'];
const GUIDE={HDMI:10,SDI:80,XLR:50,LAN:90,USB:3}; // planning presets only, not electrical standards
const PRESETS={
 pc:{name:'ノートPC',kind:'source',ports:[['映像出力','HDMI','out']]},
 camera:{name:'カメラ',kind:'source',ports:[['SDI OUT','SDI','out']]},
 switcher:{name:'映像スイッチャー',kind:'relay',ports:[['HDMI IN','HDMI','in'],['HDMI OUT','HDMI','out']]},
 converter:{name:'SDI受信機',kind:'relay',ports:[['SDI IN','SDI','in'],['SDI OUT','SDI','out']]},
 projector:{name:'プロジェクター',kind:'sink',ports:[['HDMI IN','HDMI','in']]},
 monitor:{name:'確認モニター',kind:'sink',ports:[['SDI IN','SDI','in']]},
 mic:{name:'マイク',kind:'source',ports:[['XLR OUT','XLR','out']]},
 mixer:{name:'ミキサー',kind:'relay',ports:[['XLR IN','XLR','in'],['XLR OUT','XLR','out']]},
 speaker:{name:'アンプ内蔵SP',kind:'sink',ports:[['XLR IN','XLR','in']]}
};
const txt=(v,max=80)=>String(v??'').replace(/[\u0000-\u001F\u007F]/g,' ').trim().slice(0,max);
const integer=(v,min,max,fallback)=>{const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):fallback};
const num=(v,min,max,fallback)=>{if(v===''||v==null)return fallback;const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback};
const id=(prefix)=>prefix+Math.random().toString(36).slice(2,9);
function makeDevice(preset='pc',x=100,y=100){const a=PRESETS[preset]||PRESETS.pc;return {id:id('d_'),name:a.name,kind:a.kind,x,y,ports:a.ports.map(p=>({id:id('p_'),name:p[0],type:p[1],dir:p[2]}))};}
function sample(){
 const pc=makeDevice('pc',65,110),sw=makeDevice('switcher',385,100),pj=makeDevice('projector',705,110),camera=makeDevice('camera',65,345),monitor=makeDevice('monitor',705,345);
 const line=(a,b,route,stock)=>({id:id('c_'),from:{device:a.id,port:a.ports.find(p=>p.dir==='out').id},to:{device:b.id,port:b.ports.find(p=>p.dir==='in').id},route,stock});
 return {project:'学内セミナー配信・接続確認',slack:20,guides:{...GUIDE},devices:[pc,sw,pj,camera,monitor],cables:[line(pc,sw,5,7),line(sw,pj,8,10),line(camera,monitor,19,20)],failed:null};
}
function normalize(input){if(!input||typeof input!=='object')throw Error('データ形式が不正です');const a=input;
 const devices=Array.isArray(a.devices)?a.devices.slice(0,40).map((d,i)=>({id:txt(d.id,50)||'d'+i,name:txt(d.name,55)||'機材',kind:['source','relay','sink'].includes(d.kind)?d.kind:'relay',x:num(d.x,0,850,30),y:num(d.y,0,650,30),ports:(Array.isArray(d.ports)?d.ports:[]).slice(0,12).map((p,j)=>({id:txt(p.id,50)||'p'+i+'_'+j,name:txt(p.name,45)||'端子',type:TYPES.includes(p.type)?p.type:'HDMI',dir:p.dir==='out'?'out':'in'}))})):[];
 if(devices.length>40)throw Error('機材数上限');
 const seen=new Set(); for(const d of devices){if(seen.has(d.id))throw Error('機材IDが重複しています');seen.add(d.id);const ps=new Set();for(const p of d.ports){if(ps.has(p.id))throw Error('端子IDが重複しています');ps.add(p.id);}}
 const cables=(Array.isArray(a.cables)?a.cables:[]).slice(0,100).map((c,i)=>({id:txt(c.id,50)||'c'+i,from:{device:txt(c.from?.device,50),port:txt(c.from?.port,50)},to:{device:txt(c.to?.device,50),port:txt(c.to?.port,50)},route:num(c.route,0,10000,0),stock:num(c.stock,0,10000,0)}));
 if(new Set(cables.map(c=>c.id)).size!==cables.length)throw Error('ケーブルIDが重複しています');
 const guides={};TYPES.forEach(t=>guides[t]=num(a.guides?.[t],0.1,10000,GUIDE[t]));
 return {project:txt(a.project,100)||'無題の配線計画',devices,cables,slack:num(a.slack,0,200,20),guides,failed:cables.some(c=>c.id===a.failed)?a.failed:null};
}
function portFor(data,ref){const d=data.devices.find(x=>x.id===ref?.device);return d&&d.ports.find(p=>p.id===ref?.port)?{device:d,port:d.ports.find(p=>p.id===ref.port)}:null;}
function analyze(data){const p=normalize(data);const state=[];const usedIn={},usedOut={};
 for(const c of p.cables){const src=portFor(p,c.from),dst=portFor(p,c.to);const errors=[],warnings=[];
  if(!src||!dst)errors.push('接続先の機材・端子が見つかりません');
  else {if(src.port.dir!=='out'||dst.port.dir!=='in')errors.push('OUT → IN ではありません');if(src.port.type!==dst.port.type)errors.push('端子の信号種別が違います');}
  const required=Math.ceil(c.route*(1+p.slack/100)*10-1e-8)/10;
  if(c.stock+1e-8<required)errors.push('ケーブル長が不足しています');
  if(src&&c.route>p.guides[src.port.type])warnings.push('設定した距離ガイドを超過しています');
  const fromKey=c.from.device+'|'+c.from.port,toKey=c.to.device+'|'+c.to.port;
  usedOut[fromKey]=(usedOut[fromKey]||0)+1;usedIn[toKey]=(usedIn[toKey]||0)+1;
  state.push({id:c.id,source:src,target:dst,required,shortage:Math.max(0,Math.ceil((required-c.stock)*10-1e-8)/10),errors,warnings,valid:errors.length===0});
 }
 for(const s of state){const c=p.cables.find(x=>x.id===s.id);if((usedOut[c.from.device+'|'+c.from.port]||0)>1)s.errors.push('同一出力端子が複数接続されています');if((usedIn[c.to.device+'|'+c.to.port]||0)>1)s.errors.push('同一入力端子が複数接続されています');s.valid=s.errors.length===0;}
 function reach(skip){const visited=new Set(),queue=[];
  for(const d of p.devices.filter(x=>x.kind==='source'))for(const pt of d.ports.filter(x=>x.dir==='out')){const k=d.id+'|'+pt.id;visited.add(k);queue.push({d,pt});}
  while(queue.length){const {d,pt}=queue.shift();
   if(pt.dir==='out')for(const s of state){if(!s.valid||s.id===skip)continue;const c=p.cables.find(x=>x.id===s.id);if(c.from.device!==d.id||c.from.port!==pt.id)continue;const target=s.target;const key=target.device.id+'|'+target.port.id;if(!visited.has(key)){visited.add(key);queue.push({d:target.device,pt:target.port});}}
   if(pt.dir==='in'&&d.kind==='relay')for(const op of d.ports){if(op.dir!=='out'||op.type!==pt.type)continue;const key=d.id+'|'+op.id;if(!visited.has(key)){visited.add(key);queue.push({d,pt:op});}}
  }
  return p.devices.filter(d=>d.kind==='sink').map(d=>({id:d.id,name:d.name,online:d.ports.some(pt=>pt.dir==='in'&&visited.has(d.id+'|'+pt.id))}));
 }
 const destinations=reach(null),failedDestinations=p.failed?reach(p.failed):destinations;
 const impacts=p.failed?destinations.filter(d=>d.online&&!failedDestinations.find(z=>z.id===d.id)?.online).map(d=>d.name):[];
 return {project:p,lines:state,destinations,failedDestinations,impacts,errors:state.reduce((n,s)=>n+s.errors.length,0),warnings:state.reduce((n,s)=>n+s.warnings.length,0),unreached:destinations.filter(d=>!d.online).length,shortage:state.reduce((n,s)=>n+s.shortage,0),reachable:destinations.filter(d=>d.online).length};
}
function csvEscape(v){let s=String(v??'');if(/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function cableCsv(input){const result=analyze(input);let rows=[['ID','出発機材','出発端子','到着機材','到着端子','種別','経路距離m','必要m','手持ちm','不足m','判定']];for(let i=0;i<result.lines.length;i++){let s=result.lines[i],c=result.project.cables[i];rows.push([`C${String(i+1).padStart(2,'0')}`,s.source?.device.name||'不明',s.source?.port.name||'不明',s.target?.device.name||'不明',s.target?.port.name||'不明',s.source?.port.type||'不明',c.route,s.required,c.stock,s.shortage,s.errors.length?s.errors.join(' / '):s.warnings.length?s.warnings.join(' / '):'OK']);}return '\uFEFF'+rows.map(row=>row.map(csvEscape).join(',')).join('\r\n')+'\r\n';}
function escapeXml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function diagramSvg(input){const a=analyze(input),p=a.project;const w=1060,h=730;let shapes=[];
 shapes.push(`<rect width="${w}" height="${h}" fill="#f5f8fd"/>`);shapes.push(`<text x="35" y="46" font-family="sans-serif" font-size="24" font-weight="700" fill="#1a2a43">${escapeXml(p.project)}</text>`);
 p.cables.forEach((c,i)=>{const s=a.lines[i];const src=s.source?.device,dst=s.target?.device;if(!src||!dst)return;const x1=src.x+240,y1=src.y+58,x2=dst.x,y2=dst.y+58;const color=!s.valid?'#c43b52':p.failed===s.id?'#df8a1d':'#178c9c';shapes.push(`<path d="M${x1},${y1} C${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}" fill="none" stroke="${color}" stroke-width="4" stroke-dasharray="${p.failed===s.id?'9 7':'none'}"/>`);shapes.push(`<text x="${(x1+x2)/2}" y="${(y1+y2)/2-10}" font-family="sans-serif" font-size="12" fill="#26374d" text-anchor="middle">C${i+1} ${escapeXml(s.source?.port.type||'')} ${c.stock}m</text>`);});
 p.devices.forEach(d=>{const fill=d.kind==='source'?'#edf5ff':d.kind==='relay'?'#e9f6f2':'#fff4e7';shapes.push(`<rect x="${d.x}" y="${d.y}" width="240" height="116" rx="13" fill="${fill}" stroke="#93a5b9"/>`);shapes.push(`<text x="${d.x+12}" y="${d.y+27}" font-family="sans-serif" font-size="15" font-weight="700" fill="#1b2b43">${escapeXml(d.name)}</text>`);d.ports.slice(0,4).forEach((pt,j)=>shapes.push(`<text x="${d.x+12}" y="${d.y+47+j*15}" font-family="sans-serif" font-size="11" fill="#47556d">${pt.dir==='out'?'→':'←'} ${escapeXml(pt.name)} (${pt.type})</text>`));});
 shapes.push(`<text x="35" y="708" font-family="sans-serif" font-size="12" fill="#637389">配線計画参考図。端子と映像規格・実接続は現物確認してください。</text>`);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${shapes.join('')}</svg>`;
}
return {TYPES,GUIDE,PRESETS,makeDevice,sample,normalize,portFor,analyze,cableCsv,diagramSvg,escapeXml};
});
