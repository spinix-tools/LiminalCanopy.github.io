/* キット整列 | pure planning engine; no network or third-party dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KitEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY_MS = 86_400_000;
  const ID = /^[a-zA-Z0-9_-]{1,48}$/;
  const MAX_ITEMS = 120, MAX_KITS = 60, MAX_BOOKINGS = 250;
  function error(message) { throw new Error(message); }
  function text(value, name, max = 80, allowEmpty = false) {
    if (typeof value !== 'string') error(`${name}は文字列にしてください`);
    const s = value.trim();
    if ((!allowEmpty && !s) || s.length > max) error(`${name}は${allowEmpty ? '0' : '1'}〜${max}文字にしてください`);
    return s;
  }
  function id(value) { if (typeof value !== 'string' || !ID.test(value)) error('IDの形式が不正です'); return value; }
  function int(value, name, min, max) {
    if (!Number.isSafeInteger(value) || value < min || value > max) error(`${name}は${min}〜${max}の整数にしてください`);
    return value;
  }
  function dayNumber(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) error('日付はYYYY-MM-DD形式で指定してください');
    const [y, m, d] = s.split('-').map(Number);
    if (y < 2020 || y > 2100) error('日付は2020〜2100年の範囲にしてください');
    const t = Date.UTC(y, m - 1, d), check = new Date(t);
    if (check.getUTCFullYear() !== y || check.getUTCMonth() + 1 !== m || check.getUTCDate() !== d) error('存在しない日付です');
    return Math.round(t / DAY_MS);
  }
  function isoDay(n) { return new Date(n * DAY_MS).toISOString().slice(0, 10); }
  function daySpan(start, end) {
    const a = dayNumber(start), b = dayNumber(end);
    if (a > b || b - a > 89) error('予定期間は開始日から90日以内にしてください');
    return [a, b];
  }
  function validateProject(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.schemaVersion !== 1) error('対応していないデータ形式です');
    if (!Array.isArray(raw.items) || !Array.isArray(raw.kits) || !Array.isArray(raw.bookings)) error('備品・キット・予定の配列が必要です');
    if (raw.items.length > MAX_ITEMS || raw.kits.length > MAX_KITS || raw.bookings.length > MAX_BOOKINGS) error('登録数が上限を超えています');
    const uniques = arr => { const keys = arr.map(x => x.id); if (keys.length !== new Set(keys).size) error('IDが重複しています'); };
    const items = raw.items.map(x => {
      if (!x || typeof x !== 'object') error('備品の形式が不正です');
      return { id: id(x.id), name: text(x.name, '備品名'), stock: int(x.stock, '総数', 0, 9999), unit: text(x.unit, '単位', 12), place: text(x.place || '', '保管場所', 60, true) };
    });
    uniques(items);
    const itemIds = new Set(items.map(x => x.id));
    const kits = raw.kits.map(x => {
      if (!x || typeof x !== 'object' || !Array.isArray(x.lines) || x.lines.length < 1 || x.lines.length > MAX_ITEMS) error('キットに1種類以上の備品が必要です');
      const lines = x.lines.map(y => {
        if (!y || typeof y !== 'object' || !itemIds.has(id(y.itemId))) error('キットが存在しない備品を参照しています');
        return { itemId: y.itemId, qty: int(y.qty, 'キット使用数', 1, 9999) };
      });
      if (new Set(lines.map(x => x.itemId)).size !== lines.length) error('同じキット内で備品が重複しています');
      return { id: id(x.id), name: text(x.name, 'キット名'), lines };
    });
    uniques(kits);
    const kitIds = new Set(kits.map(x => x.id));
    const bookings = raw.bookings.map(x => {
      if (!x || typeof x !== 'object' || !kitIds.has(id(x.kitId))) error('予定が存在しないキットを参照しています');
      daySpan(x.start, x.end);
      const checked = Array.isArray(x.checked) ? x.checked : [];
      if (checked.length > MAX_ITEMS || checked.some(y => typeof y !== 'string' || !ID.test(y))) error('確認済み項目が不正です');
      const ownIds = new Set(kits.find(k => k.id === x.kitId).lines.map(y => y.itemId));
      return { id: id(x.id), title: text(x.title, '予定名'), kitId: x.kitId, copies: int(x.copies, 'キット数', 1, 99), start: x.start, end: x.end,
        note: text(x.note || '', '備考', 160, true), checked: [...new Set(checked)].filter(y => ownIds.has(y)) };
    });
    uniques(bookings);
    return { schemaVersion: 1, items, kits, bookings };
  }
  function analyze(raw) {
    const data = validateProject(raw), itemMap = new Map(data.items.map(x => [x.id, x]));
    const kitMap = new Map(data.kits.map(x => [x.id, x]));
    const demand = new Map(); // YYYY-MM-DD => Map<itemId, units>; reservation itself is never mutated.
    const usedDays = new Set();
    for (const booking of data.bookings) {
      const kit = kitMap.get(booking.kitId), [start, end] = daySpan(booking.start, booking.end);
      for (let day = start; day <= end; day++) {
        const key = isoDay(day); usedDays.add(key);
        if (!demand.has(key)) demand.set(key, new Map());
        const target = demand.get(key);
        for (const line of kit.lines) target.set(line.itemId, (target.get(line.itemId) || 0) + line.qty * booking.copies);
      }
    }
    const dates = [...usedDays].sort();
    const peakByItem = new Map(data.items.map(x => [x.id, { required: 0, date: null }]));
    const shortages = [];
    const calendar = dates.map(date => {
      const amounts = demand.get(date);
      let shortageUnits = 0;
      const detail = [];
      for (const item of data.items) {
        const requested = amounts.get(item.id) || 0;
        const peak = peakByItem.get(item.id);
        if (requested > peak.required) peakByItem.set(item.id, { required: requested, date });
        if (requested > item.stock) {
          const shortage = requested - item.stock;
          shortageUnits += shortage;
          const entry = { date, itemId: item.id, itemName: item.name, requested, stock: item.stock, shortage };
          shortages.push(entry); detail.push(entry);
        }
      }
      return { date, shortageUnits, detail, occupied: data.bookings.filter(b => b.start <= date && b.end >= date).length };
    });
    const bookings = data.bookings.map(b => {
      const kit = kitMap.get(b.kitId), checked = new Set(b.checked), span = daySpan(b.start, b.end);
      const lines = kit.lines.map(line => {
        let maxDemand = 0, overBy = 0;
        for (let day = span[0]; day <= span[1]; day++) {
          const total = demand.get(isoDay(day))?.get(line.itemId) || 0;
          maxDemand = Math.max(maxDemand, total);
          overBy = Math.max(overBy, total - itemMap.get(line.itemId).stock);
        }
        const item = itemMap.get(line.itemId);
        return { itemId: line.itemId, itemName: item.name, place: item.place, unit: item.unit, required: line.qty * b.copies,
          stock: item.stock, peakDemand: maxDemand, shortage: Math.max(0, overBy), checked: checked.has(line.itemId) };
      });
      const blocked = lines.some(l => l.shortage > 0);
      return { ...b, kitName: kit.name, lines, blocked, completed: !blocked && lines.every(l => l.checked), checkedCount: lines.filter(l => l.checked).length, itemCount: lines.length };
    });
    const purchases = data.items.map(item => {
      const peak = peakByItem.get(item.id);
      return { ...item, peak: peak.required, peakDate: peak.date, add: Math.max(0, peak.required - item.stock) };
    }).filter(x => x.add > 0).sort((a, b) => b.add - a.add || a.name.localeCompare(b.name));
    return { data, calendar, dates, bookings, purchases, shortages,
      stats: { items: data.items.length, kits: data.kits.length, bookings: bookings.length,
        blocked: bookings.filter(b => b.blocked).length, completed: bookings.filter(b => b.completed).length,
        shortageDays: calendar.filter(x => x.shortageUnits > 0).length, purchases: purchases.length } };
  }
  function createId(prefix) {
    // ID is not a token, credential, or identifier for a person.
    return prefix + '-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
  }
  function dateOffset(offset, from = new Date()) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function demoData(from = new Date()) {
    const items = [
      ['chairs','折りたたみ椅子',30,'脚','倉庫 A'], ['mic','ワイヤレスマイク',3,'本','機材棚 B'],
      ['hdmi','HDMIケーブル',8,'本','機材棚 B'], ['power','延長コード',6,'本','箱 03'],
      ['sign','案内サイン',5,'枚','倉庫 A'], ['tape','養生テープ',6,'巻','箱 03']
    ].map(([id, name, stock, unit, place]) => ({id, name, stock, unit, place}));
    const kits = [
      {id:'lecture',name:'講演会セット',lines:[{itemId:'mic',qty:2},{itemId:'hdmi',qty:2},{itemId:'power',qty:3},{itemId:'sign',qty:2}]},
      {id:'exhibit',name:'展示ブースセット',lines:[{itemId:'chairs',qty:12},{itemId:'power',qty:2},{itemId:'sign',qty:3},{itemId:'tape',qty:3}]}
    ];
    const bookings = [
      {id:'ex-a',title:'ミニ講演会',kitId:'lecture',copies:1,start:dateOffset(1,from),end:dateOffset(2,from),note:'会場で現物を確認',checked:[]},
      {id:'ex-b',title:'公開リハーサル',kitId:'lecture',copies:1,start:dateOffset(1,from),end:dateOffset(1,from),note:'',checked:[]},
      {id:'ex-c',title:'こども展示会',kitId:'exhibit',copies:1,start:dateOffset(2,from),end:dateOffset(2,from),note:'',checked:[]},
      {id:'ex-d',title:'翌週の展示',kitId:'exhibit',copies:1,start:dateOffset(7,from),end:dateOffset(7,from),note:'',checked:[]}
    ];
    return validateProject({schemaVersion:1,items,kits,bookings});
  }
  function csv(rows) { return '\ufeff' + rows.map(row => row.map(value => { const s = String(value ?? ''); const safe = /^[\x00-\x20]*[=+\-@]/.test(s) ? "'" + s : s; return '"' + safe.replace(/"/g, '""') + '"'; }).join(',')).join('\r\n') + '\r\n'; }
  function shortageCsv(result) { return csv([['日付','備品名','同日必要数','総在庫','不足数'], ...result.shortages.map(x=>[x.date,x.itemName,x.requested,x.stock,x.shortage])]); }
  function purchaseCsv(result) { return csv([['備品名','保管場所','総在庫','最大同時必要数','不足追加数','発生日','単位'], ...result.purchases.map(x=>[x.name,x.place,x.stock,x.peak,x.add,x.peakDate,x.unit])]); }
  function pickCsv(result, bookingId) {
    const b = result.bookings.find(x => x.id === bookingId); if (!b) error('予定が見つかりません');
    return csv([['予定','使用開始','使用終了','キット','備品','必要数','単位','保管場所','現物確認','同時使用超過'],
      ...b.lines.map(x=>[b.title,b.start,b.end,b.kitName,x.itemName,x.required,x.unit,x.place,x.checked?'済':'未',x.shortage])]);
  }
  return { dayNumber, daySpan, isoDay, dateOffset, validateProject, analyze, demoData, createId, csv, shortageCsv, purchaseCsv, pickCsv };
});
