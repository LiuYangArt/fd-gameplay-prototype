import { describe, expect, it } from "vitest";

import { UWebGameRuntime } from "./UWebGameRuntime";

import type { FInputSnapshot } from "../input/FInputSnapshot";

interface FMutableRuntime {
  RuntimePhase: "Overworld" | "EncounterTransition" | "Battle3C" | "SettlementPreview";
  ActiveBattleSession: {
    SessionId: string;
    ControlledCharacterId: string;
    CameraMode:
      | "IntroPullOut"
      | "IntroDropIn"
      | "PlayerFollow"
      | "PlayerAim"
      | "SkillTargetZoom"
      | "EnemyAttackSingle"
      | "EnemyAttackAOE"
      | "Settlement";
    CrosshairScreenPosition: {
      X: number;
      Y: number;
    };
    IsAimMode: boolean;
    IsSkillTargetMode: boolean;
    SelectedTargetIndex: number;
    ScriptStepIndex: number;
    Units: Array<{
      UnitId: string;
      DisplayName: string;
      TeamId: "Player" | "Enemy";
      PositionCm: { X: number; Y: number; Z: number };
      YawDeg: number;
      IsAlive: boolean;
      IsEncounterPrimaryEnemy: boolean;
    }>;
    ScriptFocus: null;
  };
}

function CreateSnapshot(): FInputSnapshot {
  return {
    MoveAxis: { X: 0, Y: 0 },
    LookYawDeltaDegrees: 0,
    LookPitchDeltaDegrees: 0,
    AimScreenDelta: { X: 260, Y: -180 },
    AimScreenPosition: null,
    SprintHold: false,
    ToggleAimEdge: false,
    CancelAimEdge: false,
    FireEdge: false,
    SwitchCharacterEdge: false,
    ToggleSkillTargetModeEdge: false,
    CycleTargetAxis: 0,
    ForceSettlementEdge: false,
    ConfirmSettlementEdge: false,
    RestartEdge: false,
    ToggleDebugEdge: false,
    DeltaSeconds: 1 / 60
  };
}

describe("UWebGameRuntime", () => {
  it("战斗瞄准时应优先使用鼠标绝对屏幕坐标更新准星", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = {
      SessionId: "B3C_TEST",
      ControlledCharacterId: "P_YELLOW",
      CameraMode: "PlayerAim",
      CrosshairScreenPosition: { X: 0.5, Y: 0.5 },
      IsAimMode: true,
      IsSkillTargetMode: false,
      SelectedTargetIndex: 0,
      ScriptStepIndex: 0,
      Units: [
        {
          UnitId: "P_YELLOW",
          DisplayName: "Yellow",
          TeamId: "Player",
          PositionCm: { X: 0, Y: 0, Z: 0 },
          YawDeg: 0,
          IsAlive: true,
          IsEncounterPrimaryEnemy: false
        }
      ],
      ScriptFocus: null
    };

    Runtime.ConsumeInputSnapshot({
      ...CreateSnapshot(),
      AimScreenPosition: { X: 0.77, Y: 0.22 }
    });

    expect(Runtime.GetViewModel().Battle3CState.CrosshairScreenPosition).toEqual({
      X: 0.77,
      Y: 0.22
    });
  });

  it("瞄准状态收到取消输入后应退出瞄准并返回跟随镜头", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = {
      SessionId: "B3C_TEST_CANCEL_AIM",
      ControlledCharacterId: "P_YELLOW",
      CameraMode: "PlayerAim",
      CrosshairScreenPosition: { X: 0.5, Y: 0.5 },
      IsAimMode: true,
      IsSkillTargetMode: false,
      SelectedTargetIndex: 0,
      ScriptStepIndex: 0,
      Units: [
        {
          UnitId: "P_YELLOW",
          DisplayName: "Yellow",
          TeamId: "Player",
          PositionCm: { X: 0, Y: 0, Z: 0 },
          YawDeg: 0,
          IsAlive: true,
          IsEncounterPrimaryEnemy: false
        }
      ],
      ScriptFocus: null
    };

    Runtime.ConsumeInputSnapshot({
      ...CreateSnapshot(),
      CancelAimEdge: true
    });

    const Battle3CState = Runtime.GetViewModel().Battle3CState;
    expect(Battle3CState.IsAimMode).toBe(false);
    expect(Battle3CState.CameraMode).toBe("PlayerFollow");
  });
});
