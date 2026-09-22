/*
 * app.js - 界面状态绑定与主逻辑
 *
 * 负责：滑块/下拉 <-> 环境参数状态；调用 algorithm 计算；
 * 驱动 sound 引擎播放；桥接 weather 自动获取。
 */
(function (global) {
  'use strict';

  var alg = global.HenSound.algorithm;
  var weather = global.HenSound.weather;
  var sound = global.HenSound.sound;

  function $(id) { return document.getElementById(id); }

  var els = {
    temp: $('in-temperature'), outTemp: $('out-temperature'),
    hum: $('in-humidity'), outHum: $('out-humidity'),
    sun: $('in-sunshine'), outSun: $('out-sunshine'),
    weather: $('in-weather'),
    fillTemp: $('fill-temperature'), numTemp: $('num-temperature'),
    fillHum: $('fill-humidity'), numHum: $('num-humidity'),
    fillSun: $('fill-sunshine'), numSun: $('num-sunshine'),
    fillWx: $('fill-weather'), numWx: $('num-weather'),
    comfortValue: $('comfort-value'), comfortLabel: $('comfort-label'), comfortFill: $('comfort-bar-fill'),
    pFreq: $('p-freq'), pPulse: $('p-pulse'), pWave: $('p-wave'), pGain: $('p-gain'),
    btnLocate: $('btn-locate'), locationLabel: $('location-label'),
    btnPlay: $('btn-play'), btnStop: $('btn-stop'),
    volume: $('in-volume'), status: $('status-text'),
    canvas: $('wave-canvas')
  };

  var WAVE_LABEL = { sine: '正弦（柔和）', triangle: '三角（明亮）', square: '方波（尖锐）' };
  var COMFORT_LABEL = [
    { min: 80, text: '非常适宜' }, { min: 60, text: '较适宜' },
    { min: 40, text: '一般' }, { min: 0, text: '不太适宜' }
  ];

  var env = {
    temperature: 20,
    humidity: 60,
    sunshine: 70,
    weatherLabel: 'partly_cloudy' // 手动模式默认"多云"
  };

  /* ---------- 滑块工具 ---------- */

  function paintSlider(input) {
    var min = parseFloat(input.min);
    var max = parseFloat(input.max);
    var v = parseFloat(input.value);
    var pct = Math.round((v - min) / (max - min) * 100);
    input.style.setProperty('--fill', pct + '%');
  }

  function syncSliderUI(input, output, value) {
    input.value = Math.round(value);
    output.textContent = input.value;
    paintSlider(input);
  }

  /* ---------- 渲染 ---------- */

  function setStatus(msg, isError) {
    els.status.textContent = msg || '';
    els.status.className = 'status-text' + (isError ? ' error' : '');
  }

  function setSub(fill, num, score) {
    fill.style.width = score + '%';
    num.textContent = score;
  }

  function render(r) {
    var c = r.comfort;
    var label = COMFORT_LABEL.find(function (x) { return c.value >= x.min; }) || COMFORT_LABEL[COMFORT_LABEL.length - 1];
    els.comfortValue.textContent = c.value;
    els.comfortLabel.textContent = label.text + '（' + c.groupLabel + '）';
    els.comfortFill.style.width = c.value + '%';

    setSub(els.fillTemp, els.numTemp, c.scores.temperature);
    setSub(els.fillHum, els.numHum, c.scores.humidity);
    setSub(els.fillSun, els.numSun, c.scores.sunshine);
    setSub(els.fillWx, els.numWx, c.scores.weather);

    els.pFreq.textContent = r.sound.baseFreq;
    els.pPulse.textContent = r.sound.pulsePerMin;
    els.pWave.textContent = WAVE_LABEL[r.sound.waveform] || r.sound.waveform;
    els.pGain.textContent = Math.round(r.sound.gain * 100) + '%';

    if (!sound.isPlaying()) sound.drawPreview(r.sound);
  }

  function computeAndApply() {
    var result = alg.analyze(env);
    sound.updateParams(result.sound);
    render(result);
    return result;
  }

  /* ---------- 手动模式 ---------- */

  function refreshFromControls() {
    env.temperature = parseFloat(els.temp.value);
    env.humidity = parseFloat(els.hum.value);
    env.sunshine = parseFloat(els.sun.value);
    env.weatherLabel = els.weather.value;
    delete env.weatherCode; // 手动调整即转手动模式
    els.locationLabel.textContent = '手动参数模式';
    computeAndApply();
  }

  function bindSlider(input, output) {
    input.addEventListener('input', function () {
      output.textContent = input.value;
      paintSlider(input);
      refreshFromControls();
    });
    paintSlider(input);
    syncSliderUI(input, output, parseFloat(input.value));
  }

  /* ---------- 自动获取 ---------- */

  function applyAuto(data) {
    var group = alg.groupFromCode(data.weatherCode);
    env.weatherCode = data.weatherCode;
    env.weatherLabel = group;
    env.temperature = data.temperature;
    env.humidity = data.humidity;
    env.sunshine = data.sunshine;

    syncSliderUI(els.temp, els.outTemp, data.temperature);
    syncSliderUI(els.hum, els.outHum, data.humidity);
    syncSliderUI(els.sun, els.outSun, data.sunshine);
    els.weather.value = group;

    els.locationLabel.textContent = (data.city || '当前位置') +
      (data.latitude ? '（' + data.latitude.toFixed(2) + ', ' + data.longitude.toFixed(2) + '）' : '');
    computeAndApply();
  }

  function handleLocate() {
    setStatus('正在定位并获取当地天气…');
    els.btnLocate.disabled = true;
    weather.fetchLocalWeather()
      .then(function (data) {
        applyAuto(data);
        setStatus('已按 ' + (data.city || '当前位置') + ' 的当地实况更新声波参数（日照率 ' + data.sunshine + '%）');
      })
      .catch(function (err) {
        setStatus('自动获取失败：' + err.message + '，可继续手动设置。', true);
      })
      .finally(function () {
        els.btnLocate.disabled = false;
      });
  }

  /* ---------- 播放控制 ---------- */

  function handlePlay() {
    var result = alg.analyze(env);
    var ok = sound.start(result.sound);
    if (!ok) {
      setStatus('当前浏览器不支持 Web Audio API，无法播放声波。', true);
      return;
    }
    els.btnPlay.disabled = true;
    els.btnPlay.classList.add('playing');
    els.btnStop.disabled = false;
    setStatus('正在播放：' + result.sound.baseFreq + ' Hz ' +
      (WAVE_LABEL[result.sound.waveform] || result.sound.waveform) +
      '，' + result.sound.pulsePerMin + ' 次/分');
  }

  function handleStop() {
    sound.stop();
    els.btnPlay.disabled = false;
    els.btnPlay.classList.remove('playing');
    els.btnStop.disabled = true;
    sound.drawPreview(alg.analyze(env).sound);
    setStatus('已停止播放。');
  }

  /* ---------- 初始化 ---------- */

  function init() {
    bindSlider(els.temp, els.outTemp);
    bindSlider(els.hum, els.outHum);
    bindSlider(els.sun, els.outSun);

    els.weather.addEventListener('change', refreshFromControls);

    els.btnLocate.addEventListener('click', handleLocate);
    els.btnPlay.addEventListener('click', handlePlay);
    els.btnStop.addEventListener('click', handleStop);

    els.volume.addEventListener('input', function () {
      sound.setVolume(parseFloat(els.volume.value) / 100);
    });
    sound.setVolume(parseFloat(els.volume.value) / 100);

    sound.setCanvas(els.canvas);
    refreshFromControls();
    setStatus('提示：可点击"自动获取当地天气"，或直接拖动参数查看声波变化。');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);