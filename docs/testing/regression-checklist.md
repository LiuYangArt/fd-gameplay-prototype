# 回归检查清单（Gameplay Prototype）

更新时间：2026-03-02

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

- [x] 浏览器可测试条目已使用 `playwright-cli` 执行并保留命令记录（本次执行 `pnpm smoke:web`，含键盘/鼠标交互步骤，产物：`output/playwright/2026-03-01T11-58-04-154Z/`）。
- [x] GitHub Pages 子路径部署下（`/<repo>/`）角色模型与手柄提示图标资源路径可正确解析，不应请求根路径 `/assets/...`（`UDebugConfigStore.test.ts` + `UInputPromptRegistry.test.ts` + 线上 URL 探针）。
- [ ] 键鼠映射：确认/切目标/重开战斗均可触发。
- [ ] 手柄映射：A / D-Pad Right / Start 均可触发。
- [ ] 输入边沿触发无连发问题（按住不会重复触发一次性动作）。
- [ ] 战斗结束后 UI 与 3D 表现同步到完成态。
- [x] 瞄准模式下准星固定屏幕中心，忽略绝对鼠标位置输入，且隐藏系统鼠标光标（`PlayerAim`，`UWebGameRuntime.test.ts`）。
- [x] 战斗 HUD 点击不会误触发开火输入（`mousedown` 过滤 UI 元素）。
- [x] 瞄准模式下支持 `Esc / 手柄 B / HUD 返回按钮` 退出瞄准并回到跟随镜头（`UWebGameRuntime.test.ts` + `UInputController.test.ts`）。
- [x] 所有返回动作统一在 HUD 左下角全局动作栏（screenspace 左下锚点）触发，不再在角色锚点或菜单面板内散落（`UBattleHudVisibility.test.ts` + `pnpm smoke:web`）。
- [x] 战斗结束回到 `Overworld` 后，左下角战斗 HUD（逃跑/跳过回合）会完全清理。
- [x] 瞄准模式下悬停敌人会同步 `HoveredTargetId`，并支持头顶血条显示（`UWebGameRuntime.test.ts`）。
- [x] 战斗开火会产出 Shot 可视化事件（`UWebGameRuntime.test.ts`）。
- [x] 瞄准模式开火不会切到敌方攻击机位（避免 camera 乱飞）（`UWebGameRuntime.test.ts`）。
- [x] 瞄准时角色朝向由 `LookYawDelta` 连续驱动，左右限位采用“敌人中心中轴扇区”（`UWebGameRuntime.test.ts`）。
- [x] 鼠标瞄准时进入 `Battle3C` 瞄准会请求 Pointer Lock，退出瞄准自动释放，避免屏幕边界造成左右旋转“假限位”（`UInputController.test.ts`）。
- [x] Pointer Lock 状态下按 `Esc` 一次应直接退出瞄准（锁释放后自动注入 `CancelAimEdge`），不需要按两次（`UInputController.test.ts`）。
- [x] 瞄准状态下不允许“跳过回合/切角色”，输入应被忽略（`UWebGameRuntime.test.ts`）。
- [x] 瞄准状态下不允许“逃跑”，仅待机状态允许（`UWebGameRuntime.test.ts`）。
- [x] 根命令层“攻击”进入统一目标选择（不立即开火），`PendingActionKind=Attack`（`UWebGameRuntime.test.ts`）。
- [x] 技能菜单条目点击即激活并进入统一目标选择，同时记录 `SelectedSkillOptionId`；取消可返回技能菜单（`UWebGameRuntime.test.ts`）。
- [x] 攻击来源的目标选择取消后返回根命令层（`UWebGameRuntime.test.ts`）。
- [x] 技能菜单与物品菜单分别使用 `PlayerSkillPreview` / `PlayerItemPreview` 机位（`UWebGameRuntime.test.ts`）。
- [x] 物品菜单条目点击即激活后进入我方目标选择；确认后记录占位行为 `UseItemPlaceholder:<itemId>:<targetId>`（`UWebGameRuntime.test.ts`）。
- [x] 物品流程在 `TargetSelect/ActionResolve` 期间保持 `PlayerItemPreview` 机位风格，并随左右切换对准当前我方目标角色（`UWebGameRuntime.test.ts` + `USceneBridge.ts`）。
- [x] 物品目标选择阶段应响应左右导航语义（键鼠/手柄），并在右下队伍卡给出当前目标高亮反馈（`UWebGameRuntime.test.ts` + `App.tsx`）。
- [x] 物品目标选择阶段左右切换目标时，镜头应使用与其他战斗机位一致的 lerp 过渡，避免硬切（`USceneBridge.test.ts` + `USceneBridge.ts`）。
- [x] 物品目标选择阶段因镜像机位导致左右体感反向时，应修正为“左键选屏幕左侧 / 右键选屏幕右侧”（`UWebGameRuntime.test.ts` + `UWebGameRuntime.ts`）。
- [x] 攻击/技能选敌与道具选己方目标阶段，左下角动作栏应展示“左目标/右目标/确认目标”提示，并支持键盘 `F` 与手柄 `A` 确认（`UWebGameRuntime.test.ts` + `UInputController.test.ts` + `App.tsx`）。
- [x] 无存活敌人时阻断进入目标选择并记录事件日志（`UWebGameRuntime.test.ts`）。
- [x] 左下角战斗操作栏显示由 `GlobalActionSlots` 驱动：菜单态/目标态/瞄准态可显示“返回”，Root 待机显示“逃跑/跳过回合”（`UBattleHudVisibility.test.ts`）。
- [x] 菜单输入映射统一为 `↑/↓/←/→` 导航 + `Enter/A` 确认 + `Esc/B` 返回（`UInputController.test.ts` + `UWebGameRuntime.test.ts`）。
- [x] 战斗中右键提示与行为一致：RMB 可稳定触发瞄准切换，不受忽略开火 UI 区域与浏览器右键菜单干扰（`UInputController.test.ts`）。
- [x] 战斗屏幕任意位置右键都可切瞄准（包括 3D 画布空白区），不依赖点在按钮上（`UInputController.test.ts` + `pnpm smoke:web`）。
- [x] 战斗输入的鼠标战斗动作仅在 3D viewport 内响应：viewport 内 RMB 可切瞄准，viewport 外 RMB 不触发战斗动作（`UInputController.test.ts`）。
- [x] 手柄根命令列表支持 `D-Pad` 与左摇杆上下同等导航（`UInputController.test.ts`）。
- [x] `Overworld` 手柄冲刺维持 `RT` 按住触发；`L3` 仅用于长按逃跑，不再误触发冲刺（`UInputController.test.ts`）。
- [x] 左下角“逃跑/跳过回合”改为长按触发：键盘 `C/Tab`，手柄 `LS/RS`，并提供长按进度反馈（`UInputController.test.ts` + `UWebGameRuntime.test.ts` + `pnpm smoke:web`）。
- [x] Root 待机且无镜头/准星位移时，长按 `逃跑`/`跳过回合` 的进度变化与松开重置也会触发 HUD 刷新（`UWebGameRuntime.test.ts`）。
- [x] 键鼠设备默认不显示列表焦点高亮，方向键导航后才显示高亮焦点（`UWebGameRuntime.test.ts`）。
- [x] 鼠标点击战斗视口空白区域不会直接触发攻击或进入目标选择（`App.tsx` + `pnpm smoke:web`）。
- [x] 目标确认后进入 `ActionResolve`（锁输入），结束后自动回到 `Root + PlayerFollow`，期间不跳敌方脚本机位（`UWebGameRuntime.test.ts`）。
- [x] `ActionResolve` 结束时触发 `EPlayerActionResolved` 占位事件（`UWebGameRuntime.test.ts`）。
- [x] `TargetSelect` 左右切换遵循“按屏幕 X 冻结顺序”规则（`UWebGameRuntime.test.ts`）。
- [x] `TargetSelect` 敌人特写机位方向仅依赖固定角度参数 `TargetSelectYawDeg`，不受当前操控角色/战场中心影响（`USceneBridge.test.ts`）。
- [x] `TargetSelect/ActionResolve` 复用瞄准锚点显示“选中敌人头顶 HP 条”（`App.tsx` + `USceneBridge.ts`）。
- [x] 瞄准命中判定应按准星中心射线与敌人模型体积命中（不再依赖“头部屏幕距离阈值”）（`USceneBridge.ts` + `pnpm smoke:web`）。
- [x] 命中反馈需包含明显粒子爆发（闪光/冲击环/火花）并与命中事件同步触发（`USceneBridge.ts` + `pnpm smoke:web`）。
- [x] 命中特效、扣血与伤害数字时序一致：子弹到达后再结算，开火瞬间不应提前扣血/弹字（`UWebGameRuntime.ts` + `App.tsx` + `UWebGameRuntime.test.ts`）。
- [x] 瞄准时 `AimCameraYawDeg` 应与当前操控角色 `YawDeg` 同步更新（`UWebGameRuntime.test.ts`）。
- [x] 瞄准时支持上下抬枪：`AimCameraPitchDeg` 随输入变化，角色 `YawDeg` 不因俯仰输入改变（`UWebGameRuntime.test.ts`）。
- [x] `OverworldInvertLookPitch` 与 `AimInvertLookPitch` 可独立控制上下反转，互不影响（`UWebGameRuntime.test.ts`）。
- [x] 瞄准开火在无悬停目标时允许 miss（`LastShot.TargetUnitId=null`），且不强制 snap 角色朝向（`UWebGameRuntime.test.ts`）。
- [x] 瞄准开火命中目标时不应强制把角色朝向 snap 到目标方向（`UWebGameRuntime.test.ts`）。
- [x] 数值输入框可录入超 slider 区间的机位参数，`ApplyPatch` 仅做安全边界钳制（`UDebugConfigStore.test.ts`）。
- [x] 退出瞄准后恢复待机朝向，再次进入瞄准机位基准保持稳定（`UWebGameRuntime.test.ts`）。
- [ ] 右下角队伍头像 + HP/MP HUD 在 Battle3C 正常显示（手动冒烟）。
- [ ] 开火子弹从 `SOCKET_Muzzle*` 发射：命中时飞向中心准星射线命中点并出特效，未命中时直线飞出且不出命中特效（手动冒烟）。
- [ ] `BattleFollowFocusOffsetRightCm` 可将待机构图从居中调到偏左（手动冒烟）。
- [ ] `BattleFollowFocusOffsetUpCm` 与右偏参数仅影响 `PlayerFollow`，不影响 `PlayerAim`（手动冒烟）。
- [ ] 瞄准偏移参数（`PlayerAimFocusOffsetRightCm/UpCm`）与待机偏移参数完全独立（手动冒烟）。
- [ ] 瞄准镜头距离参数（`PlayerAimDistanceCm`）在 `PlayerAim` 下实时生效，且与 `TargetSelectCloseupDistanceCm` 独立（手动冒烟）。
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
- [x] 输入语义映射已接入：`RMB/LT` 切瞄准，`LMB/RT` 瞄准开火，`Enter/A` 确认，`Esc/B` 取消，长按 `Tab/RS` 跳过回合，长按 `C/LS` 逃跑，`Alt+S` 调试结算。
- [x] Debug 配置升级到 `FD_DEBUG_CONFIG_V3`，并兼容读取 V2。
- [ ] 遭遇过渡演出（提示、镜头拉出/推进、单位高位落地）通过手动冒烟。
- [ ] 敌方三段机位脚本（单体黄/单体红/AOE）构图通过手动冒烟。
- [ ] `Alt+S` 结算预览 + Enter/A 返回探索闭环通过手动冒烟。
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

