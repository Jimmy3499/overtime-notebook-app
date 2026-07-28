# 加班小账本 - 完整项目

安卓端记加班 APP，本地存储，离线可用。

## 文件说明

- `overtime-app.apk` - 已构建好的 APK 安装包（arm64-v8a），可直接安装
- `加班小账本.apk` - 同上，中文文件名
- `src/` - 源代码目录（TypeScript + React Native）
- `assets/` - 图标、启动图等资源
- `App.tsx` - 应用入口
- `app.json` - Expo 配置（APP名称、图标、包名等）
- `package.json` - 依赖配置
- `tsconfig.json` - TypeScript 配置
- `build-android.sh` - APK 构建脚本

## 功能

- 加班记录管理（增删改查）
- 自动核算加班时长（精确到 0.5 小时）
- 工作日/周末/节假日加班类型自动识别
- 日历视图 + 标记功能
- 加班工资统计（月薪 / 时薪自动换算）
- 数据导出 CSV
- 本地存储（AsyncStorage），无需联网

## 安装 APK

1. 将 `overtime-app.apk` 传到安卓手机
2. 点击 APK 文件安装（需允许"未知来源"）
3. 安装后桌面找到「加班小账本」图标即可使用

## 重新构建 APK

```bash
cd overtime-app
npm install
npx expo prebuild --platform android
cd android
./gradlew assembleDebug
# 产物: android/app/build/outputs/apk/debug/app-debug.apk
```

## 技术栈

- React Native + Expo
- TypeScript
- React Navigation
- AsyncStorage
