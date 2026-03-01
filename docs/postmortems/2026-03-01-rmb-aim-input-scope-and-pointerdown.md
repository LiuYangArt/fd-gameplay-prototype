# Battle RMB 瞄准事件作用域与事件类型回归复盘

## 1. 基本信息

- 日期：2026-03-01
- 负责人：Codex（与项目负责人协作）
- 影响范围：`packages/web-client` 战斗键鼠输入链路（RMB 进入瞄准）
- 严重级别：`S2`
- 状态：`已验证`

## 2. 现象与影响

- 用户/测试者看到的现象：
  - 在 3D viewport 内右键，无法进入瞄准。
  - 在 viewport 外右键，反而可能进入瞄准。
  - 某些情况下只有在按钮上右键才生效，体验不一致。
- 首次发现时间：2026-03-01
- 复现条件：
  - 战斗场景下，使用鼠标右键触发 `Battle.ToggleAim`。
  - 页面存在 UI 按钮层与 3D canvas 叠层。
- 业务影响（阻塞测试、误导结论、数据污染等）：
  - 破坏“RMB/LT 同构”输入约定，影响战斗主链验收。
  - 让“提示可见但行为不一致”，降低输入系统可信度。

## 3. 时间线

1. `11:58` 复现并确认“viewport 内无效、外部误触发”。
2. `12:08` 完成第一性排查，拆分为“事件来源问题 + 作用域问题”两条链路。
3. `12:20` 完成修复：优先 `pointerdown` 监听，并引入 viewport 几何过滤。
4. `12:34` 完成自动化回归（单测 + `smoke:web`）。

## 4. 根因分析

- 直接根因：
  - 仅依赖 `mousedown` 路径，在 canvas 叠层场景下兼容事件可能被抑制，导致 viewport 内 RMB 丢失。
  - 鼠标战斗输入缺少 viewport 边界过滤，导致 viewport 外右键也可触发瞄准。
- 深层根因（流程、设计、测试、工具）：
  - 对浏览器输入事件的假设过于理想化，未把 `pointerdown` 与 `mousedown` 差异纳入设计。
  - 输入层缺少“空间作用域”显式约束，动作语义正确但触发域未定义完整。
- 为什么之前的防线没有拦住：
  - 早期测试更关注键位映射本身，未覆盖“不同事件类型 + viewport 边界”的组合用例。

## 5. 修复方案

- 临时止血：
  - 在捕获阶段监听鼠标按下，避免下层冒泡/默认行为干扰。
- 永久修复：
  - 浏览器支持时优先监听 `pointerdown`，否则回退 `mousedown`。
  - 鼠标战斗动作（RMB/LMB）仅在 3D viewport 内响应。
  - `contextmenu` 仅在战斗输入上下文且 viewport 内拦截。
- 关联代码变更：
  - `packages/web-client/src/input/UInputController.ts`
  - `packages/web-client/src/input/UInputController.test.ts`
  - `docs/testing/regression-checklist.md`
  - `docs/input/button-authoring-rules.v1.md`
- 风险与回滚方案：
  - 风险：不同浏览器对 `PointerEvent` 支持差异可能造成行为分歧。
  - 回滚：保留 viewport 过滤，仅回退监听优先级策略（`pointerdown -> mousedown`）。

## 6. 防再发动作（必须可执行）

1. 新增或补强的回归测试：

- 文件路径：`packages/web-client/src/input/UInputController.test.ts`
- 覆盖场景：
  - 支持 `PointerEvent` 时应监听 `pointerdown`。
  - RMB 仅在 viewport 内触发，viewport 外忽略。

2. 新增或补强的规则/流程：

- lint/test/checklist/hook 的变更：
  - `docs/testing/regression-checklist.md` 新增“鼠标战斗动作仅在 3D viewport 内响应”检查项。
  - 新增 `docs/input/button-authoring-rules.v1.md`，明确按钮接入与输入作用域规则。
- 执行责任人：当前输入系统迭代负责人
- 截止时间：已完成（2026-03-01）

## 7. 验证记录

- 本地验证命令：
  - `pnpm --filter @fd/web-client test -- src/input/UInputController.test.ts`
  - `pnpm --filter @fd/web-client test`
  - `pnpm smoke:web`
- 验证结果：通过
- 复测人：项目负责人 + Codex

## 8. 经验沉淀

- 本次事件给 vibe-coding 的规则更新：
  - 输入问题必须分离“事件是否产生”与“事件是否在正确作用域生效”两层验证。
  - 任何战斗鼠标动作都必须绑定到 3D viewport 空间约束，禁止全窗口裸触发。
  - 键位提示上线前必须做“提示与行为一致性”回归。
- 是否需要更新 `AGENTS.md`：`否`
- 是否需要更新 `docs/testing/regression-checklist.md`：`是`（已更新）
