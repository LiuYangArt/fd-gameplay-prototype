Original prompt: docs\plans\2026-02-26-overworld-encounter-to-battle-implementation-plan.md 按计划做完

## 2026-02-26

- 已读取 `.codebase_index.md` 与实施计划，确认当前实现仍为 Overworld/Battle 两阶段。
- 已完成输入语义层重构：新增 ToggleAim/Fire/SwitchCharacter/ToggleSkillTarget/CycleTarget/Settlement 语义边沿。
- 键鼠与手柄映射已按计划接入（Q/LT、LMB/RT/A、C/LB、Tab/RB、F12、Enter/A）。
- 已完成运行时状态机改造：新增 EncounterTransition/Battle3C/SettlementPreview 三阶段，形成四阶段闭环。
- 已完成 SceneBridge 与 App 重构：双我方+三敌方占位、八种机位、准星显示、Battle Debug Tab 参数编辑。
- 已升级 Debug 存储：V3 写入，兼容读取 V2 并自动迁移。
- 已完成验证：`pnpm lint` / `pnpm test` / `pnpm verify` 全部通过。
- 已更新 `docs/testing/regression-checklist.md`：新增 H 节记录 3C 链路检查项，并勾选自动化命令结果。

## 2026-02-27

- 已实现：进入瞄准时隐藏非操控中的我方角色（占位体与角色模型均隐藏）。
- 已实现：瞄准时角色朝向改为由准星 X 连续驱动，并按“当前存活敌人的最左/最右角度”做 clamp，移除悬停目标切换时的瞬时转向。
- 已实现：在 `PlayerFollow` 机位下切换操控角色（含“跳过回合”）触发相机平滑过渡（lerp/blend）。
- 已补回归测试：`UWebGameRuntime.test.ts` 新增准星驱动与 clamp 用例，并修正悬停目标测试断言。
- 已完成验证：`pnpm --filter @fd/web-client test`、`pnpm lint`、`pnpm verify` 通过。
- 已更新 `docs/testing/regression-checklist.md`：同步改写瞄准朝向自动化条目，并新增“瞄准隐藏队友/切角色镜头 lerp”手动冒烟项。

## 2026-02-28

- 已实现：进入瞄准时自动将默认目标重置为“当前角色前向最合适敌人”，减少不同角色瞄准初始机位差异。
- 已实现：`跳过回合/切角色` 与 `逃跑` 仅允许在待机状态（`Battle3C + PlayerFollow + 非瞄准 + 非目标模式 + 非脚本机位`）执行。
- 已实现：左下角“逃跑/跳过回合”HUD 可见性与上述待机态规则保持一致，瞄准中不再显示。
- 已补回归测试：`UWebGameRuntime.test.ts` 新增 3 条（瞄准禁切角色、瞄准禁逃跑、进入瞄准自动选前向目标）；`UBattleHudVisibility.test.ts` 新增 1 条状态约束。
- 已完成验证：`pnpm --filter @fd/web-client test`、`pnpm --filter @fd/web-client typecheck`、`pnpm lint`、`pnpm verify` 全通过。
- 已移除“瞄准与目标”组中 6 个参数的最小/最大值限制（`PlayerAimFovDeg`、`PlayerAimDistanceCm`、`PlayerAimShoulderOffsetCm`、`PlayerAimFocusOffsetRightCm`、`PlayerAimFocusOffsetUpCm`、`SkillTargetZoomDistanceCm`），并同步取消 `UDebugConfigStore` 对这 6 项的 clamp。
- 已按反馈调整为“滑条 + 标题旁数值输入框”双通道编辑；恢复滑条交互，并将上述 6 项扩展为大范围（Fov 1~179，其余 -50000~50000 cm）。
- 已按反馈二次调整：slider 恢复为常用范围（便于精调），数值输入框取消 `min/max` 限制并允许超范围值；当值超出 slider 区间时，滑条仅贴边显示，不覆盖输入值。

## TODO

- 补浏览器手动冒烟（`docs/testing/regression-checklist.md` H 节 4 项未勾选）。
- 若要补自动化 UI 冒烟，需先在环境安装 `playwright` 后运行 `develop-web-game` 的脚本客户端。
