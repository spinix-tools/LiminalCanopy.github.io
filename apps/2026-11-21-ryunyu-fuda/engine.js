/* 流入札 / RYUNYU FUDA — pure calculation engine; no network calls */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.RyunyuEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TRACK_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const STYLE = /^[a-z0-9][a-z0-9_-]*$/;
  const MAX_ROWS = 80;
  const SAMPLE = {
    campaign: 'winter_market_2026',
    defaultUrl: 'https://example.org/event?lang=ja#apply',
    placements: [
      { id: 'a', label: 'Instagram ストーリー', destination: '', source: 'instagram', medium: 'social', content: 'story_01', term: '' },
      { id: 'b', label: 'Instagram プロフィール', destination: '', source: 'instagram', medium: 'social', content: 'profile_01', term: '' },
      { id: 'c', label: 'メールマガジン', destination: '', source: 'newsletter', medium: 'email', content: 'nov_21', term: '' },
      { id: 'd', label: 'チラシのQR', destination: '', source: 'flyer', medium: 'qr', content: 'a4_01', term: '' },
      { id: 'e', label: 'X 固定投稿', destination: 'https://example.org/event?utm_source=old&ref=top#apply', source: 'X', medium: 'social', content: '', term: '' }
    ]
  };
  function text(x) { return typeof x === 'string' ? x : ''; }
  function clean(s) { return text(s).trim(); }
  function issue(code, severity, message) { return { code, severity, message }; }
  function sample() { return JSON.parse(JSON.stringify(SAMPLE)); }
  function safeId(x, index) { return clean(x) || 'row-' + index; }
  function fromObject(src) {
    if (!src || typeof src !== 'object' || Array.isArray(src)) throw new Error('JSONの最上位はオブジェクトにしてください。');
    if (!Array.isArray(src.placements) || src.placements.length > MAX_ROWS) throw new Error('配信面は0〜80件にしてください。');
    const seen = new Set();
    return {
      campaign: text(src.campaign).slice(0, 200),
      defaultUrl: text(src.defaultUrl).slice(0, 4000),
      placements: src.placements.map((p, i) => {
        if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error(`${i + 1}行目が不正です。`);
        let id = safeId(p.id, i);
        if (seen.has(id)) id += '-' + i;
        seen.add(id);
        return {
          id, label: text(p.label).slice(0, 200), destination: text(p.destination).slice(0, 4000),
          source: text(p.source).slice(0, 200), medium: text(p.medium).slice(0, 200),
          content: text(p.content).slice(0, 200), term: text(p.term).slice(0, 200)
        };
      })
    };
  }
  function inspectDestination(raw) {
    const url = clean(raw);
    if (!url) throw new Error('リンク先URLがありません');
    if (url.length > 4000) throw new Error('リンク先URLが長すぎます');
    let u;
    try { u = new URL(url); } catch (_) { throw new Error('http(s)の絶対URLを入力してください'); }
    if (!['https:', 'http:'].includes(u.protocol) || !u.hostname || u.username || u.password) {
      throw new Error('http(s)のURLのみ対応します。認証情報付きURLは使えません');
    }
    return u;
  }
  function existingTracking(u) {
    const found = Object.create(null);
    for (const [k] of u.searchParams) {
      if (TRACK_KEYS.includes(k.toLowerCase())) found[k.toLowerCase()] = (found[k.toLowerCase()] || 0) + 1;
    }
    return found;
  }
  function makeUrl(base, tags) {
    const url = inspectDestination(base);
    for (const name of Array.from(url.searchParams.keys())) {
      if (TRACK_KEYS.includes(name.toLowerCase())) url.searchParams.delete(name);
    }
    for (const name of TRACK_KEYS) {
      const value = clean(tags[name]);
      if (value) url.searchParams.append(name, value);
    }
    return url.href;
  }
  function audit(data) {
    const state = fromObject(data);
    const rows = state.placements.map((p, index) => {
      const issues = [];
      const tags = {
        utm_campaign: clean(state.campaign), utm_source: clean(p.source),
        utm_medium: clean(p.medium), utm_content: clean(p.content), utm_term: clean(p.term)
      };
      if (!clean(p.label)) issues.push(issue('LABEL', 'warning', '配信面名が空です。'));
      for (const key of ['utm_campaign', 'utm_source', 'utm_medium']) {
        if (!tags[key]) issues.push(issue('REQUIRED', 'error', `${key} が未入力です。`));
      }
      for (const key of TRACK_KEYS) {
        if (tags[key] && !STYLE.test(tags[key])) {
          issues.push(issue('NAMING', 'warning', `${key} は小文字英数字・_・- に統一すると集計が安定します。`));
        }
      }
      let url = '', originalQuery = '', destination = clean(p.destination) || clean(state.defaultUrl);
      try {
        const u = inspectDestination(destination);
        const found = existingTracking(u);
        const keys = Object.keys(found);
        if (keys.length) issues.push(issue('REPLACE', 'warning', 'リンク先の既存UTMを上書きして生成します（元URLは保持）。'));
        if (keys.some(k => found[k] > 1)) issues.push(issue('REPEATED', 'warning', 'リンク先に同名UTMが重複しています。'));
        if (u.protocol === 'http:') issues.push(issue('HTTP', 'warning', 'httpのリンク先です。httpsの利用を検討してください。'));
        originalQuery = u.search;
        if (!issues.some(x => x.severity === 'error')) url = makeUrl(destination, tags);
        if (url && url.length > 2048) issues.push(issue('LONG', 'warning', '生成URLが2,048文字を超えています。'));
      } catch (e) { issues.push(issue('URL', 'error', e.message)); }
      return { ...p, index, tags, url, destination, originalQuery, issues, status: 'ok' };
    });
    // The basic GA4 source/medium/campaign report omits content and term.
    // Such grouping may be intentional: treat it as caution, not proof of an error.
    const summaryGroups = new Map(), exactGroups = new Map(), foldedGroups = new Map();
    for (const row of rows) {
      if (!row.url) continue;
      const { utm_campaign: campaign, utm_source: source, utm_medium: medium, utm_content: content, utm_term: term } = row.tags;
      const add = (map, key) => { if (!map.has(key)) map.set(key, []); map.get(key).push(row); };
      add(summaryGroups, JSON.stringify([source, medium, campaign]));
      add(exactGroups, JSON.stringify([row.url]));
      add(foldedGroups, JSON.stringify([source.toLowerCase(), medium.toLowerCase(), campaign.toLowerCase(), content.toLowerCase(), term.toLowerCase()]));
    }
    const collisions = [];
    for (const [key, group] of summaryGroups) {
      if (group.length < 2) continue;
      collisions.push({ key, labels: group.map(x => x.label || `行${x.index + 1}`), count: group.length });
      for (const row of group) row.issues.push(issue('REPORT_GROUP', 'warning', `基本レポートでは他の${group.length - 1}配信面と同じ source / medium / campaign に集約されます。`));
    }
    for (const group of exactGroups.values()) {
      if (group.length < 2) continue;
      for (const row of group) row.issues.push(issue('DUPLICATE', 'error', '別の行と生成URLが完全一致しています。配信面を区別できません。'));
    }
    for (const group of foldedGroups.values()) {
      if (group.length < 2) continue;
      if (new Set(group.map(r => JSON.stringify([r.tags.utm_source, r.tags.utm_medium, r.tags.utm_campaign, r.tags.utm_content, r.tags.utm_term]))).size < 2) continue;
      for (const row of group) row.issues.push(issue('CASE_DRIFT', 'warning', '他の行と大文字小文字だけが異なるタグ組合せがあります。'));
    }
    for (const row of rows) row.status = row.issues.some(i => i.severity === 'error') ? 'error' : row.issues.length ? 'warning' : 'ok';
    return {
      rows, collisions,
      counts: {
        total: rows.length, ok: rows.filter(r => r.status === 'ok').length,
        warning: rows.filter(r => r.status === 'warning').length,
        error: rows.filter(r => r.status === 'error').length,
        generated: rows.filter(r => r.url).length,
        groupCollisions: collisions.length
      }
    };
  }
  function csvCell(value) {
    let s = String(value == null ? '' : value);
    // Spreadsheet formula injection mitigation. Apostrophe remains literal in raw CSV.
    if (/^[\s\uFEFF]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function csv(rows) { return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'; }
  function exportCsv(result) {
    const h = ['行', '配信面', '状態', '生成URL', 'リンク先', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', '指摘'];
    return '\uFEFF' + csv([h, ...result.rows.map(r => [r.index + 1, r.label, r.status, r.url, r.destination, r.tags.utm_source, r.tags.utm_medium, r.tags.utm_campaign, r.tags.utm_content, r.tags.utm_term, r.issues.map(i => i.code + ': ' + i.message).join(' / ')])]);
  }
  function parseBulk(raw, limit = MAX_ROWS) {
    const lines = text(raw).split(/\r?\n/).filter(x => x.trim());
    if (lines.length > limit) throw new Error(`一度に追加できるのは${limit}行までです。`);
    return lines.map((line, index) => {
      const cells = line.split('\t');
      if (cells.length < 4 || cells.length > 6) throw new Error(`${index + 1}行目はタブ区切りで4〜6列（配信面名・source・medium・content・任意URL・term）にしてください。`);
      return {
        id: `bulk-${Date.now()}-${index}`, label: clean(cells[0]), source: clean(cells[1]), medium: clean(cells[2]),
        content: clean(cells[3]), destination: clean(cells[4]), term: clean(cells[5])
      };
    });
  }
  return { MAX_ROWS, SAMPLE, sample, fromObject, inspectDestination, existingTracking, makeUrl, audit, csvCell, csv, exportCsv, parseBulk };
});
