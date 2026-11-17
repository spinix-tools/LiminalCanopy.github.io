/* ずれなおし / ZURENAOSHI UI. No network requests or dependencies. */
(()=>{'use strict';
const E=window.ZureEngine,$=id=>document.getElementById(id),key='zuren-2026-v1';
let state=E.defaultState();
try{const raw=localStorage.getItem(key);if(raw){const stored=JSON.parse(raw);if(stored&&typeof stored==='object'&&Array.isArray(stored.labels))state={...state,...stored,calibration:{...state.calibration,...stored.calibration}};}}catch(_){/* blocked localStorage */}
const numfields=[...document.querySelectorAll('[data-k]')],calfields=[...document.querySelectorAll('[data-c]')];
function sync(){numfields.forEach(el=>{el.value=state[el.dataset.k]});calfields.forEach(el=>{el.value=state.calibration[el.dataset.c]});$('labels').value=state.labels.join('\n');$('guides').value=String(!!state.showGuides);$('enableCorrection').checked=!!state.calibration.enabled;const preset=Object.entries(E.PRESETS).find(([_,p])=>Object.keys(p).every(k=>Number(p[k])===Number(state[k])));$('preset').value=preset?.[0]||'custom';}
const save=()=>{try{localStorage.setItem(key,JSON.stringify(state));}catch(_){}};
const showError=message=>{$('message').className='error';$('message').textContent=message;};
function render(){save();$('cellCount').textContent=E.maxCells(state);$('filledCount').textContent=state.labels.slice(0,Math.max(0,E.maxCells(state)-Number(state.from)+1)).filter(x=>x.trim()).length;$('paperCount').textContent=`${state.paperW}×${state.paperH}`;
 const errors=E.validate(state);if(errors.length){$('svgHolder').replaceChildren();showError(errors.join(' / '));return;}
 try{
   const correction=E.solve(state);const used=!!state.calibration.enabled;
   $('svgHolder').innerHTML=E.svg(state,'preview');$('calBadge').textContent=used?'補正ON':'補正OFF';$('calibrationText').textContent=`補正予測：X ${((correction.sx-1)*100).toFixed(2)}% / Y ${((correction.sy-1)*100).toFixed(2)}% の印刷倍率を逆補正。左上のずれ目安 X ${correction.shiftX.toFixed(2)}mm・Y ${correction.shiftY.toFixed(2)}mm。`;
   $('message').className='status';$('message').textContent=used?'計測値から、X/Y別に位置と倍率を逆算してプレビューに適用中。':'印刷準備OK。必要なら普通紙に十字を試し刷りして補正できます。';
 }catch(err){$('calibrationText').textContent=err.message;$('calBadge').textContent='要修正';if(state.calibration.enabled){$('svgHolder').replaceChildren();showError('補正値エラー：'+err.message);}else{try{$('svgHolder').innerHTML=E.svg({...state,calibration:{...state.calibration,enabled:false}},'preview');$('message').className='status';$('message').textContent='印刷は可能です。補正用の測定値に誤りがあるため、ONにする前に修正してください。';}catch(e){showError(e.message);}}}
}
function refresh(){sync();render();}
function resetMark(){const {a,b}=E.markers(state);state.calibration={aX:a.x,aY:a.y,bX:b.x,bY:b.y,enabled:false};}
numfields.forEach(el=>el.addEventListener('input',()=>{state[el.dataset.k]=Number(el.value);$('preset').value='custom';render();}));
calfields.forEach(el=>el.addEventListener('input',()=>{state.calibration[el.dataset.c]=Number(el.value);render();}));
$('labels').addEventListener('input',()=>{state.labels=$('labels').value.replace(/\r/g,'').split('\n').slice(0,300);render();});
$('preset').addEventListener('change',()=>{const p=E.PRESETS[$('preset').value];if(p){Object.assign(state,p);resetMark();refresh();}});
$('guides').addEventListener('change',()=>{state.showGuides=$('guides').value==='true';render();});
$('enableCorrection').addEventListener('change',()=>{state.calibration.enabled=$('enableCorrection').checked;render();});
$('resetCorrection').addEventListener('click',()=>{resetMark();refresh();});
$('demo').addEventListener('click',()=>{const d=E.defaultState();state.labels=d.labels;state.from=1;refresh();});
$('clear').addEventListener('click',()=>{state.labels=[];refresh();});
function download(name,mime,content){const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function safeGet(fn){try{return fn();}catch(e){showError(e.message);return null;}}
$('downloadSvg').addEventListener('click',()=>{const doc=safeGet(()=>E.svg(state,'final'));if(doc!==null)download('zurenaoshi-labels.svg','image/svg+xml;charset=utf-8',doc);});
$('exportCsv').addEventListener('click',()=>{const csv=safeGet(()=>E.exportCSV(state));if(csv!==null)download('zurenaoshi-cells.csv','text/csv;charset=utf-8',csv);});
$('exportJson').addEventListener('click',()=>download('zurenaoshi-project.json','application/json;charset=utf-8',JSON.stringify({version:1,data:state},null,2)));
async function readFile(file){if(!file)return null;if(file.size>500000)throw Error('ファイルは500KB以内にしてください');return await file.text();}
$('csvFile').addEventListener('change',async e=>{try{const text=await readFile(e.target.files[0]);if(text!==null){state.labels=E.importLabels(text);state.from=1;refresh();}}catch(err){showError('CSV読み込み：'+err.message);}finally{e.target.value='';}});
$('jsonFile').addEventListener('change',async e=>{try{const text=await readFile(e.target.files[0]);if(text===null)return;const parsed=JSON.parse(text),d=parsed?.data;if(parsed?.version!==1||!d||!Array.isArray(d.labels)||!d.calibration||d.labels.length>300)throw Error('このアプリの設定JSONではありません');const next={...E.defaultState(),...d,labels:d.labels.map(x=>String(x).slice(0,500)),calibration:{...E.defaultState().calibration,...d.calibration}};const errors=E.validate(next);if(errors.length)throw Error(errors.join(' / '));E.solve(next);state=next;refresh();}catch(err){showError('JSON復元：'+err.message);}finally{e.target.value='';}});
function print(mode){const svg=safeGet(()=>E.svg(state,mode));if(svg===null)return;const printRoot=$('printRoot');printRoot.innerHTML=svg;$('pageStyle').textContent=`@page { size: ${Number(state.paperW)}mm ${Number(state.paperH)}mm; margin: 0; }`;window.print();}
$('proof').addEventListener('click',()=>print('proof'));
$('printFinal').addEventListener('click',()=>print('final'));
refresh();
})();
