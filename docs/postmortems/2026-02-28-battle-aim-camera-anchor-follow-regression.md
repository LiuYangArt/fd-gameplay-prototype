# Battle 瞄准镜头跟随与构图一致性回归复盘

## 1. 基本信息

- 日期：2026-02-28
- 负责人：Codex / LiuYang
- 影响范围：`packages/web-client` 战斗 3C（瞄准输入、相机朝向、目标回退）
- 严重级别：`S2`
- 状态：`已验证`

## 2. 现象与影响

- 用户/测试者看到的现象：
  - 不同角色进入瞄准时镜头构图有偏差。
  - 瞄准时主要是角色转身，镜头朝向不随之同步，观感不像常规 TPS。
  - 无悬停目标时开火目标回退不稳定，容易与当前朝向不一致。
- 首次发现时间：2026-02-28 联调阶段
- 复现条件：
  - 进入 `Battle3C`，切换角色后反复进入瞄准观察构图。
  - 瞄准状态持续左右移动输入，观察角色与相机的同步关系。
  - 瞄准状态取消悬停目标后开火，观察目标选择结果。
- 业务影响（阻塞测试、误导结论、数据污染等）：
  - 阻塞战斗镜头风格验收。
  - 影响回合制瞄准演示质量，容易误判输入与镜头方案不可行。

## 3. 时间线

1. `11:32` 发现问题（联调反馈）
2. `12:08` 完成定位（Runtime 只转角色、AimCameraYaw 未持续同步）
3. `12:10` 完成修复（中心准星 + LookYaw 驱动 + 虚拟 CameraSocket）
4. `12:20` 完成回归验证（test/typecheck/lint/verify/smoke）

## 4. 根因分析

- 直接根因：
  - 瞄准朝向由“准星 X 映射”驱动，`AimCameraYawDeg` 仅在进入瞄准时初始化，未逐帧同步。
  - `PlayerAim` 相机目标点依赖 `SelectedPos`，导致镜头锁目标而非跟随角色朝向。
  - 无悬停目标时开火回退策略依赖 `SelectedTargetIndex`，未按当前朝向兜底。
- 深层根因（流程、设计、测试、工具）：
  - 早期为了快速验证交互，采用了“准星驱动角色、镜头半固定”的临时策略，后续未统一收敛。
  - 自动化用例覆盖了“瞄准可用”，但未覆盖“相机与角色朝向持续同步”。
- 为什么之前的防线没有拦住：
  - 原有回归关注模式切换稳定性与输入可触发性，缺少 TPS 化构图一致性断言。

## 5. 修复方案

- 临时止血：
  - 无
- 永久修复：
  - 运行时改为中心准星 TPS：瞄准时固定准星中心，使用 `LookYawDelta` 驱动角色旋转。
  - `AimCameraYawDeg` 改为逐帧同步角色朝向。
  - 加入敌人扇区外“减速但可继续转”的软限制，并在无输入时缓回边界。
  - 开火目标新增“无悬停时按当前朝向最近敌人回退”策略。
  - 场景层 `PlayerAim` 改为“虚拟 CameraSocket 解算”（后拉距离、侧偏移、高度、视线前探）。
- 关联代码变更：
  - `packages/web-client/src/game/UWebGameRuntime.ts`
  - `packages/web-client/src/game/USceneBridge.ts`
  - `packages/web-client/src/debug/UDebugConfigStore.ts`
  - `packages/web-client/src/App.tsx`
  - `packages/web-client/src/game/UWebGameRuntime.test.ts`
  - `packages/web-client/src/debug/UDebugConfigStore.test.ts`
  - `docs/testing/regression-checklist.md`
- 风险与回滚方案：
  - 风险：软限制参数不当会导致“外圈手感过黏”或“仍然过冲”。
  - 回滚：将扇区外阻尼退回硬限制逻辑，或恢复旧准星驱动逻辑（按提交粒度回退）。

## 6. 防再发动作（必须可执行）

1. 新增或补强的回归测试：

- 文件路径：`packages/web-client/src/game/UWebGameRuntime.test.ts`
- 覆盖场景：
  - 瞄准准星固定中心。
  - LookYaw 驱动下角色/相机朝向同步。
  - 敌人扇区外旋转减速。
  - 无悬停目标时按朝向回退目标。

2. 新增或补强的规则/流程：

- lint/test/checklist/hook 的变更：
  - `docs/testing/regression-checklist.md` C 节更新为中心准星 TPS 标准并新增对应自动化条目。
- 执行责任人：LiuYang
- 截止时间：后续所有瞄准/镜头改动合并前持续执行

## 7. 验证记录

- 本地验证命令：
  - `pnpm --filter @fd/web-client test`
  - `pnpm --filter @fd/web-client typecheck`
  - `pnpm lint`
  - `pnpm verify`
  - `pnpm smoke:web`
- 验证结果：全部通过
- 复测人：Codex / LiuYang

## 8. 经验沉淀

- 本次事件给 vibe-coding 的规则更新：
  - 涉及瞄准镜头重构时，必须同时覆盖“输入驱动 + 相机朝向同步 + 开火目标回退”三个维度。
  - 涉及镜头挂载语义时，优先抽象为可调虚拟 socket，并通过 debug 参数统一管理。
- 是否需要更新 `AGENTS.md`：否
- 是否需要更新 `docs/testing/regression-checklist.md`：是（已更新）
