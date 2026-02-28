# Battle 瞄准 PointerLock 与 Esc 双击回归复盘

## 1. 基本信息

- 日期：2026-02-28
- 负责人：Codex（与项目负责人协作）
- 影响范围：`packages/web-client` 战斗瞄准输入链路（键鼠）
- 严重级别：`S2`
- 状态：`已验证`

## 2. 现象与影响

- 用户/测试者看到的现象：
  - 瞄准时左右旋转出现“路径依赖”，体感像有奇怪限位（先右再左可转范围更大）。
  - 引入 Pointer Lock 后，`Esc` 退出瞄准需要按两次。
- 首次发现时间：2026-02-28
- 复现条件：
  - 键鼠进入 `Battle3C` 瞄准并持续横向旋转。
  - Pointer Lock 生效时按 `Esc`。
- 业务影响（阻塞测试、误导结论、数据污染等）：
  - 误导为“限位算法错误”，增加错误排障成本。
  - 战斗瞄准手感不稳定，阻塞 3C 验收。

## 3. 时间线

1. `16:30` 发现“左右可转范围路径依赖”。
2. `16:40` 定位为 Pointer Lock 未稳定建立，`movementX` 受屏幕边界影响。
3. `16:48` 完成 Pointer Lock 可靠触发与日志化修复。
4. `16:55` 发现并修复“Esc 首次仅解锁未退瞄准”的双击问题。
5. `16:56` 完成回归验证（test/typecheck/lint/smoke）。

## 4. 根因分析

- 直接根因：
  - 未锁指针时，鼠标增量受视口边界约束，导致输入侧出现“假限位”。
  - 锁指针后首次 `Esc` 被浏览器消费用于解锁，游戏侧未收到取消瞄准边沿。
- 深层根因（流程、设计、测试、工具）：
  - 之前将问题优先归因为“扇区限位算法”，对输入侧状态机证据采集不足。
  - Pointer Lock 状态缺乏可观测性（无 HUD 状态/无统一日志）导致误判。
- 为什么之前的防线没有拦住：
  - 自动化测试只覆盖数值旋转逻辑，未覆盖浏览器 Pointer Lock 状态转换。

## 5. 修复方案

- 临时止血：
  - 在 `Battle3C` 面板显示 `Pointer Lock: Locked/Unlocked`，并输出 `pointerlockchange/pointerlockerror`。
- 永久修复：
  - Pointer Lock 目标统一为 `canvas`（fallback `BattleViewport`）。
  - 请求链路覆盖 `Q`、瞄准按钮、瞄准中点击战场。
  - 输入层在“瞄准态 lock -> unlock”时自动注入一次 `CancelAimEdge`，保证一次 `Esc` 即退出瞄准。
- 关联代码变更：
  - `packages/web-client/src/App.tsx`
  - `packages/web-client/src/input/UInputController.ts`
  - `packages/web-client/src/input/UInputController.test.ts`
  - `docs/testing/regression-checklist.md`
- 风险与回滚方案：
  - 风险：不同浏览器 Pointer Lock 行为差异导致日志噪音。
  - 回滚：仅回退 Pointer Lock 新增逻辑（`App.tsx` + `UInputController.ts` 相关段），保留原瞄准旋转与相机逻辑。

## 6. 防再发动作（必须可执行）

1. 新增或补强的回归测试：

- 文件路径：`packages/web-client/src/input/UInputController.test.ts`
- 覆盖场景：
  - 按 `Q` 进入瞄准会请求 Pointer Lock。
  - 瞄准态下 lock->unlock 会自动产生 `CancelAimEdge`（`Esc` 单击退出）。

2. 新增或补强的规则/流程：

- lint/test/checklist/hook 的变更：
  - `docs/testing/regression-checklist.md` 新增两条已完成检查项（Pointer Lock 防假限位、Esc 单击退出）。
- 执行责任人：当前功能迭代负责人
- 截止时间：已完成（2026-02-28）

## 7. 验证记录

- 本地验证命令：
  - `pnpm --filter @fd/web-client test`
  - `pnpm --filter @fd/web-client typecheck`
  - `pnpm lint`
  - `pnpm smoke:web`
- 验证结果：全部通过（`smoke:web` 仅历史 `favicon.ico` 404，非阻断）
- 复测人：项目负责人 + Codex

## 8. 经验沉淀

- 本次事件给 vibe-coding 的规则更新：
  - 发生“输入体感异常”时，先验证输入采样状态机（Pointer Lock、焦点、边界）再调整玩法算法。
  - 任何依赖浏览器状态机的功能必须先加可观测信号（HUD 或日志）。
- 是否需要更新 `AGENTS.md`：`否`
- 是否需要更新 `docs/testing/regression-checklist.md`：`是`（已更新）
