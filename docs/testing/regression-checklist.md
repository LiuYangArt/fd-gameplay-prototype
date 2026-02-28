# 回归检查清单（Gameplay Prototype）

更新时间：2026-02-28

> 用法
>
> - 修复 bug 前：先确认要覆盖的场景，并补一个会失败的测试。
> - 修复 bug 后：勾选对应条目，附上测试文件与命令。
> - 浏览器可测试条目优先使用 `playwright-cli` 执行；若改为手动冒烟，需注明无法自动化原因。
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

- [ ] 浏览器可测试条目已使用 `playwright-cli` 执行并保留命令记录（无法自动化时需附原因）。
- [ ] 键鼠映射：确认/切目标/重开战斗均可触发。
- [ ] 手柄映射：A / D-Pad Right / Start 均可触发。
- [ ] 输入边沿触发无连发问题（按住不会重复触发一次性动作）。
- [ ] 战斗结束后 UI 与 3D 表现同步到完成态。
- [x] 瞄准模式下准星固定屏幕中心，忽略绝对鼠标位置输入，且隐藏系统鼠标光标（`PlayerAim`，`UWebGameRuntime.test.ts`）。
- [x] 战斗 HUD 点击不会误触发开火输入（`mousedown` 过滤 UI 元素）。
- [x] 瞄准模式下支持 `Esc / 手柄 B / HUD 返回按钮` 退出瞄准并回到跟随镜头。
- [x] 瞄准模式下 HUD 返回按钮挂在角色右侧偏下，避免角色靠左时按钮超出视口且遮挡角色（`BattleAimReturnLayout.test.ts`）。
- [x] 战斗结束回到 `Overworld` 后，左下角战斗 HUD（逃跑/跳过回合）会完全清理。
- [x] 瞄准模式下悬停敌人会同步 `HoveredTargetId`，并支持头顶血条显示（`UWebGameRuntime.test.ts`）。
- [x] 战斗开火会产出 Shot 可视化事件（`UWebGameRuntime.test.ts`）。
- [x] 瞄准模式开火不会切到敌方攻击机位（避免 camera 乱飞）（`UWebGameRuntime.test.ts`）。
- [x] 瞄准时角色朝向由 `LookYawDelta` 连续驱动，左右限位采用“敌人中心中轴扇区”（`UWebGameRuntime.test.ts`）。
- [x] 鼠标瞄准时进入 `Battle3C` 瞄准会请求 Pointer Lock，退出瞄准自动释放，避免屏幕边界造成左右旋转“假限位”（`UInputController.test.ts`）。
- [x] Pointer Lock 状态下按 `Esc` 一次应直接退出瞄准（锁释放后自动注入 `CancelAimEdge`），不需要按两次（`UInputController.test.ts`）。
- [x] 瞄准状态下不允许“跳过回合/切角色”，输入应被忽略（`UWebGameRuntime.test.ts`）。
- [x] 瞄准状态下不允许“逃跑”，仅待机状态允许（`UWebGameRuntime.test.ts`）。
- [x] 瞄准时 `AimCameraYawDeg` 应与当前操控角色 `YawDeg` 同步更新（`UWebGameRuntime.test.ts`）。
- [x] 瞄准时支持上下抬枪：`AimCameraPitchDeg` 随输入变化，角色 `YawDeg` 不因俯仰输入改变（`UWebGameRuntime.test.ts`）。
- [x] `OverworldInvertLookPitch` 与 `AimInvertLookPitch` 可独立控制上下反转，互不影响（`UWebGameRuntime.test.ts`）。
- [x] 瞄准开火在无悬停目标时允许 miss（`LastShot.TargetUnitId=null`），且不强制 snap 角色朝向（`UWebGameRuntime.test.ts`）。
- [x] 瞄准开火命中目标时不应强制把角色朝向 snap 到目标方向（`UWebGameRuntime.test.ts`）。
- [x] `PlayerAimDistanceCm` 存在且 `ApplyPatch` 的下限钳制生效（`UDebugConfigStore.test.ts`）。
- [x] 退出瞄准后恢复待机朝向，再次进入瞄准机位基准保持稳定（`UWebGameRuntime.test.ts`）。
- [ ] 右下角队伍头像 + HP/MP HUD 在 Battle3C 正常显示（手动冒烟）。
- [ ] 开火子弹从 `SOCKET_Muzzle*` 发射：命中时飞向中心准星射线命中点并出特效，未命中时直线飞出且不出命中特效（手动冒烟）。
- [ ] `BattleFollowFocusOffsetRightCm` 可将待机构图从居中调到偏左（手动冒烟）。
- [ ] `BattleFollowFocusOffsetUpCm` 与右偏参数仅影响 `PlayerFollow`，不影响 `PlayerAim`（手动冒烟）。
- [ ] 瞄准偏移参数（`PlayerAimFocusOffsetRightCm/UpCm`）与待机偏移参数完全独立（手动冒烟）。
- [ ] 瞄准镜头距离参数（`PlayerAimDistanceCm`）在 `PlayerAim` 下实时生效，且与 `SkillTargetZoomDistanceCm` 独立（手动冒烟）。
- [ ] 瞄准准星（Crosshair）层级高于战斗操作按钮（手动冒烟）。
- [ ] `PlayerFollow <-> PlayerAim` 镜头切换为平滑过渡（无硬切）（手动冒烟）。
- [ ] 瞄准悬停切换敌人时，角色左右转向为平滑过渡（手动冒烟）。
- [ ] 进入瞄准时隐藏非当前操控的我方角色（手动冒烟）。
- [ ] 切换角色/跳过回合时，`PlayerFollow` 镜头应平滑 lerp 到下一角色（手动冒烟）。
- [ ] 不同角色进入瞄准时，初始机位构图应基本一致（手动冒烟）。

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

