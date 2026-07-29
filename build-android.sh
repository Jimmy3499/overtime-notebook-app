#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# release（默认）或 debug
BUILD_TYPE="${1:-release}"

echo "=== 加班小账本 - APK 构建脚本 (${BUILD_TYPE}) ==="
echo ""

# 如沙箱需走内部代理，可在此设置信任库，例如：
# export JAVA_TOOL_OPTIONS="-Djavax.net.ssl.trustStore=/path/to/cacerts"

if [ ! -d "node_modules" ]; then
  echo "[1/6] 安装依赖..."
  npm install
else
  echo "[1/6] 依赖已安装，跳过"
fi

echo "[2/6] 生成原生项目..."
npx expo prebuild --platform android --clean

echo "[2.5/6] 让 debug 变体也打包 JS bundle（避免安装后报 'Unable to load script'）..."
if ! grep -q "debuggableVariants" android/app/build.gradle; then
  sed -i '/bundleCommand = "export:embed"/a\    debuggableVariants = []' android/app/build.gradle
  echo "已注入 debuggableVariants = []"
fi

echo "[2.6/6] 确保 splash 纯色 logo 存在（expo-splash-screen 主题会引用 @drawable/splashscreen_logo）..."
SPLASH_LOGO=android/app/src/main/res/drawable/splashscreen_logo.png
if [ ! -f "$SPLASH_LOGO" ]; then
  mkdir -p android/app/src/main/res/drawable
  python3 - <<'PY'
from PIL import Image
# 与启动页背景同色 #b45309，视觉上仍是纯色启动页
Image.new("RGB", (512, 512), (0xb4, 0x53, 0x09)).save("android/app/src/main/res/drawable/splashscreen_logo.png")
print("已生成纯色 splashscreen_logo.png")
PY
fi

if [ "$BUILD_TYPE" = "release" ]; then
  echo "[3/6] 生成 release 签名密钥库 (keystore)..."
  KS=android/app/release-key.keystore
  PROPS=android/app/keystore.properties
  ALIAS=overtime
  STOREPASS=overtime123
  KEYPASS=overtime123
  if [ ! -f "$KS" ]; then
    keytool -genkeypair -v \
      -keystore "$KS" -alias "$ALIAS" \
      -keyalg RSA -keysize 2048 -validity 10000 \
      -storepass "$STOREPASS" -keypass "$KEYPASS" \
      -dname "CN=Jimmy3499, OU=Overtime Notebook, O=Jimmy3499, L=, ST=, C=CN"
    echo "已生成 release-key.keystore"
  fi
  cat > "$PROPS" <<EOF
STORE_FILE=release-key.keystore
STORE_PASSWORD=$STOREPASS
KEY_ALIAS=$ALIAS
KEY_PASSWORD=$KEYPASS
EOF
  echo "已写入 keystore.properties"

  echo "[4/6] 在 build.gradle 注入 release 签名配置..."
  python3 - <<'PY'
import re
p = "android/app/build.gradle"
s = open(p).read()

release_block = '''    release {
        def ksFile = rootProject.file('app/keystore.properties')
        if (ksFile.exists()) {
            def ks = new Properties()
            ks.load(new FileInputStream(ksFile))
            storeFile file(ks['STORE_FILE'])
            storePassword ks['STORE_PASSWORD']
            keyAlias ks['KEY_ALIAS']
            keyPassword ks['KEY_PASSWORD']
        }
    }
'''
if 'signingConfigs.release' not in s:
    s = re.sub(r'(signingConfigs\s*\{)(.*?)(\n\})',
               lambda m: m.group(1) + m.group(2) + '\n' + release_block + m.group(3),
               s, count=1, flags=re.S)
    print("已注入 signingConfigs.release 块")

if 'signingConfig signingConfigs.release' not in s:
    s = re.sub(r'(buildTypes\s*\{.*?release\s*\{.*?)signingConfig signingConfigs\.debug',
               lambda m: m.group(1) + 'signingConfig signingConfigs.release',
               s, count=1, flags=re.S)
    print("已将 release buildType 的签名切换为 signingConfigs.release")

open(p, "w").write(s)
PY

  echo "[5/6] 构建 APK (release)..."
  cd android
  CMAKE_BUILD_PARALLEL_LEVEL=1 taskset -c 0-1 ./gradlew assembleRelease --no-daemon
  cd ..

  # 把密钥库备份到仓库外，方便日后升级使用（请勿提交到 git）
  BACKUP_DIR="../overtime-notebook-app-release-keystore"
  mkdir -p "$BACKUP_DIR"
  cp android/app/release-key.keystore "$BACKUP_DIR/release-key.keystore"
  {
    echo "STORE_FILE=release-key.keystore"
    echo "STORE_PASSWORD=$STOREPASS"
    echo "KEY_ALIAS=$ALIAS"
    echo "KEY_PASSWORD=$KEYPASS"
  } > "$BACKUP_DIR/keystore.properties"
  echo "已备份密钥库到 $BACKUP_DIR（请妥善保存，遗失后无法更新已发布的应用）"

  echo ""
  echo "[6/6] 完成！"
  echo "APK 路径: android/app/build/outputs/apk/release/app-release.apk"
else
  echo "[3/6] 构建 APK (debug)..."
  cd android
  CMAKE_BUILD_PARALLEL_LEVEL=1 taskset -c 0-1 ./gradlew assembleDebug --no-daemon
  cd ..
  echo ""
  echo "[4/6] 完成！"
  echo "APK 路径: android/app/build/outputs/apk/debug/app-debug.apk"
fi
