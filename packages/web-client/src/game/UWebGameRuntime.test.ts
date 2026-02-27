import { describe, expect, it } from "vitest";

import { UWebGameRuntime } from "./UWebGameRuntime";

import type { FInputSnapshot } from "../input/FInputSnapshot";

interface FMutableRuntime {
  RuntimePhase: "Overworld" | "EncounterTransition" | "Battle3C" | "SettlementPreview";
  EncounterPromptText: string | null;
  ActiveEncounterContext: {
    EncounterId: string;
    EncounterEnemyId: string;
    PlayerTeamId: string;
    EnemyTeamId: string;
    PlayerPosition: { X: number; Z: number };
    EnemyPosition: { X: number; Z: number };
    BattleAnchorCm: { X: number; Y: number; Z: number };
    TriggeredAtMs: number;
  } | null;
  ActiveBattleSession: {
    SessionId: string;
    PlayerTeamId: string;
    EnemyTeamId: string;
    PlayerActiveUnitIds: string[];
    EnemyActiveUnitIds: string[];
    ControlledCharacterId: string;
    CameraMode:
      | "IntroPullOut"
      | "IntroDropIn"
      | "PlayerFollow"
      | "PlayerAim"
      | "SkillTargetZoom"
      | "EnemyAttackSingle"
      | "EnemyAttackAOE"
      | "SettlementCam";
    CrosshairScreenPosition: {
      X: number;
      Y: number;
    };
    IsAimMode: boolean;
    IsSkillTargetMode: boolean;
    AimCameraYawDeg: number | null;
    SelectedTargetIndex: number;
    AimHoverTargetId: string | null;
    ScriptStepIndex: number;
    ShotSequence: number;
    LastShot: {
      ShotId: number;
      AttackerUnitId: string;
      TargetUnitId: string;
    } | null;
    Units: Array<{
      UnitId: string;
      DisplayName: string;
      TeamId: "Player" | "Enemy";
      ModelAssetPath: string | null;
      PositionCm: { X: number; Y: number; Z: number };
      YawDeg: number;
      MaxHp: number;
      CurrentHp: number;
      MaxMp: number;
      CurrentMp: number;
      IsAlive: boolean;
      IsEncounterPrimaryEnemy: boolean;
    }>;
    ScriptFocus: null;
  } | null;
  StartEncounterTransition: (EncounterId: string) => void;
}

