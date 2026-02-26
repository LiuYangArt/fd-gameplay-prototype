# 地图探索遇敌切入回合战斗实施计划

## 1. 直接结论

本阶段采用“**同场景战斗口袋区**”方案：  
玩家在地图探索中遭遇敌人后，不切换地图，不加载新关卡，而是冻结探索逻辑并进入过渡演出，再切入回合战斗。  
该方案能同时满足原型迭代效率、事件驱动约束、以及后续 UE5/puerts 迁移一致性。

## 2. 目标与范围

### 2.1 本次目标（In Scope）

1. 实现完整链路：`Exploring -> EncounterPending -> TransitioningToBattle -> Battle`。
2. 遭遇后先播放过渡提示与入场镜头，再进入可操作战斗阶段。
3. 保证“同一角色/同一敌人”进入战斗（可追踪 `EnemyId`）。
4. 新增 Debug 菜单 Battle Tab，支持入场镜头参数实时调试与持久化。
5. 补齐最小回归验证，确保流程稳定。

### 2.2 暂不纳入（Out of Scope）

1. 复杂战斗演出系统（多机位、受击特写、复杂后处理）。
2. 大规模资源流式加载与分区场景管理。
3. 正式动画资产与高级 AI 行为树。

## 3. 方案选择与业界实践结论

### 3.1 方案 A：同场景战斗口袋区（推荐）

- 效果/用途：遭遇后将玩家与目标敌人转移到地图内固定战斗锚点区域，主场景视觉风格保持一致。
- 优点：
  - 无黑屏切图，体验连续。
  - 实现成本低，适合快速迭代。
  - 与当前代码结构（`UWebGameRuntime` + `USceneBridge`）天然匹配。
- 风险：
  - 需要明确显隐与冻结边界，避免状态错乱。

### 3.2 方案 B：独立战斗关卡

- 效果/用途：遇敌后切到独立战斗场景，演出自由度更高。
- 优点：镜头和关卡可高度定制。
- 缺点：切换开销大，不利于原型阶段高频迭代。

结论：本轮采用方案 A，后续再评估是否升级到方案 B。

## 4. 状态机与事件流设计

### 4.1 运行时阶段

1. `Exploring`：地图探索，可移动与遇敌检测。
2. `EncounterPending`：已判定遭遇，等待进入过渡。
3. `TransitioningToBattle`：过渡提示 + 入场镜头 + 入场下落动画。
4. `Battle`：回合战斗正式阶段。

### 4.2 关键事件（建议新增）

1. `EEncounterTransitionStarted`
   - 载荷：`EnemyId`、`PlayerSnapshot`、`EnemySnapshot`、`StartedAt`。
2. `EBattleIntroCameraStarted`
   - 载荷：`StartPose`、`EndPose`、`Duration`、`Fov`。
3. `EBattleIntroFinished`
   - 载荷：`EnemyId`。
4. `EEncounterTransitionCompleted`
   - 载荷：`EnemyId`、`BattleId`。

### 4.3 事件驱动约束

- `gameplay-core` 继续保持纯命令/事件/状态，不依赖渲染与浏览器 API。
- 过渡动画由 `web-client` 表现层驱动，不反向污染核心规则层。
- 进入 `TransitioningToBattle` 后冻结探索输入语义，仅保留“跳过演出”（可选）。

## 5. 同一角色/同一敌人绑定策略

### 5.1 Encounter Context（建议新增）

建议在运行时新增 `FEncounterContext`：

- `PlayerId`
- `EnemyId`
- `EncounterWorldPose`
- `BattleAnchorId`
- `StartedAtMs`

### 5.2 绑定规则

1. `UWebGameRuntime` 在 `EncounterTriggered` 时创建并保存 `FEncounterContext`。
2. 战斗启动时主敌人 `UnitId` 强绑定为 `${EnemyId}_MAIN`，确保日志和 HUD 可追溯。
3. 战斗结束执行 `ResolveEncounter` 时，仅移除 `Context.EnemyId` 对应敌人。
4. 回到探索态后清理 `FEncounterContext`，保留 `LastEncounterEnemyId` 供调试显示。

