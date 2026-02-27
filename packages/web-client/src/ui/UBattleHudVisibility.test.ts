import { describe, expect, it } from "vitest";

import { ShouldShowBattleCornerActions } from "./UBattleHudVisibility";

describe("ShouldShowBattleCornerActions", () => {
  it("仅在 Battle3C 阶段显示左下角战斗操作 HUD", () => {
    expect(ShouldShowBattleCornerActions("Overworld")).toBe(false);
    expect(ShouldShowBattleCornerActions("EncounterTransition")).toBe(false);
    expect(ShouldShowBattleCornerActions("SettlementPreview")).toBe(false);
    expect(ShouldShowBattleCornerActions("Battle3C")).toBe(true);
  });
});
