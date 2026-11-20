(function () {
  'use strict';
  const E=window.RetsuEngine, KEY='retsu-sabaki-v1';
  const $=id=>document.getElementById(id);
  const cellLabels=['来場者数','平均待ち時間','90%以内の待ち時間','15分超の割合','最大待機列（90%点）','収容上限超過の試行','終了時未処理人数','終了後の対応時間','合計スタッフ時間'];
  let config=E.defaults(), latest=null;
  try {const loaded=localStorage.getItem(KEY);if(loaded) config=E.normalize(JSON.parse(loaded));}catch(e){}
  function atTime(min) {const [h,m]=config.start.split(':').map(Number);return String(Math.floor((h*60+m+min)/60)%24).padStart(2,'0')+':'+String((m+min)%60).padStart(2,'0');}
  function drawForm(){
    for (const k of ['title','start','minutes','variation','surge','capacity','runs','seed']) $(k).value=config[k];
    $('slots').innerHTML=Array.from({length:E.SLOTS},(_,i)=>`<tr><td>${atTime(i*30)}–<br>${atTime((i+1)*30)}</td><td><input aria-label="${i+1}枠目の予想来場者数" type="number" min="0" max="150" data-kind="arrivals" data-i="${i}" value="${config.arrivals[i]}"></td><td><input aria-label="${i+1}枠目の現在の窓口人数" type="number" min="1" max="8" data-kind="base" data-i="${i}" value="${config.base[i]}"></td><td><input aria-label="${i+1}枠目の改善案窓口人数" type="number" min="1" max="8" data-kind="plan" class="plan-input" data-i="${i}" value="${config.plan[i]}"></td></tr>`).join('');
  }
  function readForm(){
    const x={};
    for(const k of ['title','start','minutes','variation','surge','capacity','runs','seed'])x[k]=$(k).value;
    for(const k of ['arrivals','base','plan'])x[k]=Array.from({length:E.SLOTS},(_,i)=>document.querySelector(`[data-kind="${k}"][data-i="${i}"]`).value);
    config=E.normalize(x); drawForm();
    try{localStorage.setItem(KEY,JSON.stringify(config));}catch(e){$('hint').textContent='ローカル保存が無効です。設定JSONで保存してください。';}
  }
  function metric(n, suffix=''){return Number(n).toLocaleString('ja-JP',{maximumFractionDigits:1})+suffix;}
  function linePoints(data,maxValue,w,h,left,top){return data.map((v,i)=>`${(left+i/(data.length-1)*(w-left-12)).toFixed(1)},${(h-30-(v/maxValue)*(h-top-30)).toFixed(1)}`).join(' ');}
  function svgChart(a,b,capacity){
    const w=660,h=250,left=41,top=18,bottom=30;
    const max=Math.max(5,capacity, ...a,...b); const y=v=>h-bottom-v/max*(h-top-bottom);
    const levels=[0,.25,.5,.75,1];
    let svg=`<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`;
    for(const v of levels){const yy=y(max*v);svg+=`<line x1="${left}" y1="${yy}" x2="${w-12}" y2="${yy}" stroke="#e3eae5" stroke-width="1"/><text x="${left-7}" y="${yy+4}" text-anchor="end" font-size="11" fill="#93a59a">${Math.round(max*v)}</text>`;}
    for(let i=0;i<=3;i++){const x=left+(w-left-12)*i/3;svg+=`<text x="${x}" y="${h-9}" text-anchor="middle" font-size="11" fill="#93a59a">${atTime(i*60)}</text>`;}
    svg+=`<line x1="${left}" y1="${y(capacity)}" x2="${w-12}" y2="${y(capacity)}" stroke="#c5aa87" stroke-dasharray="5 5" stroke-width="2"/>`;
    svg+=`<polyline points="${linePoints(a,max,w,h,left,top)}" fill="none" stroke="#ed8c65" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    svg+=`<polyline points="${linePoints(b,max,w,h,left,top)}" fill="none" stroke="#217c74" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    return svg+'</svg>';
  }
  function refresh(){
    const r=E.compare(config);latest=r;
    const a=r.baseline,b=r.proposal;
    $('p90-base').textContent=metric(a.p90);$('p90-plan').textContent=metric(b.p90);
    const delta=r.savedWait;
    $('delta').textContent=(delta>0?'改善案では90%待ち時間が '+metric(delta)+'分短縮':delta<0?'改善案では90%待ち時間が '+metric(-delta)+'分増加':'90%待ち時間は変化なし')+'（'+config.runs+'回試行の概算）';
    $('mean').textContent=metric(a.mean)+' → '+metric(b.mean)+'分';
    $('over').textContent=metric(a.over15)+' → '+metric(b.over15)+'%';
    $('risk').textContent=metric(a.overflow)+' → '+metric(b.overflow)+'%';
    $('hours').textContent=(r.extraHours>0?'+':'')+metric(r.extraHours)+'人時';
    $('runTag').textContent=config.runs+'試行・同じ乱数で比較';
    $('chart').innerHTML=svgChart(a.trace,b.trace,config.capacity);
    const row=(key,fn)=>`<tr><td>${key}</td><td>${fn(a)}</td><td>${fn(b)}</td></tr>`;
    $('comparison').innerHTML=[
      row(cellLabels[0],v=>metric(v.visitors)+'人'), row(cellLabels[1],v=>metric(v.mean)+'分'),
      row(cellLabels[2],v=>metric(v.p90)+'分'), row(cellLabels[3],v=>metric(v.over15)+'%'),
      row(cellLabels[4],v=>metric(v.peakP90)+'人'), row(cellLabels[5],v=>metric(v.overflow)+'%'),
      row(cellLabels[6],v=>metric(v.closing)+'人'), row(cellLabels[7],v=>metric(v.overtime)+'分'),
      row(cellLabels[8],v=>metric(v.personHours)+'人時')].join('');
    const notices=[];
    if (b.overflow>0) notices.push(`改善案でも${metric(b.overflow)}%の試行で待機列が上限${config.capacity}人を超えます。`);
    if (b.closing>0.1) notices.push(`閉場時点で平均${metric(b.closing)}人が未処理です。最終時間帯の配置を見直してください。`);
    if (b.over15>10) notices.push('15分超の待ちが多い可能性があります。受付数や所要時間も見直してください。');
    if (!notices.length) notices.push('入力した仮定では改善案に大きな警告はありません。ただし実会場の安全を保証するものではありません。');
    $('warning').textContent=notices.join(' ');$('warning').className='warning'+(notices.length===1&&b.overflow===0&&b.closing<=.1&&b.over15<=10?' safe':'');
    $('hint').textContent='最終比較を更新しました。入力はこの端末内にのみ保存されます。';$('hint').className='hint';
  }
  function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);}
  function csv(v){const s=String(v);return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
  function exportCSV(){if(!latest)refresh();const {baseline:a,proposal:b}=latest;
    const rows=[['指標','現在','改善案'],['来場者数',a.visitors,b.visitors],['平均待ち時間（分）',a.mean,b.mean],['90%待ち時間（分）',a.p90,b.p90],['15分超（%）',a.over15,b.over15],['行列あふれ（%）',a.overflow,b.overflow],['閉場時未処理（人）',a.closing,b.closing],['追加対応（分）',a.overtime,b.overtime],['人時',a.personHours,b.personHours],[],['時間','現在の行列平均','改善案の行列平均']];
    a.trace.forEach((v,i)=>rows.push([atTime(i*10),v,b.trace[i]]));
    download('retsu-sabaki-results.csv','\ufeff'+rows.map(r=>r.map(csv).join(',')).join('\r\n'),'text/csv;charset=utf-8');
  }
  document.addEventListener('change',e=>{if(e.target.matches('input,select') && e.target.id!=='importJSON'){$('runTag').textContent='未反映の変更あり';$('hint').textContent='設定を変えました。「この条件で比較する」で結果を更新してください。';$('hint').className='hint warn';}});
  $('calculate').addEventListener('click',()=>{readForm();refresh();});
  $('suggest').addEventListener('click',()=>{readForm();const choice=E.suggest(config);if(choice){config.plan=choice.staff;drawForm();try{localStorage.setItem(KEY,JSON.stringify(config));}catch(e){}refresh();$('hint').textContent=`${atTime(choice.slot*30)}〜の窓口を1名増やす案を設定しました。これは局所探索で、最適配置の保証はありません。`;}else {$('hint').textContent='1枠に1名追加する範囲では、今回の評価指標を改善できませんでした。';$('hint').className='hint warn';}});
  $('reset').addEventListener('click',()=>{config=E.defaults();drawForm();try{localStorage.removeItem(KEY);}catch(e){}refresh();});
  $('exportCSV').addEventListener('click',exportCSV);
  $('exportJSON').addEventListener('click',()=>{readForm();download('retsu-sabaki-settings.json',JSON.stringify({app:'RETSU SABAKI',version:1,config},null,2),'application/json;charset=utf-8');});
  $('importJSON').addEventListener('change',async(e)=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>200000)throw new Error('サイズ上限は200KBです。');const j=JSON.parse(await f.text());const obj=j.config||j;if(!obj || !Array.isArray(obj.arrivals) || !Array.isArray(obj.base)|| !Array.isArray(obj.plan))throw new Error('設定の形式が正しくありません。');config=E.normalize(obj);drawForm();try{localStorage.setItem(KEY,JSON.stringify(config));}catch(err){}refresh();$('hint').textContent='設定を読み込みました。';}catch(err){$('hint').textContent='読み込み失敗: '+err.message;$('hint').className='hint warn';}e.target.value='';});
  $('print').addEventListener('click',()=>window.print());
  drawForm();refresh();
})();