- 问题描述：修复 GitHub Pages 部署后角色模型未加载（回退 capsule）与手柄提示图标路径失效；根因是资源路径使用了根路径绝对地址 `/assets/...`，在 `/<repo>/` 子路径站点下会 404。
- 对应测试文件：
  - `packages/web-client/src/debug/UDebugConfigStore.test.ts`（新增“子路径部署下模型路径应为相对 assets 路径”回归，先失败后修复）
  - `packages/web-client/src/input/UInputPromptRegistry.test.ts`（新增“手柄图标路径不应以 / 开头”断言，先失败后修复）
- 新增/修改条目：C 节新增“GitHub Pages 子路径部署资源路径可解析”条目并置为已完成。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test -- src/debug/UDebugConfigStore.test.ts`：先失败后通过。
  - `pnpm --filter @fd/web-client test -- src/input/UInputPromptRegistry.test.ts`：先失败后通过。
  - `https://liuyangart.github.io/assets/models/characters/SM_Char01.glb` => `404`；`https://liuyangart.github.io/fd-gameplay-prototype/assets/models/characters/SM_Char01.glb` => `200`（根因探针）。
- 是否新增 postmortem：`是`（`docs/postmortems/2026-03-02-github-pages-assets-base-path-regression.md`）。

- 问题描述：按体验反馈补充目标选择阶段的左下角操作提示，要求同时覆盖“攻击/技能选敌”和“道具选己方目标”，并新增键盘 `F` 确认目标（手柄保持 `A`）。
- 对应测试文件：
  - `packages/web-client/src/game/UWebGameRuntime.test.ts`（新增目标选择阶段左下角槽位回归）
  - `packages/web-client/src/input/UInputController.test.ts`（确认边沿覆盖 `F/Enter/Escape`）
  - `packages/web-client/src/input/UInputPromptRegistry.test.ts`（键鼠确认提示文案为 `F`）