## 6. 场景与演出设计（USceneBridge）

### 6.1 显隐与冻结策略

1. `TransitioningToBattle/Battle`：
   - 隐藏探索玩家 Mesh、探索敌人 Mesh（至少隐藏遭遇敌人）。
   - 显示战斗地面与战斗单位 Mesh。
2. 地面视觉：
   - 战斗区地面颜色与 grid 风格保持与探索场景同系，保证空间连续感。

### 6.2 入场演出（第一版）

1. 提示文案：`遭遇敌人，进入战斗`，持续 `0.8s`（可配置）。
2. 入场镜头：
   - Camera 从角色身后远点插值到近点。
   - 采用平滑曲线插值（如 ease-out）。
3. 单位入场：
   - 玩家与敌人从高位（如 `220cm`）缓降到地面。
   - 时长 `0.6~1.0s`（可配置）。
4. 演出结束后触发 `EBattleIntroFinished`，再开放战斗输入。

## 7. Debug 菜单扩展（Battle Tab）

建议在 `FDebugConfig` 增加以下字段（单位 UE 对齐）：

1. `BattleIntroCameraStartDistanceCm`
2. `BattleIntroCameraStartHeightCm`
3. `BattleIntroCameraEndDistanceCm`
4. `BattleIntroCameraEndHeightCm`
5. `BattleIntroDurationSec`
6. `BattleIntroFovDeg`
7. `BattleDropStartHeightCm`
8. `BattleDropDurationSec`
9. `BattlePromptDurationSec`

约束：

- 参数修改后立即生效。
- 继续使用 `UDebugConfigStore` 持久化（localStorage + JSON 导入导出）。

## 8. 分阶段实施任务（最小可审阅改动）

### 阶段 1：运行时状态与上下文

1. 扩展 `FHudViewModel`，增加过渡子阶段与过渡状态展示字段。
2. 在 `UWebGameRuntime` 引入 `FEncounterContext`，打通遭遇到战斗启动链路。
3. 确保 `RuntimePhase` 在过渡期间不会误消费战斗指令。

### 阶段 2：场景过渡表现

1. 在 `USceneBridge` 增加 `TransitioningToBattle` 渲染分支。
2. 实现简化版镜头插值与单位下落动画。
3. 接入提示 UI 状态（HUD 文本即可）。

### 阶段 3：Debug Battle Tab

1. 扩展 `UDebugConfigStore` 默认值、边界与导入导出校验。
2. 在 `App.tsx` Debug 面板增加 Battle Tab 与参数滑条。
3. 确认刷新后参数可恢复。

### 阶段 4：测试与回归

1. `gameplay-core`：补遭遇触发与解决的回归测试。
2. `web-client`：补最小冒烟步骤文档。
3. 若本轮修复了明确 bug，按仓库规则补 `regression-checklist` 与 postmortem（触发条件满足时）。

## 9. 验收标准

1. 玩家接触敌人后，先出现过渡提示，再进入回合战斗（非硬切）。
2. 战斗内主敌人 ID 与遭遇敌人 ID 一致，可在 HUD/日志追踪。
3. Battle Tab 参数可实时调节镜头起止位置与 FOV，并在重启后保留。
4. 命令通过：`pnpm lint`、`pnpm test`、`pnpm verify`。

## 10. 手动冒烟验证步骤

1. 启动 `pnpm dev`，进入地图探索。
   - 预期：可正常移动，敌人正常游荡。
2. 接触任一敌人。
   - 预期：出现“遭遇敌人，进入战斗”提示，随后播放入场镜头与下落演出。
3. 进入战斗后观察目标敌人标识。
   - 预期：主敌人 ID 与遭遇敌人 ID 对应一致（如 `OW_ENEMY_01_MAIN`）。
4. 打开 `F3` Debug 菜单切到 Battle Tab，调整镜头参数。
   - 预期：演出参数即时生效，导出/导入 JSON 正常。
5. 结束战斗返回探索。
   - 预期：遭遇敌人按规则移除（或标记解决），流程可重复。
