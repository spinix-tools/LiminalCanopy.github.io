/* PATABAKO — pure geometry and material planner. MIT License. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PataEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PAGE = Object.freeze({ width: 190, height: 277, overlap: 8 }); // A4, 10 mm margins
  const DEFAULT = Object.freeze({ productW: 60, productD: 48, productH: 28, gap: 2, quantity: 24, sheetCost: 32, autoRotate: true });
  function number(value, fallback, min, max) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }
  function normalize(raw = {}) {
    return {
      productW: number(raw.productW, DEFAULT.productW, 10, 300),
      productD: number(raw.productD, DEFAULT.productD, 10, 300),
      productH: number(raw.productH, DEFAULT.productH, 5, 200),
      gap: number(raw.gap, DEFAULT.gap, 0, 10),
      quantity: Math.round(number(raw.quantity, DEFAULT.quantity, 1, 500)),
      sheetCost: number(raw.sheetCost, DEFAULT.sheetCost, 0, 1000),
      autoRotate: raw.autoRotate !== false
    };
  }
  function axisPages(len, page, overlap = PAGE.overlap) {
    if (!(len > 0) || !(page > overlap)) throw new Error('Invalid page geometry');
    return len <= page + 1e-8 ? 1 : 1 + Math.ceil((len - page - 1e-8) / (page - overlap));
  }
  function tilePlan(width, height) {
    const cols = axisPages(width, PAGE.width);
    const rows = axisPages(height, PAGE.height);
    const pages = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      pages.push({ index: pages.length + 1, col: c + 1, row: r + 1,
        x: c * (PAGE.width - PAGE.overlap), y: r * (PAGE.height - PAGE.overlap),
        width: PAGE.width, height: PAGE.height });
    }
    return { cols, rows, count: cols * rows, pages };
  }
  function geometry(raw) {
    const input = normalize(raw);
    const originalW = input.productW + 2 * input.gap;
    const originalD = input.productD + 2 * input.gap;
    const h = input.productH + input.gap;
    const upright = { w: originalW, d: originalD, rotated: false };
    const alternate = { w: originalD, d: originalW, rotated: true };
    function net(candidate) {
      const width = candidate.w + 2 * h;
      const height = candidate.d + 2 * h;
      return { ...candidate, h, width, height, tile: tilePlan(width, height) };
    }
    const a = net(upright), b = net(alternate);
    const selected = input.autoRotate && (b.tile.count < a.tile.count ||
      (b.tile.count === a.tile.count && b.tile.rows < a.tile.rows)) ? b : a;
    const tab = Math.min(h * 0.72, 18);
    const start = h * 0.12, end = h * 0.88;
    const corner = Math.min(tab * 0.25, (end - start) / 4);
    const tabArea = 4 * tab * ((end - start) - corner);
    const materialArea = selected.w * selected.d + 2 * selected.w * h + 2 * selected.d * h + tabArea;
    const printableArea = selected.tile.count * PAGE.width * PAGE.height;
    const warnings = [];
    if (selected.tile.count > 1) warnings.push('A4を複数枚貼り合わせます。重ね幅8mmと位置合わせを確認してください。');
    if (selected.tile.count > 9) warnings.push('必要ページ数が多めです。厚紙の大判出力も検討してください。');
    if (h > Math.min(selected.w, selected.d)) warnings.push('側面が底面の短辺より高いため、貼り合わせ時の安定性を確認してください。');
    if (input.gap === 0) warnings.push('余裕0mmです。紙厚・折り曲げ・製品個体差を考慮してください。');
    warnings.push('紙厚、折り曲げ半径、プリンタの寸法誤差、強度は計算に含みません。必ず試作してください。');
    return { input, ...selected, tab, start, end, corner, materialArea,
      fillRatio: materialArea / printableArea,
      sheets: selected.tile.count * input.quantity,
      cost: selected.tile.count * input.quantity * input.sheetCost,
      warnings };
  }
  function f(n) { return Number(n.toFixed(3)); }
  function segment(x1,y1,x2,y2,type='cut') {
    return `<line class="${type}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
  }
  function poly(points, cls) {
    return `<polygon class="${cls}" points="${points.map(p=>p.map(f).join(',')).join(' ')}"/>`;
  }
  function artwork(g) {
    const { w,d,h,tab,start,end,corner } = g;
    const x1 = h, x2 = h + w, y1 = h, y2 = h + d;
    let s = `<rect class="base" x="${f(x1)}" y="${f(y1)}" width="${f(w)}" height="${f(d)}"/>`;
    s += `<rect class="wall" x="${f(x1)}" y="0" width="${f(w)}" height="${f(h)}"/>`;
    s += `<rect class="wall" x="${f(x1)}" y="${f(y2)}" width="${f(w)}" height="${f(h)}"/>`;
    s += `<rect class="wall" x="0" y="${f(y1)}" width="${f(h)}" height="${f(d)}"/>`;
    s += `<rect class="wall" x="${f(x2)}" y="${f(y1)}" width="${f(h)}" height="${f(d)}"/>`;
    for (const side of ['left','right']) for (const vertical of ['top','bottom']) {
      const foldX = side==='left'?x1:x2;
      const outerX = side==='left'?foldX-tab:foldX+tab;
      const sy = vertical==='top'?start:y2+start;
      const ey = vertical==='top'?end:y2+end;
      const points = [[foldX,sy],[outerX,sy+corner],[outerX,ey-corner],[foldX,ey]];
      s += poly(points,'tab');
      for (let i=0;i<3;i++) s += segment(...points[i],...points[i+1]);
      s += segment(foldX,sy,foldX,ey,'fold');
      const beginY = vertical==='top'?0:y2;
      const endY = vertical==='top'?h:y2+h;
      s += segment(foldX,beginY,foldX,sy);
      s += segment(foldX,ey,foldX,endY);
    }
    s += segment(x1,0,x2,0) + segment(x1,y2+h,x2,y2+h);
    s += segment(0,y1,0,y2) + segment(x2+h,y1,x2+h,y2);
    s += segment(0,y1,x1,y1) + segment(0,y2,x1,y2);
    s += segment(x2,y1,x2+h,y1) + segment(x2,y2,x2+h,y2);
    s += segment(x1,y1,x2,y1,'fold') + segment(x1,y2,x2,y2,'fold');
    s += segment(x1,y1,x1,y2,'fold') + segment(x2,y1,x2,y2,'fold');
    s += `<text class="measure" x="${f(x1+w/2)}" y="${f(y1+d/2)}" text-anchor="middle">${f(w)} × ${f(d)} mm</text>`;
    s += `<text class="measure" x="${f(x1+w/2)}" y="${f(h*.56)}" text-anchor="middle">側面 ${f(h)} mm</text>`;
    return s;
  }
  const STYLES = `<style>.base{fill:#fff0d5}.wall{fill:#dceaf7}.tab{fill:#dcf5e6}.cut{stroke:#d34d41;stroke-width:.48;fill:none;stroke-linecap:round}.fold{stroke:#2868ad;stroke-width:.34;stroke-dasharray:2 1.6;fill:none}.measure{font:3.6px system-ui,sans-serif;fill:#506579}.tile-edge{fill:none;stroke:#aab7c4;stroke-width:.35;stroke-dasharray:2 2}.mark{stroke:#6e8190;stroke-width:.3}</style>`;
  function svg(g, opts = {}) {
    const page = opts.page || null;
    const view = page ? [page.x,page.y,page.width,page.height] : opts.export ? [0,0,g.width,g.height] : [-5,-5,g.width+10,g.height+10];
    const width = page ? `${PAGE.width}mm` : opts.export ? `${f(g.width)}mm` : '100%';
    const height = page ? `${PAGE.height}mm` : opts.export ? `${f(g.height)}mm` : '100%';
    let extra='';
    if (page) {
      const tick=3;
      for (const px of [page.x+5,page.x+PAGE.width-5]) for (const py of [page.y+5,page.y+PAGE.height-5]) {
        extra+=`<path class="mark" d="M ${f(px-tick)} ${f(py)} h ${2*tick} M ${f(px)} ${f(py-tick)} v ${2*tick}"/>`;
      }
    } else if (opts.showTiles !== false) {
      for (const p of g.tile.pages) extra+=`<rect class="tile-edge" x="${f(p.x)}" y="${f(p.y)}" width="${PAGE.width}" height="${PAGE.height}"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${view.map(f).join(' ')}" role="img" aria-label="箱の展開図">${STYLES}${artwork(g)}${extra}</svg>`;
  }
  function csv(g) {
    return '項目,値\n'+[
      ['商品幅mm',g.input.productW],['商品奥行mm',g.input.productD],['商品高さmm',g.input.productH],
      ['ゆとりmm',g.input.gap],['トレイ内寸幅mm',g.w],['トレイ内寸奥行mm',g.d],['トレイ側面mm',g.h],
      ['展開幅mm',g.width],['展開高さmm',g.height],['A4枚数/箱',g.tile.count],
      ['必要個数',g.input.quantity],['必要A4総数',g.sheets],['紙代合計円',g.cost]
    ].map(row=>row.join(',')).join('\n')+'\n';
  }
  return { PAGE, DEFAULT, normalize, axisPages, tilePlan, geometry, artwork, svg, csv };
});
