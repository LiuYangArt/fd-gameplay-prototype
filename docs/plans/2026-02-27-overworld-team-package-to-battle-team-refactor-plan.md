# 2026-02-27 Overworld TeamPackage 到 Battle Team 的重构方案

## 1. 目标与需求对齐

本方案用于落实以下规则，并和当前实现对齐：

1. Overworld 阶段只显示 `char01`，但玩家实际操作的是一个 `Team/Package`。
2. 遭遇进入战斗后，双方都展开为团队成员（最多 3 人）。
3. 每个独立角色/敌人都拥有自身战斗属性与技能：`HP/MP/攻击/防御/技能列表`。
4. 移动速度挂在 Team 上（仅 Overworld 生效）。
5. Team 显示角色必须来自 Team 内成员（不能引用包外角色）。

## 2. 当前实现梳理（事实）

### 2.1 Overworld 现状

1. `gameplay-core` 当前是“单玩家实体 + 多个敌人实体”模型，没有 Team 概念。
   - `FOverworldState.Player` 是单体结构，只有位置与朝向。
   - 速度参数在 `FOverworldTuningSnapshot.WalkSpeed/RunSpeed`。
2. `UOverworldSimulation.HandleStep(...)` 直接基于单玩家移动，并用 `EncounterTriggered` 触发遭遇。

### 2.2 Battle3C 现状

1. `UWebGameRuntime.CreateBattle3CSession(...)` 里硬编码了 2 我方 + 3 敌方占位单位。
2. 角色切换逻辑硬编码为 `"P_YELLOW" <-> "P_RED"`。
3. Battle Unit 只有展示字段（位置、朝向、存活等），没有 `HP/MP/攻击/防御/技能列表`。

### 2.3 场景表现现状

1. Overworld 确实只渲染单个玩家 Mesh（`PlayerMesh`），不具备 Team 可见成员选择能力。
2. Battle 阶段按 `Battle3CState.Units` 渲染全部战斗单位。

## 3. 差距评估

当前架构已经具备“Overworld 单体显示 + Battle 多单位显示”的外观形态，但业务语义不完整：

1. 缺 Team 数据层，导致“移动速度属于 Team”“显示角色属于 Team 成员”的规则无法被数据约束。
2. Battle 单位来源是硬编码，不是从 Team 成员展开，后续维护成本高。
3. 单位战斗属性与技能未建模，无法支撑后续真实战斗逻辑。
4. 敌人侧同样缺 TeamPackage，遭遇时只能拿到 `EnemyId`，无法表达“敌方小队”。

## 4. 是否需要重构（结论）

需要重构，且属于“中等规模的数据层重构”，不是单纯渲染调整。

1. 必做：补 Team/Unit 双层模型，并让 Overworld 与 Battle 共用同一份成员来源。
2. 可控：渲染层改动较小，主要是读取新 ViewModel 字段，不需要推翻现有相机与输入系统。
3. 风险可管理：按阶段迁移并保留兼容映射即可，不必一次性大重写。

## 5. 方案对比

### 方案 A：仅在 web-client runtime 增加 Team 映射（短平快）

1. 思路：`UWebGameRuntime` 内部维护 Team 数据，`gameplay-core` 暂不改。
2. 效果：最快得到可运行结果。
3. 缺点：核心规则分散在表现层，后续迁移 UE 和复用成本高。

### 方案 B（推荐）：在 gameplay-core 增加 TeamPackage 领域模型，web-runtime 做编排

1. 思路：Team/Unit 数据与约束放进 `gameplay-core`，`web-client` 只消费状态并做展示。
2. 效果：契合“核心逻辑可迁移到 UE5（puerts）”目标，数据真源唯一。
3. 成本：前期类型与事件调整略多，但后续扩展最稳。

### 方案 C：直接把 Battle 真结算也一并并入本次重构

1. 思路：一次性把 Team + 单位属性 + 完整战斗规则都打通。
2. 效果：理论上最完整。
3. 缺点：超出当前迭代目标，改动面过大，回归风险高。

## 6. 推荐方案（B）详细设计

### 6.1 核心数据模型

1. 单位层（Unit）
   - `FUnitCombatSnapshot`
   - 字段：`UnitId`、`DisplayName`、`MaxHp`、`CurrentHp`、`MaxMp`、`CurrentMp`、`Attack`、`Defense`、`Speed`、`Skills`、`IsAlive`
2. Team 层（Package）
   - `FTeamPackageSnapshot`
   - 字段：`TeamId`、`DisplayName`、`MemberUnitIds`（1..3）、`LeaderUnitId`、`OverworldMove`（`WalkSpeedCmPerSec`/`RunSpeedCmPerSec`）
