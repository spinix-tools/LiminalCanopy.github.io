/* NEFUDA AWASE — pure calculations and CSV parser, no dependencies. */
(function (root) {
  'use strict';
  const PAGE = Object.freeze({ width: 210, height: 297 });
  const presets = {
    market12: { cols: 3, rows: 4, width: 60, height: 52, gapX: 5, gapY: 8, left: 10, top: 24 },
    card8: { cols: 2, rows: 4, width: 91, height: 55, gapX: 0, gapY: 8, left: 14, top: 20 },
    mini24: { cols: 4, rows: 6, width: 46, height: 36, gapX: 2, gapY: 4, left: 10, top: 21 }
  };
  const defaults = Object.freeze({ ...presets.market12, offsetX: 0, offsetY: 0, stepX: 0, stepY: 0, guides: true });
  const number = (x, d = 0) => Number.isFinite(Number(x)) && x !== '' && x !== null ? Number(x) : d;
  function validConfig(raw) {
    const c = { ...defaults, ...raw };
    for (const f of ['cols', 'rows', 'width', 'height', 'gapX', 'gapY', 'left', 'top', 'offsetX', 'offsetY', 'stepX', 'stepY']) c[f] = number(c[f], NaN);
    if (!Number.isInteger(c.cols) || c.cols < 1 || c.cols > 10 || !Number.isInteger(c.rows) || c.rows < 1 || c.rows > 15) throw new Error('列数は1〜10、行数は1〜15で設定してください。');
    if (![c.width,c.height].every(v => Number.isFinite(v) && v >= 15 && v <= 210)) throw new Error('札の幅・高さは15〜210mmにしてください。');
    if (![c.gapX,c.gapY,c.left,c.top].every(v => Number.isFinite(v) && v >= 0 && v <= 297)) throw new Error('余白と間隔は0以上で設定してください。');
    if (![c.offsetX,c.offsetY,c.stepX,c.stepY].every(v => Number.isFinite(v) && Math.abs(v) <= 10)) throw new Error('印刷補正は±10mm以内にしてください。');
    return c;
  }
  function placements(input) {
    const c = validConfig(input);
    const list = [];
    let overflow = false;
    for (let row = 0; row < c.rows; row++) for (let col = 0; col < c.cols; col++) {
      const x = c.left + c.offsetX + col * (c.width + c.gapX + c.stepX);
      const y = c.top + c.offsetY + row * (c.height + c.gapY + c.stepY);
      if (x < 0 || y < 0 || x + c.width > PAGE.width + 1e-8 || y + c.height > PAGE.height + 1e-8) overflow = true;
      list.push({ x, y, width: c.width, height: c.height, row, col });
    }
    return { positions: list, overflow, capacity: list.length, config: c };
  }
  function normalizedItems(items) {
    if (!Array.isArray(items)) throw new Error('商品リストが不正です。');
    if (items.length > 500) throw new Error('商品数は500件以下にしてください。');
    return items.map((item, index) => {
      const name = String(item.name || '').trim().slice(0, 120);
      const note = String(item.note || '').trim().slice(0, 140);
      const price = number(item.price, NaN);
      const qty = number(item.qty, NaN);
      if (!name) throw new Error(`${index + 1}件目の商品名を入力してください。`);
      if (!Number.isInteger(price) || price < 0 || price > 99999999) throw new Error(`${index + 1}件目の価格は0〜99,999,999の整数にしてください。`);
      if (!Number.isInteger(qty) || qty < 1 || qty > 500) throw new Error(`${index + 1}件目の枚数は1〜500の整数にしてください。`);
      return { name, note, price, qty };
    });
  }
  function paginate(rawItems, rawConfig) {
    const layout = placements(rawConfig);
    const items = normalizedItems(rawItems);
    const total = items.reduce((s, item) => s + item.qty, 0);
    if (total > 2000) throw new Error('総印刷枚数は2,000枚までです。');
    const flat = [];
    items.forEach((item) => { for (let i = 0; i < item.qty; i++) flat.push({ name: item.name, note: item.note, price: item.price }); });
    const pages = [];
    for (let i = 0; i < flat.length; i += layout.capacity) pages.push(flat.slice(i, i + layout.capacity));
    return { ...layout, pages, total, sheets: pages.length };
  }
  // Quote-aware CSV, including embedded line breaks and doubled quotes.
  function parseCSV(input) {
    const text = String(input || '').replace(/^\uFEFF/, '');
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i+1] === '"') { field += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else field += ch;
      } else if (ch === '"') { if (field.length) throw new Error('CSVの引用符が不正です。'); inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i+1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(v => v.trim())) rows.push(row);
        row = [];
      } else field += ch;
    }
    if (inQuotes) throw new Error('CSVの引用符が閉じていません。');
    row.push(field);
    if (row.some(v => v.trim())) rows.push(row);
    return rows;
  }
  function importCSV(raw) {
    const rows = parseCSV(raw);
    if (!rows.length) throw new Error('CSVが空です。');
    const heads = rows.shift().map(x => x.trim().toLowerCase());
    const names = { name:['name','商品名','品名'], price:['price','価格','値段'], qty:['qty','枚数','数量'], note:['note','補足','説明'] };
    const cols = {};
    Object.entries(names).forEach(([k, choices]) => { cols[k] = heads.findIndex(x => choices.includes(x)); });
    if (['name','price','qty'].some(k => cols[k] < 0)) throw new Error('CSVにはname,price,qty（商品名,価格,枚数）の列が必要です。');
    const items = rows.map(r => ({ name:r[cols.name] || '', price:r[cols.price] || '', qty:r[cols.qty] || '', note: cols.note >= 0 ? (r[cols.note] || '') : '' }));
    return normalizedItems(items);
  }
  function safeCell(value) {
    const s = String(value ?? '');
    // Prevent spreadsheet formula injection in exports, even after whitespace.
    const protectedText = /^[\s\u0000-\u001f]*[=+@\-]/.test(s) ? "'" + s : s;
    return '"' + protectedText.replace(/"/g,'""') + '"';
  }
  function exportCSV(rawItems) {
    return '\uFEFF' + ['name,price,qty,note', ...normalizedItems(rawItems).map(x => [x.name,x.price,x.qty,x.note].map(safeCell).join(','))].join('\r\n') + '\r\n';
  }
  const api = { PAGE, presets, defaults, validConfig, placements, normalizedItems, paginate, parseCSV, importCSV, exportCSV };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LabelEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);