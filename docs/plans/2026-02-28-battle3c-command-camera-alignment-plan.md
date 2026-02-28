# Battle3C 指令与目标特写对齐计划（对齐 33 号远征队交互）

## 1. 直接结论

本次改造目标是把 Battle3C 指令层交互对齐到你给的 33 号远征队参考图，重点修正三件事：

1. 技能/物品菜单改成“点条目即激活”，移除“确认技能/确认物品”的二次确认按钮。
2. 攻击/技能共用“选择目标敌人”流程时，镜头改为稳定的敌人特写，不再出现每个敌人视角差异过大的问题。
3. 确认目标后不再立即切到当前“敌方脚本机位”占位演出；改为玩家动作占位反馈（HUD 明确提示“已执行攻击/技能”），然后回到待机。
4. 技能预览机位、物品预览机位、目标敌人特写机位三套参数全部加入 Debug 菜单可实时调整。
5. 增加“执行中阶段（ActionResolve）”锁输入，避免连按导致状态跳变。
6. 明确目标左右切换规则为“按屏幕 X 排序”，符合 console 常见手感。

---

## 2. 当前实现复盘（问题根因）

### 2.1 技能/物品为什么现在“繁琐”

当前是“二段确认”模型，而不是“条目即激活”：

- 菜单条目只是高亮展示，无点击激活事件：`App.tsx` 技能/物品列表 `li`。
- 只有点击“确认技能/使用占位物品”按钮，才会调用 `Runtime.FireBattleAction()`。
- Runtime 在 `CommandStage === "SkillMenu"` 时才执行 `ConfirmSkillSelectionAndEnterTargetSelection()`，在 `ItemMenu` 时才执行 `ConfirmItemPlaceholderSelection()`。

所以你看到的“还要再点确认”是当前实现行为，不符合目标参考。

### 2.2 目标特写镜头为什么不稳定

当前 `TargetSelect` 机位使用 `SkillTargetZoom`，其位置由“操控角色到目标的方向向量”推导：

- `Direction = ControlledPos - SelectedPos`
- `CameraPos = SelectedPos + Direction.normalize() * SkillTargetZoomDistance + UpOffset`

这个公式会导致：

- 相机位置受“我方站位 + 敌方站位”共同影响，切换敌人时角度变化大。
- 不是以“敌人自身”为锚点构图，容易出现你截图里那种镜头规律不直观、不同敌人差异很大的情况。

### 2.3 确认目标后为什么会“先飞怪机位”

当前确认目标后逻辑是：

1. `CommitTargetSelectionAction()` 产出 shot 事件；
2. 立即调用 `AdvanceEnemyScriptStep()`；
3. 相机切到 `EnemyAttackSingle/EnemyAttackAOE`（敌方脚本机位占位）；
4. `680ms` 后再回控制机位。

这就是你看到的“确认后先飞到怪位置”的直接原因。当前镜头跳转不是“玩家攻击/技能演出机位”，而是“敌方脚本占位机位”。

---

## 3. 目标交互规范（对齐参考图）

## 3.1 根命令层（Root）

- 入口：攻击、技能、物品。
- `攻击`：直接进入目标选择（TargetSelect）。
- `技能`：进入技能列表。
- `物品`：进入物品列表。

## 3.2 技能列表（SkillMenu）

- 上下切换：`↑/↓`、`D-Pad 上/下`。
- 关键变更：选择条目后“即时激活”：
  - 鼠标：点击技能条目直接选定技能并进入 `TargetSelect`。
  - 键盘/手柄：`F / A / LMB` 在技能列表中直接触发“当前高亮技能”的激活，不再显示“确认技能”独立按钮。
- `Esc / B` 返回 Root。

## 3.3 物品列表（ItemMenu）

- 对齐技能列表交互：条目即激活，不再额外确认按钮。
- 现阶段仍是占位逻辑：
  - 选中物品条目即记录 `UseItemPlaceholder:*`；
  - 显示一次 HUD 执行提示；
  - 返回 Root。
- `Esc / B` 返回 Root。

> 说明：后续接入“物品目标类型（己方/敌方/全体/自身）”时，若道具需要目标再进入目标选择；本期保持占位直出。

## 3.4 目标选择（TargetSelect）

- 来源：攻击 / 已选技能。
- 左右切换目标：`←/→`、`D-Pad 左/右`。
- `F / LMB / A` 确认目标。
- `Esc / B` 取消：
  - 技能来源 -> 回技能列表；
  - 攻击来源 -> 回 Root。

## 3.5 执行中阶段（ActionResolve，新增）

- 触发：`TargetSelect` 确认目标后进入。
- 目的：承载“玩家动作占位反馈”并锁输入，避免连按穿透。
- 持续：`ActionResolveDurationSec`（建议默认 `0.65s`，Debug 可调）。
- 期间输入策略：
  - 屏蔽：攻击/技能/物品/切目标/切角色/逃跑/瞄准切换。
  - 保留：仅允许全局 Debug 菜单、重开等系统级输入。
