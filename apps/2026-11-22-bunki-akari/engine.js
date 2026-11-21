/* 分岐灯 — pure branching-graph inspection engine. MIT License. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BunkiEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const END = 'END', MAX_QUESTIONS = 30, MAX_OPTIONS = 5, MAX_CASES = 150;
  const demo = () => ({
    version: 1, name: '地域イベント参加案内｜分岐テスト', start: 'q1',
    questions: [
      { id:'q1', title:'参加方法を選んでください', minutes:0.5, options:[{label:'会場で参加',next:'q2'},{label:'オンラインで参加',next:'q4'}]},
      { id:'q2', title:'同伴者はいますか？', minutes:0.5, options:[{label:'いる',next:'q3'},{label:'いない',next:'q5'}]},
      { id:'q3', title:'会場でのサポートを希望しますか？', minutes:1, options:[{label:'はい',next:'q5'},{label:'いいえ',next:'q5'}]},
      { id:'q4', title:'どの端末から視聴しますか？', minutes:0.5, options:[{label:'スマートフォン',next:'q5'},{label:'パソコン',next:'q5'}]},
      { id:'q5', title:'参加案内を確認しましたか？', minutes:0.5, options:[{label:'確認した',next:END},{label:'まだ読んでいない',next:'q5'}]},
      { id:'q6', title:'イベント後の任意アンケート', minutes:0.5, options:[{label:'回答する',next:END},{label:'回答しない',next:END}]}
    ]
  });
  function clean(project) {
    if (!project || typeof project !== 'object' || Array.isArray(project)) throw Error('プロジェクト形式が不正です。');
    if (!Array.isArray(project.questions) || project.questions.length < 1 || project.questions.length > MAX_QUESTIONS) throw Error('質問は1～30件にしてください。');
    const ids = new Set();
    const questions = project.questions.map((q, i) => {
      if (!q || typeof q !== 'object') throw Error('質問形式が不正です。');
      const id = String(q.id || '');
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,24}$/.test(id) || id === END || ids.has(id)) throw Error('質問IDが無効または重複しています: ' + id);
      ids.add(id);
      if (!Array.isArray(q.options) || q.options.length < 1 || q.options.length > MAX_OPTIONS) throw Error(`${id} の選択肢は1～5件にしてください。`);
      const minutes = Number(q.minutes);
      if (!Number.isFinite(minutes) || minutes < 0 || minutes > 30) throw Error(`${id} の回答時間は0～30分にしてください。`);
      return { id, title: String(q.title ?? '').slice(0,160), minutes,
        options: q.options.map(o => ({label:String(o?.label ?? '').slice(0,100),next:String(o?.next ?? '').slice(0,40)})) };
    });
    return {version:1, name:String(project.name ?? '無題のフォーム').slice(0,140),start:String(project.start || ''),questions};
  }
  function audit(input) {
    const p = clean(input), map = new Map(p.questions.map(q => [q.id,q]));
    const issues = [];
    const add = (level,code,id,message) => issues.push({level,code,id,message});
    const edges = new Map();
    for (const q of p.questions) {
      if (!q.title.trim()) add('error','EMPTY_TITLE',q.id,'質問文が空です');
      const seen = new Set();
      const targets = [];
      for (const [i,o] of q.options.entries()) {
        if (!o.label.trim()) add('error','EMPTY_CHOICE',q.id,`${i+1}番目の選択肢名が空です`);
        const key = o.label.trim();
        if (key && seen.has(key)) add('warn','DUPLICATE_CHOICE',q.id,`同名の選択肢「${key}」があります`);
        seen.add(key);
        if (!o.next || (o.next !== END && !map.has(o.next))) add('error','BROKEN_EDGE',q.id,`「${o.label || i+1}」の行き先が未設定・不明です`);
        if (o.next === END || map.has(o.next)) targets.push(o.next);
      }
      edges.set(q.id,targets);
    }
    if (!map.has(p.start)) add('error','INVALID_START','','開始質問がありません');
    const reachable = new Set(), stack = map.has(p.start) ? [p.start] : [];
    while (stack.length) {
      const id=stack.pop(); if (reachable.has(id)) continue;
      reachable.add(id);
      for (const dest of edges.get(id)) if (dest!==END && !reachable.has(dest)) stack.push(dest);
    }
    for (const q of p.questions) if (!reachable.has(q.id)) add('warn','UNREACHABLE',q.id,'開始から到達できない質問です');
    const color = new Map(), back = new Set();
    function dfs(id) {
      color.set(id,1);
      for (const next of edges.get(id)||[]) {
        if (next===END || !reachable.has(next)) continue;
        if (color.get(next)===1) back.add(`${id} → ${next}`);
        else if (!color.has(next)) dfs(next);
      }
      color.set(id,2);
    }
    if (map.has(p.start)) dfs(p.start);
    for (const relation of back) add('warn','CYCLE','',`繰り返し経路の可能性: ${relation}`);
    const canFinish=new Set(); let changed=true;
    while(changed) {
      changed=false;
      for (const id of reachable) {
        if (!canFinish.has(id) && (edges.get(id)||[]).some(n => n===END || canFinish.has(n))) {canFinish.add(id);changed=true;}
      }
    }
    for (const id of reachable) if(!canFinish.has(id)) add('error','NO_EXIT',id,'この質問から完了までの経路がありません');
    const cases=[]; let truncated=false;
    if (map.has(p.start)) {
      function walk(id, visited, path, minutes) {
        if(cases.length>=MAX_CASES) {truncated=true;return;}
        if(visited.has(id)) {cases.push({status:'loop',path,minutes,last:id});return;}
        const q=map.get(id);
        if(!q) {cases.push({status:'broken',path,minutes,last:id});return;}
        const used=new Set(visited);used.add(id);
        for(let i=0;i<q.options.length;i++) {
          if(cases.length>=MAX_CASES) {truncated=true;return;}
          const o=q.options[i], nextPath=[...path,{id:q.id,answer:o.label,option:i}];
          const mins=minutes+q.minutes;
          if(o.next===END) cases.push({status:'end',path:nextPath,minutes:mins,last:END});
          else if(!map.has(o.next)) cases.push({status:'broken',path:nextPath,minutes:mins,last:o.next});
          else walk(o.next,used,nextPath,mins);
        }
      }
      walk(p.start,new Set(),[],0);
    }
    const finished=cases.filter(c=>c.status==='end');
    const completeLengths=finished.map(c=>c.path.length), completeMinutes=finished.map(c=>c.minutes);
    const stats={questions:p.questions.length, reachable:reachable.size, issueErrors:issues.filter(i=>i.level==='error').length,
      issueWarnings:issues.filter(i=>i.level==='warn').length, cases:cases.length,finished:finished.length,
      shortest:completeLengths.length?Math.min(...completeLengths):null,
      longest:!truncated&&!back.size&&completeLengths.length?Math.max(...completeLengths):null,
      timeMin:completeMinutes.length?Math.min(...completeMinutes):null,
      timeMax:!truncated&&!back.size&&completeMinutes.length?Math.max(...completeMinutes):null};
    if(truncated) add('warn','TRUNCATED','','経路が多いため150件で探索を打ち切りました。経路数・所要時間は概算です');
    if(finished.some(c=>c.path.length>8)) add('warn','LONG_PATH','','9問以上を通過する完了経路があります');
    stats.issueErrors=issues.filter(i=>i.level==='error').length;
    stats.issueWarnings=issues.filter(i=>i.level==='warn').length;
    return {project:p,issues,cases,reachable:[...reachable],stats,truncated,cycleEdges:[...back]};
  }
  function csvCell(v) {const s=String(v??'');return /[",\r\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"':s;}
  function csvReport(report) {
    const rows=[['種別','重要度','質問ID','内容'],...report.issues.map(i=>['診断',i.level,i.id,i.message]),
      ...report.cases.map((c,i)=>['経路'+(i+1),c.status,c.path.map(s=>s.id+':'+s.answer).join(' → '),`${c.minutes}分`])];
    return '\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
  }
  return {END,MAX_QUESTIONS,MAX_CASES,demo,clean,audit,csvReport};
});
