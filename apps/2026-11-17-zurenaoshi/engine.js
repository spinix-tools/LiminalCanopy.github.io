/* ずれなおし / ZURENAOSHI — pure millimetre layout engine. MIT. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZureEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const PRESETS={
 'a4-3x8':{paperW:210,paperH:297,cols:3,rows:8,labelW:63,labelH:31.5,gapX:2,gapY:2,marginX:8.5,marginY:15.5},
 'a4-2x5':{paperW:210,paperH:297,cols:2,rows:5,labelW:91,labelH:51,gapX:4,gapY:4,marginX:12,marginY:13},
 'a4-4x10':{paperW:210,paperH:297,cols:4,rows:10,labelW:45,labelH:25,gapX:3,gapY:3,marginX:10.5,marginY:10},
 'letter-3x10':{paperW:215.9,paperH:279.4,cols:3,rows:10,labelW:66,labelH:25.4,gapX:2,gapY:2,marginX:6.95,marginY:3.7}
};
const sample=['深煎りブレンド | ¥780','季節の紅茶 | ¥680','自家製ジャム | ¥920','旅するノート | ¥1,250','木のスプーン | ¥450','小さな花束 | ¥1,100','珈琲豆 100g | ¥990','焼き菓子セット | ¥600','手仕事せっけん | ¥550','グリーンティー | ¥480'];
const defaultState=()=>({...PRESETS['a4-3x8'],fontSize:11,padding:2,from:1,labels:Array.from({length:24},(_,i)=>sample[i%sample.length]),showGuides:true,calibration:{aX:12,aY:12,bX:198,bY:285,enabled:false}});
const number=(n)=>Number(n);
const maxCells=(s)=>number(s.cols)*number(s.rows);
function validate(s){
 const errors=[];const dims=['paperW','paperH','labelW','labelH','marginX','marginY','gapX','gapY','padding','fontSize'];
 for(const k of dims) if(!Number.isFinite(number(s[k])) || number(s[k])<(k==='paperW'||k==='paperH'||k==='labelW'||k==='labelH'||k==='fontSize'?0.1:0))errors.push(`${k} は有効な0以上の数値が必要です`);
 for(const k of ['rows','cols'])if(!Number.isInteger(number(s[k]))||number(s[k])<1||number(s[k])>30)errors.push(`${k} は1〜30の整数`);
 if(!Number.isInteger(number(s.from))||number(s.from)<1||number(s.from)>900)errors.push('開始位置は1〜900の整数');
 if(errors.length)return errors;
 if(maxCells(s)>300)errors.push('用紙1枚は最大300面');
 if(number(s.marginX)*2+number(s.cols)*number(s.labelW)+(number(s.cols)-1)*number(s.gapX)>number(s.paperW)+1e-7)errors.push('横幅が用紙を超えています');
 if(number(s.marginY)*2+number(s.rows)*number(s.labelH)+(number(s.rows)-1)*number(s.gapY)>number(s.paperH)+1e-7)errors.push('高さが用紙を超えています');
 if(number(s.padding)*2>=number(s.labelW)||number(s.padding)*2>=number(s.labelH))errors.push('内側余白がラベルを超えています');
 if(number(s.from)>maxCells(s))errors.push('開始位置が面数を超えています');
 return errors;
}
function cells(s){if(validate(s).length)throw Error(validate(s).join(' / '));return Array.from({length:maxCells(s)},(_,i)=>({index:i+1,row:Math.floor(i/number(s.cols))+1,col:i%number(s.cols)+1,x:number(s.marginX)+(i%number(s.cols))*(number(s.labelW)+number(s.gapX)),y:number(s.marginY)+Math.floor(i/number(s.cols))*(number(s.labelH)+number(s.gapY)),w:number(s.labelW),h:number(s.labelH),text:i+1>=number(s.from)?String((s.labels||[])[i+1-number(s.from)]??''):''}));}
function markers(s){const inset=12;if(number(s.paperW)<=2*inset||number(s.paperH)<=2*inset)throw Error('用紙の幅・高さは24mmを超えてください');return {a:{x:inset,y:inset},b:{x:number(s.paperW)-inset,y:number(s.paperH)-inset}};}
function solve(s){
 const m=markers(s),c=s.calibration||{};
 const values=['aX','aY','bX','bY'].map(k=>number(c[k]));
 if(values.some(v=>!Number.isFinite(v)))throw Error('実測値を4か所すべて入力してください');
 const [aX,aY,bX,bY]=values;
 const sx=(bX-aX)/(m.b.x-m.a.x),sy=(bY-aY)/(m.b.y-m.a.y);
 if(sx<0.9||sx>1.1||sy<0.9||sy>1.1)throw Error('倍率誤差が±10%を超えます。100%印刷を再確認してください');
 const ox=aX-sx*m.a.x,oy=aY-sy*m.a.y;
 return {sx,sy,ox,oy,correctX:x=>(x-ox)/sx,correctY:y=>(y-oy)/sy,shiftX:(m.a.x-ox)/sx-m.a.x,shiftY:(m.a.y-oy)/sy-m.a.y};
}
const xml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const fmt=x=>Number(x.toFixed(4));
function svg(s,mode='final'){
 const errs=validate(s);if(errs.length)throw Error(errs.join(' / '));
 const proof=mode==='proof';const c=!proof&&s.calibration?.enabled?solve(s):{correctX:x=>x,correctY:y=>y,sx:1,sy:1};
 const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(+s.paperW)}mm" height="${fmt(+s.paperH)}mm" viewBox="0 0 ${fmt(+s.paperW)} ${fmt(+s.paperH)}" role="img" aria-label="ラベル面付け">`,`<rect width="100%" height="100%" fill="white"/>`];
 if(proof){const m=markers(s);for(const [id,p] of Object.entries(m)){parts.push(`<g fill="none" stroke="#101828" stroke-width=".2"><path d="M${p.x-5} ${p.y}h10 M${p.x} ${p.y-5}v10"/></g>`,`<text x="${id==='a'?p.x+6:p.x-6}" text-anchor="${id==='a'?'start':'end'}" y="${p.y-4}" font-size="3.2" fill="#101828">${id.toUpperCase()} (${fmt(p.x)}, ${fmt(p.y)})mm</text>`);}}
 for(const cell of cells(s)){
   const x=fmt(c.correctX(cell.x)),y=fmt(c.correctY(cell.y)),x2=fmt(c.correctX(cell.x+cell.w)),y2=fmt(c.correctY(cell.y+cell.h));
   const w=fmt(x2-x),h=fmt(y2-y);
   if(proof || s.showGuides || mode==='preview')parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${proof?'#afb6c1':'#bcc9e0'}" stroke-width=".22" stroke-dasharray="1.2 1.3"/>`);
   if(proof)continue;
   const str=cell.text.trim();if(!str)continue;
   const lines=str.split('|').map(x=>x.trim()).slice(0,5);
   const p=+s.padding, tx=fmt((x+x2)/2), fs=fmt(+s.fontSize*.352778),step=fs*1.25;
   const mid=(y+y2)/2,first=mid-(lines.length-1)*step/2+fs*.34;
   // Scale fonts to match any measured-axis expansion; XML escaping protects user-provided text.
   parts.push(`<text text-anchor="middle" font-family="system-ui,'Noto Sans JP',sans-serif" font-size="${fs}" fill="#13243c">`);
   lines.forEach((line,i)=>parts.push(`<tspan x="${tx}" y="${fmt(first+i*step)}" textLength="${fmt(Math.min(Math.max(line.length*fs*.48,0.01),Math.max(.01,w-2*p)))}" lengthAdjust="spacingAndGlyphs">${xml(line)}</tspan>`));
   parts.push('</text>');
 }
 parts.push('</svg>');return parts.join('');
}
function csvParse(src){const rows=[];let row=[],field='',quoted=false;const text=String(src).replace(/^\uFEFF/,'');for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;}else if(ch==='"')quoted=true;else if(ch===','){row.push(field);field='';}else if(ch==='\r'||ch==='\n'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';}else field+=ch;}if(quoted)throw Error('CSVの引用符が閉じていません');row.push(field);if(row.some(v=>v.trim()))rows.push(row);return rows;}
const csvEscape=v=>`"${String(v).replace(/"/g,'""')}"`;
function exportCSV(s){return '\uFEFF面番号,行,列,印字文字\r\n'+cells(s).map(c=>[c.index,c.row,c.col,c.text].map(csvEscape).join(',')).join('\r\n');}
function importLabels(csv){const rows=csvParse(csv);return rows.map(r=>r.join(' | ').trim()).filter(Boolean).slice(0,300);}
return {PRESETS,defaultState,validate,cells,maxCells,markers,solve,xml,svg,csvParse,exportCSV,importLabels};
});