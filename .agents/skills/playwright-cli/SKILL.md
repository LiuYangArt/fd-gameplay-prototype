---
name: playwright-cli
description: 使用 `playwright-cli` 在终端自动化浏览器冒烟与交互回归。触发场景：需要验证页面加载、按钮交互、输入映射、HUD/镜头状态切换、console/network 异常采集，尤其是 `packages/web-client` 相关改动后。
---

# Playwright CLI

## 概览

使用 `playwright-cli` 在命令行驱动真实浏览器，替代纯手动点击回归。  
本技能优先覆盖“浏览器内可测试功能”，纯逻辑层规则仍由 `vitest` 负责。

## 先决检查

在仓库根目录执行：

```bash
node --version
npm --version
npx --version
pnpm --version
```

任一命令失败时，先安装 Node.js 与 pnpm，再继续后续步骤。

## CLI 缺失时先安装

先检测 CLI 是否可用：

```bash
pnpm exec playwright-cli --version
```

若报 “command not found” 或等价错误，执行安装：

```bash
pnpm add -Dw @playwright/cli
pnpm exec playwright-cli --version
```

若首次 `open` 时提示浏览器缺失，执行：

```bash
pnpm exec playwright-cli install-browser --browser chrome
```

## 项目默认冒烟流程

最省事方式（推荐）：

```bash
pnpm smoke:web
```

脚本会自动执行：检查/安装 CLI、启动 `web-client`、跑冒烟链路、归档 `playwright` 产物。

1. 启动前端服务（固定地址，便于脚本复现）

```bash
pnpm --filter @fd/web-client dev -- --host 127.0.0.1 --port 4173
```

2. 新开终端执行 Playwright CLI（推荐命名会话）

```bash
pnpm exec playwright-cli -s=fd-smoke open http://127.0.0.1:4173
pnpm exec playwright-cli -s=fd-smoke snapshot
pnpm exec playwright-cli -s=fd-smoke eval "document.title"
pnpm exec playwright-cli -s=fd-smoke screenshot
pnpm exec playwright-cli -s=fd-smoke console warning
pnpm exec playwright-cli -s=fd-smoke network
pnpm exec playwright-cli -s=fd-smoke close
```

3. 需要操作元素时，必须先 `snapshot` 再使用元素引用 `e*`。

## 本仓库测试约束

- 浏览器可测条目优先用 `playwright-cli`，只在无法自动化时回退手动步骤。
- 导航后、UI 大改后、弹窗开关后，必须重新 `snapshot`，避免引用过期。
- 禁止用 `run-code` 绕过交互流程，除非明确说明原因。
- 结果记录至少包含：执行命令、关键输出、失败时的 `console/network` 文件。

## 参考

常用场景与检查点见：

- `references/web-client-smoke-checks.md`
