#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# 自动探测 Android SDK 位置（沙箱/CI 可能未设置 ANDROID_HOME）
if [ -z "$ANDROID_HOME" ]; then
  for d in /root/android-sdk "$HOME/Android/Sdk" /opt/android-sdk /usr/lib/android-sdk; do
    if [ -d "$d" ]; then export ANDROID_HOME="$d"; break; fi
  done
fi
echo "ANDROID_HOME=${ANDROID_HOME:-（未设置）}"

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

echo "[2.7/6] 限制原生库仅为 arm64-v8a（减小包体，覆盖 2015 年后的安卓手机）..."
python3 - <<'PY'
p = "android/app/build.gradle"
s = open(p).read()
if 'abiFilters' not in s:
    s = s.replace('    defaultConfig {\n',
                  '    defaultConfig {\n        ndk {\n            abiFilters "arm64-v8a"\n        }\n', 1)
    print("已注入 ndk.abiFilters arm64-v8a")
else:
    print("已存在 abiFilters，跳过")
open(p, "w").write(s)
PY

echo "[2.8/6] 仅保留 arm64-v8a 架构（修改 gradle.properties 的 reactNativeArchitectures，RN 插件据此设置 abiFilters）..."
GP=android/gradle.properties
if [ -f "$GP" ]; then
  sed -i 's/^reactNativeArchitectures=.*/reactNativeArchitectures=arm64-v8a/' "$GP"
  echo "已设置 reactNativeArchitectures=arm64-v8a"
fi

echo "[2.6/6] 确保 splash 纯色 logo 存在（expo-splash-screen 主题会引用 @drawable/splashscreen_logo）..."
SPLASH_LOGO=android/app/src/main/res/drawable/splashscreen_logo.png
if [ ! -f "$SPLASH_LOGO" ]; then
  mkdir -p android/app/src/main/res/drawable
  # 纯 Python（stdlib zlib+struct）生成纯色 PNG，避免依赖 Pillow（CI 默认未安装）
  python3 - <<'PY'
import zlib, struct
def _chunk(tag, data):
    c = tag + data
    return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
w = h = 512
col = (0xb4, 0x53, 0x09)  # 与启动页背景同色 #b45309
raw = b"".join(b"\x00" + bytes(col) * w for _ in range(h))
png = (b"\x89PNG\r\n\x1a\n"
       + _chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
       + _chunk(b"IDAT", zlib.compress(raw, 9))
       + _chunk(b"IEND", b""))
with open("android/app/src/main/res/drawable/splashscreen_logo.png", "wb") as f:
    f.write(png)
print("已生成纯色 splashscreen_logo.png（无需 Pillow）")
PY
fi

echo "[2.9/6] 移除不必要的 SYSTEM_ALERT_WINDOW 权限（来自 Expo 默认模板，对离线记账 App 无意义且未在隐私政策中声明）..."
MAN=android/app/src/main/AndroidManifest.xml
if [ -f "$MAN" ]; then
  sed -i '/android.permission.SYSTEM_ALERT_WINDOW/d' "$MAN"
  echo "已从主清单移除 SYSTEM_ALERT_WINDOW"
else
  echo "未找到主清单，跳过"
fi

if [ "$BUILD_TYPE" = "release" ]; then
  echo "[3/6] 准备 release 签名密钥库 (keystore)..."
  ALIAS=overtime
  STOREPASS=overtime123
  KEYPASS=overtime123
  KS_SRC=release-key.keystore          # 仓库根目录（已被 .gitignore 忽略，不会提交）
  KS_DST=android/app/release-key.keystore
  PROPS_DST=android/app/keystore.properties
  if [ ! -f "$KS_SRC" ]; then
    keytool -genkeypair -v \
      -keystore "$KS_SRC" -alias "$ALIAS" \
      -keyalg RSA -keysize 2048 -validity 10000 \
      -storepass "$STOREPASS" -keypass "$KEYPASS" \
      -dname "CN=Jimmy3499, OU=Overtime Notebook, O=Jimmy3499, L=, ST=, C=CN"
    echo "已生成 release-key.keystore（位于仓库根目录，已 gitignore）"
  else
    echo "复用已存在的 release-key.keystore"
  fi
  cp "$KS_SRC" "$KS_DST"
  cat > "$PROPS_DST" <<EOF
STORE_FILE=release-key.keystore
STORE_PASSWORD=$STOREPASS
KEY_ALIAS=$ALIAS
KEY_PASSWORD=$KEYPASS
EOF
  echo "已写入 android/app/keystore.properties"

  echo "[4/6] 在 build.gradle 注入 release 签名配置..."
  python3 - <<'PY'
p = "android/app/build.gradle"
s = open(p).read()

debug_block = '''        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }'''
release_block = '''        release {
            def ksFile = rootProject.file('app/keystore.properties')
            if (ksFile.exists()) {
                def ks = new Properties()
                ks.load(new FileInputStream(ksFile))
                storeFile file(ks['STORE_FILE'])
                storePassword ks['STORE_PASSWORD']
                keyAlias ks['KEY_ALIAS']
                keyPassword ks['KEY_PASSWORD']
            }
        }'''

if 'signingConfigs.release' not in s:
    assert debug_block in s, "未找到 signingConfigs debug 块，无法注入 release 签名"
    s = s.replace(debug_block, debug_block + "\n" + release_block, 1)
    print("已注入 signingConfigs.release 块")

if 'signingConfig signingConfigs.release' not in s:
    # 将 buildType 的签名统一切换到 release（debug buildType 用 release 密钥也无妨）
    s = s.replace('signingConfig signingConfigs.debug', 'signingConfig signingConfigs.release')
    print("已将 buildType 签名切换为 signingConfigs.release")

open(p, "w").write(s)
PY

  echo "[5/6] 构建 APK (release)..."
  cd android
  CMAKE_BUILD_PARALLEL_LEVEL=1 taskset -c 0-1 ./gradlew assembleRelease --no-daemon
  cd ..

  # 备份密钥库到仓库外，方便日后升级使用（请勿提交到 git）
  BACKUP_DIR="../overtime-notebook-app-release-keystore"
  mkdir -p "$BACKUP_DIR"
  cp "$KS_SRC" "$BACKUP_DIR/release-key.keystore"
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
