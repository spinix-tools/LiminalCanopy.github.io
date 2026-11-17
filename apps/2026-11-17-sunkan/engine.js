/* Sunkan / 寸感 — pure calculation and CSV helpers, MIT */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Sunkan = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const METRICS = Object.freeze({
    top: [
      { id: 'length', label: '着丈', axis: 'vertical', weight: 1.2 },
      { id: 'width', label: '身幅', axis: 'horizontal', weight: 2.1 },
      { id: 'shoulder', label: '肩幅', axis: 'horizontal', weight: 1.25 },
      { id: 'sleeve', label: '袖丈', axis: 'vertical', weight: 1 }
    ],
    bottom: [
      { id: 'waist', label: 'ウエスト平置き', axis: 'horizontal', weight: 2.2 },
      { id: 'rise', label: '股上', axis: 'vertical', weight: 1.25 },
      { id: 'inseam', label: '股下', axis: 'vertical', weight: 1.5 },
      { id: 'thigh', label: 'わたり幅', axis: 'horizontal', weight: 1.3 }
    ]
  });
  const DEFAULT = Object.freeze({
    category: 'top', referenceName: '着慣れたシャツ',
    reference: { length: 68, width: 54, shoulder: 47, sleeve: 59 },
    preference: 0, tolerance: 2, shrinkV: 0, shrinkH: 0,
    items: [
      {id:'a1', name:'候補A / リネンシャツ', size:'M', values:{length:70,width:55,shoulder:48,sleeve:59}},
      {id:'a2', name:'候補A / リネンシャツ', size:'L', values:{length:72,width:58,shoulder:50,sleeve:61}},
      {id:'b1', name:'候補B / オックスフォード', size:'M', values:{length:67,width:53,shoulder:46,sleeve:58}},
      {id:'b2', name:'候補B / オックスフォード', size:'L', values:{length:70,width:56,shoulder:48,sleeve:60}}
    ]
  });
  const copy = value => JSON.parse(JSON.stringify(value));
  function finiteIn(v, lo, hi) { return typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi; }
  function validate(state) {
    if (!state || !Object.hasOwn(METRICS, state.category)) throw Error('カテゴリが不正です');
    if (typeof state.referenceName !== 'string' || state.referenceName.length > 100) throw Error('基準服の名前が不正です');
    if (!finiteIn(state.preference, -10, 15) || !finiteIn(state.tolerance, .5, 15)) throw Error('比較条件が不正です');
    if (!finiteIn(state.shrinkH, 0, 15) || !finiteIn(state.shrinkV, 0, 15)) throw Error('縮み率が不正です');
    if (!Array.isArray(state.items) || state.items.length > 300) throw Error('候補数は300件以内にしてください');
    for (const m of METRICS[state.category]) {
      if (!finiteIn(state.reference?.[m.id], 1, 300)) throw Error('基準服の「' + m.label + '」は1〜300cmで指定してください');
    }
    const ids = new Set();
    for (const it of state.items) {
      if (!it || typeof it.id !== 'string' || !it.id || ids.has(it.id)) throw Error('候補IDが重複または不正です');
      ids.add(it.id);
      if (typeof it.name !== 'string' || !it.name.trim() || it.name.length > 100 || typeof it.size !== 'string' || !it.size.trim() || it.size.length > 30) throw Error('商品名・サイズ名が不正です');
      for (const m of METRICS[state.category]) if (!finiteIn(it.values?.[m.id], 1, 300)) throw Error(it.name + 'の「' + m.label + '」は1〜300cmで指定してください');
    }
    return true;
  }
  function trimmed(value, shrink) { return +(value * (1 - shrink / 100)).toFixed(2); }
  function goalValue(state, metric) {
    return state.reference[metric.id] + (metric.id === (state.category === 'top' ? 'width' : 'thigh') ? state.preference : 0);
  }
  function analyzeOne(state, item) {
    const rows = METRICS[state.category].map(m => {
      const before = item.values[m.id];
      const after = trimmed(before, m.axis === 'vertical' ? state.shrinkV : state.shrinkH);
      const target = goalValue(state, m);
      const delta = +(after - target).toFixed(2);
      return { id: m.id, label: m.label, before, after, target, delta, within: Math.abs(delta) <= state.tolerance, weight: m.weight };
    });
    const total = rows.reduce((a, r) => a + r.weight, 0);
    const penalty = rows.reduce((a, r) => a + r.weight * Math.min(2.5, Math.abs(r.delta) / state.tolerance), 0) / total;
    const score = Math.max(0, Math.round(100 * (1 - penalty / 2.5)));
    const misses = rows.filter(r => !r.within).length;
    return { ...item, score, misses, rows, rankLabel: misses === 0 ? '近い' : misses <= 2 ? '要確認' : '差が大きい' };
  }
  function rank(state) {
    validate(state);
    return state.items.map((it,i)=>({ ...analyzeOne(state,it), originalIndex:i }))
      .sort((a,b) => a.misses-b.misses || b.score-a.score || a.originalIndex-b.originalIndex);
  }
  function parseCSV(text, maxRows=301) {
    if (typeof text !== 'string' || text.length > 300000) throw Error('CSVが大きすぎます');
    const rows=[]; let row=[],cell='',quoted=false;
    text = text.replace(/^\uFEFF/,'');
    for (let i=0; i<text.length; i++) {
      const ch=text[i];
      if (quoted) {
        if (ch==='"' && text[i+1]==='"') {cell+='"';i++;}
        else if (ch==='"') quoted=false;
        else cell+=ch;
      } else if (ch==='"') {
        if (cell) throw Error('CSVの引用符が不正です');
        quoted=true;
      } else if (ch===',') {row.push(cell);cell='';}
      else if (ch==='\n' || ch==='\r') {
        if (ch==='\r' && text[i+1]==='\n') i++;
        row.push(cell); if (row.some(x=>x.trim())) rows.push(row);
        if(rows.length>maxRows) throw Error('CSVの行数上限を超えました');
        row=[];cell='';
      } else cell+=ch;
    }
    if(quoted) throw Error('CSVの引用符が閉じていません');
    row.push(cell); if(row.some(x=>x.trim())) rows.push(row);
    if(rows.length>maxRows) throw Error('CSVの行数上限を超えました');
    return rows;
  }
  function escapeCSV(v) { const raw=String(v??''); const s=/^[\t\r\n ]*[=+@-]/.test(raw) && typeof v==='string' ? '\''+raw : raw; return /[",\n\r]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }
  function toCSV(rows) { return '\uFEFF' + rows.map(row=>row.map(escapeCSV).join(',')).join('\r\n') + '\r\n'; }
  function importCandidates(text, category, idFactory) {
    const metrics=Object.hasOwn(METRICS,category) ? METRICS[category] : null; if(!metrics) throw Error('カテゴリが不正です');
    const rows=parseCSV(text); if(!rows.length) throw Error('空のCSVです');
    const header=rows[0].map(x=>x.trim());
    const indexOf=keys=>header.findIndex(h=>keys.includes(h));
    const nameCol=indexOf(['商品名','name','product']);
    const sizeCol=indexOf(['サイズ','size']);
    const nums=metrics.map(m=>indexOf([m.label,m.id]));
    if(nameCol===-1 || sizeCol===-1 || nums.some(x=>x===-1)) throw Error('見出し列が不足しています。CSV見本を確認してください');
    if(rows.length===1) throw Error('候補データがありません');
    const makeId=idFactory||(()=>String(Date.now())+Math.random());
    return rows.slice(1).map((row,i)=>{
      const values={};metrics.forEach((m,j)=>{const s=(row[nums[j]]??'').trim();values[m.id]=s ? Number(s) : NaN;});
      const item={id:String(makeId()),name:(row[nameCol]||'').trim(),size:(row[sizeCol]||'').trim(),values};
      if(!item.name || !item.size || Object.values(values).some(x=>!finiteIn(x,1,300))) throw Error('CSV '+(i+2)+'行目の入力が不正です');
      return item;
    });
  }
  function exportCandidates(state) {
    validate(state);
    const metrics=METRICS[state.category];
    return toCSV([['商品名','サイズ',...metrics.map(m=>m.label)],...state.items.map(it=>[it.name,it.size,...metrics.map(m=>it.values[m.id])])]);
  }
  function hydrate(json) {
    const data=typeof json==='string' ? JSON.parse(json) : json;
    if(data?.version!==1) throw Error('未対応のJSON形式です');
    validate(data.state);
    return copy(data.state);
  }
  return { METRICS, DEFAULT, copy, validate, trimmed, goalValue, analyzeOne, rank, parseCSV, toCSV, importCandidates, exportCandidates, hydrate };
});
