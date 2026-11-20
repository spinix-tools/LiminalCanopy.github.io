/* HAKUMA GAP 1.0 — deterministic, dependency-free beat plan and tap analysis. MIT. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.HakumaEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var VERSION = 1;
  function int(v, fallback, lo, hi) {
    var n = Number(v);
    if (!Number.isFinite(n)) n = fallback;
    return Math.max(lo, Math.min(hi, Math.round(n)));
  }
  function config(raw) {
    var s = raw || {};
    return {
      bpm: int(s.bpm, 90, 40, 220),
      meter: int(s.meter, 4, 2, 7),
      hearBars: int(s.hearBars, 2, 1, 8),
      muteBars: int(s.muteBars, 2, 1, 8),
      rounds: int(s.rounds, 3, 1, 8),
      latency: int(s.latency, 0, -200, 200)
    };
  }
  function makePlan(settings) {
    var c = config(settings), ms = 60000 / c.bpm, beats = [], index = 0;
    function add(kind, round, bar, beat) {
      beats.push({
        index: index,
        timeMs: index * ms,
        phase: kind,
        round: round,
        bar: bar,
        beat: beat,
        audible: kind !== "quiet",
        returnBeat: kind === "heard" && round > 1 && bar === 1 && beat === 1
      });
      index++;
    }
    for (var b = 1; b <= c.meter; b++) add("countin", 0, 1, b);
    for (var r = 1; r <= c.rounds; r++) {
      for (var h = 1; h <= c.hearBars; h++) {
        for (var x = 1; x <= c.meter; x++) add("heard", r, h, x);
      }
      for (var q = 1; q <= c.muteBars; q++) {
        for (var y = 1; y <= c.meter; y++) add("quiet", r, q, y);
      }
    }
    return {
      version: VERSION,
      config: c,
      intervalMs: ms,
      totalMs: index * ms,
      beats: beats
    };
  }
  function fix(n, digits) { return Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits); }
  function summarize(items) {
    var valid = items.filter(function (x) { return x.errorMs !== null; });
    var abs = valid.reduce(function (sum, x) { return sum + Math.abs(x.errorMs); }, 0);
    var signed = valid.reduce(function (sum, x) { return sum + x.errorMs; }, 0);
    return {
      expected: items.length,
      hit: valid.length,
      missed: items.length - valid.length,
      hitRate: items.length ? fix(100 * valid.length / items.length, 1) : 0,
      meanAbsMs: valid.length ? fix(abs / valid.length, 1) : null,
      meanSignedMs: valid.length ? fix(signed / valid.length, 1) : null
    };
  }
  function analyze(plan, rawTaps, latency) {
    if (!plan || !Array.isArray(plan.beats) || !Number.isFinite(plan.intervalMs)) throw new Error("無効な拍プラン");
    if (!Array.isArray(rawTaps) || rawTaps.length > 10000) throw new Error("タップ配列の形式が不正です");
    var offset = int(latency === undefined ? plan.config.latency : latency, 0, -200, 200);
    var interval = plan.intervalMs, tolerance = interval * 0.49, buckets = new Map(), extras = 0;
    rawTaps.forEach(function (value) {
      var t = Number(value);
      if (!Number.isFinite(t)) { extras++; return; }
      var idx = Math.round((t - offset) / interval);
      var beat = plan.beats[idx];
      if (!beat || beat.phase === "countin" || Math.abs(t - offset - beat.timeMs) > tolerance) {
        extras++;
        return;
      }
      var err = t - offset - beat.timeMs;
      if (!buckets.has(idx)) buckets.set(idx, err);
      else if (Math.abs(err) < Math.abs(buckets.get(idx))) { buckets.set(idx, err); extras++; }
      else extras++;
    });
    var rows = plan.beats.filter(function (b) { return b.phase !== "countin"; }).map(function (b) {
      return {
        index: b.index,
        timeMs: fix(b.timeMs, 2),
        round: b.round,
        phase: b.returnBeat ? "return" : b.phase,
        bar: b.bar,
        beat: b.beat,
        errorMs: buckets.has(b.index) ? fix(buckets.get(b.index), 2) : null
      };
    });
    var phases = {};
    ["heard", "quiet", "return"].forEach(function (p) {
      phases[p] = summarize(rows.filter(function (r) { return r.phase === p; }));
    });
    var curve = [];
    for (var k = 1; k <= plan.config.muteBars; k++) {
      curve.push({bar: k, summary: summarize(rows.filter(function (r) { return r.phase === "quiet" && r.bar === k; }))});
    }
    return { config: plan.config, total: summarize(rows), phases: phases, curve: curve, rows: rows, extras: extras, latencyMs: offset };
  }
  function csv(analysis) {
    var out = [["round","phase","bar","beat","expected_ms","deviation_ms","status"]];
    analysis.rows.forEach(function (r) {
      out.push([r.round, r.phase, r.bar, r.beat, r.timeMs,
        r.errorMs === null ? "" : r.errorMs, r.errorMs === null ? "miss" : "hit"]);
    });
    return "\uFEFF" + out.map(function (r) {
      return r.map(function (v) {
        var t = String(v);
        return '"' + t.replace(/"/g, '""') + '"';
      }).join(",");
    }).join("\r\n") + "\r\n";
  }
  function serialize(settings, taps) {
    var c = config(settings);
    if (!Array.isArray(taps) || taps.length > 10000 ||
        taps.some(function (v) { return !Number.isFinite(v) || v < -5000 || v > 3600000; })) {
      throw new Error("保存できないタップデータ");
    }
    return JSON.stringify({app: "hakuma-gap", version: VERSION, config: c, taps: taps.map(function (n) { return fix(n, 3); })}, null, 2);
  }
  function restore(text) {
    if (typeof text !== "string" || text.length > 1000000) throw new Error("JSONサイズが大きすぎます");
    var obj = JSON.parse(text);
    if (!obj || obj.app !== "hakuma-gap" || obj.version !== VERSION || !Array.isArray(obj.taps)) {
      throw new Error("対応していないセッションです");
    }
    var c = config(obj.config), plan = makePlan(c);
    if (obj.taps.length > plan.beats.length * 5 ||
        obj.taps.some(function (n) { return typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > plan.totalMs + 1000; })) {
      throw new Error("タップデータの範囲が不正です");
    }
    return {config: c, taps: obj.taps, plan: plan, result: analyze(plan, obj.taps, c.latency)};
  }
  function demoTaps(plan) {
    return plan.beats.filter(function (b) { return b.phase !== "countin"; }).filter(function (b) {
      return !(b.phase === "quiet" && b.bar === plan.config.muteBars && b.beat === plan.config.meter && b.round % 2 === 0);
    }).map(function (b) {
      var drift = b.phase === "quiet" ? 16 + 17 * b.bar + b.beat * 3 : 9 + b.beat * 2;
      return fix(b.timeMs + drift, 2);
    });
  }
  return {VERSION: VERSION, config: config, makePlan: makePlan, analyze: analyze,
    csv: csv, serialize: serialize, restore: restore, demoTaps: demoTaps};
});
