# Web Client 冒烟检查点

## 最小可复现链路

1. 页面可打开，标题为 `FD Gameplay Prototype`。
2. 页面首屏无阻塞脚本错误（允许非阻塞资源 404，但需记录）。
3. 可完成一次关键交互并保留截图/日志。

## 一键执行

```bash
pnpm smoke:web
```

产物输出到 `output/playwright/<timestamp>/`。

## 推荐命令序列

```bash
pnpm exec playwright-cli -s=fd-smoke open http://127.0.0.1:4173
pnpm exec playwright-cli -s=fd-smoke snapshot
pnpm exec playwright-cli -s=fd-smoke eval "document.title"
pnpm exec playwright-cli -s=fd-smoke screenshot
pnpm exec playwright-cli -s=fd-smoke console warning
pnpm exec playwright-cli -s=fd-smoke network
```

## 交互验证模板（适配回归清单）

1. 执行 `snapshot`，定位目标按钮或交互元素引用。
2. 用 `click` 或 `press` 触发输入语义（如 `Q`、`Esc`、`Tab`）。
3. 触发后立即再 `snapshot`，确认状态是否变化。
4. 用 `screenshot` 保留可视证据。
5. 用 `console warning` 与 `network` 采集异常证据。

## 失败定位优先级

1. `console` 是否有新增 error。
2. `network` 是否有关键资源失败。
3. 元素引用是否过期（未重新 snapshot）。
4. 交互前提状态是否成立（例如未进入 Battle3C 就执行战斗输入）。
