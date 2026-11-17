/* KOTOORI — one-sheet zine data engine, MIT licensed. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KotooriEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const PAGE_COUNT = 8;
  const TOP_ORDER = [7, 6, 5, 4];
  const BOTTOM_ORDER = [8, 1, 2, 3];
  const COLORS = ['#f2ece3', '#e0ebee', '#efe6e3', '#e6e8da', '#e9e6f0'];
  const EXAMPLE = [
    ['小さな旅の記録', '一枚から、八つのページへ。\n\nことばを折って、手渡す冊子。'],
    ['01　はじまり', 'ある朝、路地の角で\n小さな紙を拾った。\n\nそこには地図が描かれていた。'],
    ['02　まがり角', '右へ曲がると、\n知らない花屋があった。\n\n窓辺に青い瓶が並んでいた。'],
    ['03　寄り道', 'いつもと違う道を選ぶ。\n\n名前のない発見は、\nだれにも奪われない。'],
    ['04　ひと休み', 'コーヒーを一杯。\n\n時計の針を見ず、\n紙のすみを指でなぞった。'],
    ['05　帰り道', '遠くへ行かなくても、\n知らない場所は見つかる。'],
    ['06　あとがき', '今日の発見を\n一行だけ残しておこう。\n\n「　　　　　　　　　」'],
    ['おしまい', 'KOTOORI / こと折\n\nA4 1枚から作る\n小さなZINE']
  ];
  function makeDefault() {
    return {
      version: VERSION,
      name: '小さな旅の記録',
      direction: 'vertical',
      fontSize: 16,
      paper: 'warm',
      guides: true,
      pages: EXAMPLE.map(([title, body]) => ({ title, body, image: '' }))
    };
  }
  function text(value, max = 3200) { return typeof value === 'string' ? value.slice(0, max) : ''; }
  function validImage(value) {
    return typeof value === 'string' && value.length < 1600000 && /^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(value) ? value : '';
  }
  function normalize(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('プロジェクトの形式が正しくありません');
    if (!Array.isArray(input.pages) || input.pages.length !== PAGE_COUNT) throw new Error('8ページのプロジェクトが必要です');
    return {
      version: VERSION,
      name: text(input.name, 100) || '無題の折本',
      direction: input.direction === 'horizontal' ? 'horizontal' : 'vertical',
      fontSize: Math.max(11, Math.min(23, Math.round(Number(input.fontSize) || 16))),
      paper: ['warm','blue','rose','sage','lavender'].includes(input.paper) ? input.paper : 'warm',
      guides: input.guides !== false,
      pages: input.pages.map(p => ({title:text(p && p.title, 200), body:text(p && p.body, 3200), image:validImage(p && p.image)}))
    };
  }
  function parseJSON(json) {
    if (typeof json !== 'string' || json.length > 16000000) throw new Error('ファイルが大きすぎるか不正です');
    try { return normalize(JSON.parse(json)); }
    catch (err) { throw new Error(err.message === 'Unexpected token' ? 'JSONが壊れています' : (err.message || '読込に失敗しました')); }
  }
  function order() { return [TOP_ORDER.slice(), BOTTOM_ORDER.slice()]; }
  function logicalIndex(row, col) {
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 1 || col < 0 || col > 3) throw new RangeError('Invalid panel location');
    return order()[row][col] - 1;
  }
  function metrics(project) {
    const p = normalize(project);
    const all = p.pages.map(x => Array.from(x.title + x.body).filter(c => c.trim()).length);
    return { pages: PAGE_COUNT, characters: all.reduce((a,b) => a+b,0), perPage:all, images:p.pages.filter(x=>x.image).length };
  }
  function palette(paper) { return COLORS[['warm','blue','rose','sage','lavender'].indexOf(paper)] || COLORS[0]; }
  function serialize(project) { return JSON.stringify(normalize(project), null, 2); }
  function safeFile(name) { return (text(name, 80).trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').replace(/\s+/g, '-') || 'kotoori').slice(0, 60); }
  return { VERSION, PAGE_COUNT, TOP_ORDER, BOTTOM_ORDER, makeDefault, normalize, parseJSON, order, logicalIndex, metrics, palette, serialize, safeFile, validImage };
});