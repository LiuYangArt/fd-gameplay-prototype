# 回归检查清单（Gameplay Prototype）

更新时间：2026-02-27

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
- [x] 瞄准模式下鼠标驱动准星使用绝对坐标，且隐藏系统鼠标光标（`PlayerAim`）。
- [x] 战斗 HUD 点击不会误触发开火输入（`mousedown` 过滤 UI 元素）。
- [x] 瞄准模式下支持 `Esc / 手柄 B / HUD 返回按钮` 退出瞄准并回到跟随镜头。
- [x] 战斗结束回到 `Overworld` 后，左下角战斗 HUD（逃跑/跳过回合）会完全清理。

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

## I. TeamPackage 到 BattleTeam 重构（2026-02-27）

- [x] `LeaderUnitId` 不在 `ActiveUnitIds` 时触发 `ETeamValidationFailed`（`UOverworldSimulation.test.ts`）。
- [x] `OverworldDisplayUnitId` 不在 `ActiveUnitIds` 时触发 `ETeamValidationFailed`（`UOverworldSimulation.test.ts`）。
- [x] `ActiveUnitIds` 超过 3 时严格模式阻断（`UOverworldSimulation.test.ts`）。
- [x] 遭遇事件缺失 `EnemyTeamId` 时阻断进入战斗（`UOverworldSimulation.test.ts`）。
- [x] 切换可控角色只在“上阵且存活”成员内循环（`UWebGameRuntime.test.ts`）。
- [x] `FD_DEBUG_CONFIG_V4` 升级并兼容 V2/V3 读取（`UDebugConfigStore.ts`）。
- [ ] 模型路径错误时回退占位体并输出日志（待补自动化或手动冒烟）。
- [ ] `SOCKET_Muzzle*` 缺失时使用默认发射点且不崩溃（待补自动化或手动冒烟）。
- [ ] Overworld/Battle 角色模型替换与挂点 Gizmo 联调通过（手动冒烟）。

## F. 本次修复记录

- 问题描述：实现“遭遇 -> 战斗 3C -> 结算回图”的事件驱动链路（功能开发，非缺陷修复）。
- 对应测试文件：`packages/gameplay-core/tests/UOverworldSimulation.test.ts`（核心回归沿用）。
- 新增/修改条目：新增 H 节“遭遇到战斗 3C 衔接（2026-02-26）”共 7 项，并更新 E 节命令状态。
- 验证命令与结果：
  - `pnpm lint`：通过
  - `pnpm test`：通过（`UBattleSimulation` + `UOverworldSimulation` 共 8 项）
  - `pnpm verify`：通过（typecheck + lint + test + build）
- 是否新增 postmortem：`否`

- 问题描述：修复战斗瞄准模式下“系统鼠标 cursor 与 Crosshair 同时显示且位置不一致”的交互问题。
- 对应测试文件：`packages/web-client/src/game/UWebGameRuntime.test.ts`（新增回归）。
- 新增/修改条目：C 节新增“瞄准模式鼠标绝对坐标 + 隐藏 cursor”条目并置为已完成。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test`：通过（新增回归 1 项）
  - `pnpm --filter @fd/web-client typecheck`：通过
  - `pnpm lint`：通过
  - `pnpm verify`：通过（typecheck + lint + test + build）
- 是否新增 postmortem：`否`

- 问题描述：修复战斗 HUD 交互与瞄准返回链路（按钮点击不应误开火、瞄准中仅显示返回并支持 `Esc/B` 退出）。
- 对应测试文件：`packages/web-client/src/game/UWebGameRuntime.test.ts`（新增“CancelAimEdge 退出瞄准”回归）。
- 新增/修改条目：C 节新增 2 项并置为已完成（HUD 点击过滤、Esc/B/返回按钮退出瞄准）。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test`：通过（2 项）
  - `pnpm lint`：通过
  - `pnpm verify`：通过（typecheck + lint + test + build）
- 是否新增 postmortem：`否`

- 问题描述：修复战斗结束后左下角战斗 HUD 未清理（仍显示禁用按钮）的问题。
- 对应测试文件：`packages/web-client/src/ui/UBattleHudVisibility.test.ts`（新增回归）。
- 新增/修改条目：C 节新增“Overworld 清理左下角战斗 HUD”条目并置为已完成。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test`：通过
  - `pnpm lint`：通过
  - `pnpm verify`：通过（typecheck + lint + test + build）
- 是否新增 postmortem：`否`

- 问题描述：按 TeamPackage -> BattleTeam 方案完成 Team/Unit 真源下沉、遭遇上下文升级、非硬编码切人、角色 GLB 模型接入与枪口挂点扫描。
- 对应测试文件：
  - `packages/gameplay-core/tests/UOverworldSimulation.test.ts`
  - `packages/gameplay-core/tests/UTeamPackageValidator.test.ts`
  - `packages/web-client/src/game/UWebGameRuntime.test.ts`
- 新增/修改条目：新增 I 节“TeamPackage 到 BattleTeam 重构（2026-02-27）”共 9 项，其中 6 项自动化已完成。
- 验证命令与结果：
  - `pnpm typecheck`：通过
  - `pnpm lint`：通过
  - `pnpm test`：通过（`gameplay-core` 15 项）
  - `pnpm --filter @fd/web-client test`：通过（5 项）
  - `pnpm verify`：通过（typecheck + lint + test + build）
- 是否新增 postmortem：`否`
