/* 停電配分室 - deterministic, dependency-free planning engine. MIT License. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TeidenEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_DEVICES = 36;
  const round = (value, places = 2) => Number(value.toFixed(places));
  const clamp = (value, min, max, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const int = (v, min, max, fallback) => Math.round(clamp(v, min, max, fallback));
  function initialState() {
    return {
      settings: { capacityWh: 1024, initialPct: 95, reservePct: 20, efficiencyPct: 85, outputW: 600, hours: 24 },
      devices: [
        { id: 'd1', name: 'Wi-Fiルーター', watts: 12, count: 1, dutyPct: 100, start: 0, end: 24, tier: 'must' },
        { id: 'd2', name: 'LED照明', watts: 10, count: 2, dutyPct: 100, start: 18, end: 23, tier: 'must' },
        { id: 'd3', name: 'スマホ充電', watts: 18, count: 2, dutyPct: 100, start: 20, end: 22, tier: 'must' },
        { id: 'd4', name: '扇風機', watts: 40, count: 1, dutyPct: 100, start: 10, end: 22, tier: 'flex' },
        { id: 'd5', name: 'ノートPC', watts: 65, count: 1, dutyPct: 100, start: 9, end: 18, tier: 'flex' },
        { id: 'd6', name: 'テレビ', watts: 75, count: 1, dutyPct: 100, start: 19, end: 23, tier: 'flex' }
      ]
    };
  }
  function normalizeState(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('設定の形式が不正です。');
    const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    const settings = {
      capacityWh: clamp(s.capacityWh, 1, 100000, 1024),
      initialPct: clamp(s.initialPct, 1, 100, 100),
      reservePct: clamp(s.reservePct, 0, 90, 20),
      efficiencyPct: clamp(s.efficiencyPct, 30, 100, 85),
      outputW: clamp(s.outputW, 1, 30000, 600),
      hours: [24, 48, 72].includes(Number(s.hours)) ? Number(s.hours) : 24
    };
    if (!Array.isArray(raw.devices)) throw new Error('家電の一覧がありません。');
    if (raw.devices.length > MAX_DEVICES) throw new Error('家電は最大36件です。');
    const seen = new Set();
    const devices = raw.devices.map((d, index) => {
      if (!d || typeof d !== 'object') throw new Error('家電に不正な項目があります。');
      let id = typeof d.id === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(d.id) ? d.id : `device${index}`;
      if (seen.has(id)) id = `device${index}_${id}`;
      seen.add(id);
      return {
        id,
        name: String(d.name == null ? '名称未設定' : d.name).replace(/[\x00-\x1f]/g, ' ').slice(0, 48) || '名称未設定',
        watts: clamp(d.watts, 0, 5000, 10),
        count: int(d.count, 1, 20, 1),
        dutyPct: clamp(d.dutyPct, 0, 100, 100),
        start: int(d.start, 0, 23, 0),
        end: int(d.end, 0, 24, 24),
        tier: d.tier === 'flex' ? 'flex' : 'must'
      };
    });
    return { settings, devices };
  }
  function activeAt(device, hour) {
    const h = ((hour % 24) + 24) % 24;
    if (device.start === device.end || (device.start === 0 && device.end === 24)) return true;
    if (device.start < device.end) return h >= device.start && h < device.end;
    return h >= device.start || h < device.end;
  }
  function loadAt(devices, hour, factor = 1) {
    let mustW = 0, flexW = 0, mustPeakW = 0, flexPeakW = 0;
    for (const d of devices) {
      if (!activeAt(d, hour) || d.dutyPct === 0) continue;
      const power = d.watts * d.count;
      const mean = power * d.dutyPct / 100;
      if (d.tier === 'must') { mustW += mean; mustPeakW += power; }
      else { flexW += mean; flexPeakW += power; }
    }
    return {
      mustW, flexW,
      watts: mustW + flexW * factor,
      conservativePeakW: mustPeakW + (factor > 0 ? flexPeakW : 0),
      mustPeakW, flexPeakW
    };
  }
  function energyBudget(settings) {
    const startWh = settings.capacityWh * settings.initialPct / 100;
    const reserveWh = settings.capacityWh * settings.reservePct / 100;
    return { startWh, reserveWh, usableWh: Math.max(0, startWh - reserveWh) };
  }
  function simulate(state, factor = 1) {
    const { settings, devices } = state;
    const { startWh, reserveWh, usableWh } = energyBudget(settings);
    const efficiency = settings.efficiencyPct / 100;
    let available = usableWh;
    let unmetWh = 0, requestedWh = 0, deliveredWh = 0, usedBatteryWh = 0;
    let peakViolations = 0, firstShortfall = null, maxPeakW = 0;
    const points = [{ hour: 0, socPct: round(settings.initialPct, 4), batteryWh: startWh, drawW: 0, demandW: 0, unmetWh: 0, peakExceeds: false }];
    for (let h = 0; h < settings.hours; h++) {
      const load = loadAt(devices, h, factor);
      maxPeakW = Math.max(maxPeakW, load.conservativePeakW);
      const peakExceeds = load.conservativePeakW > settings.outputW + 1e-8;
      if (peakExceeds) peakViolations++;
      const batteryRequired = load.watts / efficiency;
      const batterySpent = Math.min(available, batteryRequired);
      const outputDelivered = batterySpent * efficiency;
      available = Math.max(0, available - batterySpent);
      const missed = Math.max(0, load.watts - outputDelivered);
      if (missed > 1e-7 && firstShortfall === null) firstShortfall = h;
      unmetWh += missed;
      deliveredWh += outputDelivered;
      requestedWh += load.watts;
      usedBatteryWh += batterySpent;
      const currentWh = startWh - usedBatteryWh;
      points.push({
        hour: h + 1,
        socPct: round(100 * currentWh / settings.capacityWh, 4),
        batteryWh: round(currentWh, 5),
        drawW: round(batterySpent, 4),
        demandW: round(load.watts, 4),
        unmetWh: round(missed, 4),
        peakExceeds
      });
    }
    return {
      points, factor, requestedWh: round(requestedWh, 4), deliveredWh: round(deliveredWh, 4),
      unmetWh: round(unmetWh, 4), usedBatteryWh: round(usedBatteryWh, 4),
      energyDeficitBatteryWh: round(Math.max(0, requestedWh / efficiency - usableWh), 4),
      endSocPct: points[points.length - 1].socPct,
      firstShortfall, peakViolations, maxPeakW: round(maxPeakW, 2),
      energyFeasible: unmetWh < 1e-6,
      feasible: unmetWh < 1e-6 && peakViolations === 0
    };
  }
  function analyze(input) {
    const state = normalizeState(input);
    const s = state.settings;
    const baseline = simulate(state, 1);
    const essentials = simulate(state, 0);
    const essentialPeakFail = essentials.peakViolations > 0;
    const essentialEnergyFail = !essentials.energyFeasible;
    let factor = 1;
    let reason = '全家電を予定通り使う案でも設定上は成立します。';
    const totalFlex = Array.from({ length: s.hours }, (_, h) => loadAt(state.devices, h).flexW).reduce((a, b) => a + b, 0);
    const peakConflict = baseline.peakViolations > 0;
    if (essentialEnergyFail || essentialPeakFail) {
      factor = 0;
      reason = '必須家電だけでも電池容量または定格出力に不足があります。必須家電や電源の条件を見直してください。';
    } else if (totalFlex <= 1e-9) {
      factor = 1;
      reason = '任意家電の消費はありません。';
    } else if (peakConflict) {
      factor = 0;
      reason = '同時使用の定格最大出力を超える時間帯があるため、任意家電をいったん停止します。';
    } else {
      const { usableWh } = energyBudget(s);
      const requiredEss = essentials.requestedWh / (s.efficiencyPct / 100);
      const requiredFlex = totalFlex / (s.efficiencyPct / 100);
      factor = Math.max(0, Math.min(1, (usableWh - requiredEss) / requiredFlex));
      factor = Math.floor((factor + 1e-10) * 1000) / 1000;
      if (factor < 0.999) reason = `必須家電を優先し、任意家電の平均使用時間を約${Math.round(factor * 100)}%に制限する試算です。`;
    }
    const optimized = simulate(state, factor);
    return {
      state, baseline, essentials, optimized,
      optionalFactor: factor,
      essentialFeasible: essentials.feasible,
      baselineFeasible: baseline.feasible,
      optimizedFeasible: optimized.feasible,
      reason,
      additionalBatteryWh: round(Math.max(0, baseline.energyDeficitBatteryWh), 1)
    };
  }
  function rowsToCsv(analysis) {
    const a = analysis.baseline.points, b = analysis.optimized.points;
    const lines = ['hour,baseline_soc_pct,energy_saving_soc_pct,baseline_demand_w,energy_saving_demand_w,baseline_unmet_wh,energy_saving_unmet_wh'];
    for (let i = 1; i < a.length; i++) {
      lines.push([i, a[i].socPct, b[i].socPct, a[i].demandW, b[i].demandW, a[i].unmetWh, b[i].unmetWh].join(','));
    }
    return '\ufeff' + lines.join('\r\n') + '\r\n';
  }
  function hourlyTable(analysis) {
    return Array.from({length: analysis.state.settings.hours}, (_, h) => ({
      hour: h, clock: `${String(h % 24).padStart(2, '0')}:00`, day: Math.floor(h/24) + 1,
      a: analysis.baseline.points[h+1], b: analysis.optimized.points[h+1]
    }));
  }
  return { initialState, normalizeState, activeAt, loadAt, energyBudget, simulate, analyze, rowsToCsv, hourlyTable, round };
});
