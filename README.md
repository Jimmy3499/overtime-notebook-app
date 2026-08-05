# 加班小账本 - 完整项目

安卓端记加班 APP，本地存储，离线可用。当前源码版本 **v3.1.0**；已发布 APK 见 [GitHub Releases](https://github.com/Jimmy3499/overtime-notebook-app/releases)（v3.0.0 正式签名版）。

## 文件说明

- **APK 安装包**：不在仓库内（原生目录 `/android` 已 gitignore），请到 [GitHub Releases](https://github.com/Jimmy3499/overtime-notebook-app/releases) 下载 `app-release.apk`（**arm64-v8a 单架构**，v3.0.0 正式签名版，**仅支持 64 位设备**，32 位-only 的老手机无法安装）
- `src/` - 源代码目录（TypeScript + React Native）
- `assets/` - 图标、启动图等资源
- `App.tsx` - 应用入口
- `app.json` - Expo 配置（APP名称、图标、包名、版本号等）
- `package.json` - 依赖配置
- `tsconfig.json` - TypeScript 配置
- `build-android.sh` - APK 一键构建脚本（支持 release / debug）
- `使用协议.md` / `隐私政策.md` - 应用内内置协议正文（可在「设置 → 协议与政策」离线阅读）
- `LICENSE` - CC BY-NC 4.0 许可（仅供学习交流，禁止商业用途）

## 功能

- 加班记录管理（增删改查）
- 自动核算加班时长（精确到 0.5 小时）
- 工作日/周末/节假日加班类型自动识别
- 日历视图 + 标记功能
- **日历多选汇总**：选择多个日期 → 一键计算总时长 / 合计收入 / 每日明细（v3.1.0 新增）
- **生成加班单提示词**：汇总弹窗内一键拼装"帮本人生成一个加班单…"文本并复制到剪贴板，便于粘贴到 OA / 聊天工具（v3.1.0 新增）
- 加班工资统计（月薪 / 时薪自动换算）
- 数据导出 CSV
- 本地存储（AsyncStorage），无需联网
- 节假日识别（离线兜底为主、联网为增强）：内置 2025–2026 年国务院法定节假日与调休补班数据，**离线即可正确识别**；首次启动会尝试从 [timor.tech](https://timor.tech) 联网拉取近三年数据作增强（该公开接口偶尔不可达，失败则沿用内置数据，功能不受影响）；也可在「设置 → 节假日与调休补班」页手动同步；手动添加的节假日不会被官方数据覆盖
- 纯色启动页、自定义矮导航栏
- 内置《使用协议》与《隐私政策》，可离线阅读

## 安装 APK

推荐从 [GitHub Releases](https://github.com/Jimmy3499/overtime-notebook-app/releases) 下载最新的 `app-release.apk`（**arm64-v8a 单架构**的 v3.0.0 正式签名版），再按以下步骤安装：

1. 把 APK 传到安卓手机（浏览器直接下载、或用数据线 / U 盘 / 聊天工具传过去均可）。
2. 在手机上点击 APK 文件开始安装。
3. **允许"未知来源"安装**（安卓 8.0+ 需要为对应 App 授权）：
   - 安卓 8–11：弹窗点「设置」→ 开启「允许来自此来源的应用」→ 返回继续安装。
   - 安卓 12+：弹窗直接点「允许」即可；或在 `设置 → 安全 → 安装未知应用` 里给浏览器 / 文件管理器开权限。
4. 安装完成后在桌面找到应用图标即可打开使用。

> 下载 / 安装时的常见提示：
> - 浏览器（如 Chrome）下载 APK 可能弹出"此文件类型可能有害"或"无法下载"——这是安卓对未知来源安装包的常规拦截，**点"继续 / 仍要下载"即可**，不是链接或文件损坏。
> - 若安装被拦截，检查上述"未知来源"权限是否已为当前使用的浏览器 / 文件管理器开启。
> - 本版本为正式签名发布版（使用自有 keystore 签名），可正常安装使用。
>
> 首次启动说明：应用内置 2025–2026 年节假日数据，离线即可正确识别；启动时会尝试从 timor.tech 联网拉取近三年数据作增强（接口可能不可达，失败则沿用内置数据，不影响使用）；如需立即更新，进入「设置 → 节假日与调休补班」点"同步"。

## 重新构建 APK

仓库自带 `build-android.sh`，可一键构建（会自动执行 `expo prebuild` 并注入签名配置）：

```bash
bash build-android.sh release   # 构建签名 release 包（默认），产物: android/app/build/outputs/apk/release/app-release.apk
bash build-android.sh debug     # 构建 debug 包，产物: android/app/build/outputs/apk/debug/app-debug.apk
```

> 说明：
> - release 构建需要签名密钥库。脚本默认在仓库根目录生成 `release-key.keystore`（已被 `.gitignore` 忽略，不会提交）；如需用自己的密钥，请修改脚本中的 `keytool` 参数与 `android/app/keystore.properties`。
> - **⚠️ 密钥库保管（非常重要）**：`release-key.keystore` 不入库。若要给用户推送更新，**必须使用与已发布版本相同的 keystore**，否则用户设备上已装版本会因"签名冲突"无法覆盖安装（只能卸载重装，本地数据将丢失）。脚本每次运行若根目录已存在该文件则会复用（不会覆盖）；若工作树被清空或换机器重新 clone 而缺失该文件，脚本会生成全新密钥。请务必妥善保存仓库外的备份 `overtime-notebook-app-release-keystore/`，切勿公开或提交到 git。
> - `/android` 为预生成目录，已被 gitignore，无需提交；`expo prebuild` 会按需重新生成。
> - release 构建已默认移除 `SYSTEM_ALERT_WINDOW`（"显示在其他应用上层"）这一多余权限。

## 技术栈

- React Native + Expo
- TypeScript
- React Navigation
- AsyncStorage

