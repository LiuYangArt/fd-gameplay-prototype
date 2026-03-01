# 1. 基本信息

- 日期：2026-03-01
- 负责人：LiuYang / Codex
- 影响范围：`packages/web-client` 战斗目标选择阶段（攻击/技能选敌、道具选己方）
- 严重级别：`S3`
- 状态：`已验证`

# 2. 现象与影响

- 用户/测试者看到的现象：
  - 目标选择阶段左下角缺少“左右切换/确认目标”提示，操作可发现性差。
  - 键盘 `F` 不能确认目标，提示与期望不一致。
  - 道具目标选择阶段曾出现“按左选到屏幕右侧角色”的反直觉行为。
- 首次发现时间：2026-03-01 约 22:30
- 复现条件：
  - 进入 Battle3C，执行“攻击/技能/道具”并进入目标选择阶段。
- 业务影响（阻塞测试、误导结论、数据污染等）：
  - 阻碍输入可用性验证，容易误判目标选择链路是否失效。
  - 对镜头与输入体验结论产生偏差风险。

# 3. 时间线

1. `22:30` 用户反馈目标选择交互体验问题（提示缺失、方向体感反向）
2. `22:45` 完成输入映射、HUD 槽位与镜头体感问题定位
3. `23:05` 完成修复与代码整理（含 `F/A` 确认、左下角提示、方向修正）
4. `23:10` 完成回归验证（`web-client test` / `smoke:web` / `verify`）

# 4. 根因分析

- 直接根因：
  - `TargetSelect` 阶段左下角全局动作槽未声明“左/右/确认目标”动作。
  - `UIConfirm` 的键盘绑定仅覆盖 `Enter`，缺少 `KeyF`。
  - 道具目标选择使用镜像机位时，目标索引步进方向未做体感修正。
- 深层根因（流程、设计、测试、工具）：
  - 目标选择阶段缺少“HUD 提示、输入映射、运行时动作”三层一致性约束。
  - 回归测试此前覆盖了可用性，但未覆盖“左下角提示完整性 + 体感方向”。
- 为什么之前的防线没有拦住：
  - 自动化测试更偏功能可达，未把“交互直觉一致性”作为明确断言项。

# 5. 修复方案

- 临时止血：
  - 在 `TargetSelect` 阶段补充左下角全局槽位：`左目标/右目标/确认目标/返回`。
- 永久修复：
  - 新增 `KeyF -> UIConfirm`，保持手柄 `A` 不变。
  - 统一提示文案为 `F / Enter / 手柄 A`。
  - 在道具目标选择阶段修正左右步进方向，保证“左键选屏幕左侧，右键选屏幕右侧”。
- 关联代码变更：
  - `packages/web-client/src/game/UWebGameRuntime.ts`
  - `packages/web-client/src/App.tsx`
  - `packages/web-client/src/input/UInputBindingProfile.ts`
  - `packages/web-client/src/input/UInputController.ts`
  - `packages/web-client/src/input/UInputPromptRegistry.ts`
- 风险与回滚方案：
  - 风险：全局动作槽新增 `UIConfirm` 需避免在非目标阶段误触发。
  - 回滚：仅回退本次 `TargetSelect` 槽位注入与 `KeyF` 绑定改动即可恢复旧行为。

# 6. 防再发动作（必须可执行）

1. 新增或补强的回归测试：

- 文件路径：
  - `packages/web-client/src/game/UWebGameRuntime.test.ts`
  - `packages/web-client/src/input/UInputController.test.ts`
  - `packages/web-client/src/input/UInputPromptRegistry.test.ts`
- 覆盖场景：
  - 目标选择阶段左下角必须出现“左/右/确认目标”动作槽。
  - 键盘 `F` 与 `Enter` 均能触发确认边沿。
  - 键鼠确认提示文案固定为 `F`，手柄保持 `A`。

2. 新增或补强的规则/流程：

- lint/test/checklist/hook 的变更：
  - `docs/testing/regression-checklist.md` 新增“目标选择阶段左下角提示 + F/A 确认”条目。
- 执行责任人：LiuYang / Codex
- 截止时间：已完成（2026-03-01）

# 7. 验证记录

- 本地验证命令：
  - `pnpm --filter @fd/web-client test -- src/game/UWebGameRuntime.test.ts -t "攻击/技能选敌与道具选己方目标阶段，左下角应提供左右切换与确认目标提示"`
  - `pnpm --filter @fd/web-client test -- src/input/UInputController.test.ts src/input/UInputPromptRegistry.test.ts`
  - `pnpm --filter @fd/web-client test`
  - `pnpm smoke:web`
  - `pnpm verify`
- 验证结果：全部通过（仅历史 `favicon.ico` 404，非阻断）
- 复测人：Codex（自动化）/ LiuYang（体验确认）

# 8. 经验沉淀

- 本次事件给 vibe-coding 的规则更新：
  - 目标选择功能上线时，必须同时检查三件事：输入映射、左下角提示、镜头体感方向。
  - “能操作”不等于“体验正确”，回归要增加可感知交互断言。
- 是否需要更新 `AGENTS.md`：`否`
- 是否需要更新 `docs/testing/regression-checklist.md`：`是`（已更新）