- 结束：自动回 `Root + PlayerFollow`。

## 3.6 目标切换顺序规则（新增硬规则）

- 在 `TargetSelect` 进入时，先计算可选敌人列表并按“屏幕投影 X 从小到大”排序。
- `←` 选择排序列表中的前一个，`→` 选择后一个。
- 若投影不可用（极端遮挡/出屏），回退到战斗槽位索引排序（左中右）。
- 目标列表在每次进入 `TargetSelect` 时重建；阶段内保持稳定顺序，避免抖动。

---

## 4. 镜头改造方案（稳定敌人特写）

## 4.1 目标

让 `TargetSelect` 始终是“以当前目标敌人为锚点”的稳定特写，切敌人时仅做可预期平移/转向，不再大幅跳变。

## 4.2 设计原则

- 以 **目标敌人局部坐标** 计算机位，不再使用“我方->敌方方向”主导。
- FOV、距离、抬高统一参数模板。
- 切换目标保持统一 blend 时长与曲线。
- 保证“正面可读性优先”：尽量避免拍到目标背面或极端侧后角度。

## 4.3 推荐构图公式（本期）

- `TargetAnchor = EnemyPos + (0, TargetLookAtHeightCm, 0)`
- `BasisForward = normalize(EnemyPos - BattleCenter)`（敌方阵列外向法线，稳定）
- `BasisRight = RightFrom(BasisForward)`
- `CameraPos = EnemyPos + BasisForward * CloseupDistanceCm + BasisRight * LateralOffsetCm + (0, CloseupHeightCm, 0)`
- `CameraLookAt = TargetAnchor`

建议默认参数（cm）：

- `CloseupDistanceCm = 210`
- `CloseupHeightCm = 135`
- `TargetLookAtHeightCm = 95`
- `LateralOffsetCm = 20`
- `FovDeg = 38`

补充限制（避免“怪角度”）：

- 相机与目标连线的俯仰角限制在 `[-8deg, 25deg]`。
- 相机方位相对 `BasisForward` 的偏航限制在 `[-35deg, 35deg]`。
- 切目标时启用统一 blend（`0.16~0.22s`），禁止硬切。

## 4.4 三套独立锚点参数（必须进入 Debug 菜单）

### A. 技能预览机位（PlayerSkillPreview）

用途：进入技能菜单时的“角色背后展示机位”，不再复用 `PlayerAim` 参数。

建议新增参数（cm/deg）：

- `SkillPreviewDistanceCm`
- `SkillPreviewShoulderOffsetCm`
- `SkillPreviewSocketUpCm`
- `SkillPreviewLookForwardDistanceCm`
- `SkillPreviewFocusOffsetRightCm`
- `SkillPreviewFocusOffsetUpCm`
- `SkillPreviewFovDeg`

### B. 物品预览机位（PlayerItemPreview）

用途：进入物品菜单时的“角色正面展示机位”，与技能预览参数独立。

建议新增参数（cm/deg）：

- `ItemPreviewDistanceCm`
- `ItemPreviewLateralOffsetCm`
- `ItemPreviewSocketUpCm`
- `ItemPreviewLookAtHeightCm`
- `ItemPreviewFocusOffsetRightCm`
- `ItemPreviewFocusOffsetUpCm`
- `ItemPreviewFovDeg`

### C. 目标特写机位（TargetSelect / SkillTargetZoom）

用途：攻击/技能选目标时的敌人特写，按目标敌人为锚点构图。

建议新增参数（cm/deg）：

- `TargetSelectCloseupDistanceCm`
- `TargetSelectCloseupHeightCm`
- `TargetSelectLookAtHeightCm`
- `TargetSelectLateralOffsetCm`
- `TargetSelectFovDeg`

### Debug 菜单分组规划

- `技能预览机位（PlayerSkillPreview）`：A 组全部参数
- `物品预览机位（PlayerItemPreview）`：B 组全部参数
- `目标敌人特写（TargetSelect）`：C 组全部参数
- `执行反馈（ActionResolve）`：
  - `ActionResolveDurationSec`
  - `ActionResolveToastOffsetX/Y`（可选）
  - `ActionResolveToastDurationSec`（可选，默认与阶段时长一致）

要求：上述 3 组参数均支持运行时 slider 调整并即时生效。

---

## 5. 目标确认后的执行反馈（无动画阶段）

## 5.1 现状问题

当前确认目标后直接进“敌方脚本机位”，与“玩家攻击/技能执行”语义不一致，造成强烈违和。

## 5.2 本期改造

确认目标后改为：

1. 记录动作事件（攻击或技能 + 目标）并进入 `ActionResolve`；
2. 显示 HUD 执行提示（例如：`已执行 攻击 -> Enemy 2-2` / `已执行 技能1 -> Enemy 2-2`）；
3. 在 `ActionResolve` 内锁输入，保持短暂动作反馈时长（建议 `0.5~0.8s`）；
4. 反馈结束后返回 Root + `PlayerFollow`。

