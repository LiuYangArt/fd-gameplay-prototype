# GitHub Pages 子路径资源前缀回归复盘

## 1. 基本信息

- 日期：2026-03-02
- 负责人：Codex / LiuYangArt
- 影响范围：`packages/web-client`（角色模型加载、手柄提示图标）
- 严重级别：`S2`
- 状态：`已验证`

## 2. 现象与影响

- 用户/测试者看到的现象：GitHub Pages 线上页中玩家角色保持 capsule 占位体，未加载 GLB；部分手柄提示图标不显示。
- 首次发现时间：2026-03-02 09:40（UTC+8）
- 复现条件：站点部署在 `https://liuyangart.github.io/fd-gameplay-prototype/` 子路径，资源路径仍使用 `/assets/...` 根路径绝对地址。
- 业务影响（阻塞测试、误导结论、数据污染等）：外部测试对“角色模型接入”结论失真，影响对可玩版本完成度判断。

## 3. 时间线

1. `09:40` 收到线上反馈“角色仍是 capsule”
2. `09:43` 完成 URL 探针定位（`/assets/...` 返回 404，`/fd-gameplay-prototype/assets/...` 返回 200）
3. `09:44` 完成回归测试补充并实施修复
4. `09:50` 完成测试与部署验证

## 4. 根因分析

- 直接根因：模型路径与手柄图标路径硬编码为 `/assets/...`，在 GitHub Pages 子路径部署时请求被发到域名根目录而非仓库子目录。
- 深层根因（流程、设计、测试、工具）：缺少“子路径部署”专项回归，默认在本地根路径环境验证，未覆盖真实发布路径差异。
- 为什么之前的防线没有拦住：原有单测仅校验提示内容和行为，不校验资源路径前缀；部署后也缺少 URL 探针检查。

## 5. 修复方案

- 临时止血：无（直接进行永久修复）。
- 永久修复：
  - `UDebugConfigStore` 默认模型路径改为相对 `assets/...`。
  - 增加路径归一化：自动将历史配置中的 `/assets/...` 转换为 `assets/...`，兼容旧本地存档。
  - `UInputPromptRegistry` 手柄图标基路径改为相对路径。
- 关联代码变更：
  - `packages/web-client/src/debug/UDebugConfigStore.ts`
  - `packages/web-client/src/debug/UDebugConfigStore.test.ts`
  - `packages/web-client/src/input/UInputPromptRegistry.ts`
  - `packages/web-client/src/input/UInputPromptRegistry.test.ts`
  - `docs/testing/regression-checklist.md`
- 风险与回滚方案：
  - 风险：若用户配置了真正需要根路径的自定义资源地址，会被归一化规则影响。
  - 回滚：撤销 `NormalizePublicAssetPath` 逻辑并恢复原默认路径；同时在 Pages 场景下改为运行时拼接基路径。

## 6. 防再发动作（必须可执行）

1. 新增或补强的回归测试：

- 文件路径：
  - `packages/web-client/src/debug/UDebugConfigStore.test.ts`
  - `packages/web-client/src/input/UInputPromptRegistry.test.ts`
- 覆盖场景：
  - 模型默认路径与导入路径均不应以 `/` 起始。
  - 手柄图标资源路径不应以 `/` 起始。

2. 新增或补强的规则/流程：

- lint/test/checklist/hook 的变更：
  - 回归清单新增“GitHub Pages 子路径部署资源路径可解析”条目并置为已完成。
- 执行责任人：LiuYangArt
- 截止时间：已完成（2026-03-02）

## 7. 验证记录

- 本地验证命令：
  - `pnpm --filter @fd/web-client test -- src/debug/UDebugConfigStore.test.ts`
  - `pnpm --filter @fd/web-client test -- src/input/UInputPromptRegistry.test.ts`
  - `pnpm --filter @fd/web-client test`
  - `pnpm smoke:web`
- 验证结果：通过；线上资源探针 `https://liuyangart.github.io/fd-gameplay-prototype/assets/models/characters/SM_Char01.glb` 返回 `200`。
- 复测人：Codex / LiuYangArt

## 8. 经验沉淀

- 本次事件给 vibe-coding 的规则更新：发布到子路径平台（GitHub Pages）时，禁止在前端代码中新增 `/assets/...` 根路径常量。
- 是否需要更新 `AGENTS.md`：`否`
- 是否需要更新 `docs/testing/regression-checklist.md`：`是`（已更新）
