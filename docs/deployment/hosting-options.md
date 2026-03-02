# 网页原型部署方案记录

更新时间：2026-03-02

## 当前决策

- 已启用 GitHub Pages 自动部署（`main` 分支触发）。
- 发布目标为 `packages/web-client` 构建产物，面向外部测试分发。
- 后续如需分支预览能力，优先考虑切换 Cloudflare Pages。

## 方案 A：Cloudflare Pages（推荐）

适用场景：高频迭代、需要频繁分享分支预览链接给测试者。

优点：

- Git 集成简单，推送后自动构建。
- 每个分支或 PR 可生成独立预览链接，方便 AB 对比测试。
- 可叠加 Cloudflare Access 做测试白名单。

限制（需在启用前复核官方文档）：

- 构建次数、单文件大小、总文件数存在套餐限制。

计划中的接入步骤：

1. 将 `packages/web-client` 设为构建入口。
2. 配置构建命令：`pnpm install --frozen-lockfile && pnpm --filter @fd/web-client build`。
3. 发布目录：`packages/web-client/dist`。
4. 打通 `main` 稳定地址 + 分支预览地址。

## 方案 B：GitHub Pages（备选）

适用场景：简单公开试玩页，或对预览能力要求较低。

优点：

- 与 GitHub 仓库深度集成，维护成本低。
- 适合轻量静态站点。

限制（需在启用前复核官方文档）：

- 站点体积、带宽、构建时长有约束。
- 分支预览体验通常不如 Cloudflare Pages 直接。

计划中的接入步骤：

1. 使用 GitHub Actions 构建 `web-client`。
2. 将 `dist` 发布到 Pages。
3. 通过分支/环境约定控制测试版本。

## 启用前检查清单

1. 资源体积检查：纹理/模型是否超出单文件阈值。
2. 回归验证：`pnpm verify` 全通过。
3. 版本标识：页面显示构建时间与提交短 SHA。
4. 反馈入口：页面内放置 issue 链接或问卷链接。
