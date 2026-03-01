import { Vector3 } from "@babylonjs/core";
import { describe, expect, it } from "vitest";

import {
  ResolveTargetSelectBasisForwardFromPositions,
  ShouldBlendOnBattleTargetSwitch
} from "./USceneBridge";

describe("ResolveTargetSelectBasisForwardFromPositions", () => {
  it("目标特写方向不应受战场中心位置影响", () => {
    const SelectedPos = new Vector3(3, 0, 0);
    const ControlledPos = new Vector3(-2, 0, 0);
    const LeftBattleCenter = new Vector3(-10, 0, 0);
    const RightBattleCenter = new Vector3(10, 0, 0);

    const BasisFromLeftCenter = ResolveTargetSelectBasisForwardFromPositions(
      SelectedPos,
      ControlledPos,
      LeftBattleCenter
    );
    const BasisFromRightCenter = ResolveTargetSelectBasisForwardFromPositions(
      SelectedPos,
      ControlledPos,
      RightBattleCenter
    );

    expect(BasisFromLeftCenter.x).toBeCloseTo(BasisFromRightCenter.x, 6);
    expect(BasisFromLeftCenter.z).toBeCloseTo(BasisFromRightCenter.z, 6);
  });

  it("目标特写方向不应受当前操控角色位置影响", () => {
    const SelectedPos = new Vector3(3, 0, 0);
    const BattleCenter = new Vector3(0, 0, 0);
    const LeftControlledPos = new Vector3(-2, 0, 0);
    const RightControlledPos = new Vector3(2, 0, 2);

    const BasisFromLeftControlled = ResolveTargetSelectBasisForwardFromPositions(
      SelectedPos,
      LeftControlledPos,
      BattleCenter
    );
    const BasisFromRightControlled = ResolveTargetSelectBasisForwardFromPositions(
      SelectedPos,
      RightControlledPos,
      BattleCenter
    );

    expect(BasisFromLeftControlled.x).toBeCloseTo(BasisFromRightControlled.x, 6);
    expect(BasisFromLeftControlled.z).toBeCloseTo(BasisFromRightControlled.z, 6);
  });

  it("目标特写方向应由固定角度参数控制", () => {
    const SelectedPos = new Vector3(3, 0, 0);
    const ControlledPos = new Vector3(-2, 0, 0);
    const BattleCenter = new Vector3(0, 0, 0);

    const BasisForward = ResolveTargetSelectBasisForwardFromPositions(
      SelectedPos,
      ControlledPos,
      BattleCenter,
      180
    );
    const DiagonalForward = ResolveTargetSelectBasisForwardFromPositions(
      SelectedPos,
      ControlledPos,
      BattleCenter,
      150
    );

    expect(BasisForward.x).toBeCloseTo(-1, 6);
    expect(BasisForward.z).toBeCloseTo(0, 6);
    expect(DiagonalForward.x).toBeLessThan(0);
    expect(DiagonalForward.z).toBeGreaterThan(0);
  });
});

describe("ShouldBlendOnBattleTargetSwitch", () => {
  it("在 PlayerItemPreview 切换目标时应触发镜头混合", () => {
    const ShouldBlend = ShouldBlendOnBattleTargetSwitch({
      IsModeChanged: false,
      CameraMode: "PlayerItemPreview",
      PreviousSelectedTargetId: "char01",
      CurrentSelectedTargetId: "char02"
    });
    expect(ShouldBlend).toBe(true);
  });
});
