/* UI: local only, no network, no account, no external dependencies. */
(()=>{
  'use strict';
  const E=window.ToriEngine;
  if(!E)throw Error('engine.js を先に読み込んでください');
  const KEY='torimonosashi.v1';
  const $=id=>document.getElementById(id);
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(n,d=1)=>n==null?'—':Number(n).toLocaleString('ja-JP',{minimumFractionDigits:d,maximumFractionDigits:d});
  const pct=n=>n==null?'—':`${fmt(n*100,1)}%`;
  let project=E.demo();
  let pendingMessage='';
  let restoredFilters=null;
  function loadLocal(){try{const raw=localStorage.getItem(KEY);if(raw){const state=JSON.parse(raw);project=E.normalizeProject(state.project);if(state.periods){restoredFilters=state.periods;for(const [id,value]of Object.entries(state.periods)){if($(id)&&typeof value==='string')$(id).value=value;}}return true;}}catch(err){pendingMessage=`保存データを読み込めませんでした: ${err.message}`;}return false;}
  function store(){try{localStorage.setItem(KEY,JSON.stringify({project,periods:readFilters()}));}catch(err){notice('端末保存に失敗しました。JSONバックアップを利用してください。','error');}}
  function readFilters(){return Object.fromEntries(['startA','endA','startB','endB','speciesSelect','siteSelect'].map(id=>[id,$(id).value]));}
  function notice(msg,type='ok'){const n=$('notice');n.textContent=msg;n.className='notice'+(type==='error'?' error':'');}
  function id(){return 's'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);}
  function getPeriod(pre){return{start:$('start'+pre).value,end:$('end'+pre).value};}
  function download(filename,data,type){const blob=new Blob([data],{type});const link=document.createElement('a');const url=URL.createObjectURL(blob);link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  function refreshSelects(){
    const species=$('speciesSelect'),site=$('siteSelect');
    const oldSpecies=species.value,oldSite=site.value;
    const names=E.speciesList(project.sessions);
    const sites=[...new Set(project.sessions.map(x=>x.site))].sort((a,b)=>a.localeCompare(b,'ja'));
    species.replaceChildren();
    for(const name of names){const opt=document.createElement('option');opt.value=name;opt.textContent=name;species.append(opt);}
    if(!names.length){const opt=document.createElement('option');opt.value='';opt.textContent='鳥の記録を追加してください';species.append(opt);}
    if(names.includes(oldSpecies))species.value=oldSpecies;
    else if(names.includes('シジュウカラ'))species.value='シジュウカラ';
    site.replaceChildren();let all=document.createElement('option');all.value='';all.textContent='すべての場所';site.append(all);
    sites.forEach(label=>{const opt=document.createElement('option');opt.value=label;opt.textContent=label;site.append(opt);});
    if(sites.includes(oldSite))site.value=oldSite;
  }
  function metric(r,label,cls){
    const interval=r.interval?`${pct(r.interval.lo)} 〜 ${pct(r.interval.hi)}`:'—';
    return `<div class="metric ${cls}"><div class="metric-top"><span>${label}</span><span>${r.n} 回</span></div><div class="rate">${pct(r.rate)}</div><div class="secondary">対象種を記録：<strong>${r.present} / ${r.n} 回</strong><br>観察時間：<strong>${fmt(r.hours,2)} 時間</strong><br>記録羽数/時：<strong>${fmt(r.perHour,2)}</strong><br>対象外の部分記録：${r.partial} 回</div><span class="interval">Wilson 95%区間：${interval}</span></div>`;
  }
  function renderComparison(){
    const target=$('comparison'),caveats=$('caveats');
    if(!project.sessions.length||!$('speciesSelect').value){target.innerHTML='<div class="empty">観察記録と鳥名を追加すると比較できます。</div>';caveats.textContent='';return;}
    try{
      const r=E.compare(project,{a:getPeriod('A'),b:getPeriod('B'),species:$('speciesSelect').value,site:$('siteSelect').value});
      const delta=r.delta==null?'—':`${r.delta>0?'+':''}${fmt(r.delta*100,1)} ポイント`;
      target.innerHTML=`<div class="metrics-head"><strong>${escape(r.species)}</strong><span>${r.site?escape(r.site):'すべての場所'}</span></div><div class="metrics">${metric(r.a,'期間 A','a')}${metric(r.b,'期間 B','b')}</div><div class="delta">出現率の差 B − A <strong>${delta}</strong></div>`;
      caveats.textContent=['※区間は独立なチェックリストを仮定した参考値。生息数や増減の因果は示しません。',...r.caveats].join(' ');
    }catch(err){target.innerHTML='<div class="empty">期間を確認してください。</div>';caveats.textContent=err.message;}
  }
  function buildChart(){
    const species=$('speciesSelect').value;
    if(!species)return '';
    const months=E.monthly(project.sessions,species,$('siteSelect').value);
    if(!months.length)return '';
    const n=months.length,W=Math.max(590,n*77+70),H=255,base=186,left=48,gap=(W-left-14)/n;
    const lines=[0,25,50,75,100].map(v=>{const y=base-v/100*144;return `<line x1="${left}" y1="${y}" x2="${W-14}" y2="${y}" stroke="#e4eae4"/><text x="${left-9}" y="${y+4}" text-anchor="end" font-size="10" fill="#71847b">${v}%</text>`;}).join('');
    const bars=months.map((m,i)=>{const x=left+gap*i+gap*.23,bw=gap*.54,h=Math.max(m.rate?2:0,m.rate*144),y=base-h;
      return `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="5" fill="#438f79"/><text x="${x+bw/2}" y="${Math.max(16,y-8)}" text-anchor="middle" font-size="10" font-weight="700" fill="#276959">${Math.round(m.rate*100)}%</text><text x="${x+bw/2}" y="${base+18}" text-anchor="middle" font-size="10" fill="#495f56">${escape(m.month.slice(2))}</text><text x="${x+bw/2}" y="${base+34}" text-anchor="middle" font-size="10" fill="#81918a">n=${m.n}</text>`;}).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${escape(species)}の月別出現率。対象は完全記録のみ。"><title>${escape(species)}：月別出現率（完全記録のみ）</title><rect width="${W}" height="${H}" rx="10" fill="#fcfdfb"/>${lines}${bars}<text x="${left}" y="${H-12}" fill="#6b8075" font-size="11">棒：その月の完全記録における出現率　 /　 n：完全記録数</text></svg>`;
  }
  function renderChart(){const svg=buildChart();$('chart').innerHTML=svg||'<div class="chart-empty">この場所の完全記録がまだありません。</div>';}
  function renderLogs(){
    const log=$('logBody'),records=[...project.sessions].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
    $('logCount').textContent=`${records.length}件`;
    if(!records.length){log.innerHTML='<tr><td colspan="5" class="empty">観察を追加してください。鳥が見られなかった日も登録できます。</td></tr>';return;}
    log.innerHTML=records.map(s=>`<tr><td><span class="cell-main">${escape(s.date)}</span><span class="cell-sub">${escape(s.site)}</span></td><td>${s.minutes}分</td><td><span class="status ${s.complete?'':'partial'}">${s.complete?'完全':'部分'}</span></td><td class="tagline">${s.sightings.length?s.sightings.map(x=>`${escape(x.species)} ${x.count}`).join(' · '):'記録なし'}</td><td><button class="action-link" type="button" data-action="edit" data-id="${escape(s.id)}">編集</button><button class="action-link danger" type="button" data-action="delete" data-id="${escape(s.id)}">削除</button></td></tr>`).join('');
  }
  function refresh(){refreshSelects();renderComparison();renderChart();renderLogs();store();}
  function clearForm(){
    $('sessionForm').reset();$('date').value='2026-11-20';$('minutes').value='30';$('site').value='近所の公園';$('complete').checked=true;$('editId').value='';$('entryTitle').textContent='観察を記録する';$('submitBtn').textContent='＋ この観察を追加';$('cancelBtn').hidden=true;
  }
  function editSession(idValue){const s=project.sessions.find(x=>x.id===idValue);if(!s)return;
    $('editId').value=s.id;$('date').value=s.date;$('minutes').value=s.minutes;$('site').value=s.site;$('complete').checked=s.complete;$('sightings').value=s.sightings.map(x=>`${x.species},${x.count}`).join('\n');$('entryTitle').textContent='観察を編集する';$('submitBtn').textContent='変更を保存';$('cancelBtn').hidden=false;$('sessionForm').scrollIntoView({behavior:'smooth',block:'start'});
  }
  $('sessionForm').addEventListener('submit',event=>{event.preventDefault();try{
    const editing=$('editId').value;
    const s=E.normalizeSession({id:editing||id(),date:$('date').value,site:$('site').value,minutes:$('minutes').value,complete:$('complete').checked,sightings:E.parseSightings($('sightings').value)});
    if(editing){const idx=project.sessions.findIndex(x=>x.id===editing);if(idx<0)throw Error('編集対象が見つかりません');project.sessions[idx]=s;}else{if(project.sessions.length>=1000)throw Error('観察記録は1000件以内です');project.sessions.push(s);}
    const msg=editing?'観察記録を更新しました。':'観察記録を追加しました。';clearForm();refresh();notice(msg);
  }catch(err){notice(err.message,'error');}});
  $('cancelBtn').addEventListener('click',()=>{clearForm();notice('編集を取り消しました。');});
  $('logBody').addEventListener('click',event=>{const btn=event.target.closest('button[data-action]');if(!btn)return;
    const rowId=btn.dataset.id;
    if(btn.dataset.action==='edit'){editSession(rowId);return;}
    const prev=project.sessions.length;project.sessions=project.sessions.filter(s=>s.id!==rowId);
    if(project.sessions.length!==prev){if($('editId').value===rowId)clearForm();refresh();notice('観察記録を削除しました。');}
  });
  ['startA','endA','startB','endB','speciesSelect','siteSelect'].forEach(key=>$(key).addEventListener('change',()=>{renderComparison();renderChart();store();}));
  $('demoBtn').addEventListener('click',()=>{if(project.sessions.length && !confirm('現在の観察記録をサンプル13件に置き換えますか？ JSONバックアップが可能です。'))return;project=E.demo();clearForm();refresh();notice('架空のサンプル13件を読み込みました。実際の野鳥データではありません。');});
  $('exportJsonBtn').addEventListener('click',()=>{download('torimonosashi-backup.json',JSON.stringify(project,null,2),'application/json;charset=utf-8');notice('JSONバックアップを書き出しました。');});
  $('importBtn').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>3_000_000)throw Error('3MBを超えるJSONには対応していません');const obj=E.normalizeProject(JSON.parse(await file.text()));project=obj;clearForm();refresh();notice(`${project.sessions.length}件の観察を復元しました。`);}catch(err){notice(`復元できませんでした：${err.message}`,'error');}finally{event.target.value='';}});
  $('csvBtn').addEventListener('click',()=>{download('torimonosashi-observations.csv',E.toCSV(project.sessions),'text/csv;charset=utf-8');notice('観察ログCSVを保存しました。');});
  $('svgBtn').addEventListener('click',()=>{const chart=buildChart();if(!chart){notice('書き出せるグラフがありません。','error');return;}download('torimonosashi-monthly.svg',chart,'image/svg+xml;charset=utf-8');notice('月別グラフSVGを書き出しました。');});
  $('printBtn').addEventListener('click',()=>window.print());
  const found=loadLocal();refresh();if(restoredFilters){for(const id of ['speciesSelect','siteSelect']){const value=restoredFilters[id];if(typeof value==='string' && [...$(id).options].some(o=>o.value===value))$(id).value=value;}renderComparison();renderChart();store();}if(pendingMessage)notice(pendingMessage,'error');else if(!found)notice('表示中の13件は架空のサンプルです。入力・編集・比較を試せます。');
})();