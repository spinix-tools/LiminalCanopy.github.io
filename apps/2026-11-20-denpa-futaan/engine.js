/* DENPA FUTAAN — deliberately simple, uncalibrated RF planning illustration. MIT. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DenpaEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MATERIALS = {glass: {name:'ガラス', loss:2}, wood:{name:'木・薄い仕切り',loss:3}, drywall:{name:'石膏ボード',loss:5}, brick:{name:'レンガ',loss:9}, concrete:{name:'コンクリート',loss:15}, metal:{name:'金属・遮蔽',loss:22}};
  const FREQUENCY = {'2.4':2.4,'5':5,'6':6};
  const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  function cross(ax,ay,bx,by){return ax*by-ay*bx}
  function crosses(a,b,c,d){
    // Proper interior crossing, with endpoints allowed at the segment interior.
    const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y;
    const den=cross(rx,ry,sx,sy);if(Math.abs(den)<1e-9)return false;
    const qx=c.x-a.x,qy=c.y-a.y;
    const t=cross(qx,qy,sx,sy)/den,u=cross(qx,qy,rx,ry)/den;
    return t>1e-6&&t<1-1e-6&&u>=-1e-6&&u<=1+1e-6;
  }
  function wallsInPath(start,end,walls){
    return walls.filter(w=>crosses(start,end,{x:w.x1,y:w.y1},{x:w.x2,y:w.y2}));
  }
  function signalAt(point,aps,walls,band){
    if(!aps.length)return -110;
    let best=-110;const freq=FREQUENCY[band]||5;
    for(const ap of aps){
      const d=Math.max(1,Math.hypot(point.x-ap.x,point.y-ap.y));
      const fspl1m=32.44+20*Math.log10(freq*1000)-60; // 1 m free-space loss, GHz frequency
      const wallLoss=wallsInPath(ap,point,walls).reduce((s,w)=>s+(MATERIALS[w.material]?.loss||0),0);
      const rssi=(ap.power??16)-fspl1m-27*Math.log10(d)-wallLoss;
      best=Math.max(best,rssi);
    }
    return clamp(best,-110,-15);
  }
  function zoneSamples(z, n=5){
    const out=[];for(let i=0;i<n;i++)for(let j=0;j<n;j++)out.push({x:z.x+(i+.5)*z.w/n,y:z.y+(j+.5)*z.h/n});return out;
  }
  function analyze(s,steps=22){
    const area=s.width*s.height, plans=s.plans.map(p=>{
      let good=0,total=0,mean=0;
      for(let y=0;y<steps;y++)for(let x=0;x<steps;x++){
        const v=signalAt({x:(x+.5)*s.width/steps,y:(y+.5)*s.height/steps},p.aps,s.walls,s.band);
        mean+=v;total++;if(v>=s.threshold)good++;
      }
      const zones=s.zones.map(z=>{
        const vals=zoneSamples(z).map(pt=>signalAt(pt,p.aps,s.walls,s.band));
        const count=vals.filter(v=>v>=s.threshold).length;
        return {id:z.id,name:z.name,priority:z.priority,coverage:count/vals.length,avg:vals.reduce((a,b)=>a+b,0)/vals.length,weight:z.priority*z.w*z.h};
      });
      const denom=zones.reduce((v,z)=>v+z.weight,0);
      const weighted=denom ? zones.reduce((v,z)=>v+z.coverage*z.weight,0)/denom:good/total;
      return {name:p.name,overall:good/total,mean:mean/total,weighted,zones};
    });
    return {plans,diff:plans[1].weighted-plans[0].weighted,area};
  }
  function sample(){return {
    version:1,width:12,height:8,band:'5',threshold:-67,
    walls:[
      {id:'w1',x1:4,y1:.1,x2:4,y2:7.9,material:'concrete'},
      {id:'w2',x1:8,y1:.1,x2:8,y2:5.4,material:'drywall'},
      {id:'w3',x1:8,y1:5.4,x2:11.9,y2:5.4,material:'wood'}
    ],
    zones:[
      {id:'z1',name:'リモート会議',x:8.5,y:.7,w:3,h:3,priority:3},
      {id:'z2',name:'リビング',x:.7,y:1,w:2.8,h:5,priority:2},
      {id:'z3',name:'寝室',x:8.6,y:5.7,w:2.8,h:1.7,priority:2}
    ],
    plans:[{name:'現状 A',aps:[{id:'a1',x:1.7,y:4,power:16}]},{name:'移設 B',aps:[{id:'b1',x:6.8,y:3.4,power:16}]}]
  }}
  function validate(raw){
    if(!raw||typeof raw!=='object')throw Error('JSONが正しくありません');
    const s=structuredClone(raw);
    if(!finite(s.width,3,40)||!finite(s.height,3,30))throw Error('間取りの寸法は3〜40m（縦は30m以下）');
    if(!FREQUENCY[s.band]||!finite(s.threshold,-90,-45))throw Error('周波数・判定しきい値が不正です');
    if(!Array.isArray(s.walls)||s.walls.length>50||!Array.isArray(s.zones)||s.zones.length>20||!Array.isArray(s.plans)||s.plans.length!==2)throw Error('データ件数が不正です');
    const unique=a=>a.every((x,i)=>a.findIndex(v=>v.id===x.id)===i);
    const xy=(x,y)=>finite(x,0,s.width)&&finite(y,0,s.height);
    if(!unique(s.walls)||!unique(s.zones))throw Error('IDが重複しています');
    for(const w of s.walls){if(typeof w.id!=='string'||!MATERIALS[w.material]||!xy(w.x1,w.y1)||!xy(w.x2,w.y2)||Math.hypot(w.x2-w.x1,w.y2-w.y1)<.1)throw Error('壁の形状が不正です')}
    for(const z of s.zones){if(typeof z.id!=='string'||typeof z.name!=='string'||z.name.length>60||!finite(z.priority,1,3)||!xy(z.x,z.y)||!finite(z.w,.2,s.width)||!finite(z.h,.2,s.height)||z.x+z.w>s.width+.00001||z.y+z.h>s.height+.00001)throw Error('優先エリアの形状が不正です')}
    for(const p of s.plans){if(typeof p.name!=='string'||p.name.length>40||!Array.isArray(p.aps)||p.aps.length>5||!unique(p.aps))throw Error('ルーター一覧が不正です');for(const ap of p.aps){if(typeof ap.id!=='string'||!xy(ap.x,ap.y)||!finite(ap.power,0,30))throw Error('ルーター値が不正です')}}
    return s;
  }
  function grid(s,planIndex,nx=36){
    const ny=Math.max(10,Math.round(nx*s.height/s.width)),items=[];
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)items.push({i,j,v:signalAt({x:(i+.5)*s.width/nx,y:(j+.5)*s.height/ny},s.plans[planIndex].aps,s.walls,s.band)});
    return {nx,ny,items};
  }
  return {MATERIALS,FREQUENCY,crosses,wallsInPath,signalAt,zoneSamples,analyze,sample,validate,grid,clamp};
});
