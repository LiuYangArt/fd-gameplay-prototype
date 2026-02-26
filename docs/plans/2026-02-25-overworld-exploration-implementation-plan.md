# 大地图探索阶段实施计划（可落地）

## 1. 直接结论

采用“**探索模拟层（`gameplay-core`）+ Web 编排层（`web-client`）**”的增量方案，先把大地图探索跑通，再与现有 `UBattleSimulation` 进行遇敌切换。  
这样能满足当前原型速度，同时保留后续迁移 UE5（puerts）时的复用价值。

## 2. 目标与范围

### 2.1 本次目标（In Scope）

1. 实现大地图第三人称追尾探索（玩家可走/跑、可转向、可调相机）。
2. 实现敌人游荡与碰撞遇敌，触发进入现有回合制战斗。
3. 实现键鼠+手柄统一动作语义输入。
4. 提供 `F3` Debug 菜单，支持调参并持久化（JSON 结构）。
5. 补齐核心探索规则单元测试与最小冒烟验证步骤。

### 2.2 暂不纳入（Out of Scope）

1. 正式美术资源、复杂动画树、复杂敌人 AI。
2. 战斗结算后的完整回大地图状态恢复（先做最小可用返回策略）。
3. 网络同步与存档系统。

## 3. 成功标准（验收口径）

1. 玩家可在地图中用键鼠/手柄稳定移动与转向，走跑切换生效。
2. 玩家接触任一敌人后，2 秒内完成场景/状态切换进入战斗流程。
3. `F3` 菜单可实时改相机距离、FOV、走速、跑速，刷新后仍保留配置。
4. `gameplay-core` 新增探索规则测试通过，`pnpm verify` 通过。

## 4. 方案对比（含推荐）

### 方案 A：仅在 `web-client` 实现探索，直接调现有战斗运行时

- 效果/用途：最快看到画面与交互，短期实现成本最低。
- 优点：改动小，见效快。
- 缺点：探索规则沉在表现层，后续迁移 UE 价值低；输入/状态容易分散。
- 适用：纯一次性 Demo。

### 方案 B（推荐）：新增 `UOverworldSimulation`，由 `UWebGameRuntime` 编排探索与战斗

- 效果/用途：探索逻辑事件驱动且可测试，Web 端只做渲染与输入适配。
- 优点：符合分层约束，迁移友好，可持续迭代。
- 缺点：初次搭建比方案 A 多 1-2 天。
- 适用：当前项目目标（快速验证 + 可迁移）。

### 方案 C：把探索与战斗合并为单一超大状态机

- 效果/用途：理论上全局一致性最高。
- 优点：单一状态源。
- 缺点：重构量大、风险高，不符合“小步修改”。
- 适用：后期系统稳定后再考虑。

## 5. 推荐方案的架构设计（方案 B）

### 5.1 分层职责

1. `packages/gameplay-core`

- 新增 `UOverworldSimulation` 与探索命令/事件/状态。
- 负责玩家位置、朝向、敌人位置、遇敌判定、探索阶段状态。
- 不依赖 Babylon/DOM/浏览器 API。

2. `packages/web-client`

- `UWebGameRuntime` 编排“探索态/战斗态”切换。
- 输入层将键鼠/手柄映射为动作语义（非按键直连玩法）。
- 场景桥负责 3D 表现（胶囊玩家、倒金字塔敌人、相机追尾）。
- Debug 面板负责参数编辑与 JSON 配置读写。

3. `packages/ue-bridge`

- 本轮仅定义对齐接口草案，不实施真实对接。

### 5.2 关键事件链路

1. 输入动作变化 -> `UWebGameRuntime` 形成探索命令。
2. `UOverworldSimulation.SubmitCommand(...)` -> 产生命令对应事件。
3. 状态更新后触发 `EncounterTriggered` 事件。
4. 编排层监听遇敌事件 -> 调用 `UBattleSimulation.StartBattle` 流程。
5. 战斗结束后切回探索态（先最小策略：重置到安全点）。

### 5.3 Debug 配置持久化策略

浏览器不可直接安全写本地文件，建议采用：

1. 内部以 JSON 对象持久化到 `localStorage`。
2. 提供“导出 JSON / 导入 JSON”按钮，满足“JSON 可保存可复用”的需求。
3. 若后续必须真实文件落盘，再补本地宿主层（如 Electron/Tauri）能力。

## 6. 分阶段实施任务（可直接开工）

## 阶段 0：脚手架与契约（0.5 天）

1. 新建探索模块目录与导出入口。
2. 定义探索阶段、命令、事件、状态类型（UE 命名风格）。
3. 明确与战斗态切换接口（编排层协议）。

交付物：

- `gameplay-core` 探索类型与空实现可编译通过。

## 阶段 1：探索核心规则（1-1.5 天）

1. 实现 `UOverworldSimulation`、`UOverworldStateStore`。
2. 支持玩家移动意图、跑步倍率、敌人游荡步进。
3. 实现碰撞/近距离接触判定并发出遇敌事件。
4. 保证规则逻辑事件驱动（命令驱动状态变化）。

交付物：

- 探索模拟可在纯测试环境运行。
- 新增 `packages/gameplay-core/tests/UOverworldSimulation.test.ts`。