- 问题描述：修复“瞄准左右旋转看似受奇怪限位（先右再左可转范围更大）”；根因是鼠标未锁指针时 `movementX` 仍受屏幕边界影响，导致输入增量路径依赖。
- 对应测试文件：`packages/web-client/src/input/UInputController.test.ts`（新增“按 Q 进入瞄准请求指针锁定”回归）。
- 新增/修改条目：C 节新增“Pointer Lock 防假限位”条目并置为已完成。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test -- src/input/UInputController.test.ts`：通过
  - `pnpm --filter @fd/web-client test`：通过（25 项）
  - `pnpm --filter @fd/web-client typecheck`：通过
  - `pnpm lint`：通过
- 是否新增 postmortem：`是`（`docs/postmortems/2026-02-28-battle-aim-pointer-lock-escape-regression.md`）

- 问题描述：修复“Pointer Lock 下按 Esc 退出瞄准需要按两次”；根因是首次 Esc 只释放浏览器 Pointer Lock，未向运行时派发取消瞄准边沿。
- 对应测试文件：`packages/web-client/src/input/UInputController.test.ts`（新增“锁释放自动注入 CancelAimEdge”回归）。
- 新增/修改条目：C 节新增“Esc 一次退出瞄准”条目并置为已完成。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test -- src/input/UInputController.test.ts`：通过
  - `pnpm --filter @fd/web-client test`：通过（26 项）
  - `pnpm --filter @fd/web-client typecheck`：通过
  - `pnpm lint`：通过
- 是否新增 postmortem：`是`（`docs/postmortems/2026-02-28-battle-aim-pointer-lock-escape-regression.md`）

- 问题描述：修复“瞄准起手左右极限体感不一致（先右再左左侧可转范围变大）”；根因是进入瞄准时仅在“扇区外”才回中轴，扇区内偏轴会造成起手单侧行程偏窄。
- 对应测试文件：`packages/web-client/src/game/UWebGameRuntime.test.ts`（新增“扇区内偏轴进入瞄准也回中轴”回归）。
- 新增/修改条目：C 节“瞄准时角色朝向由 `LookYawDelta` 连续驱动，左右限位采用敌人中心中轴扇区”条目继续保持已完成，并补充本次回归覆盖。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test`：通过（24 项）
  - `pnpm --filter @fd/web-client typecheck`：通过
  - `pnpm lint`：通过
  - `pnpm smoke:web`：通过（仅 `favicon.ico` 404，为历史非阻断项）
- 是否新增 postmortem：`否`

- 问题描述：修复“瞄准态返回按钮在角色靠左时可能出视口不可见且位置偏高遮挡角色”，最终将按钮锚点调整为“角色右侧偏下”。
- 对应测试文件：`packages/web-client/src/ui/BattleAimReturnLayout.test.ts`（先失败后修复，并更新最终断言）。
- 新增/修改条目：C 节新增“瞄准返回按钮挂在右侧偏下”自动化条目并置为已完成。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test -- BattleAimReturnLayout.test.ts`：先失败后通过
  - `pnpm --filter @fd/web-client test`：通过（15 项）
