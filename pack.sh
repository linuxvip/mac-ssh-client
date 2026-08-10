#!/bin/bash
#
# pack.sh — SSH Client 一键打包脚本（macOS）
#
# 流程：编译 → 打包 .app → ad-hoc 签名 → 安装到 /Applications → 清除隔离属性 → 打开
#
# 用法：
#   ./pack.sh          # 全流程
#   ./pack.sh --dmg    # 额外生成 DMG 安装包（dist/SSH Client-*.dmg）
#   ./pack.sh --no-open   # 打包安装后不自动打开应用
#
set -euo pipefail

APP_NAME="SSH Client"
APP_BUNDLE="$APP_NAME.app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
APP_DIR="$DIST_DIR/mac-arm64"
INSTALL_DIR="/Applications/$APP_BUNDLE"
OPEN_APP=1
MAKE_DMG=0

for arg in "$@"; do
  case "$arg" in
    --dmg)     MAKE_DMG=1 ;;
    --no-open) OPEN_APP=0 ;;
    *) echo "未知参数: $arg（支持: --dmg --no-open）"; exit 1 ;;
  esac
done

step() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
fail() { printf "\033[1;31m[失败] %s\033[0m\n" "$*"; exit 1; }
ok()   { printf "\033[1;32m[完成] %s\033[0m\n" "$*"; }

cd "$SCRIPT_DIR"

# ── 1. 编译 ──────────────────────────────────────────────────────────
step "1/6 编译渲染与主进程 (npm run build)"
npm run build || fail "编译失败，请检查源码错误"

# ── 2. 打包 .app ─────────────────────────────────────────────────────
step "2/6 打包 .app (electron-builder --dir)"
npx electron-builder --mac --dir || fail "打包 .app 失败"

[ -d "$APP_DIR/$APP_BUNDLE" ] || fail "未找到打包产物: $APP_DIR/$APP_BUNDLE"

# ── 3. 签名 ──────────────────────────────────────────────────────────
# 有 Developer ID 证书时 electron-builder 已自动签名，这里做兜底（ad-hoc）
step "3/6 代码签名（ad-hoc 兜底）"
if codesign --verify --deep --strict "$APP_DIR/$APP_BUNDLE" 2>/dev/null; then
  ok "应用已签名，跳过"
else
  codesign --force --deep --sign - "$APP_DIR/$APP_BUNDLE" || fail "签名失败"
  codesign --verify --deep --strict "$APP_DIR/$APP_BUNDLE" || fail "签名校验失败"
  ok "ad-hoc 签名完成"
fi

# ── 4. 安装到 /Applications ──────────────────────────────────────────
step "4/6 安装到 /Applications"
if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
fi
cp -R "$APP_DIR/$APP_BUNDLE" "$INSTALL_DIR" || fail "复制到 /Applications 失败"

# ── 5. 清除 Gatekeeper 隔离属性 ─────────────────────────────────────
step "5/6 清除隔离属性（避免被 Gatekeeper 拦截）"
xattr -dr com.apple.quarantine "$INSTALL_DIR" 2>/dev/null || true
xattr -cr "$INSTALL_DIR" 2>/dev/null || true
ok "隔离属性已清除"

# ── 6. 可选：生成 DMG ───────────────────────────────────────────────
if [ "$MAKE_DMG" -eq 1 ]; then
  step "6/6 生成 DMG 安装包"
  npx electron-builder --mac || fail "DMG 打包失败"
  ok "DMG 已生成: $DIST_DIR/SSH Client-*.dmg"
else
  step "6/6 完成"
fi

echo ""
echo "=============================================================="
echo " 打包完成!"
echo " 应用已安装: $INSTALL_DIR"
if [ "$MAKE_DMG" -eq 1 ]; then
  echo " DMG 产物:   $DIST_DIR/SSH Client-*.dmg"
fi
echo "=============================================================="

# ── 打开应用 ────────────────────────────────────────────────────────
if [ "$OPEN_APP" -eq 1 ]; then
  open "$INSTALL_DIR" || fail "打开应用失败"
  ok "应用已启动"
fi
