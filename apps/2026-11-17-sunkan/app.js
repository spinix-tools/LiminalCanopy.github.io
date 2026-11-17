/* Sunkan UI — no network, trackers, fonts, or external dependencies */
(function () {
  'use strict';
  const E = window.Sunkan;
  const $ = id => document.getElementById(id);
  const STORAGE = 'sunkan-v1';
  let uid=0;
  let state = E.copy(E.DEFAULT);
  const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function message(s, isError=false){ $('message').textContent=s;$('message').classList.toggle('error',isError); }
  function safeSave(){try{localStorage.setItem(STORAGE,JSON.stringify({version:1,state}));}catch(e){message('端末内保存に失敗しました。JSON書き出しをご利用ください',true);}}
  function save(){E.validate(state);safeSave();renderResults();}
  function newId(){return 'id-'+Date.now().toString(36)+'-'+(++uid)+'-'+Math.random().toString(36).slice(2,7);}
  function metricInputs(category, prefix, values){return E.METRICS[category].map((m)=>`<div class="field"><label for="${prefix}${m.id}">${esc(m.label)}</label><div class="unit"><input id="${prefix}${m.id}" data-metric="${m.id}" type="number" step="0.1" min="1" max="300" required value="${Number(values?.[m.id] ?? 50)}"></div></div>`).join('');}
  function readFields(prefix) {const out={};for (const m of E.METRICS[state.category]) {const s=$(prefix+m.id).value.trim();if(!s)throw Error(m.label+'を入力してください');out[m.id]=Number(s);if(!Number.isFinite(out[m.id])||out[m.id]<1||out[m.id]>300)throw Error(m.label+'は1〜300cmの範囲で入力してください');}return out;}
  function restoreControls(){
    $('category').value=state.category;
    $('referenceName').value=state.referenceName;
    $('referenceFields').innerHTML=metricInputs(state.category,'ref-',state.reference);
    const example=state.category==='top' ? {length:70,width:55,shoulder:48,sleeve:60} : {waist:41,rise:29,inseam:72,thigh:31};
    $('candidateFields').innerHTML=metricInputs(state.category,'item-',example);
    $('preference').value=String(state.preference);
    $('preferenceNote').textContent=state.category==='top'?'身幅だけに反映します':'わたり幅だけに反映します';
    $('tolerance').value=state.tolerance;$('toleranceDisplay').textContent='±'+state.tolerance+'cm';
    $('shrinkV').value=state.shrinkV;$('shrinkH').value=state.shrinkH;
  }
  function card(it, rank){
    const cls=it.misses===0?'':' '+(it.misses<=2?'caution':'bad');
    const chart=it.rows.map(r=>{
      const offset=Math.min(50,Math.abs(r.delta)*5);
      const left=r.delta<0 ? 50-offset : 50;
      const width=Math.max(1,offset);
      const bad=!r.within;
      return `<div class="metricrow"><span class="mname">${esc(r.label)}</span><div class="meter" role="img" aria-label="${esc(r.label)}：基準目標と比べて${r.delta>0?'+':''}${r.delta}cm"><span class="bar ${bad?'out':''}" style="left:${left}%;width:${width}%"></span></div><span class="delta ${bad?'out':''}">${r.delta>0?'+':''}${r.delta.toFixed(1)} cm</span></div>`;
    }).join('');
    const details=it.rows.map(r=>`${esc(r.label)}: ${r.before.toFixed(1)} → ${r.after.toFixed(1)}cm（目標 ${r.target.toFixed(1)}）`).join(' ／ ');
    return `<article class="candidate ${rank===0?'best':''}"><div class="candidate-top"><div><div class="cname">${esc(it.name)}</div><span class="size">${esc(it.size)}</span></div><div class="score"><strong>${it.score}</strong><span>参考点</span></div></div><div class="candidate-sub"><span class="status${cls}">${esc(it.rankLabel)}</span><span class="micro">許容範囲外 ${it.misses}/4</span></div>${chart}<div class="details">${details}</div><div class="cardfoot"><span class="micro">${rank===0?'★ 最も差の少ない候補':''}</span><button class="btn small danger" type="button" data-remove="${esc(it.id)}">削除</button></div></article>`;
  }
  function renderResults(){
    const ranked=E.rank(state);
    $('count').textContent=ranked.length;
    $('near').textContent=ranked.filter(it=>it.misses===0).length;
    $('best').textContent=ranked.length ? ranked[0].size : '—';
    $('comparisonLabel').textContent=`${state.referenceName||'基準服'}との差`;
    if(!ranked.length){$('results').innerHTML='<div class="empty">まだ候補がありません。左のフォームから追加するかCSVを読み込んでください。</div>';$('insight').textContent='候補を追加すると、基準服と候補の実寸差を自動計算します。';return;}
    $('results').innerHTML=ranked.map(card).join('');
    const best=ranked[0];
    const missed=best.rows.filter(r=>!r.within);
    $('insight').textContent=best.misses===0
      ? `「${best.name} / ${best.size}」は4項目すべて許容差内です。ただし素材・型紙などの違いは判断できません。`
      : `最も差が少ない「${best.name} / ${best.size}」でも、${missed.map(r=>r.label).join('・')}が許容差を超えます。購入前に寸法と返品条件を再確認してください。`;
  }
  function download(name,content,mime){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
  function addCandidate(){const candidate={id:newId(),name:$('itemName').value.trim(),size:$('itemSize').value.trim(),values:readFields('item-')};const next=E.copy(state);next.items.push(candidate);E.validate(next);state=next;save();$('itemSize').value='';message('「'+candidate.name+' / '+candidate.size+'」を追加しました');}
  function readBase(){const next=E.copy(state);next.referenceName=$('referenceName').value.trim();next.reference=readFields('ref-');E.validate(next);state=next;save();message('基準服を更新しました');}
  function updateSettings(){const next=E.copy(state);next.preference=Number($('preference').value);next.tolerance=Number($('tolerance').value);next.shrinkV=$('shrinkV').value.trim()===''?NaN:Number($('shrinkV').value);next.shrinkH=$('shrinkH').value.trim()===''?NaN:Number($('shrinkH').value);E.validate(next);state=next;save();$('toleranceDisplay').textContent='±'+state.tolerance+'cm';message('比較条件を更新しました');}
  function loadData(s){state=E.hydrate(s);restoreControls();save();message('データを復元しました');}
  function boot(){
    try{const saved=localStorage.getItem(STORAGE);if(saved)state=E.hydrate(saved);}catch(e){state=E.copy(E.DEFAULT);}
    restoreControls();renderResults();
    $('category').addEventListener('change',()=>{
      const cat=$('category').value;
      if(cat===state.category)return;
      if(!window.confirm('カテゴリを変えると現在の比較はサンプルデータに置き換わります。変更前の比較をJSON保存しましたか？')){$('category').value=state.category;return;}
      state=cat==='top'?E.copy(E.DEFAULT):{
        category:'bottom', referenceName:'着慣れたパンツ',
        reference:{waist:40,rise:28,inseam:72,thigh:30},
        preference:0,tolerance:2,shrinkV:0,shrinkH:0,
        items:[{id:'pants-a',name:'候補 / デニム',size:'M',values:{waist:41,rise:29,inseam:73,thigh:31}},
        {id:'pants-b',name:'候補 / デニム',size:'L',values:{waist:43,rise:30,inseam:75,thigh:33}}]
      };
      restoreControls();save();message('カテゴリ変更に伴いサンプルデータへ切り替えました。以前のカテゴリのデータはJSON保存で退避してください。');
    });
    $('referenceName').addEventListener('change',()=>{try{readBase();}catch(e){message(e.message,true);}});
    $('referenceFields').addEventListener('change',()=>{try{readBase();}catch(e){message(e.message,true);}});
    ['preference','tolerance','shrinkV','shrinkH'].forEach(id=>$(id).addEventListener('change',()=>{try{updateSettings();}catch(e){message(e.message,true);}}));
    document.querySelectorAll('[data-shrink]').forEach(btn=>btn.addEventListener('click',()=>{const [v,h]=btn.dataset.shrink.split(',');$('shrinkV').value=v;$('shrinkH').value=h;try{updateSettings();}catch(e){message(e.message,true);}}));
    $('addForm').addEventListener('submit',e=>{e.preventDefault();try{addCandidate();}catch(err){message(err.message,true);}});
    $('results').addEventListener('click',e=>{const btn=e.target.closest('[data-remove]');if(!btn)return;state.items=state.items.filter(it=>it.id!==btn.dataset.remove);save();message('候補を削除しました');});
    $('csvFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>300000)throw Error('CSVは300KB以内にしてください');const incoming=E.importCandidates(await file.text(),state.category,newId);const next=E.copy(state);next.items.push(...incoming);E.validate(next);state=next;save();message(incoming.length+'件を追加しました');}catch(err){message(err.message,true);}finally{e.target.value='';}});
    $('templateBtn').addEventListener('click',()=>{const m=E.METRICS[state.category];const example=m.map(x=>state.reference[x.id]);download('sunkan-template.csv',E.toCSV([['商品名','サイズ',...m.map(x=>x.label)],['サンプル商品','M',...example]]),'text/csv;charset=utf-8');});
    $('clearBtn').addEventListener('click',()=>{if(!window.confirm('候補サイズをすべて削除しますか？'))return;state.items=[];save();message('候補を削除しました');});
    $('saveCsv').addEventListener('click',()=>{try{download('sunkan-candidates.csv',E.exportCandidates(state),'text/csv;charset=utf-8');message('候補CSVを出力しました');}catch(e){message(e.message,true);}});
    $('saveJson').addEventListener('click',()=>{download('sunkan-project.json',JSON.stringify({version:1,state},null,2),'application/json;charset=utf-8');message('JSONバックアップを出力しました');});
    $('loadJson').addEventListener('click',()=>$('jsonFile').click());
    $('jsonFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>300000)throw Error('JSONは300KB以内にしてください');loadData(await f.text());}catch(err){message('復元失敗：'+err.message,true);}finally{e.target.value='';}});
    $('printBtn').addEventListener('click',()=>window.print());
    $('demoBtn').addEventListener('click',()=>{if(!window.confirm('現在の内容をサンプルに戻しますか？'))return;state=E.copy(E.DEFAULT);restoreControls();save();message('サンプルに戻しました');});
    $('resetBtn').addEventListener('click',()=>{if(!window.confirm('保存済みの全データを削除して初期化しますか？'))return;try{localStorage.removeItem(STORAGE);}catch(e){}state=E.copy(E.DEFAULT);restoreControls();renderResults();message('端末データを初期化しました（この状態は次の編集まで自動保存されません）');});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
