/* SIGN SIKAI - offline geometry and viewing checks. MIT License. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SikaiEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const EPS = 1e-9;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const finite = (v, min, max, label) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw Error(`${label}: ${min}〜${max}の数値にしてください`);
    return v;
  };
  const text = (v, fallback) => typeof v === 'string' ? v.trim().slice(0, 70) || fallback : fallback;
  const makeId = (prefix, items) => {
    let n = 1;
    while (items.some(x => x.id === prefix + n)) n++;
    return prefix + n;
  };
  function demo() {
    return {
      version: 1,
      name: '小さな展示室の案内計画',
      room: { width: 12, height: 8 },
      settings: { eyeStanding: 1.55, eyeSeated: 1.13, minAngle: 30 },
      visitors: [
        { id: 'v1', name: '入口', x: 1.0, y: 6.7 },
        { id: 'v2', name: '中央通路', x: 6.0, y: 5.7 },
        { id: 'v3', name: '奥の通路', x: 10.6, y: 2.0 }
      ],
      obstacles: [
        { id: 'o1', name: '展示ケース', x: 3.1, y: 2.4, w: 2.2, h: 1.5, z: 1.65 },
        { id: 'o2', name: '間仕切り', x: 7.4, y: 3.0, w: 0.35, h: 3.0, z: 2.1 }
      ],
      signs: [
        { id: 's1', name: '総合案内', x: 6.3, y: 1.1, z: 1.55, letterMm: 50 },
        { id: 's2', name: '出口案内', x: 10.6, y: 6.8, z: 1.85, letterMm: 70 }
      ]
    };
  }
  // Liang-Barsky rectangle clipping: returns the [tEnter,tExit] of a 2D segment inside an AABB.
  function segmentRectInterval(a, b, r) {
    let lo = 0, hi = 1;
    const dx = b.x - a.x, dy = b.y - a.y;
    const p = [-dx, dx, -dy, dy];
    const q = [a.x-r.x, r.x+r.w-a.x, a.y-r.y, r.y+r.h-a.y];
    for (let i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < EPS) {
        if (q[i] < -EPS) return null;
      } else {
        const t = q[i] / p[i];
        if (p[i] < 0) lo = Math.max(lo, t);
        else hi = Math.min(hi, t);
        if (lo > hi + EPS) return null;
      }
    }
    if (hi < EPS || lo > 1 - EPS || hi - lo < EPS) return null;
    return [clamp(lo, 0, 1), clamp(hi, 0, 1)];
  }
  const contains = (p, r) => p.x >= r.x-EPS && p.x <= r.x+r.w+EPS && p.y >= r.y-EPS && p.y <= r.y+r.h+EPS;
  function firstBlocker(visitor, sign, obstacles, eyeZ) {
    const matches = [];
    for (const o of obstacles) {
      const interval = segmentRectInterval(visitor, sign, o);
      if (!interval) continue;
      const [lo, hi] = interval;
      const zLo = eyeZ + (sign.z - eyeZ) * lo;
      const zHi = eyeZ + (sign.z - eyeZ) * hi;
      // A finite vertical prism blocks if the line passes below its top anywhere inside.
      if (Math.min(zLo, zHi) <= o.z + EPS) matches.push({ name: o.name, id: o.id, at: lo });
    }
    matches.sort((a,b) => a.at-b.at);
    return matches[0] || null;
  }
  function angleMinutes(letterMm, distanceM) {
    if (distanceM < 1e-6) return 10800;
    return 2 * Math.atan(letterMm / (2 * 1000 * distanceM)) * 180 / Math.PI * 60;
  }
  function evaluateOne(visitor, sign, obstacles, eyeZ, minAngle) {
    const horizontal = Math.hypot(sign.x-visitor.x, sign.y-visitor.y);
    const distance = Math.hypot(horizontal, sign.z-eyeZ);
    const arcmin = angleMinutes(sign.letterMm, distance);
    const blocker = firstBlocker(visitor, sign, obstacles, eyeZ);
    const status = blocker ? 'blocked' : (arcmin + EPS < minAngle ? 'small' : 'good');
    return { status, blocker, distance, arcmin, visitorId: visitor.id, signId: sign.id };
  }
  function evaluate(project) {
    const all = [];
    for (const s of project.signs) for (const v of project.visitors) {
      all.push({ ...evaluateOne(v,s,project.obstacles,project.settings.eyeStanding,project.settings.minAngle), sign:s.name,visitor:v.name, posture:'立位' });
      all.push({ ...evaluateOne(v,s,project.obstacles,project.settings.eyeSeated,project.settings.minAngle), sign:s.name,visitor:v.name, posture:'座位' });
    }
    const count = status => all.filter(x => x.status === status).length;
    return { all, total:all.length, good:count('good'), small:count('small'), blocked:count('blocked') };
  }
  function planForSign(project, id, limit=5) {
    const current = project.signs.find(s=>s.id===id);
    if (!current) return [];
    const minAngle = project.settings.minAngle;
    const evaluateCandidate = (s) => {
      let good=0, small=0, blocked=0, worst=Infinity;
      for (const v of project.visitors) for (const eye of [project.settings.eyeStanding,project.settings.eyeSeated]) {
        const r=evaluateOne(v,s,project.obstacles,eye,minAngle);
        if (r.status==='good') good++;
        else if (r.status==='small') small++;
        else blocked++;
        worst=Math.min(worst,r.arcmin);
      }
      return {good,small,blocked,score:good*2+small*0.75, worst};
    };
    const before=evaluateCandidate(current);
    const options=[];
    // Search 0.5 m grid over this room, preserving mounting height and text dimensions.
    for(let y=0.5; y <= project.room.height-0.5+EPS; y+=0.5) for(let x=0.5; x <= project.room.width-0.5+EPS; x+=0.5){
      if(project.obstacles.some(o=>contains({x,y},o)))continue;
      const moved={...current,x:Math.round(x*100)/100,y:Math.round(y*100)/100};
      const outcome=evaluateCandidate(moved);
      const movement=Math.hypot(x-current.x,y-current.y);
      options.push({...outcome,x:moved.x,y:moved.y,movement,ranking:outcome.score-movement*0.035});
    }
    options.sort((a,b)=>b.ranking-a.ranking || a.movement-b.movement || a.y-b.y || a.x-b.x);
    return options.filter(o=>o.score>before.score+EPS).slice(0,limit).map(o=>({...o,before}));
  }
  function validate(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('データ形式が正しくありません');
    if(raw.version !== 1) throw Error('対応していないデータ形式です');
    const room=raw.room || {};
    const width=finite(room.width,2,30,'会場幅'),height=finite(room.height,2,25,'会場奥行');
    const settings=raw.settings || {};
    const eyeStanding=finite(settings.eyeStanding,0.5,2.5,'立位目線');
    const eyeSeated=finite(settings.eyeSeated,0.5,2.5,'座位目線');
    const minAngle=finite(settings.minAngle,5,90,'角度しきい値');
    const parseList=(items,prefix,max,fn)=>{
      if(!Array.isArray(items)||items.length>max)throw Error('登録件数が上限を超えたか、リスト形式が不正です');
      const ids=new Set();
      return items.map((o,i)=>{
        if(!o || typeof o!=='object')throw Error('配置データが不正です');
        const id=typeof o.id==='string' && /^[a-zA-Z0-9_-]{1,24}$/.test(o.id) ? o.id : prefix+(i+1);
        if(ids.has(id))throw Error('重複したIDがあります');
        ids.add(id);
        return {id,name:text(o.name,'無題'),...fn(o)};
      });
    };
    const pos=(o,coord,max,label)=>finite(o[coord],0,max,label);
    const visitors=parseList(raw.visitors,'v',30,o=>({x:pos(o,'x',width,'地点X'),y:pos(o,'y',height,'地点Y')}));
    const signs=parseList(raw.signs,'s',20,o=>({x:pos(o,'x',width,'サインX'),y:pos(o,'y',height,'サインY'),z:finite(o.z,0.3,3,'サイン中心高'),letterMm:finite(o.letterMm,2,250,'文字高さ')}));
    const obstacles=parseList(raw.obstacles,'o',30,o=>{
      const x=pos(o,'x',width,'什器X'),y=pos(o,'y',height,'什器Y');
      const w=finite(o.w,0.05,width,'什器幅'),h=finite(o.h,0.05,height,'什器奥行');
      if(x+w>width+EPS||y+h>height+EPS)throw Error('什器が会場外にはみ出しています');
      return {x,y,w,h,z:finite(o.z,0.1,4,'什器高さ')};
    });
    if(!visitors.length || !signs.length)throw Error('地点とサインを少なくとも1件ずつ登録してください');
    return {version:1,name:text(raw.name,'名称未設定'),room:{width,height},settings:{eyeStanding,eyeSeated,minAngle},visitors,signs,obstacles};
  }
  function csv(rows) {
    const esc=v=>{ let s=String(v==null?'':v); if (/^[=+@\-\t\r]/.test(s)) s="'"+s; return '"'+s.replace(/"/g,'""')+'"'; }; 
    return '\ufeff'+rows.map(row=>row.map(esc).join(',')).join('\r\n')+'\r\n';
  }
  function reportCsv(project) {
    const rows=[['サイン','観察地点','目線','判定','距離(m)','文字の視角(分)','遮蔽物']];
    for(const r of evaluate(project).all) rows.push([r.sign,r.visitor,r.posture,r.status, r.distance.toFixed(2),r.arcmin.toFixed(1),r.blocker?.name||'']);
    return csv(rows);
  }
  return {demo,validate,makeId,segmentRectInterval,contains,firstBlocker,angleMinutes,evaluateOne,evaluate,planForSign,csv,reportCsv};
});
