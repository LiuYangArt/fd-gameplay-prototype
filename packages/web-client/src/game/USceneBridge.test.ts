import { Vector3 } from "@babylonjs/core";
import { describe, expect, it } from "vitest";

import { ResolveTargetSelectBasisForwardFromPositions } from "./USceneBridge";

describe("ResolveTargetSelectBasisForwardFromPositions", () => {
  it("目标特写方向应朝向我方（确保我方 -> 相机 -> 敌人）", () => {
    const SelectedPos = new Vector3(3, 0, 0);
    const ControlledPos = new Vector3(-2, 0, 0);
    const BattleCenter = new Vector3(0, 0, 0);

    const BasisForward = ResolveTargetSelectBasisForwardFromPositions(
      SelectedPos,
      ControlledPos,
      BattleCenter
    );
    const CameraPos = SelectedPos.add(BasisForward.scale(1.2));

    expect(BasisForward.x).toBeLessThan(0);
    expect(CameraPos.x).toBeLessThan(SelectedPos.x);
  });
});
