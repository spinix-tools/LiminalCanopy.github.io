(function () {
  'use strict';
  const E = window.Nukidori, $ = id => document.getElementById(id), ids=['N','good','bad','alpha','beta','maxN'];
  const key='nukidori-cho-v1';
  let state={cfg:null,plan:null,seed:'試作-A-001',units:[]};
  const fmt=(p)=>Number((p*100).toFixed(1)).toLocaleString('ja-JP')+'%';
  const num=(n)=>Number(n).toLocaleString('ja-JP');
  const escapeHtml=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function readCfg(){return Object.fromEntries(ids.map(id=>[id, Number($(id).value)]));}
  function setCfg(cfg){for(const id of ids)if(cfg[id]!==undefined)$(id).value=cfg[id];}
  function sameCfg(a,b){return !!a&&ids.every(id=>a[id]===b[id]);}
  function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch(e){/* private mode: app still works */}}
  function msg(str){$('error').textContent=str||'';}
  function drawCurve(cfg,n,c){
    const max=Math.min(100,Math.max(18,cfg.bad*1.9)), pts=[];
    for(let i=0;i<=70;i++){
      const pct=max*i/70, D=Math.round(cfg.N*pct/100);
      pts.push([44+532*i/70,206-170*E.acceptance(cfg.N,D,n,c)]);
    }
    const line=pts.map(([x,y],i)=>(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)).join(' ');
    const xAt=p=>44+532*Math.min(p,max)/max;
    return `<div class="curvewrap"><svg viewBox="0 0 620 242" role="img" aria-label="横軸が不適合率、縦軸がロットの合格確率のOC曲線">
      <g stroke="#dfe9de" stroke-width="1"><path d="M44 36H576 M44 121H576 M44 206H576"/></g>
      <g font-family="sans-serif" font-size="12" fill="#79877d"><text x="10" y="40">100%</text><text x="17" y="125">50%</text><text x="23" y="210">0%</text><text x="44" y="230">0%</text><text x="544" y="230">${max.toFixed(0)}%</text><text x="239" y="239">不適合率 →</text></g>
      <path d="${line}" fill="none" stroke="#1c795c" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M${xAt(cfg.good)} 36V206" stroke="#e3a461" stroke-dasharray="5 4" stroke-width="2"/><path d="M${xAt(cfg.bad)} 36V206" stroke="#be6c48" stroke-dasharray="5 4" stroke-width="2"/></svg>
      <div class="key"><span><i class="dot"></i>計画の合格確率</span><span><i class="dot orange"></i>良品・不良品の想定位置</span></div></div>`;
  }
  function renderPlan(){
    const el=$('plan');
    if(!state.plan){el.innerHTML='<p class="muted">「条件から計画を探す」を押してください。</p>';return;}
    const p=state.plan, cfg=state.cfg;
    const chosen=p.found?p:p.closest;
    if(!chosen){el.innerHTML='<div class="alert">設定条件で計画を計算できませんでした。</div>';return;}
    const note=p.found?'<span class="label">設定した危険上限を両方満たしています</span>':'<span class="label bad">危険上限を両方満たす計画は見つかりません</span>';
    el.innerHTML=`${note}<div class="summary"><div class="stat"><strong>${num(chosen.n)}</strong><small>検査する数 n</small></div><div class="stat"><strong>${num(chosen.c)} 個</strong><small>合格許容数 c</small></div><div class="stat"><strong>${num(cfg.N)}</strong><small>ロット全数</small></div></div>
      <p class="text">${chosen.n}個を無作為に抜き取り、不適合が <b>${chosen.c}個以下なら合格</b>、${chosen.c+1}個以上なら不合格とする単回抜取計画です。</p>
      ${p.found?'':`<div class="alert">最大${p.limitN}個までの探索では両方の目標を満たしません。表示中の<b>参考案</b>でも目標超過があります。上限を見直すか全数検査等を検討してください。</div>`}
      <div class="data"><div class="datum"><b>${fmt(chosen.alpha)}</b><small>生産者危険 α<br>上限 ${cfg.alpha}%</small></div><div class="datum"><b>${fmt(chosen.beta)}</b><small>消費者危険 β<br>上限 ${cfg.beta}%</small></div><div class="datum"><b>${(100*chosen.n/cfg.N).toFixed(1)}%</b><small>抜取率 n/N</small></div></div>
      ${drawCurve(cfg,chosen.n,chosen.c)}<p class="hint">良品側の不適合品数 ${chosen.Dgood}個、不良側 ${chosen.Dbad}個（%を整数個数に四捨五入）。αは良品ロットを棄却する確率、βは不良ロットを受け入れる確率です。</p>`;
  }
  function renderWork(){
    const el=$('work');
    if(!state.units.length){el.innerHTML='<p class="muted">左の「この計画で番号を抽出」から始めてください。</p>';return;}
    const chosen=state.plan.found?state.plan:state.plan.closest;
    const d=E.decision(state.units.map(u=>u.status),chosen.c);
    const title=d.verdict==='reject'?'判定：不合格（上限超過）':d.verdict==='accept'?'判定：合格（抜取検査完了）':'判定：検査中';
    const className=d.verdict==='reject'?'reject':d.verdict==='accept'?'accept':'';
    const cards=state.units.map((u,i)=>`<div class="unit"><div class="number">#${String(u.id).padStart(4,'0')}</div><div class="options"><button type="button" class="ok ${u.status==='ok'?'selected':''}" data-i="${i}" data-status="ok" aria-pressed="${u.status==='ok'}">良</button><button type="button" class="ng ${u.status==='ng'?'selected':''}" data-i="${i}" data-status="ng" aria-pressed="${u.status==='ng'}">不良</button></div></div>`).join('');
    el.innerHTML=`<p class="text">抽出シード：<code id="seedlabel"></code>／該当番号を一つずつ検査し、「良」「不良」で記録。選択中のボタンを再押下すると未確認に戻ります。</p>
      <div class="status ${className}" role="status"><div><strong>${title}</strong><small>良品 ${d.pass} · 不良 ${d.fail} · 未確認 ${d.pending}</small></div><div><strong>${d.pass+d.fail}/${state.units.length}</strong><small>検査済み</small></div></div>
      <div class="inspect">${cards}</div><p class="hint">不適合${chosen.c+1}個に達した時点で不合格が確定します。合格は全${chosen.n}個の確認が必要です。合格しても残りの製品に不適合品がない保証はありません。</p>`;
    $('seedlabel').textContent=state.seed;
    el.querySelector('.inspect').addEventListener('click',function(ev){
      const b=ev.target.closest('button[data-i]');if(!b)return;
      const u=state.units[Number(b.dataset.i)]; if(!u)return;
      u.status=u.status===b.dataset.status?'':b.dataset.status;
      save();renderWork();
    });
  }
  function calculate(){
    try{
      const cfg=readCfg(), plan=E.search(cfg);
      state={cfg,plan,seed:$('seed').value,units:[]};
      msg('');save();renderPlan();renderWork();
    }catch(e){msg(e.message);}
  }
  function draw(){
    try{
      if(!state.plan) throw Error('先に計画を計算してください');
      if(!sameCfg(readCfg(),state.cfg))throw Error('入力値が変更されています。先に計画を再計算してください');
      const chosen=state.plan.found?state.plan:state.plan.closest;
      const seed=$('seed').value.trim();if(!seed)throw Error('再現用シードを入力してください');
      state.seed=seed;
      state.units=E.pick(state.cfg.N,chosen.n,seed).map(id=>({id,status:''}));
      msg('');save();renderWork();
      $('work').scrollIntoView({behavior:'smooth',block:'nearest'});
    }catch(e){msg(e.message);}
  }
  function payload(){
    if(!state.plan)throw Error('先に計画を計算してください');
    const chosen=state.plan.found?state.plan:state.plan.closest;
    const d=E.decision(state.units.map(u=>u.status),chosen.c);
    return {created:new Date().toISOString(),model:'finite hypergeometric, single sampling, not JIS compliant',...state,decision:d};
  }
  function download(name,content,type){
    const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));
    a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  function exportCsv(){
    try{const v=payload(),p=v.plan.found?v.plan:v.plan.closest;
      const rows=[['検品記録','ぬきどり帳'],['作成日時',v.created],['ロット数量',v.cfg.N],['抜取数',p.n],['許容不適合数',p.c],['良品側率',v.cfg.good],['不良側率',v.cfg.bad],['生産者危険',p.alpha],['消費者危険',p.beta],['目標達成',v.plan.found?'yes':'no'],['シード',v.seed],['判定',v.decision.verdict],[],['抽出番号','結果'],...v.units.map(u=>[u.id,u.status||'未確認'])];
      download('nukidori-inspection.csv',E.csv(rows),'text/csv;charset=utf-8');msg('');
    }catch(e){msg(e.message);}
  }
  function exportJson(){try{download('nukidori-record.json',JSON.stringify(payload(),null,2),'application/json;charset=utf-8');msg('');}catch(e){msg(e.message);}}
  function restore(){
    try{const saved=localStorage.getItem(key);if(!saved)return;
      const s=JSON.parse(saved);if(!s.cfg||!s.plan||!Array.isArray(s.units))return;
      const validated=E.search(s.cfg), chosen=validated.found?validated:validated.closest;
      if(!chosen||s.units.length>500||s.units.length!==0&&s.units.length!==chosen.n)return;
      const idsSet=new Set();
      const units=s.units.map(u=>({id:E.whole(u.id,1,s.cfg.N,'番号'),status:['ok','ng',''].includes(u.status)?u.status:''}));
      if(units.some(u=>idsSet.has(u.id)?true:(idsSet.add(u.id),false)))return;
      state={cfg:s.cfg,plan:validated,seed:String(s.seed||'').slice(0,80),units};setCfg(state.cfg);$('seed').value=state.seed;
    }catch(e){/* ignore broken local saves */}
  }
  $('calculate').addEventListener('click',calculate);
  $('draw').addEventListener('click',draw);
  $('csv').addEventListener('click',exportCsv);
  $('json').addEventListener('click',exportJson);
  $('print').addEventListener('click',()=>window.print());
  restore();if(!state.plan) calculate();else{renderPlan();renderWork();}
})();