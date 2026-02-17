# fd-gameplay-prototype

一个用于快速验证回合制玩法的 TypeScript 网页原型工程。

## 目标

- 快速开发、快速迭代、快速发链接测试
- 保持 UE5 风格命名和模块拆分，降低后续迁移成本
- 核心玩法使用事件驱动，避免逻辑依赖 Tick

## 目录

- `packages/gameplay-core`：纯玩法逻辑（可迁移）
- `packages/web-client`：网页端可玩原型（3D + UI + 输入）
- `packages/ue-bridge`：未来对接 puerts 的适配层
- `docs/deployment`：部署方案记录（暂不启用）

## 快速开始

```bash
pnpm install
pnpm dev
```

## 开发脚本（Win / Mac）

- macOS/Linux 菜单模式：`bash scripts/dev.sh`
- macOS/Linux 一键启动开发服务器：`bash scripts/dev.sh dev`
- Windows 菜单模式：`powershell -ExecutionPolicy Bypass -File .\\scripts\\dev.ps1`
- Windows 一键启动开发服务器：`powershell -ExecutionPolicy Bypass -File .\\scripts\\dev.ps1 dev`
- Windows 双击入口：`scripts\\dev.cmd`

## 验证命令

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm verify
```
