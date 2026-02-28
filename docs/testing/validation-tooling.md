# 自动测试与验证工具方案

更新时间：2026-02-28

## 当前已接入

1. TypeScript 严格类型检查

- 命令：`pnpm typecheck`
- 价值：提前发现跨模块接口不一致和空值问题。

2. ESLint 严格检查（含分层约束）

- 命令：`pnpm lint`
- 价值：拦截未使用导入、导入顺序问题、复杂度超限、核心层误用浏览器 API。
- 额外约束：`gameplay-core` 与 `ue-bridge` 强制 UE 风格命名（`A/U/F/E/I` 前缀）。

3. Prettier 统一格式

- 命令：`pnpm format` / `pnpm format:check`
- 价值：避免无意义风格差异，降低 code review 噪音。

4. 核心玩法单元测试（Vitest）

- 命令：`pnpm test`
- 价值：快速验证事件驱动链路、回合推进、伤害结算与胜负判定。

5. 构建可用性检查（Vite Build）

- 命令：`pnpm build`
- 价值：保证可测试版本可正常打包。

6. 一键回归

- 命令：`pnpm verify`
- 串联：类型检查 + lint + 单测 + 构建。

7. 浏览器自动化冒烟（Playwright CLI）

- 命令：`pnpm exec playwright-cli --version`
- 首次缺失安装：`pnpm add -Dw @playwright/cli`
- 典型流程：`open -> snapshot -> click/press -> snapshot -> screenshot -> console/network`
- 一键命令：`pnpm smoke:web`（自动启动 `web-client`、执行上述流程并归档产物到 `output/playwright/`）
- 项目约定：`web-client` 可浏览器验证的功能，优先使用 `playwright-cli`；仅当场景无法自动化时再使用手动冒烟。

## 提交流程保护（Husky）

1. pre-commit

- 行为：运行 `lint-staged`。
- 策略：仅检查暂存文件，TS/TSX 会执行 `eslint --fix` + `prettier --write`。

2. pre-push

- 行为：运行 `pnpm verify`。
- 目的：在推送前确保全量回归通过。

## 回归与复盘约定

1. bug 修复最小流程

- 先补一个会失败的回归测试，再修复代码。
- 修复后更新回归清单：`docs/testing/regression-checklist.md`。

2. postmortem 触发条件（满足任一条即触发）

- 阻塞玩法验证或外部测试超过 2 小时。
- 同类问题在 14 天内重复出现。
- 导致错误玩法结论或关键数据失真。

3. postmortem 文档规范

- 文件路径：`docs/postmortems/YYYY-MM-DD-<主题>.md`。
- 模板：`docs/postmortems/_template.md`。

## 常见失败排查

1. `pnpm lint` 失败

- 先运行 `pnpm lint:fix` 自动修复。
- 若仍失败，按报错定位到具体规则并手动处理。

2. `pre-commit` 被拦截

- 原因通常是暂存文件 lint/format 失败。
- 处理：执行 `pnpm lint:fix && pnpm format` 后重新 `git add` 再提交。

3. `pre-push` 被拦截

- 原因通常是 `pnpm verify` 中某一步失败。
- 处理：本地先单独跑 `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build` 定位。

## 下一阶段建议（可玩后再加）

1. Playwright 冒烟测试

- 目标：扩展 `playwright-cli` 覆盖率，补齐关键交互链路（瞄准、切角色、结算回图）自动化命令脚本。

2. 玩法回放快照测试

- 目标：记录命令序列并断言事件序列，保证重构不改变核心行为。

3. 数据校验脚本

- 目标：在导入技能/数值表时做 schema 校验，避免坏数据进入测试版本。