- 新增/修改条目：C 节新增“目标选择阶段左下角提示 + F/A 确认”条目并置为已完成。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test -- src/game/UWebGameRuntime.test.ts -t "攻击/技能选敌与道具选己方目标阶段，左下角应提供左右切换与确认目标提示"`：通过（1 项命中）。
  - `pnpm --filter @fd/web-client test -- src/input/UInputController.test.ts src/input/UInputPromptRegistry.test.ts`：通过。
  - `pnpm --filter @fd/web-client test`：通过。
- 是否新增 postmortem：`否`（未触发模板中的新增条件）。

- 问题描述：修复“伤害数字与扣血出现在命中特效之前”的时序问题；根因是伤害在开火时立即结算，而特效在弹道到达后才触发。
- 对应测试文件：`packages/web-client/src/game/UWebGameRuntime.test.ts`（更新命中回归，增加“开火后立即不扣血，命中后再结算”断言）。
- 新增/修改条目：C 节新增“命中特效、扣血与伤害数字时序一致”条目并置为已完成。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client typecheck`：通过。
  - `pnpm exec eslint packages/web-client/src/game/UWebGameRuntime.ts packages/web-client/src/game/UWebGameRuntime.test.ts packages/web-client/src/App.tsx packages/web-client/src/ui/FHudViewModel.ts`：通过。
  - `pnpm --filter @fd/web-client test -- src/game/UWebGameRuntime.test.ts`：通过（39 项）。
  - `pnpm smoke:web`：通过（产物：`output/playwright/2026-03-02T03-31-14-310Z/`）。
