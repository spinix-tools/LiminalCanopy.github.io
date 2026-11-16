/* GENRYU NOTE — independent-source lineage engine, no network access. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GenryuEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_CLAIMS = 50, MAX_SOURCES = 400;
  const LIMIT = { title: 140, note: 2500, url: 1000 };
  const ORIGINS = ['original', 'derived', 'unknown'];
  const STANCES = ['support', 'refute', 'context'];
  const VALID_STATUS = ['unresolved', 'reviewing', 'decided'];

  function assert(ok, message) { if (!ok) throw new Error(message); }
  function text(x, limit, label) {
    assert(typeof x === 'string' && x.length <= limit, `${label}は${limit}文字以内の文字列にしてください`);
    return x.trim();
  }
  function safeUrl(value) {
    if (!value) return '';
    if (typeof value !== 'string' || value.length > LIMIT.url) return '';
    try { const u = new URL(value); return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : ''; }
    catch { return ''; }
  }
  function normalizeClaim(raw) {
    assert(raw && typeof raw === 'object' && !Array.isArray(raw), '論点の形式が不正です');
    const id = text(raw.id, 80, 'ID'); assert(/^c-[a-zA-Z0-9_-]+$/.test(id), '論点IDが不正です');
    const title = text(raw.title, LIMIT.title, '論点'); assert(title.length > 0, '論点を入力してください');
    const note = text(raw.note || '', LIMIT.note, 'メモ');
    assert(VALID_STATUS.includes(raw.status), '判定段階が不正です');
    return { id, title, note, status: raw.status };
  }
  function normalizeSource(raw) {
    assert(raw && typeof raw === 'object' && !Array.isArray(raw), '資料の形式が不正です');
    const id = text(raw.id, 80, 'ID'); assert(/^s-[a-zA-Z0-9_-]+$/.test(id), '資料IDが不正です');
    const claimId = text(raw.claimId, 80, '論点ID');
    const title = text(raw.title, LIMIT.title, '資料名'); assert(title.length > 0, '資料名を入力してください');
    const url = text(raw.url || '', LIMIT.url, 'URL');
    assert(!url || !!safeUrl(url), 'URLはhttpまたはhttpsで入力してください');
    assert(ORIGINS.includes(raw.origin), '出所区分が不正です');
    assert(STANCES.includes(raw.stance), '資料の立場が不正です');
    const parentId = text(raw.parentId || '', 80, '引用元ID');
    assert(raw.origin === 'derived' ? !!parentId : !parentId, '引用資料には引用元が必要です（独立・不明資料には不要です）');
    return { id, claimId, title, url: url ? safeUrl(url) : '', note: text(raw.note || '', LIMIT.note, 'メモ'), origin: raw.origin, stance: raw.stance, parentId };
  }
  function validateModel(raw) {
    assert(raw && typeof raw === 'object' && !Array.isArray(raw), 'データ形式が不正です');
    assert(raw.version === 1, '対応していないデータ形式です（version 1のみ）');
    assert(Array.isArray(raw.claims) && raw.claims.length <= MAX_CLAIMS, '論点は最大50件です');
    assert(Array.isArray(raw.sources) && raw.sources.length <= MAX_SOURCES, '資料は最大400件です');
    const claims = raw.claims.map(normalizeClaim), sources = raw.sources.map(normalizeSource);
    const cs = new Set(claims.map(x => x.id)), ss = new Set(sources.map(x => x.id));
    assert(cs.size === claims.length && ss.size === sources.length, '重複IDがあります');
    const byId = new Map(sources.map(x => [x.id, x]));
    for (const source of sources) {
      assert(cs.has(source.claimId), '存在しない論点の資料があります');
      if (source.parentId) {
        const p = byId.get(source.parentId);
        assert(p && p.claimId === source.claimId, '引用元が存在しないか別の論点です');
      }
    }
    for (const source of sources) {
      const seen = new Set(); let cur = source;
      while (cur) {
        assert(!seen.has(cur.id), '引用関係に循環があります');
        seen.add(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : null;
      }
    }
    const activeClaimId = cs.has(raw.activeClaimId) ? raw.activeClaimId : claims[0]?.id || '';
    return { version: 1, claims, sources, activeClaimId };
  }
  function blank() { return { version: 1, claims: [], sources: [], activeClaimId: '' }; }
  function demo() {
    return validateModel({
      version: 1, activeClaimId: 'c-demo',
      claims: [{ id:'c-demo', title:'架空の町で、午後の広場が混雑するという主張', status:'reviewing', note:'説明用の架空データです。実在の調査・報道ではありません。' }],
      sources: [
        { id:'s-original-a', claimId:'c-demo', title:'架空の現地観察メモ A', origin:'original', stance:'support', parentId:'', url:'', note:'独立起点と仮置き。実際の独立性は未確認。' },
        { id:'s-copy-a', claimId:'c-demo', title:'Aを引用した架空の記事 B', origin:'derived', stance:'support', parentId:'s-original-a', url:'', note:'Aの再掲なので独立した裏づけには数えない。' },
        { id:'s-original-c', claimId:'c-demo', title:'架空の観察メモ C', origin:'original', stance:'refute', parentId:'', url:'', note:'時間帯が違う可能性。' },
        { id:'s-unknown-d', claimId:'c-demo', title:'出所のわからない投稿 D', origin:'unknown', stance:'support', parentId:'', url:'', note:'一次資料が追跡できない。' }
      ]
    });
  }
  function rootOf(source, byId) {
    let cur = source, chain = [source.id];
    while (cur.parentId) {
      cur = byId.get(cur.parentId);
      if (!cur) return { rootId: null, chain, known: false };
      chain.push(cur.id);
    }
    return { rootId: cur.origin === 'original' ? cur.id : null, chain, known: cur.origin === 'original' };
  }
  function analyze(model, claimId) {
    const sources = model.sources.filter(x => x.claimId === claimId), byId = new Map(sources.map(x => [x.id, x]));
    const families = new Map(), unknown = [];
    for (const src of sources) {
      const r = rootOf(src, byId);
      if (!r.known) { unknown.push({ source: src, chain: r.chain }); continue; }
      if (!families.has(r.rootId)) families.set(r.rootId, { root: byId.get(r.rootId), sources: [], stance: 'context' });
      families.get(r.rootId).sources.push({ source: src, chain: r.chain });
    }
    let support = 0, refute = 0, mixed = 0, context = 0;
    for (const fam of families.values()) {
      const hasSupport = fam.sources.some(x => x.source.stance === 'support');
      const hasRefute = fam.sources.some(x => x.source.stance === 'refute');
      fam.stance = hasSupport && hasRefute ? 'mixed' : hasSupport ? 'support' : hasRefute ? 'refute' : 'context';
      if (fam.stance === 'support') support++;
      else if (fam.stance === 'refute') refute++;
      else if (fam.stance === 'mixed') mixed++;
      else context++;
      fam.sources.sort((a,b) => a.chain.length - b.chain.length || a.source.title.localeCompare(b.source.title,'ja'));
    }
    return { total: sources.length, rootCount: families.size, support, refute, mixed, context,
      unknownCount: unknown.length,
      derivativeCount: sources.filter(x => x.origin === 'derived').length,
      families: [...families.values()].sort((a,b) => a.root.title.localeCompare(b.root.title, 'ja')),
      unknown };
  }
  function detachChildren(model, deletedId) {
    return validateModel({ ...model, sources: model.sources.filter(x => x.id !== deletedId).map(x =>
      x.parentId === deletedId ? {...x, origin:'unknown', parentId:''} : x) });
  }
  function markdown(model, claimId) {
    const claim = model.claims.find(x => x.id === claimId);
    assert(claim, '論点がありません');
    const a = analyze(model, claimId);
    const statuses = { unresolved:'未判定', reviewing:'検証中', decided:'手動判定済み' };
    const esc = s => String(s || '').replace(/\\/g,'\\\\').replace(/([`*_\[\]])/g, '\\$1').replace(/\r/g, ' ').replace(/\n/g, ' ');
    const l = [ '# 源流ノート — 出典系譜の点検', '', `## 論点: ${esc(claim.title)}`, '', `状態: ${statuses[claim.status]}（利用者の記録。アプリは真偽を判定しません）`, `メモ: ${esc(claim.note) || 'なし'}`, '',
      '## 出所の集計', '', `記録資料: ${a.total}件 / 独立起点として登録された系統: ${a.rootCount}件`,
      `支持のみ: ${a.support}系統 / 反証のみ: ${a.refute}系統 / 混在: ${a.mixed}系統 / 中立: ${a.context}系統`,
      `出所不明（独立起点に計上しない）: ${a.unknownCount}件`, '',
      '> 注意: この数字は利用者が入力した出所関係と立場の集計です。資料の実在・独立性・信頼性・命題の真偽を検証しません。', '', '## 系統別の資料', '' ];
    for (const family of a.families) {
      l.push(`### ${esc(family.root.title)} — ${ { support:'支持のみ',refute:'反証のみ',mixed:'支持と反証が混在',context:'中立' }[family.stance] }`, '');
      for (const {source, chain} of family.sources) l.push(`- ${esc(source.title)} / ${ {support:'支持',refute:'反証',context:'参考'}[source.stance] } / 系譜: ${chain.length}段${source.url ? ' / '+ source.url : ''}${source.note ? ' / '+esc(source.note) : ''}`);
      l.push('');
    }
    if (a.unknown.length) {
      l.push('## 出所未確認', '');
      for (const {source} of a.unknown) l.push(`- ${esc(source.title)} / ${ {support:'支持',refute:'反証',context:'参考'}[source.stance] }${source.note ? ' / '+esc(source.note) : ''}`);
      l.push('');
    }
    l.push('## 次の調査', '', '- 同じ引用元に遡る資料を独立裏づけと誤算していないか確認する', '- 原資料を直接確認し、支持／反証の判断を再点検する', '- 出所不明資料の引用元を追う', '');
    return l.join('\n');
  }
  return { blank, demo, validateModel, analyze, safeUrl, detachChildren, markdown, LIMIT, MAX_CLAIMS, MAX_SOURCES };
});
