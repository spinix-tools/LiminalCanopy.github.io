/* ORIMAE | pure planning engine, browser + CommonJS. MIT License */
(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.ORIMAE = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function integer(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
  }
  function validate(raw) {
    const o = raw || {};
    return {
      title: String(o.title == null ? '私の小冊子' : o.title).trim().slice(0, 90) || '私の小冊子',
      pages: integer(o.pages, 1, 120, 12),
      copies: integer(o.copies, 1, 1000, 30),
      binding: o.binding === 'right' ? 'right' : 'left',
      paper: ['A4', 'B4', 'A3', 'Letter'].includes(o.paper) ? o.paper : 'A4',
      inkPerSide: integer(o.inkPerSide, 0, 10000, 8),
      paperPerSheet: integer(o.paperPerSheet, 0, 10000, 3),
      testSheets: integer(o.testSheets, 0, 50, 1),
      backRotate: Boolean(o.backRotate),
      backReverse: Boolean(o.backReverse)
    };
  }
  function makePlan(raw) {
    const options = validate(raw);
    const padded = Math.ceil(options.pages / 4) * 4;
    const sheets = [];
    for (let i = 0; i < padded / 4; i++) {
      const front = [padded - i * 2, i * 2 + 1];
      const back = [i * 2 + 2, padded - i * 2 - 1];
      if (options.binding === 'right') { front.reverse(); back.reverse(); }
      sheets.push({
        id: i + 1,
        front,
        back,
        blankPages: [...front, ...back].filter(p => p > options.pages),
        isOuter: i === 0,
        isCenter: i === padded / 4 - 1,
      });
    }
    return {
      ...options,
      padded,
      blanks: padded - options.pages,
      sheetCount: padded / 4,
      sheets,
      finishedSize: { A4: 'A5', B4: 'B5', A3: 'A4', Letter: 'Half Letter' }[options.paper]
    };
  }
  function estimate(raw) {
    const plan = makePlan(raw);
    const productionSheets = plan.sheetCount * plan.copies;
    const physicalSheets = productionSheets + plan.testSheets;
    const printedSides = physicalSheets * 2;
    return {
      productionSheets, physicalSheets, printedSides,
      paperCost: physicalSheets * plan.paperPerSheet,
      printCost: printedSides * plan.inkPerSide,
      totalCost: physicalSheets * plan.paperPerSheet + printedSides * plan.inkPerSide,
      perCopy: (physicalSheets * plan.paperPerSheet + printedSides * plan.inkPerSide) / plan.copies,
    };
  }
  function orderedSides(plan, mode) {
    const sides = [];
    for (const sheet of plan.sheets) {
      if (mode !== 'backs') sides.push({ sheet: sheet.id, side: 'front', pages: sheet.front });
      if (mode !== 'fronts') sides.push({ sheet: sheet.id, side: 'back', pages: sheet.back });
    }
    if (mode === 'backs' && plan.backReverse) sides.reverse();
    return sides;
  }
  function csv(raw) {
    const p = makePlan(raw);
    const lines = ['sheet,side,left_page,right_page,left_blank,right_blank'];
    for (const side of orderedSides(p, 'all')) lines.push([
      side.sheet, side.side, ...side.pages,
      ...side.pages.map(n => n > p.pages ? 'yes' : 'no')
    ].join(','));
    return '\uFEFF' + lines.join('\r\n') + '\r\n';
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function printHTML(raw, mode = 'all') {
    const plan = makePlan(raw);
    if (!['all', 'fronts', 'backs'].includes(mode)) throw new Error('Invalid print mode');
    const sides = orderedSides(plan, mode);
    const dimensions = { A4: [297, 210], B4: [364, 257], A3: [420, 297], Letter: [279.4, 215.9] }[plan.paper];
    const tile = (n) => `<section class="tile ${n > plan.pages ? 'blank' : ''}"><span class="edge">${n > plan.pages ? '余白' : 'P. ' + n}</span><strong>${n > plan.pages ? 'BLANK' : n}</strong><span class="direction">↑ 上方向 / TOP</span><span class="corner">${n > plan.pages ? '空白ページ' : n === 1 ? '表紙' : n === plan.padded ? '裏表紙側' : '本文'}</span></section>`;
    const pages = sides.map((s, index) => `<article class="sheet ${s.side === 'back' && plan.backRotate ? 'rotated' : ''}"><div class="imprint"><div class="header"><b>${escapeHTML(plan.title)}</b> <span>用紙 ${plan.paper} → ${plan.finishedSize} / ${escapeHTML(plan.binding === 'right' ? '右綴じ' : '左綴じ')}</span></div><div class="pair">${tile(s.pages[0])}${tile(s.pages[1])}<div class="fold">FOLD / 折り線</div></div><div class="footer">${s.sheet}枚目 / ${s.side === 'front' ? '表' : '裏'}　｜　出力 ${index + 1}/${sides.length}　｜　100% 原寸で印刷</div></div></article>`).join('');
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(plan.title)} / ORIMAE 試験台紙</title><style>
@page { size: ${dimensions[0]}mm ${dimensions[1]}mm; margin: 0 }
* { box-sizing: border-box } html,body{padding:0;margin:0;color:#172639;font-family:system-ui,"Noto Sans JP",sans-serif} body{background:#eef0f2}
.sheet{page-break-after:always;break-after:page;width:${dimensions[0]}mm;height:${dimensions[1]}mm;padding:8mm;background:white;overflow:hidden;position:relative}
.imprint{width:100%;height:100%;display:flex;flex-direction:column}.sheet.rotated .imprint{transform:rotate(180deg)}
.header,.footer{height:9mm;display:flex;justify-content:space-between;align-items:center;font-size:10pt}.header b{font-size:12pt}.footer{font-size:9pt}
.pair{flex:1;display:grid;grid-template-columns:1fr 1fr;border:1px solid #172639;position:relative}.tile{position:relative;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:3mm;border-right:1px dotted #667788}.tile:last-of-type{border-right:0}.tile strong{font-size:72pt;line-height:1}.tile.blank{background:#f2f3f4;color:#8c929b}.edge{font-size:14pt;letter-spacing:1px}.direction{font-size:12pt}.corner{position:absolute;bottom:6mm;left:6mm;font-size:10pt}.fold{position:absolute;left:50%;top:50%;background:#fff;transform:translate(-50%,-50%) rotate(-90deg);font-size:9pt;padding:2mm 3mm;white-space:nowrap;color:#737f8b}
@media screen{.sheet{margin:12px auto;box-shadow:0 8px 30px #0002;transform-origin:top center;max-width:100%}body{overflow-x:auto}}
@media print{body{background:white}.sheet{margin:0;box-shadow:none}.sheet:last-of-type{page-break-after:auto;break-after:auto}}
</style></head><body>${pages}<script>/* No network calls or external dependencies */<\/script></body></html>`;
  }
  return { integer, validate, makePlan, estimate, orderedSides, csv, escapeHTML, printHTML };
});
