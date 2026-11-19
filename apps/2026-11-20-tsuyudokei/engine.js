/* 窓つゆ時報 / TSUYUDOKEI — browser/Node shared calculation core. MIT */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Tsuyu = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TIMES = Array.from({length:12}, (_, i) => `${String(i * 2).padStart(2,'0')}:00`);
  const PRESETS = Object.freeze({single:5.8, oldDouble:3.5, double:2.7, inner:1.8, triple:1.1});
  function assertNum(value, low, high, name) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < low || n > high || value === '') throw new Error(`${name}は${low}〜${high}の数値で指定してください`);
    return n;
  }
  function saturation(t) { // Magnus formula, hPa, over liquid water (simplified at subzero T)
    return 6.112 * Math.exp((17.62 * t) / (243.12 + t));
  }
  function dewPoint(t, rh) {
    const gamma = Math.log(rh / 100) + (17.62 * t) / (243.12 + t);
    return 243.12 * gamma / (17.62 - gamma);
  }
  function surfaceTemp(ti, to, u, rsi) {
    // U references the base assembly at internal surface resistance 0.13 m²K/W.
    // An altered indoor film resistance changes effective overall conductance.
    const other = 1 / u - 0.13;
    return ti - (ti - to) * rsi / (other + rsi);
  }
  function limitRH(ti, ts, target = 80) { return target * saturation(ts) / saturation(ti); }
  function normalizeScenario(source, name) {
    const x = source || {};
    return {
      u: assertNum(x.u, 0.6, 6.5, `${name}のU値`),
      rsi: assertNum(x.rsi, 0.13, 0.24, `${name}の室内側熱抵抗`),
      delta: assertNum(x.delta, -40, 30, `${name}の室内湿度補正`)
    };
  }
  function normalize(data) {
    if (!data || typeof data !== 'object') throw new Error('設定データの形式が不正です');
    if (!Array.isArray(data.rows) || data.rows.length !== 12) throw new Error('観測枠は2時間ごとに12件必要です');
    const rows = data.rows.map((r,i) => ({
      outside: assertNum(r && r.outside, -30, 45, `${TIMES[i]}の外気温`),
      inside: assertNum(r && r.inside, -10, 45, `${TIMES[i]}の室温`),
      rh: assertNum(r && r.rh, 1, 100, `${TIMES[i]}の湿度`)
    }));
    return {
      title: String(data.title || '窓の1日比較').slice(0,60),
      A: normalizeScenario(data.A, '現状A'),
      B: normalizeScenario(data.B, '対策B'),
      rows
    };
  }
  function stateFor(type='cold') {
    const cold = type === 'cold';
    const rows = Array.from({length:12}, (_,i) => {
      const outCold = [-4,-5,-6,-5,-2,1,4,3,1,-1,-2,-3][i];
      const outMild = [3,2,2,3,6,9,11,10,8,6,5,4][i];
      const inside = [19,18,18,19,20,21,21,21,21,20,20,19][i];
      const rh = [63,66,68,67,59,54,52,52,58,62,64,65][i];
      return {outside:cold ? outCold : outMild, inside, rh:cold ? rh : rh-9};
    });
    return {title:cold?'寒波の24時間（サンプル）':'穏やかな冬（サンプル）', A:{u:5.8,rsi:0.13,delta:0}, B:{u:2.7,rsi:0.13,delta:-10},rows};
  }
  function evaluateSlot(row, scenario) {
    const rh = Math.max(1, Math.min(100, row.rh + scenario.delta));
    const ts = surfaceTemp(row.inside, row.outside, scenario.u, scenario.rsi);
    const dp = dewPoint(row.inside, rh);
    const surfaceRH = 100 * rh / 100 * saturation(row.inside) / saturation(ts);
    const safeRH80 = limitRH(row.inside, ts, 80);
    const safeRH100 = limitRH(row.inside, ts, 100);
    return { rh, ts, dew: dp, surfaceRH, safeRH80, safeRH100, margin:ts-dp,
      condense:surfaceRH >= 100-1e-10, damp:surfaceRH >= 80-1e-10 };
  }
  function evaluateScenario(state, key) {
    const s = state[key];
    const slots = state.rows.map(r => evaluateSlot(r,s));
    const worstIdx = slots.reduce((ix,item,i,a) => item.surfaceRH > a[ix].surfaceRH ? i : ix,0);
    const excesses = slots.map((r,i) => ({i, excess:Math.max(0, r.rh - r.safeRH80)}));
    return {
      slots,
      condHours:slots.filter(x=>x.condense).length*2,
      dampHours:slots.filter(x=>x.damp).length*2,
      minMargin:Math.min(...slots.map(x=>x.margin)),
      maxRH:Math.max(...slots.map(x=>x.surfaceRH)),
      worstIdx,
      maxNeededReduction:Math.max(...excesses.map(x=>x.excess)),
      avgSurfaceRH:slots.reduce((v,x)=>v+x.surfaceRH,0)/slots.length,
      nCond:slots.filter(x=>x.condense).length
    };
  }
  function analyze(data) {
    const s = normalize(data);
    const A = evaluateScenario(s,'A');
    const B = evaluateScenario(s,'B');
    return {state:s,A,B, savedDampHours:A.dampHours-B.dampHours,
      savedCondHours:A.condHours-B.condHours};
  }
  function escapeCSV(value) {
    const s=String(value);return /[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
  }
  function reportCSV(report) {
    const head = ['time','outside_C','inside_C','base_RH_pct','A_U','A_Rsi','A_delta','B_U','B_Rsi','B_delta','A_surface_C','A_surface_RH_pct','A_dew_C','A_limit_80_RH_pct','B_surface_C','B_surface_RH_pct','B_dew_C','B_limit_80_RH_pct'];
    const s=report.state;
    return [head.join(','),...s.rows.map((r,i)=>[
      TIMES[i],r.outside,r.inside,r.rh,s.A.u,s.A.rsi,s.A.delta,s.B.u,s.B.rsi,s.B.delta,
      report.A.slots[i].ts.toFixed(2),report.A.slots[i].surfaceRH.toFixed(2),report.A.slots[i].dew.toFixed(2),report.A.slots[i].safeRH80.toFixed(2),
      report.B.slots[i].ts.toFixed(2),report.B.slots[i].surfaceRH.toFixed(2),report.B.slots[i].dew.toFixed(2),report.B.slots[i].safeRH80.toFixed(2)
    ].map(escapeCSV).join(','))].join('\r\n')+'\r\n';
  }
  function parseCsvRows(text) {
    const raw=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim().split('\n');
    if(raw.length!==13)throw new Error('CSVは見出し1行＋2時間枠12行で指定してください');
    const header=raw.shift().split(',').map(x=>x.trim().toLowerCase());
    const ti=header.indexOf('time'),oi=header.indexOf('outside_c'),ii=header.indexOf('inside_c'),ri=header.indexOf('base_rh_pct');
    if([ti,oi,ii,ri].some(x=>x<0))throw new Error('CSV見出しはtime,outside_C,inside_C,base_RH_pctが必要です');
    const rows=raw.map((l,i)=>{
      const c=l.split(',');
      if(c[ti]?.trim()!==TIMES[i])throw new Error(`時刻が不一致: ${TIMES[i]}を期待しました`);
      return {outside:assertNum(c[oi],-30,45,'外気温'),inside:assertNum(c[ii],-10,45,'室温'),rh:assertNum(c[ri],1,100,'湿度')};
    });
    return rows;
  }
  return {TIMES,PRESETS,normalize,stateFor,saturation,dewPoint,surfaceTemp,limitRH,evaluateSlot,evaluateScenario,analyze,reportCSV,parseCsvRows};
});
