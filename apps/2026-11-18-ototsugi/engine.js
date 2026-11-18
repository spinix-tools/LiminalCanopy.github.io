/* OTO-TSUGI — deterministic local-only patch planning core. MIT. */
(function (root, make) {
  const api = make();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OtoEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FAMILIES = ['Vocal', 'Drums', 'Guitar', 'Bass', 'Keys', 'Playback', 'Other'];
  const uid = () => Math.random().toString(36).slice(2, 10);
  function sample() {
    return { title: '土曜の3組ライブ', capacity: 16, acts: [
      {id:'a1', name:'青い月', inputs:[
        {id:'a11',label:'Kick',family:'Drums',phantom:false,lock:1},
        {id:'a12',label:'Snare',family:'Drums',phantom:false,lock:2},
        {id:'a13',label:'Guitar',family:'Guitar',phantom:false,lock:0},
        {id:'a14',label:'Bass DI',family:'Bass',phantom:true,lock:0},
        {id:'a15',label:'Lead Vox',family:'Vocal',phantom:false,lock:0}]},
      {id:'a2', name:'琥珀トリオ', inputs:[
        {id:'a21',label:'Cajon',family:'Drums',phantom:false,lock:0},
        {id:'a22',label:'Guitar',family:'Guitar',phantom:false,lock:0},
        {id:'a23',label:'Bass DI',family:'Bass',phantom:true,lock:0},
        {id:'a24',label:'Lead Vox',family:'Vocal',phantom:false,lock:0}]},
      {id:'a3', name:'波止場セッション', inputs:[
        {id:'a31',label:'Kick',family:'Drums',phantom:false,lock:1},
        {id:'a32',label:'Snare',family:'Drums',phantom:false,lock:2},
        {id:'a33',label:'Keys L',family:'Keys',phantom:false,lock:0},
        {id:'a34',label:'Keys R',family:'Keys',phantom:false,lock:0},
        {id:'a35',label:'Lead Vox',family:'Vocal',phantom:false,lock:0}]}
    ]};
  }
  const text = (s,n=80) => String(s ?? '').trim().slice(0,n);
  function normalize(raw) {
    if (!raw || typeof raw !== 'object') throw Error('JSONの形式が不正です');
    const capacity=Number(raw.capacity);
    if(!Number.isInteger(capacity) || ![8,16,24,32].includes(capacity)) throw Error('回線数は8/16/24/32を選択してください');
    if (!Array.isArray(raw.acts) || raw.acts.length > 12) throw Error('出演枠は12組以内です');
    const seenAct=new Set(), seenInputs=new Set();
    return {title:text(raw.title,100)||'名称未設定', capacity, acts:raw.acts.map((a,i)=>{
      if(!a || !Array.isArray(a.inputs) || a.inputs.length>32) throw Error('入力数は各組32以内です');
      const id=text(a.id,50)||'act'+i;
      if(seenAct.has(id)) throw Error('出演枠IDが重複しています'); seenAct.add(id);
      return {id,name:text(a.name,70)||`出演 ${i+1}`,inputs:a.inputs.map((v,j)=>{
        if(!v || typeof v!=='object') throw Error('入力形式が不正です');
        const vi=text(v.id,50)||id+'-'+j;
        if(seenInputs.has(vi)) throw Error('入力IDが重複しています');seenInputs.add(vi);
        const lock=Number(v.lock||0);
        if (!Number.isInteger(lock) || lock < 0 || lock > 32) throw Error('固定回線は0〜32です');
        return {id:vi,label:text(v.label,70)||`Input ${j+1}`,family:FAMILIES.includes(v.family)?v.family:'Other',phantom:!!v.phantom,lock};
      })};
    })};
  }
  function signature(v){return (v.label||'').toLowerCase().replace(/\s+/g,'')+'|'+v.family+'|'+(+v.phantom);}
  function transition(a,b) {
    if(!a&&!b)return {cost:0,kind:'empty'};
    if(!a&&b)return {cost:3,kind:'new'};
    if(a&&!b)return {cost:1,kind:'remove'};
    if(signature(a)===signature(b))return {cost:0,kind:'keep'};
    if(a.phantom!==b.phantom)return {cost:7,kind:'phantom'};
    if(a.family===b.family)return {cost:1,kind:'relabel'};
    return {cost:6,kind:'rewire'};
  }
  // Hungarian minimum-cost assignment: sources as rows, physical channels as columns.
  function assign(prev, inputs, capacity) {
    const n=inputs.length,m=capacity;
    if(n>m) throw Error(`入力${n}本が${m}chを超過しています`);
    const reserved=new Set();
    for(const inp of inputs){
      if(inp.lock>m)throw Error(`「${inp.label}」固定${inp.lock}chが上限を超過`);
      if(inp.lock && reserved.has(inp.lock))throw Error(`固定${inp.lock}chが重複`);
      if(inp.lock)reserved.add(inp.lock);
    }
    if(!n)return Array(m).fill(null);
    const INF=1000000;
    const cost=(i,j)=>{
      const v=inputs[i];
      if((v.lock && v.lock!==j+1)||(!v.lock && reserved.has(j+1)))return INF;
      // Main weight makes classifications dominate deterministic tie-breaks.
      return transition(prev[j],v).cost*1000 + j*2 + i;
    };
    const u=Array(n+1).fill(0),v=Array(m+1).fill(0),p=Array(m+1).fill(0),way=Array(m+1).fill(0);
    for(let i=1;i<=n;i++){
      p[0]=i;let j0=0;const minv=Array(m+1).fill(Infinity),used=Array(m+1).fill(false);
      do {
        used[j0]=true;const i0=p[j0];let delta=Infinity,j1=0;
        for(let j=1;j<=m;j++)if(!used[j]){
          const cur=cost(i0-1,j-1)-u[i0]-v[j];
          if(cur<minv[j]){minv[j]=cur;way[j]=j0;}
          if(minv[j]<delta){delta=minv[j];j1=j;}
        }
        for(let j=0;j<=m;j++)if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else minv[j]-=delta;
        j0=j1;
      }while(p[j0]!==0);
      do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0);
    }
    const result=Array(m).fill(null);
    for(let j=1;j<=m;j++)if(p[j])result[j-1]=inputs[p[j]-1];
    return result;
  }
  function plan(raw){
    const project=normalize(raw), issues=[]; let prev=Array(project.capacity).fill(null),score=0;
    const steps=[];
    for(let a=0;a<project.acts.length;a++){
      const act=project.acts[a]; let channels;
      try{channels=assign(prev,act.inputs,project.capacity);}
      catch(err){issues.push(`${act.name}：${err.message}`);steps.push({act,channels:null,changes:[],score:null});continue;}
      const changes=[]; let subtotal=0;
      for(let i=0;i<project.capacity;i++){
        const from=prev[i],to=channels[i],kind=transition(from,to);
        if(kind.kind!=='empty'&&kind.kind!=='keep')changes.push({ch:i+1,from:from?.label||'—',to:to?.label||'—',kind:kind.kind,cost:kind.cost,oldPhantom:!!from?.phantom,newPhantom:!!to?.phantom});
        subtotal+=kind.cost;
      }
      steps.push({act,channels,changes,score:subtotal});score+=subtotal;prev=channels;
    }
    return {project,steps,issues,totalScore:issues.length?null:score,transitions:steps.reduce((a,s)=>a+s.changes.length,0)};
  }
  function csv(analysis){
    const head=['出演順','出演名','ch','音源','種別','48V','固定','変更種別'];
    const quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
    const rows=[head];
    for(const [idx,s] of analysis.steps.entries())if(s.channels)for(let i=0;i<s.channels.length;i++){
      const v=s.channels[i];if(!v)continue;
      rows.push([idx+1,s.act.name,i+1,v.label,v.family,v.phantom?'要確認':'不要',v.lock||'',s.changes.find(c=>c.ch===i+1)?.kind||'keep']);
    }
    return '\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n');
  }
  function suggestOrder(raw){
    const p=normalize(raw);if(p.acts.length<3||p.acts.length>7)return null;
    // Pairwise approximation, keeping source-count and source-family structure.
    const abstract=(a,b)=>{
      const aa=a.inputs.map(v=>v.family+'|'+(+v.phantom)),bb=b.inputs.map(v=>v.family+'|'+(+v.phantom));
      const counts=new Map();for(const x of aa)counts.set(x,(counts.get(x)||0)+1);
      let shared=0;for(const x of bb)if(counts.get(x)>0){shared++;counts.set(x,counts.get(x)-1);}
      return (aa.length-shared)+(bb.length-shared);
    };
    const acts=p.acts,best={score:Infinity,order:null};
    const go=(path,remaining,score)=>{
      if(score>=best.score)return;
      if(!remaining.length){best.score=score;best.order=path;return;}
      for(const ix of remaining){const next=path.concat(ix);go(next,remaining.filter(v=>v!==ix),score+(path.length?abstract(acts[path.at(-1)],acts[ix]):acts[ix].inputs.length));}
    };
    go([],acts.map((_,i)=>i),0);
    const candidate=best.order?.map(i=>acts[i]);if(!candidate)return null;
    const current=plan(p),alt=plan({...p,acts:candidate});
    if(alt.totalScore!==null&&current.totalScore!==null&&alt.totalScore<current.totalScore)return {order:candidate.map(a=>a.id),names:candidate.map(a=>a.name),score:alt.totalScore,saving:current.totalScore-alt.totalScore};
    return null;
  }
  return {FAMILIES,sample,normalize,signature,transition,assign,plan,csv,suggestOrder,uid};
});
