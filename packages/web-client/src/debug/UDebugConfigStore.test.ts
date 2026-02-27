import { describe, expect, it } from "vitest";

import { UDebugConfigStore, type FDebugConfig } from "./UDebugConfigStore";

describe("UDebugConfigStore", () => {
  it("应提供瞄准镜头距离参数并在 ApplyPatch 中生效", () => {
    const Store = new UDebugConfigStore();
    const DefaultConfig = Store.GetDefaultConfig() as unknown as Record<string, number>;
    expect(DefaultConfig.PlayerAimDistanceCm).toBeTypeOf("number");

    const NextConfig = Store.ApplyPatch(Store.GetDefaultConfig(), {
      PlayerAimDistanceCm: 40
    } satisfies Partial<FDebugConfig>) as unknown as Record<string, number>;
    expect(NextConfig.PlayerAimDistanceCm).toBe(120);
  });
});
