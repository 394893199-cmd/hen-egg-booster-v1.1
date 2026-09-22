#!/usr/bin/env bash
# =============================================================================
# 鸡语声波 Chicken Sound Waves - macOS 一键构建脚本
# -----------------------------------------------------------------------------
# 用法（在 macOS 终端中执行）：
#   bash build-mac.sh            # 构建 dmg + zip（x64 + arm64 双架构）
#   bash build-mac.sh dmg        # 只构建 DMG 安装盘
#   bash build-mac.sh zip        # 只构建 ZIP 应用压缩包
#   bash build-mac.sh all x64    # 只构建 Intel (x64) 架构
#   bash build-mac.sh all arm64  # 只构建 Apple Silicon (arm64) 架构
#
# 产物输出到 release/ 目录：
#   ChickenSoundWaves-<version>-mac-<arch>.dmg / .zip
# =============================================================================
set -euo pipefail

TARGET="${1:-all}"     # all | dmg | zip
ARCH="${2:-}"          # 空 = 双架构（x64 + arm64）；可选 x64 / arm64

cd "$(dirname "$0")"

echo "==> 检查系统环境"
uname -a | grep -qi darwin || { echo "错误：本脚本只能在 macOS 上运行（DMG 产物需 macOS 工具链）。"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "错误：未检测到 Node.js，请先安装 Node.js 20+（https://nodejs.org）"; exit 1; }
NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "警告：当前 Node $(node -v)，建议使用 Node 20+"
fi

echo "==> 安装依赖（npm ci）"
npm ci

echo "==> 构建 macOS 产物"
case "$TARGET" in
  dmg)  CMD="npm run dist:mac:dmg" ;;
  zip)  CMD="npm run dist:mac:zip" ;;
  all)  CMD="npm run dist:mac:dmg && npm run dist:mac:zip" ;;
  *)    echo "错误：未知目标 '$TARGET'（可选 all | dmg | zip）"; exit 2 ;;
esac

# 本项目未配置 Apple Developer 签名证书，跳过代码签名（与 CI 一致）
CSC_IDENTITY_AUTO_DISCOVERY="false" bash -c "$CMD $([ -n "$ARCH" ] && echo --$ARCH)"

echo
echo "==> 构建完成，产物如下："
ls -lh release/ | grep -E '\.(dmg|zip)$' || {
  echo "未在 release/ 找到产物，请检查上方构建日志。"
  exit 1
}
echo
echo "提示：首次打开应用若提示“无法验证开发者”，见 INSTALL-MAC.md 第 4 节放行。"