/* BANZURE LAB: intentionally approximate two-spot-ink separation, no dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BanzureEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PALETTE = {
    pink: { name: '蛍光ピンク', rgb: [238, 81, 150] },
    blue: { name: 'ブルー', rgb: [42, 100, 193] },
    yellow: { name: 'イエロー', rgb: [247, 196, 45] },
    teal: { name: 'ティール', rgb: [0, 140, 140] },
    red: { name: 'レッド', rgb: [224, 65, 50] },
    black: { name: 'ブラック', rgb: [29, 31, 37] },
    green: { name: 'グリーン', rgb: [59, 143, 85] }
  };
  function clamp(n, lo = 0, hi = 1) { return Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo)); }
  function rgbToAbsorb(rgb) { return rgb.map(c => -Math.log(Math.max(c / 255, 0.055))); }
  function reconstruction(a, b, inkA, inkB) {
    return [0, 1, 2].map(i => Math.round(255 * Math.pow(inkA[i] / 255, a) * Math.pow(inkB[i] / 255, b)));
  }
  // Constrained, two-variable least-squares fit in optical-density space.
  function separatePixel(rgb, inkA, inkB, contrast = 1) {
    const u = rgbToAbsorb(inkA), v = rgbToAbsorb(inkB);
    const t = rgbToAbsorb(rgb).map(x => x * clamp(contrast, 0.3, 2.5));
    const uu = dot(u, u), vv = dot(v, v), uv = dot(u, v), ut = dot(u, t), vt = dot(v, t);
    const candidates = [[0, 0], [1, 0], [0, 1], [1, 1], [0, clamp(vt / vv)], [1, clamp((vt - uv) / vv)], [clamp(ut / uu), 0], [clamp((ut - uv) / uu), 1]];
    const det = uu * vv - uv * uv;
    if (det > 1e-8) candidates.push([clamp((ut * vv - vt * uv) / det), clamp((vt * uu - ut * uv) / det)]);
    let best = candidates[0], bestError = Infinity;
    for (const c of candidates) {
      const e = t.reduce((s, x, i) => s + (x - c[0] * u[i] - c[1] * v[i]) ** 2, 0);
      if (e < bestError) { bestError = e; best = c; }
    }
    return best;
  }
  function dot(a, b) { return a.reduce((s, x, i) => s + x * b[i], 0); }
  function separateImage(data, w, h, inkA, inkB, contrast = 1, strengthA = 1, strengthB = 1) {
    if (!(data instanceof Uint8ClampedArray) || data.length !== w * h * 4 || w < 1 || h < 1) throw new Error('画像データの大きさが不正です');
    const a = new Uint8ClampedArray(w * h), b = new Uint8ClampedArray(w * h);
    let totalA = 0, totalB = 0, overlap = 0, error = 0;
    for (let i = 0; i < a.length; i++) {
      const j = i * 4;
      const alpha = data[j + 3] / 255;
      const rgb = [0, 1, 2].map(k => Math.round(data[j + k] * alpha + 255 * (1 - alpha)));
      const [x, y] = separatePixel(rgb, inkA, inkB, contrast);
      a[i] = Math.round(clamp(x * strengthA) * 255);
      b[i] = Math.round(clamp(y * strengthB) * 255);
      const ax = a[i] / 255, by = b[i] / 255;
      totalA += ax; totalB += by; overlap += ax * by;
      const mixed = reconstruction(ax, by, inkA, inkB);
      error += Math.sqrt(mixed.reduce((s, v, k) => s + (v - rgb[k]) ** 2, 0) / 3);
    }
    const n = a.length;
    return { a, b, stats: { a: totalA / n, b: totalB / n, overlap: overlap / n, error: error / n } };
  }
  function renderComposite(a, b, w, h, inkA, inkB, offsetX = 0, offsetY = 0, mode = 'mixed') {
    if (a.length !== w * h || b.length !== w * h) throw new Error('版のサイズが一致しません');
    const out = new Uint8ClampedArray(w * h * 4);
    const dx = Math.round(offsetX), dy = Math.round(offsetY);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x, q = (y - dy) * w + (x - dx);
      const aa = mode === 'b' ? 0 : a[p] / 255;
      const bb = mode === 'a' || x - dx < 0 || x - dx >= w || y - dy < 0 || y - dy >= h ? 0 : b[q] / 255;
      const c = mode === 'overlap' ? [aa * bb * 255, 30, 30] : reconstruction(aa, bb, inkA, inkB);
      for (let k = 0; k < 3; k++) out[p * 4 + k] = Math.round(c[k]);
      out[p * 4 + 3] = 255;
    }
    return out;
  }
  function plateGrayscale(mask) {
    const out = new Uint8ClampedArray(mask.length * 4);
    for (let i = 0; i < mask.length; i++) {
      const v = 255 - mask[i];
      out.set([v, v, v, 255], i * 4);
    }
    return out;
  }
  function hex(rgb) { return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join(''); }
  return { PALETTE, clamp, rgbToAbsorb, separatePixel, separateImage, reconstruction, renderComposite, plateGrayscale, hex };
});
