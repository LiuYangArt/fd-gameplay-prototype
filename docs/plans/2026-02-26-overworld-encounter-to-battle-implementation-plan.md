# 2026-02-26 大地图遭遇到战斗 3C 衔接实施计划

## 1. 背景与目标

本计划用于重写“地图探索遇敌切入战斗”方案，目标是先把 3C（`Character / Camera / Control`）打通，并与大地图探索实现流畅衔接，不涉及具体对战逻辑、伤害数值与技能公式。

### 1.1 本期主结论

1. 首期采用“同场景战斗口袋区”方案，不切图，不新载关卡。
2. 玩法链路固定为：`OverworldExploring -> EncounterTransition -> Battle3C -> SettlementPreview -> OverworldExploring`。
3. `Battle3C` 阶段采用脚本驱动演示流，敌方攻击机位按预设脚本触发，不依赖真实伤害计算。
4. 结算先做简版：`F12` 触发结算画面，再返回地图探索。
5. 控制方案锁定：按一下 `LT` 或 `Q` 进入/退出瞄准；鼠标或右摇杆移动准星；鼠标左键或手柄 `RT/A` 开火。

## 2. 本期范围与非目标

### 2.1 本期范围（In Scope）

1. 遭遇后过渡演出：冻结探索逻辑、提示文本、镜头入场、单位入场。
2. 战斗 3C 基础可玩流：双角色切换、瞄准、开火、目标切换、敌方攻击机位脚本。
3. 简版结算预览：`F12` 触发结算画面并可回到探索态。
4. Debug Battle Tab：支持核心 3C 参数调试、持久化、导入导出。
5. 事件驱动链路：不使用 Tick 驱动核心玩法状态切换。

### 2.2 非目标（Out of Scope）

1. 不实现真实战斗结算（伤害、属性克制、Buff、技能 CD、命中判定）。
2. 不实现正式 AI 决策（行为树、权重系统、策略系统）。
3. 不实现正式美术资产与复杂后处理演出。
4. 不改动 `gameplay-core` 为渲染层服务，不引入 DOM/浏览器 API 依赖。

## 3. 体验目标与成功标准（3C 可感知指标）

1. 进入战斗前有明显“从探索进入战斗”的过渡，避免硬切。
2. 玩家能清晰感知当前控制对象（黄/红角色）与当前机位模式。
3. 瞄准模式与非瞄准模式差异明显：镜头、准星、输入行为一致可预期。
4. 敌方攻击机位满足构图原则：`camera -> 被攻击角色 -> 发起攻击敌人`。
5. 调试效率优先：关键机位参数可实时调整并持久化保存。
6. 首次遭遇到“可开火”总耗时目标 `< 3s`（默认参数，可调）。

## 4. 状态机与事件流（严格事件驱动）

### 4.1 运行时阶段定义

1. `OverworldExploring`：地图探索状态，处理移动与遭遇检测。
2. `EncounterTransition`：遭遇后过渡状态，冻结探索输入与敌人 AI，播放入场演出。
3. `Battle3C`：战斗演示状态，开放角色控制、瞄准、机位切换与脚本演示。
4. `SettlementPreview`：简版结算预览状态，仅用于回图闭环。

### 4.2 关键事件流

1. `EOverworldEventType.EncounterTriggered`
   - 输入：`EnemyId`、遭遇时玩家位置、敌人位置。
   - 输出：创建 `FEncounterContext` 并切入 `EncounterTransition`。
2. `EEncounterTransitionStarted`
   - 输出：冻结探索输入、开始提示与镜头入场动画。
3. `EEncounterTransitionFinished`
   - 输出：进入 `Battle3C`，初始化 `FBattle3CSession`。
4. `EBattle3CActionRequested`
   - 输入：角色切换、瞄准切换、开火、目标切换、敌方脚本推进。
   - 输出：更新 HUD 状态与机位模式，不提交伤害结算。
5. `ESettlementPreviewRequested`
   - 输入：`F12` 调试触发。
   - 输出：进入 `SettlementPreview`，显示简版结算画面。
6. `ESettlementPreviewConfirmed`
   - 输出：回到 `OverworldExploring`，恢复输入并清理战斗会话。

### 4.3 计划变更：关键接口与类型调整

1. `packages/web-client/src/ui/FHudViewModel.ts`
   - `FRuntimePhase` 调整为：`"Overworld" | "EncounterTransition" | "Battle3C" | "SettlementPreview"`。
   - 新增 `FBattle3CHudState`：`ControlledCharacterId`、`CameraMode`、`CrosshairScreenPosition`、`ScriptStepIndex`。
2. `packages/web-client/src/input/FInputSnapshot.ts`
   - 新增语义动作：`ToggleAimEdge`、`FireEdge`、`SwitchCharacterEdge`、`ToggleSkillTargetModeEdge`、`CycleTargetAxis`、`ForceSettlementEdge`、`ConfirmSettlementEdge`。
