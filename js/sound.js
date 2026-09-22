/*
 * sound.js - Web Audio API 声波合成引擎
 *
 * 声波特征（由 algorithm.js 计算）：
 *   baseFreq     基础频率(Hz)
 *   pulsePerMin  脉冲节奏(次/分钟)
 *   waveform     波形 sine / triangle / square
 *   gain         输出增益(0-1)
 *   pulseDuration 单脉冲时长(秒)
 *
 * 每个脉冲由 1~2 个短音组成（节奏舒缓时发"咯-咯"双音、第二音略高，
 * 贴合母鸡"咯咯"声的听感），带指数衰减包络，避免爆音。
 * 播放同时驱动 canvas 绘制实时滚动波形。
 */
(function (global) {
  'use strict';

  var ctx = null;
  var master = null;
  var playing = false;
  var timerId = null;
  var nextPulseAt = 0;
  var params = null;
  var lastPulseAt = -1;
  var rafId = null;
  var canvas = null;
  var canvasCtx = null;
  var volume = 0.7;

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function ensureCtx() {
    if (!ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume * 0.5; // 母线限幅，防止削波
      master.connect(ctx.destination);
    }
    return ctx;
  }

  function setVolume(v) {
    volume = clamp01(v);
    if (master) master.gain.value = volume * 0.5;
  }

  function setCanvas(el) {
    canvas = el;
    canvasCtx = el ? el.getContext('2d') : null;
  }

  /* ---------- 合成 ---------- */

  function playPulse(t0) {
    var p = params;
    var twoNotes = p.pulsePerMin <= 120;
    var notes = twoNotes ? 2 : 1;
    var dur = Math.max(0.03, p.pulseDuration / notes);
    var gap = dur * 0.12;
    var peak = Math.min(0.9, p.gain * 0.9);
    var i;
    for (i = 0; i < notes; i++) {
      var start = t0 + i * (dur + gap);
      var freq = i === 0 ? p.baseFreq : p.baseFreq * 1.18;
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = p.waveform;
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * (i === 0 ? 1.06 : 0.94), start + dur);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.02, dur * 0.2));
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    }
  }

  function scheduleLoop() {
    if (!playing) return;
    var now = ctx.currentTime;
    var interval = 60 / params.pulsePerMin;
    var guard = 0;
    while (nextPulseAt <= now + 0.25 && guard < 12) {
      lastPulseAt = nextPulseAt;
      playPulse(nextPulseAt);
      nextPulseAt += interval;
      guard++;
    }
    timerId = global.setTimeout(scheduleLoop, 120);
  }

  function start(p) {
    var ac = ensureCtx();
    if (!ac) return false;
    params = p;
    if (ac.state === 'suspended') ac.resume();
    playing = true;
    nextPulseAt = ac.currentTime + 0.1;
    lastPulseAt = -1;
    scheduleLoop();
    startVisualizer();
    return true;
  }

  function stop() {
    if (!playing) return;
    playing = false;
    if (timerId) { global.clearTimeout(timerId); timerId = null; }
    stopVisualizer();
  }

  function updateParams(p) {
    params = p;
  }

  /* ---------- 可视化 ---------- */

  function waveValue(type, phase) {
    var p = phase % (2 * Math.PI);
    if (p < 0) p += 2 * Math.PI;
    switch (type) {
      case 'triangle': return (2 / Math.PI) * Math.asin(Math.sin(p));
      case 'square': return Math.sin(p) >= 0 ? 1 : -1;
      default: return Math.sin(p);
    }
  }

  // 最近一次脉冲的衰减包络（0-1），驱动波形呼吸
  function envelope(now) {
    if (lastPulseAt < 0) return 0.15;
    var dt = now - lastPulseAt;
    return Math.max(0.06, Math.exp(-dt / 0.16));
  }

  function drawLive() {
    if (!canvasCtx) return;
    var w = canvas.width;
    var h = canvas.height;
    var mid = h / 2;
    var c = canvasCtx;
    c.clearRect(0, 0, w, h);

    // 基线
    c.strokeStyle = 'rgba(255,255,255,0.10)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, mid);
    c.lineTo(w, mid);
    c.stroke();

    var env = envelope(ctx.currentTime);
    var amp = Math.max(h * 0.15, h * 0.38 * env * (0.45 + params.gain));
    var phase = ctx.currentTime * params.baseFreq * 2 * Math.PI;

    c.strokeStyle = '#e8a33d';
    c.lineWidth = 2;
    c.beginPath();
    for (var x = 0; x <= w; x += 2) {
      var t = (x / w) * 6 * Math.PI;
      var y = mid - waveValue(params.waveform, phase - t) * amp;
      if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();

    // 脉冲触发指示点
    if (lastPulseAt >= 0) {
      var dt = ctx.currentTime - lastPulseAt;
      if (dt < 0.35) {
        c.fillStyle = 'rgba(255,215,150,' + (1 - dt / 0.35).toFixed(3) + ')';
        c.beginPath();
        c.arc(w - 20, 20, 5, 0, 2 * Math.PI);
        c.fill();
      }
    }
  }

  function startVisualizer() {
    if (!canvas || rafId) return;
    var step = function () {
      if (!playing) { rafId = null; return; }
      drawLive();
      rafId = global.requestAnimationFrame(step);
    };
    rafId = global.requestAnimationFrame(step);
  }

  function stopVisualizer() {
    if (rafId) { global.cancelAnimationFrame(rafId); rafId = null; }
  }

  // 未播放时：按当前参数绘制静态波形预览
  function drawPreview(p) {
    if (!canvasCtx) return;
    var w = canvas.width;
    var h = canvas.height;
    var mid = h / 2;
    var c = canvasCtx;
    c.clearRect(0, 0, w, h);

    c.strokeStyle = 'rgba(255,255,255,0.10)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, mid);
    c.lineTo(w, mid);
    c.stroke();

    if (!p) {
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.font = '14px system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillText('调整参数后点击播放，查看实时波形', w / 2, mid - 4);
      return;
    }

    var amp = h * 0.32 * (0.45 + p.gain);
    c.strokeStyle = 'rgba(232,163,61,0.9)';
    c.lineWidth = 1.8;
    c.beginPath();
    for (var x = 0; x <= w; x += 2) {
      var y = mid - waveValue(p.waveform, (x / w) * 4 * 2 * Math.PI) * amp;
      if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
  }

  var api = {
    start: start,
    stop: stop,
    updateParams: updateParams,
    setVolume: setVolume,
    setCanvas: setCanvas,
    drawPreview: drawPreview,
    isPlaying: function () { return playing; }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.HenSound = global.HenSound || {};
  global.HenSound.sound = api;
})(typeof window !== 'undefined' ? window : globalThis);