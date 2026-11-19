/* HIBIKISA browser UI. No requests or external storage. */
(() => {
  'use strict';
  const E = window.Hibikisa;
  const KEY = 'hibikisa-room-v1';
  const ids = ['length','width','height','wall','floor','ceiling','panel','panelArea','target','method'];
  const el = id => document.getElementById(id);
  let current = null;
  const fields = Object.fromEntries(ids.map(id=>[id,el(id)]));
  function setStatus(msg){el('status').textContent=msg;}
  function materialOptions(select, selected) {
    select.innerHTML='';
    for(const [id,m] of Object.entries(E.MATERIALS)){
      const option=document.createElement('option');option.value=id;option.textContent=m.name;
      select.appendChild(option);
    }
    select.value=selected;
  }
  function fill(conf){
    for(const id of ids){ if(id==='wall'||id==='floor'||id==='ceiling'||id==='panel')materialOptions(fields[id],conf[id]); else fields[id].value=conf[id]; }
    document.querySelectorAll('input[name=focus]').forEach(r=>r.checked=r.value===conf.focus);
    syncRange();
  }
  function read(){
    const c={};
    for(const id of ids){c[id]=['wall','floor','ceiling','panel','method'].includes(id)?fields[id].value:fields[id].value===''?'':Number(fields[id].value)}
    c.focus=document.querySelector('input[name=focus]:checked')?.value || 'speech';
    return c;
  }
  function syncRange(){
    const dims=Number(fields.length.value), w=Number(fields.width.value), h=Number(fields.height.value);
    const maximum=Number.isFinite(dims*w*h)?Math.max(0,2*(dims+w)*h):0;
    el('panelAreaRange').max=maximum.toFixed(2);
    const area=Number(fields.panelArea.value)||0;
    el('panelAreaRange').value=Math.min(maximum,Math.max(0,area));
    el('panelAreaLabel').textContent=area.toFixed(2)+' m²';
    el('coverage').textContent=maximum>0?(area/maximum*100).toFixed(1)+'%':'—';
  }
  function text(id,value){el(id).textContent=value;}
  function displayError(err){
    const box=el('error');box.textContent=err.message||String(err);box.hidden=false;
    el('autoArea').disabled=true;
    text('suggestion','入力内容を修正すると再計算します。');
    for(const k of ['avgBase','avgAfter','change'])text(k,'—');
    for(const k of ['stateBase','stateAfter'])text(k,'未計算');
    el('rtChart').innerHTML='';el('readings').replaceChildren();
    el('insight').querySelector('p').textContent='入力値を確認してください。';
  }
  function svgChart(r){
    const W=760,L=85,R=25,top=57,step=44,span=W-L-R;
    const finite=[...r.base,...r.after,r.config.target].filter(Number.isFinite);
    const max=Math.max(0.65,...finite)*1.10;
    const rounded=Math.max(.2,Math.ceil(max*2)/2);
    const x=v=>L+Math.min(v,rounded)*span/rounded;
    let s=`<title id="chart-title">周波数別の残響予測</title><desc id="chart-desc">薄いバーは現在、緑のバーは処理後。縦の点線は設定目標です。</desc>`;
    for(let j=0;j<=4;j++){
      const value=rounded*j/4;const xx=x(value);
      s+=`<line x1="${xx.toFixed(1)}" y1="24" x2="${xx.toFixed(1)}" y2="316" stroke="#e5eeeb" stroke-width="1"/>`;
      s+=`<text x="${xx.toFixed(1)}" y="18" text-anchor="middle" fill="#81928e" font-size="12">${value.toFixed(1)}s</text>`;
    }
    const tx=x(r.config.target);
    r.bands.forEach((band,i)=>{
      const y=top+i*step;const isFocus=r.focusBands.includes(i);
      if(isFocus)s+=`<rect x="2" y="${y-10}" width="756" height="${step-2}" rx="7" fill="#f0f7f4"/>`;
      s+=`<text x="70" y="${y+13}" text-anchor="end" font-size="14" font-weight="${isFocus?700:500}" fill="${isFocus?'#315a56':'#9caeaa'}">${band} Hz</text>`;
      for(const [v,yy,color] of [[r.base[i],y-4,'#b6cac4'],[r.after[i],y+12,'#118879']]){
        const width=Math.max(0,x(v)-L);
        s+=`<rect x="${L}" y="${yy}" width="${width.toFixed(1)}" height="11" rx="3" fill="${color}" opacity="${isFocus?1:.55}"/>`;
      }
      s+=`<text x="${W-8}" y="${y+9}" font-size="11" text-anchor="end" fill="#5f7772">${r.after[i].toFixed(2)}s</text>`;
    });
    s+=`<line x1="${tx.toFixed(1)}" y1="26" x2="${tx.toFixed(1)}" y2="320" stroke="#b15e42" stroke-width="2" stroke-dasharray="5 4"/>`;
    s+=`<text x="${W-10}" y="347" text-anchor="end" fill="#8c9c98" font-size="11">参考計算 / 周波数 [Hz]</text>`;
    return s;
  }
  function render(){
    syncRange();
    let r;
    try{r=E.report(read())}catch(e){current=null;displayError(e);return;}
    current=r;el('error').hidden=true;
    const {geo,config:c}=r;
    text('volume',geo.volume.toFixed(1)+' m³');
    text('wall-surface','壁面積 '+geo.walls.toFixed(1)+' m²');
    text('avgBase',r.avgBase.toFixed(2)+' 秒');
    text('avgAfter',r.avgAfter.toFixed(2)+' 秒');
    text('change',(r.avgBase-r.avgAfter>=0?'-':'+')+Math.abs(r.avgBase-r.avgAfter).toFixed(2)+' 秒');
    text('stateBase',r.passBefore?'目標内':'目標超過の帯域あり');
    text('stateAfter',r.passAfter?'対象帯域すべて目標内':'目標超過の帯域あり');
    text('suggestion',r.suggestion.feasible?
      r.suggestion.area===0?'必要面積：0 m²。'+r.suggestion.reason:
      '理論上 '+r.suggestion.area.toFixed(2)+' m²（約'+(100*r.suggestion.area/geo.walls).toFixed(1)+'%）で目標に届きます。制約帯域：'+r.suggestion.limiting+' Hz。':r.suggestion.reason);
    el('autoArea').disabled=!r.suggestion.feasible;
    el('rtChart').innerHTML=svgChart(r);
    el('readings').replaceChildren();
    r.bands.forEach((band,i)=>{
      const tr=document.createElement('tr');
      if(!r.focusBands.includes(i))tr.className='subband';
      for(const item of [band+' Hz',r.base[i].toFixed(2)+' s',r.after[i].toFixed(2)+' s',(r.after[i]-r.base[i]>=0?'+':'')+(r.after[i]-r.base[i]).toFixed(2)+' s']){
        const td=document.createElement('td');td.textContent=item;tr.appendChild(td);
      }
      el('readings').appendChild(tr);
    });
    const panelName=E.MATERIALS[c.panel].name.replace('（参考）','');
    const advice = r.passBefore ? '現在の条件でも評価対象の帯域は目標内です。追加パネルは必須ではありません。':
      r.passAfter ? '評価対象の帯域で目標以下の推算です。採用前に試し置きと残響測定を行ってください。':
      '評価対象に目標超過が残っています。'+(r.suggestion.feasible?'理論上の必要面積を反映して再比較できます。':'この素材だけでは目標到達が難しい可能性があります。');
    el('insight').querySelector('p').textContent=advice+' B案は「'+panelName+'」を壁'+c.panelArea.toFixed(2)+'m²に施工する想定です。';
    try {localStorage.setItem(KEY,JSON.stringify(c));}catch(_){/* local file / private mode may disallow storage */}
  }
  function blobDownload(filename,body,mime){
    const url=URL.createObjectURL(new Blob([body],{type:mime}));
    const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),500);
    setStatus(filename+' を作成しました。');
  }
  function onAction(id,fn){el(id).addEventListener('click',()=>{try{fn()}catch(e){setStatus('処理できませんでした：'+e.message)}})}
  function init(){
    let config={...E.DEFAULT};
    try {const item=localStorage.getItem(KEY);if(item)config=E.validate(JSON.parse(item))}catch(_){config={...E.DEFAULT}}
    fill(config);
    for(const id of ids){fields[id].addEventListener('input',render);fields[id].addEventListener('change',render)}
    document.querySelectorAll('input[name=focus]').forEach(input=>input.addEventListener('change',render));
    el('panelAreaRange').addEventListener('input',()=>{fields.panelArea.value=el('panelAreaRange').value;render()});
    onAction('autoArea',()=>{
      if(!current||!current.suggestion.feasible)return;
      const recommended=current.suggestion.area;
      const value=Math.min(current.geo.walls,Math.ceil((recommended-1e-10)*100)/100);
      fields.panelArea.value=value.toFixed(2);
      render();setStatus('必要面積をB案に反映しました。');
    });
    onAction('csvBtn',()=>{if(current)blobDownload('hibikisa-rt60.csv',E.asCSV(current),'text/csv;charset=utf-8')});
    onAction('svgBtn',()=>{if(!current)return;
      const svg=el('rtChart').cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width','760');svg.setAttribute('height','354');
      blobDownload('hibikisa-rt60.svg',new XMLSerializer().serializeToString(svg),'image/svg+xml;charset=utf-8');
    });
    onAction('jsonBtn',()=>{if(current)blobDownload('hibikisa-room.json',JSON.stringify({version:1,app:'HIBIKISA',config:current.config},null,2),'application/json;charset=utf-8')});
    onAction('importBtn',()=>el('importFile').click());
    el('importFile').addEventListener('change',async ev=>{
      const file=ev.target.files?.[0];if(!file)return;
      try{
        if(file.size>100_000)throw new Error('JSONが大きすぎます（最大100KB）。');
        const content=JSON.parse(await file.text());
        if(content.version!==1||content.app!=='HIBIKISA')throw new Error('対応するHIBIKISA設定ではありません。');
        const c=E.validate(content.config);fill(c);render();setStatus('設定を読み込みました。');
      }catch(e){setStatus('読込失敗：'+e.message)}finally{ev.target.value=''}
    });
    onAction('printBtn',()=>window.print());
    onAction('resetBtn',()=>{fill(E.DEFAULT);render();setStatus('初期設定に戻しました。')});
    render();
  }
  document.addEventListener('DOMContentLoaded',init);
})();