本期先移除“确认后立即切敌方脚本机位”的链路；敌方脚本镜头保留为后续完整回合演出阶段再接回。

## 5.3 敌方回合推进占位策略（防断链）

- 本期不在“玩家确认目标”瞬间推进敌方脚本机位。
- 新增事件占位：`EPlayerActionResolved`（玩家动作反馈结束时触发）。
- 敌方脚本（若启用）应挂在该事件之后再触发，而不是挂在目标确认瞬间。
- 在未启用敌方演出时，保持回到 Root 待机，不再插入敌方机位闪跳。

---

## 6. 实施任务清单（Implementation Plan / Task List）

## Phase A：交互与状态机调整

- [ ] 移除技能/物品菜单里的“确认按钮”UI。
- [ ] 技能/物品条目增加点击即激活入口。
- [ ] 键鼠/手柄确认键在 `SkillMenu` / `ItemMenu` 中改为“当前高亮条目即激活”。
- [ ] 保持取消返回链路不变（技能来源回技能列表、攻击来源回 Root）。
- [ ] 新增 `ActionResolve` 阶段并实现输入锁。

## Phase B：TargetSelect 镜头重构

- [ ] 新增（或重定义）目标特写机位参数，转为“以目标敌人为锚点”的公式。
- [ ] 切目标时使用统一 blend，避免硬切和大幅机位跳变。
- [ ] 校正构图，保证三敌切换时景别一致。
- [ ] 目标特写机位参数全量挂到 Debug 菜单并支持实时调整。
- [ ] 实现“按屏幕 X 排序”的目标切换序规则（含回退策略）。

## Phase B2：技能/物品预览机位参数解耦

- [ ] `PlayerSkillPreview` 不再复用 `PlayerAim` 参数，改为独立 SkillPreview 参数组。
- [ ] `PlayerItemPreview` 不再复用 Aim 参数，改为独立 ItemPreview 参数组。
- [ ] SkillPreview / ItemPreview 参数均挂到 Debug 菜单并支持实时调整。

## Phase C：确认后的执行反馈

- [ ] `CommitTargetSelectionAction` 去掉立即 `AdvanceEnemyScriptStep()` 的路径。
- [ ] 新增 HUD action toast（攻击/技能执行文本 + 目标名）。
- [ ] 确认目标后进入 `ActionResolve`，阶段结束后返回 Root + 待机机位。
- [ ] 增加 `EPlayerActionResolved` 事件用于后续敌方回合占位衔接。

## Phase D：测试与回归

- [ ] Runtime：新增“技能/物品条目即激活”与“确认后返回待机且有执行提示”回归。
- [ ] Runtime：新增 `ActionResolve` 阶段输入锁回归（禁止连按穿透）。
- [ ] Runtime：新增“目标按屏幕 X 顺序切换”回归。
- [ ] SceneBridge：新增目标切换构图一致性快照/断言（可先做最小姿态断言）。
- [ ] App：菜单中不再渲染二次确认按钮。
- [ ] DebugConfigStore：新增三套锚点参数字段的默认值、sanitize 与持久化兼容回归。
- [ ] 执行 `pnpm --filter @fd/web-client test`、`pnpm lint`、`pnpm smoke:web`、`pnpm verify`。
- [ ] 更新 `docs/testing/regression-checklist.md` 新条目状态。

---

## 7. 验收标准（你关心的可见结果）

1. 进入技能/物品列表后，点击条目即可激活，不再需要再点“确认”。
2. 攻击/技能的目标选择都是敌人特写，切换敌人时机位差异小且规律可理解。
3. 确认目标后，先出现“已执行攻击/技能”的 HUD 提示，再回待机；不会先飞到奇怪机位。
4. 取消链路符合约定：技能来源回技能列表，攻击来源回根命令层。
5. Debug 菜单可分别调整 `SkillPreview`、`ItemPreview`、`TargetSelect` 三套机位参数，修改后实时生效。
6. `ActionResolve` 期间输入被锁定，不会出现重复触发或状态跳变。
7. 左右切目标严格按屏幕左右直觉移动，不会出现“按右却选到左边敌人”。

---

## 8. 风险与控制

- 风险1：移除二次确认后误触概率上升。  
  控制：仅在菜单态响应条目点击，外层加 `data-ignore-fire-input`，避免穿透触发。

- 风险2：目标特写参数一次调不准。  
  控制：参数全部入 `DebugConfig`，可快速联调，不改核心逻辑。

- 风险3：去掉敌方脚本机位影响现有“占位演出”感知。  
  控制：通过 `EPlayerActionResolved` 保留后续接回点，避免流程断链。

- 风险4：屏幕投影排序在边缘视角抖动。  
  控制：进入 `TargetSelect` 时冻结排序，阶段内不重排；仅重新进入时再计算。
