# Battle 瞄准弹道与俯仰/限位回归复盘

## 1. 基本信息

- 日期：2026-02-28
- 负责人：Codex / LiuYang
- 影响范围：`packages/web-client` 战斗 3C（瞄准开火弹道、俯仰输入、左右限位）
- 严重级别：`S2`
- 状态：`已验证`

## 2. 现象与影响

- 用户/测试者看到的现象：
  - 子弹视觉会斜着吸附敌人，不符合“枪口射向准星”的 TPS 观感。
  - 瞄准时仅支持左右，不能上下抬枪。
  - 左右限位参考基准不稳定，切角色后边缘敌人可能难以瞄到。
- 首次发现时间：2026-02-28（镜头重构联调阶段）
- 复现条件：
  - 进入 `Battle3C` 后瞄准开火，对比子弹出膛方向与准星中心。
  - 进入瞄准后输入 `LookPitchDelta`，观察相机是否可上下抬枪。
  - 切换不同角色并持续左右转动，观察限位边界是否覆盖敌方扇区。
- 业务影响（阻塞测试、误导结论、数据污染等）：
  - 影响“回合制 TPS 化瞄准”核心手感验收。
  - 开火反馈与准星中心不一致，降低后续命中判定方案可信度。

## 3. 时间线

1. `12:47` 发现问题并明确改造方向（枪口弹道、俯仰、限位）
2. `12:56` 回归测试改造完成并得到失败用例
3. `13:02` 完成运行时与场景桥修复
4. `13:04` 完成回归验证（test/typecheck/lint/verify/smoke）

## 4. 根因分析

- 直接根因：
  - 开火轨迹仍沿用“枪口 -> 目标单位中心”的简化模型，缺少“相机中心射线 -> 命中点”链路。
  - 瞄准输入仅处理 yaw，未维护独立的 `AimCameraPitchDeg`。
  - 限位基准依赖角色前向/临时参考，不随敌方整体分布动态重建。
- 深层根因（流程、设计、测试、工具）：
  - 第一轮镜头重构未把“miss 也可开火”与“俯仰不带动角色旋转”写成硬性自动化断言。
  - Scene 表现层与 Runtime 事件层之间的 shot 语义（可空目标）不一致。
- 为什么之前的防线没有拦住：
  - 旧回归仅验证“有开火事件”，未验证“弹道来源/命中点来源/miss 路径”。

## 5. 修复方案

- 临时止血：
  - 无
- 永久修复：
  - Runtime：新增并维护 `AimCameraPitchDeg`，瞄准时支持上下抬枪，俯仰输入不写角色 yaw。
  - Runtime：瞄准开火改为“有悬停目标则命中目标，否则允许 miss（`TargetUnitId=null`）”。
  - Runtime：左右限位改为“敌人中心中轴扇区”，半角按敌方分布 + padding 计算并做上下限钳制。
  - SceneBridge：子弹视觉改为“中心准星射线求命中点 + 枪口发射到命中点”；射线未命中时从枪口沿射线方向直线飞出且不生成命中特效。
- 关联代码变更：
  - `packages/web-client/src/game/UWebGameRuntime.ts`
  - `packages/web-client/src/game/UWebGameRuntime.test.ts`
  - `packages/web-client/src/game/USceneBridge.ts`
  - `packages/web-client/src/ui/FHudViewModel.ts`
  - `docs/testing/regression-checklist.md`
- 风险与回滚方案：
  - 风险：射线命中体使用近似球，极端姿态下可能出现“视觉擦边命中/未命中”差异。
  - 回滚：可临时回退到“枪口 -> 目标中心”视觉链路，同时保留 runtime 的 miss/俯仰逻辑。

## 6. 防再发动作（必须可执行）

1. 新增或补强的回归测试：

- 文件路径：`packages/web-client/src/game/UWebGameRuntime.test.ts`
- 覆盖场景：
  - 瞄准俯仰可用且不改角色 yaw。
  - 瞄准左右限位采用敌人中心中轴扇区。
  - 无悬停目标时允许 miss 开火（`TargetUnitId=null`）。

2. 新增或补强的规则/流程：

- lint/test/checklist/hook 的变更：
  - `docs/testing/regression-checklist.md` C 节改为“中轴扇区 + 上下瞄准 + 枪口弹道可 miss”口径。
- 执行责任人：LiuYang
- 截止时间：后续所有瞄准/开火链路改动合并前持续执行

## 7. 验证记录

- 本地验证命令：
  - `pnpm --filter @fd/web-client test`
  - `pnpm --filter @fd/web-client typecheck`
  - `pnpm lint`
  - `pnpm verify`
  - `pnpm smoke:web`
- 验证结果：通过（`smoke:web` 仅 `favicon.ico` 404，非本次改动引入）
- 复测人：Codex / LiuYang

## 8. 经验沉淀

- 本次事件给 vibe-coding 的规则更新：
  - 瞄准链路评审必须同时覆盖“输入（yaw/pitch）- 目标判定（hover/miss）- 视觉弹道（枪口/命中点）”三段一致性。
  - Shot 事件模型要优先支持“可空目标”，Scene 再根据射线命中决定表现。
- 是否需要更新 `AGENTS.md`：否
- 是否需要更新 `docs/testing/regression-checklist.md`：是（已更新）
