(function(){
'use strict';
const E=window.Hidamari,KEY='hidamari-mado-v1';
const $=id=>document.getElementById(id);
const names={night:'夜',back:'窓の裏側',obstacle:'障害物の影',roof:'庇の影',direct:'直射'};
const fields=['lat','lon','tz','date','facing','depth','clearance','horizon'];
const presets={
  tokyo:{lat:35.6812,lon:139.7671,tz:9,facing:180,depth:0.7,clearance:1.8,horizon:10},
  sapporo:{lat:43.0618,lon:141.3545,tz:9,facing:90,depth:0.4,clearance:1.8,horizon:15},
  osaka:{lat:34.6937,lon:135.5023,tz:9,facing:270,depth:0.9,clearance:1.6,horizon:8}
};
let current=null;
function configFromForm(){const raw={};for(const k of fields)raw[k]=$(k).value;return E.normalize(raw);}
function applyConfig(c){for(const k of fields)$(k).value=c[k];}
function formatHours(min){return (min/60).toFixed(1);}
function safeLoad(){try{const v=JSON.parse(localStorage.getItem(KEY)||'null');return v?E.normalize(v):null;}catch(_){return null;}}
function save(c){try{localStorage.setItem(KEY,JSON.stringify(c));return true;}catch(_){return false;}}
function status(msg,error=false){$('status').textContent=msg;$('status').classList.toggle('error',error);}
function render(c){
  const a=E.analyze(c),y=E.yearly(c);current={a,y};
  $('direct-hours').innerHTML=formatHours(a.counts.direct)+'<span> 時間</span>';
  $('front-hours').textContent=formatHours(a.counts.direct+a.counts.roof+a.counts.obstacle);
  $('roof-hours').textContent=formatHours(a.counts.roof);
  $('obstacle-hours').textContent=formatHours(a.counts.obstacle);
  $('day-label').textContent=c.date;
  $('hero-note').textContent=a.counts.direct ? 'この日は '+a.direct.length+'つの時間帯で直射が見込めます。庇と周囲の遮蔽物を加味した概算です。':'この日は設定条件では直射が見込めません。窓の向きや庇の設定を確認してください。';
  const timeline=$('timeline');timeline.replaceChildren();
  // Merge adjacent sample statuses so the DOM stays compact and keyboard-free.
  let start=0;
  function chunk(from,to,kind){const bar=document.createElement('span');bar.className='segment '+kind;bar.style.flex=String(to-from);bar.title=E.hhmm(from*5)+'–'+E.hhmm((to*5)%1440)+' '+names[kind];timeline.appendChild(bar);}
  for(let i=1;i<=a.samples.length;i++){if(i===a.samples.length||a.samples[i].status!==a.samples[start].status){chunk(start,i,a.samples[start].status);start=i;}}
  timeline.setAttribute('aria-label',c.date+' 直射'+formatHours(a.counts.direct)+'時間、庇の影'+formatHours(a.counts.roof)+'時間、障害物の影'+formatHours(a.counts.obstacle)+'時間');
  const windows=$('windows');windows.replaceChildren();
  if(!a.direct.length){const s=document.createElement('span');s.className='muted';s.textContent='該当する時間帯はありません';windows.appendChild(s);}
  for(const iv of a.direct){const s=document.createElement('span');s.className='window-pill';s.textContent=iv.label;windows.appendChild(s);}
  const max=Math.max(1,...y.map(v=>v.directMinutes));const months=$('months');months.replaceChildren();
  for(const v of y){const wrap=document.createElement('div');wrap.className='month';wrap.setAttribute('aria-label',v.month+'月 '+formatHours(v.directMinutes)+'時間');
    const num=document.createElement('span');num.className='value';num.textContent=formatHours(v.directMinutes)+'h';
    const track=document.createElement('div');track.className='track';const bar=document.createElement('div');bar.className='bar';bar.style.height=(100*v.directMinutes/max).toFixed(1)+'%';track.appendChild(bar);
    const label=document.createElement('span');label.className='month-label';label.textContent=v.month+'月';wrap.append(num,track,label);months.appendChild(wrap);}
  status(save(c)?'計算して、この端末に設定を保存しました。':'計算しました。ブラウザの設定保存は利用できません。');
}
function csvField(v){return '"'+String(v).replaceAll('"','""')+'"';}
function makeCsv(){if(!current)return '';
  const {a,y}=current;
  const rows=[['種類','日付','直射(分)','窓前(分)','庇の影(分)','障害物の影(分)'],['選択日',a.config.date,a.counts.direct,a.counts.direct+a.counts.roof+a.counts.obstacle,a.counts.roof,a.counts.obstacle]];
  for(const r of y)rows.push(['毎月15日',r.date,r.directMinutes,r.frontMinutes,'','']);
  rows.push([],['直射時間帯','開始','終了'],...a.direct.map(x=>['直射',E.hhmm(x.start),E.hhmm(x.end%1440)]));
  return rows.map(row=>row.map(csvField).join(',')).join('\r\n');
}
function download(name,text){const blob=new Blob(['\ufeff'+text],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('settings').addEventListener('submit',event=>{event.preventDefault();try{render(configFromForm());}catch(e){status(e.message,true);}});
for(const button of document.querySelectorAll('[data-preset]'))button.addEventListener('click',()=>{try{applyConfig({...E.DEFAULTS,date:$('date').value,...presets[button.dataset.preset]});render(configFromForm());}catch(e){status(e.message,true);}});
$('csv').addEventListener('click',()=>{if(current){download('hidamari-'+current.a.config.date+'.csv',makeCsv());status('CSVを保存しました。');}});
$('print').addEventListener('click',()=>window.print());
$('reset').addEventListener('click',()=>{try{localStorage.removeItem(KEY);}catch(_){}applyConfig(E.DEFAULTS);render(configFromForm());});
try{applyConfig(safeLoad()||E.DEFAULTS);render(configFromForm());}catch(e){status('初期化に失敗しました: '+e.message,true);}
})();