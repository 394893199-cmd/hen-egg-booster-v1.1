/*
 * algorithm.js - 环境参数 -> 声波参数 的映射算法（纯函数，便于测试）
 *
 * 输入：温度(°C)、湿度(%RH)、阳光照射率(0-100%)、天气代码(WMO weather_code 或文字标签)
 * 输出：环境舒适度指数(0-100) 与 声波参数（基频、脉冲节奏、波形、增益、脉冲时长）
 *
 * 设计说明：
 *   1. 光照是家禽产蛋最重要的环境刺激之一，权重最高；温度、湿度取养殖业常用适宜区间
 *      （温度约 18-24°C，湿度约 50-70%）作评分基准。
 *   2. 声波参数只描述"声波随环境如何变化"，便于用户观察与试验；
 *      本项目不声称声波能提高产蛋率，功效边界详见 README.md。
 */
(function (global) {
  'use strict';

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  /* ---------- 天气代码 -> 光照/应激分组 ---------- */
  var CODE_TO_GROUP = {
    0: 'sunny', 1: 'clear', 2: 'partly_cloudy', 3: 'overcast',
    45: 'fog', 48: 'fog',
    51: 'drizzle', 53: 'drizzle', 55: 'drizzle', 56: 'drizzle', 57: 'drizzle',
    61: 'rain', 63: 'rain', 65: 'rain', 66: 'rain', 67: 'rain',
    71: 'snow', 73: 'snow', 75: 'snow', 77: 'snow',
    80: 'rain', 81: 'rain', 82: 'rain',
    85: 'snow', 86: 'snow',
    95: 'thunderstorm', 96: 'thunderstorm', 99: 'thunderstorm'
  };

  var GROUP_SCORES = {
    sunny: 100,          // 晴
    clear: 95,           // 基本晴
    partly_cloudy: 80,   // 多云
    overcast: 60,        // 阴
    fog: 45,             // 雾
    drizzle: 55,         // 毛毛雨
    rain: 50,            // 雨
    snow: 35,            // 雪
    thunderstorm: 28     // 雷暴（应激最强）
  };

  var GROUP_LABELS = {
    sunny: '晴', clear: '晴间少云', partly_cloudy: '多云',
    overcast: '阴', fog: '雾', drizzle: '毛毛雨', rain: '雨',
    snow: '雪', thunderstorm: '雷暴'
  };

  function groupFromCode(code) {
    return CODE_TO_GROUP[code] || 'partly_cloudy';
  }

  /* ---------- 单项评分（0-100） ---------- */

  // 温度：18-24°C 最优区，向两端线性衰减
  function temperatureScore(t) {
    if (t < 0) return 15;
    if (t < 15) return 15 + (t / 15) * 55;           // 0°C->15, 15°C->70
    if (t <= 18) return 70 + ((t - 15) / 3) * 30;    // 18°C->100
    if (t <= 24) return 100;                          // 18-24°C 最优
    if (t <= 35) return 100 - ((t - 24) / 11) * 60;   // 35°C->40
    return Math.max(10, 40 - (t - 35) * 2);           // >35°C 快速衰减
  }

  // 湿度：50-70% 最优区
  function humidityScore(h) {
    if (h < 25) return 40;
    if (h < 50) return 40 + ((h - 25) / 25) * 60;     // 50%->100
    if (h <= 70) return 100;                           // 50-70% 最优
    if (h <= 90) return 100 - ((h - 70) / 20) * 50;    // 90%->50
    return Math.max(15, 50 - (h - 90) * 3.5);          // >90% 快速衰减
  }

  // 阳光照射率（0-100%）：日照越充足评分越高
  function sunshineScore(s) {
    if (s < 20) return 25 + s * 1.5;                   // 0->25, 20->55
    if (s <= 70) return 55 + (s - 20) * 0.62;          // 70->86
    return 86 + (s - 70) * 0.47;                       // 100->100
  }

  /* ---------- 综合舒适度指数 ---------- */

  function computeComfort(env) {
    var t = clamp(Number(env.temperature), -30, 45);
    var h = clamp(Number(env.humidity), 0, 100);
    var s = clamp(Number(env.sunshine), 0, 100);

    var group;
    if (typeof env.weatherCode === 'number') {
      group = groupFromCode(env.weatherCode);
    } else {
      // 允许按文字标签容错（如 "sunny"）
      group = GROUP_SCORES[env.weatherLabel] ? env.weatherLabel : 'partly_cloudy';
    }
    var weatherScore = GROUP_SCORES[group];

    // 光因子 = 实测阳光照射率(70%) + 天气状况(30%)
    var sunFactor = 0.7 * sunshineScore(s) + 0.3 * weatherScore;

    // 权重：光照 40% > 温度 35% > 湿度 25%
    var comfort = Math.round(
      0.35 * temperatureScore(t) +
      0.25 * humidityScore(h) +
      0.40 * sunFactor
    );
    return {
      value: clamp(comfort, 0, 100),
      group: group,
      groupLabel: GROUP_LABELS[group],
      scores: {
        temperature: Math.round(temperatureScore(t)),
        humidity: Math.round(humidityScore(h)),
        sunshine: Math.round(sunshineScore(s)),
        weather: weatherScore
      }
    };
  }

  /* ---------- 舒适度 -> 声波参数 ---------- */

  function soundParamsFromComfort(comfort) {
    var c = clamp(Number(comfort), 0, 100);

    // 基频：环境越适宜，越低沉舒缓（贴近母鸡低鸣区 200-400Hz）
    var baseFreq = 200 + (100 - c) * 4.0;             // c=100->200Hz, c=50->400Hz, c=0->600Hz

    // 脉冲节奏(次/分钟)：舒适 -> 舒缓；不适 -> 急促
    var pulsePerMin = 55 + (100 - c) * 1.5;           // c=100->55, c=0->205

    // 波形：越适宜越柔和
    var waveform = c >= 70 ? 'sine' : (c >= 45 ? 'triangle' : 'square');

    // 增益：低舒适度略提高音量提醒，带限幅
    var gain = 0.35 + (100 - c) * 0.004;              // c=100->0.35, c=0->0.75

    // 每个脉冲的时长（秒），占整个周期约 55%
    var pulseDuration = (60 / pulsePerMin) * 0.55;

    return {
      baseFreq: Math.round(baseFreq * 10) / 10,
      pulsePerMin: Math.round(pulsePerMin),
      waveform: waveform,
      gain: Math.round(gain * 100) / 100,
      pulseDuration: Math.round(pulseDuration * 1000) / 1000
    };
  }

  /* ---------- 便捷：一步算出环境对应的全部结果 ---------- */
  function analyze(env) {
    var comfort = computeComfort(env);
    var sound = soundParamsFromComfort(comfort.value);
    return { comfort: comfort, sound: sound };
  }

  var api = {
    CODE_TO_GROUP: CODE_TO_GROUP,
    GROUP_SCORES: GROUP_SCORES,
    GROUP_LABELS: GROUP_LABELS,
    groupFromCode: groupFromCode,
    temperatureScore: temperatureScore,
    humidityScore: humidityScore,
    sunshineScore: sunshineScore,
    computeComfort: computeComfort,
    soundParamsFromComfort: soundParamsFromComfort,
    analyze: analyze,
    clamp: clamp
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // Node 环境（测试用）
  }
  global.HenSound = global.HenSound || {};
  global.HenSound.algorithm = api;
})(typeof window !== 'undefined' ? window : globalThis);