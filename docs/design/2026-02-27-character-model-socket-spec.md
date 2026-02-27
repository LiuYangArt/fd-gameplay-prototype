# 角色模型与枪口挂点规范（Web 原型 / UE 迁移对齐）

## 目标

- 保持与 UE 资源朝向习惯一致，降低后续迁移成本。
- 在 Web 原型阶段使用最小约束即可完成模型替换与枪口发射点对齐。

## 资源格式

- 角色资源统一使用 `glb`。
- 每个角色一个主文件，后续按角色 ID 做映射。

## 角色根节点朝向约定（内容制作侧）

- UE 对齐目标：`Z Up`、`Y Forward`。
- Blender 制作时可按团队现有习惯使用等价关系（UE 的 `Y Forward` 对应 Blender 的 `-Y Forward`）。
- 导出前需应用变换（Apply Transform），保持缩放为 `1,1,1`。
- 角色原点建议放在脚底中心，便于站地和碰撞对齐。

## 枪口挂点（Socket）约定

- 不强制骨骼，可直接使用 `Empty` 作为挂点。
- 枪口挂点命名：`Socket_Muzzle`。
- 枪口挂点朝向：`Z Up`、`X Forward`。
- 子弹发射方向以该挂点本地 `+X` 方向为准。

## 运行时坐标转换约定（程序侧）

- 资源可按 UE 对齐朝向导出；运行时由程序做统一轴向修正到 Web 场景坐标系。
- 转换逻辑由场景适配层集中处理，避免散落在玩法逻辑层。

## 资源目录约定

- 模型统一放在：
  - `packages/web-client/public/assets/models/characters/`
- 示例：
  - `packages/web-client/public/assets/models/characters/P_YELLOW.glb`
  - `packages/web-client/public/assets/models/characters/P_RED.glb`

## 交付自检清单（美术导出前）

- 文件格式为 `glb`。
- 角色根节点朝向满足 UE 对齐约定。
- 存在 `Socket_Muzzle` 且位置在枪口。
- `Socket_Muzzle` 前向为本地 `+X`。
- 已应用变换，缩放为 `1,1,1`。
- 角色原点在脚底中心。
