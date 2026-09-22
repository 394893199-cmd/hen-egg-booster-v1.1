# 鸡语声波 · macOS 安装与使用指南

鸡语声波 macOS 版与 Windows 版功能一致：根据当地温度、湿度、气候与阳光照射率，通过 Web Audio API 实时合成相应特征的声波，支持自动定位获取当地天气与手动参数设置。

> 科学边界声明：本项目仅根据环境参数生成声波，供观察与试验。「特定声波能提高产蛋率/改变鸡叫频率」目前缺乏充分、严谨的同行评议证据，请勿将本工具输出作为养殖决策依据，勿让鸡群长时间暴露高分贝声环境。

---

## 1. 系统要求

| 项目 | 要求 |
| --- | --- |
| 操作系统 | macOS 12（Monterey）及以上 |
| 芯片 | Apple Silicon（M 系列）与 Intel 均支持（分别提供 arm64 / x64 包） |
| 网络 | 可选；「自动获取当地天气」需联网访问 Open-Meteo（免费、免密钥），断网时可手动设置参数 |

## 2. 获取安装包（重要说明）

> **前提说明：本项目未在 Windows 构建 macOS 安装包的路径。** Electron 的 macOS 安装包（.dmg / .app）只能在 macOS 系统上构建，Windows/Linux 均无法产出（electron-builder 官方限制）。仓库已提供两种 macOS 下获取安装包的方式：

### 方式 A：GitHub Actions 自动构建（推荐，无需本地 Mac）

1. 将本工程推送到 GitHub 仓库；
2. 打开仓库页面 → **Actions** → 左侧选择 **Build macOS installers** → 右侧 **Run workflow** → 确认；
3. 等待约 3–5 分钟，构建完成后进入该次运行页面，底部的 **Artifacts** 区域下载 `mac-installers` 压缩包；
4. 解压得到 `ChickenSoundWaves-1.1.0-mac-x64.dmg`（Intel）与 `...-mac-arm64.dmg`（Apple Silicon）；
5. 后续推送 `v*` 标签（如 `v1.2.0`）也会自动触发构建。

### 方式 B：在 Mac 上本地构建（推荐有 Mac 时使用）

需要 macOS + Node.js 20+：

```bash
bash build-mac.sh            # 一键构建 dmg + zip（x64 + arm64）
bash build-mac.sh dmg        # 只构建 DMG 安装盘
bash build-mac.sh all x64    # Intel Mac 只构建 x64 架构
```

等价的手动命令：

```bash
npm install
npm run dist:mac:dmg    # 产出 release/*.dmg
npm run dist:mac:zip    # 或产出 release/*.zip（.app 压缩包）
```

本地开发调试：`npm start`。

## 3. 安装步骤

**方式一（DMG 安装盘）：**
1. 双击 `.dmg` 文件挂载安装盘；
2. 将「鸡语声波」图标拖入「应用程序」文件夹；
3. 从启动台或应用程序文件夹打开「鸡语声波」。

**方式二（ZIP 压缩包）：**
1. 解压 `ChickenSoundWaves-...-mac-<arch>.zip`；
2. 将解压出的「鸡语声波.app」拖入「应用程序」文件夹；
3. 打开运行。

## 4. 首次打开注意事项（未签名应用）

本项目未购买 Apple Developer 证书，应用为**未签名/临时签名**状态，macOS Gatekeeper 会拦截首次启动。按以下任一方式放行：

- **右键打开**：在「应用程序」中右键（或按住 Control 点击）「鸡语声波」→ 选择「打开」→ 再次点击「打开」；
- **系统设置**：打开「系统设置 → 隐私与安全性」，在「安全性」区域找到「仍要打开」并点击；
- **命令行（可选）**：`xattr -dr com.apple.quarantine "/Applications/鸡语声波.app"` 解除隔离属性。

后续启动即恢复正常。

## 5. 使用说明

- **自动获取当地天气**：首次点击「自动获取当地天气」时，macOS 会弹出定位授权提示，允许后程序按当地经纬度请求 Open-Meteo 实时天气并联动更新声波参数；
- **手动设置**：定位失败或不愿授权时可拖动滑杆手动设置温度/湿度/阳光照射率与天气状况；
- **播放/停止**：点击「播放声波」实时合成声波（含“咯-咯”双音听感），音量可调；
- 页面实时绘制波形，并展示环境舒适度指数（0–100）与分项得分。

## 6. 权限与隐私

- 定位仅用于请求本地天气，不存储、不上传、不发送给第三方；
- 天气数据来自 Open-Meteo（https://open-meteo.com）；
- 应用无遥测、统计或广告组件。

## 7. 常见问题

| 问题 | 说明与处理 |
| --- | --- |
| 「无法打开，因为无法验证开发者」 | 见第 4 节「首次打开注意事项」；点「完成」后右键重新打开。 |
| 定位一直失败 | 「系统设置 → 隐私与安全性 → 定位服务」确认已允许本应用，并开启系统定位；失败可回落到手动模式。 |
| 无网络 | 手动参数模式可完全离线使用，声波合成不依赖网络。 |
| 没有声音 | 检查系统音量与输出设备；部分虚拟音频设备可能与 Web Audio 不兼容。 |
| 下载的安装包提示损坏 | 重新下载并检查 SHA 校验；确认下载完整后再解压。 |

## 8. 从源码构建 macOS 安装包（交付工程自带配置）

mac 打包配置已内置在 `package.json`：目标 `dmg` 与 `zip`、架构 `x64 + arm64`、图标 `build/icon.icns`、应用分类 `public.app-category.utilities`。CI 工作流见 `.github/workflows/build-mac.yml`。