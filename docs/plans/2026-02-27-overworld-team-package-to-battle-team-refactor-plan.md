# 2026-02-27 Overworld TeamPackage 到 Battle Team 的重构方案（优化版，面向 UE5 迁移）

## 1. 直接结论

采用“方案 B+”：在 `gameplay-core` 建立 Team/Unit 真源模型，并把当前方案升级为“可迁移、可扩展、可验证”的结构化重构。

1. 保留当前目标：`Overworld 单体展示 + Battle 小队展开`。
2. 修正关键建模问题：`Roster` 与 `Formation` 解耦，不再把队伍总成员硬限制在 3 人。
3. 增加 UE 迁移契约：`SchemaVersion`、静态配置与运行时快照分层、强约束校验事件。
4. 预留“类 33 号远征队”扩展点：反应窗口、弱点部位、技能资源与冷却状态，但本期不实现完整战斗结算。
5. 整合角色模型替换：将玩家可控角色从 capsule 占位替换为 `SM_Char01/02/03.glb`，并接入 `SOCKET_Muzzle*` 挂点约定。

## 2. 目标与边界对齐

### 2.1 项目目标对齐（本仓库）

1. 当前任务是“玩法原型验证”，优先保证可迭代速度与行为可观察。
2. 核心逻辑要尽量可迁移到 UE5（puerts），因此 Team/Unit 规则必须放在 `gameplay-core`。
3. 保持事件驱动，不把核心规则绑在渲染 Tick 上。

### 2.2 对标《33号远征队》玩法（本次相关子集）

本次重构只覆盖与 Team/Unit 数据层直接相关的部分：

1. 队伍语义：有“队伍总成员”和“本场上阵位”两个层次。
2. 个体语义：每个单位有独立属性、技能与运行时状态。
3. 操作语义：战斗中可在“上阵成员顺序”内切换可控角色。

明确不在本期实现（但要预留结构）：

1. 实时反应输入（闪避/格挡/反击）完整结算。
2. 弱点射击命中与部位破坏逻辑。
3. AP、连段、技能协同等完整数值系统。

### 2.3 非目标（本期不做）

1. 不做完整战斗公式重写。
2. 不做复杂动画系统改造（但会完成玩家角色模型替换与挂点接入）。
3. 不做部署与线上存档方案。

### 2.4 本轮新增整合范围（模型规格文档）

对齐文档：`docs/design/2026-02-27-character-model-socket-spec.md`

1. 玩家角色资源使用 `glb`，优先接入：
   - `SM_Char01.glb`
   - `SM_Char02.glb`
   - `SM_Char03.glb`
2. 枪口挂点名称采用前缀匹配：`SOCKET_Muzzle*`（例如 `SOCKET_Muzzle.001`）。
3. 资源轴向修正、单位换算、挂点查询都在场景适配层处理，不进入 `gameplay-core`。

## 3. 当前实现梳理（事实）

### 3.1 Overworld 现状

1. `gameplay-core` 仍是“单玩家 + 多敌人”，无 Team 概念。
2. `FOverworldState.Player` 为单体位置/朝向，速度在 `FOverworldTuningSnapshot.WalkSpeed/RunSpeed`。
3. `UOverworldSimulation` 在 `Step` 中直接做玩家移动并触发 `EncounterTriggered`。

### 3.2 Battle3C 现状

1. `UWebGameRuntime.CreateBattle3CSession(...)` 硬编码 2 我方 + 3 敌方占位单位。
2. 角色切换硬编码 `"P_YELLOW" <-> "P_RED"`。
3. 战斗单位仅有展示字段，无独立战斗属性与技能字段。

### 3.3 场景表现现状

1. Overworld 仅渲染单个 `PlayerMesh`。
2. Battle 阶段根据 `Battle3CState.Units` 渲染全单位。

## 4. 当前方案的关键缺口（需修正）

