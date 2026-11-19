/* BAISA / 焙差: deterministic, offline roast-profile comparison core. MIT. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BaisaEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const DEMO = [
    {name:'バッチ A / 基準', csv:'time,bt\n0,110\n60,119\n120,142\n180,164\n210,171\n240,180\n300,188\n360,194\n420,202\n480,207\n540,212\n570,215', yellow:'3:30', crack:'7:00', drop:'9:30'},
    {name:'バッチ B / 比較', csv:'time,bt\n0,113\n60,126\n120,149\n180,165\n240,176\n300,189\n360,197\n420,202\n450,205\n510,210\n570,215\n600,218', yellow:'3:45', crack:'7:30', drop:'10:00'}
  ];
  function finite(n, label) {
    if (!Number.isFinite(n)) throw new Error(label + 'は有限の数値にしてください');
    return n;
  }
  function seconds(v) {
    const s = String(v == null ? '' : v).trim();
    if (!s) throw new Error('時間が空です');
    let n;
    if (/^\d+(?:\.\d+)?$/.test(s)) n = Number(s);
    else if (/^\d+:\d{1,2}(?:\.\d+)?$/.test(s)) {const a=s.split(':'); n=Number(a[0])*60+Number(a[1]); if(Number(a[1])>=60)throw Error('秒は60未満にしてください');}
    else if (/^\d+:\d{1,2}:\d{1,2}(?:\.\d+)?$/.test(s)) {const a=s.split(':').map(Number); if(a[1]>=60||a[2]>=60) throw Error('分と秒は60未満にしてください');n=a[0]*3600+a[1]*60+a[2];}
    else throw new Error('時間は秒数または m:ss で入力してください: '+s);
    finite(n,'時間'); if(n<0||n>10800)throw Error('時間は0〜10,800秒にしてください'); return n;
  }
  function formatTime(n) {
    if(!Number.isFinite(n))return '—';
    const v=Math.max(0, Math.round(n)); return Math.floor(v/60)+':'+String(v%60).padStart(2,'0');
  }
  // Small RFC-4180-style reader; supports double quoted fields and CRLF.
  function rowsOf(s, delim) {
    const rows=[]; let row=[],field='',quoted=false;
    const text=String(s).replace(/^\uFEFF/,'');
    for(let i=0;i<text.length;i++) {
      const c=text[i];
      if(quoted) {if(c==='"' && text[i+1]==='"'){field+='"';i++;} else if(c==='"')quoted=false;else field+=c;}
      else if(c==='"')quoted=true;
      else if(c===delim){row.push(field);field='';}
      else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}
      else field+=c;
    }
    if(quoted)throw Error('CSVの引用符が閉じていません');
    row.push(field.replace(/\r$/,''));rows.push(row);
    return rows.filter(r=>r.some(c=>String(c).trim()!==''));
  }
  function sniff(s) {
    const line=String(s).replace(/^\uFEFF/,'').split(/\r?\n/).find(x=>x.trim());
    if(!line)throw Error('CSVが空です');
    const candidates=[',','\t',';'];let best=',',mx=-1;
    for(const d of candidates) {const n=line.split(d).length-1;if(n>mx){mx=n;best=d;}}
    return best;
  }
  function parseCsv(s) {
    const raw=rowsOf(s, sniff(s));
    if(raw.length<3)throw Error('CSVは見出しと2点以上のデータが必要です');
    const headers=raw[0].map(c=>String(c).toLowerCase().replace(/[\s_\-()°℃]/g,''));
    const ti=headers.findIndex(x=>/^(time|timestamp|elapsed|sec|second|seconds|時間|秒|時刻|t)$/.test(x));
    const bi=headers.findIndex(x=>/^(bt|beantemp|beantemperature|temperature|temp|豆温|豆温度|温度|bean)$/.test(x));
    if(ti<0||bi<0||ti===bi)throw Error('CSV見出しは time,bt（時間・豆温）を指定してください');
    const points=[];
    for(let i=1;i<raw.length;i++) {
      const r=raw[i];
      if((r[ti]||'').trim()===''&&(r[bi]||'').trim()==='')continue;
      const t=seconds(r[ti]);
      const str=String(r[bi]??'').trim();
      if(!/^-?\d+(?:\.\d+)?$/.test(str))throw Error('CSVの'+(i+1)+'行目の温度が数値ではありません');
      const bt=finite(Number(str),'豆温');
      if(bt < -50 || bt > 600) throw Error('豆温は -50〜600°C の範囲にしてください');
      if(points.length&&t<=points[points.length-1].t)throw Error('CSV時間は重複せず、昇順で並べてください（'+(i+1)+'行目）');
      points.push({t,bt});
    }
    if(points.length<2)throw Error('有効な温度点が2件未満です');
    if(points[0].t!==0)throw Error('最初の時刻を0秒にしてください');
    if(points[points.length-1].t<60)throw Error('少なくとも60秒の焙煎記録が必要です');
    return points;
  }
  function interpolate(points,t) {
    if(t<points[0].t-1e-9||t>points[points.length-1].t+1e-9)return null;
    if(t<=points[0].t)return points[0].bt;
    let lo=0,hi=points.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(points[mid].t<=t)lo=mid;else hi=mid;}
    const a=points[lo],b=points[hi];return a.bt+(b.bt-a.bt)*(t-a.t)/(b.t-a.t);
  }
  function validate(batch) {
    const points=parseCsv(batch.csv);
    const yellow=seconds(batch.yellow),crack=seconds(batch.crack),drop=seconds(batch.drop);
    if(!(0<yellow&&yellow<crack&&crack<drop))throw Error('黄変・1ハゼ・排出は 0 < 黄変 < 1ハゼ < 排出 にしてください');
    if(drop>points[points.length-1].t)throw Error('排出時刻はCSVの最後の時刻以内にしてください');
    return {name:String(batch.name||'バッチ').slice(0,80),points,yellow,crack,drop,
      temps:{yellow:interpolate(points,yellow),crack:interpolate(points,crack),drop:interpolate(points,drop)},
      phases:[yellow,crack-yellow,drop-crack],dtr:(drop-crack)/drop*100};
  }
  function timeAtPhase(p,position) {
    const x=Math.max(0,Math.min(100,position));
    if(x<=100/3)return p.yellow*x/(100/3);
    if(x<=200/3)return p.yellow+(p.crack-p.yellow)*(x-100/3)/(100/3);
    return p.crack+(p.drop-p.crack)*(x-200/3)/(100/3);
  }
  function timeAtAxis(p,x,mode) {
    return mode==='phase'?timeAtPhase(p,x):mode==='crack'?x+p.crack:x;
  }
  function compare(a,b,mode='phase') {
    if(!['phase','crack','elapsed'].includes(mode))throw Error('表示方式が不正です');
    const A=validate(a),B=validate(b);
    let min,max;
    if(mode==='phase'){min=0;max=100;}
    else if(mode==='crack'){min=Math.max(-A.crack,-B.crack);max=Math.min(A.drop-A.crack,B.drop-B.crack);}
    else {min=0;max=Math.min(A.drop,B.drop);}
    if(max<=min)throw Error('共通の比較区間がありません');
    const rows=[]; let total=0,maxGap=-1, maxAt=0;
    for(let i=0;i<=100;i++) {
      const x=min+(max-min)*i/100;
      const ta=timeAtAxis(A,x,mode),tb=timeAtAxis(B,x,mode);
      const ca=interpolate(A.points,ta),cb=interpolate(B.points,tb);
      if(ca==null||cb==null)throw Error('比較範囲がCSVに含まれていません');
      const gap=cb-ca; total+=Math.abs(gap);
      if(Math.abs(gap)>maxGap){maxGap=Math.abs(gap);maxAt=x;}
      rows.push({x,ta,tb,a:ca,b:cb,diff:gap});
    }
    const part={};
    if(mode==='phase')for(const [label,from,to] of [['dry',0,1/3],['maillard',1/3,2/3],['develop',2/3,1]]) {
      const r=rows.filter(q=>q.x>=from*100-1e-7&&q.x<=to*100+1e-7);
      part[label]=r.reduce((v,q)=>v+Math.abs(q.diff),0)/r.length;
    }
    return {A,B,mode,min,max,rows,mae:total/rows.length,maxGap,maxAt,part,
      gapDtr:B.dtr-A.dtr,gapDrop:B.temps.drop-A.temps.drop};
  }
  function ror(p,t,windowSec=30) {
    if(t<0||t>p.drop)return null;
    const lo=Math.max(0,t-windowSec/2),hi=Math.min(p.drop,t+windowSec/2);
    if(hi===lo)return 0;
    return (interpolate(p.points,hi)-interpolate(p.points,lo))*60/(hi-lo);
  }
  function csvQuote(v) {const s=String(v==null?'':v);return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
  function exportCsv(result) {
    const header='axis,elapsed_A_sec,elapsed_B_sec,bean_A_C,bean_B_C,B_minus_A_C';
    return [header,...result.rows.map(r=>[r.x,r.ta,r.tb,r.a,r.b,r.diff].map(n=>csvQuote(Number(n.toFixed(3)))).join(','))].join('\r\n')+'\r\n';
  }
  return {DEMO,seconds,formatTime,parseCsv,interpolate,validate,timeAtPhase,compare,ror,exportCsv};
});