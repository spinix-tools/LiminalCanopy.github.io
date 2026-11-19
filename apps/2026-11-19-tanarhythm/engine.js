/* 棚リズム - dependency-free UMD calculation engine. MIT */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ShelfEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const round = (x, n=2) => Number(x.toFixed(n));
  const clamp = (x, low, high) => Math.max(low, Math.min(high, x));
  const finite = (n, name, min, max) => {
    const x = Number(n);
    if (!Number.isFinite(x) || x < min || x > max) throw Error(`${name} は ${min}〜${max} の数値で指定してください`);
    return x;
  };
  const sample = () => ({
    shelf: { width: 120, height: 26, depth: 30, days: 3 },
    products: [
      { id:'tea', name:'ほうじ茶 80g', width:8, height:18, depth:7, daily:3.5, margin:190, min:1, max:6, faces:2, color:'#6B8F80' },
      { id:'jam', name:'季節のジャム', width:7, height:12, depth:7, daily:2.4, margin:240, min:1, max:6, faces:2, color:'#D69D72' },
      { id:'nuts', name:'ナッツ小袋', width:10, height:20, depth:5, daily:4.0, margin:140, min:1, max:5, faces:2, color:'#C6AC70' },
      { id:'soap', name:'ハーブ石けん', width:9, height:9, depth:4, daily:1.2, margin:320, min:1, max:5, faces:2, color:'#8A9BC2' },
      { id:'coffee', name:'ドリップ珈琲', width:12, height:17, depth:5, daily:2.8, margin:210, min:1, max:5, faces:2, color:'#AE8E7E' },
    ]
  });
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || !raw.shelf || !Array.isArray(raw.products)) throw Error('棚と商品リストが必要です');
    const s = raw.shelf;
    const shelf = {
      width: finite(s.width,'棚幅(cm)',20,400),
      height: finite(s.height,'棚高(cm)',5,200),
      depth: finite(s.depth,'棚奥行(cm)',5,150),
      days: finite(s.days,'補充までの日数',0.5,30)
    };
    if (raw.products.length > 24) throw Error('商品は24種類までです');
    const products = raw.products.map((p,i) => {
      if (!p || typeof p !== 'object') throw Error('商品の形式が不正です');
      const name = String(p.name || '').trim().slice(0,40);
      if (!name) throw Error(`商品${i+1}に名前が必要です`);
      const product = {
        id: String(p.id || `p${i+1}`).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,35) || `p${i+1}`,
        name,
        width: finite(p.width, `${name}の幅`,0.5,200),
        height: finite(p.height,`${name}の高さ`,0.5,200),
        depth: finite(p.depth,`${name}の奥行`,0.5,150),
        daily: finite(p.daily,`${name}の1日販売数`,0,1000),
        margin: finite(p.margin,`${name}の単品粗利`,0,100000),
        min: finite(p.min,`${name}の最低フェイス`,0,12),
        max: finite(p.max,`${name}の最大フェイス`,0,12),
        faces: finite(p.faces ?? p.min,`${name}のフェイス`,0,12),
        color: /^#[0-9a-fA-F]{6}$/.test(String(p.color)) ? p.color : ['#6B8F80','#D69D72','#C6AC70','#8A9BC2','#AE8E7E'][i%5]
      };
      for (const k of ['min','max','faces']) if (!Number.isInteger(product[k])) throw Error('フェイス数は整数にしてください');
      if (product.min > product.max) throw Error(`${name}は最低フェイスが最大フェイスより多いです`);
      return product;
    });
    if (new Set(products.map(x=>x.id)).size !== products.length) throw Error('商品IDが重複しています');
    return {shelf,products};
  }
  function faceDepth(shelf, product) {
    return product.height <= shelf.height && product.depth <= shelf.depth ? Math.floor((shelf.depth + 1e-9)/product.depth) : 0;
  }
  function measure(raw, facings) {
    const state = normalize(raw);
    const {shelf,products} = state;
    const f = facings ?? products.map(p=>p.faces);
    if (!Array.isArray(f) || f.length!==products.length) throw Error('フェイス数の個数が一致しません');
    let used=0, profit=0, lost=0, risky=0, visible=0;
    const rows = products.map((p,i)=>{
      const faces=Number(f[i]);
      if (!Number.isInteger(faces)||faces<0||faces>12) throw Error('フェイス数が不正です');
      const depthCount=faceDepth(shelf,p);
      const stock=depthCount*faces;
      const demand=p.daily*shelf.days;
      const sales=Math.min(stock,demand);
      const shortage=Math.max(0,demand-stock);
      const cm=faces*p.width;
      const profitRow=sales*p.margin;
      used+=cm; profit+=profitRow; lost+=shortage;
      if (shortage>1e-8) risky++;
      if (faces>0) visible++;
      return {...p,faces,depthCount,stock,demand,sales,shortage,cm,profit:profitRow,coverageDays:p.daily>0 ? stock/p.daily : null,fit:depthCount>0};
    });
    return {rows,used:round(used),free:round(shelf.width-used), utilization:round(100*used/shelf.width,1),profit:round(profit),lost:round(lost),riskCount:risky,visible,withinWidth:used<=shelf.width+1e-8,withinHeight:rows.every(x=>x.faces===0||x.fit),shelf};
  }
  /* Multiple-choice knapsack: choose exactly one facing count per SKU, max modeled interval gross profit. */
  function optimize(raw) {
    const state=normalize(raw);
    const {shelf,products}=state;
    const capacity=Math.floor(shelf.width*2+1e-7); // 0.5cm bins; individual widths round up, never overflow.
    let dp=Array(capacity+1).fill(-Infinity); dp[0]=0;
    const choices=[]; const parents=[];
    for (let i=0;i<products.length;i++) {
      const p=products[i], fits=faceDepth(shelf,p)>0;
      if (!fits && p.min>0) return {ok:false,error:`「${p.name}」は棚の高さ・奥行に入りません。必須フェイス数を0にしてください。`};
      const options=[];
      for(let n=p.min;n<=p.max;n++) {
        if (!fits && n>0) continue;
        const cost=Math.ceil(p.width*2-1e-8)*n;
        if(cost>capacity) continue;
        const sales=Math.min(p.daily*shelf.days,n*faceDepth(shelf,p));
        options.push({n,cost,score:sales*p.margin});
      }
      if (!options.length) return {ok:false,error:`「${p.name}」が棚幅に収まりません。`};
      const next=Array(capacity+1).fill(-Infinity);
      const trace=Array(capacity+1).fill(null);
      for(let w=0;w<=capacity;w++) if(dp[w]!==-Infinity) {
        for(const option of options) {
          const to=w+option.cost;
          if(to>capacity)continue;
          const score=dp[w]+option.score;
          if(score>next[to]+1e-8) {next[to]=score;trace[to]={prev:w,n:option.n};}
        }
      }
      dp=next;choices.push(options);parents.push(trace);
    }
    let bestW=0;
    for(let w=1;w<=capacity;w++) if(dp[w]>dp[bestW]+1e-8 || (dp[bestW]===-Infinity&&dp[w]>-Infinity)) bestW=w;
    if(dp[bestW]===-Infinity)return {ok:false,error:'必須フェイス数が棚に収まりません。棚幅や最低フェイス数を調整してください。'};
    const facings=Array(products.length);let w=bestW;
    for(let i=products.length-1;i>=0;i--) {const t=parents[i][w]; facings[i]=t.n;w=t.prev;}
    const evaluation=measure(state,facings);
    return {ok:true,facings,evaluation,method:'0.5cm単位の複数選択ナップサック法（端数は切り上げ）'};
  }
  function csv(raw,facings) {
    const m=measure(raw,facings);
    const safe=x=>{let s=String(x??'');if(/^[=+@\-\t\r]/.test(s)&&Number.isNaN(Number(s))) s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    return '\uFEFF'+[['商品','フェイス数','陳列幅cm','奥行列数','店頭在庫個数','期間需要個数(予測)','期間販売個数(予測)','欠品個数(予測)','期間粗利円(試算)'],...m.rows.map(x=>[x.name,x.faces,round(x.cm),x.depthCount,x.stock,round(x.demand),round(x.sales),round(x.shortage),round(x.profit)])].map(row=>row.map(safe).join(',')).join('\r\n');
  }
  return {sample,normalize,faceDepth,measure,optimize,csv,round,clamp};
});