- 是否新增 postmortem：`否`（未触发模板中的新增条件）。

- 问题描述：修复“命中反馈时序不自然（敌人先后退再炸特效）+ 粒子冲击感不足”；根因是击退在开火事件立即执行，而命中特效在弹道结束时才生成，导致视觉先后顺序错位。
- 对应测试文件：`packages/web-client/src/game/UWebGameRuntime.test.ts`（更新“命中后应先等待弹道命中再击退，并在短时后回位”）。
- 新增/修改条目：沿用 C 节“模型体积命中判定”“明显粒子爆发命中反馈”条目，保持已完成状态。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client typecheck`：通过。
  - `pnpm exec eslint packages/web-client/src/game/UWebGameRuntime.ts packages/web-client/src/game/USceneBridge.ts packages/web-client/src/game/UWebGameRuntime.test.ts`：通过。
  - `pnpm --filter @fd/web-client test -- src/game/UWebGameRuntime.test.ts`：通过（39 项）。
  - `pnpm smoke:web`：通过（产物：`output/playwright/2026-03-02T03-25-31-066Z/`）。
- 是否新增 postmortem：`否`（未触发模板中的新增条件）。

- 问题描述：修复“物品目标选择时左右方向体感反向（按左选到屏幕右侧角色）”问题，要求恢复为直觉方向。
- 对应测试文件：`packages/web-client/src/game/UWebGameRuntime.test.ts`（新增三人队伍回归，覆盖物品阶段左右步进方向修正）。
- 新增/修改条目：C 节新增“物品目标左右体感方向修正”条目并置为已完成。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test -- src/game/UWebGameRuntime.test.ts -t "物品目标选择阶段应反转左右步进方向以匹配镜像机位体感"`：通过（1 项命中）。
  - `pnpm --filter @fd/web-client test -- src/game/USceneBridge.test.ts`：通过（4 项）。