3. `packages/web-client/src/input/UInputController.ts`
   - 输入映射固定为：`LT/Q` 切瞄准，`MouseMove/RightStick` 控准星，`LMB/RT/A` 开火，`LB/C` 切角色，`Tab/RB` 技能目标模式，`F12` 触发结算。
4. `packages/web-client/src/game/UWebGameRuntime.ts`
   - 新增 `FEncounterContext` 与 `FBattle3CSession`，由事件推进 3C 会话，不提交伤害/数值命令。
5. `packages/web-client/src/game/USceneBridge.ts`
   - 新增机位模式与演出控制器：`IntroPullOut`、`IntroDropIn`、`PlayerFollow`、`PlayerAim`、`SkillTargetZoom`、`EnemyAttackSingle`、`EnemyAttackAOE`、`SettlementCam`。
6. `packages/web-client/src/debug/UDebugConfigStore.ts`
   - 扩展 Battle Tab 参数并升级存储版本 `V2 -> V3`，保留向后兼容读取。
7. `packages/gameplay-core`
   - 本期不新增对战数值规则，仅复用 Overworld 遭遇/解决事件。

## 5. Character 设计（2 我方 + 3 敌方占位模型、站位与切换）

1. 我方角色
   - 共 2 个，占位模型复用地图探索模型：黄色 capsule 与红色 capsule。
   - 默认站位：黄色在左，红色在右。
   - 战斗中允许手动切换可控角色，镜头与输入绑定当前角色。
2. 敌方角色
   - 共 3 个，占位模型为倒金字塔，与地图遭遇敌人风格一致。
   - 主敌人 `UnitId` 与遭遇对象绑定：`${EncounterEnemyId}_MAIN`，其余作为陪同敌人占位。
3. 入场动作
   - 玩家与敌人在入场阶段从高位缓降到地面，默认起始高度可调（cm）。
4. 绑定约束
   - `FEncounterContext` 在遭遇触发时创建，战斗结束后按上下文恢复与清理。

## 6. Camera 设计（入场、玩家回合、技能选目标、敌方攻击、结算）

### 6.1 镜头模式

1. `IntroPullOut`：遭遇触发后镜头先拉远，配合“遭遇敌人，进入战斗”提示。
2. `IntroDropIn`：镜头从角色后方远点推进到近点，完成入场。
3. `PlayerFollow`：玩家回合默认追尾视角，跟随当前可控角色。
4. `PlayerAim`：切瞄准后切入 TPS 视角，显示准星并允许精细控制。
5. `SkillTargetZoom`：选择技能目标时从追尾视角拉近敌方，可左右切目标。
6. `EnemyAttackSingle`：敌方单体攻击机位，保证被攻击角色靠近镜头。
7. `EnemyAttackAOE`：敌方群体攻击机位，保证攻击者与多名受击者同框。
8. `SettlementCam`：结算阶段的固定展示机位。

### 6.2 敌方攻击机位脚本（Battle3C 演示）

1. 脚本 A：敌人攻击黄色角色。
2. 脚本 B：敌人攻击红色角色。
3. 脚本 C：敌人 AOE 攻击两名角色。
4. 三个脚本都只做镜头与动作演示，不改变 HP 或战斗结算状态。

## 7. Control 设计（键鼠/手柄动作语义映射）

1. 瞄准切换
   - 键盘：`Q`（按一下切换进入/退出瞄准）。
   - 手柄：`LT`（按一下切换进入/退出瞄准）。
2. 准星控制
   - 键鼠：`MouseMove` 控制准星光标。
   - 手柄：`RightStick` 控制准星光标。
3. 开火触发
   - 键鼠：`MouseLeft` 开火。
   - 手柄：`RT` 或 `A` 开火。
4. 角色切换
   - 键盘：`C`。
   - 手柄：`LB`。
5. 技能目标模式
   - 键盘：`Tab` 切换目标模式，左右输入切换敌人。
   - 手柄：`RB` 切换目标模式，摇杆/方向输入切换敌人。
6. 结算调试
   - 键盘：`F12` 强制进入 `SettlementPreview`。
   - 确认返回：`Enter` 或手柄 `A`。

## 8. 同场景战斗口袋区实现约束（显隐、冻结、瞬移、单位 cm/deg）

1. 保持同一个场景环境，不创建独立战斗地图。
2. 遭遇时将玩家与敌人瞬移到固定战斗锚点区，探索区对象进入冻结态。
3. 至少隐藏遭遇敌人原始实体与不应参与当前战斗的表现实体。
4. 战斗地面风格与主场景保持一致（颜色与 grid 语义一致）。
5. 核心逻辑层统一使用 UE 单位：`cm / cm/s / deg`。
6. Web 渲染层如使用米制，仅允许在桥接层做 `cm <-> m` 转换。
7. 不允许在 `gameplay-core` 混入任何渲染引擎与浏览器 API。

