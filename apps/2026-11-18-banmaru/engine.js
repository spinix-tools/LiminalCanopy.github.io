/* BANMARU scheduling engine — MIT License. Deterministic heuristic, no dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BANMARU = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const uniq = a => [...new Set(a)];
  const words = x => String(x || '').split(/[\s,、，;；]+/).map(s => s.trim()).filter(Boolean);
  const int = (value, min, max, name) => {
    if (String(value).trim() === '' || !Number.isInteger(Number(value)) || Number(value) < min || Number(value) > max) throw Error(`${name}は${min}〜${max}の整数にしてください`);
    return Number(value);
  };
  function dayValue(date) {
    const s = String(date || '');
    if (!/^\d{4}-\d\d-\d\d$/.test(s)) return NaN;
    const [y, m, d] = s.split('-').map(Number);
    const ms = Date.UTC(y, m - 1, d);
    const t = new Date(ms);
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? Math.floor(ms / 86400000) : NaN;
  }
  function normalize(source) {
    if (!source || !Array.isArray(source.members) || !Array.isArray(source.shifts)) throw Error('メンバーと当番枠の配列が必要です');
    if (!source.members.length || source.members.length > 40) throw Error('メンバーは1〜40名にしてください');
    if (!source.shifts.length || source.shifts.length > 60) throw Error('当番枠は1〜60件にしてください');
    const minGap = int(source.minGap ?? 2, 0, 14, '間隔');
    const members = source.members.map((m, i) => {
      const id = String(m.id || `P${String(i+1).padStart(2, '0')}`).trim();
      const name = String(m.name || '').trim();
      if (!/^[A-Za-z0-9_-]{1,24}$/.test(id)) throw Error(`メンバー${i+1}のIDを確認してください`);
      if (!name || name.length > 40) throw Error(`メンバー${i+1}の表示名を1〜40文字にしてください`);
      const unavailable = uniq(words(m.unavailable));
      unavailable.forEach(d => { if (!Number.isFinite(dayValue(d))) throw Error(`${name}の不可日 ${d} が不正です`); });
      return { id, name, roles: uniq(words(m.roles === undefined ? '*' : m.roles)), unavailable, past: int(m.past ?? 0, 0, 100, `${name}の過去回数`), max: int(m.max ?? 2, 0, 20, `${name}の上限`) };
    });
    if (uniq(members.map(m => m.id)).length !== members.length) throw Error('メンバーIDが重複しています');
    const byId = Object.fromEntries(members.map(m => [m.id, m]));
    const shifts = source.shifts.map((s,i) => {
      const date = String(s.date || '').trim();
      if (!Number.isFinite(dayValue(date))) throw Error(`枠${i+1}の開催日が不正です`);
      const role = String(s.role || '').trim();
      if (!role || role.length > 32) throw Error(`枠${i+1}の役割を入力してください`);
      const title = String(s.title || '').trim() || role;
      if (title.length > 50) throw Error(`枠${i+1}のタイトルが長すぎます`);
      const need = int(s.need ?? 1, 1, 6, `枠${i+1}の必要人数`);
      const lockTokens = words(s.locked);
      if (uniq(lockTokens).length !== lockTokens.length) throw Error(`${date} ${role}: 固定IDが重複しています`);
      const locked = lockTokens;
      if (locked.length > need) throw Error(`${date} ${role}: 固定人数が必要人数を超えています`);
      locked.forEach(id => { if (!byId[id]) throw Error(`${date} ${role}: 固定ID「${id}」が見つかりません`); });
      return { id: String(s.id || `S${i+1}`), date, day: dayValue(date), title, role, need, locked };
    });
    if (uniq(shifts.map(s => s.id)).length !== shifts.length) throw Error('枠IDが重複しています');
    if (shifts.reduce((n, s) => n+s.need, 0) > 150) throw Error('必要人数の合計は150枠以内にしてください');
    const count = Object.fromEntries(members.map(m => [m.id,0]));
    const used = Object.fromEntries(members.map(m => [m.id,[]]));
    for (const s of shifts) for (const id of s.locked) {
      const m = byId[id];
      if (!(m.roles.includes('*') || m.roles.includes(s.role))) throw Error(`${m.name}は「${s.role}」に対応できないため固定不可`);
      if (m.unavailable.includes(s.date)) throw Error(`${m.name}の不可日 ${s.date} に固定されています`);
      if (count[id] >= m.max) throw Error(`${m.name}の固定担当が上限を超えています`);
      if (used[id].some(d => Math.abs(d-s.day) < minGap || d === s.day)) throw Error(`${m.name}の固定担当が同日重複・間隔違反です`);
      count[id]++; used[id].push(s.day);
    }
    return {members, shifts, minGap};
  }
  function rng(seed) {
    let x = (Number(seed) || 1) >>> 0;
    return () => { x += 0x6D2B79F5; let t = x; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function canFill(m, s, counts, used, minGap, excluded) {
    if (m.id === excluded || counts[m.id] >= m.max || m.unavailable.includes(s.date)) return false;
    if (!(m.roles.includes('*') || m.roles.includes(s.role))) return false;
    return !used[m.id].some(d => Math.abs(d - s.day) < minGap || d === s.day);
  }
  function solve(source, opts = {}) {
    const {members, shifts, minGap} = normalize(source);
    const excluded = String(opts.excluded || '');
    if (excluded && !members.some(m => m.id === excluded)) throw Error('除外IDが見つかりません');
    if (excluded && shifts.some(s => s.locked.includes(excluded))) throw Error('除外対象が固定担当です。先に該当する固定IDを外してください');
    const attempts = Math.min(280, Math.max(1, Number(opts.attempts) || 160));
    const baseSeed = Number(opts.seed) || 20261118;
    const fixed = shifts.map(s => s.locked.slice());
    const jobs = shifts.flatMap((s, si) => Array.from({length: s.need - s.locked.length}, (_,j) => ({si, j})));
    const staticFlex = Object.fromEntries(members.map(m => [m.id, shifts.reduce((n, s) => n + (m.roles.includes('*') || m.roles.includes(s.role) ? 1 : 0), 0)]));
    let best;
    for (let round = 0; round < attempts; round++) {
      const random = rng(baseSeed + round*1013);
      const counts = Object.fromEntries(members.map(m => [m.id,0]));
      const used = Object.fromEntries(members.map(m => [m.id,[]]));
      const assigned = fixed.map(a => a.slice());
      for (let si=0; si<shifts.length;si++) for (const id of shifts[si].locked) { counts[id]++; used[id].push(shifts[si].day); }
      const pending = jobs.slice();
      while (pending.length) {
        let target = 0, candidates = null, smallest = Infinity;
        for (let j=0;j<pending.length;j++) {
          const s = shifts[pending[j].si];
          const choices = members.filter(m => !assigned[pending[j].si].includes(m.id) && canFill(m,s,counts,used,minGap,excluded));
          if (choices.length < smallest) { smallest = choices.length; target = j; candidates = choices; if (!smallest) break; }
        }
        const [{si}] = pending.splice(target,1);
        if (!candidates.length) continue;
        candidates.sort((a,b) => {
          const aa = (a.past+counts[a.id])*6+counts[a.id]*1.5 + staticFlex[a.id]*0.16 + random();
          const bb = (b.past+counts[b.id])*6+counts[b.id]*1.5 + staticFlex[b.id]*0.16 + random();
          return aa-bb;
        });
        const selected = candidates[0];
        assigned[si].push(selected.id); counts[selected.id]++; used[selected.id].push(shifts[si].day);
      }
      const totalSlots = shifts.reduce((n,s)=>n+s.need,0);
      const filled = assigned.reduce((n,a)=>n+a.length,0);
      const loads = members.filter(m=>m.id!==excluded).map(m=>m.past + counts[m.id]);
      const mean = loads.reduce((n,v)=>n+v,0)/Math.max(1,loads.length);
      const variance = loads.reduce((n,v)=>n+(v-mean)**2,0)/Math.max(1,loads.length);
      const score = (totalSlots-filled)*100000 + variance*100 + Math.max(...loads,0)*0.001;
      if (!best || score < best.score) best = {score, filled, totalSlots, assigned, counts, variance, attempts:round+1};
      if (best.filled===totalSlots && best.variance===0) break;
    }
    const plan = shifts.map((s, i) => ({...s, assigned:best.assigned[i], missing:s.need-best.assigned[i].length}));
    return {plan, members, minGap, excluded, filled:best.filled, totalSlots:best.totalSlots, missing:best.totalSlots-best.filled, variance:best.variance, attempts, loads:members.map(m=>({...m, current:best.counts[m.id], total:m.past+best.counts[m.id]})), completed:best.filled===best.totalSlots};
  }
  function csv(result) {
    const q = v => {let s=String(v??''); if (/^[\s]*[=+@\-\t\r]/.test(s)) s="'"+s; return '"'+s.replace(/"/g,'""')+'"';};
    return '\uFEFF' + [['日付','活動','役割','必要人数','担当ID','担当名','未充足'].map(q).join(',')].concat(result.plan.map(s=>[s.date,s.title,s.role,s.need,s.assigned.join(' / '),s.assigned.map(id=>result.members.find(m=>m.id===id)?.name||id).join(' / '),s.missing].map(q).join(','))).join('\r\n');
  }
  return {normalize, solve, dayValue, csv};
});