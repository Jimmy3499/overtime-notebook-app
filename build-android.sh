#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "=== 加班小账本 - APK 构建脚本 ==="
echo ""

if [ ! -d "node_modules" ]; then
  echo "[1/4] 安装依赖..."
  npm install
else
  echo "[1/4] 依赖已安装，跳过"
fi

echo "[2/4] 生成原生项目..."
npx expo prebuild --platform android --clean

echo "[3/4] 构建 APK (debug)..."
cd android
./gradlew assembleDebug

echo ""
echo "[4/4] 完成！"
echo "APK 路径: android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "如需构建 release 版本，请配置签名后运行："
echo "  cd android && ./gradlew assembleRelease"
