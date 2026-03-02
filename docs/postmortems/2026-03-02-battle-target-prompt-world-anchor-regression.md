# Battle 目标提示世界锚点回归复盘

## 1. 基本信息

- 日期：2026-03-02
- 负责人：Codex / LiuYang
- 影响范围：`packages/web-client` 战斗 3C 目标选择 UI（攻击/技能/道具）
- 严重级别：`S2`
- 状态：`已验证`

## 2. 现象与影响

- 用户/测试者看到的现象：
  - 进入近战攻击或技能选敌后，提示面板“选择目标敌人”跟随角色世界锚点。
  - 镜头切到敌方特写时，提示面板离开视口或被带出屏幕，玩家看不到目标确认提示。
  - 道具目标选择阶段缺少同级别的顶部统一提示，交互反馈风格不一致。
- 首次发现时间：2026-03-02 联调阶段
- 复现条件：
  - `Battle3C` 根命令下选择攻击或技能并进入 `TargetSelect`。
  - 镜头切到 `SkillTargetZoom` 特写后观察提示面板位置。
  - 进入道具目标选择时对比提示反馈一致性。
- 业务影响（阻塞测试、误导结论、数据污染等）：
  - 阻塞目标选择交互验收，影响“可见可操作”判断。
  - 容易误导为输入失效，实则是提示层挂点错误。

## 3. 时间线

1. `12:00` 发现问题（联调反馈）
2. `12:15` 完成定位（提示面板渲染在 `BattleActionHudAnchor` 内，依赖 `ControlledUnitAnchor`）
3. `13:08` 完成修复（目标选择提示迁移到屏幕空间上方中间，统一 Attack/Skill/Item）
4. `13:10` 完成回归验证（unit test + runtime test + typecheck + smoke）

## 4. 根因分析

- 直接根因：
  - 目标选择提示 UI 被放在角色世界锚点容器 `BattleActionHudAnchor` 内，提示坐标跟随受控角色而非屏幕固定锚点。
  - 攻击/技能目标选择镜头使用 `SkillTargetZoom`（敌方特写），与“提示挂角色”语义冲突。
- 深层根因（流程、设计、测试、工具）：
  - 之前优先复用角色侧 HUD 容器，没有把“流程提示（全局）”和“角色局部提示（局部）”分层。
  - 回归测试覆盖了目标选择阶段状态与输入槽位，但未覆盖“提示层挂载坐标系”。
- 为什么之前的防线没有拦住：
  - 没有独立的“目标提示解析/布局”测试点，UI 挂点语义混在 `App.tsx` 条件渲染中。

## 5. 修复方案

- 临时止血：
  - 无
- 永久修复：
  - 新增 `ResolveBattleTargetPromptModel`，将目标提示逻辑从 `App.tsx` 内联条件中抽离成可测试模块。
  - `TargetSelect` 阶段统一在屏幕空间上方中间渲染 `BattleTargetPromptOverlay`，不再依赖 `ControlledUnitAnchor`。
  - 覆盖攻击/技能/道具三种 `PendingActionKind`，统一展示“当前动作 / 当前目标 / 确认目标”提示。
- 关联代码变更：
  - `packages/web-client/src/ui/UBattleTargetPromptResolver.ts`
  - `packages/web-client/src/ui/UBattleTargetPromptResolver.test.ts`
  - `packages/web-client/src/App.tsx`
  - `packages/web-client/src/styles.css`
  - `docs/testing/regression-checklist.md`
- 风险与回滚方案：
  - 风险：顶部提示与右上角热键提示在小屏可能发生视觉拥挤。
  - 回滚：可单独回滚 `App.tsx + styles.css` 的 Overlay 变更，恢复原锚点实现（不建议长期保留）。

## 6. 防再发动作（必须可执行）

1. 新增或补强的回归测试：

- 文件路径：`packages/web-client/src/ui/UBattleTargetPromptResolver.test.ts`
- 覆盖场景：
  - 仅 `Battle3C + TargetSelect` 显示目标提示。
  - `Attack / Skill / Item` 三种目标选择都生成统一提示模型。

2. 新增或补强的规则/流程：

- lint/test/checklist/hook 的变更：
  - `docs/testing/regression-checklist.md` C 节新增“目标选择提示固定屏幕空间上方中间”条目。
- 执行责任人：LiuYang
- 截止时间：后续所有目标选择 UI 调整合并前持续执行

## 7. 验证记录

- 本地验证命令：
  - `pnpm --filter @fd/web-client test -- src/ui/UBattleTargetPromptResolver.test.ts`
  - `pnpm --filter @fd/web-client test -- src/game/UWebGameRuntime.test.ts -t "攻击指令应先进入统一目标选择，不立即开火|技能确认应进入目标选择，取消后返回技能菜单|物品确认应进入我方目标选择，并在确认后记录占位行为"`
  - `pnpm --filter @fd/web-client typecheck`
  - `pnpm smoke:web`
- 验证结果：全部通过
- 复测人：Codex / LiuYang

## 8. 经验沉淀

- 本次事件给 vibe-coding 的规则更新：
  - 流程类提示必须优先挂屏幕空间固定锚点，角色锚点只承载局部信息（如头顶血条、角色旁操作）。
  - 镜头会切换的阶段，UI 挂点必须先过“特写机位可见性”检查。
- 是否需要更新 `AGENTS.md`：否
- 是否需要更新 `docs/testing/regression-checklist.md`：是（已更新）
