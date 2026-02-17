#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  osascript -e 'display dialog "未检测到 pnpm，请先安装 pnpm（或启用 corepack）。" buttons {"确定"} default button 1 with icon stop'
  exit 1
fi

CHOICE="$(osascript <<'APPLESCRIPT'
set options to {"启动开发服务器", "安装依赖", "类型检查", "运行 ESLint", "自动修复 ESLint", "运行 Prettier 格式化", "检查 Prettier 格式", "运行测试", "构建项目", "一键回归"}
set picked to choose from list options with title "FD Gameplay Prototype" with prompt "请选择要执行的操作：" default items {"启动开发服务器"} OK button name "运行" cancel button name "取消"
if picked is false then
  return "CANCEL"
end if
return item 1 of picked
APPLESCRIPT
)"

if [ "$CHOICE" = "CANCEL" ]; then
  exit 0
fi

TASK=""
case "$CHOICE" in
  "启动开发服务器")
    TASK="dev"
    ;;
  "安装依赖")
    TASK="install"
    ;;
  "类型检查")
    TASK="typecheck"
    ;;
  "运行 ESLint")
    TASK="lint"
    ;;
  "自动修复 ESLint")
    TASK="lint:fix"
    ;;
  "运行 Prettier 格式化")
    TASK="format"
    ;;
  "检查 Prettier 格式")
    TASK="format:check"
    ;;
  "运行测试")
    TASK="test"
    ;;
  "构建项目")
    TASK="build"
    ;;
  "一键回归")
    TASK="verify"
    ;;
  *)
    osascript -e 'display dialog "未知选项，脚本已退出。" buttons {"确定"} default button 1 with icon caution'
    exit 1
    ;;
esac

echo "执行命令: pnpm $TASK"
pnpm "$TASK"
