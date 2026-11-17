/* SENDO MAWASHI / 鮮度まわし — pure offline planning engine, MIT */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SendoEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400000;
  const id = () => 'r' + Math.random().toString(36).slice(2, 11);
  const today = () => new Date().toLocaleDateString('sv-SE');
  function dayNumber(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('日付はYYYY-MM-DD形式で入力してください');
    const n = Date.parse(s + 'T00:00:00Z');
    if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== s) throw new Error('存在しない日付です');
    return Math.round(n / DAY);
  }
  const asDate = n => new Date(n * DAY).toISOString().slice(0, 10);
  const after = (date, amount) => asDate(dayNumber(date) + amount);
  function nInt(value, label, min = 0, max = 10000000) {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(label + 'は' + min + '〜' + max + 'の整数にしてください');
    return n;
  }
  function nDecimal(value, label, min = 0, max = 100000) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(label + 'は' + min + '〜' + max + 'の数値にしてください');
    return n;
  }
  function text(value, label, max = 60) {
    const v = String(value ?? '').trim();
    if (!v || v.length > max) throw new Error(label + 'を1〜' + max + '文字で入力してください');
    return v;
  }
  function product(input) {
    return { id: text(input.id || id(), '商品ID'), name: text(input.name, '商品名'), unit: text(input.unit || '個', '単位', 10), daily: nInt(input.daily, '日販予測', 0, 100000), cost: nDecimal(input.cost, '仕入原価'), price: nDecimal(input.price, '売価') };
  }
  function lot(input) {
    return { id: text(input.id || id(), 'ロットID'), productId: text(input.productId, '商品ID'), label: text(input.label || '入荷分', 'ロット名'), qty: nInt(input.qty, '数量', 0), expiry: asDate(dayNumber(input.expiry)) };
  }
  function create(products = [], lots = [], movements = []) {
    if (!Array.isArray(products) || !Array.isArray(lots) || !Array.isArray(movements) || products.length > 100 || lots.length > 1500 || movements.length > 2000) throw new Error('データ形式または件数が不正です');
    const ps = products.map(product), ls = lots.map(lot);
    const pids = new Set(ps.map(p => p.id));
    if (pids.size !== ps.length || new Set(ls.map(l => l.id)).size !== ls.length) throw new Error('IDが重複しています');
    for (const l of ls) if (!pids.has(l.productId)) throw new Error('存在しない商品に紐づくロットがあります');
    const ms = movements.map(m => ({
      id: text(m.id, '記録ID'), date: asDate(dayNumber(m.date)), kind: ['sale', 'discard'].includes(m.kind) ? m.kind : (() => { throw new Error('操作種別が不正'); })(),
      productId: text(m.productId, '商品ID'), qty: nInt(m.qty, '数量', 1), allocations: Array.isArray(m.allocations) ? m.allocations.map(a => ({ lotId: text(a.lotId, 'ロットID'), qty: nInt(a.qty, '数量', 1) })) : []
    }));
    return { version: 1, products: ps, lots: ls, movements: ms };
  }
  function defaultState(base = today()) {
    dayNumber(base);
    return create([
      { id: 'p1', name: '手作りマフィン', unit: '個', daily: 8, cost: 95, price: 300 },
      { id: 'p2', name: '瓶入りジュース', unit: '本', daily: 5, cost: 160, price: 420 },
      { id: 'p3', name: '焼き菓子セット', unit: '袋', daily: 3, cost: 210, price: 580 }
    ], [
      { id: 'l1', productId: 'p1', label: '月曜仕込み', qty: 24, expiry: after(base, 2) },
      { id: 'l2', productId: 'p1', label: '追加仕込み', qty: 20, expiry: after(base, 5) },
      { id: 'l3', productId: 'p2', label: '入荷 A', qty: 16, expiry: after(base, 3) },
      { id: 'l4', productId: 'p2', label: '入荷 B', qty: 36, expiry: after(base, 9) },
      { id: 'l5', productId: 'p3', label: 'セット A', qty: 18, expiry: after(base, 4) }
    ]);
  }
  function sortLots(lots) { return [...lots].sort((a,b) => a.expiry.localeCompare(b.expiry) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id)); }
  function available(state, productId, onDate) { const d = dayNumber(onDate); return state.lots.filter(l => l.productId === productId && dayNumber(l.expiry) >= d).reduce((s,l) => s + l.qty, 0); }
  function consumeFEFO(lots, productId, amount, onDate) {
    const count = nInt(amount, '使用量', 0);
    const dated = dayNumber(onDate), allocated = [];
    let left = count;
    for (const l of sortLots(lots.filter(x => x.productId === productId && dayNumber(x.expiry) >= dated && x.qty > 0))) {
      if (!left) break;
      const take = Math.min(l.qty, left);
      l.qty -= take; left -= take;
      allocated.push({lotId:l.id, qty:take});
    }
    return { used: count - left, missing: left, allocations: allocated };
  }
  function transact(state, {productId, qty, date, kind = 'sale'}) {
    if (!['sale','discard'].includes(kind)) throw new Error('操作種別が不正です');
    if (!state.products.some(p => p.id === productId)) throw new Error('商品が見つかりません');
    dayNumber(date);
    qty = nInt(qty, '数量', 1);
    const copy = create(state.products, state.lots, state.movements);
    if (available(copy, productId, date) < qty) throw new Error('期限内の在庫が不足しています。過去日の記録にもご注意ください');
    const picked = consumeFEFO(copy.lots, productId, qty, date);
    if (picked.missing) throw new Error('在庫が不足しています');
    const movement = { id:id(), kind, date, productId, qty, allocations:picked.allocations };
    copy.movements.push(movement);
    return { state:copy, movement };
  }
  function undoLast(state) {
    if (!state.movements.length) throw new Error('取り消す操作がありません');
    const copy = create(state.products, state.lots, state.movements);
    const m = copy.movements.pop();
    for (const a of m.allocations) {
      const item = copy.lots.find(l => l.id === a.lotId);
      if (!item) throw new Error('戻し先のロットがありません');
      item.qty += a.qty;
    }
    return copy;
  }
  function forecast(state, options = {}) {
    const opts = { start:options.start || today(), days:nInt(options.days ?? 14, '予測日数', 1, 45), weekend:nDecimal(options.weekend ?? 1, '週末倍率', 0, 5), uplift:nDecimal(options.uplift ?? 0, '販促増加率', 0, 3), window:nInt(options.window ?? 2, '販促対象残日数', 0, 14) };
    const first = dayNumber(opts.start), stock = state.lots.map(l=>({...l}));
    const summary = { sold:0, revenue:0, waste:0, wasteCost:0, shortage:0, costOfSold:0 };
    const lossByLot = Object.fromEntries(stock.map(l=>[l.id,0]));
    const soldByLot = Object.fromEntries(stock.map(l=>[l.id,0]));
    const rows=[];
    const productSummary = Object.fromEntries(state.products.map(p=>[p.id,{ sold:0, waste:0, shortage:0, revenue:0, wasteCost:0 }]));
    for (let t=0; t<opts.days; t++) {
      const current = first+t, date=asDate(current), dow = new Date(current*DAY).getUTCDay();
      const weekend = dow === 0 || dow === 6;
      const row = { date, sold:0, waste:0, shortage:0, stock:0, revenue:0 };
      // Expired before the selected start date: report as initial waste (not sellable).
      for (const l of stock) {
        if (l.qty && dayNumber(l.expiry) < current) {
          const p = state.products.find(p=>p.id===l.productId), n=l.qty;
          l.qty=0; row.waste+=n; summary.waste+=n; summary.wasteCost+=n*p.cost;
          productSummary[p.id].waste+=n; productSummary[p.id].wasteCost+=n*p.cost; lossByLot[l.id]+=n;
        }
      }
      for (const p of state.products) {
        const due = stock.some(l=>l.productId===p.id && l.qty && dayNumber(l.expiry)-current<=opts.window);
        const raw = p.daily * (weekend ? opts.weekend : 1) * (due ? 1 + opts.uplift : 1);
        const wanted = Math.round(raw);
        const r = consumeFEFO(stock,p.id,wanted,date);
        const gained = r.used*p.price;
        summary.sold+=r.used;summary.shortage+=r.missing;summary.revenue+=gained;summary.costOfSold+=r.used*p.cost;
        row.sold+=r.used;row.shortage+=r.missing;row.revenue+=gained;
        const ps=productSummary[p.id];ps.sold+=r.used;ps.shortage+=r.missing;ps.revenue+=gained;
        for(const a of r.allocations) soldByLot[a.lotId]+=a.qty;
      }
      // A lot is usable through the end of its recorded date; remaining units expire after sales.
      for(const l of stock) if(l.qty && dayNumber(l.expiry)===current) {
        const p=state.products.find(p=>p.id===l.productId), n=l.qty;
        l.qty=0;row.waste+=n;summary.waste+=n;summary.wasteCost+=n*p.cost;
        productSummary[p.id].waste+=n;productSummary[p.id].wasteCost+=n*p.cost;lossByLot[l.id]+=n;
      }
      row.stock=stock.reduce((s,l)=>s+l.qty,0);rows.push(row);
    }
    return { options:opts, rows, summary, productSummary, lossByLot, soldByLot, remainder:stock };
  }
  function compare(state, options) {
    const base=forecast(state,{...options,uplift:0});
    const promo=forecast(state,options);
    return {base,promo,savedWaste:base.summary.waste-promo.summary.waste, extraRevenue:promo.summary.revenue-base.summary.revenue};
  }
  function toCSV(rows, columns) {
    const escape=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    return '\uFEFF'+columns.map(c=>escape(c[0])).join(',')+'\r\n'+rows.map(r=>columns.map(c=>escape(r[c[1]])).join(',')).join('\r\n')+'\r\n';
  }
  return {today,after,dayNumber,product,lot,create,defaultState,sortLots,available,consumeFEFO,transact,undoLast,forecast,compare,toCSV};
});