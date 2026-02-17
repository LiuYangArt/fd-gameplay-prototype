#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "未检测到 pnpm，请先安装 pnpm（或启用 corepack）。"
  exit 1
fi

run_task() {
  local task="$1"
  case "$task" in
    install)
      pnpm install
      ;;
    dev)
      pnpm dev
      ;;
    typecheck)
      pnpm typecheck
      ;;
    lint)
      pnpm lint
      ;;
    lintfix)
      pnpm lint:fix
      ;;
    format)
      pnpm format
      ;;
    formatcheck)
      pnpm format:check
      ;;
    test)
      pnpm test
      ;;
    build)
      pnpm build
      ;;
    verify)
      pnpm verify
      ;;
    *)
      echo "未知任务: $task"
      return 1
      ;;
  esac
}

print_menu() {
  cat <<'MENU'
================ 开发菜单（macOS/Linux） ================
1) install   安装依赖
2) dev       一键启动开发服务器
3) typecheck 类型检查
4) lint      运行 ESLint
5) lintfix   自动修复 ESLint 问题
6) format    运行 Prettier 格式化
7) formatcheck 检查 Prettier 格式
8) test      运行核心单测
9) build     构建全部包
10) verify   一键回归（typecheck + lint + test + build）
q) 退出
=========================================================
MENU
}

MODE="${1:-menu}"

case "$MODE" in
  install|dev|typecheck|lint|lintfix|format|formatcheck|test|build|verify)
    run_task "$MODE"
    ;;
  menu)
    while true; do
      print_menu
      read -r -p "请选择操作: " choice
      case "$choice" in
        1) run_task install ;;
        2) run_task dev ;;
        3) run_task typecheck ;;
        4) run_task lint ;;
        5) run_task lintfix ;;
        6) run_task format ;;
        7) run_task formatcheck ;;
        8) run_task test ;;
        9) run_task build ;;
        10) run_task verify ;;
        q|Q) exit 0 ;;
        *) echo "无效选项，请重试。" ;;
      esac
    done
    ;;
  *)
    echo "用法: bash scripts/dev.sh [menu|install|dev|typecheck|lint|lintfix|format|formatcheck|test|build|verify]"
    exit 1
    ;;
esac
