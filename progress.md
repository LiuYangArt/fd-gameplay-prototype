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

## TODO

- 补浏览器手动冒烟（`docs/testing/regression-checklist.md` H 节 4 项未勾选）。
- 若要补自动化 UI 冒烟，需先在环境安装 `playwright` 后运行 `develop-web-game` 的脚本客户端。