- 是否新增 postmortem：`否`

- 问题描述：实现“遭遇 -> 战斗 3C -> 结算回图”的事件驱动链路（功能开发，非缺陷修复）。
- 对应测试文件：`packages/gameplay-core/tests/UOverworldSimulation.test.ts`（核心回归沿用）。
- 新增/修改条目：新增 H 节“遭遇到战斗 3C 衔接（2026-02-26）”共 7 项，并更新 E 节命令状态。
- 验证命令与结果：
  - `pnpm lint`：通过
  - `pnpm test`：通过（`UBattleSimulation` + `UOverworldSimulation` 共 8 项）
  - `pnpm verify`：通过（typecheck + lint + test + build）
- 是否新增 postmortem：`否`

- 问题描述：修复“待机 -> 瞄准 -> 返回待机 -> 再次瞄准”机位漂移；根因是瞄准期临时转向未在退出时回滚，导致后续瞄准基准被污染。
- 对应测试文件：`packages/web-client/src/game/UWebGameRuntime.test.ts`（新增失败回归后修复）。
- 新增/修改条目：C 节新增 1 项并置为已完成。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test`：通过（9 项）
  - `pnpm --filter @fd/web-client typecheck`：通过
  - `pnpm lint`：通过
  - `pnpm verify`：通过（typecheck + lint + test + build）
- 是否新增 postmortem：`否`

- 问题描述：修复“瞄准镜头与角色距离不生效”（此前使用 `TargetArmLength * 0.58` 固定计算，未暴露独立可调参数）。
- 对应测试文件：`packages/web-client/src/debug/UDebugConfigStore.test.ts`（新增回归）。
- 新增/修改条目：C 节新增 2 项（自动化 1 项、手动 1 项）。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test`：通过（8 项）
  - `pnpm --filter @fd/web-client typecheck`：通过
  - `pnpm lint`：通过
  - `pnpm verify`：通过（typecheck + lint + test + build）
- 是否新增 postmortem：`否`

- 问题描述：修复瞄准镜头参数耦合（与待机共用导致互相打架）以及悬停敌人时镜头漂移。
- 对应测试文件：`packages/web-client/src/game/UWebGameRuntime.test.ts`（新增 `AimCameraYawDeg` 稳定断言）。
- 新增/修改条目：C 节新增 2 项（自动化 1 项、手动 1 项）。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test`：通过（7 项）
  - `pnpm --filter @fd/web-client typecheck`：通过
  - `pnpm lint`：通过
  - `pnpm verify`：通过（typecheck + lint + test + build）
- 是否新增 postmortem：`否`

- 问题描述：修复瞄准交互回归（鼠标开火不稳定、手柄 A 开火触发镜头乱切），并补齐战斗焦点高偏移参数与瞄准镜头复用。
- 对应测试文件：`packages/web-client/src/game/UWebGameRuntime.test.ts`（扩展悬停朝向、瞄准开火机位稳定断言）。
- 新增/修改条目：C 节新增 3 项自动化 + 1 项手动冒烟。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test`：通过（7 项）
  - `pnpm --filter @fd/web-client typecheck`：通过
  - `pnpm lint`：通过
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

- 问题描述：补齐战斗表现链路（右下队伍 HUD、瞄准悬停敌人头顶血条、开火子弹/击中特效）并修复战斗待机构图“无法调出偏左”的 debug 参数缺口。
- 对应测试文件：`packages/web-client/src/game/UWebGameRuntime.test.ts`（新增 2 条回归）。
- 新增/修改条目：C 节新增 5 项，其中 2 项自动化已完成，3 项待手动冒烟。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test`：通过（7 项）
  - `pnpm --filter @fd/web-client typecheck`：通过
  - `pnpm lint`：通过
  - `pnpm verify`：通过（typecheck + lint + test + build）
- 是否新增 postmortem：`否`

- 问题描述：修复瞄准态准星层级低于按钮、`PlayerFollow <-> PlayerAim` 镜头硬切、角色朝向硬切导致观感突兀。
- 对应测试文件：暂无自动化（本次为 Scene 表现层插值与层级修复，先走手动冒烟）。
- 新增/修改条目：C 节新增 3 项手动冒烟（准星层级、镜头切换平滑、角色转向平滑）。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test`：通过（9 项）
  - `pnpm --filter @fd/web-client typecheck`：通过
  - `pnpm lint`：通过
  - `pnpm verify`：通过（typecheck + lint + test + build）