## 阶段 2：Web 编排与场景表现（1.5-2 天）

1. 新增 `UWebGameRuntime` 统一管理探索态/战斗态。
2. 场景层加入大地图基础地形与占位模型：

- 玩家：橙色胶囊，高度约 1.7。
- 敌人：蓝色倒金字塔，高度约 2.0。

3. 实现第三人称追尾相机（可调距离、俯仰、FOV）。

交付物：

- 进入页面默认处于探索态，可看到玩家与敌人游荡。

## 阶段 3：输入语义化改造（1 天）

1. 新增输入动作层，例如：`MoveAxis`、`LookAxis`、`SprintHold`、`ToggleDebugMenu`。
2. 键鼠与手柄映射到同一动作语义：

- 键鼠：`WASD`、鼠标、`Shift`。
- 手柄：左摇杆、右摇杆、`RT`。

3. 仅在运行时层消费动作语义，避免业务层出现按键码。

交付物：

- 两套输入设备均可完成移动、转向、跑步。

## 阶段 4：遇敌切战与最小回退（1 天）

1. 监听探索遇敌事件，构造战斗种子并进入战斗流程。
2. 战斗结束后返回探索态（最小策略：安全点重置 + 敌人移除或冷却）。
3. HUD 增加当前状态与关键调试信息（探索/战斗/最近遇敌）。

交付物：

- 完整“探索 -> 遇敌 -> 战斗 -> 返回探索”闭环。

## 阶段 5：Debug 菜单与配置持久化（1 天）

1. `F3` 开关菜单，支持以下参数：

- CameraDistance
- CameraPitch
- CameraFov
- WalkSpeed
- RunSpeed

2. 配置实时生效并持久化；支持 JSON 导入导出。
3. 参数变更记录最后更新时间，便于回归排查。

交付物：

- 刷新页面后参数仍生效；可导出配置文本并再次导入。

## 阶段 6：验证与文档收口（0.5 天）

1. 运行 `pnpm lint`、`pnpm test`、`pnpm verify`。
2. 更新回归清单（如果本轮出现/修复缺陷，同步状态）。
3. 补充最小操作手册到 `docs/testing`（探索冒烟步骤）。

交付物：

- 可复现验证命令 + 冒烟步骤文档。

## 7. 文件级任务清单（首轮建议）

### `packages/gameplay-core`（新增）

1. `src/overworld/enums/EOverworldPhase.ts`
2. `src/overworld/commands/EOverworldCommandType.ts`
3. `src/overworld/commands/FOverworldCommand.ts`
4. `src/overworld/events/EOverworldEventType.ts`
5. `src/overworld/events/FOverworldEvent.ts`
6. `src/overworld/state/FOverworldState.ts`
7. `src/overworld/state/UOverworldStateStore.ts`
8. `src/overworld/facade/UOverworldSimulation.ts`
9. `tests/UOverworldSimulation.test.ts`
10. `src/index.ts`（导出探索模块）

### `packages/web-client`（改造）

1. `src/game/UWebGameRuntime.ts`（新增，统一编排探索/战斗）
2. `src/game/USceneBridge.ts`（扩展探索渲染与相机追尾）
3. `src/input/UInputController.ts`（改为动作语义输出）
4. `src/ui/FHudViewModel.ts`（扩展探索态字段）
5. `src/App.tsx`（接入探索 HUD + Debug 菜单）
6. `src/debug/UDebugConfigStore.ts`（新增 JSON 持久化）

## 8. 风险与缓解

1. 风险：连续移动天然依赖帧更新，可能偏离“事件驱动”。

- 缓解：核心规则仅响应命令；帧循环只在适配层采样输入并发命令。

2. 风险：浏览器“写 JSON 文件”受安全限制。

- 缓解：本轮以 LocalStorage + 导入导出 JSON 达成需求。

3. 风险：探索与战斗状态切换耦合导致回归风险。

- 缓解：通过 `UWebGameRuntime` 统一状态机，禁止 UI 直接跨模块调用。

## 9. 手动冒烟验证步骤（实现后执行）

1. 启动：运行 `pnpm dev`，进入页面。
   预期：默认为探索态，可见橙色胶囊玩家与蓝色敌人。

2. 键鼠移动：按住 `WASD` + 移动鼠标，按住 `Shift`。
   预期：玩家可转向移动，按住 `Shift` 明显加速。

3. 手柄移动：连接手柄，左摇杆移动、右摇杆转向，按住 `RT`。
   预期：行为与键鼠一致，速度切换正常。

4. 遇敌：主动接触敌人模型。
   预期：触发切战，HUD 状态变为战斗态并进入现有战斗流程。

5. 战斗结束：完成一场战斗。
   预期：回到探索态，玩家处于安全点，避免立即重复触发。

6. Debug：按 `F3` 打开菜单，修改相机和速度参数，刷新页面。
   预期：参数保持，导出/导入 JSON 后可恢复同一配置。

## 10. 下一步建议

如果你认可这份计划，下一步直接进入“阶段 0 + 阶段 1”实现，我会先提交最小可审阅改动（探索类型定义 + `UOverworldSimulation` 最小闭环 + 首批单测）。
