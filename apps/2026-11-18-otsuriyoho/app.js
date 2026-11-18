/* おつり予報 UI: browser local only; no analytics, service worker, fetch or third-party APIs. */
(function(){
'use strict';
const E=window.OtsuriEngine;const $=id=>document.getElementById(id);let current=E.copy(E.PRESETS.market),last=null,lastReco=null;
const yen=n=>'¥'+Math.round(Number(n)||0).toLocaleString('ja-JP');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const setMsg=(s,error=false)=>{ $('message').textContent=s;$('message').style.color=error?'#a84f36':'#367b61';};
function save(){try{localStorage.setItem('otsuriyoho_v1',JSON.stringify(current));}catch(_){/* browser storage may be disabled */}}
function initial(){try{let v=localStorage.getItem('otsuriyoho_v1');if(v)return E.normalize(JSON.parse(v));}catch(_){}return E.copy(E.PRESETS.market);}
function renderInputs(){
 $('product-rows').innerHTML=current.products.map((p,i)=>`<tr><td><input aria-label="商品 ${i+1} 名前" data-product="${i}" data-field="name" type="text" maxlength="40" value="${esc(p.name)}"></td><td><input aria-label="商品 ${i+1} 価格" data-product="${i}" data-field="price" type="number" min="1" max="50000" value="${p.price}"></td><td><input aria-label="商品 ${i+1} 重み" data-product="${i}" data-field="weight" type="number" min="0" max="100" value="${p.weight}"></td><td><button type="button" class="del-btn" data-remove="${i}" aria-label="商品 ${i+1} を削除">×</button></td></tr>`).join('');
 $('style-rows').innerHTML=E.STYLE_OPTIONS.map((s,i)=>`<label>${s.label}<input aria-label="${s.label} 比率" data-style="${i}" type="number" min="0" max="100" value="${current.styles[i]}"></label>`).join('');
 $('float-rows').innerHTML=E.DENOMS.map((d,i)=>`<label class="denom"><span>${yen(d)}</span><input aria-label="${d}円の枚数" data-float="${i}" type="number" min="0" max="1000" value="${current.float[i]}"><small>枚</small></label>`).join('');
 for(let k of ['count','pairChance','seed','runs','budget'])$(k).value=current[k];$('scenario-name').value=current.name;updateFloatTotal();
}
function readInputs(){
 const data={...current,name:$('scenario-name').value,products:[],styles:[],float:[]};
 for(const row of $('product-rows').querySelectorAll('tr')){data.products.push({name:row.querySelector('[data-field="name"]').value,price:Number(row.querySelector('[data-field="price"]').value),weight:Number(row.querySelector('[data-field="weight"]').value)});}
 for(let i of $('style-rows').querySelectorAll('[data-style]'))data.styles.push(Number(i.value));
 for(let i of $('float-rows').querySelectorAll('[data-float]'))data.float.push(Number(i.value));
 for(let k of ['count','pairChance','seed','runs','budget'])data[k]=Number($(k).value);
 return E.normalize(data);
}
function updateFloatTotal(){try{const amounts=[...document.querySelectorAll('[data-float]')].map(x=>Number(x.value)||0);$('float-total').textContent=yen(E.worth(amounts));}catch(_){ $('float-total').textContent='—';}}
function drawResult(result,reco){
 const cfg=result.cfg;last=result;lastReco=reco;
 $('run-meta').textContent=`${cfg.count} 件 × ${cfg.runs} 回・同一シードで再現可能`;
 $('avg-failed').textContent=result.avgFailed.toFixed(1);$('risk').textContent=Math.round(result.risk*100)+'%';$('p90').textContent=result.p90Failures+' 件';$('sales').textContent=yen(result.avgSales);
 $('failure-bar').style.width=Math.max(0,Math.min(100,result.failRate*100))+'%';
 $('failure-desc').textContent=`${(result.failRate*100).toFixed(1)}% の取引で、要求どおりのお釣りを用意できない仮定。`;
 $('result-state').textContent=result.failRate===0?'不足なし（試算）':result.failRate<.1?'低め（試算）':'要準備（試算）';
 $('hist-note').textContent=`最少 ${result.failureCounts[0]} / 最多 ${result.failureCounts.at(-1)} 件`;
 const mx=Math.max(1,...result.failureCounts);$('histogram').innerHTML=result.failureCounts.map((n,i)=>`<div class="hist-col" style="height:${Math.max(3,n/mx*100)}%" title="試行 ${i+1}: ${n} 件"></div>`).join('');
 const items=reco.picks.flatMap((n,i)=>n?[{d:E.DENOMS[i],n,old:cfg.float[i]}]:[]);
 $('rec-summary').innerHTML=items.length?`<strong>${yen(reco.spent)} を追加する案</strong><div>探索用サンプルの不足取引割合 ${(reco.before.failRate*100).toFixed(1)}% → <b>${(reco.after.failRate*100).toFixed(1)}%</b></div>`:'<strong>追加なし</strong><div>予算・金種の条件では改善する候補が見つかりませんでした。</div>';
 $('rec-rows').innerHTML=items.length?items.map(x=>`<div class="rec-item"><strong class="rec-label">${yen(x.d)}</strong><div class="rec-meta">今 ${x.old} 枚 → 提案後 ${x.old+x.n} 枚</div><strong class="rec-amount">＋${x.n} 枚</strong></div>`).join(''):'<div class="micro">初期枚数と支払傾向を変えて再試算してください。</div>';
 $('ledger-rows').innerHTML=result.first.logs.map(tx=>`<tr><td>${tx.index}</td><td>${tx.items.map(esc).join('＋')}<br><b>${yen(tx.total)}</b></td><td>${yen(tx.paid)}</td><td>${yen(tx.due)}</td><td class="${tx.okay?'okay':'bad'}">${tx.okay?'成立':'不足'}</td></tr>`).join('');
}
function run(){try{current=readInputs();$('run-btn').disabled=true;$('run-btn').textContent='計算中…';
 // Deliberately synchronous and bounded: 500 customers x 100 samples max.
 const result=E.evaluate(current),reco=E.recommend(current);drawResult(result,reco);save();updateFloatTotal();setMsg('再計算しました。設定は端末内に保存されます。');
 }catch(e){setMsg('入力を確認してください：'+e.message,true);}finally{$('run-btn').disabled=false;$('run-btn').innerHTML='シナリオを再計算 <span aria-hidden="true">↗</span>';}}
function dl(filename,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function quickCalc(){const price=Number($('calc-price').value),tender=Number($('calc-tender').value);try{
 if(!Number.isSafeInteger(price)||!Number.isSafeInteger(tender)||price<0||tender<0||price>100000||tender>100000)throw Error('0〜100,000の整数を入力してください');
 if(tender<price)throw Error('お預かり額が会計額に届いていません');
 const due=tender-price,available=readInputs().float;const coins=E.changeFor(due,available);
 $('calc-result').textContent=coins?`おつり ${yen(due)}　${coins.map((n,i)=>n?yen(E.DENOMS[i])+' × '+n+'枚':'').filter(Boolean).join(' / ')||'おつりなし'}`:`おつり ${yen(due)}：指定した開店時の金種だけでは用意できません。`;
 }catch(e){$('calc-result').textContent=e.message;}}
$('add-product').addEventListener('click',()=>{try{current=readInputs();if(current.products.length>=10)throw Error('商品は最大10種類です');current.products.push({name:'新しい商品',price:500,weight:10});renderInputs();setMsg('商品を追加しました。再計算で反映します。');}catch(e){setMsg(e.message,true);}});
$('product-rows').addEventListener('click',e=>{const btn=e.target.closest('[data-remove]');if(!btn)return;try{current=readInputs();if(current.products.length<=1)throw Error('商品は最低1種類必要です');current.products.splice(Number(btn.dataset.remove),1);renderInputs();setMsg('商品を削除しました。');}catch(err){setMsg(err.message,true);}});
$('load-preset').addEventListener('click',()=>{current=E.copy(E.PRESETS[$('preset').value]);renderInputs();run();});
$('run-btn').addEventListener('click',run);
$('float-rows').addEventListener('input',updateFloatTotal);
$('export-json').addEventListener('click',()=>{try{current=readInputs();dl('otsuriyoho-plan.json',JSON.stringify({version:1,...current},null,2)+'\n','application/json;charset=utf-8');save();setMsg('設定JSONを保存しました。');}catch(e){setMsg(e.message,true);}});
$('export-csv').addEventListener('click',()=>{try{current=readInputs();let result=E.evaluate(current),reco=E.recommend(current);dl('otsuriyoho-report.csv',E.reportCSV(current,result,reco),'text/csv;charset=utf-8');drawResult(result,reco);save();setMsg('CSVレポートを保存しました。');}catch(e){setMsg(e.message,true);}});
$('import-btn').addEventListener('click',()=>$('json-file').click());
$('json-file').addEventListener('change',async e=>{let file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>100000)throw Error('JSONは100KB以下にしてください');const data=JSON.parse(await file.text());current=E.normalize(data);renderInputs();run();setMsg('設定JSONを読み込みました。');}catch(err){setMsg('読込失敗：'+err.message,true);}});
$('print-btn').addEventListener('click',()=>window.print());$('calc-btn').addEventListener('click',quickCalc);
current=initial();renderInputs();run();quickCalc();
})();
