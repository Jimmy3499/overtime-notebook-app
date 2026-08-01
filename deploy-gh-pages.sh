#!/usr/bin/env bash
#
# deploy-gh-pages.sh
# 把本仓库 site/ 目录的内容发布到 gh-pages 分支（用于 GitHub Pages）。
# 用法：在仓库根目录执行  bash deploy-gh-pages.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
SITE_DIR="$REPO_ROOT/site"

if [ ! -d "$SITE_DIR" ]; then
  echo "❌ 找不到 $SITE_DIR，请在仓库根目录运行本脚本。" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "📦 复制 site/ 内容到临时目录 $TMP ..."
cp -R "$SITE_DIR/." "$TMP/"

cd "$TMP"
git init -q
git checkout -b gh-pages
git add -A
git commit -q -m "deploy web v3.2.0 (PWA)"

echo "🚀 推送到 origin/gh-pages ..."
# 若环境里提供了 GH_TOKEN，则带上令牌推送；否则回退到无令牌地址（需本地已配好凭证）
REMOTE="https://github.com/Jimmy3499/overtime-notebook-app.git"
if [ -n "${GH_TOKEN:-}" ]; then
  REMOTE="https://x-access-token:${GH_TOKEN}@github.com/Jimmy3499/overtime-notebook-app.git"
fi
export GIT_TERMINAL_PROMPT=0
# 不禁用 credential helper：优先用 GH_TOKEN（若有），否则交给环境自带的凭据（沙箱 git-credential-helper）
git push --force "$REMOTE" gh-pages

echo ""
echo "✅ 推送完成！"
echo ""
echo "下一步（在 GitHub 网页端操作，约 1 分钟生效）："
echo "  1) 打开 https://github.com/Jimmy3499/overtime-notebook-app/settings/pages"
echo "  2) Source 选 'Deploy from a branch'"
echo "  3) Branch 选 'gh-pages'  /  '(root)'"
echo "  4) 点 Save"
echo "  5) 访问 https://jimmy3499.github.io/overtime-notebook-app/"
echo ""
echo "iPhone 用户：用 Safari 打开上面的链接 → 点 分享 → '添加到主屏幕'。"
