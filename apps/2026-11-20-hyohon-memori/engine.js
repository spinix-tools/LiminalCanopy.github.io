/* 標本メモリ - pure raking / diagnostic logic (MIT) */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Hyohon = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  function assert(ok, message) { if (!ok) throw new Error(message); }
  function number(value) { return Number(value); }
  function sum(a) { return a.reduce((s, x) => s + x, 0); }
  function demo() {
    return {
      title: '地域アンケート｜新サービスの利用意向', question: '利用したい（はい）の割合',
      rowTitle: '年代', colTitle: '居住地域',
      rows: [{name:'18〜29歳',target:25},{name:'30〜49歳',target:40},{name:'50歳以上',target:35}],
      cols: [{name:'都市部',target:60},{name:'その他地域',target:40}],
      cells: [ [{n:80,yes:43},{n:30,yes:20}], [{n:90,yes:49},{n:70,yes:42}], [{n:30,yes:10},{n:100,yes:48}] ]
    };
  }
  function validate(s) {
    assert(s && typeof s === 'object' && !Array.isArray(s), '設定形式が不正です');
    for (const key of ['title','question','rowTitle','colTitle']) assert(typeof s[key] === 'string' && s[key].length <= 100, `${key}は100文字以内の文字列にしてください`);
    assert(Array.isArray(s.rows) && s.rows.length >= 2 && s.rows.length <= 5, '年代などの区分は2〜5種類にしてください');
    assert(Array.isArray(s.cols) && s.cols.length >= 2 && s.cols.length <= 5, '地域などの区分は2〜5種類にしてください');
    for (const [key, axis] of [['行',s.rows],['列',s.cols]]) {
      for (const o of axis) {
        assert(o && typeof o.name === 'string' && o.name.trim() && o.name.length <= 40, `${key}の名前は1〜40文字にしてください`);
        assert(Number.isFinite(number(o.target)) && number(o.target)>=0 && number(o.target)<=100, `${key}の目標割合は0〜100にしてください`);
      }
      assert(Math.abs(sum(axis.map(o=>number(o.target)))-100) < 0.001, `${key}の目標割合の合計を100%にしてください`);
    }
    assert(Array.isArray(s.cells) && s.cells.length === s.rows.length, '行数と集計表が一致しません');
    let total=0;
    for (const line of s.cells) {
      assert(Array.isArray(line) && line.length === s.cols.length, '列数と集計表が一致しません');
      for (const c of line) {
        assert(c && Number.isSafeInteger(number(c.n)) && number(c.n)>=0 && number(c.n)<=1000000, '回答人数は0〜100万の整数にしてください');
        assert(Number.isSafeInteger(number(c.yes)) && number(c.yes)>=0 && number(c.yes)<=number(c.n), '「はい」は0〜回答人数の整数にしてください');
        total+=number(c.n);
      }
    }
    assert(total>0 && total<=1000000, '回答数の合計は1〜100万にしてください');
    return total;
  }
  // Iterative Proportional Fitting on group-level count mass.
  // Zero population cells remain zero: unlike pseudocount smoothing this never invents observations.
  function rake(s, mode='both', maxIterations=1500) {
    const N=validate(s);
    assert(mode==='both'||mode==='row', '不正な分析モードです');
    const R=s.rows.length,C=s.cols.length;
    const original=s.cells.map(line=>line.map(c=>number(c.n)));
    let mass=original.map(line=>line.slice());
    const rowT=s.rows.map(x=>N*number(x.target)/100), colT=s.cols.map(x=>N*number(x.target)/100);
    const rowSum=i=>sum(mass[i]);
    const colSum=j=>sum(mass.map(line=>line[j]));
    // Missing rows or columns with positive targets are impossible to calibrate.
    for(let i=0;i<R;i++) assert(rowT[i]===0||rowSum(i)>0, `「${s.rows[i].name}」は回答0人のため目標に合わせられません`);
    if(mode==='both') for(let j=0;j<C;j++) assert(colT[j]===0||colSum(j)>0, `「${s.cols[j].name}」は回答0人のため目標に合わせられません`);
    let residual=Infinity, iterations=0;
    for(let t=0;t<maxIterations;t++) {
      for(let i=0;i<R;i++) {
        const current=rowSum(i), factor=current>0?rowT[i]/current:0;
        for(let j=0;j<C;j++) mass[i][j]*=factor;
      }
      if(mode==='both') for(let j=0;j<C;j++) {
        const current=colSum(j), factor=current>0?colT[j]/current:0;
        for(let i=0;i<R;i++) mass[i][j]*=factor;
      }
      residual=Math.max(...rowT.map((v,i)=>Math.abs(rowSum(i)-v)), ...(mode==='both'?colT.map((v,j)=>Math.abs(colSum(j)-v)):[0]))/N*100;
      iterations=t+1;
      if(residual<1e-7) break;
    }
    assert(residual<1e-5, `目標に収束しません（残差${residual.toFixed(3)}ポイント）。空の交差セルや矛盾する割付を確認してください`);
    let yes=0,rawYes=0,sqWeight=0,minW=Infinity,maxW=0,nonzero=0;
    const weights=mass.map((line,i)=>line.map((m,j)=>{
      const n=original[i][j], w=n?m/n:0;
      if(n){nonzero++;minW=Math.min(minW,w);maxW=Math.max(maxW,w);sqWeight+=n*w*w;}
      yes+=number(s.cells[i][j].yes)*w;
      rawYes+=number(s.cells[i][j].yes);
      return w;
    }));
    const weightedTotal=sum(mass.flat());
    const ess=sqWeight>0?weightedTotal**2/sqWeight:0;
    const rows=s.rows.map((r,i)=>({name:r.name,target:number(r.target),before:sum(original[i])/N*100,after:sum(mass[i])/weightedTotal*100}));
    const cols=s.cols.map((c,j)=>({name:c.name,target:number(c.target),before:sum(original.map(line=>line[j]))/N*100,after:sum(mass.map(line=>line[j]))/weightedTotal*100}));
    return {N,rawShare:rawYes/N*100,weightedShare:yes/weightedTotal*100,ess,designEffect:N/ess,minWeight:minW,maxWeight:maxW,nonzero,weights,mass,rows,cols,residual,iterations,mode};
  }
  function compare(s) {
    const row=rake(s,'row');
    const both=rake(s,'both');
    return {row,both,rawShare:row.rawShare,delta:both.weightedShare-row.weightedShare,
      warnings:diagnose(s,both)};
  }
  function diagnose(s,result) {
    let warnings=[];
    if(result.N<100)warnings.push('回答数が100未満です。少数セルの影響を慎重に確認してください。');
    if(result.ess/result.N<0.6)warnings.push(`実効サンプルサイズの比率が${(result.ess/result.N*100).toFixed(0)}%まで低下しています。重みの偏りが大きい可能性があります。`);
    if(result.maxWeight>3)warnings.push(`最大ウェイト${result.maxWeight.toFixed(2)}倍です。少数セルに推計が強く依存します。`);
    const empty=s.cells.flat().filter(c=>number(c.n)===0).length;
    if(empty)warnings.push(`${empty}個の交差セルが空です。未観測層を補うことはできません。`);
    if(!warnings.length)warnings.push('計算上は収束しました。ただし非回答・募集経路などの偏りはこの方法では検出できません。');
    return warnings;
  }
  function safeCSV(v) {
    const value=String(v??'');
    const escaped=/^[\s\uFEFF]*[=+\-@\t\r]/.test(value) ? "'"+value : value;
    return '"'+escaped.replace(/"/g,'""')+'"';
  }
  function exportCSV(s,result) {
    const lines=[['区分A','区分B','回答数','はい','目標A(%)','目標B(%)','セルの重み','加重人数','加重はい人数'].map(safeCSV).join(',')];
    s.rows.forEach((r,i)=>s.cols.forEach((c,j)=>{
      const cell=s.cells[i][j], w=result.weights[i][j];
      lines.push([r.name,c.name,cell.n,cell.yes,r.target,c.target,w.toFixed(7),result.mass[i][j].toFixed(5),(cell.yes*w).toFixed(5)].map(safeCSV).join(','));
    }));
    return '\uFEFF'+lines.join('\r\n')+'\r\n';
  }
  function parseJSON(json){
    assert(typeof json==='string' && json.length<=200000,'ファイルサイズが大きすぎます');
    const state=JSON.parse(json);
    validate(state);
    return JSON.parse(JSON.stringify({title:state.title,question:state.question,rowTitle:state.rowTitle,colTitle:state.colTitle,rows:state.rows,cols:state.cols,cells:state.cells}));
  }
  return Object.freeze({demo,validate,rake,compare,diagnose,safeCSV,exportCSV,parseJSON});
});