1. 数据字段不完整：文中使用了 `DisplayUnitId` 约束，但 Team 结构未定义该字段。
2. 队伍建模耦合：`MemberUnitIds(1..3)` 同时承担“总成员”与“上阵位”职责，扩展性不足。
3. 扩展能力不足：`FUnitCombatSnapshot` 仅够展示，不足以承接后续“类 33”核心玩法状态。
4. UE 迁移契约缺失：缺 `SchemaVersion`、静态配置与运行时状态分层、显式校验失败链路。

## 5. 方案对比

### 方案 A：仅在 `web-client` 做 Team 映射（不推荐）

1. 效果：最快出结果。
2. 问题：核心规则继续留在表现层，UE 迁移价值低。

### 方案 B（原版）：`gameplay-core` 增加 TeamPackage（可用但不够）

1. 效果：方向正确，已满足“数据真源下沉”。
2. 问题：`1..3` 成员限制与字段不完整，后续仍可能二次重构。

### 方案 B+（推荐）：在 B 基础上补齐迁移与扩展契约

1. 效果：一次性解决“建模正确性 + 迁移可用性 + 扩展空间”。
2. 成本：比 B 多少量类型与校验工作，但能显著减少后续返工。

## 6. 推荐方案（B+）详细设计

### 6.1 设计原则

1. **真源唯一**：Team/Unit 约束只在 `gameplay-core` 定义与校验。
2. **结构解耦**：`Roster`（总成员）与 `Formation`（上阵位）分离。
3. **迁移友好**：所有核心快照可序列化，含版本号。
4. **强约束失败可见**：非法配置发出校验失败事件，不默认静默裁剪。
5. **单位规范对齐 UE**：距离 `cm`、速度 `cm/s`、角度 `deg`。

### 6.2 数据模型（静态配置 + 运行时快照）

```ts
export interface FSchemaMeta {
  SchemaVersion: string; // 例如 "1.0.0"
  DataRevision: number; // 每次状态变更递增
}

// 单位静态配置：适合资源表/UE DataAsset
export interface FUnitStaticConfig {
  UnitId: string;
  DisplayName: string;
  BaseMaxHp: number;
  BaseMaxMp: number;
  BaseAttack: number;
  BaseDefense: number;
  BaseSpeed: number;
  SkillIds: string[];
  Tags: string[];
  WeakPointSocketIds?: string[]; // 预留：弱点部位系统
}

// 单位运行时快照：每场战斗可变
export interface FUnitCombatRuntimeSnapshot {
  UnitId: string;
  CurrentHp: number;
  CurrentMp: number;
  IsAlive: boolean;
  Cooldowns: Record<string, number>;
  StatusEffects: string[]; // 预留：Buff/Debuff
  ReactionWindowMs?: {
    Dodge: number;
    Parry: number;
    Counter: number;
  }; // 预留：类 33 实时反应
}

export interface FTeamMoveConfig {
  WalkSpeedCmPerSec: number;
  RunSpeedCmPerSec: number;
}

// 队伍总成员，不限制为 3 人
export interface FTeamRosterSnapshot {
  TeamId: string;
  MemberUnitIds: string[]; // 1..N，顺序有意义
}

// 本场上阵位，强约束 1..3
export interface FTeamFormationSnapshot {
  TeamId: string;
  ActiveUnitIds: string[]; // 1..3
  LeaderUnitId: string;
  OverworldDisplayUnitId: string;
}

export interface FTeamPackageSnapshot {
  Meta: FSchemaMeta;
  TeamId: string;
  DisplayName: string;
  MoveConfig: FTeamMoveConfig;
  Roster: FTeamRosterSnapshot;
  Formation: FTeamFormationSnapshot;
}
```

### 6.3 关系约束（必须由 `gameplay-core` 校验）

