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

## TODO

- 补浏览器手动冒烟（`docs/testing/regression-checklist.md` H 节 4 项未勾选）。
- 若要补自动化 UI 冒烟，需先在环境安装 `playwright` 后运行 `develop-web-game` 的脚本客户端。