- 是否新增 postmortem：`否`（未触发模板中的新增条件）。

- 问题描述：修复“物品目标选择左右切换时镜头硬切”体验问题，要求切换目标角色时 camera 使用与现有系统一致的 lerp 过渡。
- 对应测试文件：`packages/web-client/src/game/USceneBridge.test.ts`（新增 `ShouldBlendOnBattleTargetSwitch` 回归，覆盖 `PlayerItemPreview` 目标切换）。
- 新增/修改条目：C 节新增“物品目标切换镜头 lerp 过渡”条目并置为已完成。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test -- src/game/USceneBridge.test.ts`：先失败后通过（4 项）。
  - `pnpm --filter @fd/web-client test -- src/game/UWebGameRuntime.test.ts`：通过（34 项）。
- 是否新增 postmortem：`否`（未触发模板中的新增条件）。

- 问题描述：按玩法体验反馈调整“物品目标选择镜头”，最终要求为“保持 `PlayerItemPreview` 风格，但左右切换目标时镜头必须对到当前目标角色”。
- 对应测试文件：`packages/web-client/src/game/UWebGameRuntime.test.ts`（物品目标选择/执行阶段镜头断言为 `PlayerItemPreview`，并校验目标切换）。
- 新增/修改条目：C 节“物品流程镜头”条目统一为“`PlayerItemPreview` + 随左右切换对准目标”。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test -- src/game/UWebGameRuntime.test.ts -t "物品确认应进入我方目标选择，并在确认后记录占位行为|物品目标选择阶段应响应左右导航语义"`：通过（2 项命中）。
  - `pnpm --filter @fd/web-client test`：通过（71 项）。
- 是否新增 postmortem：`否`（需求调整，非线上故障）。

- 问题描述：修复“物品目标选择阶段看起来左右输入无效（缺少可见反馈）”；补充目标高亮反馈并验证键鼠/手柄导航语义都能驱动目标切换。
- 对应测试文件：`packages/web-client/src/game/UWebGameRuntime.test.ts`（新增“物品目标选择阶段应响应左右导航语义（键鼠与手柄）”回归）。
- 新增/修改条目：C 节新增“物品目标选择阶段响应左右导航 + 队伍卡高亮反馈”条目并置为已完成。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test -- src/game/UWebGameRuntime.test.ts src/input/UInputController.test.ts`：通过（54 项）。
  - `pnpm smoke:web`：通过（页面加载与基础输入链路正常；仅 `favicon.ico` 404，为历史非阻断项）。
- 是否新增 postmortem：`否`（未触发模板中的新增条件）。

- 问题描述：修复“物品选目标时镜头切到敌方特写导致视角突变不适”；同时移除物品目标阶段额外确认 HUD 面板，避免 UI 干扰。
- 对应测试文件：`packages/web-client/src/game/UWebGameRuntime.test.ts`（在“物品确认应进入我方目标选择，并在确认后记录占位行为”中新增机位断言，先失败后修复）。
- 新增/修改条目：C 节更新“物品目标选择行为”描述，并新增“物品流程镜头保持 `PlayerItemPreview`”条目（已完成）。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test -- src/game/UWebGameRuntime.test.ts -t "物品确认应进入我方目标选择，并在确认后记录占位行为"`：先失败后通过。
  - `pnpm --filter @fd/web-client test`：通过（70 项）。
  - `pnpm smoke:web`：通过（页面加载与基础输入链路正常；仅 `favicon.ico` 404，为历史非阻断项）。
