/* KOBAN TSUNAGI — pure scheduling engine. No dependencies or network. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KobanEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(n)) ? Number(n) : min));
  function clockToMinutes(s) {
    if (typeof s !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s)) return null;
    const [h,m] = s.split(':').map(Number);
    return h*60+m;
  }
  function minuteLabel(n) {
    const x=Math.max(0,Math.round(n));
    return `${String(Math.floor(x/60)).padStart(2,'0')}:${String(x%60).padStart(2,'0')}${x>=1440?' +1日':''}`;
  }
  function uniqueIds(values) { return [...new Set((Array.isArray(values) ? values : []).filter(v=>typeof v==='string'))]; }
  function normalizeProject(raw) {
    const p = raw && typeof raw==='object' ? raw : {};
    const s = p.settings && typeof p.settings==='object' ? p.settings : {};
    const actors = (Array.isArray(p.actors)?p.actors:[]).slice(0,20).map((a,i)=>({
      id: String(a.id || 'actor-'+i).slice(0,60), label:String(a.label||'役'+(i+1)).slice(0,60),
      from: clockToMinutes(a.from)!==null ? a.from : '08:00',
      to: clockToMinutes(a.to)!==null ? a.to : '19:00'
    }));
    const known = new Set(actors.map(a=>a.id));
    const scenes = (Array.isArray(p.scenes)?p.scenes:[]).slice(0,40).map((v,i)=>({
      id: String(v.id || 'scene-'+i).slice(0,60),
      title:String(v.title||'シーン '+(i+1)).slice(0,100),
      location:String(v.location||'未設定').slice(0,60),
      duration:Math.round(clamp(v.duration,5,240)),
      cast:uniqueIds(v.cast).filter(id=>known.has(id))
    }));
    // Restore unique, consistent IDs for data originating from imported JSON.
    const fixIds = (arr,prefix) => {const seen=new Set();for(let i=0;i<arr.length;i++){if(!arr[i].id||seen.has(arr[i].id))arr[i].id=`${prefix}-safe-${i}`;seen.add(arr[i].id);}};
    fixIds(actors,'actor');fixIds(scenes,'scene');
    return {
      version:1, title:String(p.title||'小さな撮影の一日').slice(0,100),
      settings:{
        start:clockToMinutes(s.start)!==null?s.start:'09:00',
        end:clockToMinutes(s.end)!==null?s.end:'18:00',
        lunch:clockToMinutes(s.lunch)!==null?s.lunch:'12:00',
        lunchMinutes:Math.round(clamp(s.lunchMinutes??45,0,120)),
        moveMinutes:Math.round(clamp(s.moveMinutes??20,0,120))
      }, actors, scenes
    };
  }
  function makePlan(project, overrideOrder) {
    const p=normalizeProject(project),s=p.settings,actorById=new Map(p.actors.map(a=>[a.id,a]));
    const start=clockToMinutes(s.start), finish=clockToMinutes(s.end)+(clockToMinutes(s.end)<=start?1440:0), lunchAt=clockToMinutes(s.lunch);
    const indexed=new Map(p.scenes.map(sc=>[sc.id,sc]));
    const selected=overrideOrder ? overrideOrder.map(id=>indexed.get(id)).filter(Boolean) : p.scenes;
    const blocks=[], issues=[];let t=start, lastLoc=null, lunchDone=s.lunchMinutes===0, moves=0, waiting=0, shoot=0, mealStart=null;
    const append=(kind,label,minutes,extra={})=>{const b={kind,label,start:t,end:t+minutes,...extra};blocks.push(b);t+=minutes;return b;};
    for(const sc of selected){
      if(lastLoc!==null && sc.location!==lastLoc && s.moveMinutes>0){append('move',`移動 ${lastLoc} → ${sc.location}`,s.moveMinutes);moves++;}
      const arrival=Math.max(t,...sc.cast.map(id=>{const a=actorById.get(id);return a?clockToMinutes(a.from):t;}));
      if(arrival>t){waiting+=arrival-t;append('wait',`待機：出演者の到着まで`,arrival-t);}
      if(!lunchDone && t >= lunchAt-45 && (t>=lunchAt || t+sc.duration>lunchAt)){
        mealStart=t;append('lunch','昼休憩',s.lunchMinutes);lunchDone=true;
        if(mealStart>lunchAt+30)issues.push({level:'warn',code:'LATE_LUNCH',message:`昼休憩が${minuteLabel(mealStart)}に後ろ倒しです`,blockId:null});
      }
      // Lunch can push an available actor past their departure time; issue diagnostics below.
      const b=append('scene',sc.title,sc.duration,{sceneId:sc.id,location:sc.location,cast:sc.cast});shoot+=sc.duration;
      for(const id of sc.cast){
        const a=actorById.get(id);if(!a)continue;
        const from=clockToMinutes(a.from),to=clockToMinutes(a.to)+(clockToMinutes(a.to)<from?1440:0);
        if(b.start<from || b.end>to){
          issues.push({level:'error',code:'CAST_WINDOW',sceneId:sc.id,blockId:sc.id,
            message:`${sc.title}：${a.label}の拘束可能時間（${a.from}–${a.to}）を超過`});
        }
      }
      lastLoc=sc.location;
    }
    if(!lunchDone && s.lunchMinutes>0 && t>=lunchAt+30)issues.push({level:'warn',code:'NO_LUNCH',message:'昼休憩を組めていません（シーン間に空きが必要）'});
    if(t>finish)issues.push({level:'error',code:'OVERTIME',message:`終了予定より${t-finish}分超過（${minuteLabel(t)}まで）`});
    const span=t-start, overtime=Math.max(0,t-finish), castViolations=issues.filter(x=>x.code==='CAST_WINDOW').length;
    // A scheduling score, not a promise of optimality: prioritize violations then overtime, waiting and moves.
    const score=castViolations*2000 + overtime*25 + waiting*5 + moves*s.moveMinutes*3 + issues.filter(x=>x.code==='LATE_LUNCH'||x.code==='NO_LUNCH').length*300 + span*0.05;
    return {blocks,issues,span,score,moves,waiting,shoot,overtime,start,end:t,cutoff:finish,castViolations,order:selected.map(sc=>sc.id)};
  }
  function optimize(project, options={}) {
    const p=normalizeProject(project), original=makePlan(p);
    const n=p.scenes.length;
    if(n<=1)return {before:original,after:original,order:original.order,improved:false,explored:1};
    // Deterministic bounded beam search. Fewer than 2^N states are inspected for large projects.
    const width=Math.round(clamp(options.width??70,1,180));
    const limit=Math.round(clamp(options.limit??15000,100,40000));
    const ids=p.scenes.map(x=>x.id);let beam=[{order:[],remaining:ids,score:0}], explored=0;
    // Stepwise evaluation of partial schedules is heuristic; final scoring always rechecks full schedule.
    for(let depth=0;depth<n;depth++){
      const next=[];
      for(const item of beam){for(const id of item.remaining){
        const ord=[...item.order,id],remaining=item.remaining.filter(x=>x!==id);
        const pp={...p,scenes:ord.map(x=>p.scenes.find(v=>v.id===x))};
        const evaluation=makePlan(pp);explored++;
        next.push({order:ord,remaining,score:evaluation.score});
        if(explored>=limit)break;
      }if(explored>=limit)break;}
      if(!next.length)break;
      next.sort((a,b)=>a.score-b.score || a.order.join('|').localeCompare(b.order.join('|')));
      // Keep the best distinct ordered prefixes.
      beam=next.slice(0,width);
    }
    let best=original;
    for(const item of beam){if(item.remaining.length)continue;const plan=makePlan(p,item.order);if(plan.score+1e-9<best.score)best=plan;}
    return {before:original,after:best,order:best.order,improved:best.score+1e-9<original.score,explored};
  }
  function exampleProject(){return normalizeProject({title:'ブランドムービー / 撮影1日目',settings:{start:'09:00',end:'17:30',lunch:'12:00',lunchMinutes:45,moveMinutes:20},actors:[
    {id:'talent-a',label:'出演A',from:'09:00',to:'12:15'},
    {id:'talent-b',label:'出演B',from:'12:30',to:'17:00'},
    {id:'narrator',label:'出演C',from:'10:00',to:'15:00'}],scenes:[
    {id:'s1',title:'商品カット・寄り',location:'スタジオ',duration:50,cast:[]},
    {id:'s2',title:'インタビュー A',location:'屋内ラウンジ',duration:65,cast:['talent-a']},
    {id:'s3',title:'街歩き B',location:'屋外',duration:55,cast:['talent-b']},
    {id:'s4',title:'製品の手元',location:'スタジオ',duration:35,cast:[]},
    {id:'s5',title:'対話カット A・C',location:'屋内ラウンジ',duration:55,cast:['talent-a','narrator']},
    {id:'s6',title:'フィナーレ B',location:'屋外',duration:50,cast:['talent-b']}
  ]});}
  function toCsv(p,plan=makePlan(p)){
    const esc=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const header=['種類','内容','開始','終了','分数','ロケーション','出演'];
    const actors=new Map(p.actors.map(a=>[a.id,a.label]));
    return '\uFEFF'+[header,...plan.blocks.map(b=>[b.kind,b.label,minuteLabel(b.start),minuteLabel(b.end),b.end-b.start,b.location||'',(b.cast||[]).map(id=>actors.get(id)||'').join('・')])].map(row=>row.map(esc).join(',')).join('\r\n');
  }
  return {clockToMinutes,minuteLabel,normalizeProject,makePlan,optimize,exampleProject,toCsv};
});
