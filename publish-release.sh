#!/usr/bin/env bash
#
# publish-release.sh  —— 一键发布 v3.2.1
#
# 依次完成：
#   1) 推送 master 分支（含源码 + site/ 网页版产物 + holidays.json）
#   2) 把 site/ 发布到 gh-pages 分支（GitHub Pages 网页版）
#   3) 打 tag v3.2.1 并推送，触发 GitHub Actions 自动构建 APK 并发布到 Release
#
# 前置条件：本机已配置好能推送到
#   https://github.com/Jimmy3499/overtime-notebook-app
#   的凭证（推荐 `gh auth login`，或 git 凭据里密码处填 Personal Access Token）。
#
# 用法（在仓库根目录执行）：
#   bash publish-release.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

echo "🔍 校验：当前是否在仓库根目录、site/ 是否存在..."
if [ ! -d "$REPO_ROOT/site" ]; then
  echo "❌ 找不到 $REPO_ROOT/site，请在仓库根目录运行本脚本。" >&2
  exit 1
fi

echo "🚀 1/3  推送 master ..."
git push origin master

echo "🌐 2/3  发布网页版到 gh-pages ..."
bash "$REPO_ROOT/deploy-gh-pages.sh"

echo "🏷️  3/3  打 tag v3.2.1 并推送（触发 CI 构建 APK）..."
git tag -f v3.2.1
git push origin v3.2.1 --force

echo ""
echo "✅ 全部完成！"
echo "   · 源码 / 网页版产物 / holidays.json → 已推送到 master"
echo "   · 网页版（GitHub Pages）：https://jimmy3499.github.io/overtime-notebook-app/ （约 1 分钟生效）"
echo "   · APK：GitHub Actions 构建完成后出现在 Release v3.2.1："
echo "     https://github.com/Jimmy3499/overtime-notebook-app/releases/tag/v3.2.1"
echo "   · 落地页「下载安卓 APK」按钮已指向 v3.2.1 的 app-release.apk"
