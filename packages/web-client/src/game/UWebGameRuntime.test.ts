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
      | "PlayerSkillPreview"
      | "PlayerItemPreview"
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
    CommandStage?: "Root" | "SkillMenu" | "ItemMenu" | "TargetSelect";
    PendingActionKind?: "Attack" | "Skill" | null;
    AimCameraYawDeg: number | null;
    AimCameraPitchDeg?: number | null;
    SelectedTargetIndex: number;
    AimHoverTargetId: string | null;
    SkillOptions?: Array<{ OptionId: string; DisplayName: string }>;
    ItemOptions?: Array<{ OptionId: string; DisplayName: string }>;
    SelectedSkillOptionIndex?: number;
    SelectedItemOptionIndex?: number;
    SelectedSkillOptionId?: string | null;
    ScriptStepIndex: number;
    ShotSequence: number;
    LastShot: {
      ShotId: number;
      AttackerUnitId: string;
      TargetUnitId: string | null;
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
    ToggleItemMenuEdge: false,
    CycleTargetAxis: 0,
    CycleMenuAxis: 0,
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

type FBattleSessionState = NonNullable<FMutableRuntime["ActiveBattleSession"]>;

function CreateBattleSession(Override: Partial<FBattleSessionState> = {}): FBattleSessionState {
  const DefaultUnits = [
    CreateBattleUnit({
      UnitId: "char01",
      TeamId: "Player",
      PositionCm: { X: -220, Y: 0, Z: 0 },
      YawDeg: 90
    }),
    CreateBattleUnit({
      UnitId: "char02",
      TeamId: "Player",
      PositionCm: { X: -220, Y: 0, Z: -120 },
      YawDeg: 90
    }),
    CreateBattleUnit({
      UnitId: "enemy01",
      TeamId: "Enemy",
      DisplayName: "enemy01",
      PositionCm: { X: 280, Y: 0, Z: -120 },
      IsEncounterPrimaryEnemy: true
    }),
    CreateBattleUnit({
      UnitId: "enemy02",
      TeamId: "Enemy",
      DisplayName: "enemy02",
      PositionCm: { X: 280, Y: 0, Z: 120 }
    })
  ];
  const Units = Override.Units ?? DefaultUnits;
  const DefaultSession: FBattleSessionState = {
    SessionId: "B3C_TEST_SESSION",
    PlayerTeamId: "TEAM_PLAYER_01",
    EnemyTeamId: "TEAM_ENEMY_01",
    PlayerActiveUnitIds: ["char01", "char02"],
    EnemyActiveUnitIds: ["enemy01", "enemy02"],
    ControlledCharacterId: "char01",
    CameraMode: "PlayerFollow",
    CrosshairScreenPosition: { X: 0.5, Y: 0.5 },
    IsAimMode: false,
    IsSkillTargetMode: false,
    CommandStage: "Root",
    PendingActionKind: null,
    AimCameraYawDeg: null,
    AimCameraPitchDeg: null,
    SelectedTargetIndex: 0,
    AimHoverTargetId: null,
    SkillOptions: [
      { OptionId: "skill01", DisplayName: "技能1" },
      { OptionId: "skill02", DisplayName: "技能2" }
    ],
    ItemOptions: [
      { OptionId: "item01", DisplayName: "物品1" },
      { OptionId: "item02", DisplayName: "物品2" }
    ],
    SelectedSkillOptionIndex: 0,
    SelectedItemOptionIndex: 0,
    SelectedSkillOptionId: null,
    ScriptStepIndex: 0,
    ShotSequence: 0,
    LastShot: null,
    Units,
    ScriptFocus: null
  };
  return {
    ...DefaultSession,
    ...Override,
    Units: Override.Units ?? DefaultSession.Units,
    PlayerActiveUnitIds: Override.PlayerActiveUnitIds ?? DefaultSession.PlayerActiveUnitIds,
    EnemyActiveUnitIds: Override.EnemyActiveUnitIds ?? DefaultSession.EnemyActiveUnitIds
  };
}

describe("UWebGameRuntime", () => {
  it("进入瞄准时若当前朝向在敌人扇区外，应先对齐中轴避免左右极限体感异常", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = {
      SessionId: "B3C_AIM_ENTER_ALIGN_CENTER_AXIS",
      PlayerTeamId: "TEAM_PLAYER_01",
      EnemyTeamId: "TEAM_ENEMY_01",
      PlayerActiveUnitIds: ["char01"],
      EnemyActiveUnitIds: ["enemy01", "enemy02", "enemy03"],
      ControlledCharacterId: "char01",
      CameraMode: "PlayerFollow",
      CrosshairScreenPosition: { X: 0.5, Y: 0.5 },
      IsAimMode: false,
      IsSkillTargetMode: false,
      AimCameraYawDeg: null,
      AimCameraPitchDeg: null,
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
          YawDeg: -120
        }),
        CreateBattleUnit({
          UnitId: "enemy01",
          TeamId: "Enemy",
          DisplayName: "enemy01",
          PositionCm: { X: 280, Y: 0, Z: -160 }
        }),
        CreateBattleUnit({
          UnitId: "enemy02",
          TeamId: "Enemy",
          DisplayName: "enemy02",
          PositionCm: { X: 280, Y: 0, Z: 0 }
        }),
        CreateBattleUnit({
          UnitId: "enemy03",
          TeamId: "Enemy",
          DisplayName: "enemy03",
          PositionCm: { X: 280, Y: 0, Z: 160 }
        })
      ],
      ScriptFocus: null
    };

    Runtime.ToggleBattleAim();
    const YawAfterEnterAim =
      Runtime.GetViewModel().Battle3CState.Units.find((Unit) => Unit.UnitId === "char01")?.YawDeg ??
      0;
    expect(YawAfterEnterAim).toBeCloseTo(90, 0);
    expect(Runtime.GetViewModel().Battle3CState.AimCameraYawDeg).toBeCloseTo(90, 0);

    Runtime.ConsumeInputSnapshot({
      ...CreateSnapshot(),
      LookYawDeltaDegrees: -120
    });
    const YawAfterLeft =
      Runtime.GetViewModel().Battle3CState.Units.find((Unit) => Unit.UnitId === "char01")?.YawDeg ??
      0;

    Runtime.ConsumeInputSnapshot({
      ...CreateSnapshot(),
      LookYawDeltaDegrees: 200
    });
    Runtime.ConsumeInputSnapshot({
      ...CreateSnapshot(),
      LookYawDeltaDegrees: -200
    });
    const YawAfterRightThenLeft =
      Runtime.GetViewModel().Battle3CState.Units.find((Unit) => Unit.UnitId === "char01")?.YawDeg ??
      0;

    expect(YawAfterLeft).toBeCloseTo(5, 0);
    expect(YawAfterRightThenLeft).toBeCloseTo(5, 0);
  });

  it("进入瞄准时若当前朝向在扇区内但偏离中轴，仍应先对齐中轴保证左右手感一致", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = {
      SessionId: "B3C_AIM_ENTER_ALIGN_CENTER_AXIS_INSIDE_FAN",
      PlayerTeamId: "TEAM_PLAYER_01",
      EnemyTeamId: "TEAM_ENEMY_01",
      PlayerActiveUnitIds: ["char01"],
      EnemyActiveUnitIds: ["enemy01", "enemy02", "enemy03"],
      ControlledCharacterId: "char01",
      CameraMode: "PlayerFollow",
      CrosshairScreenPosition: { X: 0.5, Y: 0.5 },
      IsAimMode: false,
      IsSkillTargetMode: false,
      AimCameraYawDeg: null,
      AimCameraPitchDeg: null,
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
          YawDeg: 40
        }),
        CreateBattleUnit({
          UnitId: "enemy01",
          TeamId: "Enemy",
          DisplayName: "enemy01",
          PositionCm: { X: 280, Y: 0, Z: -160 }
        }),
        CreateBattleUnit({
          UnitId: "enemy02",
          TeamId: "Enemy",
          DisplayName: "enemy02",
          PositionCm: { X: 280, Y: 0, Z: 0 }
        }),
        CreateBattleUnit({
          UnitId: "enemy03",
          TeamId: "Enemy",
          DisplayName: "enemy03",
          PositionCm: { X: 280, Y: 0, Z: 160 }
        })
      ],
      ScriptFocus: null
    };

    Runtime.ToggleBattleAim();
    const YawAfterEnterAim =
      Runtime.GetViewModel().Battle3CState.Units.find((Unit) => Unit.UnitId === "char01")?.YawDeg ??
      0;
    expect(YawAfterEnterAim).toBeCloseTo(90, 0);
    expect(Runtime.GetViewModel().Battle3CState.AimCameraYawDeg).toBeCloseTo(90, 0);
  });

  it("Overworld 与瞄准俯仰方向应可独立反转开关控制", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;

    Runtime.ApplyDebugConfig({
      OverworldInvertLookPitch: true,
      AimInvertLookPitch: false
    });
    Runtime.ConsumeInputSnapshot({
      ...CreateSnapshot(),
      LookPitchDeltaDegrees: 10
    });
    expect(Runtime.GetViewModel().DebugState.Config.CameraPitch).toBe(12);

    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = {
      SessionId: "B3C_SPLIT_OVERWORLD_AIM_PITCH",
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
      AimCameraPitchDeg: 0,
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
          PositionCm: { X: 280, Y: 0, Z: 0 }
        })
      ],
      ScriptFocus: null
    };

    Runtime.ConsumeInputSnapshot({
      ...CreateSnapshot(),
      LookPitchDeltaDegrees: 10
    });
    expect(Runtime.GetViewModel().Battle3CState.AimCameraPitchDeg).toBe(10);

    Runtime.ApplyDebugConfig({ AimInvertLookPitch: true });
    Runtime.ConsumeInputSnapshot({
      ...CreateSnapshot(),
      LookPitchDeltaDegrees: 10
    });
    expect(Runtime.GetViewModel().Battle3CState.AimCameraPitchDeg).toBe(0);
  });

  it("战斗瞄准时准星应保持在中心，不受绝对屏幕坐标影响", () => {
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
      X: 0.5,
      Y: 0.5
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

  it("瞄准状态下不允许切换角色（跳过回合）", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = {
      SessionId: "B3C_BLOCK_SWITCH_IN_AIM",
      PlayerTeamId: "TEAM_PLAYER_01",
      EnemyTeamId: "TEAM_ENEMY_01",
      PlayerActiveUnitIds: ["char01", "char03"],
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
      Units: [
        CreateBattleUnit({ UnitId: "char01", TeamId: "Player", IsAlive: true }),
        CreateBattleUnit({ UnitId: "char03", TeamId: "Player", IsAlive: true }),
        CreateBattleUnit({ UnitId: "enemy01", TeamId: "Enemy", DisplayName: "enemy01" })
      ],
      ScriptFocus: null
    };

    Runtime.SwitchControlledCharacter();

    expect(Runtime.GetViewModel().Battle3CState.ControlledCharacterId).toBe("char01");
  });

  it("瞄准悬停目标应仅更新 HoveredTargetId，不改当前选中目标与角色朝向", () => {
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
    expect(Controlled?.YawDeg).toBe(90);
  });

  it("瞄准时应由 LookYawDelta 驱动角色与相机朝向同步", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = {
      SessionId: "B3C_AIM_CURSOR_CLAMP_YAW",
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

    Runtime.ConsumeInputSnapshot({
      ...CreateSnapshot(),
      LookYawDeltaDegrees: 12
    });
    const Controlled = Runtime.GetViewModel().Battle3CState.Units.find(
      (Unit) => Unit.UnitId === "char01"
    );
    expect(Controlled?.YawDeg).toBeCloseTo(102, 0);
    expect(Runtime.GetViewModel().Battle3CState.AimCameraYawDeg).toBeCloseTo(102, 0);
  });

  it("瞄准时应允许上下抬枪，仅相机俯仰变化且角色 yaw 不变", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    Runtime.ApplyDebugConfig({ AimInvertLookPitch: false });
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = {
      SessionId: "B3C_AIM_PITCH_ONLY",
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
      AimCameraPitchDeg: 0,
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
          PositionCm: { X: 280, Y: 0, Z: 0 }
        })
      ],
      ScriptFocus: null
    };

    Runtime.ConsumeInputSnapshot({
      ...CreateSnapshot(),
      LookPitchDeltaDegrees: 24
    });
    expect(Runtime.GetViewModel().Battle3CState.AimCameraPitchDeg).toBe(24);
    expect(
      Runtime.GetViewModel().Battle3CState.Units.find((Unit) => Unit.UnitId === "char01")?.YawDeg
    ).toBe(90);

    Runtime.ConsumeInputSnapshot({
      ...CreateSnapshot(),
      LookPitchDeltaDegrees: -120
    });
    expect(Runtime.GetViewModel().Battle3CState.AimCameraPitchDeg).toBe(-20);
    expect(
      Runtime.GetViewModel().Battle3CState.Units.find((Unit) => Unit.UnitId === "char01")?.YawDeg
    ).toBe(90);
  });

  it("瞄准旋转应限制在敌人中轴扇区内，避免切角色后边缘敌人瞄不到", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = {
      SessionId: "B3C_AIM_ENEMY_CENTER_FAN_LIMIT",
      PlayerTeamId: "TEAM_PLAYER_01",
      EnemyTeamId: "TEAM_ENEMY_01",
      PlayerActiveUnitIds: ["char01"],
      EnemyActiveUnitIds: ["enemy01", "enemy02", "enemy03"],
      ControlledCharacterId: "char01",
      CameraMode: "PlayerAim",
      CrosshairScreenPosition: { X: 0.5, Y: 0.5 },
      IsAimMode: true,
      IsSkillTargetMode: false,
      AimCameraYawDeg: -90,
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
          YawDeg: -90
        }),
        CreateBattleUnit({
          UnitId: "enemy01",
          TeamId: "Enemy",
          DisplayName: "enemy01",
          PositionCm: { X: 280, Y: 0, Z: -160 }
        }),
        CreateBattleUnit({
          UnitId: "enemy02",
          TeamId: "Enemy",
          DisplayName: "enemy02",
          PositionCm: { X: 280, Y: 0, Z: 0 }
        }),
        CreateBattleUnit({
          UnitId: "enemy03",
          TeamId: "Enemy",
          DisplayName: "enemy03",
          PositionCm: { X: 280, Y: 0, Z: 160 }
        })
      ],
      ScriptFocus: null
    };

    Runtime.ConsumeInputSnapshot({
      ...CreateSnapshot(),
      LookYawDeltaDegrees: 300
    });
    const YawAfterFirstTurn =
      Runtime.GetViewModel().Battle3CState.Units.find((Unit) => Unit.UnitId === "char01")?.YawDeg ??
      0;

    Runtime.ConsumeInputSnapshot({
      ...CreateSnapshot(),
      LookYawDeltaDegrees: -600
    });
    const YawAfterReverseTurn =
      Runtime.GetViewModel().Battle3CState.Units.find((Unit) => Unit.UnitId === "char01")?.YawDeg ??
      0;

    expect(YawAfterFirstTurn).toBeCloseTo(175, 0);
    expect(YawAfterReverseTurn).toBeCloseTo(5, 0);
  });

  it("瞄准开火在无悬停目标时应允许 miss 并保留角色朝向", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = {
      SessionId: "B3C_AIM_FIRE_ALLOW_MISS",
      PlayerTeamId: "TEAM_PLAYER_01",
      EnemyTeamId: "TEAM_ENEMY_01",
      PlayerActiveUnitIds: ["char01"],
      EnemyActiveUnitIds: ["enemy01", "enemy02"],
      ControlledCharacterId: "char01",
      CameraMode: "PlayerAim",
      CrosshairScreenPosition: { X: 0.5, Y: 0.5 },
      IsAimMode: true,
      IsSkillTargetMode: false,
      AimCameraYawDeg: 76,
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
          YawDeg: 76
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

    Runtime.FireBattleAction();

    expect(Runtime.GetViewModel().Battle3CState.LastShot).not.toBeNull();
    expect(Runtime.GetViewModel().Battle3CState.LastShot?.TargetUnitId).toBeNull();
    expect(
      Runtime.GetViewModel().Battle3CState.Units.find((Unit) => Unit.UnitId === "char01")?.YawDeg
    ).toBe(76);
  });

  it("瞄准开火命中悬停目标时不应把角色朝向 snap 到目标方向", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = {
      SessionId: "B3C_AIM_FIRE_HOVER_NO_SNAP",
      PlayerTeamId: "TEAM_PLAYER_01",
      EnemyTeamId: "TEAM_ENEMY_01",
      PlayerActiveUnitIds: ["char01"],
      EnemyActiveUnitIds: ["enemy01", "enemy02"],
      ControlledCharacterId: "char01",
      CameraMode: "PlayerAim",
      CrosshairScreenPosition: { X: 0.5, Y: 0.5 },
      IsAimMode: true,
      IsSkillTargetMode: false,
      AimCameraYawDeg: 118,
      SelectedTargetIndex: 0,
      AimHoverTargetId: "enemy01",
      ScriptStepIndex: 0,
      ShotSequence: 0,
      LastShot: null,
      Units: [
        CreateBattleUnit({
          UnitId: "char01",
          TeamId: "Player",
          PositionCm: { X: -220, Y: 0, Z: 0 },
          YawDeg: 118
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

    Runtime.FireBattleAction();

    expect(Runtime.GetViewModel().Battle3CState.LastShot?.TargetUnitId).toBe("enemy01");
    expect(
      Runtime.GetViewModel().Battle3CState.Units.find((Unit) => Unit.UnitId === "char01")?.YawDeg
    ).toBe(118);
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

  it("进入瞄准时应按当前角色前向自动选择默认目标，减少机位差异", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = {
      SessionId: "B3C_AIM_SELECT_FORWARD_TARGET",
      PlayerTeamId: "TEAM_PLAYER_01",
      EnemyTeamId: "TEAM_ENEMY_01",
      PlayerActiveUnitIds: ["char01"],
      EnemyActiveUnitIds: ["enemy01", "enemy02", "enemy03"],
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
          PositionCm: { X: -220, Y: 0, Z: 200 },
          YawDeg: 90
        }),
        CreateBattleUnit({
          UnitId: "enemy01",
          TeamId: "Enemy",
          DisplayName: "enemy01",
          PositionCm: { X: 280, Y: 0, Z: -240 }
        }),
        CreateBattleUnit({
          UnitId: "enemy02",
          TeamId: "Enemy",
          DisplayName: "enemy02",
          PositionCm: { X: 280, Y: 0, Z: 0 }
        }),
        CreateBattleUnit({
          UnitId: "enemy03",
          TeamId: "Enemy",
          DisplayName: "enemy03",
          PositionCm: { X: 280, Y: 0, Z: 240 }
        })
      ],
      ScriptFocus: null
    };

    Runtime.ToggleBattleAim();

    const Battle3CState = Runtime.GetViewModel().Battle3CState;
    expect(Battle3CState.SelectedTargetId).toBe("enemy03");
  });

  it("瞄准状态下不允许逃跑，待机状态才允许", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = {
      SessionId: "B3C_BLOCK_FLEE_IN_AIM",
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
      Units: [
        CreateBattleUnit({ UnitId: "char01", TeamId: "Player" }),
        CreateBattleUnit({ UnitId: "enemy01", TeamId: "Enemy", DisplayName: "enemy01" })
      ],
      ScriptFocus: null
    };

    const IsFleeInAimSucceeded = Runtime.FleeBattleToOverworld();
    expect(IsFleeInAimSucceeded).toBe(false);
    expect(Runtime.GetViewModel().RuntimePhase).toBe("Battle3C");

    MutableRuntime.ActiveBattleSession.IsAimMode = false;
    MutableRuntime.ActiveBattleSession.CameraMode = "PlayerFollow";
    const IsFleeInIdleSucceeded = Runtime.FleeBattleToOverworld();
    expect(IsFleeInIdleSucceeded).toBe(true);
    expect(Runtime.GetViewModel().RuntimePhase).toBe("Overworld");
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

  it("攻击指令应先进入统一目标选择，不立即开火", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession();

    Runtime.FireBattleAction();

    const State = Runtime.GetViewModel().Battle3CState;
    expect(State.CommandStage).toBe("TargetSelect");
    expect(State.PendingActionKind).toBe("Attack");
    expect(State.CameraMode).toBe("SkillTargetZoom");
    expect(State.LastShot).toBeNull();
  });

  it("技能菜单与物品菜单应切到对应虚拟 Socket 机位", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession();

    Runtime.ToggleBattleSkillTargetMode();
    expect(Runtime.GetViewModel().Battle3CState.CommandStage).toBe("SkillMenu");
    expect(Runtime.GetViewModel().Battle3CState.CameraMode).toBe("PlayerSkillPreview");

    Runtime.ToggleBattleSkillTargetMode();
    Runtime.ToggleBattleItemMenu();
    expect(Runtime.GetViewModel().Battle3CState.CommandStage).toBe("ItemMenu");
    expect(Runtime.GetViewModel().Battle3CState.CameraMode).toBe("PlayerItemPreview");
  });

  it("技能确认应进入目标选择，取消后返回技能菜单", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession();

    Runtime.ToggleBattleSkillTargetMode();
    Runtime.CycleBattleMenuSelection(1);
    Runtime.FireBattleAction();

    const TargetSelectState = Runtime.GetViewModel().Battle3CState;
    expect(TargetSelectState.CommandStage).toBe("TargetSelect");
    expect(TargetSelectState.PendingActionKind).toBe("Skill");
    expect(TargetSelectState.SelectedSkillOptionId).toBe("skill02");
    expect(TargetSelectState.CameraMode).toBe("SkillTargetZoom");

    Runtime.ConsumeInputSnapshot({
      ...CreateSnapshot(),
      CancelAimEdge: true
    });
    const BackToSkillMenuState = Runtime.GetViewModel().Battle3CState;
    expect(BackToSkillMenuState.CommandStage).toBe("SkillMenu");
    expect(BackToSkillMenuState.PendingActionKind).toBeNull();
    expect(BackToSkillMenuState.CameraMode).toBe("PlayerSkillPreview");
  });

  it("攻击来源目标选择取消后应回到根命令层", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession();

    Runtime.FireBattleAction();
    Runtime.ConsumeInputSnapshot({
      ...CreateSnapshot(),
      CancelAimEdge: true
    });

    const State = Runtime.GetViewModel().Battle3CState;
    expect(State.CommandStage).toBe("Root");
    expect(State.PendingActionKind).toBeNull();
    expect(State.CameraMode).toBe("PlayerFollow");
  });

  it("目标选择左右切换并确认后，应产出 Shot 并推进敌方脚本机位", () => {
    const WindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
      value: {
        setTimeout: globalThis.setTimeout.bind(globalThis),
        clearTimeout: globalThis.clearTimeout.bind(globalThis),
        localStorage: {
          getItem: () => null,
          setItem: () => undefined,
          removeItem: () => undefined
        }
      },
      configurable: true
    });

    try {
      const Runtime = new UWebGameRuntime();
      const MutableRuntime = Runtime as unknown as FMutableRuntime;
      MutableRuntime.RuntimePhase = "Battle3C";
      MutableRuntime.ActiveBattleSession = CreateBattleSession();

      Runtime.FireBattleAction();
      Runtime.CycleBattleTarget(1);
      expect(Runtime.GetViewModel().Battle3CState.SelectedTargetId).toBe("enemy02");

      Runtime.FireBattleAction();
      const State = Runtime.GetViewModel().Battle3CState;
      expect(State.CommandStage).toBe("Root");
      expect(State.PendingActionKind).toBeNull();
      expect(State.LastShot?.TargetUnitId).toBe("enemy02");
      expect(State.ScriptStepIndex).toBe(1);
      expect(State.CameraMode).toBe("EnemyAttackSingle");
    } finally {
      if (WindowDescriptor) {
        Object.defineProperty(globalThis, "window", WindowDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "window");
      }
    }
  });

  it("物品确认仅记录占位行为并返回 Root，不进入目标选择", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession();

    Runtime.ToggleBattleItemMenu();
    Runtime.CycleBattleMenuSelection(1);
    Runtime.FireBattleAction();

    const State = Runtime.GetViewModel().Battle3CState;
    expect(State.CommandStage).toBe("Root");
    expect(State.PendingActionKind).toBeNull();
    expect(State.LastShot).toBeNull();
    expect(
      Runtime.GetViewModel().EventLogs.some((Log) => Log.includes("UseItemPlaceholder:item02"))
    ).toBe(true);
  });

  it("菜单态与目标态下应禁用切角色和逃跑", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession();

    Runtime.ToggleBattleSkillTargetMode();
    expect(Runtime.SwitchControlledCharacter()).toBe(false);
    expect(Runtime.FleeBattleToOverworld()).toBe(false);
    expect(Runtime.GetViewModel().Battle3CState.ControlledCharacterId).toBe("char01");
    expect(Runtime.GetViewModel().RuntimePhase).toBe("Battle3C");

    Runtime.ToggleBattleSkillTargetMode();
    Runtime.FireBattleAction();
    expect(Runtime.SwitchControlledCharacter()).toBe(false);
    expect(Runtime.FleeBattleToOverworld()).toBe(false);
    expect(Runtime.GetViewModel().Battle3CState.CommandStage).toBe("TargetSelect");
  });

  it("无存活敌人时，攻击和技能确认都不应进入目标选择", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession({
      EnemyActiveUnitIds: ["enemy01", "enemy02"],
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
          IsAlive: false
        }),
        CreateBattleUnit({
          UnitId: "enemy02",
          TeamId: "Enemy",
          DisplayName: "enemy02",
          IsAlive: false
        })
      ]
    });

    Runtime.FireBattleAction();
    expect(Runtime.GetViewModel().Battle3CState.CommandStage).toBe("Root");
    expect(
      Runtime.GetViewModel().EventLogs.some((Log) => Log.includes("TargetSelect:NoEnemy"))
    ).toBe(true);

    Runtime.ToggleBattleSkillTargetMode();
    Runtime.FireBattleAction();
    expect(Runtime.GetViewModel().Battle3CState.CommandStage).toBe("SkillMenu");
    expect(
      Runtime.GetViewModel().EventLogs.some((Log) => Log.includes("TargetSelect:SkillNoEnemy"))
    ).toBe(true);
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
