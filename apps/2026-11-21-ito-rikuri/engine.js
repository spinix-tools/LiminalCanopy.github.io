/* ITO RIKURI: pure, dependency-free cross-stitch engine. MIT license. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ItoEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SYMBOLS = ['●','▲','■','◆','✚','★','○','△','□','◇','×','＋'];
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const round = (n, digits = 1) => Number(n.toFixed(digits));
  const deepCopy = (x) => JSON.parse(JSON.stringify(x));
  const toN = (x) => Number(x);

  function makeSample() {
    const colors = [
      {id:'petal',name:'珊瑚',hex:'#DD6979',stock:55},
      {id:'shadow',name:'濃桃',hex:'#A34869',stock:3},
      {id:'leaf',name:'若葉',hex:'#4D9279',stock:44},
      {id:'stem',name:'深緑',hex:'#30665F',stock:30},
      {id:'sky',name:'空色',hex:'#6B9ED5',stock:0.5},
      {id:'sun',name:'黄',hex:'#E7AE4F',stock:12}
    ];
    const width=28, height=22;
    const cells=Array(width*height).fill(null);
    function put(x,y,id){if(x>=0&&x<width&&y>=0&&y<height)cells[y*width+x]=id;}
    // Two flowers and a few floating accents: deliberately locally-authored sample.
    for(const [cx,cy,scale] of [[9,8,1],[20,11,.78]]) {
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const dx=(x-cx)/scale, dy=(y-cy)/scale;
        const petals=(Math.pow(dx-3,2)+dy*dy<9)||(Math.pow(dx+3,2)+dy*dy<9)||
          (dx*dx+Math.pow(dy-3,2)<9)||(dx*dx+Math.pow(dy+3,2)<9);
        if(petals)put(x,y, (dx+dy>2.7)?'shadow':'petal');
        if(dx*dx+dy*dy<3.2)put(x,y,'sun');
      }
      for(let y=Math.ceil(cy+3*scale);y<21;y++)put(cx,y,'stem');
      for(let i=0;i<4;i++){
        put(cx-1-i,cy+7+i,'leaf');put(cx+1+i,cy+9+i,'leaf');
      }
    }
    [[3,3],[24,3],[4,16],[25,18],[14,4],[15,17]].forEach(([x,y])=>put(x,y,'sky'));
    return {version:1,title:'二輪の花',width,height,count:14,strands:2,waste:55,
      colors,cells};
  }

  function validateProject(obj) {
    if(!obj || typeof obj!=='object' || Array.isArray(obj))throw Error('JSONの形式が正しくありません。');
    const p = deepCopy(obj);
    if(p.version!==1)throw Error('対応していないバージョンです。');
    if(typeof p.title!=='string' || p.title.length>120)throw Error('タイトルが不正です。');
    for(const k of ['width','height','count','strands','waste']) if(!Number.isFinite(p[k]))throw Error(k+'の値が不正です。');
    if(!Number.isInteger(p.width)||p.width<4||p.width>64||!Number.isInteger(p.height)||p.height<4||p.height>64)throw Error('サイズは4〜64目にしてください。');
    if(!Number.isInteger(p.count)||p.count<8||p.count>28)throw Error('布のカウントは8〜28です。');
    if(!Number.isInteger(p.strands)||p.strands<1||p.strands>6)throw Error('使用本数は1〜6本です。');
    if(p.waste<0||p.waste>150)throw Error('ロス率は0〜150%です。');
    if(!Array.isArray(p.colors)||p.colors.length<1||p.colors.length>12)throw Error('色数は1〜12色です。');
    const ids=new Set();
    for(const c of p.colors){
      if(!c||typeof c!=='object'||typeof c.id!=='string'||!/^[a-zA-Z0-9_-]{1,32}$/.test(c.id)||ids.has(c.id))throw Error('色IDが不正または重複しています。');
      if(typeof c.name!=='string'||!c.name.trim()||c.name.length>36)throw Error('色名は1〜36文字です。');
      if(typeof c.hex!=='string'||!HEX.test(c.hex))throw Error('カラーコードが不正です。');
      if(!Number.isFinite(c.stock)||c.stock<0||c.stock>100000)throw Error('糸の残量は0〜100000cmです。');
      ids.add(c.id);
    }
    if(!Array.isArray(p.cells)||p.cells.length!==p.width*p.height)throw Error('マス数が一致しません。');
    for(const id of p.cells)if(id!==null&&!ids.has(id))throw Error('図案に存在しない色があります。');
    return p;
  }

  function usagePerStitchCm(p){
    // One cross ≈ 2 diagonals + 2 backside traversals, in single-strand lengths.
    // Stock is physical 6-strand floss length in cm; divide individual-ply length by 6.
    return (2*Math.SQRT2+2)*2.54/p.count*p.strands/6*(1+p.waste/100);
  }
  function usage(p) {
    p=validateProject(p);
    const counts=Object.fromEntries(p.colors.map(c=>[c.id,0]));
    for(const id of p.cells)if(id!==null)counts[id]++;
    const factor=usagePerStitchCm(p);
    const rows=p.colors.map((c,i)=>{
      const needed=counts[c.id]*factor;
      return {id:c.id,name:c.name,hex:c.hex,symbol:SYMBOLS[i],stitches:counts[c.id],
        neededCm:round(needed,2),stockCm:c.stock,
        gapCm:round(c.stock-needed,2),shortageCm:round(Math.max(0,needed-c.stock),2),
        status:needed>c.stock+1e-8?'不足':'足りる'};
    });
    return {rows, stitches:p.cells.filter(x=>x!==null).length, count:p.count,
      factorCm:factor, physicalWidthCm:round(p.width*2.54/p.count,2),
      physicalHeightCm:round(p.height*2.54/p.count,2),
      missingColors:rows.filter(r=>r.shortageCm>0).length,
      requiredCm:round(rows.reduce((a,r)=>a+r.neededCm,0),2),
      shortageCm:round(rows.reduce((a,r)=>a+r.shortageCm,0),2)};
  }
  function hexRgb(h){return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));}
  function colorDistance(a,b){
    const x=hexRgb(a),y=hexRgb(b);
    // Weighted RGB for a quick visual *suggestion* only; not a perceptual equivalence.
    return Math.sqrt(.3*(x[0]-y[0])**2+.59*(x[1]-y[1])**2+.11*(x[2]-y[2])**2);
  }
  function suggestions(project){
    const p=validateProject(project), u=usage(p), f=usagePerStitchCm(p);
    return u.rows.filter(r=>r.shortageCm>0 && r.stitches>0).map(row=>{
      const candidate=u.rows.filter(other=>other.id!==row.id &&
        other.stockCm+1e-8>=other.neededCm+row.stitches*f)
        .map(other=>({...other,distance:round(colorDistance(row.hex,other.hex),1)}))
        .sort((a,b)=>a.distance-b.distance);
      return {fromId:row.id,fromName:row.name,toId:candidate[0]?.id||null,
        toName:candidate[0]?.name||null,distance:candidate[0]?.distance??null,
        explanation:candidate.length?'色の近さはRGB近似。見本糸の確認を推奨。':'全色置換できる残量の色はありません。'};
    });
  }
  function replaceColor(project, from, to){
    const p=validateProject(project);
    if(from===to||!p.colors.some(c=>c.id===from)||!p.colors.some(c=>c.id===to))throw Error('置換先の色が不正です。');
    p.cells=p.cells.map(id=>id===from?to:id);
    return p;
  }
  function paint(project,x,y,id){
    const p=validateProject(project);
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=p.width||y<0||y>=p.height)throw Error('マスが範囲外です。');
    if(id!==null&&!p.colors.some(c=>c.id===id))throw Error('未登録色です。');
    p.cells[y*p.width+x]=id;
    return p;
  }
  function fill(project,x,y,id){
    const p=validateProject(project);
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=p.width||y<0||y>=p.height)throw Error('マスが範囲外です。');
    if(id!==null&&!p.colors.some(c=>c.id===id))throw Error('未登録色です。');
    const start=y*p.width+x,old=p.cells[start];if(old===id)return p;
    const todo=[start];p.cells[start]=id;
    while(todo.length){const i=todo.pop(),xx=i%p.width,yy=Math.floor(i/p.width);
      for(const ni of [xx>0?i-1:-1,xx<p.width-1?i+1:-1,yy>0?i-p.width:-1,yy<p.height-1?i+p.width:-1])
        if(ni>=0&&p.cells[ni]===old){p.cells[ni]=id;todo.push(ni);}
    }
    return p;
  }
  function resize(project,w,h){
    const p=validateProject(project);
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<4||w>64||h<4||h>64)throw Error('サイズは4〜64目にしてください。');
    const cells=Array(w*h).fill(null);
    for(let y=0;y<Math.min(h,p.height);y++)for(let x=0;x<Math.min(w,p.width);x++)cells[y*w+x]=p.cells[y*p.width+x];
    return {...p,width:w,height:h,cells};
  }
  function escapeXml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
  function svg(project,{symbols=true,cellSize=20}={}){
    const p=validateProject(project), map=new Map(p.colors.map((c,i)=>[c.id,{...c,symbol:SYMBOLS[i]}]));
    const s=clamp(cellSize,12,32),w=p.width*s,h=p.height*s;
    const parts=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${escapeXml(p.title)}の図案">`,
      `<rect width="${w}" height="${h}" fill="#fffdf7"/>`];
    for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){
      const c=map.get(p.cells[y*p.width+x]);if(!c)continue;
      parts.push(`<rect x="${x*s}" y="${y*s}" width="${s}" height="${s}" fill="${c.hex}"/>`);
      if(symbols)parts.push(`<text x="${x*s+s/2}" y="${y*s+s*.72}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${s*.63}" fill="#171b2b">${escapeXml(c.symbol)}</text>`);
    }
    // 5-stitch guides bold, 1-stitch guides faint; drawn over fill.
    for(let x=0;x<=p.width;x++)parts.push(`<line x1="${x*s}" x2="${x*s}" y1="0" y2="${h}" stroke="${x%5===0?'#344354':'#9babb4'}" stroke-width="${x%5===0?1.15:.45}"/>`);
    for(let y=0;y<=p.height;y++)parts.push(`<line x1="0" x2="${w}" y1="${y*s}" y2="${y*s}" stroke="${y%5===0?'#344354':'#9babb4'}" stroke-width="${y%5===0?1.15:.45}"/>`);
    parts.push('</svg>');return parts.join('');
  }
  function csv(project){
    const u=usage(project), esc=s=>'"'+String(s).replace(/"/g,'""')+'"';
    return '\uFEFF'+['記号,糸名,色,必要目数,必要糸cm（6本束換算）,手持ちcm,不足cm,判定',...u.rows.map(r=>[r.symbol,r.name,r.hex,r.stitches,r.neededCm,r.stockCm,r.shortageCm,r.status].map(esc).join(','))].join('\r\n');
  }
  return {SYMBOLS,makeSample,validateProject,usagePerStitchCm,usage,colorDistance,suggestions,replaceColor,paint,fill,resize,svg,csv,deepCopy};
});
