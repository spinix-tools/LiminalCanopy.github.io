(function () {
'use strict';
const E = window.Korobi;
const KEY = 'korobi-yohou-v1';
const $ = id => document.getElementById(id);
const escapeHTML = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatPct = n => (100*n).toFixed(1) + '%';
const modeNames = { normal:'通常', advantage:'有利', disadvantage:'不利' };
let plan = E.defaultPlan(), hasStored = false;
try { const saved = localStorage.getItem(KEY); if (saved) { plan = E.validate(JSON.parse(saved)); hasStored = true; } } catch (err) { plan = E.defaultPlan(); }
function notify(message) { const n = $('notice'); n.textContent = message; n.hidden = false; if (typeof n.scrollIntoView !== 'function') return; }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(plan)); } catch (err) { notify('端末内の保存に失敗しました。ブラウザの設定をご確認ください。'); } }
function setInputs() {
  [['titleInput','title'],['countInput','count'],['sidesInput','sides'],['modifierInput','modifier'],['streakInput','streak'],['assistInput','assist'],['goalInput','riskGoal']].forEach(([id,key])=>{ $(id).value = plan[key]; });
}
function stepMarkup(s, i) {
 return `<div class="step-entry" data-idx="${i}"><span class="step-index">${String(i+1).padStart(2,'0')}</span>`+
 `<label><span class="step-label">判定名</span><input data-step-field="name" value="${escapeHTML(s.name)}" maxlength="48" aria-label="${i+1}番目の判定名"></label>`+
 `<label><span class="step-label">目標値</span><input data-step-field="dc" type="number" min="-200" max="700" value="${s.dc}" aria-label="${i+1}番目の目標値"></label>`+
 `<label><span class="step-label">回数</span><input data-step-field="repeats" type="number" min="1" max="12" value="${s.repeats}" aria-label="${i+1}番目の回数"></label>`+
 `<label><span class="step-label">判定方法</span><select data-step-field="mode" aria-label="${i+1}番目の判定方法">${E.MODES.map(m=>`<option value="${m}" ${s.mode===m?'selected':''}>${modeNames[m]}</option>`).join('')}</select></label>`+
 `<button type="button" class="remove-step" data-remove="${i}" title="この判定を削除" aria-label="${i+1}番目を削除">×</button></div>`;
}
function svgHistogram(a, b) {
 const probsA = a.histogram, probsB=b.histogram;
 const width=580,height=210,left=32,right=10,top=12,bottom=31, plot=height-top-bottom;
 const max = Math.max(1e-9,...probsA,...probsB)*1.15;
 const n=probsA.length, step=(width-left-right)/n, bar=Math.max(1.1,Math.min(12,step*.38));
 let s=`<svg class="hist-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`;
 for (let j=0;j<=3;j++) {const y=top+(1-j/3)*plot;s+=`<line x1="${left}" y1="${y.toFixed(1)}" x2="${width-right}" y2="${y.toFixed(1)}" class="grid-line"/><text x="${left-5}" y="${(y+3).toFixed(1)}" text-anchor="end" class="axis-text">${(max*100*j/3).toFixed(0)}</text>`;}
 for(let i=0;i<n;i++) {const x=left+(i+.5)*step, hA=probsA[i]/max*plot, hB=probsB[i]/max*plot;
  s+=`<rect x="${(x-bar-1).toFixed(2)}" y="${(top+plot-hA).toFixed(2)}" width="${bar.toFixed(2)}" height="${Math.max(0,hA).toFixed(2)}" rx="2" fill="#fba49c"><title>${i}回成功（通常）：${formatPct(probsA[i])}</title></rect>`;
  s+=`<rect x="${(x+1).toFixed(2)}" y="${(top+plot-hB).toFixed(2)}" width="${bar.toFixed(2)}" height="${Math.max(0,hB).toFixed(2)}" rx="2" fill="#94f6cb"><title>${i}回成功（追加補正）：${formatPct(probsB[i])}</title></rect>`;
  if (n<=16 || i%Math.ceil(n/12)===0 || i===n-1) s+=`<text x="${x.toFixed(2)}" y="${height-10}" text-anchor="middle" class="axis-text">${i}</text>`;
 }
 return s+`<text x="${left}" y="9" class="axis-text">確率（%）</text><text x="${width-right}" y="${height-1}" text-anchor="end" class="axis-text">成功回数</text></svg>`;
}
function renderStats() {
 const a=E.analyse(plan,0),b=E.analyse(plan,plan.assist), r=E.recommendation(plan);
 const change=(100*(a.risk-b.risk)).toFixed(1);
 $('resultView').innerHTML=`<div class="metric-highlight"><div class="metric-label">${plan.streak}回以上の連続失敗が起きる確率</div><div class="hero-risk"><span class="big-number">${formatPct(a.risk)}</span><span class="metric-unit">通常ルール</span></div><div class="risk-compare"><div class="compare-card base"><div class="label">通常 A</div><div class="value">${formatPct(a.risk)}</div></div><div class="compare-card assisted"><div class="label">補正 +${plan.assist} の B</div><div class="value">${formatPct(b.risk)}</div></div></div><div class="metric-meta">比較ルールで連続失敗リスク <b>${change}ポイント減</b>（モデル上）</div></div>
 <div class="metric-grid"><div class="metric-tile"><small>判定総数</small><strong>${a.total}回</strong></div><div class="metric-tile"><small>成功回数の期待値<br>通常 → B</small><strong>${a.expected.toFixed(1)} → ${b.expected.toFixed(1)}</strong></div><div class="metric-tile"><small>全判定成功の確率<br>通常 → B</small><strong>${formatPct(a.allSuccess)} → ${formatPct(b.allSuccess)}</strong></div></div>
 <div class="recommendation"><strong>✦ 設計ヒント</strong><br>${r.possible ? `連続失敗リスクを${plan.riskGoal}%以下にするには、全判定の基本修正値に <strong>+${r.bonus}</strong> 以上を加える案があります（この範囲で最小の整数）。その場合の計算値は ${formatPct(r.risk)}。` : `+12の補正でも目標${plan.riskGoal}%を達成できません（計算値 ${formatPct(r.risk)}）。目標値・判定回数・有利／不利を再検討してください。`}</div>
 <div class="result-caveat">注：各試行のダイスは独立。判定回数・判定方法を含む全体の確率であり、予測された失敗順序を意味しません。</div>`;
 $('probabilityList').innerHTML=a.perStep.map((s,i)=>`<div class="prob-row"><div><div class="prob-name">${escapeHTML(s.name)}</div><div class="prob-detail">DC ${s.dc} · ${s.repeats}回 · ${modeNames[s.mode]}</div></div><div class="bars"><div class="bar-track"><div class="bar-fill" style="width:${(s.p*100).toFixed(4)}%"></div></div><div class="bar-track"><div class="bar-fill assist" style="width:${(b.perStep[i].p*100).toFixed(4)}%"></div></div></div><div class="prob-pct">${(s.p*100).toFixed(0)}%<br><span style="color:var(--mint)">${(b.perStep[i].p*100).toFixed(0)}%</span></div></div>`).join('');
 $('histogram').innerHTML=svgHistogram(a,b);
 $('histogram').setAttribute('aria-label',`通常成功期待値${a.expected.toFixed(2)}回、補正時${b.expected.toFixed(2)}回。棒グラフに各成功回数の確率を表示。`);
 $('stepTotal').textContent=`${plan.steps.length}種類 · 合計${a.total}回の判定`;
}
function render() {setInputs();$('stepList').innerHTML=plan.steps.map(stepMarkup).join('');renderStats();}
function commit(next) { const valid = E.validate(next);plan=valid;persist();render(); }
[['titleInput','title'],['countInput','count'],['sidesInput','sides'],['modifierInput','modifier'],['streakInput','streak'],['assistInput','assist'],['goalInput','riskGoal']].forEach(([id,key])=>{
 $(id).addEventListener('change',event=>{try {const next={...plan,[key]: key==='title'?event.target.value:Number(event.target.value)};commit(next);}catch(err){notify(err.message);setInputs();}});
});
$('stepList').addEventListener('change',event=>{
 const inp=event.target, field=inp.dataset.stepField;if(!field)return;
 const row=inp.closest('[data-idx]');if(!row)return;
 const i=Number(row.dataset.idx);
 const steps=plan.steps.map(x=>({...x}));steps[i][field]=['dc','repeats'].includes(field)?Number(inp.value):inp.value;
 try{commit({...plan,steps});}catch(err){notify(err.message);render();}
});
$('stepList').addEventListener('click',event=>{const button=event.target.closest('[data-remove]');if(!button)return;if(plan.steps.length<=1){notify('判定は最低1行必要です。');return;}const i=Number(button.dataset.remove);try{commit({...plan,steps:plan.steps.filter((s,j)=>j!==i)});}catch(err){notify(err.message);}});
$('addStep').addEventListener('click',()=>{if(plan.steps.length>=24){notify('判定は最大24種類です。');return;}const id=`s${Date.now().toString(36)}`;try{commit({...plan,steps:[...plan.steps,{id,name:'新しい判定',dc:9,repeats:1,mode:'normal'}]});}catch(err){notify(err.message);}});
$('resetBtn').addEventListener('click',()=>{commit(E.defaultPlan());$('rollResult').textContent='サンプル設定に戻しました。';$('notice').hidden=true;});
$('rollBtn').addEventListener('click',()=>{try{const r=E.roll(plan);const ok=r.filter(x=>x.success).length;$('rollResult').innerHTML=`<strong>${r.length}回中 ${ok}回成功 · ${r.length-ok}回失敗</strong>`+r.map(x=>`<div class="roll-row"><span class="roll-label">${escapeHTML(x.name)} #${x.occurrence} <small>(DC ${x.dc})</small></span><span class="${x.success?'roll-yes':'roll-no'}">${x.total} ${x.success?'✓ 成功':'× 失敗'}</span></div>`).join('');}catch(err){notify(err.message);}});
function download(blob, filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
$('downloadCsv').addEventListener('click',()=>download(new Blob([E.toCsv(plan)],{type:'text/csv;charset=utf-8'}),'korobi-report.csv'));
$('downloadJson').addEventListener('click',()=>download(new Blob([JSON.stringify(plan,null,2)],{type:'application/json;charset=utf-8'}),'korobi-plan.json'));
$('importJson').addEventListener('click',()=>$('fileInput').click());
$('fileInput').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>100_000)throw Error('JSONは100KB以内にしてください');commit(JSON.parse(await file.text()));notify('JSON設定を読み込みました。');}catch(err){notify('読み込み失敗：'+err.message);}finally{event.target.value='';}});
$('clearSave').addEventListener('click',()=>{try{localStorage.removeItem(KEY);notify('端末内の保存データを消去しました。現在表示中の設定は残ります（次に編集すると再保存されます）。');}catch(err){notify('削除できませんでした：'+err.message);}});
$('printBtn').addEventListener('click',()=>window.print());
render();if(hasStored){$('notice').hidden=true;}
})();
