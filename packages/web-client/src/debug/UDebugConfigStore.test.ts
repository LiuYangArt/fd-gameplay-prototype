import { describe, expect, it } from "vitest";

import { UDebugConfigStore, type FDebugConfig } from "./UDebugConfigStore";

describe("UDebugConfigStore", () => {
  it("应提供三套战斗机位参数与执行阶段参数，并在 ApplyPatch 中生效", () => {
    const Store = new UDebugConfigStore();
    const DefaultConfig = Store.GetDefaultConfig();
    expect(DefaultConfig.PlayerAimDistanceCm).toBeTypeOf("number");
    expect(DefaultConfig.SkillPreviewDistanceCm).toBeTypeOf("number");
    expect(DefaultConfig.ItemPreviewDistanceCm).toBeTypeOf("number");
    expect(DefaultConfig.TargetSelectCloseupDistanceCm).toBeTypeOf("number");
    expect(DefaultConfig.ActionResolveDurationSec).toBeTypeOf("number");
    expect(DefaultConfig.OverworldInvertLookPitch).toBeTypeOf("boolean");
    expect(DefaultConfig.AimInvertLookPitch).toBeTypeOf("boolean");

    const NextConfig = Store.ApplyPatch(Store.GetDefaultConfig(), {
      SkillPreviewDistanceCm: 700,
      ItemPreviewLateralOffsetCm: 64,
      TargetSelectCloseupDistanceCm: 320,
      ActionResolveDurationSec: 0.8,
      OverworldInvertLookPitch: true,
      AimInvertLookPitch: false
    } satisfies Partial<FDebugConfig>);
    expect(NextConfig.SkillPreviewDistanceCm).toBe(700);
    expect(NextConfig.ItemPreviewLateralOffsetCm).toBe(64);
    expect(NextConfig.TargetSelectCloseupDistanceCm).toBe(320);
    expect(NextConfig.ActionResolveDurationSec).toBe(0.8);
    expect(NextConfig.OverworldInvertLookPitch).toBe(true);
    expect(NextConfig.AimInvertLookPitch).toBe(false);
  });

  it("ActionResolve 与 TargetSelect 参数应按安全边界钳制（不等同于 slider 区间）", () => {
    const Store = new UDebugConfigStore();
    const NextConfig = Store.ApplyPatch(Store.GetDefaultConfig(), {
      TargetSelectCloseupDistanceCm: 999999,
      TargetSelectLateralOffsetCm: -999999,
      ActionResolveDurationSec: 0,
      ActionResolveToastDurationSec: 999
    } satisfies Partial<FDebugConfig>);

    expect(NextConfig.TargetSelectCloseupDistanceCm).toBe(12000);
    expect(NextConfig.TargetSelectLateralOffsetCm).toBe(-12000);
    expect(NextConfig.ActionResolveDurationSec).toBe(0.01);
    expect(NextConfig.ActionResolveToastDurationSec).toBe(30);
  });

  it("导入旧配置 JSON 时应为新字段回填默认值", () => {
    const Store = new UDebugConfigStore();
    const Base = Store.GetDefaultConfig();
    const Imported = Store.ImportJson(
      JSON.stringify({
        PlayerAimDistanceCm: 512
      }),
      Base
    );

    expect(Imported.PlayerAimDistanceCm).toBe(512);
    expect(Imported.SkillPreviewDistanceCm).toBe(Base.SkillPreviewDistanceCm);
    expect(Imported.ItemPreviewDistanceCm).toBe(Base.ItemPreviewDistanceCm);
    expect(Imported.TargetSelectCloseupDistanceCm).toBe(Base.TargetSelectCloseupDistanceCm);
    expect(Imported.ActionResolveDurationSec).toBe(Base.ActionResolveDurationSec);
  });

  it("机位参数不应被 slider 区间硬钳制，允许数字输入框录入超范围值", () => {
    const Store = new UDebugConfigStore();
    const NextConfig = Store.ApplyPatch(Store.GetDefaultConfig(), {
      PlayerAimDistanceCm: 80,
      PlayerAimFocusOffsetUpCm: 1250,
      SkillPreviewDistanceCm: 4200,
      ItemPreviewLateralOffsetCm: -780,
      TargetSelectLateralOffsetCm: 460
    } satisfies Partial<FDebugConfig>);

    expect(NextConfig.PlayerAimDistanceCm).toBe(80);
    expect(NextConfig.PlayerAimFocusOffsetUpCm).toBe(1250);
    expect(NextConfig.SkillPreviewDistanceCm).toBe(4200);
    expect(NextConfig.ItemPreviewLateralOffsetCm).toBe(-780);
    expect(NextConfig.TargetSelectLateralOffsetCm).toBe(460);
  });
});
