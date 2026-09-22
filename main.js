/*
 * main.js - 鸡语声波桌面应用主进程（Electron）
 *
 * 职责：
 *   1. 创建应用主窗口并加载本地静态页面（index.html + css + js）
 *   2. 放行地理位置权限（页面通过 navigator.geolocation 获取经纬度，
 *      用于请求 Open-Meteo 当地天气）
 *   3. 外部链接（GitHub 等）交给系统默认浏览器打开，不在应用内新开窗口
 *   4. 支持 --smoke-test 冒烟测试模式：加载页面后执行 DOM 检查并退出，
 *      用于打包后的自动化验证
 */
'use strict';

const { app, BrowserWindow, session, shell } = require('electron');
const path = require('path');

const isSmokeTest = process.argv.includes('--smoke-test');

function configurePermissions() {
  // 仅放行地理位置，其余权限（摄像头/麦克风/通知/剪贴板等）一律拒绝
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'geolocation');
  });
  // 文件下载等系统行为保持默认即可
}

function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 780,
    minWidth: 720,
    minHeight: 600,
    title: '鸡语声波 · 环境声波发生器',
    backgroundColor: '#1b2a1f',
    autoHideMenuBar: true,
    show: !isSmokeTest,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  // 页面中点击的 http(s) 链接用系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  return win;
}

async function runSmokeTest(win) {
  const results = { dom: false, scripts: false, audio: false, errors: [] };
  const webContents = win.webContents;

  webContents.on('console-message', (event, level, message) => {
    if (level >= 2) results.errors.push(message);
  });
  webContents.on('render-process-gone', () => {
    results.errors.push('render-process-gone');
  });

  try {
    // 页面可能早已加载完成，用轮询等待而不是依赖一次性事件
    const start = Date.now();
    let ready = false;
    while (Date.now() - start < 30000) {
      try {
        const state = await webContents.executeJavaScript('document.readyState');
        if (state === 'complete' || state === 'interactive') { ready = true; break; }
      } catch (e) { /* 页面尚未就绪，继续轮询 */ }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!ready) throw new Error('page not ready (timeout)');

    results.dom = await webContents.executeJavaScript(
      "!!(document.getElementById('btn-locate') && document.getElementById('btn-play') && " +
      "document.getElementById('in-temperature'))"
    );
    results.scripts = await webContents.executeJavaScript(
      "!!(window.HenSound && window.HenSound.algorithm && window.HenSound.weather && window.HenSound.sound)"
    );
    results.audio = await webContents.executeJavaScript(
      "!!(window.AudioContext || window.webkitAudioContext)"
    );
  } catch (e) {
    results.errors.push(String((e && e.message) || e));
  }

  console.log('SMOKE_RESULT ' + JSON.stringify(results));
  app.exit(results.dom && results.scripts && results.audio && results.errors.length === 0 ? 0 : 1);
}

app.whenReady().then(() => {
  configurePermissions();
  const win = createWindow();
  if (isSmokeTest) {
    runSmokeTest(win);
    return;
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});