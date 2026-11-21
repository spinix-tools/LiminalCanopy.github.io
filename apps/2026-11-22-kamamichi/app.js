/* KAMAMICHI interface. No external dependencies or data transmission. */
(function () {
 'use strict';
 const E = window.KamaEngine, $ = id => document.getElementById(id), KEY = 'kamamichi.20261122.v1';
 let data = E.demo(), latest = null, uid = 1;
 const fields = [ ['name','text'],['trays','number'],['prep','number'],['proof','number'],['proofMax','number'],['bake','number'],['cool','number'],['due','time'] ];
 const setText = (id, val) => { $(id).textContent = String(val); };
 function store() { try { localStorage.setItem(KEY, JSON.stringify({ version: 1, data, mode: $('mode').value })); setText('saveState','この端末に自動保存しました'); } catch { setText('saveState','端末保存が利用できません。JSONで書き出せます'); } }
 function recover() {
   try {
     const raw = localStorage.getItem(KEY);
     if (raw) { const snap = JSON.parse(raw); const n = E.normalize(snap.data); data = { start: E.clock(n.start), oven: n.oven, jobs: n.jobs.map(j => ({id:j.id,name:j.name,trays:j.trays,prep:j.prep,proof:j.proof,proofMax:j.proofMax,bake:j.bake,cool:j.cool,due:E.clock(j.due)})) }; if (['auto','due','proof','manual'].includes(snap.mode)) $('mode').value=snap.mode; }
   } catch { setText('saveState','保存内容を読めなかったためデモを表示'); }
 }
 function button(label, className, onclick) { const el = document.createElement('button'); el.type='button'; el.textContent=label; el.className=className; el.addEventListener('click',onclick); return el; }
 function editor() {
   $('start').value=data.start; $('oven').value=data.oven;
   const tbody = $('jobs'); tbody.replaceChildren();
   data.jobs.forEach((job, index) => {
     const tr=document.createElement('tr');
     for(const [field,type] of fields) {
       const td=document.createElement('td'), inp=document.createElement('input');
       inp.dataset.field=field; inp.dataset.index=String(index); inp.type=type; inp.value=job[field];
       inp.setAttribute('aria-label', job.name + ' ' + ({name:'製品名',trays:'天板枚数',prep:'仕込み分',proof:'最低発酵分',proofMax:'発酵上限分',bake:'焼成分',cool:'冷却分',due:'完成期限'}[field]));
       if (type==='number') { inp.min=field==='cool'?'0':'1'; inp.max=field==='trays'?'16':'720'; inp.step=field==='trays'?'1':'5'; }
       if (type==='time') inp.step='300';
       inp.addEventListener('change',()=> { const raw = inp.value; job[field] = type==='number' && raw!=='' ? Number(raw) : raw; calculate(); });
       td.appendChild(inp);tr.appendChild(td);
     }
     const td=document.createElement('td'); td.appendChild(button('×','',()=>{ if(data.jobs.length<=1){notice('最低1つのバッチが必要です');return;} data.jobs.splice(index,1); editor(); calculate(); }));tr.appendChild(td);tbody.appendChild(tr);
   });
   setText('count', `${data.jobs.length} / 30 バッチ`); $('add').disabled=data.jobs.length>=30;
 }
 function notice(message) { $('error').textContent=message; $('error').hidden=false; }
 function download(name,content,type) { const blob=new Blob([content],{type}), url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),800); }
 function calculate() {
   $('error').hidden=true;data.start=$('start').value;data.oven=$('oven').value===''?'':Number($('oven').value);
   try { latest=E.plan(data,$('mode').value); render(latest);store(); }
   catch(e) { latest=null;notice(e.message || '入力値を確認してください');setText('strategy','入力を修正すると再計算します');setText('status','要修正');$('status').classList.add('warn'); $('timeline').replaceChildren(); $('alerts').replaceChildren(); $('whatif').replaceChildren(); ['lateCount','proofCount','ovenTime','finish'].forEach(id=>setText(id,'—')); $('csv').disabled=true; }
 }
 function pill(cls, title, left, width, label) { const el=document.createElement('div');el.className='t-block '+cls;el.style.left=left+'%';el.style.width=Math.max(width,.16)+'%';el.title=title;el.setAttribute('aria-label',title);if(label)el.textContent=label;return el; }
 function render(r) {
   $('csv').disabled=false;
   setText('strategy', `採用方式：${ {due:'完成期限優先',proof:'発酵上限優先',manual:'入力順'}[r.mode] } ／ 仕込み台1つ・天板${r.config.oven}枚`);
   const m=r.metrics,bad=m.unscheduled+m.lateCount+m.overproofCount;
   setText('status',bad?'要確認':'全バッチ割当済み'); $('status').classList.toggle('warn',!!bad);
   setText('lateCount',m.lateCount);setText('proofCount',m.overproofCount);setText('ovenTime',m.ovenMinutes);setText('finish',E.clock(m.end));
   setText('lateText',m.lateMinutes ? `${m.lateMinutes}分超過（計）`:'バッチ');setText('proofText',m.overproofMinutes ? `${m.overproofMinutes}分超過（計）`:'バッチ');
   const base=r.config.start, max=Math.min(1440,Math.max(base+240,...r.rows.map(x=>Math.max(x.due,x.finished||x.prepEnd))));
   const span=max-base, pct=t=>((t-base)/span*100), width=(a,b)=>((b-a)/span*100);
   const timeline=document.createElement('div');timeline.className='timeline';
   const head=document.createElement('div');head.className='t-head';const empty=document.createElement('div');empty.className='t-name';empty.textContent='製品 / 天板';head.appendChild(empty);
   const scale=document.createElement('div');scale.className='t-track';
   const ticks=6;for(let i=0;i<=ticks;i++){const tick=document.createElement('span');tick.className='t-tick';tick.style.left=(i/ticks*100)+'%';tick.textContent=E.clock(Math.round((base+(span*i/ticks))/5)*5);if(i===ticks)tick.style.transform='translateX(-100%)';if(i===0)tick.style.transform='none';scale.appendChild(tick);}head.appendChild(scale);timeline.appendChild(head);
   r.rows.forEach(x=>{
     const row=document.createElement('div');row.className='t-row';
     const name=document.createElement('div');name.className='t-name'; name.textContent=x.name; const sub=document.createElement('small');sub.textContent=`天板${x.trays}枚 · 期限 ${E.clock(x.due)}`;name.appendChild(sub);row.appendChild(name);
     const track=document.createElement('div');track.className='t-track';
     const stages=[['prep',x.prepStart,x.prepEnd,'仕込み'],['proof',x.prepEnd,x.bakeStart??x.ready,'発酵 / 待機'],['bake',x.bakeStart,x.bakeEnd,'焼成'],['cool',x.bakeEnd,x.finished,'冷却']];
     stages.forEach(([kind,a,b,n])=>{if(a===null||b===null||b<=a)return;const end=Math.min(b,max);if(a>=max)return;track.appendChild(pill(kind,`${x.name} — ${n}: ${E.clock(a)}–${E.clock(b)}`,pct(a),width(a,end)));});
     if(x.due>=base&&x.due<=max){const line=document.createElement('div');line.className='t-line';line.style.left=pct(x.due)+'%';line.title='完成期限 '+E.clock(x.due);track.appendChild(line);}
     if(x.unscheduled){const note=document.createElement('span');note.className='t-no';note.textContent='未割当';track.appendChild(note);}
     row.appendChild(track);timeline.appendChild(row);
   });
   $('timeline').replaceChildren(timeline);
   const warnings=[];
   for(const x of r.rows) {
     const issues=[];
     if(x.unscheduled)issues.push('当日中に焼成枠を確保できません');
     if(x.overproof)issues.push(`発酵上限から ${x.overproof}分超過`);
     if(x.late)issues.push(`完成期限から ${x.late}分遅延`);
     if(x.beyondDay)issues.push('冷却終了が翌日になる見込み');
     if(issues.length)warnings.push({name:x.name,detail:issues.join(' / ')});
   }
   setText('alert-count',warnings.length);const alerts=$('alerts');alerts.replaceChildren();
   if(!warnings.length){const el=document.createElement('div');el.className='okmsg';el.textContent='すべてのバッチを期限・発酵窓内に割り当てました。実際の生地状態は現場で確認してください。';alerts.appendChild(el);}
   else warnings.forEach(w=>{const el=document.createElement('div');el.className='alert'; const title=document.createElement('strong');title.textContent=w.name;el.appendChild(title);el.appendChild(document.createTextNode(w.detail));alerts.appendChild(el);});
   const target=$('whatif');target.replaceChildren();
   if(r.config.oven>=16){target.textContent='上限16枚のため比較できません';return;}
   let alternate;
   try{alternate=E.plan({...data,oven:r.config.oven+1},$('mode').value);}catch{target.textContent='比較できません';return;}
   const val=document.createElement('strong');val.className='big';val.textContent=`${alternate.metrics.lateCount} 件`;
   const desc=document.createElement('span');desc.textContent=`現在 ${m.lateCount}件 → ${alternate.metrics.lateCount}件\n発酵超過 ${m.overproofCount} → ${alternate.metrics.overproofCount} 件（参考比較）`;desc.style.whiteSpace='pre-line';target.append(val,desc);
 }
 $('add').addEventListener('click',()=>{if(data.jobs.length>=30)return;const id='j'+Date.now().toString(36)+'_'+(uid++);data.jobs.push({id,name:'新しいパン',trays:1,prep:20,proof:40,proofMax:80,bake:20,cool:15,due:'10:00'});editor();calculate();});
 $('sample').addEventListener('click',()=>{data=E.demo();$('mode').value='auto';editor();calculate();});
 $('recalc').addEventListener('click',calculate);
 ['start','oven','mode'].forEach(id=>$(id).addEventListener('change',calculate));
 $('csv').addEventListener('click',()=>{if(latest)download('kamamichi-plan.csv',E.csv(latest),'text/csv;charset=utf-8');});
 $('json').addEventListener('click',()=>download('kamamichi-settings.json',JSON.stringify({version:1,data,mode:$('mode').value},null,2),'application/json;charset=utf-8'));
 $('import').addEventListener('change',async ev=>{
    const f=ev.target.files?.[0];ev.target.value='';if(!f)return;
    if(f.size>200000){notice('JSONは200KB以内にしてください');return;}
    try {const snap=JSON.parse(await f.text()), parsed=E.normalize(snap.data); const mode=snap.mode||'auto'; E.plan(snap.data,mode);
      data={start:E.clock(parsed.start),oven:parsed.oven,jobs:parsed.jobs.map(j=>({id:j.id,name:j.name,prep:j.prep,proof:j.proof,proofMax:j.proofMax,bake:j.bake,cool:j.cool,trays:j.trays,due:E.clock(j.due)}))};$('mode').value=mode;editor();calculate();
    } catch(e){notice('JSONを読み込めません: '+(e.message||'形式エラー'));}
 });
 $('clear').addEventListener('click',()=>{try{localStorage.removeItem(KEY);setText('saveState','端末上の保存を削除しました（現在の画面は保持）');}catch{setText('saveState','保存削除に失敗しました');}});
 $('print').addEventListener('click',()=>window.print());
 recover();editor();calculate();
})();