- 是否新增 postmortem：`否`（未触发模板中的新增条件）。

- 问题描述：修复“目标选择特写镜头朝向受当前操控角色/战场中心影响，导致同一目标在不同上下文下构图漂移与遮挡”。
- 对应测试文件：`packages/web-client/src/game/USceneBridge.test.ts`（新增“目标特写方向不应受战场中心位置影响”回归）。
- 新增/修改条目：C 节将 `TargetSelect` 特写机位条目更新为“仅依赖固定角度参数 `TargetSelectYawDeg`”。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test -- src/game/USceneBridge.test.ts`：先失败后通过（3 项）。
  - `pnpm --filter @fd/web-client test -- src/debug/UDebugConfigStore.test.ts`：通过（4 项，含 `TargetSelectYawDeg` 参数钳制与保留）。
  - `pnpm smoke:web`：通过（页面可访问；仅 `favicon.ico` 404，为历史非阻断项）。
- 是否新增 postmortem：`否`（未触发“阻塞超过 2 小时 / 14 天内重复 / 导致错误玩法结论”条件）。

- 问题描述：修复“Debug 数值输入框被 slider 区间硬钳制，导致瞄准/预览机位参数无法录入历史值并出现显示回写异常”。
- 对应测试文件：`packages/web-client/src/debug/UDebugConfigStore.test.ts`（新增“机位参数不应被 slider 区间硬钳制”回归）。
- 新增/修改条目：C 节将 `PlayerAimDistanceCm` 相关条目更新为“允许超 slider 区间 + 安全边界钳制”。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test -- src/debug/UDebugConfigStore.test.ts`：先失败后通过（4 项）。
  - `pnpm --filter @fd/web-client test`：通过。
  - `pnpm lint`：通过。
- 是否新增 postmortem：`否`（未达到触发条件）。

- 问题描述：实现 Battle3C 指令层改造（技能/物品占位菜单、攻击与技能统一目标选择、新增虚拟 Socket 机位与返回层级规则）。
- 对应测试文件：
  - `packages/web-client/src/game/UWebGameRuntime.test.ts`（新增 8 条命令层回归）
  - `packages/web-client/src/input/UInputController.test.ts`
  - `packages/web-client/src/ui/UBattleHudVisibility.test.ts`
- 新增/修改条目：C 节新增 8 条自动化条目并置为已完成，更新浏览器自动化执行记录。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client test`：通过（37 项）
  - `pnpm lint`：通过
  - `pnpm smoke:web`：通过（页面加载、截图、console/network 采集）
- 是否新增 postmortem：`否`（功能迭代，非故障修复）

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

- 问题描述：修复“敌人只在头部附近可命中、命中反馈不明显”；根因一是瞄准悬停目标依赖头部屏幕阈值而非模型体积，根因二是命中特效规模/层次不足。
- 对应测试文件：
  - `packages/web-client/src/game/USceneBridge.test.ts`
  - `packages/web-client/src/game/UWebGameRuntime.test.ts`
- 新增/修改条目：C 节新增“模型体积命中判定”“明显粒子爆发命中反馈”并置为已完成。
- 验证命令与结果：
  - `pnpm --filter @fd/web-client typecheck`：通过。
  - `pnpm exec eslint packages/web-client/src/game/USceneBridge.ts`：通过。
  - `pnpm --filter @fd/web-client test -- src/game/USceneBridge.test.ts src/game/UWebGameRuntime.test.ts`：通过（43 项）。
  - `pnpm smoke:web`：通过（产物：`output/playwright/2026-03-02T03-19-29-540Z/`）。
- 是否新增 postmortem：`否`（未触发模板中的新增条件）。
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
