# 输入/按钮接入规范（v1）

更新时间：2026-03-01
适用范围：`packages/web-client` 战斗主链与 HUD 按钮提示。

## 1. 目标

新增按钮时，必须同时满足：

1. 交互语义统一：先定义动作语义，再映射设备按键。
2. 设备同构：键鼠与手柄在行为上等价（仅提示样式不同）。
3. 视觉一致：按钮外观、键帽、ABXY 颜色规则一致。
4. 可迁移 UE：动作与提示可导出并映射到 Common UI ActionTag。

## 2. 强制规则

### 2.1 不允许直接硬编码物理按键行为

必须经由动作语义层：

- 动作枚举：`packages/web-client/src/input/EInputAction.ts`
- 输入帧：`packages/web-client/src/input/FInputActionFrame.ts`
- 默认映射：`packages/web-client/src/input/UInputBindingProfile.ts`

禁止在 `App.tsx` 或 Runtime 里直接写 `"KeyX" / "Tab" / button index` 做业务分支。

### 2.2 按钮提示必须走 Prompt Registry

必须通过：

- `packages/web-client/src/input/UInputPromptRegistry.ts`
- `packages/web-client/src/ui/components/UInputPromptBadge.tsx`

规则：

1. 有图标时仅渲染图标，不再重复显示文字（`UInputPromptBadge` 已实现）。
2. ABXY 颜色固定：A 绿、B 红、X 蓝、Y 黄。
3. 非 ABXY 使用中性配色。

### 2.3 按钮渲染必须走统一组件

必须使用：

- `UBattleActionButton.tsx`
- `UBattleCommandList.tsx`
- `UBattleGlobalActionBar.tsx`

禁止在业务 JSX 里散落临时按钮样式和按键提示拼接。

### 2.4 交互模型固定

1. `Direct`：按钮始终显示对应提示，可点击可按键触发。
2. `FocusedConfirm`：只有焦点项显示确认提示（A/Enter）。
3. `Cancel`（返回）统一放在左下角全局动作栏，不在列表内部重复放置。

### 2.5 样式底线

按钮/键帽遵循：

1. 单色底（无渐变）。
2. 无半透明。
3. 无描边。
4. 圆角与字号使用统一 token，不得单点硬编码。
5. Hover 仅做单色亮度变化，不做花哨动效。

## 3. 新增按钮标准流程（必须按顺序）

### Step 1：新增动作语义

在 `EInputAction.ts` 增加 ActionTag（命名建议：`Domain.Verb`）。

### Step 2：补默认映射

在 `UInputBindingProfile.ts` 增加键鼠/手柄映射；如为长按动作需设置 `HoldDurationMs`。

### Step 3：补提示映射

在 `UInputPromptRegistry.ts` 增加 KeyboardMouse 与 Gamepad 的 prompt token。

### Step 4：接入 Runtime 槽位

在 `UWebGameRuntime.ts` 的 `BuildInputHudState()` 中把动作接入：

1. `GlobalActionSlots`（左下角通用动作）
2. `ContextActionSlots`（右侧列表动作）

并明确 `TriggerType` 为 `Direct` 或 `FocusedConfirm`。

### Step 5：渲染接入

仅通过 `UBattleCommandList` / `UBattleGlobalActionBar` 渲染，不新增平行按钮通路。

### Step 6：导出资产同步（UE 对齐）

同步更新：

1. `docs/input/default-input-profile.v1.json`
2. `docs/input/common-ui-action-hints.v1.json`

## 4. 必测清单（新增按钮最小集）

至少覆盖以下测试：

1. `UInputController.test.ts`：动作映射正确，旧键位不会误触发。
2. `UInputPromptRegistry.test.ts`：设备提示与颜色规则正确。
3. `UWebGameRuntime.test.ts`：对应阶段可触发、可取消、状态切换正确。
4. `pnpm smoke:web`：页面真实交互路径可用（含设备切换）。

## 5. 合并前检查（PR Checklist）

- [ ] 动作语义已定义，未在 UI 里硬编码物理按键分支。
- [ ] 键鼠/手柄映射已同时补齐。
- [ ] Prompt 已通过 Registry 输出，不手工拼接提示文案。
- [ ] 按钮样式符合“单色、无透明、无描边、统一圆角/字号”。
- [ ] 返回动作位于左下角全局动作栏。
- [ ] 测试与 smoke 结果已附上。
- [ ] UE 对齐 JSON 已同步。

## 6. 常见反例（禁止）

1. 在 `App.tsx` 里直接 `if (key === "Tab")` 执行业务。
2. 新增一个“临时按钮样式 class”绕过统一组件。
3. 在某个阶段额外放一个“返回”按钮，导致返回入口分散。
4. 只改了键鼠，不改手柄（或反之）。
5. 只改运行时逻辑，不同步提示和导出 JSON。
