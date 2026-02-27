# Battle 瞄准镜头与转向硬切问题复盘

## 1. 基本信息

- 日期：2026-02-27
- 负责人：Codex / LiuYang
- 影响范围：`packages/web-client` 战斗 3C（瞄准、准星、镜头、角色朝向）
- 严重级别：`S2`
- 状态：`已验证`

## 2. 现象与影响

- 用户/测试者看到的现象：
  - 瞄准时准星偶发被战斗按钮遮挡。
  - `PlayerFollow <-> PlayerAim` 切换为硬切，观感突兀。
  - 悬停切换目标时角色朝向瞬间跳变，枪口与弹道观感不自然。
- 首次发现时间：2026-02-27（晚间联调）
- 复现条件：
  - 进入 `Battle3C`，按 `Q/LT` 反复进出瞄准。
  - 瞄准状态下在多个敌人间移动鼠标准星。
  - 准星与 HUD 区域重叠时观察层级。
- 业务影响（阻塞测试、误导结论、数据污染等）：
  - 阻塞镜头参数调优与构图验收。
  - 误导“瞄准机位参数不生效”的判断。
  - 降低战斗交互可用性与演示质量。

## 3. 时间线

1. `23:40` 发现问题（用户联调反馈）
2. `23:55` 完成定位（样式层级 + Scene 机位/旋转应用路径）
3. `00:20` 完成修复（准星层级、镜头 blend、朝向平滑）
4. `00:25` 完成回归验证（test/typecheck/lint/verify）

## 4. 根因分析

- 直接根因：
  - `.Crosshair` 未设置高于战斗按钮的 `z-index`。
  - 战斗镜头应用函数 `ApplyArcCameraFromPosition` 直接 `setTarget/setPosition`，在模式切换时必然硬切。
  - 角色朝向（占位体和模型）每帧直接写入目标 `Yaw`，无插值过渡。
- 深层根因（流程、设计、测试、工具）：
  - Camera Mode 切换未定义过渡策略，只有“目标机位计算”没有“应用层状态机”。
  - 关键观感路径缺少手动冒烟条目，导致问题直到联调阶段才暴露。
- 为什么之前的防线没有拦住：
  - 现有自动化测试覆盖逻辑正确性，未覆盖 Scene 动画平滑与层级表现。

## 5. 修复方案

- 临时止血：
  - 将 `.Crosshair` 提升到 HUD 之上，立即解除遮挡。
- 永久修复：
  - 战斗镜头改为“先求目标姿态，再统一应用姿态”，并对 `PlayerFollow <-> PlayerAim` 增加时长型平滑过渡。
  - 角色朝向改为最短角度插值，统一作用于占位体与角色模型。
- 关联代码变更：
  - `packages/web-client/src/styles.css`
  - `packages/web-client/src/game/USceneBridge.ts`
  - `docs/testing/regression-checklist.md`
- 风险与回滚方案：
  - 风险：过渡速度参数不合适可能出现“拖泥带水”。
  - 回滚：将 `AimCameraBlendDurationSec` 设为 `0` 或恢复旧版直接赋值逻辑；保留本次提交可整体回退。

## 6. 防再发动作（必须可执行）

1. 新增或补强的回归测试：

- 文件路径：`docs/testing/regression-checklist.md`
- 覆盖场景：
  - 瞄准准星层级高于按钮。
  - Follow/Aim 机位切换为平滑过渡。
  - 瞄准目标切换时角色转向平滑。

2. 新增或补强的规则/流程：

- lint/test/checklist/hook 的变更：
  - 在回归清单 C 节新增 3 条手动冒烟项，作为战斗镜头改动的必测项。
- 执行责任人：LiuYang
- 截止时间：后续所有战斗镜头改动合并前持续执行

## 7. 验证记录

- 本地验证命令：
  - `pnpm --filter @fd/web-client test`
  - `pnpm --filter @fd/web-client typecheck`
  - `pnpm lint`
  - `pnpm verify`
- 验证结果：全部通过
- 复测人：Codex / LiuYang

## 8. 经验沉淀

- 本次事件给 vibe-coding 的规则更新：
  - 涉及镜头模式切换时，必须显式设计“模式切换过渡层”，禁止仅做目标机位硬切。
  - 涉及角色朝向实时更新时，默认要求视觉层做插值平滑。
- 是否需要更新 `AGENTS.md`：否
- 是否需要更新 `docs/testing/regression-checklist.md`：是（已更新）