3. 关系约束
   - `LeaderUnitId` 必须属于 `MemberUnitIds`
   - Overworld 显示角色 `DisplayUnitId` 必须属于 `MemberUnitIds`
   - 遭遇敌方必须映射到一个 `EnemyTeamId`

### 6.2 Overworld 阶段规则

1. 输入仍控制一个“当前可控 Team”（例如 `PLAYER_TEAM_01`）。
2. 位移计算读取 Team 速度（不是角色个人速度）。
3. 场景层仅渲染 Team 的 `DisplayUnitId`（默认 `char01`）。
4. 遭遇事件从 `EnemyId` 升级为可解析 `EnemyTeamId`（可保留 `EnemyId` 兼容字段）。

### 6.3 Battle 阶段规则

1. 进入战斗时，从 `PlayerTeam.MemberUnitIds` 与 `EnemyTeam.MemberUnitIds` 展开战斗单位。
2. 上限强约束：每队最多 3 人（超出则按配置裁剪并记录日志）。
3. `ControlledCharacterId` 不再硬编码，改为 Team 成员列表内循环。
4. 后续真实结算直接读 `FUnitCombatSnapshot`，避免再做二次迁移。

### 6.4 事件驱动链路（保持无 Tick 依赖）

1. `WorldInitialized`：初始化 Team/Unit 仓与 Overworld 初始可控 Team。
2. `PlayerMoved`：语义保持不变，但速度来源改为 Team。
3. `EncounterTriggered`：附带/可解析 `EnemyTeamId`。
4. `EncounterTransitionFinished`：用 Team 成员创建 Battle 会话单位。
5. `Battle3CActionRequested`：继续用于输入语义动作广播（瞄准/开火/切人等）。

## 7. 改动范围与文件映射

### 7.1 gameplay-core（主要重构层）

1. `src/overworld/state/FOverworldState.ts`
   - 从单玩家状态升级为 Team 视角字段（含可控 Team、队伍速度来源）。
2. `src/overworld/events/FOverworldEvent.ts`
   - 补充遭遇事件里的 Team 映射字段。
3. `src/overworld/facade/UOverworldSimulation.ts`
   - `Step` 改为读取 Team 速度并维护 Team 相关约束。
4. 新增 team/unit 领域类型文件（建议 `src/team/...`）。

### 7.2 web-client（适配层）

1. `src/game/UWebGameRuntime.ts`
   - `CreateBattle3CSession` 从 Team 数据展开，不再硬编码固定角色。
   - `SwitchControlledCharacter` 改为在当前 Team 成员列表中循环。
2. `src/ui/FHudViewModel.ts`
   - 增加 Overworld Team 展示信息与 Battle 单位属性展示字段。
3. `src/game/USceneBridge.ts`
   - Overworld 阶段读取 Team 的显示角色模型（仍只显示一个）。

## 8. 迁移策略（最小可审阅改动）

### 阶段 1：先建模，不改表现

1. 在 `gameplay-core` 新增 Team/Unit 类型与约束函数。
2. 保持 UI 不变，通过适配层把旧字段映射到新模型。

### 阶段 2：切换运行时数据来源

1. `UWebGameRuntime` 改为从 Team 展开 Battle 单位。
2. 替换硬编码 `P_YELLOW/P_RED` 切换逻辑为成员列表循环。

### 阶段 3：补充单位属性与技能链路

1. 在 Battle HUD 和调试面板可视化单位属性（至少 HP/MP）。
2. 为后续技能系统预留 `Skills` 数据读取入口。

## 9. 验证与验收

### 9.1 自动化

1. `pnpm lint`
2. `pnpm test`
3. `pnpm verify`

### 9.2 手动冒烟

1. Overworld 仅显示 `char01`，移动速度来自 Team 配置。
2. 遭遇后 Battle 阶段展开完整 Team（最多 3 人）。
3. 切换可控角色只能在本 Team 成员内循环。
4. 敌方同样按 Team 展开，而不是固定 3 个占位 ID。

## 10. 风险与回退

1. 风险：类型变更会影响 `FHudViewModel` 和多处映射代码。
2. 风险：旧存档/调试配置可能缺失新字段。
3. 回退：保留旧字段兼容期（至少 1 个迭代），并提供默认 Team 构造器兜底。

## 11. 建议的下一步实施顺序

1. 先做“阶段 1 + 阶段 2”最小闭环，确保 Team 数据真源跑通。
2. 再做阶段 3（单位属性可视化与技能入口），避免一次性改动过大。
3. 每阶段结束后执行 `pnpm verify` 并更新回归清单。
