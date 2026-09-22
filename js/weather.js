/*
 * weather.js - 当地天气数据获取模块
 *
 * 数据源：Open-Meteo（https://open-meteo.com），免费、无需 API Key、支持 CORS。
 *   天气实况  : /v1/forecast  → 温度、湿度、WMO 天气代码、昼夜
 *   日照时长  : daily.sunshine_duration（当日可照时数，秒）
 *   城市名称  : geocoding-api 按经纬度反查最近地点
 * 阳光照射率 = 当日日照秒数 / 当日白昼时长（日出-日落）x 100%
 * 任一步失败会抛出错误，由调用方回落到手动输入。
 */
(function (global) {
  'use strict';

  var FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
  var GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';

  function fetchJson(url, timeoutMs) {
    var controller = null;
    var timer = null;
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      timer = setTimeout(function () { controller.abort(); }, timeoutMs || 10000);
    }
    return fetch(url, controller ? { signal: controller.signal } : {})
      .then(function (res) {
        if (!res.ok) throw new Error('天气接口返回 ' + res.status);
        return res.json();
      })
      .finally(function () {
        if (timer) clearTimeout(timer);
      });
  }

  function getPosition() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) {
        reject(new Error('当前浏览器不支持定位，请手动设置参数'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, function (err) {
        var msg = err && err.message ? err.message : '未知错误';
        if (err && err.code === 1) msg = '用户拒绝了定位请求';
        reject(new Error('定位失败（' + msg + '）'));
      }, { timeout: 12000, maximumAge: 10 * 60 * 1000 });
    });
  }

  // 经纬度反查最近城市名；失败返回 null（不影响主流程）
  function reverseGeocode(lat, lon) {
    var url = GEO_URL + '?latitude=' + lat + '&longitude=' + lon +
      '&count=1&language=zh&format=json';
    return fetchJson(url)
      .then(function (j) {
        var r = j && j.results && j.results[0];
        if (!r) return null;
        var parts = [];
        if (r.name) parts.push(r.name);
        if (r.admin1 && r.admin1 !== r.name) parts.push(r.admin1);
        if (r.country) parts.push(r.country);
        return parts.join(' · ');
      })
      .catch(function () { return null; });
  }

  // 获取本地实况天气：温度(°C)、湿度(%RH)、WMO 天气代码、阳光照射率(0-100%)
  function fetchLocalWeather() {
    var coords = null;
    return getPosition()
      .then(function (pos) {
        coords = pos.coords;
        var url = FORECAST_URL +
          '?latitude=' + coords.latitude + '&longitude=' + coords.longitude +
          '&current=temperature_2m,relative_humidity_2m,weather_code,is_day' +
          '&daily=sunshine_duration,sunrise,sunset' +
          '&timezone=auto&forecast_days=1';
        return Promise.all([fetchJson(url), reverseGeocode(coords.latitude, coords.longitude)]);
      })
      .then(function (pair) {
        if (!pair[0] || !pair[0].current) throw new Error('天气数据为空');
        var j = pair[0];
        var city = pair[1];
        var c = j.current;
        var day = j.daily && j.daily.sunshine_duration ? j.daily.sunshine_duration[0] : null;
        var sunrise = j.daily && j.daily.sunrise ? j.daily.sunrise[0] : null;
        var sunset = j.daily && j.daily.sunset ? j.daily.sunset[0] : null;

        var sun = 70; // 默认值：日照数据缺失时按"较充足"处理
        if (typeof day === 'number') {
          var daySeconds = 12 * 3600; // 无日出日落信息时按 12 小时白昼近似
          if (sunrise && sunset) {
            var d = (new Date(sunset).getTime() - new Date(sunrise).getTime()) / 1000;
            if (isFinite(d) && d > 0) daySeconds = d;
          }
          sun = Math.round(day / daySeconds * 100);
        }

        return {
          city: city,
          latitude: coords.latitude,
          longitude: coords.longitude,
          temperature: c.temperature_2m,
          humidity: c.relative_humidity_2m,
          weatherCode: c.weather_code,
          isDay: !!c.is_day,
          sunshine: Math.max(0, Math.min(100, sun))
        };
      });
  }

  var api = {
    fetchLocalWeather: fetchLocalWeather,
    reverseGeocode: reverseGeocode,
    fetchJson: fetchJson
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.HenSound = global.HenSound || {};
  global.HenSound.weather = api;
})(typeof window !== 'undefined' ? window : globalThis);