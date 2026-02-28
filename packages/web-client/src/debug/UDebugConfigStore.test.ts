import { describe, expect, it } from "vitest";

import { UDebugConfigStore, type FDebugConfig } from "./UDebugConfigStore";

describe("UDebugConfigStore", () => {
  it("应提供瞄准 CameraSocket 参数与独立俯仰反转开关，并在 ApplyPatch 中生效", () => {
    const Store = new UDebugConfigStore();
    const DefaultConfig = Store.GetDefaultConfig();
    expect(DefaultConfig.PlayerAimDistanceCm).toBeTypeOf("number");
    expect(DefaultConfig.PlayerAimSocketUpCm).toBeTypeOf("number");
    expect(DefaultConfig.PlayerAimLookForwardDistanceCm).toBeTypeOf("number");
    expect(DefaultConfig.OverworldInvertLookPitch).toBeTypeOf("boolean");
    expect(DefaultConfig.AimInvertLookPitch).toBeTypeOf("boolean");

    const NextConfig = Store.ApplyPatch(Store.GetDefaultConfig(), {
      PlayerAimDistanceCm: 40,
      PlayerAimSocketUpCm: 60,
      PlayerAimLookForwardDistanceCm: 880,
      OverworldInvertLookPitch: true,
      AimInvertLookPitch: false
    } satisfies Partial<FDebugConfig>);
    expect(NextConfig.PlayerAimDistanceCm).toBe(40);
    expect(NextConfig.PlayerAimSocketUpCm).toBe(60);
    expect(NextConfig.PlayerAimLookForwardDistanceCm).toBe(880);
    expect(NextConfig.OverworldInvertLookPitch).toBe(true);
    expect(NextConfig.AimInvertLookPitch).toBe(false);
  });
});
