/* AME MARCHE — DOM controller. No network calls or dependencies. */
(function(){'use strict';
const E=window.AmeEngine;
const $=id=>document.getElementById(id);
const storeKey='ame-marche-mvp-v1';
let state=E.initial();
try{const saved=localStorage.getItem(storeKey);if(saved)state=E.validate(JSON.parse(saved));}catch(e){console.warn('保存済み設定を読み込めませんでした',e);}
const money=n=>`${Math.round(n).toLocaleString('ja-JP')}円`;
const num=n=>Math.round(n).toLocaleString('ja-JP');
const rate=n=>`${(n*100).toFixed(1)}%`;
const text=(tag,cls,value)=>{const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=value;return el;};
function save(){try{localStorage.setItem(storeKey,JSON.stringify(state));$('save-status').textContent='この端末に保存しました。';}catch(e){$('save-status').textContent='端末保存ができませんでした。JSON出力をご利用ください。';}}
function update(){try{const result=E.analysis(state);drawResults(result);save();}catch(e){$('save-status').textContent='計算できません: '+e.message;}}
function makeField(key,label,planIndex){const def={booth:['出店料','円',1],travel:['交通・運搬費','円',1],misc:['その他固定費','円',1],visitorsSun:['晴れの来場者予想','人',1],visitorsRain:['雨の来場者予想','人',1],conversion:['購入率','%',.5],fee:['決済手数料','%',.25],hours:['拘束時間','時間',.5]}[key];
  const box=text('div','field','');const lab=text('label','',label),wrap=text('div',def[1]==='円'?'currency':'','');const input=document.createElement('input');input.type='number';input.inputMode='decimal';input.min=0;input.step=def[2];input.value=state.plans[planIndex][key];input.setAttribute('aria-label',`案${planIndex+1} ${label}`);input.dataset.plan=planIndex;input.dataset.key=key;input.addEventListener('change',()=>{const p=state.plans[planIndex];p[key]=Number(input.value);state=E.validate(state);input.value=state.plans[planIndex][key];update();renderPlanRibbons();});lab.htmlFor=`plan-${planIndex}-${key}`;input.id=lab.htmlFor;wrap.append(input);box.append(lab,wrap);return box;
}
function renderPlanRibbons(){state.plans.forEach((p,i)=>{$(`cost-${i}`).textContent=money(E.fixed(p));});}
function renderPlans(){const root=$('plans');root.replaceChildren();state.plans.forEach((plan,i)=>{const card=text('article','plan-card','');const title=text('div','plan-title',''),badge=text('div',`plan-icon ${i?'b':'a'}`,i?'B':'A');const titleText=document.createElement('div');titleText.style.flex='1';const name=document.createElement('input');name.type='text';name.maxLength=32;name.className='plan-name';name.value=plan.name;name.setAttribute('aria-label',`案${i+1}の名前`);name.addEventListener('change',()=>{state.plans[i].name=name.value;state=E.validate(state);name.value=state.plans[i].name;update();});titleText.append(name,text('div','plan-sub',i?'屋内・屋根付き案など':'屋外・低コスト案など'));title.append(badge,titleText);const fields=text('div','fields','');[['booth','出店料'],['travel','交通・運搬費'],['misc','その他固定費'],['visitorsSun','晴れの来場者'],['visitorsRain','雨の来場者'],['conversion','購入率'],['fee','決済手数料率'],['hours','拘束時間']].forEach(([key,label])=>fields.append(makeField(key,label,i)));const ribbon=text('div','plan-ribbon','');ribbon.append(text('span','','固定費合計'));const cost=text('strong','',money(E.fixed(plan)));cost.id=`cost-${i}`;ribbon.append(cost);card.append(title,fields,ribbon);root.append(card);});}
function productInput(p,key,label){const el=document.createElement('input');el.type=key==='name'?'text':'number';el.value=p[key];el.dataset.key=key;el.dataset.id=p.id;el.setAttribute('aria-label',`${p.name} ${label}`);if(key==='name'){el.maxLength=32;}else{el.min=0;el.step=key==='mix'?'1':'1';el.inputMode='decimal';}el.addEventListener('change',()=>{const target=state.products.find(x=>x.id===p.id);if(!target)return;const old=target[key];target[key]=el.value;try{state=E.validate(state);el.value=state.products.find(x=>x.id===p.id)[key];$('mix-info').textContent=`需要比率の合計: ${num(state.products.reduce((a,b)=>a+b.mix,0))}（計算時は自動で正規化）`;update();}catch(err){target[key]=old;el.value=old;$('save-status').textContent=err.message;}});return el;}
function renderProducts(){const root=$('product-rows');root.replaceChildren();state.products.forEach(p=>{const tr=document.createElement('tr');[['name','商品名'],['price','価格'],['cost','販売時原価'],['stock','持込数'],['mix','需要比率'],['leftover','残り損失']].forEach(([key,label])=>{const td=document.createElement('td');td.append(productInput(p,key,label));tr.append(td);});const td=document.createElement('td');const remove=text('button','remove-item','×');remove.type='button';remove.title='商品を削除';remove.setAttribute('aria-label',`${p.name}を削除`);remove.disabled=state.products.length===1;remove.addEventListener('click',()=>{state.products=state.products.filter(x=>x.id!==p.id);renderProducts();update();});td.append(remove);tr.append(td);root.append(tr);});$('mix-info').textContent=`需要比率の合計: ${num(state.products.reduce((a,b)=>a+b.mix,0))}（計算時は自動で正規化）`;}
function tile(meta,value,detail,cls){const card=text('div','summary-tile','');card.append(text('div','meta',meta),text('div',`value ${cls||''}`,value),text('div','detail',detail));return card;}
function drawResults(r){const {config:cfg,expectations:e,simulation:s,sensitivity:g}=r;
  $('rain-label').textContent=cfg.rain+'%';$('rain').value=cfg.rain;
  const root=$('summary');root.replaceChildren(
    tile('PLAN A · 期待利益',money(e[0].expectedProfit),cfg.plans[0].name,'a-text'),
    tile('PLAN B · 期待利益',money(e[1].expectedProfit),cfg.plans[1].name,'b-text'),
    tile('A · 赤字になる確率',rate(s[0].lossRate),'1,600回の試算',''),
    tile('B · 赤字になる確率',rate(s[1].lossRate),'1,600回の試算','')
  );
  drawProfit(s,cfg);
  const weather=$('scenario');weather.replaceChildren();e.forEach((x,i)=>{const row=document.createElement('tr');[cfg.plans[i].name,money(x.sun.profit),money(x.rain.profit),money(x.sun.profit-x.rain.profit)].forEach((v,k)=>{const td=text('td',k===1||k===2?(Number(k===1?x.sun.profit:x.rain.profit)<0?'negative':''):'',v);row.append(td);});weather.append(row);});
  const winner=e[0].expectedProfit>=e[1].expectedProfit?0:1;const safer=s[0].lossRate<=s[1].lossRate?0:1;
  const commentary=winner===safer?`期待利益と赤字率の両面では「${cfg.plans[winner].name}」が優勢。ただし仮定次第で逆転します。`:`期待利益は「${cfg.plans[winner].name}」、赤字率の低さは「${cfg.plans[safer].name}」が優勢。判断の優先順位で選択が変わります。`;
  $('insight').textContent=`判断のヒント：${commentary} 目標時給を達成する試算割合 A ${rate(s[0].goalRate)} / B ${rate(s[1].goalRate)}。`;
  drawSensitivity(g,cfg.rain);
}
const svgText=(x,y,value,extra='')=>`<text x="${x}" y="${y}" ${extra}>${value}</text>`;
function drawProfit(s,cfg){const a=Math.min(...s.map(x=>x.p10),0),b=Math.max(...s.map(x=>x.p90),0);const span=Math.max(1,b-a),min=a-span*.12,max=b+span*.12;const X=n=>65+(n-min)/(max-min)*455;
  const zero=X(0),colors=['#ef6e49','#1a8580'];let content=`<rect x="0" y="0" width="560" height="206" fill="white"/>`;
  [0,1].forEach((i)=>{const y=60+i*74,item=s[i];content+=`<line x1="65" y1="${y}" x2="520" y2="${y}" stroke="#ebefeb" stroke-width="1"/>`;
    content+=`<line x1="${X(item.p10)}" y1="${y}" x2="${X(item.p90)}" y2="${y}" stroke="${colors[i]}" stroke-width="12" stroke-linecap="round" opacity=".24"/>`;
    content+=`<line x1="${X(item.p10)}" y1="${y}" x2="${X(item.p90)}" y2="${y}" stroke="${colors[i]}" stroke-width="2"/>`;
    content+=`<circle cx="${X(item.p50)}" cy="${y}" r="7" fill="${colors[i]}" stroke="white" stroke-width="3"/>`;
    content+=svgText(18,y+4,i?'B':'A',`font-size="15" font-weight="800" fill="${colors[i]}"`);
    content+=svgText(Math.min(470,Math.max(100,X(item.p50)-36)),y-19,`${Math.round(item.p50).toLocaleString('ja-JP')}円`,'font-size="12" font-weight="700" fill="#304348"');
  });content+=`<line x1="${zero}" y1="20" x2="${zero}" y2="173" stroke="#c84541" stroke-width="1.7" stroke-dasharray="4 4"/>`;
  [0,.5,1].forEach(t=>{const val=min+(max-min)*t;content+=svgText(X(val),195,`${Math.round(val/1000)}千円`,'font-size="11" fill="#788683" text-anchor="middle"');});$('profit-chart').innerHTML=content;}
function drawSensitivity(grid,selectedRain){const vals=grid.flatMap(x=>[x.A,x.B]);const lo=Math.min(...vals,0),hi=Math.max(...vals,0),spread=Math.max(1,hi-lo);const mn=lo-.07*spread,mx=hi+.07*spread;const X=p=>55+p/100*585,Y=v=>232-(v-mn)/(mx-mn)*202;
 let html=`<rect width="680" height="280" fill="white"/>`;[0,.25,.5,.75,1].forEach(t=>{const v=mn+(mx-mn)*t;html+=`<line x1="55" y1="${Y(v)}" x2="640" y2="${Y(v)}" stroke="#edf0ed"/>`+svgText(47,Y(v)+4,`${Math.round(v/1000)}千`,'text-anchor="end" font-size="11" fill="#71817c"');});
 html+=`<line x1="55" y1="${Y(0)}" x2="640" y2="${Y(0)}" stroke="#e88c85" stroke-dasharray="4 4"/>`;
 grid.forEach((g,i)=>{if(i%2===0)html+=svgText(X(g.rain),255,`${g.rain}%`,'text-anchor="middle" font-size="11" fill="#71817c"');});
 [['A','#ef6e49'],['B','#1a8580']].forEach(([k,color])=>{html+=`<polyline points="${grid.map(g=>`${X(g.rain)},${Y(g[k])}`).join(' ')}" stroke="${color}" stroke-width="3.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;});
 html+=`<line x1="${X(selectedRain)}" y1="16" x2="${X(selectedRain)}" y2="232" stroke="#485454" stroke-dasharray="5 5" stroke-width="1.5"/>`;
 const current=grid[0], a=current.A+(grid[10].A-current.A)*selectedRain/100,b=current.B+(grid[10].B-current.B)*selectedRain/100;
 html+=`<circle cx="${X(selectedRain)}" cy="${Y(a)}" r="5" stroke="white" stroke-width="2" fill="#ef6e49"/>`;
 html+=`<circle cx="${X(selectedRain)}" cy="${Y(b)}" r="5" stroke="white" stroke-width="2" fill="#1a8580"/>`;
 html+=svgText(625,20,'● A   ● B','font-size="12" fill="#526660" text-anchor="end"');$('sensitivity-chart').innerHTML=html;}
function download(name,content,mime){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),250);}
function csvCell(value){const s=String(value);return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function csv(){const x=E.analysis(state);let rows=[['案','天候','売上（円）','販売時原価（円）','決済手数料（円）','残り損失（円）','固定費（円）','利益（円）','販売点数','想定客数']];
 x.expectations.forEach((e,i)=>[['晴れ',e.sun],['雨',e.rain]].forEach(([label,d])=>rows.push([state.plans[i].name,label,d.revenue,d.variableCosts,d.fees,d.remainingLoss,d.fixedCost,d.profit,d.soldTotal,d.visitors])));
 rows.push([],['雨の確率 (%)',state.rain],['目標時給（円）',state.hourlyGoal],[]);
 rows.push(['案','期待利益（円）','損益10%点','損益中央値','損益90%点','赤字率','目標時給達成率']);
 x.simulation.forEach((s,i)=>rows.push([state.plans[i].name,x.expectations[i].expectedProfit,s.p10,s.p50,s.p90,s.lossRate,s.goalRate]));
 return '\ufeff'+rows.map(a=>a.map(csvCell).join(',')).join('\r\n');}
$('rain').addEventListener('input',e=>{state.rain=Number(e.target.value);update();});
$('hourly-goal').value=state.hourlyGoal;$('hourly-goal').addEventListener('change',e=>{state.hourlyGoal=Number(e.target.value);state=E.validate(state);e.target.value=state.hourlyGoal;update();});
$('add-product').addEventListener('click',()=>{if(state.products.length>=E.MAX_PRODUCTS){$('save-status').textContent='商品は最大12件です';return;}state.products.push({id:Math.max(0,...state.products.map(p=>p.id))+1,name:`商品${state.products.length+1}`,price:1000,cost:300,stock:15,mix:10,leftover:0});state=E.validate(state);renderProducts();update();});
$('reset').addEventListener('click',()=>{if(!window.confirm('入力をすべてサンプルに戻しますか？'))return;state=E.initial();renderPlans();renderProducts();$('hourly-goal').value=state.hourlyGoal;update();});
$('export-json').addEventListener('click',()=>download('ame-marche-plan.json',JSON.stringify({version:1,...state},null,2),'application/json'));
$('export-csv').addEventListener('click',()=>download('ame-marche-results.csv',csv(),'text/csv;charset=utf-8'));
$('import-json').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;if(file.size>300000){$('save-status').textContent='300KB以内のJSONファイルを選択してください';e.target.value='';return;}try{const obj=JSON.parse(await file.text());state=E.validate(obj);renderPlans();renderProducts();$('hourly-goal').value=state.hourlyGoal;update();$('save-status').textContent='JSONから復元しました。';}catch(err){$('save-status').textContent='復元失敗: '+err.message;}finally{e.target.value='';}});
$('print').addEventListener('click',()=>window.print());
renderPlans();renderProducts();update();
})();
