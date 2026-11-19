/* TANE TSUNAGI: deterministic capacity-constrained succession planner. No network. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SeedEngine = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const PALETTE = ['#76a96a', '#dcb96f', '#a78bbb', '#ed9c7d', '#77aca9', '#b0bf78', '#8fa6d4', '#c49d9a'];
  const DEMO = {
    version: 1, startDate: '2026-11-23', weeks: 16, capacity: 5, target: 2, mode: 'coverage',
    crops: [
      {id:'komatsuna', name:'コマツナ', lead:3, harvest:1, units:1, yield:2, sowStart:0, sowEnd:11, maxBatches:5, color:PALETTE[0]},
      {id:'lettuce', name:'リーフレタス', lead:4, harvest:2, units:1, yield:1, sowStart:0, sowEnd:10, maxBatches:4, color:PALETTE[1]},
      {id:'radish', name:'ラディッシュ', lead:3, harvest:1, units:1, yield:1, sowStart:0, sowEnd:11, maxBatches:5, color:PALETTE[2]},
      {id:'scallion', name:'葉ネギ', lead:5, harvest:3, units:2, yield:2, sowStart:0, sowEnd:8, maxBatches:3, color:PALETTE[3]}
    ], pinned: []
  };
  const clone = x => JSON.parse(JSON.stringify(x));
  const integer = (v,min,max,defaultValue) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : defaultValue; };
  function normalise(input) {
    if (!input || typeof input !== 'object' || !Array.isArray(input.crops)) throw Error('正しい計画JSONではありません。');
    const weeks = integer(input.weeks, 6, 24, 16);
    const capacity = integer(input.capacity, 1, 24, 4);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(input.startDate || '') && Number.isFinite(Date.parse(input.startDate+'T00:00:00Z')) ? input.startDate : DEMO.startDate;
    const crops = input.crops.slice(0,8).map((c,i) => ({
      id: String(c.id || `crop${i}`).slice(0,32).replace(/[^a-zA-Z0-9_-]/g,'') || `crop${i}`,
      name: String(c.name || `作物${i+1}`).slice(0,32),
      lead: integer(c.lead,1,12,3), harvest:integer(c.harvest,1,8,2),
      units:integer(c.units,1,capacity,1), yield:integer(c.yield,1,12,1),
      sowStart:integer(c.sowStart,0,weeks-1,0), sowEnd:integer(c.sowEnd,0,weeks-1,weeks-1),
      maxBatches:integer(c.maxBatches,1,16,4),
      color: PALETTE[i % PALETTE.length]
    }));
    if (!crops.length) throw Error('作物を1つ以上登録してください。');
    const ids = new Set();
    crops.forEach((c,i) => { if (ids.has(c.id)) c.id=`crop_${i}`; ids.add(c.id); });
    return {
      version:1, startDate:date, weeks, capacity,
      target:integer(input.target,1,30,3),
      mode:input.mode==='lowwork'?'lowwork':'coverage', crops,
      pinned:Array.isArray(input.pinned) ? input.pinned.slice(0,120).map(p=>({cropId:String(p.cropId||''), week:integer(p.week,0,weeks-1,0)})) : []
    };
  }
  function getCandidate(crop, week) {
    return {cropId:crop.id, week, harvestFrom:week+crop.lead, harvestTo:week+crop.lead+crop.harvest, occupiedTo:week+crop.lead+crop.harvest, units:crop.units, yield:crop.yield};
  }
  function candidates(config) {
    const out = [];
    for (const crop of config.crops) for (let w=crop.sowStart;w<=crop.sowEnd;w++) {
      if (w+crop.lead<config.weeks) out.push(getCandidate(crop,w));
    }
    return out;
  }
  const key = c=>`${c.cropId}:${c.week}`;
  function describe(config, chosen) {
    const crops = new Map(config.crops.map(c=>[c.id,c]));
    const used = Array(config.weeks).fill(0), supply=Array(config.weeks).fill(0);
    const breakdown=Array.from({length:config.weeks},()=>({}));
    const batches={}; let invalid=null;
    const keys=new Set();
    for (const pick of chosen) {
      const crop = crops.get(pick.cropId);
      if (!crop) {invalid='登録されていない作物が含まれています。';continue;}
      const w = Number(pick.week);
      if (!Number.isInteger(w) || w<crop.sowStart || w>crop.sowEnd || w+crop.lead>=config.weeks) {invalid=`${crop.name}の種まき週が適用範囲外です。`;continue;}
      const k=key(pick);
      if (keys.has(k)) {invalid='同じ作物を同じ週に重複登録しています。';continue;}
      keys.add(k); batches[crop.id]=(batches[crop.id]||0)+1;
      if (batches[crop.id]>crop.maxBatches) invalid=`${crop.name}の種まき上限を超えています。`;
      for(let j=w;j<Math.min(config.weeks,w+crop.lead+crop.harvest);j++) used[j]+=crop.units;
      for(let j=w+crop.lead;j<Math.min(config.weeks,w+crop.lead+crop.harvest);j++) {
        supply[j]+=crop.yield; breakdown[j][crop.id]=(breakdown[j][crop.id]||0)+crop.yield;
      }
    }
    if (used.some(u=>u>config.capacity)) invalid='プランター枠を超えている週があります。';
    const actual=supply.reduce((a,v)=>a+v,0);
    const useful=supply.reduce((a,v)=>a+Math.min(v,config.target),0);
    const shortages=supply.reduce((a,v)=>a+Math.max(0,config.target-v),0);
    const overflow=actual-useful;
    const met=supply.filter(v=>v>=config.target).length;
    const occupied=used.reduce((a,v)=>a+v,0);
    const score=useful*10 + met*2 - overflow*.45 - chosen.length*(config.mode==='lowwork'?30:.6) - occupied*.04;
    return {valid:!invalid, error:invalid, used, supply, breakdown, actual, useful, shortages, overflow,
      met, occupied, score, chosen:chosen.length, coverage:Math.round(useful/(config.target*config.weeks)*100)};
  }
  function tryAdd(config, picks, pick) {
    const candidate=getCandidate(config.crops.find(c=>c.id===pick.cropId), pick.week);
    const next=picks.concat([{cropId:candidate.cropId,week:candidate.week}]);
    return describe(config,next).valid ? next : null;
  }
  function checkPinned(config) { const d=describe(config,config.pinned); if(!d.valid) throw Error(`固定した種まきに矛盾があります：${d.error}`); }
  function plan(configInput) {
    const config=normalise(configInput);
    checkPinned(config);
    const all=candidates(config), pinnedKeys=new Set(config.pinned.map(key));
    let best=null;
    const priorities=[0,1,2,3,4,5];
    for(const variant of priorities) {
      let selected=clone(config.pinned);
      let info=describe(config,selected);
      for(let iteration=0;iteration<150;iteration++) {
        let choice=null, nextInfo=null, maxPriority=1e-8;
        for(const cand of all) {
          if(selected.some(p=>key(p)===key(cand))) continue;
          const next=tryAdd(config,selected,cand); if(!next)continue;
          const d=describe(config,next);
          const gain=d.score-info.score;
          const effort=cand.units*(cand.occupiedTo-cand.week);
          const preference=[gain, gain/Math.pow(effort,.7), gain/Math.pow(cand.occupiedTo-cand.week,.9),
            gain/Math.pow(cand.units,1.5), gain*(1+.025*(config.weeks-cand.harvestFrom)), gain/(1+Math.abs(cand.harvestFrom-config.weeks/2)*.15)][variant];
          if(gain>1e-8 && (preference>maxPriority+1e-8 ||
             (Math.abs(preference-maxPriority)<=1e-8 && choice && cand.week<choice.week))) {
            choice=cand; nextInfo=d; maxPriority=preference;
          }
        }
        if(!choice)break;
        selected.push({cropId:choice.cropId,week:choice.week}); info=nextInfo;
      }
      // Local 1-for-1 replacement catches blocking early choices.
      for(let pass=0;pass<5;pass++) {
        let changed=false;
        for(let i=selected.length-1;i>=0;i--) {
          if(pinnedKeys.has(key(selected[i])))continue;
          const without=selected.filter((_,j)=>j!==i);
          let alternative=null, better=info.score+1e-8;
          for(const cand of all) {
            if(without.some(p=>key(p)===key(cand)))continue;
            const next=tryAdd(config,without,cand);if(!next)continue;
            const d=describe(config,next);
            if(d.score>better){alternative={cand,d};better=d.score;}
          }
          if(alternative){selected=without.concat([{cropId:alternative.cand.cropId,week:alternative.cand.week}]);info=alternative.d;changed=true;break;}
        }
        if(!changed)break;
      }
      selected.sort((a,b)=>a.week-b.week||a.cropId.localeCompare(b.cropId));
      if(!best||info.score>best.stats.score)best={selected,stats:info};
    }
    return {...best, config};
  }
  function addPin(config,pick) {
    const next=normalise(config); const crop=next.crops.find(c=>c.id===pick.cropId);
    if(!crop)throw Error('作物を選択してください。');
    const week=Number(pick.week);
    if(!Number.isInteger(week))throw Error('週を選択してください。');
    if(next.pinned.some(p=>p.cropId===crop.id&&p.week===week))throw Error('その週はすでに固定されています。');
    next.pinned.push({cropId:crop.id,week}); checkPinned(next); return next;
  }
  function dateFor(startDate,week) {
    const d=new Date(`${startDate}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+week*7);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }
  function exportCsv(planObj) {
    const {config,selected}=planObj;
    const rows=[['作物','種まき日','収穫開始日','収穫終了日（含まず）','必要枠','週当たり予定量','手動固定']];
    const esc=s=>{const t=String(s);const clean=/^[=+@\-\t\r]/.test(t)?"'"+t:t;return '"'+clean.replaceAll('"','""')+'"';};
    for(const p of selected){const c=config.crops.find(c=>c.id===p.cropId);
      rows.push([c.name,dateFor(config.startDate,p.week),dateFor(config.startDate,p.week+c.lead),dateFor(config.startDate,p.week+c.lead+c.harvest),c.units,c.yield,config.pinned.some(x=>key(x)===key(p))?'はい':'いいえ']);
    }
    return '\ufeff'+rows.map(r=>r.map(esc).join(',')).join('\r\n');
  }
  return {DEMO:clone(DEMO),PALETTE,normalise,describe,plan,addPin,candidates,dateFor,exportCsv,getCandidate,clone};
});