import { Vector3 } from "@babylonjs/core";
import { describe, expect, it } from "vitest";

import {
  ResolveBattleUnitDisplayPositionCm,
  ResolveEnemyDeathFadeAlpha,
  ResolveEnemyDeathParticleAlpha,
  ResolveMeleeDamageCueImpactPositionCm,
  ResolveMeleeActionAttackerPositionCm,
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

describe("ResolveMeleeActionAttackerPositionCm", () => {
  it("前冲阶段应从起点平滑插值到接触点", () => {
    const Resolved = ResolveMeleeActionAttackerPositionCm(
      {
        ActionId: 1,
        AttackerUnitId: "char01",
        TargetUnitId: "enemy01",
        Phase: "Advance",
        RetreatStartAtMs: 0,
        RetreatEndAtMs: 100,
        DashStartAtMs: 100,
        DashEndAtMs: 300,
        ReturnStartAtMs: 450,
        ReturnEndAtMs: 650,
        StartPositionCm: { X: -220, Y: 0, Z: 0 },
        ContactPositionCm: { X: 180, Y: 0, Z: 0 }
      },
      "char01",
      200
    );

    expect(Resolved?.X).toBeCloseTo(-20, 2);
    expect(Resolved?.Y).toBe(0);
    expect(Resolved?.Z).toBe(0);
  });

  it("回位阶段应直接瞬移回起点，不做插值过渡", () => {
    const Resolved = ResolveMeleeActionAttackerPositionCm(
      {
        ActionId: 1,
        AttackerUnitId: "char01",
        TargetUnitId: "enemy01",
        Phase: "Return",
        RetreatStartAtMs: 0,
        RetreatEndAtMs: 100,
        DashStartAtMs: 100,
        DashEndAtMs: 300,
        ReturnStartAtMs: 450,
        ReturnEndAtMs: 650,
        StartPositionCm: { X: -220, Y: 0, Z: 0 },
        ContactPositionCm: { X: 180, Y: 0, Z: 0 }
      },
      "char01",
      550
    );

    expect(Resolved?.X).toBeCloseTo(-220, 2);
    expect(Resolved?.Y).toBe(0);
    expect(Resolved?.Z).toBe(0);
  });
});

describe("ResolveBattleUnitDisplayPositionCm", () => {
  it("近战前冲中应返回插值后的攻击者显示坐标（模型与占位体共用）", () => {
    const Resolved = ResolveBattleUnitDisplayPositionCm(
      {
        UnitId: "char01",
        PositionCm: { X: -220, Y: 0, Z: 0 }
      },
      {
        ActionId: 1,
        AttackerUnitId: "char01",
        TargetUnitId: "enemy01",
        Phase: "Advance",
        RetreatStartAtMs: 0,
        RetreatEndAtMs: 100,
        DashStartAtMs: 100,
        DashEndAtMs: 300,
        ReturnStartAtMs: 450,
        ReturnEndAtMs: 450,
        StartPositionCm: { X: -220, Y: 0, Z: 0 },
        ContactPositionCm: { X: 180, Y: 0, Z: 0 }
      },
      200
    );

    expect(Resolved.X).toBeCloseTo(-20, 2);
    expect(Resolved.Y).toBe(0);
    expect(Resolved.Z).toBe(0);
  });
});

describe("ResolveMeleeDamageCueImpactPositionCm", () => {
  it("仅近战伤害 Cue 且到达弹字时刻后才触发受击特效位置", () => {
    const Units = [
      {
        UnitId: "enemy01",
        PositionCm: { X: 280, Y: 0, Z: 0 }
      }
    ];
    const NotReadyBySource = ResolveMeleeDamageCueImpactPositionCm(
      {
        CueId: 2,
        SourceKind: "Shot",
        TargetUnitId: "enemy01",
        PopAtMs: 100
      },
      Units,
      null,
      120,
      0
    );
    expect(NotReadyBySource).toBeNull();

    const NotReadyByTime = ResolveMeleeDamageCueImpactPositionCm(
      {
        CueId: 2,
        SourceKind: "Melee",
        TargetUnitId: "enemy01",
        PopAtMs: 180
      },
      Units,
      null,
      120,
      0
    );
    expect(NotReadyByTime).toBeNull();

    const ReadyImpact = ResolveMeleeDamageCueImpactPositionCm(
      {
        CueId: 2,
        SourceKind: "Melee",
        TargetUnitId: "enemy01",
        PopAtMs: 100
      },
      Units,
      null,
      120,
      0
    );
    expect(ReadyImpact?.X).toBeCloseTo(280, 2);
    expect(ReadyImpact?.Y).toBe(0);
    expect(ReadyImpact?.Z).toBe(0);
  });

  it("已消费过的 Cue 不应重复触发受击特效", () => {
    const Impact = ResolveMeleeDamageCueImpactPositionCm(
      {
        CueId: 5,
        SourceKind: "Melee",
        TargetUnitId: "enemy01",
        PopAtMs: 100
      },
      [
        {
          UnitId: "enemy01",
          PositionCm: { X: 280, Y: 0, Z: 0 }
        }
      ],
      null,
      120,
      5
    );
    expect(Impact).toBeNull();
  });
});

describe("ResolveEnemyDeathFadeAlpha", () => {
  it("死亡渐隐应在持续时长内从 1 线性下降到 0", () => {
    expect(ResolveEnemyDeathFadeAlpha(0, 0.8)).toBeCloseTo(1, 6);
    expect(ResolveEnemyDeathFadeAlpha(0.4, 0.8)).toBeCloseTo(0.5, 6);
    expect(ResolveEnemyDeathFadeAlpha(0.8, 0.8)).toBeCloseTo(0, 6);
  });

  it("超过持续时长后透明度应维持在 0", () => {
    expect(ResolveEnemyDeathFadeAlpha(1.2, 0.8)).toBeCloseTo(0, 6);
  });
});

describe("ResolveEnemyDeathParticleAlpha", () => {
  it("延迟窗口内应保持高亮不透明，之后再淡出", () => {
    expect(ResolveEnemyDeathParticleAlpha(0.1, 0.3, 1.15)).toBeCloseTo(0.98, 6);
    expect(ResolveEnemyDeathParticleAlpha(0.3, 0.3, 1.15)).toBeCloseTo(0.98, 6);
    expect(ResolveEnemyDeathParticleAlpha(0.8, 0.3, 1.15)).toBeLessThan(0.6);
  });

  it("超过粒子生命周期后应完全消失", () => {
    expect(ResolveEnemyDeathParticleAlpha(1.2, 0.3, 1.15)).toBeCloseTo(0, 6);
  });
});
