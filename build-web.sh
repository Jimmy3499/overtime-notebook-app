#!/usr/bin/env bash
#
# build-web.sh
# 导出网页版（PWA）并把导出结果整理进 site/ 目录，统一改用「相对路径」，
# 这样同一份产物既能部署到根路径（如 *.agentos-app.net），也能部署到
# GitHub Pages 子路径（https://<user>.github.io/overtime-notebook-app/）。
#
# 用法（仓库根目录）：
#   bash build-web.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

APP_DIR="site/app"
DIST="dist"

echo "📦 1/4  导出 Expo Web 构建到 $DIST ..."
rm -rf "$DIST"
npx expo export -p web --output-dir "$DIST"

echo "🔗 2/4  把绝对路径改为相对路径（兼容子路径部署）..."
# index.html 里的 favicon / 主包引用
sed -i 's|href="/|href="./|g; s|src="/|src="./|g' "$DIST/index.html"
# JS 包体内部对 /assets/ 的引用（导航图标等）
sed -i 's|"/assets/|"./assets/|g' "$DIST"/_expo/static/js/web/*.js

echo "🧩 3/4  合并到 $APP_DIR，保留 PWA 元数据（manifest / sw / 图标）..."
# 先清空旧的 _expo / assets（含上一次构建的哈希文件名），避免残留旧产物
rm -rf "$APP_DIR/_expo" "$APP_DIR/assets"
# 覆盖 Expo 产出的内容（_expo 主包、assets、favicon、metadata）
cp -Rf "$DIST/_expo" "$APP_DIR/"
cp -Rf "$DIST/assets" "$APP_DIR/" 2>/dev/null || true
cp -f "$DIST/favicon.ico" "$APP_DIR/favicon.ico"
cp -f "$DIST/metadata.json" "$APP_DIR/metadata.json"

# index.html 采用已调好的 PWA 模板（含 manifest / apple / sw 注册、相对路径），
# 仅替换其中的主包哈希文件名，避免每次手写。
NEW_JS="$(ls "$DIST"/_expo/static/js/web/*.js | xargs -n1 basename)"
sed -i -E "s|index-[a-f0-9]+\.js|$NEW_JS|g" "$APP_DIR/index.html"

# GitHub Pages 默认会用 Jekyll 处理站点，而 Jekyll 会丢弃以下划线 _ 开头的
# 目录（如 Expo 导出的 _expo/），导致主包 JS 404、网页版打不开。
# 放置 .nojekyll 可关闭 Jekyll，让 _expo / assets 等静态文件原样提供。
touch "$REPO_ROOT/site/.nojekyll"

echo "✅ 4/4  完成。site/ 已就绪，可直接部署。"
echo "   主包：$NEW_JS"
echo "   已写入 site/.nojekyll（关闭 GitHub Pages 的 Jekyll，避免 _expo 被忽略）"
