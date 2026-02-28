# Battle 瞄准限位与开火朝向 Snap 回归复盘

## 1. 基本信息

- 日期：2026-02-28
- 负责人：Codex / LiuYang
- 影响范围：`packages/web-client` 战斗 3C（瞄准旋转限位、开火朝向）
- 严重级别：`S2`
- 状态：`已验证`

## 2. 现象与影响

- 用户/测试者看到的现象：
  - 瞄准左右限位与敌人在屏幕中的相对位置不一致，旋转边界体感异常。
  - 瞄准开火瞬间角色会被强制对齐到目标方向，出现明显 snap。
- 首次发现时间：2026-02-28（镜头重构后二次联调）
- 复现条件：
  - 进入 `Battle3C`，瞄准状态持续左右转动观察边界。
  - 瞄准状态开火（含悬停目标和无悬停目标两种情况），观察角色 `Yaw` 是否突变。
- 业务影响（阻塞测试、误导结论、数据污染等）：
  - 影响瞄准手感验收。
  - 降低镜头重构成果的稳定性，导致观感回退。

## 3. 时间线

1. `12:24` 发现问题（用户反馈）
2. `12:28` 完成定位（限位模型与开火逻辑）
3. `12:30` 完成修复（前方 180 半圆限位 + 去除开火强制朝向）
4. `12:35` 完成回归验证（test/typecheck/lint/verify/smoke）

## 4. 根因分析

- 直接根因：
  - 限位使用“敌人扇区软限制”，与当前屏幕构图并非一一对应，造成体感不一致。
  - `FireBattleAction` 中仍调用 `FaceControlledUnitTowardsTarget`，导致开火时强制转向。
- 深层根因（流程、设计、测试、工具）：
  - 首轮重构后未将“开火不改朝向”作为明确自动化验收点。
  - 限位策略选择偏向目标分布约束，缺少固定基准（角色前向半圆）作为兜底。
- 为什么之前的防线没有拦住：
  - 既有用例验证了“可旋转”和“可开火”，但未约束“开火前后朝向连续性”。

## 5. 修复方案

- 临时止血：
  - 无
- 永久修复：
  - 瞄准限位改为“相对进入瞄准朝向的前方 180 度半圆”（`-90~+90`）。
  - 删除开火时的强制朝向对齐逻辑，确保发射不改变当前旋转。
  - 新增回归：无悬停与悬停两种开火路径都验证“朝向不 snap”。
- 关联代码变更：
  - `packages/web-client/src/game/UWebGameRuntime.ts`
  - `packages/web-client/src/game/UWebGameRuntime.test.ts`
  - `docs/testing/regression-checklist.md`
- 风险与回滚方案：
  - 风险：固定半圆可能在极端站位下无法覆盖全部敌人。
  - 回滚：恢复无角度限制方案，后续再引入可配置限位模型。

## 6. 防再发动作（必须可执行）

1. 新增或补强的回归测试：

- 文件路径：`packages/web-client/src/game/UWebGameRuntime.test.ts`
- 覆盖场景：
  - 瞄准旋转限制在角色前方 180 度半圆。
  - 开火时（悬停/非悬停）角色朝向保持不变。

2. 新增或补强的规则/流程：

- lint/test/checklist/hook 的变更：
  - `docs/testing/regression-checklist.md` C 节将限位标准更新为“前方 180 半圆”，并新增“开火不 snap 朝向”条目。
- 执行责任人：LiuYang
- 截止时间：后续所有瞄准输入与开火链路改动合并前持续执行

## 7. 验证记录

- 本地验证命令：
  - `pnpm --filter @fd/web-client test -- src/game/UWebGameRuntime.test.ts`
  - `pnpm --filter @fd/web-client test`
  - `pnpm --filter @fd/web-client typecheck`
  - `pnpm lint`
  - `pnpm verify`
  - `pnpm smoke:web`
- 验证结果：全部通过
- 复测人：Codex / LiuYang

## 8. 经验沉淀

- 本次事件给 vibe-coding 的规则更新：
  - 调整瞄准限位模型时，必须同步验证“屏幕体感一致性”与“开火前后朝向连续性”。
  - 开火链路默认不得包含朝向写入，除非设计明确要求并单独评审。
- 是否需要更新 `AGENTS.md`：否
- 是否需要更新 `docs/testing/regression-checklist.md`：是（已更新）