1. `Roster.MemberUnitIds` 去重且长度 `>= 1`。
2. `Formation.ActiveUnitIds` 去重且长度 `1..3`。
3. `Formation.ActiveUnitIds` 必须是 `Roster.MemberUnitIds` 的子集。
4. `LeaderUnitId` 必须属于 `ActiveUnitIds`。
5. `OverworldDisplayUnitId` 必须属于 `ActiveUnitIds`。
6. 遭遇进入战斗时必须得到 `EnemyTeamId`，`EnemyId` 仅可做兼容字段。

异常策略：

1. 默认严格模式：校验失败触发 `ETeamValidationFailed`，中断创建战斗会话。
2. 仅调试兼容模式允许“裁剪到 3 人 + 警告日志”，发布配置禁用该模式。

### 6.4 Overworld 阶段规则

1. 输入始终作用于“当前可控 Team”。
2. 位移速度读取 `Team.MoveConfig`，不再直接挂在 `Player`。
3. 场景层只渲染 `Formation.OverworldDisplayUnitId` 对应外观。
4. `EncounterTriggered` 负载升级为：`EncounterId + PlayerTeamId + EnemyTeamId + 兼容 EnemyId`。

### 6.5 Battle 阶段规则

1. 创建战斗会话时按 `Formation.ActiveUnitIds` 展开双方单位，不再从硬编码 ID 生成。
2. `ControlledCharacterId` 在我方 `ActiveUnitIds` 顺序中循环，且跳过 `IsAlive=false` 单位。
3. 敌方脚本机位目标从敌方 `ActiveUnitIds` 推导，不再假设固定 3 名敌人。
4. 后续真实结算直接读取 `FUnitCombatRuntimeSnapshot`，避免再次改结构。

### 6.6 事件驱动链路（无核心 Tick 依赖）

1. `WorldInitialized`：初始化 Unit/Team 仓与默认可控队伍。
2. `TeamPackageBound`：世界中可遭遇实体与 `EnemyTeamId` 建立映射。
3. `PlayerMoved`：语义不变，速度来源改为 Team。
4. `EncounterTriggered`：携带 Team 级上下文。
5. `EncounterTransitionFinished`：按双方 `Formation.ActiveUnitIds` 创建 Battle 会话。
6. `Battle3CActionRequested`：输入语义动作广播。
7. `ETeamValidationFailed`：模型非法时上报并阻断会话创建。

### 6.7 角色模型与 Socket 整合设计（web-client）

1. 模型映射
   - `UnitId -> ModelAssetId -> GLB 路径` 三段映射。
   - 默认玩家映射：`char01 -> SM_Char01.glb`，`char02 -> SM_Char02.glb`，`char03 -> SM_Char03.glb`。
2. 场景加载策略
   - 在 `USceneBridge` 集中异步加载 GLB。
   - Overworld 仅显示 `OverworldDisplayUnitId` 对应模型。
   - Battle 阶段为每个上阵单位生成/复用实例，避免频繁重复加载。
3. 挂点解析策略
   - 在模型节点树里按“前缀匹配”查找 `SOCKET_Muzzle*`。
   - 若存在多个，优先精确 `SOCKET_Muzzle`，否则取字典序第一个。
   - 若不存在，触发警告日志并回退到角色根节点前方默认发射点。
4. 坐标与朝向
   - 运行时统一做轴向修正，保证与当前 Web 世界坐标一致。
   - 发射方向统一使用挂点本地 `+X`。

## 7. 改动范围与文件映射

### 7.1 `packages/gameplay-core`（主要重构层）

1. `src/overworld/state/FOverworldState.ts`
   - 增加 Team 视角字段：`ControlledTeamId`、`TeamMoveConfig` 来源。
2. `src/overworld/events/FOverworldEvent.ts`
   - 扩展遭遇事件为 Team 上下文负载。
3. `src/overworld/facade/UOverworldSimulation.ts`
   - `Step` 改为读取 Team 速度并触发 Team 级遭遇事件。
4. 新增 `src/team/...`
   - `FUnitStaticConfig`、`FUnitCombatRuntimeSnapshot`、`FTeamPackageSnapshot`。
   - `UTeamPackageValidator` 与 `ETeamValidationFailed` 事件。

