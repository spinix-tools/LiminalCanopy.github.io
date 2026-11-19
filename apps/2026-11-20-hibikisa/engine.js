/* HIBIKISA - transparent octave-band RT60 estimate. MIT, 2026. */
(function (root, factory) {
  const lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  if (root) root.Hibikisa = lib;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const BANDS = [125, 250, 500, 1000, 2000, 4000];
  // Illustrative coefficients only: not certified material product data.
  const MATERIALS = {
    gypsum: { name: '塗装石膏ボード（参考）', a: [.08,.05,.04,.04,.05,.06] },
    concrete: { name: 'コンクリート（参考）', a: [.01,.01,.02,.02,.02,.03] },
    wood: { name: '木質フローリング（参考）', a: [.15,.11,.10,.07,.06,.07] },
    carpet: { name: '厚手カーペット（参考）', a: [.08,.15,.30,.55,.65,.70] },
    tiles: { name: '硬質タイル（参考）', a: [.01,.01,.02,.02,.02,.02] },
    ceiling: { name: '吸音天井板（参考）', a: [.35,.55,.75,.80,.80,.75] },
    drape: { name: '厚手カーテン（参考）', a: [.05,.12,.25,.42,.55,.60] },
    foam50: { name: '多孔質パネル 50mm（参考）', a: [.10,.32,.65,.87,.90,.85] },
    wool100: { name: '多孔質パネル 100mm（参考）', a: [.28,.63,.85,.95,.95,.92] }
  };
  const DEFAULT = {
    length: 4.0, width: 3.2, height: 2.4, wall: 'gypsum', floor: 'wood', ceiling: 'gypsum',
    panel: 'foam50', panelArea: 4, target: .5, method: 'sabine', focus: 'speech'
  };
  const FOCUS = { speech: [2,3,4], all: [0,1,2,3,4,5] };
  function num(value, min, max, field) {
    const n = Number(value);
    if (value === '' || value === null || !Number.isFinite(n) || n < min || n > max) {
      throw new Error(field + ' は ' + min + '〜' + max + ' の数値を入力してください。');
    }
    return n;
  }
  function validate(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('設定が不正です。');
    const c = {
      length: num(input.length, 1, 30, '部屋の奥行'),
      width: num(input.width, 1, 30, '部屋の幅'),
      height: num(input.height, 1.8, 12, '天井高'),
      panelArea: num(input.panelArea, 0, 2000, 'パネル面積'),
      target: num(input.target, .15, 3, '目標RT60'),
      method: input.method,
      focus: input.focus,
      wall: input.wall,
      floor: input.floor,
      ceiling: input.ceiling,
      panel: input.panel
    };
    for (const k of ['wall','floor','ceiling','panel']) if (!Object.hasOwn(MATERIALS,c[k])) throw new Error(k + ' の素材が不正です。');
    if (!['sabine','eyring'].includes(c.method)) throw new Error('計算方式が不正です。');
    if (!Object.hasOwn(FOCUS,c.focus)) throw new Error('評価帯域が不正です。');
    if (c.panelArea > 2 * (c.length + c.width) * c.height + 1e-9) throw new Error('パネル面積が壁面積を超えています。');
    return c;
  }
  function surfaces(c) {
    return { volume:c.length*c.width*c.height, floor:c.length*c.width,
      ceiling:c.length*c.width, walls:2*(c.length+c.width)*c.height };
  }
  function calculate(input, areaOverride) {
    const c = validate(input), geo = surfaces(c);
    const area = areaOverride === undefined ? c.panelArea : num(areaOverride,0,geo.walls,'パネル面積');
    const base = [], after = [], baseAbs = [], afterAbs = [];
    const totalArea = geo.floor + geo.ceiling + geo.walls;
    for (let i=0;i<6;i++) {
      const A = geo.floor*MATERIALS[c.floor].a[i] + geo.ceiling*MATERIALS[c.ceiling].a[i] + geo.walls*MATERIALS[c.wall].a[i];
      const delta = area * (MATERIALS[c.panel].a[i] - MATERIALS[c.wall].a[i]);
      const A2 = A + delta;
      baseAbs.push(A); afterAbs.push(A2);
      function rt(abs) {
        if (c.method === 'sabine') return abs>0 ? .161*geo.volume/abs : Infinity;
        const alpha = abs/totalArea;
        // Effective average absorption must be <1 for physically valid Eyring.
        if (alpha >= 1) return 0;
        return alpha > 0 ? .161*geo.volume/(-totalArea*Math.log1p(-alpha)) : Infinity;
      }
      base.push(rt(A)); after.push(rt(A2));
    }
    return { config:c,geo,area,base,after,baseAbs,afterAbs,focusBands:FOCUS[c.focus], bands:BANDS };
  }
  function recommend(input) {
    const c=validate(input), geo=surfaces(c), start=calculate(c,0), relevant=FOCUS[c.focus];
    if (relevant.every(i=>start.base[i] <= c.target+1e-10))
      return {feasible:true,area:0,limiting:null,attain:start.base,reason:'現在の仕上げだけで指定目標を満たします。'};
    const S=geo.walls+geo.floor+geo.ceiling;
    const need = c.method === 'sabine' ? .161*geo.volume/c.target :
      -S*Math.expm1(-.161*geo.volume/(c.target*S));
    // A_i(x)=A_i(0)+(alpha_panel-alpha_wall)_i*x. Each target is
    // a half-interval; intersect all of them, even when treatment worsens a band.
    let minArea=0,maxArea=geo.walls;
    const impossible=[];
    for(const i of relevant){
      const gain=MATERIALS[c.panel].a[i]-MATERIALS[c.wall].a[i];
      const required=need-start.baseAbs[i];
      if (Math.abs(gain) < 1e-12){ if(required>1e-9)impossible.push(BANDS[i]); }
      else if(gain>0) minArea=Math.max(minArea,required/gain);
      else maxArea=Math.min(maxArea,required/gain);
    }
    if(impossible.length || minArea>maxArea+1e-8 || maxArea<0 || minArea>geo.walls+1e-8){
      const end=calculate(c,geo.walls);
      return {feasible:false,area:null,limiting:impossible,attain:end.after,
        reason:'この素材と壁面積では、選択帯域をすべて目標以下にできません。低音に強い素材や目標を見直してください。'};
    }
    const area=Math.max(0,Math.min(geo.walls,minArea));
    const final=calculate(c,area);
    const limiting=relevant.slice().sort((a,b)=>(final.after[b]-c.target)-(final.after[a]-c.target))[0];
    return {feasible:true,area,limiting:BANDS[limiting],attain:final.after,
      reason:'評価帯域で目標以下になる理論上の最小壁面被覆面積です。'};
  }
  function report(input) {
    const data=calculate(input);
    const suggestion=recommend(input);
    const focus=data.focusBands;
    const avg = v=>focus.reduce((s,i)=>s+v[i],0)/focus.length;
    return {...data,suggestion,avgBase:avg(data.base),avgAfter:avg(data.after),passBefore:focus.every(i=>data.base[i]<=data.config.target),passAfter:focus.every(i=>data.after[i]<=data.config.target)};
  }
  function asCSV(r) {
    const rows=[['周波数Hz','処理前RT60秒','処理後RT60秒','目標秒','評価対象'],
      ...r.bands.map((b,i)=>[b,r.base[i].toFixed(4),r.after[i].toFixed(4),r.config.target,r.focusBands.includes(i)?'対象':'参考'])];
    return '\uFEFF'+rows.map(row=>row.join(',')).join('\r\n')+'\r\n';
  }
  return {BANDS,MATERIALS,DEFAULT,validate,surfaces,calculate,recommend,report,asCSV};
});