- 是否新增 postmortem：`否`

- 问题描述：实现瞄准态隐藏队友、瞄准朝向改为准星连续驱动并在敌人角度范围内 clamp、切换角色时镜头平滑 lerp。
- 对应测试文件：`packages/web-client/src/game/UWebGameRuntime.test.ts`（新增“准星 X 连续驱动 + clamp”回归，调整悬停目标断言）。
- 新增/修改条目：C 节更新 1 项自动化条目并新增 2 项手动冒烟条目（瞄准隐藏队友、切角色镜头 lerp）。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test`：通过（10 项）
  - `pnpm --filter @fd/web-client typecheck`：通过
  - `pnpm lint`：通过
  - `pnpm verify`：通过（typecheck + lint + test + build）
- 是否新增 postmortem：`否`

- 问题描述：修复“不同角色进入瞄准机位差异过大”，并限制“跳过回合/逃跑”仅能在待机状态执行。
- 对应测试文件：
  - `packages/web-client/src/game/UWebGameRuntime.test.ts`（新增 3 条回归：瞄准禁切角色、瞄准禁逃跑、进入瞄准自动选前向目标）
  - `packages/web-client/src/ui/UBattleHudVisibility.test.ts`（新增待机态显示约束）
- 新增/修改条目：C 节新增 2 项自动化条目与 1 项手动冒烟条目。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test`：通过（14 项）
  - `pnpm --filter @fd/web-client typecheck`：通过
  - `pnpm lint`：通过
  - `pnpm verify`：通过（typecheck + lint + test + build）
- 是否新增 postmortem：`否`

- 问题描述：重构瞄准镜头为“虚拟 CameraSocket + 中心准星 TPS”，修复瞄准镜头不跟角色转向、切人构图偏差与目标回退不稳定问题。
- 对应测试文件：
  - `packages/web-client/src/game/UWebGameRuntime.test.ts`（新增 4 条回归：中心准星固定、LookYaw 驱动相机同步、敌人扇区外减速、无悬停目标按朝向回退）。
  - `packages/web-client/src/debug/UDebugConfigStore.test.ts`（补充 CameraSocket 新参数断言）。
- 新增/修改条目：C 节替换 1 条旧标准并新增 3 条自动化条目（中心准星、朝向同步、软限制/回退目标）。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test`：通过（17 项）
  - `pnpm --filter @fd/web-client typecheck`：通过
  - `pnpm lint`：通过
  - `pnpm verify`：通过（typecheck + lint + test + build）
  - `pnpm smoke:web`：通过（截图/console/network 产物归档）
- 是否新增 postmortem：`是`（`docs/postmortems/2026-02-28-battle-aim-camera-anchor-follow-regression.md`）

- 问题描述：修复“瞄准左右限位与屏幕目标不匹配”与“开火时角色朝向 snap 到目标”二次回归，改为角色前方 180 度半圆限位并取消开火强制转向。
- 对应测试文件：
  - `packages/web-client/src/game/UWebGameRuntime.test.ts`（新增/更新 3 条回归：前方 180 半圆限位、无悬停开火不改朝向、悬停开火不改朝向）。
- 新增/修改条目：C 节替换 1 条旧限位标准并新增 1 条自动化条目（开火不 snap 朝向）。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test -- src/game/UWebGameRuntime.test.ts`：通过（14 项）
  - `pnpm --filter @fd/web-client test`：通过（18 项）
  - `pnpm --filter @fd/web-client typecheck`：通过
  - `pnpm lint`：通过
  - `pnpm verify`：通过（typecheck + lint + test + build）
  - `pnpm smoke:web`：通过（截图/console/network 产物归档）
- 是否新增 postmortem：`是`（`docs/postmortems/2026-02-28-battle-aim-limit-fire-snap-regression.md`）