### 7.2 `packages/web-client`（适配层）

1. `src/game/UWebGameRuntime.ts`
   - `CreateBattle3CSession` 改为从 `Formation.ActiveUnitIds` 展开。
   - `SwitchControlledCharacter` 改为按成员顺序循环，不再硬编码黄/红。
2. `src/ui/FHudViewModel.ts`
   - 增加 Team 展示信息与单位运行时属性展示字段（至少 HP/MP）。
3. `src/game/USceneBridge.ts`
   - Overworld 读取 `OverworldDisplayUnitId`，Battle 读取 Active 阵型单位。
   - 替换玩家占位 capsule 为 GLB 角色模型实例。
   - 增加 `SOCKET_Muzzle*` 挂点解析与调试可视化入口。
4. `src/game/UWebGameRuntime.test.ts`
   - 增加“非硬编码成员切换 + 异常配置阻断”测试。
5. `src/debug/UDebugConfigStore.ts`
   - 增加模型与挂点调试项并做版本兼容升级。

## 8. 迁移策略（最小可审阅改动）

### 阶段 1：先补模型与校验，不改表现

1. 在 `gameplay-core` 新增 Team/Unit 分层类型与校验器。
2. 提供“旧状态 -> 新模型”适配器，保证运行不回归。

### 阶段 2：切换 Battle 数据来源

1. `UWebGameRuntime` 改为从 `Formation.ActiveUnitIds` 展开战斗单位。
2. 删除 `P_YELLOW/P_RED` 硬编码切换逻辑。

### 阶段 3：补 HUD 可观察性

1. 在 HUD 展示每个单位 `HP/MP/Alive`。
2. 补技能/状态字段读取入口（先只读，不结算）。

### 阶段 4：兼容收口

1. 旧兼容字段保留 1 个迭代周期后清理。
2. 对外只保留新 Team/Unit 契约。

### 阶段 5：角色模型替换与挂点联调

1. 接入 `SM_Char01/02/03.glb` 并完成 Team 成员映射。
2. 完成 `SOCKET_Muzzle*` 查找、朝向校正、缺失兜底点位。
3. 在 Overworld 与 Battle 两个阶段验证显示与切换一致性。

## 9. 验证与验收

### 9.1 自动化验证

1. `pnpm lint`
2. `pnpm test`
3. `pnpm verify`

新增必须覆盖的单测（`gameplay-core` 优先）：

1. `LeaderUnitId` 不在 `ActiveUnitIds` 时触发 `ETeamValidationFailed`。
2. `OverworldDisplayUnitId` 不在 `ActiveUnitIds` 时触发 `ETeamValidationFailed`。
3. `ActiveUnitIds` 超过 3 时严格模式阻断。
4. 遭遇事件缺失 `EnemyTeamId` 时阻断进入战斗。
5. 切换可控角色时只在“存活且上阵”的成员内循环。

新增建议覆盖的集成验证（`web-client`）：

1. 模型路径错误时回退占位模型并输出可识别日志。
2. `SOCKET_Muzzle*` 缺失时使用默认发射点且不崩溃。
3. 切换可控角色后，镜头锚点与枪口挂点同步到新角色。

### 9.2 手动冒烟步骤

1. 启动：执行 `pnpm dev`，进入 Overworld。
2. 验证显示角色：确认场景只显示 `OverworldDisplayUnitId` 对应角色（默认 `char01`）。
3. 验证移动速度：在 Debug 中修改 Team 走跑速度，确认移动立即变化。
4. 遭遇入战：接触敌人后，Battle 单位应等于双方 `ActiveUnitIds`（每队最多 3 人）。
5. 切换角色：按切换键连续切换，只能在我方上阵成员内循环。
6. 配置异常：手工构造非法 Team（Leader 不在 Active）后，战斗应被阻断并有错误提示/日志。
7. 模型替换：Overworld 与 Battle 中玩家角色应显示 `SM_Char0*.glb`，不再是 capsule。
8. 挂点检查：开启调试后可看到枪口挂点位置/方向与角色武器方向一致。

