(function(){
'use strict';
const E=window.TempoEngine, $=id=>document.getElementById(id);
let plan=E.preset('climb'), timeline=E.buildTimeline(plan), playing=false, audio=null, tickTimer=null, frameId=null, origin=0, nextIndex=0, taps=[];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function inform(msg,error=false){$('notice').textContent=msg;$('notice').style.color=error?'var(--red)':'var(--mint)';}
function download(name,type,content){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
function dots(beats,active){const el=$('dots');if(el.children.length!==beats){el.replaceChildren();for(let i=0;i<beats;i++){const d=document.createElement('i');d.className='dot'+(i===0?' first':'');el.append(d);}}Array.from(el.children).forEach((d,i)=>d.classList.toggle('lit',i===active));}
function stop(done=false){
 if(tickTimer!==null){clearInterval(tickTimer);tickTimer=null;}
 if(frameId!==null){cancelAnimationFrame(frameId);frameId=null;}
 if(audio){audio.close().catch(()=>{});audio=null;}
 playing=false;$('play').textContent='▶ 再生';$('state').textContent=done?'完了':'待機中';
 if(done){$('stage').textContent='練習完了！';$('progress').style.width='100%';$('elapsed').textContent=`${E.formatDuration(timeline.totalSeconds)} / ${E.formatDuration(timeline.totalSeconds)}`;}
 else {$('stage').textContent='準備OK';$('progress').style.width='0%';$('elapsed').textContent=`0:00 / ${E.formatDuration(timeline.totalSeconds)}`;$('bar').textContent='—';dots(timeline.plan.segments[0].beats,-1);$('bpm').textContent=timeline.plan.segments[0].start;}
}
function renderBlocks(){
 $('blocks').innerHTML=plan.segments.map((s,i)=>`<div class="block" data-index="${i}"><div class="block-head"><div class="block-heading"><span class="block-index">${String(i+1).padStart(2,'0')}</span><input aria-label="ブロック${i+1}の名前" data-key="name" maxlength="40" value="${esc(s.name)}"></div><div class="toolbar"><button class="small icon-button" data-action="up" aria-label="${i+1}を上へ" ${i===0?'disabled':''}>↑</button><button class="small icon-button" data-action="down" aria-label="${i+1}を下へ" ${i===plan.segments.length-1?'disabled':''}>↓</button><button class="small icon-button danger" data-action="remove" aria-label="${i+1}を削除" ${plan.segments.length===1?'disabled':''}>×</button></div></div><div class="block-grid">
 <label class="field">開始BPM<input data-key="start" type="number" min="30" max="260" step="1" value="${s.start}"></label>
 <label class="field">終了BPM<input data-key="end" type="number" min="30" max="260" step="1" value="${s.end}"></label>
 <label class="field">小節数<input data-key="bars" type="number" min="1" max="48" step="1" value="${s.bars}"></label>
 <label class="field">拍子（拍/小節）<input data-key="beats" type="number" min="2" max="12" step="1" value="${s.beats}"></label>
 <label class="field">拍の分割<select data-key="sub">${[1,2,3,4].map(n=>`<option value="${n}" ${n===s.sub?'selected':''}>${['','4分','8分','3連','16分'][n]}</option>`).join('')}</select></label>
 <label class="field">種類<select data-key="mode"><option value="play" ${s.mode==='play'?'selected':''}>クリックあり</option><option value="rest" ${s.mode==='rest'?'selected':''}>無音休憩</option></select></label>
 </div></div>`).join('');
}
function chart(){
 const arr=timeline.bars,svg=$('chart'),max=Math.max(120,...arr.map(x=>x.bpm)),min=Math.min(40,...arr.map(x=>x.bpm));
 const X=i=>36+i/Math.max(1,arr.length)*374,Y=v=>139-(v-min)/(max-min)*107;
 let out='';for(let i=0;i<4;i++){const y=139-107*i/3,v=min+(max-min)*i/3;out+=`<line x1="36" x2="413" y1="${y}" y2="${y}" stroke="#3a5268" stroke-dasharray="3 5"/><text x="3" y="${y+4}" fill="#a9bbca" font-size="11">${Math.round(v)}</text>`;}
 for(let i=0;i<arr.length;i++){const b=arr[i],x=X(i),w=Math.max(.8,374/arr.length-1),y=Y(b.bpm);out+=`<rect x="${x}" y="${y}" width="${w}" height="${139-y}" fill="${b.mode==='rest'?'#ffb16b':'#70e2b5'}" rx="1"><title>${esc(plan.segments[b.segment].name)} 小節${b.bar+1}：${b.bpm} BPM</title></rect>`;}
 out+='<text x="36" y="159" fill="#a9bbca" font-size="11">1</text><text x="380" y="159" fill="#a9bbca" font-size="11">'+arr.length+' 小節</text>';svg.innerHTML=out;
}
function refresh(){
 try{timeline=E.buildTimeline(plan);$('total').textContent=E.formatDuration(timeline.totalSeconds);$('barCount').textContent=timeline.totalBars;$('blockCount').textContent=plan.segments.length;chart();if(!playing){$('bpm').textContent=plan.segments[0].start;$('elapsed').textContent=`0:00 / ${E.formatDuration(timeline.totalSeconds)}`;dots(plan.segments[0].beats,-1);}inform('');return true;}
 catch(err){inform(err.message,true);return false;}
}
function setPlan(value){stop();plan=E.validatePlan(value);$('planName').value=plan.name;$('countIn').checked=plan.countIn;renderBlocks();refresh();}
function synth(ev,when){
 if(ev.muted||!audio||Number($('volume').value)===0)return;
 const accent=ev.kind==='count'?(ev.beat===0):ev.accent;
 const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.setValueAtTime(accent?1280:ev.subbeat?660:880,when);
 const loud=Number($('volume').value)/100;
 gain.gain.setValueAtTime(.0001,when);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,loud*(accent?.31:ev.subbeat?.11:.19)),when+.006);gain.gain.exponentialRampToValueAtTime(.0001,when+.047);
 osc.connect(gain);gain.connect(audio.destination);osc.start(when);osc.stop(when+.053);
}
function schedule(){if(!playing||!audio)return;const now=audio.currentTime;while(nextIndex<timeline.events.length&&origin+timeline.events[nextIndex].t<now+.17){const ev=timeline.events[nextIndex++];const when=origin+ev.t;if(when>now-.025)synth(ev,Math.max(now+.002,when));}}
function paint(){
 if(!playing||!audio)return;const elapsed=Math.max(0,audio.currentTime-origin),state=E.progressAt(timeline,elapsed);
 if(state.phase==='done'){stop(true);return;}
 $('bpm').textContent=Math.round(state.bpm);$('stage').textContent=state.phase==='count'?'カウントイン':`${plan.segments[state.block].name}${state.phase==='rest'?' · 無音休憩':''}`;
 $('bar').textContent=state.phase==='count'?'カウント中':`小節 ${state.bar} / ${plan.segments[state.block].bars}`;
 $('elapsed').textContent=`${E.formatDuration(Math.floor(elapsed))} / ${E.formatDuration(timeline.totalSeconds)}`;$('progress').style.width=(state.progress*100).toFixed(2)+'%';
 let chosen=null;for(let i=nextIndex-1;i>=Math.max(0,nextIndex-20);i--){const ev=timeline.events[i];if(ev?.t<=elapsed+.001&&ev.subbeat===0){chosen=ev;break;}}
 dots(state.phase==='count'?plan.segments[0].beats:plan.segments[state.block].beats,chosen?chosen.beat:-1);frameId=requestAnimationFrame(paint);
}
async function start(at=0){
 if(playing)stop();if(!refresh())return;
 const Ctx=window.AudioContext||window.webkitAudioContext;
 if(!Ctx){inform('このブラウザはWeb Audioに対応していません。',true);return;}
 try{audio=new Ctx();await audio.resume();playing=true;origin=audio.currentTime+.065-at;nextIndex=timeline.events.findIndex(e=>e.t>=at-1e-6);if(nextIndex<0)nextIndex=timeline.events.length;$('play').textContent='■ 停止';$('state').textContent='再生中';schedule();tickTimer=setInterval(schedule,28);frameId=requestAnimationFrame(paint);}
 catch(e){stop();inform('音声を開始できません。ブラウザの音声許可をご確認ください。',true);}
}
$('blocks').addEventListener('click',e=>{const b=e.target.closest('.block'),action=e.target.dataset.action;if(!b||!action)return;const i=Number(b.dataset.index);if(playing)stop();if(action==='remove'&&plan.segments.length>1)plan.segments.splice(i,1);else if(action==='up'&&i>0)[plan.segments[i-1],plan.segments[i]]=[plan.segments[i],plan.segments[i-1]];else if(action==='down'&&i<plan.segments.length-1)[plan.segments[i],plan.segments[i+1]]=[plan.segments[i+1],plan.segments[i]];renderBlocks();refresh();});
$('blocks').addEventListener('change',e=>{const b=e.target.closest('.block'),key=e.target.dataset.key;if(!b||!key)return;const i=Number(b.dataset.index),old=plan.segments[i][key];plan.segments[i][key]=['name','mode'].includes(key)?e.target.value:Number(e.target.value);if(playing)stop();if(!refresh()){plan.segments[i][key]=old;refresh();e.target.value=old;inform('値が範囲外のため元に戻しました。',true);}});
$('planName').addEventListener('change',()=>{plan.name=$('planName').value.slice(0,60);refresh();});
$('countIn').addEventListener('change',()=>{if(playing)stop();plan.countIn=$('countIn').checked;refresh();});
$('add').addEventListener('click',()=>{if(plan.segments.length>=E.MAX_SEGMENTS){inform('ブロックの上限は16件です。',true);return;}if(playing)stop();const prev=plan.segments.at(-1);plan.segments.push({...prev,name:`練習 ${plan.segments.length+1}`,bars:4});renderBlocks();refresh();});
$('preset').addEventListener('change',()=>{setPlan(E.preset($('preset').value));inform('サンプルプランを読み込みました。');});
$('play').addEventListener('click',()=>{if(playing)stop();else start();});
$('skip').addEventListener('click',()=>{if(!playing){inform('再生中に使えます。');return;}const sec=Math.max(0,audio.currentTime-origin);const next=timeline.blocks.find(b=>b.start>sec+.01);if(next)start(next.start);else stop(true);});
$('tap').addEventListener('click',()=>{const now=performance.now();if(taps.length&&now-taps.at(-1)>2400)taps=[];taps.push(now);if(taps.length>8)taps.shift();const bpm=E.tempoFromTaps(taps);$('tapResult').textContent=bpm?`計測 ${bpm} BPM（${taps.length}タップ）`:'もう1回タップ';});
$('save').addEventListener('click',()=>{try{localStorage.setItem('tempozaka-plan-v1',JSON.stringify(E.validatePlan(plan)));inform('この端末のブラウザに保存しました。');}catch(e){inform('端末への保存を利用できません。JSON出力をご利用ください。',true);}});
$('exportJson').addEventListener('click',()=>download('tempozaka-plan.json','application/json;charset=utf-8',JSON.stringify(E.validatePlan(plan),null,2)));
$('exportCsv').addEventListener('click',()=>download('tempozaka-bars.csv','text/csv;charset=utf-8',E.csv(timeline)));
$('importJson').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>100000)throw new Error('100KB以内のJSONファイルを選んでください。');const data=JSON.parse(await file.text());setPlan(data);inform('JSONプランを読み込みました。');}catch(err){inform('読み込み失敗: '+err.message,true);}finally{e.target.value='';}});
$('reset').addEventListener('click',()=>{setPlan(E.preset('climb'));$('preset').value='climb';inform('初期プランに戻しました。端末内の保存は消去していません。');});
try{const saved=localStorage.getItem('tempozaka-plan-v1');if(saved){setPlan(JSON.parse(saved));inform('前回保存したプランを読み込みました。');}else setPlan(plan);}catch(e){setPlan(E.preset('climb'));inform('保存プランを読めなかったため初期状態で開始しました。',true);}
})();
