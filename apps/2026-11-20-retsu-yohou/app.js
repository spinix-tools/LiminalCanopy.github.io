/* 列予報 — fully local browser controller, no network calls */
(() => {
  'use strict';
  const E=window.RetsuEngine;
  const $=id=>document.getElementById(id);
  const KEY='retsu-yohou-v1';
  let state;
  try { state=E.normalize(JSON.parse(localStorage.getItem(KEY))); }
  catch (_) { state=E.normalize(E.DEFAULT); }
  let resultA, resultB;
  const fmt=(v,d=0)=>v==null?'—':Number(v).toLocaleString('ja-JP',{maximumFractionDigits:d});
  const hours=v=>`${fmt(v/60,1)} 人時`;
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch(_){} };
  const refreshInputs=()=>{
    $('titleInput').value=state.title;
    $('startInput').value=state.start;
    $('serviceInput').value=state.serviceMinutes;
    $('targetInput').value=state.targetWait;
  };
  function note(message){$('planNotice').textContent=message;$('planNotice').hidden=!message;}
  function renderTable(){
    const tbody=$('slotRows');tbody.replaceChildren();
    const max=Math.max(1,...state.slots.map(s=>s.arrivals));
    state.slots.forEach((slot,i)=>{
      const tr=document.createElement('tr');
      const time=document.createElement('td');time.className='slot-time';
      time.textContent=E.hhmm(state.start,i*15)+' – '+E.hhmm(state.start,(i+1)*15);
      tr.append(time);
      for(const [key,label] of [['arrivals','来場者'],['a','配置A'],['b','配置B']]){
        const td=document.createElement('td');
        const input=document.createElement('input');
        input.type='number';input.min='0';input.max=key==='arrivals'?'500':'12';
        input.step='1';input.value=slot[key];
        input.dataset.slot=String(i);input.dataset.field=key;
        input.setAttribute('aria-label',`${E.hhmm(state.start,i*15)} ${label}`);
        input.addEventListener('change',()=>{
          const normalized=E.normalize({...state,slots:state.slots.map((r,j)=>j===i?{...r,[key]:input.value}:r)});
          state=normalized;input.value=state.slots[i][key];
          if(key==='arrivals'){
            const bar=tr.querySelector('.bar');
            bar.style.width=`${Math.max(0,state.slots[i].arrivals/max*100)}%`;
          }
          note('');recalculate();
        });
        td.append(input);tr.append(td);
      }
      const barCell=document.createElement('td');
      const track=document.createElement('div');track.className='bar-track';
      const bar=document.createElement('div');bar.className='bar';
      bar.style.width=`${slot.arrivals/max*100}%`;
      track.append(bar);barCell.append(track);tr.append(barCell);
      tbody.append(tr);
    });
  }
  const metric=(side,r)=>{
    $('p95'+side).textContent=fmt(r.p95);
    $('peak'+side).textContent=fmt(r.peakQueue)+' 人';
    $('left'+side).textContent=fmt(r.unfinished)+' 人';
    $('hours'+side).textContent=hours(r.staffMinutes);
  };
  function chart(a,b){
    const n=state.slots.length,W=960,H=230,L=45,R=18,T=16,B=40;
    const w=W-L-R,h=H-T-B;
    const max=Math.max(5,...a.line.map(x=>x.queue),...b.line.map(x=>x.queue));
    const ymax=Math.ceil(max/5)*5;
    const x=i=>L+(n===1?w/2:i*w/(n-1));
    const y=v=>T+h-v/ymax*h;
    const e=[];
    e.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" aria-hidden="true" preserveAspectRatio="none">`);
    for(let k=0;k<=4;k++){
      const val=ymax*k/4,yy=y(val);
      e.push(`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#2d4c5b" stroke-dasharray="4 6"/>`);
      e.push(`<text x="${L-9}" y="${yy+4}" fill="#9cb5bf" text-anchor="end" font-size="12">${fmt(val)}</text>`);
    }
    for(let i=0;i<n;i++)if(i===0||i===n-1||i%2===0){
      e.push(`<text x="${x(i)}" y="${H-11}" font-size="11" fill="#9cb5bf" text-anchor="middle">${E.hhmm(state.start,(i+1)*15)}</text>`);
    }
    for (const [r,color,dash] of [[a,'#f8c47d',''],[b,'#9eead6','7 6']]){
      const points=r.line.map((v,i)=>`${x(i).toFixed(2)},${y(v.queue).toFixed(2)}`).join(' ');
      e.push(`<polyline points="${points}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" ${dash?`stroke-dasharray="${dash}"`:''}/>`);
      r.line.forEach((v,i)=>{
        if(i%2===0||i===n-1)e.push(`<circle cx="${x(i)}" cy="${y(v.queue)}" r="3.5" fill="${color}" stroke="#112d3a" stroke-width="2"/>`);
      });
    }
    e.push('</svg>');$('queueChart').innerHTML=e.join('');
    $('queueChart').setAttribute('aria-label',`待機人数の推移。A最大${a.peakQueue}人、B最大${b.peakQueue}人。`);
  }
  function recalculate(){
    resultA=E.simulate(state,'a');resultB=E.simulate(state,'b');
    const total=state.slots.reduce((v,x)=>v+x.arrivals,0);
    $('totalArrivals').textContent=`合計来場：${fmt(total)} 人`;
    $('totalA').textContent=`A：${hours(resultA.staffMinutes)}`;
    $('totalB').textContent=`B：${hours(resultB.staffMinutes)}`;
    metric('A',resultA);metric('B',resultB);chart(resultA,resultB);
    let diff=(resultA.p95!=null&&resultB.p95!=null)?resultA.p95-resultB.p95:null;
    let message=diff==null?'未処理者がいる場合、P95だけで配置の良し悪しを判断しないでください。':
      diff>0?`比較案BではP95が ${fmt(diff)}分短縮。追加配置は ${hours(resultB.staffMinutes-resultA.staffMinutes)} です。`:
      diff===0?'2案のP95は同じです。必要な延べ人数と未処理人数も比較してください。':`比較案BのP95は ${fmt(-diff)}分長くなっています。配置を見直してください。`;
    $('comparison').textContent=message;
    const warnings=[];
    for(const [label,r] of [['A',resultA],['B',resultB]]){
      if(r.unfinished>0)warnings.push(`<div class="warn">計画${label}：${fmt(r.unfinished)}人がシミュレーション終了時点でも未処理です。表示のP95は受付完了者に限られ、実態より楽観的になり得ます。</div>`);
      else if(r.overtimeMinutes>0)warnings.push(`<div class="warn">計画${label}：受付終了時刻を ${fmt(r.overtimeMinutes)}分超えて処理が続く想定です。終了後は最終枠の人数を維持すると仮定しています。</div>`);
    }
    if(total===0)warnings.push('<div class="warn">来場者が0人です。待ち時間は算出されません。</div>');
    if(!warnings.length)warnings.push('<div class="ok">2案とも未処理者なし。ただし予報は計画値による概算で、現場の安全判断には使えません。</div>');
    $('warnings').innerHTML=warnings.join('');save();
  }
  function fromForm(){
    state=E.normalize({...state,title:$('titleInput').value,start:$('startInput').value,
      serviceMinutes:$('serviceInput').value,targetWait:$('targetInput').value});
    refreshInputs();renderTable();note('');recalculate();
  }
  ['titleInput','startInput','serviceInput','targetInput'].forEach(id=>$(id).addEventListener('change',fromForm));
  $('copyBtn').addEventListener('click',()=>{state.slots.forEach(r=>r.b=r.a);renderTable();note('配置Aを比較案Bへコピーしました。');recalculate();});
  $('suggestBtn').addEventListener('click',()=>{
    const button=$('suggestBtn');button.disabled=true;
    try{
      const p=E.propose(state);
      p.slots.forEach((staff,i)=>state.slots[i].b=staff);
      renderTable();recalculate();
      note(p.reached?`Bに${p.steps}枠分の増員を提案しました。目標P95 ${state.targetWait}分以内（概算）を達成しています。`:
        `Bに${p.steps}枠分の増員を提案しましたが、目標P95 ${state.targetWait}分には届いていません。到着と処理の仮定、追加スタッフの上限を確認してください。`);
    } catch(err) {note('増員案を作れませんでした: '+err.message);}
    finally{button.disabled=false;}
  });
  $('resetBtn').addEventListener('click',()=>{
    if(!window.confirm('編集中の計画をサンプルで置き換えますか？'))return;
    state=E.normalize(E.DEFAULT);refreshInputs();renderTable();note('サンプルに戻しました。');recalculate();
  });
  const download=(filename,body,type)=>{
    const url=URL.createObjectURL(new Blob([body],{type}));
    const link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  };
  $('downloadJson').addEventListener('click',()=>download('retsu-yohou-plan.json',JSON.stringify(state,null,2),'application/json;charset=utf-8'));
  $('downloadCsv').addEventListener('click',()=>download('retsu-yohou-comparison.csv',E.csv(state,resultA,resultB),'text/csv;charset=utf-8'));
  $('importBtn').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try{if(file.size>1024*1024)throw new Error('ファイルが1MBを超えています');
      state=E.normalize(JSON.parse(await file.text()));
      refreshInputs();renderTable();recalculate();note('JSONから設定を復元しました。');
    }catch(err){note('JSON読み込みに失敗しました: '+err.message);}
    e.target.value='';
  });
  $('printBtn').addEventListener('click',()=>window.print());
  refreshInputs();renderTable();recalculate();
})();