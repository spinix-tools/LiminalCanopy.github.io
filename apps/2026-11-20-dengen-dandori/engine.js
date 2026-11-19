/* DENGEN DANDORI — dependency-free planning model; not a certified electrical design tool. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Dengen = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SLOTS = 96;
  const STEP = 15;
  const inRange = (v, lo, hi, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
  };
  const nint = (v, lo, hi, fallback) => Math.round(inRange(v, lo, hi, fallback));
  const safeName = (v, fallback) => String(v == null ? fallback : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 48) || fallback;
  const hhmm = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  function parseTime(v, fallback = 0) {
    if (typeof v === 'number') return nint(v, 0, 1440, fallback);
    if (typeof v !== 'string' || !/^\d{1,2}:\d{2}$/.test(v)) return fallback;
    const [h, m] = v.split(':').map(Number);
    if (h > 24 || m > 59 || (h === 24 && m !== 0)) return fallback;
    return h * 60 + m;
  }
  function defaultProject() {
    return {
      version: 1,
      title: '週末の電源段取り',
      target: 'A',
      stations: {
        A: { name: '手持ちの電源 A', capacity: 1750, output: 1000, efficiency: 85, reserve: 15, startSOC: 90, idle: 7, solar: 0, solarStart: 600, solarEnd: 960 },
        B: { name: '移行案 B', capacity: 2048, output: 1200, efficiency: 88, reserve: 15, startSOC: 90, idle: 6, solar: 130, solarStart: 600, solarEnd: 960 }
      },
      loads: [
        { id: 'l1', name: 'ノートPC', watts: 65, count: 1, supply: 'AC', start: 540, duration: 360, flex: false, earliest: 540, latest: 540 },
        { id: 'l2', name: '電気ケトル', watts: 850, count: 1, supply: 'AC', start: 720, duration: 30, flex: true, earliest: 630, latest: 840 },
        { id: 'l3', name: '小型調理器', watts: 620, count: 1, supply: 'AC', start: 720, duration: 45, flex: true, earliest: 660, latest: 900 },
        { id: 'l4', name: 'LED照明', watts: 15, count: 2, supply: 'DC', start: 1080, duration: 240, flex: false, earliest: 1080, latest: 1080 },
        { id: 'l5', name: 'スマホ充電', watts: 12, count: 2, supply: 'DC', start: 690, duration: 90, flex: true, earliest: 600, latest: 1020 },
        { id: 'l6', name: '扇風機', watts: 25, count: 1, supply: 'DC', start: 780, duration: 240, flex: false, earliest: 780, latest: 780 }
      ]
    };
  }
  function normalizeStation(st, fallback) {
    const o = st && typeof st === 'object' && !Array.isArray(st) ? st : {};
    return {
      name: safeName(o.name, fallback.name),
      capacity: nint(o.capacity, 10, 100000, fallback.capacity),
      output: nint(o.output, 1, 100000, fallback.output),
      efficiency: nint(o.efficiency, 50, 100, fallback.efficiency),
      reserve: nint(o.reserve, 0, 80, fallback.reserve),
      startSOC: nint(o.startSOC, 0, 100, fallback.startSOC),
      idle: nint(o.idle, 0, 150, fallback.idle),
      solar: nint(o.solar, 0, 10000, fallback.solar),
      solarStart: nint(o.solarStart, 0, 1439, fallback.solarStart),
      solarEnd: nint(o.solarEnd, 0, 1440, fallback.solarEnd)
    };
  }
  function normalizeLoad(l, index) {
    const o = l && typeof l === 'object' && !Array.isArray(l) ? l : {};
    const start = nint(o.start, 0, 1425, 600);
    const duration = nint(o.duration, 15, 1440 - start, 60);
    const earliest = nint(o.earliest, 0, 1440 - duration, start);
    const latest = nint(o.latest, earliest, 1440 - duration, Math.max(start, earliest));
    return {
      id: typeof o.id === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(o.id) ? o.id : `load${index + 1}`,
      name: safeName(o.name, `機器 ${index + 1}`),
      watts: nint(o.watts, 1, 15000, 50),
      count: nint(o.count, 1, 12, 1),
      supply: o.supply === 'DC' ? 'DC' : 'AC',
      start, duration, flex: Boolean(o.flex), earliest, latest
    };
  }
  function normalizeProject(project) {
    const p = project && typeof project === 'object' && !Array.isArray(project) ? project : {};
    const d = defaultProject();
    const stations = p.stations && typeof p.stations === 'object' ? p.stations : {};
    const loads = Array.isArray(p.loads) ? p.loads.slice(0, 30) : d.loads;
    const seen = new Set();
    return {
      version: 1,
      title: safeName(p.title, d.title),
      target: p.target === 'B' ? 'B' : 'A',
      stations: { A: normalizeStation(stations.A, d.stations.A), B: normalizeStation(stations.B, d.stations.B) },
      loads: loads.map(normalizeLoad).map((l, i) => {
        if (seen.has(l.id)) l.id = `dedup${i}`;
        seen.add(l.id);
        return l;
      })
    };
  }
  function activePower(load, t) {
    const overlap = Math.max(0, Math.min(t + STEP, load.start + load.duration) - Math.max(t, load.start));
    return load.watts * load.count * overlap / STEP;
  }
  function simulate(project, which) {
    const s = project.stations[which === 'B' ? 'B' : 'A'];
    let energy = s.capacity * s.startSOC / 100;
    const floor = s.capacity * s.reserve / 100;
    const timeline = [];
    let totalDeviceWh = 0, demandWh = 0, producedWh = 0, usedSolarWh = 0;
    let unmetWh = 0, overloadMinutes = 0, overloadWh = 0, unmetMinutes = 0;
    let peakAC = 0, peakTotal = 0, maxOverload = 0, minSOC = energy / s.capacity * 100;
    const dt = STEP / 60;
    for (let i = 0; i < SLOTS; i++) {
      const t = i * STEP;
      let ac = 0, dc = 0;
      for (const l of project.loads) {
        const w = activePower(l, t);
        if (l.supply === 'DC') dc += w;
        else ac += w;
      }
      const demand = (ac ? ac / (s.efficiency / 100) + s.idle : 0) + dc;
      const solarOverlap = Math.max(0, Math.min(t + STEP, s.solarEnd) - Math.max(t, s.solarStart));
      const solar = s.solar * solarOverlap / STEP;
      const solarEnergy = solar * dt;
      const net = energy + (solar - demand) * dt;
      const shortage = Math.max(0, floor - net);
      const spill = Math.max(0, net - s.capacity);
      energy = Math.max(floor, Math.min(s.capacity, net));
      const overload = Math.max(0, ac - s.output);
      totalDeviceWh += (ac + dc) * dt;
      demandWh += demand * dt;
      producedWh += solarEnergy;
      usedSolarWh += Math.max(0, solarEnergy - spill);
      unmetWh += shortage;
      overloadWh += overload * dt;
      if (overload > 0.000001) overloadMinutes += STEP;
      if (shortage > 0.000001) unmetMinutes += STEP;
      peakAC = Math.max(peakAC, ac);
      peakTotal = Math.max(peakTotal, ac + dc);
      maxOverload = Math.max(maxOverload, overload);
      minSOC = Math.min(minSOC, energy / s.capacity * 100);
      timeline.push({ time: t, ac, dc, batteryW: demand, solar, soc: energy / s.capacity * 100, energy, shortage, overload });
    }
    return { which, name: s.name, timeline, totalDeviceWh, demandWh, producedWh, usedSolarWh, unmetWh, unmetMinutes, overloadMinutes, overloadWh, peakAC, peakTotal, maxOverload, endSOC: energy / s.capacity * 100, minSOC, floorSOC: s.reserve, feasible: unmetWh < 0.000001 && overloadMinutes === 0 };
  }
  function validStartPositions(l) {
    if (!l.flex) return [l.start];
    const positions = [];
    const latest = Math.min(l.latest, 1440 - l.duration);
    for (let p = Math.ceil(l.earliest / STEP) * STEP; p <= latest; p += STEP) positions.push(p);
    if (!positions.length) positions.push(Math.max(0, Math.min(l.start, 1440 - l.duration)));
    return positions;
  }
  // Coordinate descent. Non-optimal heuristic: never claim to guarantee a global optimum.
  function autoArrange(input, which = 'A') {
    const project = normalizeProject(input);
    const before = simulate(project, which);
    const starts = new Map(project.loads.map(l => [l.id, l.start]));
    const flexible = project.loads.filter(l => l.flex).sort((a, b) => (b.watts * b.count * b.duration) - (a.watts * a.count * a.duration));
    let evaluations = 0;
    function score() {
      const r = simulate(project, which); evaluations++;
      let shift = 0;
      for (const l of flexible) shift += Math.abs(l.start - starts.get(l.id));
      return r.unmetWh * 100 + r.overloadWh * 25 + shift * 0.025;
    }
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (const l of flexible) {
        let best = l.start;
        let bestScore = score();
        for (const t of validStartPositions(l)) {
          if (t === l.start) continue;
          l.start = t;
          const cost = score();
          if (cost + 1e-7 < bestScore) { bestScore = cost; best = t; }
        }
        if (best !== starts.get(l.id)) changed = true;
        l.start = best;
      }
      if (!changed) break;
    }
    const after = simulate(project, which);
    const moved = project.loads.filter(l => l.start !== starts.get(l.id)).map(l => ({ name: l.name, from: starts.get(l.id), to: l.start }));
    return { project, before, after, moved, evaluations, optimal: false };
  }
  function toCSV(project, reportA, reportB) {
    const esc = v => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [['種別', '項目', '値1', '値2', '値3', '値4', '値5']];
    for (const l of project.loads) rows.push(['機器', l.name, l.watts, l.count, l.supply, hhmm(l.start), l.duration]);
    for (const [key, r] of [['A', reportA], ['B', reportB]]) rows.push(['結果', key, r.totalDeviceWh.toFixed(1), r.unmetWh.toFixed(1), r.peakAC.toFixed(1), r.overloadMinutes, r.endSOC.toFixed(1)]);
    rows.push(['時間', '時間帯', 'A残量%', 'B残量%', 'AC負荷W', 'DC負荷W', 'A不足Wh']);
    for (let i = 0; i < SLOTS; i++) rows.push(['時間', hhmm(i * STEP), reportA.timeline[i].soc.toFixed(1), reportB.timeline[i].soc.toFixed(1), reportA.timeline[i].ac.toFixed(1), reportA.timeline[i].dc.toFixed(1), reportA.timeline[i].shortage.toFixed(1)]);
    return '\uFEFF' + rows.map(r => r.map(esc).join(',')).join('\r\n') + '\r\n';
  }
  return { SLOTS, STEP, hhmm, parseTime, normalizeProject, normalizeStation, defaultProject, activePower, simulate, validStartPositions, autoArrange, toCSV };
});