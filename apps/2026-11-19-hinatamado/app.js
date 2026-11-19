(function(){'use strict';
const E=window.Hinata, $=id=>document.getElementById(id), form=$('configForm');
let last=null, monthData=null;
const storageKey='hinatamado-v1';
const fields=Object.keys(E.DEFAULT);
function setForm(config){const c=E.normalize(config); for(const k of fields){ const el=form.elements.namedItem(k);if(el)el.value=c[k];}render();}
function getForm(){const out={}; for(const k of fields){const el=form.elements.namedItem(k);if(el)out[k]=el.value;}return E.normalize(out);}
function notify(text,err=false){$('notice').textContent=text;$('notice').style.color=err?'#a94e39':'#2a6749';}
function hours(min){return (min/60).toFixed(1)+'h';}
function render(){
 if(!form.checkValidity()){notify('入力値を許容範囲に修正してください。',true);return;}
 const c=getForm();last=E.simulate(c);monthData=E.monthly(c,Number(c.date.slice(0,4)));
 const n=last.mins.near,f=last.mins.far, diff=n-f;
 $('nearHours').textContent=hours(n);$('farHours').textContent=hours(f);$('diffHours').textContent=(diff>0?'+':'')+hours(diff);
 $('nearSub').textContent='10分単位の概算';$('farSub').textContent='10分単位の概算';
 $('diffSub').textContent=diff>0?'Aの方が長い':diff<0?'Bの方が長い':'同じ直射時間';
 $('dayLabel').textContent=c.date+' ｜ 窓の向き '+c.face+'° ｜ 緯度 '+c.lat+'°';
 for(const key of ['near','far']){
  const root=$('timeline'+(key==='near'?'Near':'Far'));root.replaceChildren();
  const fragment=document.createDocumentFragment();
  last.items.forEach(r=>{const cell=document.createElement('span');cell.className='slot '+r[key]+(key==='far'?' far':'');cell.title=E.timeLabel(r.minute)+'–'+E.timeLabel(r.minute+10)+' '+E.REASONS[r[key]]+' / 太陽高度 '+r.altitude.toFixed(1)+'°';fragment.appendChild(cell);});root.appendChild(fragment);
 }
 const w=E.windows(last,'near');$('windows').replaceChildren();
 if(!w.length){const s=document.createElement('span');s.className='mute';s.textContent='この条件では直射の時間帯がありません';$('windows').appendChild(s)}
 else w.forEach(([a,b])=>{const s=document.createElement('span');s.className='window';s.textContent=E.timeLabel(a)+' — '+E.timeLabel(b);$('windows').appendChild(s)});
 renderMonths(monthData);renderReasons(last);
 document.querySelectorAll('[data-city]').forEach(btn=>{
   const p=E.PRESETS[btn.dataset.city];btn.classList.toggle('active',Math.abs(c.lat-p.lat)<.001 && Math.abs(c.lon-p.lon)<.001 && c.tz===p.tz);
 });
}
function renderMonths(data){
 const root=$('months');root.replaceChildren();const max=Math.max(60,...data.flatMap(x=>[x.near,x.far]));
 data.forEach(row=>{
  const col=document.createElement('div');col.className='barcol';col.title=row.month+'月21日　A '+hours(row.near)+' / B '+hours(row.far);
  const pair=document.createElement('div');pair.className='pair';
  for(const [k,cl] of [['near','bar'],['far','bar other']]){const bar=document.createElement('div');bar.className=cl;bar.style.height=(100*row[k]/max).toFixed(1)+'%';pair.appendChild(bar)}
  const lab=document.createElement('small');lab.textContent=row.month+'月';col.append(pair,lab);root.appendChild(col);
 });
 const highest=[...data].sort((a,b)=>b.near-a.near)[0];
 $('trendNote').textContent='鉢Aでは'+highest.month+'月21日が最大（約'+hours(highest.near)+'）。夏至に必ず最大になるとは限りません。庇が高い日射を遮るため、季節による逆転も起こります。';
}
function renderReasons(result){
 const counts=result.counts.near,days=result.items.length-(counts.night||0), root=$('reasons');root.replaceChildren();
 const order=['sun','eave','side','top','wall','back'];
 for(const key of order){const ticks=counts[key]||0;if(!ticks)continue;const row=document.createElement('div');row.className='reason';
  const lab=document.createElement('span');lab.textContent=E.REASONS[key];const track=document.createElement('div');track.className='track';const fill=document.createElement('div');fill.className='fill';if(key==='sun')fill.style.background='#e4ad47';fill.style.width=(100*ticks/Math.max(1,days)).toFixed(1)+'%';track.appendChild(fill);
  const count=document.createElement('strong');count.textContent=hours(ticks*result.step);row.append(lab,track,count);root.appendChild(row);
 }
 const r=order.filter(x=>x!=='sun').sort((a,b)=>(counts[b]||0)-(counts[a]||0))[0];
 const hints={eave:'庇の影響が大きめです。庇を短くする、または鉢を窓に近づけた場合を比較してください。',side:'横方向からの光が窓枠に遮られています。鉢を窓の中央に寄せて試算できます。',top:'上枠による遮りが発生しています。鉢の高さや奥行を下げると変わる場合があります。',wall:'前方の壁が低い太陽を遮っています。壁の高さや距離を実測して入力してください。',back:'窓の方角に太陽が回ってこない時間が長めです。東西・南北の季節差に注目してください。'};
 $('tip').textContent=(counts[r]||0)>0?hints[r]:'この条件では、日中の直射を遮る条件が少なめです。実際の明るさは天候と周囲の建物に左右されます。';
}
function download(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
form.addEventListener('input',()=>{notify('');render()});
form.addEventListener('change',()=>{notify('');render()});
document.querySelectorAll('[data-city]').forEach(b=>b.addEventListener('click',()=>{
 const c={...getForm(),...E.PRESETS[b.dataset.city]};setForm(c);notify('都市の緯度・経度・時差を設定しました。');
}));
document.querySelectorAll('[data-season]').forEach(b=>b.addEventListener('click',()=>{
 const c=getForm();c.date=c.date.slice(0,4)+'-'+b.dataset.season;setForm(c);notify('日付を変更しました。');
}));
$('saveBtn').addEventListener('click',()=>{try{localStorage.setItem(storageKey,JSON.stringify(getForm()));notify('この端末に設定を保存しました。')}catch(err){notify('保存できませんでした。JSON書出をご利用ください。',true)}});
$('exportBtn').addEventListener('click',()=>{download('hinatamado-settings.json',JSON.stringify({app:'hinatamado',version:1,settings:getForm()},null,2),'application/json;charset=utf-8');notify('JSONを書き出しました。')});
$('csvBtn').addEventListener('click',()=>{if(!last)return;download('hinatamado-'+last.date+'.csv',E.csv(last),'text/csv;charset=utf-8');notify('10分刻みのCSVを書き出しました。')});
$('importBtn').addEventListener('click',()=>{$('importFile').value='';$('importFile').click()});
$('importFile').addEventListener('change',async e=>{
 const file=e.target.files[0];if(!file)return;
 if(file.size>100000){notify('JSONは100KB以下にしてください。',true);return;}
 try{const text=await file.text();const parsed=JSON.parse(text);if(parsed.app!=='hinatamado'||parsed.version!==1||!parsed.settings||typeof parsed.settings!=='object')throw new Error('形式が違います');setForm(parsed.settings);notify('JSONから設定を読み込みました。')}catch(err){notify('読み込めません: '+err.message,true)}
});
$('printBtn').addEventListener('click',()=>window.print());
$('resetBtn').addEventListener('click',()=>{setForm(E.DEFAULT);notify('サンプル設定に戻しました。')});
let stored=null;try{const s=localStorage.getItem(storageKey);if(s){const p=JSON.parse(s);if(p && typeof p==='object')stored=p}}catch(err){}
setForm(stored||E.DEFAULT);
})();