## 9. Debug Battle Tab 参数清单（可调、可持久化、可导入导出）

### 9.1 关键参数

1. `BattleIntroCameraStartDistanceCm`
2. `BattleIntroCameraStartHeightCm`
3. `BattleIntroCameraEndDistanceCm`
4. `BattleIntroCameraEndHeightCm`
5. `BattleIntroDurationSec`
6. `BattleIntroFovDeg`
7. `BattleDropStartHeightCm`
8. `BattleDropDurationSec`
9. `BattlePromptDurationSec`
10. `PlayerAimFovDeg`
11. `PlayerAimShoulderOffsetCm`
12. `SkillTargetZoomDistanceCm`
13. `EnemyAttackCamDistanceCm`
14. `EnemyAttackCamHeightCm`
15. `SettlementCamDistanceCm`
16. `SettlementCamHeightCm`

### 9.2 存储与兼容策略

1. `UDebugConfigStore` 存储版本升级为 `FD_DEBUG_CONFIG_V3`。
2. 读取旧 `V2` 数据时，缺失新字段按默认值补齐并回写为 V3。
3. 参数变化需即时生效，并支持 JSON 导出/导入。

## 10. 实施任务分解（按里程碑）

1. `M1` 状态机与会话骨架
   - 扩展 runtime phase，增加 `FEncounterContext` 与 `FBattle3CSession`。
2. `M2` Character 侧完成
   - 接入双角色切换、敌我占位、遭遇对象 ID 绑定。
3. `M3` Camera 侧完成
   - 完成入场机位、玩家机位、敌方脚本机位、结算机位。
4. `M4` Control 侧完成
   - 打通键鼠/手柄动作语义输入，确保映射与 HUD 同步。
5. `M5` Debug Battle Tab 完成
   - 参数可调、实时生效、持久化、导入导出可用。
6. `M6` SettlementPreview 完成
   - `F12` 触发结算，确认后回到探索态并恢复输入。
7. `M7` 测试补齐与回归文档更新
   - 执行验证命令与冒烟步骤，更新回归清单。

## 11. 测试与验收（自动化 + 手动冒烟）

### 11.1 测试用例与场景

1. 遭遇切入测试：碰撞敌人后冻结探索逻辑，出现提示并播放入场镜头。
2. 入场动画测试：玩家/敌人从高位落地，镜头从远后方推进到角色后方。
3. 角色切换测试：黄/红角色可手动切换，镜头与输入绑定同步切换。
4. 瞄准测试：`LT/Q` 切换瞄准，准星可由鼠标/右摇杆移动，`LMB/RT/A` 触发开火表现。
5. 技能目标机位测试：切入目标模式后可左右切敌人，镜头按规则拉近目标。
6. 敌方机位脚本测试：单体打 A、单体打 B、AOE 三种机位都满足“相机->受击者->攻击者”构图。
7. 结算回图测试：`F12` 出结算画面，确认后返回探索并恢复输入。
8. Debug 持久化测试：Battle Tab 参数修改后刷新页面仍保留。
9. 回归命令：`pnpm lint`、`pnpm test`、`pnpm verify`。
10. 文档回归：若形成 bugfix，更新 `docs/testing/regression-checklist.md` 对应条目状态。

### 11.2 验收标准

1. 遭遇到战斗 3C 链路完整可复现，且无硬切断层。
2. 控制语义与机位反馈一致，键鼠与手柄均可完成核心流程。
3. 敌方三类攻击机位脚本可重复演示，不依赖真实战斗结算。
4. `F12` 结算预览闭环可用，并能稳定回到探索状态。

## 12. 风险与回退策略

### 12.1 主要风险

1. 状态机复杂度上升导致输入串态（探索输入误入战斗态）。
2. 镜头模式过多导致切换抖动与过渡不自然。
3. V2 到 V3 的调试配置兼容失败导致参数丢失。
4. 同场景显隐与冻结边界错误导致实体重复或穿帮。

### 12.2 回退策略

1. 保留开关：可一键降级到“单机位 Battle3C”最小模式。
2. 保留旧配置兼容读取路径，V3 失败时回退默认参数。
3. 任何模式异常时可强制回到 `OverworldExploring` 安全点。

### 12.3 明确假设与默认值（文档末尾）

1. 首期范围采用“全链路 3C”，但不做对战数值与公式。
2. 敌方攻击表现由脚本驱动，不依赖真实回合结算。
3. 结算为简版调试流程，`F12` 可直接触发。
4. 单位强制 UE 对齐：距离/位置/尺寸 `cm`，速度 `cm/s`，角度 `deg`。
5. `gameplay.canvas` 中 `fd_prototype_docs/...` 资源路径按当前仓库 `docs/...` 路径解释。
6. 当前计划优先满足“可调、可复现、可快速迭代”，正式战斗逻辑留到下一阶段计划。
