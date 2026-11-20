/* MODOSERU core — offline scenario model; no security guarantee. MIT */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ModoseruEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const INCIDENTS = [
    { type: 'device', title: '機器故障', describe: '指定機器のコピーが使えなくなる' },
    { type: 'site', title: '拠点喪失', describe: '指定保管場所のコピーが使えなくなる' },
    { type: 'account', title: '認証情報流出', describe: '指定認証群でオンライン接続されたコピーが使えなくなる' },
    { type: 'ransomware', title: '一斉改変', describe: 'オンラインで書込可能なコピーが同時に失われる仮定' }
  ];
  const LIMITS = { datasets: 12, copies: 80 };
  const example = () => ({
    version: 1,
    datasets: [
      { id: 'd1', name: '制作写真・動画', sizeGB: 480, rpoHours: 24 },
      { id: 'd2', name: '納品書・請求書', sizeGB: 8, rpoHours: 24 }
    ],
    copies: [
      { id: 'c1', datasetId: 'd1', name: '編集PC（原本）', site: '事務所', device: '編集PC', account: '仕事アカウント', ageHours: 0, online: true, locked: false, verified: true, speed: 120 },
      { id: 'c2', datasetId: 'd1', name: 'USB HDD', site: '事務所', device: '外付HDD', account: '物理保管', ageHours: 36, online: false, locked: false, verified: false, speed: 95 },
      { id: 'c3', datasetId: 'd1', name: '世代保護クラウド', site: 'クラウド東', device: '別クラウド', account: '独立アカウント', ageHours: 12, online: true, locked: true, verified: true, speed: 35 },
      { id: 'c4', datasetId: 'd2', name: '事務所PC（原本）', site: '事務所', device: '事務PC', account: '仕事アカウント', ageHours: 0, online: true, locked: false, verified: true, speed: 85 },
      { id: 'c5', datasetId: 'd2', name: '同期フォルダー', site: 'クラウド西', device: '同期クラウド', account: '仕事アカウント', ageHours: 0, online: true, locked: false, verified: false, speed: 35 },
      { id: 'c6', datasetId: 'd2', name: '持ち帰りUSB', site: '自宅', device: 'USBメモリー', account: '物理保管', ageHours: 48, online: false, locked: false, verified: true, speed: 80 }
    ],
    selectedScenario: 'ransomware:*'
  });
  const own = (x, k) => Object.prototype.hasOwnProperty.call(x, k);
  const cleanString = (v, label) => {
    if (typeof v !== 'string' || !v.trim() || v.length > 80) throw Error(label + 'は1〜80文字で入力してください');
    return v.trim();
  };
  const number = (v, label, min, max) => {
    if (v === '' || v == null || !Number.isFinite(Number(v)) || Number(v) < min || Number(v) > max) throw Error(label + 'は' + min + '〜' + max + 'の数字で入力してください');
    return Number(v);
  };
  const bool = (v, label) => {
    if (typeof v !== 'boolean') throw Error(label + 'は真偽値で指定してください');
    return v;
  };
  function normalize(input) {
    if (!input || typeof input !== 'object' || !Array.isArray(input.datasets) || !Array.isArray(input.copies)) throw Error('データ形式が不正です');
    if (input.datasets.length < 1 || input.datasets.length > LIMITS.datasets) throw Error('データ資産は1〜12個までです');
    if (input.copies.length > LIMITS.copies) throw Error('コピーは80個までです');
    const ids = new Set();
    const datasets = input.datasets.map((d) => {
      const id = cleanString(d.id, 'データID');
      if (ids.has(id)) throw Error('重複したデータIDです');
      ids.add(id);
      return { id, name: cleanString(d.name, 'データ名'), sizeGB: number(d.sizeGB, '容量GB', 0.01, 10000000), rpoHours: number(d.rpoHours, '許容遡り時間', 0, 87600) };
    });
    const copyIds = new Set();
    const copies = input.copies.map(c => {
      const id = cleanString(c.id, 'コピーID');
      if (copyIds.has(id)) throw Error('重複したコピーIDです');
      copyIds.add(id);
      const datasetId = cleanString(c.datasetId, '対象データ');
      if (!ids.has(datasetId)) throw Error('コピーの対象データが存在しません');
      return {
        id, datasetId, name: cleanString(c.name, 'コピー名'),
        site: cleanString(c.site, '保管場所'), device: cleanString(c.device, '機器'), account: cleanString(c.account, '認証群'),
        ageHours: number(c.ageHours, '最終コピー経過時間', 0, 87600), online: bool(c.online, 'オンライン'), locked: bool(c.locked, '変更保護'),
        verified: bool(c.verified, '復元検証'), speed: number(c.speed, '復元実効速度', 0.1, 100000)
      };
    });
    const selectedScenario = typeof input.selectedScenario === 'string' ? input.selectedScenario.slice(0, 200) : 'ransomware:*';
    return { version: 1, datasets, copies, selectedScenario };
  }
  function scenarioKey(s) { return s.type + ':' + s.target; }
  function scenarios(state) {
    const s = normalize(state); const result = [];
    for (const item of INCIDENTS) {
      if (item.type === 'ransomware') { result.push({ type: 'ransomware', target: '*', label: '一斉改変（オンライン書込可）' }); continue; }
      const key = item.type === 'site' ? 'site' : item.type === 'device' ? 'device' : 'account';
      for (const value of [...new Set(s.copies.map(c => c[key]))].sort((a,b) => a.localeCompare(b,'ja'))) {
        result.push({ type: item.type, target: value, label: item.title + '：' + value });
      }
    }
    return result;
  }
  function isLost(copy, incident) {
    switch (incident.type) {
      case 'device': return copy.device === incident.target;
      case 'site': return copy.site === incident.target;
      case 'account': return copy.account === incident.target && copy.online;
      case 'ransomware': return copy.online && !copy.locked;
      default: throw Error('未知の事故です');
    }
  }
  function evaluateDataset(dataset, copies, incident) {
    const all = copies.filter(c => c.datasetId === dataset.id);
    const lost = all.filter(c => isLost(c, incident));
    const survivors = all.filter(c => !isLost(c, incident));
    const fresh = survivors.filter(c => c.ageHours <= dataset.rpoHours);
    const verified = survivors.filter(c => c.verified);
    const usable = fresh.filter(c => c.verified);
    // If nothing verified survives, this is not a proven restore route, even if copies exist.
    const status = usable.length ? 'ready' : verified.length ? 'stale' : survivors.length ? 'untested' : 'lost';
    const selected = (usable.length ? usable : verified.length ? verified : survivors)
      .slice().sort((a,b) => a.ageHours-b.ageHours || b.speed-a.speed)[0] || null;
    const estimatedHours = selected ? Math.round((dataset.sizeGB * 1000 / selected.speed / 3600) * 100) / 100 : null;
    return { id: dataset.id, name: dataset.name, status, all, lost, survivors, selected, estimatedHours,
      ageHours: selected ? selected.ageHours : null, rpoHours: dataset.rpoHours, sizeGB: dataset.sizeGB };
  }
  function evaluate(state, incident) {
    const s = normalize(state);
    const ss = scenarios(s);
    const scen = typeof incident === 'string' ? ss.find(x => scenarioKey(x) === incident) : incident || ss[0];
    if (!scen || !ss.some(x => scenarioKey(x) === scenarioKey(scen))) throw Error('事故シナリオが見つかりません');
    const datasets = s.datasets.map(d => evaluateDataset(d, s.copies, scen));
    return { incident: scen, datasets, ready: datasets.filter(d => d.status === 'ready').length, total: datasets.length };
  }
  function matrix(state) {
    const s = normalize(state);
    const incidents = scenarios(s);
    const rows = incidents.map(incident => evaluate(s, incident));
    const cols = s.datasets.map(d => {
      const statuses = rows.map(r => r.datasets.find(x => x.id === d.id).status);
      return { id: d.id, name: d.name, passed: statuses.filter(v => v === 'ready').length, total: rows.length, statuses };
    });
    const readyCells = cols.reduce((n,c) => n+c.passed, 0);
    return { rows, cols, readyCells, totalCells: cols.length*rows.length, scenarios: rows.length };
  }
  function advice(state, precomputed) {
    const s = normalize(state), grid = precomputed || matrix(s);
    return s.datasets.map(d => {
      const cps = s.copies.filter(c => c.datasetId === d.id);
      const col = grid.cols.find(c => c.id === d.id);
      const ideas = [];
      if (!cps.length) ideas.push('コピーがありません。まず少なくとも1つ復元可能なコピーを追加');
      if (new Set(cps.map(c => c.site)).size < 2) ideas.push('別拠点に独立したコピーを作成');
      if (!cps.some(c => !c.online || c.locked)) ideas.push('切離し保管または変更不可の世代バックアップを追加');
      if (!cps.some(c => c.verified && c.ageHours <= d.rpoHours)) ideas.push('許容時間内のコピーを作り、実際の復元テストを実施');
      if (cps.some(c => !c.verified)) ideas.push('未検証コピーから復元できるか実機で試す');
      if (cps.some(c => c.ageHours > d.rpoHours)) ideas.push('更新が遅れたコピーの実行間隔を短縮');
      if (col.passed < col.total && ideas.length === 0) ideas.push('弱い事故パターンを選んで、異なる機器・認証群にコピーを追加');
      if (!ideas.length) ideas.push('今回の仮定では全事故を通過。実復元テストと新しい故障パターンを確認');
      return { id:d.id, name:d.name, passed:col.passed, total:col.total, ideas:ideas.slice(0,3) };
    });
  }
  function csvReport(state) {
    const s=normalize(state), rows=matrix(s).rows;
    const esc = val => { let v=String(val ?? ''); if (/^[=+\-@\t\r]/.test(v)) v="'"+v; return '"'+v.replace(/"/g,'""')+'"'; };
    return '\uFEFF'+[
      ['事故','資産','判定','復元候補','最終経過h','許容h','復元見積h'],
      ...rows.flatMap(r => r.datasets.map(d => [r.incident.label,d.name,d.status,d.selected?.name || '',d.ageHours ?? '',d.rpoHours,d.estimatedHours ?? '']))
    ].map(row=>row.map(esc).join(',')).join('\r\n')+'\r\n';
  }
  return { INCIDENTS, LIMITS, example, normalize, scenarios, scenarioKey, isLost, evaluateDataset, evaluate, matrix, advice, csvReport };
});
