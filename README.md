# 加班小账本 - 完整项目

安卓端记加班 APP，本地存储，离线可用。

## 文件说明

- **APK 安装包**：不在仓库内，请到 [GitHub Releases](https://github.com/Jimmy3499/overtime-notebook/releases) 下载 `overtime-notebook-debug.apk`（arm64-v8a，debug 包）
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
- 节假日自动同步：从 [timor.tech](https://timor.tech) 拉取近三年法定节假日与调休补班（首次启动自动静默同步，也可在「设置 → 节假日与调休补班」页手动同步；手动添加的节假日不会被官方数据覆盖）

## 安装 APK

推荐从 [GitHub Releases](https://github.com/Jimmy3499/overtime-notebook/releases) 下载最新的 `overtime-notebook-debug.apk`，再按以下步骤安装：

1. 把 APK 传到安卓手机（浏览器直接下载、或用数据线 / U 盘 / 聊天工具传过去均可）。
2. 在手机上点击 APK 文件开始安装。
3. **允许"未知来源"安装**（安卓 8.0+ 需要为对应 App 授权）：
   - 安卓 8–11：弹窗点「设置」→ 开启「允许来自此来源的应用」→ 返回继续安装。
   - 安卓 12+：弹窗直接点「允许」即可；或在 `设置 → 安全 → 安装未知应用` 里给浏览器 / 文件管理器开权限。
4. 安装完成后在桌面找到应用图标即可打开使用。

> 下载 / 安装时的常见提示：
> - 浏览器（如 Chrome）下载 APK 可能弹出"此文件类型可能有害"或"无法下载"——这是安卓对未知来源安装包的常规拦截，**点"继续 / 仍要下载"即可**，不是链接或文件损坏。
> - 若安装被拦截，检查上述"未知来源"权限是否已为当前使用的浏览器 / 文件管理器开启。
> - debug 包未经 Play Store 签名，属正常现象，不影响使用。
>
> 首次启动说明：应用启动后会联网从 timor.tech 自动同步近三年节假日（失败不影响使用）；如需立即更新，进入「设置 → 节假日与调休补班」点"同步"。

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
