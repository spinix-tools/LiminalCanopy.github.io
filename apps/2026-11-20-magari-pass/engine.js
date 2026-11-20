/* MAGARI PASS — geometric screening engine. Unit: centimetres. MIT. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MagariEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DEG = Math.PI / 180;
  const EPS = 1e-7;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const DEFAULT = {
    hallLength: 470, hallWidth: 150, turnWidth: 150, riseLength: 425, ceiling: 240,
    itemLength: 190, itemDepth: 65, itemHeight: 85, clearance: 3,
    grid: 10, angleStep: 15, mode: 'normal',
    obstacle: { enabled: false, x: 363, y: 72, w: 25, h: 24 }
  };
  const copy = x => JSON.parse(JSON.stringify(x));
  function normalize(p) {
    const d = copy(DEFAULT); p = p && typeof p === 'object' ? p : {};
    for (const k of Object.keys(d)) if (typeof d[k] === 'number') {
      const v = Number(p[k]); if (p[k] !== undefined && Number.isFinite(v)) d[k] = v;
    }
    d.mode = p.mode === 'side' ? 'side' : 'normal';
    d.grid = [5, 10, 15].includes(Number(p.grid)) ? Number(p.grid) : 10;
    d.angleStep = 15;
    if (p.obstacle && typeof p.obstacle === 'object') {
      d.obstacle.enabled = !!p.obstacle.enabled;
      for (const k of ['x', 'y', 'w', 'h']) if (Number.isFinite(Number(p.obstacle[k]))) d.obstacle[k] = Number(p.obstacle[k]);
    }
    return d;
  }
  function validate(p) {
    const fields = [['hallLength', 240, 1200], ['riseLength', 240, 1200], ['hallWidth', 40, 350], ['turnWidth', 40, 350], ['itemLength', 20, 400], ['itemDepth', 10, 300], ['itemHeight', 10, 300], ['clearance', 0, 25], ['ceiling', 160, 400]];
    const errors = [];
    for (const [key, min, max] of fields) if (!Number.isFinite(p[key]) || p[key] < min || p[key] > max) errors.push(`${key} は ${min}〜${max}cm`);
    if (p.hallLength <= p.turnWidth) errors.push('横通路の長さは縦通路の幅より大きくしてください');
    if (p.riseLength <= p.hallWidth) errors.push('縦通路の長さは横通路の幅より大きくしてください');
    if (p.obstacle.enabled) {
      const o = p.obstacle;
      if (o.w <= 0 || o.h <= 0 || o.x < 0 || o.y < 0 || o.x + o.w > p.hallLength || o.y + o.h > p.riseLength) errors.push('柱の寸法・位置を通路の範囲内にしてください');
    }
    return errors;
  }
  function footprint(p) {
    return { L: p.itemLength + 2 * p.clearance, D: (p.mode === 'side' ? p.itemHeight : p.itemDepth) + 2 * p.clearance,
      upright: p.mode === 'side' ? p.itemDepth : p.itemHeight };
  }
  function corners(x, y, length, depth, deg) {
    const a = deg * DEG, c = Math.cos(a), s = Math.sin(a), hl = length / 2, hd = depth / 2;
    return [[-hl,-hd],[hl,-hd],[hl,hd],[-hl,hd]].map(([px,py])=>[x + px*c - py*s, y + px*s + py*c]);
  }
  function project(points, axis) { const a=points.map(p=>p[0]*axis[0]+p[1]*axis[1]); return [Math.min(...a),Math.max(...a)]; }
  function intersects(poly, box) {
    const rect = [[box.x,box.y],[box.x+box.w,box.y],[box.x+box.w,box.y+box.h],[box.x,box.y+box.h]];
    const edges = [[poly[1][0]-poly[0][0],poly[1][1]-poly[0][1]],[poly[3][0]-poly[0][0],poly[3][1]-poly[0][1]]];
    const axes = [[1,0],[0,1], ...edges.map(([x,y])=>[-y,x])];
    for (const axis of axes) { const [a,b]=project(poly,axis),[c,d]=project(rect,axis); if (b<=c+EPS || d<=a+EPS) return false; }
    return true;
  }
  function inside(p, f, x, y, angle) {
    const poly = corners(x,y,f.L,f.D,angle);
    if (poly.some(([px,py]) => px < -EPS || py < -EPS || px > p.hallLength+EPS || py > p.riseLength+EPS)) return false;
    const forbidden = {x:0,y:p.hallWidth,w:p.hallLength-p.turnWidth,h:p.riseLength-p.hallWidth};
    if (intersects(poly,forbidden)) return false;
    if (p.obstacle.enabled && intersects(poly,p.obstacle)) return false;
    return true;
  }
  function segmentClear(p,f,a,b, steps) {
    // Dense interpolation prevents paths that tunnel through a forbidden region.
    const diff = b.a-a.a;
    const samples = steps || Math.max(2,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/2.5),Math.ceil(Math.abs(diff)/5));
    for (let i=1;i<=samples;i++) {
      const t=i/samples;
      if (!inside(p,f,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.a+diff*t)) return false;
    }
    return true;
  }
  function solve(params, opts) {
    const p = normalize(params), errors=validate(p), f=footprint(p);
    if (errors.length) return {status:'invalid',errors,footprint:f,expanded:0,path:[]};
    if (f.upright > p.ceiling) return {status:'headroom',message:'搬送姿勢の高さが設定天井高を超えます（天井高は固定の参考値です）',footprint:f,expanded:0,path:[]};
    const step=p.grid, angle=15, w=Math.floor(p.hallLength/step),h=Math.floor(p.riseLength/step),nc=12;
    const ix = n => Math.round(n/step);
    const sx=ix(f.L/2+step), sy=ix(p.hallWidth/2), gx=ix(p.hallLength-p.turnWidth/2),gy=ix(p.riseLength-f.L/2-step);
    const pos=(xx,yy,aa)=>({x:xx*step,y:yy*step,a:aa*angle});
    const start=pos(sx,sy,0),goal=pos(gx,gy,6);
    if (!inside(p,f,start.x,start.y,0)) return {status:'start',message:'搬入口の初期姿勢が収まりません。家具の長さ・通路幅・余裕を見直してください。',footprint:f,expanded:0,path:[]};
    if (!inside(p,f,goal.x,goal.y,90)) return {status:'goal',message:'搬入先の終端姿勢が収まりません。縦通路幅や家具寸法を見直してください。',footprint:f,expanded:0,path:[]};
    const key=(x,y,a)=>(y*(w+1)+x)*nc+a;
    const fromKey=id=>{const a=id%nc,k=(id-a)/nc,x=k%(w+1),y=(k-x)/(w+1);return {x,y,a};};
    const total=(w+1)*(h+1)*nc;
    const dist=new Float64Array(total).fill(Infinity), previous=new Int32Array(total).fill(-1);
    const heap=[];
    function push(id,priority) { let i=heap.length;heap.push({id,priority});while(i>0){let j=(i-1)>>1;if(heap[j].priority<=priority)break;heap[i]=heap[j];i=j;}heap[i]={id,priority}; }
    function pop(){let top=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let l=2*i+1;if(l>=heap.length)break;let r=l+1,c=r<heap.length&&heap[r].priority<heap[l].priority?r:l;if(heap[c].priority>=last.priority)break;heap[i]=heap[c];i=c;}heap[i]=last;}return top;}
    const heuristic=(x,y,a)=>Math.hypot(gx-x,gy-y)+Math.min(Math.abs(a-6),12-Math.abs(a-6))*0.35;
    const sid=key(sx,sy,0), gid=key(gx,gy,6);dist[sid]=0;push(sid,heuristic(sx,sy,0));
    const moves=[[1,0,0,1],[-1,0,0,1],[0,1,0,1],[0,-1,0,1],[1,1,0,1.415],[1,-1,0,1.415],[-1,1,0,1.415],[-1,-1,0,1.415],[0,0,1,0.68],[0,0,-1,0.68]];
    let expanded=0,done=false;
    const limit=(opts && opts.limit)||Math.min(100000,total*2);
    while(heap.length && expanded<limit){
      const item=pop(),k=item.id,{x,y,a}=fromKey(k);
      if(item.priority>dist[k]+heuristic(x,y,a)+1e-7)continue;
      expanded++;
      if(k===gid){done=true;break;}
      const poseA=pos(x,y,a);
      for(const [dx,dy,da,cost] of moves){
        let xx=x+dx,yy=y+dy,aa=(a+da+nc)%nc;
        if(xx<0||yy<0||xx>w||yy>h)continue;
        const poseB=pos(xx,yy,aa);
        // Rotation is always taken via +/- 15 degrees (not a wrap-around jump).
        if(da===1 && a===11)poseB.a=180;
        if(da===-1 && a===0)poseB.a=-15;
        if(!inside(p,f,poseB.x,poseB.y,poseB.a) || !segmentClear(p,f,poseA,poseB))continue;
        const nk=key(xx,yy,aa), candidate=dist[k]+cost;
        if(candidate<dist[nk]-1e-8){dist[nk]=candidate;previous[nk]=k;push(nk,candidate+heuristic(xx,yy,aa));}
      }
    }
    if(!done)return {status:'not-found',message:`指定の格子（${step}cm・15°）では経路候補を発見できません。物理的な搬入不可能の証明ではありません。`,footprint:f,expanded,path:[]};
    const path=[];let cur=gid,guard=0;
    while(cur!==-1 && guard++<=total){const {x,y,a}=fromKey(cur);path.push(pos(x,y,a));cur=previous[cur];}
    path.reverse();
    const compact=[];
    // Reduce collinear consecutive moves while preserving rotations and intermediate collision verification.
    for(let i=0;i<path.length;i++){
      if(i>0 && i<path.length-1){const a=path[i-1],b=path[i],c=path[i+1];if(a.a===b.a && b.a===c.a && Math.abs((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x))<EPS && (b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y)>=0)continue;}
      compact.push(path[i]);
    }
    return {status:'found',message:'指定寸法の2Dモデルで衝突しない経路候補が見つかりました（実搬入可の保証ではありません）。',footprint:f,expanded,path:compact,rawLength:path.length,cost:Number(dist[gid].toFixed(2))};
  }
  function sampleStats(p,r){
    const f=footprint(p);let turns=0,len=0;
    for(let i=1;i<r.path.length;i++){let a=r.path[i-1],b=r.path[i];len+=Math.hypot(b.x-a.x,b.y-a.y); if(a.a!==b.a)turns++;}
    return {length:Math.round(len),turns, footprint:r.footprint || f,points:r.path.length};
  }
  return {DEFAULT,normalize,validate,footprint,corners,intersects,inside,segmentClear,solve,sampleStats};
});