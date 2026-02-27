# 回归检查清单（Gameplay Prototype）

更新时间：2026-02-26

> 用法
>
> - 修复 bug 前：先确认要覆盖的场景，并补一个会失败的测试。
> - 修复 bug 后：勾选对应条目，附上测试文件与命令。
> - 如果本次故障影响较大，同时补 `docs/postmortems/` 文档。

## A. 核心回合流程（gameplay-core）

- [ ] `StartBattle` 后按速度选出首个行动单位（含同速稳定策略）。
- [ ] 非当前行动单位提交 `UseSkill` 会被拒绝。
- [ ] 非存活单位不能行动，不能成为有效目标。
- [ ] 伤害结算后 HP 不会小于 0。
- [ ] 击败最后一名敌方单位后战斗结束并产出胜者。
- [ ] `TurnEnded` 后能正确推进到下一个存活单位。
- [ ] 重开战斗后状态被完全重置（不残留上一局状态）。

## B. 事件驱动一致性

- [ ] 命令处理后事件顺序符合预期（关键路径断言事件序列）。
- [ ] `EventId` 单调递增且无重复。
- [ ] `StateStore` 应用事件后状态与事件语义一致。
- [ ] 修复 bug 时新增“事件序列回放”回归用例。

## C. 输入与交互（web-client）

- [ ] 键鼠映射：确认/切目标/重开战斗均可触发。
- [ ] 手柄映射：A / D-Pad Right / Start 均可触发。
- [ ] 输入边沿触发无连发问题（按住不会重复触发一次性动作）。
- [ ] 战斗结束后 UI 与 3D 表现同步到完成态。

## D. 分层边界与命名约束

- [ ] `gameplay-core` 与 `ue-bridge` 未引用浏览器 API（`window/document/navigator`）。
- [ ] `gameplay-core` 与 `ue-bridge` 未依赖 `web-client`。
- [ ] `gameplay-core` 与 `ue-bridge` 的类/接口/类型/枚举符合 UE 前缀命名约束。

## E. 提交前命令

- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `pnpm verify`

## G. 探索与遇敌闭环（overworld）

- [x] `InitializeWorld` 后阶段进入 `Exploring`。
- [x] `Step` 在走路/跑步两种状态下位移差异符合预期。
- [x] 敌人游荡更新位置且不会越界。
- [x] 遇敌后仅触发一次 `EncounterTriggered`，直到 `ResolveEncounter`。
- [x] `ResolveEncounter` 后移除敌人并返回探索态。
- [x] `ResetPlayerToSafePoint` 后玩家回到安全点。
- [ ] 键鼠与手柄输入在探索态行为一致（手动冒烟）。
- [ ] `F3` 参数调整可持久化并支持 JSON 导入导出（手动冒烟）。
- [ ] 完整闭环“探索 -> 遇敌 -> 战斗 -> 返回探索”通过（手动冒烟）。

## H. 遭遇到战斗 3C 衔接（2026-02-26）

- [x] 运行时阶段链路为 `Overworld -> EncounterTransition -> Battle3C -> SettlementPreview -> Overworld`。
- [x] 输入语义映射已接入：`Q/LT` 切瞄准，`LMB/RT/A` 开火，`C/LB` 切角色，`Tab/RB` 目标模式，`Alt+Q` 结算。
- [x] Debug 配置升级到 `FD_DEBUG_CONFIG_V3`，并兼容读取 V2。
- [ ] 遭遇过渡演出（提示、镜头拉出/推进、单位高位落地）通过手动冒烟。
- [ ] 敌方三段机位脚本（单体黄/单体红/AOE）构图通过手动冒烟。
- [ ] `Alt+Q` 结算预览 + Enter/A 返回探索闭环通过手动冒烟。
- [ ] Battle Tab 参数修改后刷新页面仍保留（手动冒烟）。

## F. 本次修复记录

- 问题描述：实现“遭遇 -> 战斗 3C -> 结算回图”的事件驱动链路（功能开发，非缺陷修复）。
- 对应测试文件：`packages/gameplay-core/tests/UOverworldSimulation.test.ts`（核心回归沿用）。
- 新增/修改条目：新增 H 节“遭遇到战斗 3C 衔接（2026-02-26）”共 7 项，并更新 E 节命令状态。
- 验证命令与结果：
  - `pnpm lint`：通过
  - `pnpm test`：通过（`UBattleSimulation` + `UOverworldSimulation` 共 8 项）
  - `pnpm verify`：通过（typecheck + lint + test + build）
- 是否新增 postmortem：`否`