## 10. 风险与回退

1. 风险：类型变更多点扩散到 HUD 与场景桥。
2. 风险：旧调试配置缺新字段导致运行异常。
3. 风险：迁移初期 Team 校验过严可能暴露大量历史脏数据。

回退策略：

1. 保留旧字段兼容适配器 1 个迭代周期。
2. 提供默认 Team 构造器（仅用于开发调试），确保页面可启动。
3. 保留“调试兼容模式”开关，但默认关闭，CI 环境强制严格模式。

## 11. 建议实施顺序（本轮）

1. 先完成“阶段 1 + 阶段 2”并跑通最小闭环。
2. 再做“阶段 3”提升可观察性。
3. 然后做“阶段 5”模型替换与挂点联调。
4. 最后做阶段 4 兼容收口。
5. 每阶段结束后执行 `pnpm verify`，并更新 `docs/testing/regression-checklist.md` 对应条目状态。

## 12. 实现后可见结果（你在游戏里会看到什么）

1. Overworld 仍只显示一名可控角色，但该角色来自 Team 阵型字段，不再是固定硬编码 ID。
2. 玩家移动速度会跟随 Team 配置变化，调参后立即体感变化。
3. 遭遇进入战斗时，双方单位来源于各自 `ActiveUnitIds`，不再固定“2 我方 + 3 敌方占位”。
4. 切人逻辑变成“本队上阵成员循环”，并跳过死亡成员。
5. 玩家角色外观由胶囊体替换为 `SM_Char01/02/03.glb`。
6. 枪口发射点来自 `SOCKET_Muzzle*`，后续射击/特效挂点可以直接复用该约定。

## 13. Debug 菜单改动建议（需要改）

1. 新增 Team 调试区
   - `ControlledTeamId`
   - `ActiveUnitIds`
   - `OverworldDisplayUnitId`
2. 新增模型调试区
   - 每个 Unit 当前模型路径
   - `ModelAxisFixPreset`（轴向修正预设）
   - `FallbackToPlaceholderOnLoadFail`（加载失败是否回退占位体）
3. 新增挂点调试区
   - `MuzzleSocketPrefix`（默认 `SOCKET_Muzzle`）
   - `ShowMuzzleSocketGizmo`（显示挂点位置/朝向）
   - `UseFallbackMuzzleIfMissing`
4. 版本兼容
   - `UDebugConfigStore` 建议升级版本号（例如 `V3 -> V4`），并保留旧配置迁移逻辑。

## 14. Task List（按执行顺序）

1. `gameplay-core`：新增 Team/Roster/Formation 类型与校验器，补 `ETeamValidationFailed` 事件与单测。
2. `gameplay-core`：改造 Overworld 事件负载，遭遇事件补 `PlayerTeamId/EnemyTeamId`。
3. `web-client`：`UWebGameRuntime` 从 `Formation.ActiveUnitIds` 创建 Battle 会话并移除硬编码切人。
4. `web-client`：扩展 `FHudViewModel`，补 Team 字段与单位基础属性展示字段。
5. `web-client`：在 `USceneBridge` 接入 GLB 模型加载缓存与 UnitId->模型路径映射。
6. `web-client`：实现 `SOCKET_Muzzle*` 挂点扫描、朝向读取、缺失兜底。
7. `web-client`：把 Overworld 玩家模型与 Battle 我方单位从 capsule 替换为 `SM_Char0*.glb`。
8. `web-client`：扩展 `UDebugConfigStore` 与 Debug UI，新增 Team/模型/挂点调试项。
9. `tests`：补 `web-client` 集成测试（加载失败回退、挂点缺失回退、切人后挂点同步）。
10. `verification`：执行 `pnpm lint`、`pnpm test`、`pnpm verify`，更新回归清单。
