(function () {
  'use strict';
  const E = window.RyunyuEngine;
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'ryunyu-fuda-v01';
  const FIELD_KEYS = ['label', 'source', 'medium', 'content', 'term', 'destination'];
  const FIELD_LABELS = { label: '配信面の名前', source: 'utm_source', medium: 'utm_medium', content: 'utm_content', term: 'utm_term（任意）', destination: '個別のリンク先（任意）' };
  let state = E.sample();
  let result = E.audit(state);
  let counter = 1;
  let toastTimer;
  function node(tag, className, content) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (content !== undefined) e.textContent = content;
    return e;
  }
  function notify(message) {
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200);
  }
  function sync() {
    state.campaign = $('campaign').value;
    state.defaultUrl = $('defaultUrl').value;
    result = E.audit(state);
    renderAudit();
  }
  function setState(obj) {
    state = E.fromObject(obj);
    $('campaign').value = state.campaign;
    $('defaultUrl').value = state.defaultUrl;
    renderPlacements();
    sync();
  }
  function renderPlacements() {
    const list = $('placements');
    list.replaceChildren();
    for (const [index, p] of state.placements.entries()) {
      const card = node('article', 'placement');
      card.dataset.id = p.id;
      const head = node('div', 'placement-head');
      const title = node('strong', '', p.label || '名称未入力');
      const number = node('span', 'placement-number', String(index + 1).padStart(2, '0'));
      const left = node('div');
      left.append(number, document.createTextNode('　'), title);
      const remove = node('button', 'remove-btn', '削除');
      remove.type = 'button'; remove.setAttribute('aria-label', `${index + 1}行目の配信面を削除`);
      remove.addEventListener('click', () => {
        state.placements = state.placements.filter(x => x.id !== p.id);
        renderPlacements(); sync(); notify('配信面を削除しました');
      });
      head.append(left, remove);
      const grid = node('div', 'placement-grid');
      for (const key of FIELD_KEYS) {
        const lab = node('label', key === 'label' || key === 'destination' ? 'wide' : '');
        lab.append(document.createTextNode(FIELD_LABELS[key]));
        const input = node('input');
        input.name = key; input.type = 'text'; input.maxLength = key === 'destination' ? 4000 : 200;
        input.spellcheck = false; input.autocomplete = 'off'; input.value = p[key] || '';
        input.placeholder = ({ label: '例：店頭POP', source: '例：instagram', medium: '例：social', content: '例：story_01', term: '例：keyword_01', destination: '省略時は共通URLを使用' })[key];
        input.addEventListener('input', () => {
          p[key] = input.value;
          if (key === 'label') title.textContent = p.label || '名称未入力';
          sync();
        });
        lab.append(input); grid.append(lab);
      }
      card.append(head, grid);
      list.append(card);
    }
    $('addBtn').disabled = state.placements.length >= E.MAX_ROWS;
  }
  function meterSegment(kind, count, total) {
    const seg = node('span', kind);
    seg.style.width = (total ? count / total * 100 : 0) + '%';
    return seg;
  }
  function renderAudit() {
    const c = result.counts;
    $('countTotal').textContent = c.total;
    $('countOk').textContent = c.ok;
    $('countWarn').textContent = c.warning;
    $('countError').textContent = c.error;
    $('meter').replaceChildren(meterSegment('ok', c.ok, c.total), meterSegment('warning', c.warning, c.total), meterSegment('error', c.error, c.total));
    $('meter').setAttribute('aria-label', `指摘なし${c.ok}件、要確認${c.warning}件、要修正${c.error}件`);
    $('auditSummary').textContent = `${c.generated} / ${c.total}件のURLを生成。${c.groupCollisions}グループで基本レポート上の集約があります。`;
    const collisionArea = $('collisions'); collisionArea.replaceChildren();
    if (!result.collisions.length) collisionArea.append(node('p', 'empty-collision', '集約された配信面はありません。'));
    for (const group of result.collisions) {
      const box = node('div', 'collision-item');
      box.append(node('strong', '', `${group.count}配信面が同じ集計グループ`));
      box.append(node('p', '', group.labels.join(' / ')));
      collisionArea.append(box);
    }
    renderResults();
  }
  function renderResults() {
    const filter = $('filter').value;
    const list = $('results'); list.replaceChildren();
    const visible = result.rows.filter(r => filter === 'all' || r.status === filter);
    if (!visible.length) { list.append(node('div', 'result-empty', '該当する配信面はありません。')); return; }
    for (const row of visible) {
      const card = node('article', 'result-card');
      const head = node('div', 'result-top');
      head.append(node('strong', '', `${String(row.index + 1).padStart(2, '0')} / ${row.label || '名称未入力'}`));
      head.append(node('span', 'status ' + row.status, ({ ok: '指摘なし', warning: '要確認', error: '要修正' })[row.status]));
      card.append(head);
      const path = node('div', 'result-path', `${row.tags.utm_source || '—'} / ${row.tags.utm_medium || '—'} / ${row.tags.utm_campaign || '—'}`);
      card.append(path);
      const link = node('div', 'result-link' + (row.url ? '' : ' missing'));
      if (row.url) {
        link.append(node('code', '', row.url));
        const button = node('button', '', 'コピー');
        button.type = 'button'; button.setAttribute('aria-label', `${row.label || '行' + (row.index + 1)} のURLをコピー`);
        button.addEventListener('click', () => copyToClipboard(row.url));
        link.append(button);
      } else link.append(node('span', '', 'URLを生成できません。入力欄と指摘内容を確認してください。'));
      card.append(link);
      if (row.issues.length) {
        const issues = node('div', 'issues');
        row.issues.forEach(i => issues.append(node('span', i.severity, `${i.code} — ${i.message}`)));
        card.append(issues);
      }
      list.append(card);
    }
  }
  async function copyToClipboard(value) {
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(value);
      notify('URLをコピーしました');
    } catch (_) {
      const temp = document.createElement('textarea');
      temp.value = value; temp.style.position = 'fixed'; temp.style.opacity = '0';
      document.body.append(temp); temp.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch (_) { /* unavailable */ }
      temp.remove();
      notify(copied ? 'URLをコピーしました' : '自動コピーできませんでした。URLを選択してコピーしてください。');
    }
  }
  function download(name, content, mime) {
    const blob = new Blob([content], { type: mime });
    const href = URL.createObjectURL(blob);
    const a = node('a'); a.href = href; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 2500);
  }
  function addPlacement(p) {
    if (state.placements.length >= E.MAX_ROWS) throw new Error('配信面の上限は80件です。');
    const id = 'new-' + Date.now() + '-' + counter++;
    state.placements.push({ id, label: '', destination: '', source: '', medium: '', content: '', term: '', ...p, id });
  }
  function initEvents() {
    $('campaign').addEventListener('input', sync);
    $('defaultUrl').addEventListener('input', sync);
    $('filter').addEventListener('change', renderResults);
    $('addBtn').addEventListener('click', () => { addPlacement({ label: '新しい配信面' }); renderPlacements(); sync(); notify('配信面を追加しました'); });
    $('bulkBtn').addEventListener('click', () => {
      try {
        const added = E.parseBulk($('bulkInput').value, E.MAX_ROWS - state.placements.length);
        for (const row of added) addPlacement(row);
        $('bulkInput').value = ''; renderPlacements(); sync();
        notify(`${added.length}配信面を追加しました`);
      } catch (e) { notify(e.message); }
    });
    $('csvBtn').addEventListener('click', () => { download('ryunyu-fuda-links.csv', E.exportCsv(result), 'text/csv;charset=utf-8'); notify('URL台帳CSVを作成しました'); });
    $('jsonBtn').addEventListener('click', () => { download('ryunyu-fuda-project.json', JSON.stringify(state, null, 2) + '\n', 'application/json;charset=utf-8'); notify('設定JSONを作成しました'); });
    $('loadBtn').addEventListener('click', () => $('jsonFile').click());
    $('jsonFile').addEventListener('change', async evt => {
      const file = evt.target.files && evt.target.files[0];
      if (!file) return;
      try {
        if (file.size > 512000) throw new Error('JSONは500KB以下にしてください。');
        const content = await file.text();
        const data = E.fromObject(JSON.parse(content));
        setState(data); notify('JSONから設定を読み込みました');
      } catch (e) { notify('読込できません：' + e.message); }
      finally { evt.target.value = ''; }
    });
    $('saveBtn').addEventListener('click', () => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); notify('端末内に保存しました'); }
      catch (_) { notify('このブラウザでは端末内保存が使用できません'); }
    });
    $('clearBtn').addEventListener('click', () => {
      try { localStorage.removeItem(STORAGE_KEY); notify('端末内の保存設定を削除しました'); }
      catch (_) { notify('端末保存にアクセスできません'); }
    });
    $('printBtn').addEventListener('click', () => window.print());
    $('resetBtn').addEventListener('click', () => { $('filter').value = 'all'; setState(E.sample()); notify('サンプルに戻しました。端末保存の内容は変更していません'); });
  }
  initEvents();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { setState(E.fromObject(JSON.parse(saved))); notify('端末内の保存設定を読み込みました'); }
    else setState(E.sample());
  } catch (_) { setState(E.sample()); }
})();