interface FBattleUnitSeed {
  UnitId: string;
  DisplayName: string;
  TeamId: "Player" | "Enemy";
  ModelAssetPath: string | null;
  PositionCm: { X: number; Y: number; Z: number };
  YawDeg: number;
  MaxHp: number;
  CurrentHp: number;
  MaxMp: number;
  CurrentMp: number;
  IsAlive: boolean;
  IsEncounterPrimaryEnemy: boolean;
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

function CreateBattleUnit(Override: Partial<FBattleUnitSeed>) {
  return {
    UnitId: "char01",
    DisplayName: "char01",
    TeamId: "Player" as const,
    ModelAssetPath: "/assets/models/characters/SM_Char01.glb",
    PositionCm: { X: 0, Y: 0, Z: 0 },
    YawDeg: 90,
    MaxHp: 100,
    CurrentHp: 100,
    MaxMp: 40,
    CurrentMp: 40,
    IsAlive: true,
    IsEncounterPrimaryEnemy: false,
    ...Override
  };
}

describe("UWebGameRuntime", () => {
  it("战斗瞄准时应优先使用鼠标绝对屏幕坐标更新准星", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = {
      SessionId: "B3C_TEST",
      PlayerTeamId: "TEAM_PLAYER_01",
      EnemyTeamId: "TEAM_ENEMY_01",
      PlayerActiveUnitIds: ["char01"],
      EnemyActiveUnitIds: ["enemy01"],
      ControlledCharacterId: "char01",
      CameraMode: "PlayerAim",
      CrosshairScreenPosition: { X: 0.5, Y: 0.5 },
      IsAimMode: true,
      IsSkillTargetMode: false,
      AimCameraYawDeg: 90,
      SelectedTargetIndex: 0,
      AimHoverTargetId: null,
      ScriptStepIndex: 0,
      ShotSequence: 0,
      LastShot: null,
      Units: [CreateBattleUnit({ UnitId: "char01" })],
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
      PlayerTeamId: "TEAM_PLAYER_01",
      EnemyTeamId: "TEAM_ENEMY_01",
      PlayerActiveUnitIds: ["char01"],
      EnemyActiveUnitIds: ["enemy01"],
      ControlledCharacterId: "char01",
      CameraMode: "PlayerAim",
      CrosshairScreenPosition: { X: 0.5, Y: 0.5 },
      IsAimMode: true,
      IsSkillTargetMode: false,
      AimCameraYawDeg: 90,
      SelectedTargetIndex: 0,
      AimHoverTargetId: null,
      ScriptStepIndex: 0,
      ShotSequence: 0,
      LastShot: null,
      Units: [CreateBattleUnit({ UnitId: "char01" })],
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

  it("切换角色应在上阵且存活成员中循环并跳过死亡成员", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = {
      SessionId: "B3C_SWITCH_LOOP",
      PlayerTeamId: "TEAM_PLAYER_01",
      EnemyTeamId: "TEAM_ENEMY_01",
      PlayerActiveUnitIds: ["char01", "char02", "char03"],
      EnemyActiveUnitIds: ["enemy01"],
      ControlledCharacterId: "char01",
      CameraMode: "PlayerFollow",
      CrosshairScreenPosition: { X: 0.5, Y: 0.5 },
      IsAimMode: false,
      IsSkillTargetMode: false,
      AimCameraYawDeg: null,
      SelectedTargetIndex: 0,
      AimHoverTargetId: null,
      ScriptStepIndex: 0,
      ShotSequence: 0,
      LastShot: null,
      Units: [
        CreateBattleUnit({ UnitId: "char01", IsAlive: true }),
        CreateBattleUnit({ UnitId: "char02", IsAlive: false }),
        CreateBattleUnit({ UnitId: "char03", IsAlive: true }),
        CreateBattleUnit({
          UnitId: "enemy01",
          TeamId: "Enemy",
          DisplayName: "enemy01",
          IsEncounterPrimaryEnemy: true
        })
      ],
      ScriptFocus: null
    };

    Runtime.SwitchControlledCharacter();
    expect(Runtime.GetViewModel().Battle3CState.ControlledCharacterId).toBe("char03");

    Runtime.SwitchControlledCharacter();
    expect(Runtime.GetViewModel().Battle3CState.ControlledCharacterId).toBe("char01");
  });

  it("瞄准悬停目标应仅更新 HoveredTargetId，不改当前选中目标", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = {
      SessionId: "B3C_AIM_HOVER_TARGET",
      PlayerTeamId: "TEAM_PLAYER_01",
      EnemyTeamId: "TEAM_ENEMY_01",
      PlayerActiveUnitIds: ["char01"],
      EnemyActiveUnitIds: ["enemy01", "enemy02"],
      ControlledCharacterId: "char01",
      CameraMode: "PlayerAim",
      CrosshairScreenPosition: { X: 0.5, Y: 0.5 },
      IsAimMode: true,
      IsSkillTargetMode: false,
      AimCameraYawDeg: 90,
      SelectedTargetIndex: 0,
      AimHoverTargetId: null,
      ScriptStepIndex: 0,
      ShotSequence: 0,
      LastShot: null,
      Units: [
        CreateBattleUnit({
          UnitId: "char01",
          TeamId: "Player",
          PositionCm: { X: -220, Y: 0, Z: 0 },
          YawDeg: 90
        }),
        CreateBattleUnit({
          UnitId: "enemy01",
          TeamId: "Enemy",
          DisplayName: "enemy01",
          PositionCm: { X: 280, Y: 0, Z: -120 }
        }),
        CreateBattleUnit({
          UnitId: "enemy02",
          TeamId: "Enemy",
          DisplayName: "enemy02",
          PositionCm: { X: 280, Y: 0, Z: 120 }
        })
      ],
      ScriptFocus: null
    };

    Runtime.SetBattleAimHoverTarget("enemy02");

    const Battle3CState = Runtime.GetViewModel().Battle3CState;
    expect(Battle3CState.HoveredTargetId).toBe("enemy02");
    expect(Battle3CState.SelectedTargetId).toBe("enemy01");
    expect(Battle3CState.AimCameraYawDeg).toBe(90);
    const Controlled = Battle3CState.Units.find((Unit) => Unit.UnitId === "char01");
    expect(Controlled?.YawDeg).toBeCloseTo(76.5, 0);
  });

  it("退出瞄准后应恢复待机朝向，且再次进入瞄准保持稳定机位基准", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = {
      SessionId: "B3C_AIM_RETURN_FACING",
      PlayerTeamId: "TEAM_PLAYER_01",
      EnemyTeamId: "TEAM_ENEMY_01",
      PlayerActiveUnitIds: ["char01"],
      EnemyActiveUnitIds: ["enemy01", "enemy02"],
      ControlledCharacterId: "char01",
      CameraMode: "PlayerFollow",
      CrosshairScreenPosition: { X: 0.5, Y: 0.5 },
      IsAimMode: false,
      IsSkillTargetMode: false,
      AimCameraYawDeg: null,
      SelectedTargetIndex: 0,
      AimHoverTargetId: null,
      ScriptStepIndex: 0,
      ShotSequence: 0,
      LastShot: null,
      Units: [
        CreateBattleUnit({
          UnitId: "char01",
          TeamId: "Player",
          PositionCm: { X: -220, Y: 0, Z: 0 },
          YawDeg: 90
        }),
        CreateBattleUnit({
          UnitId: "enemy01",
          TeamId: "Enemy",
          DisplayName: "enemy01",
          PositionCm: { X: 280, Y: 0, Z: -120 }
        }),
        CreateBattleUnit({
          UnitId: "enemy02",
          TeamId: "Enemy",
          DisplayName: "enemy02",
          PositionCm: { X: 280, Y: 0, Z: 120 }
        })
      ],
      ScriptFocus: null
    };

    Runtime.ToggleBattleAim();
    Runtime.SetBattleAimHoverTarget("enemy02");
    Runtime.ExitBattleAimMode();

    const AfterExitState = Runtime.GetViewModel().Battle3CState;
    const ControlledAfterExit = AfterExitState.Units.find((Unit) => Unit.UnitId === "char01");
    expect(AfterExitState.CameraMode).toBe("PlayerFollow");
    expect(AfterExitState.AimCameraYawDeg).toBeNull();
    expect(ControlledAfterExit?.YawDeg).toBe(90);

    Runtime.ToggleBattleAim();
    const AfterReAimState = Runtime.GetViewModel().Battle3CState;
    expect(AfterReAimState.CameraMode).toBe("PlayerAim");
    expect(AfterReAimState.AimCameraYawDeg).toBe(90);
  });

  it("战斗开火时应生成可视化 Shot 事件", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = {
      SessionId: "B3C_SHOT_EVENT",
      PlayerTeamId: "TEAM_PLAYER_01",
      EnemyTeamId: "TEAM_ENEMY_01",
      PlayerActiveUnitIds: ["char01"],
      EnemyActiveUnitIds: ["enemy01"],
      ControlledCharacterId: "char01",
      CameraMode: "PlayerAim",
      CrosshairScreenPosition: { X: 0.5, Y: 0.5 },
      IsAimMode: true,
      IsSkillTargetMode: false,
      AimCameraYawDeg: 90,
      SelectedTargetIndex: 0,
      AimHoverTargetId: "enemy01",
      ScriptStepIndex: 0,
      ShotSequence: 0,
      LastShot: null,
      Units: [
        CreateBattleUnit({ UnitId: "char01", TeamId: "Player" }),
        CreateBattleUnit({
          UnitId: "enemy01",
          TeamId: "Enemy",
          DisplayName: "enemy01",
          IsEncounterPrimaryEnemy: true
        })
      ],
      ScriptFocus: null
    };

    Runtime.FireBattleAction();

    const LastShot = Runtime.GetViewModel().Battle3CState.LastShot;
    expect(LastShot).not.toBeNull();
    expect(LastShot?.AttackerUnitId).toBe("char01");
    expect(LastShot?.TargetUnitId).toBe("enemy01");
    expect(Runtime.GetViewModel().Battle3CState.CameraMode).toBe("PlayerAim");
  });

  it("遭遇上下文非法时应阻断创建战斗会话", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Overworld";
    MutableRuntime.ActiveEncounterContext = {
      EncounterId: "ENC_BLOCK_001",
      EncounterEnemyId: "OW_ENEMY_01",
      PlayerTeamId: "TEAM_NOT_EXISTS",
      EnemyTeamId: "TEAM_ENEMY_01",
      PlayerPosition: { X: 0, Z: 0 },
      EnemyPosition: { X: 100, Z: 100 },
      BattleAnchorCm: { X: 0, Y: 0, Z: 0 },
      TriggeredAtMs: Date.now()
    };
    MutableRuntime.ActiveBattleSession = null;

    MutableRuntime.StartEncounterTransition("ENC_BLOCK_001");

    expect(MutableRuntime.RuntimePhase).toBe("Overworld");
    expect(MutableRuntime.ActiveBattleSession).toBeNull();
    expect(MutableRuntime.EncounterPromptText).toContain("阻断");
  });
});
