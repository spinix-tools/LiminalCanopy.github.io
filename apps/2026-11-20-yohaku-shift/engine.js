/* YOHAKU SHIFT — pure, dependency-free assignment engine. MIT */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.YohakuEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const id = v => String(v ?? '');
  const finite = n => Number.isFinite(Number(n));
  function minutes(t) {
    if (!/^\d{2}:\d{2}$/.test(String(t))) return NaN;
    const [h, m] = t.split(':').map(Number);
    return h < 24 && m < 60 ? h * 60 + m : NaN;
  }
  function windows(s) {
    if (String(s ?? '').trim() === '*') return [[0,1440]];
    return String(s ?? '').split(',').map(x => x.trim()).filter(Boolean).map(x => {
      const m = x.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
      return m ? [minutes(m[1]), minutes(m[2])] : [NaN,NaN];
    });
  }
  function normalize(raw) {
    const people = (Array.isArray(raw.people) ? raw.people : []).map(p => ({
      id: id(p.id), name: String(p.name || '').trim(), roles: String(p.roles || '*').trim(),
      available: String(p.available || '').trim(), maxMinutes: Number(p.maxMinutes),
    }));
    const shifts = (Array.isArray(raw.shifts) ? raw.shifts : []).map(s => ({
      id: id(s.id), role: String(s.role || '').trim(), start: String(s.start || ''),
      end: String(s.end || ''), count: Number(s.count), critical: Boolean(s.critical)
    }));
    const locks = Array.isArray(raw.locks) ? raw.locks.map(l => ({seat: id(l.seat), person: id(l.person)})) : [];
    return {people, shifts, locks, rest: Number(raw.rest ?? 15)};
  }
  function inspect(raw) {
    const d = normalize(raw), errors = [], warnings = [];
    if (d.people.length > 60 || d.shifts.length > 100) errors.push('人数60・枠100以内にしてください');
    if (!Number.isInteger(d.rest) || d.rest < 0 || d.rest > 180) errors.push('休憩間隔は0〜180分で指定してください');
    const personIds = new Set(), shiftIds = new Set(), seats = [];
    for (const p of d.people) {
      if (!p.id || personIds.has(p.id)) errors.push('担当者IDの重複または空欄があります');
      personIds.add(p.id);
      if (!p.name) errors.push('担当者名が空欄です');
      if (!Number.isInteger(p.maxMinutes) || p.maxMinutes < 0 || p.maxMinutes > 1440) errors.push(p.name + 'の上限時間が不正です');
      const w = windows(p.available);
      if (!w.length || w.some(([a,b]) => !Number.isFinite(a) || !Number.isFinite(b) || a >= b)) errors.push(p.name + 'の参加可能時間は 09:00-12:00,13:00-17:00 形式で指定してください');
    }
    for (const s of d.shifts) {
      if (!s.id || shiftIds.has(s.id)) errors.push('枠IDの重複または空欄があります');
      shiftIds.add(s.id);
      if (!s.role) errors.push('役割名が空欄です');
      const a = minutes(s.start), b = minutes(s.end);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) errors.push(s.role + 'の時刻が不正です');
      if (!Number.isInteger(s.count) || s.count < 1 || s.count > 5) errors.push(s.role + 'の必要人数は1〜5人です');
      if (Number.isInteger(s.count) && s.count >= 1 && s.count <= 5) for (let k=0;k<s.count;k++) seats.push({id:s.id+'#'+k, shiftId:s.id, index:k, role:s.role, start:a, end:b, duration:b-a, critical:s.critical});
    }
    if (seats.length > 120) errors.push('合計配置枠は120以下にしてください');
    const seatMap = new Map(seats.map(s=>[s.id,s]));
    const pmap = new Map(d.people.map(p=>[p.id,p]));
    const lockMap = new Map();
    for (const l of d.locks) {
      if (!seatMap.has(l.seat) || !pmap.has(l.person)) {warnings.push('存在しない固定割当 '+l.seat+' を無視しました'); continue;}
      if (lockMap.has(l.seat)) {errors.push('同じ席に複数の固定があります: '+l.seat); continue;}
      lockMap.set(l.seat,l.person);
    }
    return {data:d, errors:[...new Set(errors)], warnings, seats, seatMap, pmap, lockMap};
  }
  function eligible(person, seat) {
    if (!seat || !person || !Number.isFinite(seat.start) || !Number.isFinite(seat.end)) return false;
    if (!(person.roles === '*' || person.roles.split(',').map(x=>x.trim()).includes(seat.role))) return false;
    if (person.maxMinutes < seat.duration) return false;
    return windows(person.available).some(([a,b])=>a<=seat.start && seat.end<=b);
  }
  function compatible(a,b,rest) { return a.end + rest <= b.start || b.end + rest <= a.start; }
  function canUse(person, seat, allocations, seats, rest) {
    if (!eligible(person,seat)) return false;
    let used=0;
    for (const [seatId,pid] of allocations) {
      if (pid !== person.id) continue;
      const current=seats.get(seatId);
      if (!current) continue;
      used += current.duration;
      if (!compatible(current,seat,rest)) return false;
    }
    return used + seat.duration <= person.maxMinutes;
  }
  function validateAssignments(view, assignments) {
    const issues=[];
    for (const [seatId,pid] of assignments) {
      const seat=view.seatMap.get(seatId), person=view.pmap.get(pid);
      if (!seat || !person) {issues.push('不明な担当または枠: '+seatId);continue;}
      const others=new Map([...assignments].filter(([id])=>id!==seatId));
      if (!canUse(person,seat,others,view.seatMap,view.data.rest)) issues.push(seat.role+' '+seat.start+'-'+seat.end+'：'+person.name+' の時間・役割・休憩・上限が不適合');
    }
    return [...new Set(issues)];
  }
  function metric(view, assignments) {
    const load=Object.fromEntries(view.data.people.map(p=>[p.id,0]));
    let missed=0, filled=0;
    for (const s of view.seats) {
      const pid=assignments.get(s.id);
      if (!pid) missed += s.critical ? 5 : 1;
      else { filled++; load[pid]+=s.duration; }
    }
    const ratios=view.data.people.filter(p=>p.maxMinutes>0).map(p=>load[p.id]/p.maxMinutes);
    const mean=ratios.reduce((a,b)=>a+b,0)/(ratios.length||1);
    const variance=ratios.reduce((a,b)=>a+(b-mean)**2,0)/(ratios.length||1);
    return {filled, total:view.seats.length, missed, load, variance};
  }
  function solve(raw, opts={}) {
    const v=inspect(raw);
    if (v.errors.length) return {ok:false, errors:v.errors, warnings:v.warnings, assignments:[], method:'invalid'};
    const pinned=new Map(v.lockMap), pinIssues=validateAssignments(v,pinned);
    if (pinIssues.length) return {ok:false, errors:['固定割当が競合しています',...pinIssues],warnings:v.warnings,assignments:[],method:'invalid'};
    const remaining=v.seats.filter(s=>!pinned.has(s.id));
    const candidates=new Map(remaining.map(s=>[s.id,v.data.people.filter(p=>eligible(p,s))]));
    const ordered=[...remaining].sort((a,b)=> candidates.get(a.id).length-candidates.get(b.id).length || Number(b.critical)-Number(a.critical) || b.duration-a.duration || a.start-b.start || a.id.localeCompare(b.id));
    const bestInitial=()=>{
      const answer=new Map(pinned);
      // Greedy baseline, reused for oversized cases.
      for (const seat of ordered) {
        const cand=candidates.get(seat.id).filter(p=>canUse(p,seat,answer,v.seatMap,v.data.rest));
        cand.sort((a,b)=> {
          const load=metric(v,answer).load;
          const futureA=ordered.filter(s=>!answer.has(s.id) && s.id!==seat.id && eligible(a,s)).length;
          const futureB=ordered.filter(s=>!answer.has(s.id) && s.id!==seat.id && eligible(b,s)).length;
          return futureA-futureB || load[a.id]/Math.max(1,a.maxMinutes)-load[b.id]/Math.max(1,b.maxMinutes) || a.id.localeCompare(b.id);
        });
        if(cand.length) answer.set(seat.id,cand[0].id);
      }
      return answer;
    };
    let best=bestInitial(), bestM=metric(v,best), nodes=0, truncated=false;
    const limit=Number.isInteger(opts.nodeLimit) ? Math.max(1,opts.nodeLimit) : 85000;
    if (ordered.length<=16 && v.data.people.length<=14) {
      const work=new Map(pinned);
      const suffix=Array(ordered.length+1).fill(0);
      for(let i=ordered.length-1;i>=0;i--) suffix[i]=suffix[i+1]+(ordered[i].critical?5:1);
      function visit(i,penalty) {
        if (++nodes > limit) {truncated=true;return;}
        if (penalty>bestM.missed) return;
        if (i===ordered.length) {
          const m=metric(v,work);
          if (m.missed<bestM.missed || (m.missed===bestM.missed && m.variance<bestM.variance-1e-12)) {best=new Map(work);bestM=m;}
          return;
        }
        const s=ordered[i];
        const cand=candidates.get(s.id).filter(p=>canUse(p,s,work,v.seatMap,v.data.rest));
        cand.sort((a,b)=> {
          let aa=0,bb=0;
          for(const [sid,pid] of work) {const dur=v.seatMap.get(sid).duration; if(pid===a.id)aa+=dur; if(pid===b.id)bb+=dur;}
          return aa/Math.max(1,a.maxMinutes)-bb/Math.max(1,b.maxMinutes) || a.id.localeCompare(b.id);
        });
        for(const p of cand) {work.set(s.id,p.id); visit(i+1,penalty); work.delete(s.id);if(truncated)return;}
        if (penalty+(s.critical?5:1)<=bestM.missed) visit(i+1,penalty+(s.critical?5:1));
      }
      visit(0,v.seats.filter(s=>!best.has(s.id) && pinned.has(s.id)).length);
    }
    const m=metric(v,best);
    const result=v.seats.map(s=>({seat:s.id,shiftId:s.shiftId,person:best.get(s.id)||'',locked:pinned.has(s.id)}));
    return {ok:true,assignments:result,coverage:m.filled,total:m.total,load:m.load,missedWeight:m.missed,variance:m.variance,method:ordered.length<=16&&v.data.people.length<=14?(truncated?'bounded search':'exhaustive search'):'greedy heuristic',nodes,warnings:[...v.warnings,...(truncated?['探索上限に達しました。最適性は保証されません']:[]),...(ordered.length>16||v.data.people.length>14?['大規模入力ではヒューリスティックを使用。最適性は保証されません']:[])]};
  }
  function csvCell(x) {
    let s=String(x ?? '');
    if (/^[\s]*[=+@-]/.test(s)) s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  }
  function exportCSV(raw, result) {
    const v=inspect(raw);if(v.errors.length)throw new Error(v.errors.join('; '));
    const assign=new Map((result.assignments||[]).map(x=>[x.seat,x]));
    const rows=[['開始','終了','役割','席','必須','担当（仮名）','固定']];
    for(const s of v.seats) {const a=assign.get(s.id), p=v.pmap.get(a?.person);rows.push([s.start===undefined?'':raw.shifts.find(x=>String(x.id)===s.shiftId).start,raw.shifts.find(x=>String(x.id)===s.shiftId).end,s.role,s.index+1,s.critical?'重要':'通常',p?.name||'未配置',a?.locked?'はい':'']);}
    return '\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
  }
  return {minutes,windows,normalize,inspect,eligible,compatible,canUse,validateAssignments,metric,solve,exportCSV,csvCell};
});
