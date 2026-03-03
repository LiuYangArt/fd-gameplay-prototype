import { describe, expect, it, vi } from "vitest";

import {
  EInputAction,
  EInputDeviceKinds,
  type EInputAction as FInputAction
} from "../input/EInputAction";
import { CreateEmptyInputActionFrame } from "../input/FInputActionFrame";

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
    CommandStage?: "Root" | "SkillMenu" | "ItemMenu" | "TargetSelect" | "ActionResolve";
    PendingActionKind?: "Attack" | "Skill" | "Item" | null;
    AimCameraYawDeg: number | null;
    AimCameraPitchDeg?: number | null;
    SelectedTargetIndex: number;
    AimHoverTargetId: string | null;
    SkillOptions?: Array<{ OptionId: string; DisplayName: string }>;
    ItemOptions?: Array<{ OptionId: string; DisplayName: string }>;
    SelectedSkillOptionIndex?: number;
    SelectedItemOptionIndex?: number;
    SelectedSkillOptionId?: string | null;
    TargetSelectOrderedEnemyUnitIds?: string[];
    PendingActionResolvedDetail?: string | null;
    ActionResolveEndsAtMs?: number | null;
    ActionToastText?: string | null;
    ActionToastEndsAtMs?: number | null;
    ScriptStepIndex: number;
    ShotSequence: number;
    LastShot: {
      ShotId: number;
      AttackerUnitId: string;
      TargetUnitId: string | null;
      DamageAmount?: number;
      ImpactAtMs?: number | null;
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
    ActiveInputDevice: EInputDeviceKinds.KeyboardMouse,
    ActionFrame: CreateEmptyInputActionFrame(),
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

function CreateActionSnapshot(
  Actions: FInputAction[],
  Override: Partial<FInputSnapshot> = {}
): FInputSnapshot {
  const Snapshot = {
    ...CreateSnapshot(),
    ...Override
  };
  const ActionFrame = CreateEmptyInputActionFrame();
  for (const Action of Actions) {
    ActionFrame.Actions[Action] = {
      IsTriggered: true,
      IsHeld: true,
      Axis: 1,
      SourceDevice: Snapshot.ActiveInputDevice
    };
    ActionFrame.TriggeredActions.push(Action);
    ActionFrame.HeldActions.push(Action);
  }
  Snapshot.ActionFrame = ActionFrame;
  return Snapshot;
}

function CreateHeldActionSnapshot(
  Action: FInputAction,
  Axis: number,
  Override: Partial<FInputSnapshot> = {}
): FInputSnapshot {
  const Snapshot = {
    ...CreateSnapshot(),
    ...Override
  };
  const ActionFrame = CreateEmptyInputActionFrame();
  ActionFrame.Actions[Action] = {
    IsTriggered: false,
    IsHeld: true,
    Axis,
    SourceDevice: Snapshot.ActiveInputDevice
  };
  ActionFrame.HeldActions.push(Action);
  Snapshot.ActionFrame = ActionFrame;
  return Snapshot;
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
    TargetSelectOrderedEnemyUnitIds: [],
    PendingActionResolvedDetail: null,
    ActionResolveEndsAtMs: null,
    ActionToastText: null,
    ActionToastEndsAtMs: null,
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

const SINGLE_MELEE_RESOLVE_MS = 2400;
const ENEMY_TURN_SETTLE_TICK_MS = 1000;
const ENEMY_TURN_SETTLE_TICK_COUNT = 24;

function RunSinglePlayerMeleeAction(Runtime: UWebGameRuntime): void {
  Runtime.FireBattleAction();
  Runtime.FireBattleAction();
  vi.advanceTimersByTime(SINGLE_MELEE_RESOLVE_MS);
}

function AdvanceBattleTimelineForEnemyTurn(): void {
  for (let Index = 0; Index < ENEMY_TURN_SETTLE_TICK_COUNT; Index += 1) {
    vi.advanceTimersByTime(ENEMY_TURN_SETTLE_TICK_MS);
  }
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
    const DefaultPitch = Runtime.GetViewModel().DebugState.Config.CameraPitch;

    Runtime.ApplyDebugConfig({
      OverworldInvertLookPitch: true,
      AimInvertLookPitch: false
    });
    Runtime.ConsumeInputSnapshot({
      ...CreateSnapshot(),
      LookPitchDeltaDegrees: 10
    });
    expect(Runtime.GetViewModel().DebugState.Config.CameraPitch).toBe(DefaultPitch - 10);

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

    Runtime.ConsumeInputSnapshot(CreateActionSnapshot([EInputAction.UICancel]));

    const Battle3CState = Runtime.GetViewModel().Battle3CState;
    expect(Battle3CState.IsAimMode).toBe(false);
    expect(Battle3CState.CameraMode).toBe("PlayerFollow");
  });

  it("瞄准/菜单/目标阶段的返回动作应进入左下角全局动作槽", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession();

    Runtime.ToggleBattleAim();
    let InputHudState = Runtime.GetViewModel().InputHudState;
    expect(
      InputHudState.GlobalActionSlots.some((Slot) => Slot.Action === EInputAction.UICancel)
    ).toBe(true);
    expect(
      InputHudState.ContextActionSlots.some((Slot) => Slot.Action === EInputAction.UICancel)
    ).toBe(false);

    Runtime.ExitBattleAimMode();
    Runtime.ToggleBattleSkillTargetMode();
    InputHudState = Runtime.GetViewModel().InputHudState;
    expect(
      InputHudState.GlobalActionSlots.some((Slot) => Slot.Action === EInputAction.UICancel)
    ).toBe(true);
    expect(
      InputHudState.ContextActionSlots.some((Slot) => Slot.Action === EInputAction.UICancel)
    ).toBe(false);

    Runtime.ToggleBattleSkillTargetMode();
    Runtime.FireBattleAction();
    InputHudState = Runtime.GetViewModel().InputHudState;
    expect(
      InputHudState.GlobalActionSlots.some((Slot) => Slot.Action === EInputAction.UICancel)
    ).toBe(true);
    expect(
      InputHudState.ContextActionSlots.some((Slot) => Slot.Action === EInputAction.UICancel)
    ).toBe(false);
  });

  it("攻击/技能选敌与道具选己方目标阶段，左下角应提供左右切换与确认目标提示", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession();

    Runtime.FireBattleAction();
    let GlobalSlots = Runtime.GetViewModel().InputHudState.GlobalActionSlots;
    expect(GlobalSlots.some((Slot) => Slot.Action === EInputAction.UINavLeft)).toBe(true);
    expect(GlobalSlots.some((Slot) => Slot.Action === EInputAction.UINavRight)).toBe(true);
    expect(GlobalSlots.some((Slot) => Slot.Action === EInputAction.UIConfirm)).toBe(true);

    Runtime.RequestUICancelAction();
    Runtime.ToggleBattleItemMenu();
    Runtime.FireBattleAction();
    GlobalSlots = Runtime.GetViewModel().InputHudState.GlobalActionSlots;
    expect(Runtime.GetViewModel().Battle3CState.PendingActionKind).toBe("Item");
    expect(GlobalSlots.some((Slot) => Slot.Action === EInputAction.UINavLeft)).toBe(true);
    expect(GlobalSlots.some((Slot) => Slot.Action === EInputAction.UINavRight)).toBe(true);
    expect(GlobalSlots.some((Slot) => Slot.Action === EInputAction.UIConfirm)).toBe(true);
  });

  it("RequestUICancelAction 应按战斗上下文统一执行返回", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession();

    Runtime.ToggleBattleAim();
    expect(Runtime.RequestUICancelAction()).toBe(true);
    expect(Runtime.GetViewModel().Battle3CState.IsAimMode).toBe(false);

    Runtime.ToggleBattleSkillTargetMode();
    expect(Runtime.GetViewModel().Battle3CState.CommandStage).toBe("SkillMenu");
    expect(Runtime.RequestUICancelAction()).toBe(true);
    expect(Runtime.GetViewModel().Battle3CState.CommandStage).toBe("Root");

    Runtime.FireBattleAction();
    expect(Runtime.GetViewModel().Battle3CState.CommandStage).toBe("TargetSelect");
    expect(Runtime.RequestUICancelAction()).toBe(true);
    expect(Runtime.GetViewModel().Battle3CState.CommandStage).toBe("Root");
  });

  it("Root 待机下左下角长按动作应透出持有进度状态", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession();

    Runtime.ConsumeInputSnapshot(CreateHeldActionSnapshot(EInputAction.BattleFlee, 0.46));
    const HoldHud = Runtime.GetViewModel().InputHudState.GlobalActionSlots.find(
      (Slot) => Slot.Action === EInputAction.BattleFlee
    );
    expect(HoldHud?.RequiresHold).toBe(true);
    expect(HoldHud?.IsHoldActive).toBe(true);
    expect(HoldHud?.HoldProgressNormalized).toBeCloseTo(0.46, 3);

    Runtime.ConsumeInputSnapshot(CreateSnapshot());
    const ResetHud = Runtime.GetViewModel().InputHudState.GlobalActionSlots.find(
      (Slot) => Slot.Action === EInputAction.BattleFlee
    );
    expect(ResetHud?.IsHoldActive).toBe(false);
    expect(ResetHud?.HoldProgressNormalized).toBe(0);
  });

  it("Root 待机下仅逃跑长按进度变化时也应触发 Runtime 更新事件", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession();

    const Listener = vi.fn();
    const Dispose = Runtime.OnRuntimeUpdated(Listener);
    expect(Listener).toHaveBeenCalledTimes(1);

    const IdleNoAimDelta = {
      AimScreenDelta: { X: 0, Y: 0 },
      AimScreenPosition: null
    } as const;

    Runtime.ConsumeInputSnapshot(
      CreateHeldActionSnapshot(EInputAction.BattleFlee, 0.2, IdleNoAimDelta)
    );
    Runtime.ConsumeInputSnapshot(
      CreateHeldActionSnapshot(EInputAction.BattleFlee, 0.7, IdleNoAimDelta)
    );
    Runtime.ConsumeInputSnapshot({
      ...CreateSnapshot(),
      ...IdleNoAimDelta
    });

    expect(Listener).toHaveBeenCalledTimes(4);
    Dispose();
  });

  it("键鼠默认不应显示列表选中，高亮应在方向键导航后激活", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession();

    let RootSlots = Runtime.GetViewModel().InputHudState.ContextActionSlots.filter(
      (Slot) =>
        Slot.SlotId === "RootAttack" || Slot.SlotId === "RootSkill" || Slot.SlotId === "RootItem"
    );
    expect(RootSlots.some((Slot) => Slot.IsFocused)).toBe(false);

    Runtime.ConsumeInputSnapshot(
      CreateActionSnapshot([EInputAction.UINavDown], {
        ActiveInputDevice: EInputDeviceKinds.KeyboardMouse
      })
    );
    RootSlots = Runtime.GetViewModel().InputHudState.ContextActionSlots.filter(
      (Slot) =>
        Slot.SlotId === "RootAttack" || Slot.SlotId === "RootSkill" || Slot.SlotId === "RootItem"
    );
    expect(RootSlots.some((Slot) => Slot.IsFocused)).toBe(true);
  });

  it("Root 命令中的攻击文案应为近战攻击", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession();

    const RootAttackSlot = Runtime.GetViewModel().InputHudState.ContextActionSlots.find(
      (Slot) => Slot.SlotId === "RootAttack"
    );
    expect(RootAttackSlot?.DisplayName).toBe("近战攻击");
  });

  it("跳过回合应消耗当前角色行动次数，并在本轮队列内推进到下一存活角色", () => {
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

    expect(Runtime.SwitchControlledCharacter()).toBe(true);
    expect(Runtime.GetViewModel().Battle3CState.ControlledCharacterId).toBe("char03");

    expect(Runtime.SwitchControlledCharacter()).toBe(true);
    const Logs = Runtime.GetViewModel().EventLogs;
    expect(
      Logs.some((Log) => Log.includes("EBattleTurnChanged") && Log.includes("EnemyTurnStart"))
    ).toBe(true);
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

  it("连续跳过前两名角色后，第三名角色行动完成应进入敌方回合", () => {
    vi.useFakeTimers();
    try {
      const Runtime = new UWebGameRuntime();
      const MutableRuntime = Runtime as unknown as FMutableRuntime;
      MutableRuntime.RuntimePhase = "Battle3C";
      MutableRuntime.ActiveBattleSession = CreateBattleSession({
        PlayerActiveUnitIds: ["char01", "char02", "char03"],
        EnemyActiveUnitIds: ["enemy01", "enemy02", "enemy03"],
        ControlledCharacterId: "char01",
        Units: [
          CreateBattleUnit({
            UnitId: "char01",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: 150 },
            YawDeg: 90
          }),
          CreateBattleUnit({
            UnitId: "char02",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: 0 },
            YawDeg: 90
          }),
          CreateBattleUnit({
            UnitId: "char03",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: -150 },
            YawDeg: 90
          }),
          CreateBattleUnit({
            UnitId: "enemy01",
            TeamId: "Enemy",
            DisplayName: "enemy01",
            PositionCm: { X: 280, Y: 0, Z: 180 },
            IsEncounterPrimaryEnemy: true
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
            PositionCm: { X: 280, Y: 0, Z: -180 }
          })
        ]
      });

      expect(Runtime.SwitchControlledCharacter()).toBe(true);
      expect(Runtime.GetViewModel().Battle3CState.ControlledCharacterId).toBe("char02");

      expect(Runtime.SwitchControlledCharacter()).toBe(true);
      expect(Runtime.GetViewModel().Battle3CState.ControlledCharacterId).toBe("char03");

      RunSinglePlayerMeleeAction(Runtime);

      const EnemyTurnStartCount = Runtime.GetViewModel().EventLogs.filter(
        (Log) => Log.includes("EBattleTurnChanged") && Log.includes("EnemyTurnStart")
      ).length;
      const EnemyActCount = Runtime.GetViewModel().EventLogs.filter((Log) =>
        Log.includes("EnemyTurn:Act:")
      ).length;
      expect(EnemyTurnStartCount).toBeGreaterThan(0);
      expect(EnemyActCount).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
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
    const AimPitchMin = Runtime.GetViewModel().DebugState.Config.LookPitchMin;
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
    expect(Runtime.GetViewModel().Battle3CState.AimCameraPitchDeg).toBe(AimPitchMin);
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
    expect(LastShot?.DamageAmount).toBe(20);
    expect((LastShot?.ImpactAtMs ?? 0) > 0).toBe(true);
    expect(Runtime.GetViewModel().Battle3CState.CameraMode).toBe("PlayerAim");
  });

  it("命中敌人后应扣减血量并在未致死时保持存活", () => {
    vi.useFakeTimers();
    try {
      const Runtime = new UWebGameRuntime();
      const MutableRuntime = Runtime as unknown as FMutableRuntime;
      MutableRuntime.RuntimePhase = "Battle3C";
      MutableRuntime.ActiveBattleSession = {
        SessionId: "B3C_HIT_DAMAGE",
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
            CurrentHp: 35,
            MaxHp: 100,
            IsEncounterPrimaryEnemy: true
          })
        ],
        ScriptFocus: null
      };

      Runtime.FireBattleAction();

      const ImmediateEnemy = Runtime.GetViewModel().Battle3CState.Units.find(
        (Unit) => Unit.UnitId === "enemy01"
      );
      expect(ImmediateEnemy?.CurrentHp).toBe(35);
      expect(Runtime.GetViewModel().Battle3CState.LastShot?.DamageAmount).toBe(20);

      vi.advanceTimersByTime(120);
      const Enemy = Runtime.GetViewModel().Battle3CState.Units.find(
        (Unit) => Unit.UnitId === "enemy01"
      );
      expect(Enemy?.CurrentHp).toBe(15);
      expect(Enemy?.IsAlive).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("远程致死后应判定死亡并从可交互目标中移除", () => {
    vi.useFakeTimers();
    try {
      const Runtime = new UWebGameRuntime();
      const MutableRuntime = Runtime as unknown as FMutableRuntime;
      MutableRuntime.RuntimePhase = "Battle3C";
      MutableRuntime.ActiveBattleSession = {
        SessionId: "B3C_SHOT_KILL",
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
            CurrentHp: 12,
            MaxHp: 100,
            IsEncounterPrimaryEnemy: true
          }),
          CreateBattleUnit({
            UnitId: "enemy02",
            TeamId: "Enemy",
            DisplayName: "enemy02",
            CurrentHp: 100,
            MaxHp: 100
          })
        ],
        ScriptFocus: null
      };

      Runtime.FireBattleAction();
      expect(Runtime.GetViewModel().Battle3CState.LastShot?.DamageAmount).toBe(12);

      vi.advanceTimersByTime(160);
      const State = Runtime.GetViewModel().Battle3CState;
      const Enemy01 = State.Units.find((Unit) => Unit.UnitId === "enemy01");
      expect(Enemy01?.CurrentHp).toBe(0);
      expect(Enemy01?.IsAlive).toBe(false);
      expect(State.EnemyActiveUnitIds).toEqual(["enemy02"]);

      Runtime.SetBattleAimHoverTarget("enemy01");
      expect(Runtime.GetViewModel().Battle3CState.HoveredTargetId).not.toBe("enemy01");
      expect(Runtime.GetViewModel().Battle3CState.SelectedTargetId).toBe("enemy02");
    } finally {
      vi.useRealTimers();
    }
  });

  it("远程命中后应写入伤害弹字 Cue", () => {
    vi.useFakeTimers();
    try {
      const Runtime = new UWebGameRuntime();
      const MutableRuntime = Runtime as unknown as FMutableRuntime;
      MutableRuntime.RuntimePhase = "Battle3C";
      MutableRuntime.ActiveBattleSession = {
        SessionId: "B3C_SHOT_DAMAGE_CUE",
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
      expect(Runtime.GetViewModel().Battle3CState.LastDamageCue).toBeNull();

      vi.advanceTimersByTime(140);
      const LastDamageCue = Runtime.GetViewModel().Battle3CState.LastDamageCue;
      expect(LastDamageCue).not.toBeNull();
      expect(LastDamageCue?.SourceKind).toBe("Shot");
      expect(LastDamageCue?.TargetUnitId).toBe("enemy01");
      expect((LastDamageCue?.DamageAmount ?? 0) > 0).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  // eslint-disable-next-line complexity
  it("近战命中时应触发伤害 Cue 与受击后退回位", () => {
    vi.useFakeTimers();
    try {
      const Runtime = new UWebGameRuntime();
      const MutableRuntime = Runtime as unknown as FMutableRuntime;
      MutableRuntime.RuntimePhase = "Battle3C";
      MutableRuntime.ActiveBattleSession = CreateBattleSession({
        PlayerActiveUnitIds: ["char01"],
        EnemyActiveUnitIds: ["enemy01"],
        ControlledCharacterId: "char01",
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
            PositionCm: { X: 280, Y: 0, Z: 0 },
            MaxHp: 100,
            CurrentHp: 100,
            IsEncounterPrimaryEnemy: true
          })
        ]
      });

      const Before = Runtime.GetViewModel().Battle3CState.Units.find(
        (Unit) => Unit.UnitId === "enemy01"
      );
      Runtime.FireBattleAction();
      Runtime.FireBattleAction();

      expect(Runtime.GetViewModel().Battle3CState.LastShot).toBeNull();
      expect(Runtime.GetViewModel().Battle3CState.ActiveMeleeAction).not.toBeNull();

      vi.advanceTimersByTime(1200);
      const DuringImpact = Runtime.GetViewModel().Battle3CState.Units.find(
        (Unit) => Unit.UnitId === "enemy01"
      );
      expect(DuringImpact).not.toBeUndefined();
      expect((DuringImpact?.CurrentHp ?? 0) < (Before?.CurrentHp ?? 0)).toBe(true);
      const LastDamageCue = Runtime.GetViewModel().Battle3CState.LastDamageCue;
      expect(LastDamageCue?.SourceKind).toBe("Melee");
      expect(LastDamageCue?.TargetUnitId).toBe("enemy01");
      const KnockDistance = Math.hypot(
        (DuringImpact?.PositionCm.X ?? 0) - (Before?.PositionCm.X ?? 0),
        (DuringImpact?.PositionCm.Z ?? 0) - (Before?.PositionCm.Z ?? 0)
      );
      expect(KnockDistance).toBeGreaterThan(10);

      vi.advanceTimersByTime(320);
      const Returned = Runtime.GetViewModel().Battle3CState.Units.find(
        (Unit) => Unit.UnitId === "enemy01"
      );
      expect(Returned?.PositionCm.X).toBeCloseTo(Before?.PositionCm.X ?? 0, 3);
      expect(Returned?.PositionCm.Z).toBeCloseTo(Before?.PositionCm.Z ?? 0, 3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("近战致死后应判定死亡并移出敌方活跃列表", () => {
    vi.useFakeTimers();
    try {
      const Runtime = new UWebGameRuntime();
      const MutableRuntime = Runtime as unknown as FMutableRuntime;
      MutableRuntime.RuntimePhase = "Battle3C";
      MutableRuntime.ActiveBattleSession = CreateBattleSession({
        PlayerActiveUnitIds: ["char01"],
        EnemyActiveUnitIds: ["enemy01", "enemy02"],
        ControlledCharacterId: "char01",
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
            PositionCm: { X: 280, Y: 0, Z: 0 },
            MaxHp: 100,
            CurrentHp: 20,
            IsEncounterPrimaryEnemy: true
          }),
          CreateBattleUnit({
            UnitId: "enemy02",
            TeamId: "Enemy",
            DisplayName: "enemy02",
            PositionCm: { X: 280, Y: 0, Z: 120 },
            MaxHp: 100,
            CurrentHp: 100
          })
        ]
      });

      Runtime.FireBattleAction();
      Runtime.FireBattleAction();
      vi.advanceTimersByTime(1200);

      const State = Runtime.GetViewModel().Battle3CState;
      const Enemy01 = State.Units.find((Unit) => Unit.UnitId === "enemy01");
      expect(Enemy01?.CurrentHp).toBe(0);
      expect(Enemy01?.IsAlive).toBe(false);
      expect(State.EnemyActiveUnitIds).toEqual(["enemy02"]);
    } finally {
      vi.useRealTimers();
    }
  });

  // eslint-disable-next-line complexity
  it("命中后应先等待弹道命中再击退，并在短时后回位", () => {
    vi.useFakeTimers();
    try {
      const Runtime = new UWebGameRuntime();
      const MutableRuntime = Runtime as unknown as FMutableRuntime;
      MutableRuntime.RuntimePhase = "Battle3C";
      MutableRuntime.ActiveBattleSession = {
        SessionId: "B3C_HIT_KNOCKBACK",
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
          CreateBattleUnit({
            UnitId: "char01",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: 0 }
          }),
          CreateBattleUnit({
            UnitId: "enemy01",
            TeamId: "Enemy",
            DisplayName: "enemy01",
            PositionCm: { X: 280, Y: 0, Z: -120 },
            IsEncounterPrimaryEnemy: true
          })
        ],
        ScriptFocus: null
      };

      const Before = Runtime.GetViewModel().Battle3CState.Units.find(
        (Unit) => Unit.UnitId === "enemy01"
      );
      expect(Before).not.toBeUndefined();

      Runtime.FireBattleAction();

      const ImmediatelyAfterFire = Runtime.GetViewModel().Battle3CState.Units.find(
        (Unit) => Unit.UnitId === "enemy01"
      );
      expect(ImmediatelyAfterFire?.PositionCm.X).toBeCloseTo(Before?.PositionCm.X ?? 0, 3);
      expect(ImmediatelyAfterFire?.PositionCm.Z).toBeCloseTo(Before?.PositionCm.Z ?? 0, 3);

      vi.advanceTimersByTime(200);
      const Knocked = Runtime.GetViewModel().Battle3CState.Units.find(
        (Unit) => Unit.UnitId === "enemy01"
      );
      expect(Knocked).not.toBeUndefined();
      const KnockbackDistance = Math.hypot(
        (Knocked?.PositionCm.X ?? 0) - (Before?.PositionCm.X ?? 0),
        (Knocked?.PositionCm.Z ?? 0) - (Before?.PositionCm.Z ?? 0)
      );
      expect(KnockbackDistance).toBeCloseTo(40, 1);

      vi.advanceTimersByTime(280);
      const Returned = Runtime.GetViewModel().Battle3CState.Units.find(
        (Unit) => Unit.UnitId === "enemy01"
      );
      expect(Returned?.PositionCm.X).toBeCloseTo(Before?.PositionCm.X ?? 0, 3);
      expect(Returned?.PositionCm.Z).toBeCloseTo(Before?.PositionCm.Z ?? 0, 3);
    } finally {
      vi.useRealTimers();
    }
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

    Runtime.ConsumeInputSnapshot(CreateActionSnapshot([EInputAction.UICancel]));
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
    Runtime.ConsumeInputSnapshot(CreateActionSnapshot([EInputAction.UICancel]));

    const State = Runtime.GetViewModel().Battle3CState;
    expect(State.CommandStage).toBe("Root");
    expect(State.PendingActionKind).toBeNull();
    expect(State.CameraMode).toBe("PlayerFollow");
  });

  it("技能条目应进入敌方目标选择，物品条目应进入我方目标选择", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession();

    Runtime.ToggleBattleSkillTargetMode();
    Runtime.ActivateBattleSkillOption(1);
    const SkillState = Runtime.GetViewModel().Battle3CState;
    expect(SkillState.CommandStage).toBe("TargetSelect");
    expect(SkillState.PendingActionKind).toBe("Skill");
    expect(SkillState.SelectedSkillOptionId).toBe("skill02");

    Runtime.ConsumeInputSnapshot(CreateActionSnapshot([EInputAction.UICancel]));
    Runtime.ToggleBattleSkillTargetMode();
    Runtime.ToggleBattleItemMenu();
    Runtime.ActivateBattleItemOption(1);
    const ItemState = Runtime.GetViewModel().Battle3CState;
    expect(ItemState.CommandStage).toBe("TargetSelect");
    expect(ItemState.PendingActionKind).toBe("Item");
    expect(ItemState.SelectedTargetId).toBe("char01");
    expect(
      Runtime.GetViewModel().EventLogs.some((Log) => Log.includes("UseItemPlaceholder:item02"))
    ).toBe(false);
  });

  it("近战目标确认后应进入 ActionResolve，并在回位后自动切到下一角色", () => {
    vi.useFakeTimers();
    try {
      const Runtime = new UWebGameRuntime();
      const MutableRuntime = Runtime as unknown as FMutableRuntime;
      MutableRuntime.RuntimePhase = "Battle3C";
      MutableRuntime.ActiveBattleSession = CreateBattleSession();

      Runtime.FireBattleAction();
      Runtime.CycleBattleTarget(1);
      expect(Runtime.GetViewModel().Battle3CState.SelectedTargetId).toBe("enemy02");

      Runtime.FireBattleAction();
      const ResolvingState = Runtime.GetViewModel().Battle3CState;
      expect(ResolvingState.CommandStage).toBe("ActionResolve");
      expect(ResolvingState.PendingActionKind).toBeNull();
      expect(ResolvingState.LastShot).toBeNull();
      expect(ResolvingState.CameraMode).toBe("PlayerFollow");
      expect(ResolvingState.ActiveMeleeAction?.TargetUnitId).toBe("enemy02");
      expect(ResolvingState.ActionToastText).toContain("已执行");

      Runtime.CycleBattleTarget(1);
      expect(Runtime.GetViewModel().Battle3CState.SelectedTargetId).toBe("enemy02");
      expect(Runtime.SwitchControlledCharacter()).toBe(false);
      expect(Runtime.FleeBattleToOverworld()).toBe(false);

      vi.advanceTimersByTime(2000);
      const FinishedState = Runtime.GetViewModel().Battle3CState;
      expect(FinishedState.CommandStage).toBe("Root");
      expect(FinishedState.CameraMode).toBe("PlayerFollow");
      expect(FinishedState.ActiveMeleeAction).toBeNull();
      expect(FinishedState.ControlledCharacterId).toBe("char02");
      expect(
        Runtime.GetViewModel().EventLogs.some((Log) => Log.includes("EPlayerActionResolved"))
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("近战目标很近时前冲也应保持可见位移时长，避免瞬移感", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession({
      Units: [
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
          PositionCm: { X: -140, Y: 0, Z: 0 },
          IsEncounterPrimaryEnemy: true
        }),
        CreateBattleUnit({
          UnitId: "enemy02",
          TeamId: "Enemy",
          DisplayName: "enemy02",
          PositionCm: { X: 280, Y: 0, Z: 120 }
        })
      ]
    });

    Runtime.FireBattleAction();
    Runtime.FireBattleAction();

    const ActiveMeleeAction = Runtime.GetViewModel().Battle3CState.ActiveMeleeAction;
    expect(ActiveMeleeAction).not.toBeNull();
    const DashDurationMs =
      (ActiveMeleeAction?.DashEndAtMs ?? 0) - (ActiveMeleeAction?.DashStartAtMs ?? 0);
    expect(DashDurationMs).toBeGreaterThanOrEqual(220);
  });

  it("近战命中后应预留结果展示时间，再 reset 镜头并切下一角色", () => {
    vi.useFakeTimers();
    try {
      const Runtime = new UWebGameRuntime();
      const MutableRuntime = Runtime as unknown as FMutableRuntime;
      MutableRuntime.RuntimePhase = "Battle3C";
      MutableRuntime.ActiveBattleSession = CreateBattleSession({
        Units: [
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
            PositionCm: { X: -140, Y: 0, Z: 0 },
            IsEncounterPrimaryEnemy: true
          }),
          CreateBattleUnit({
            UnitId: "enemy02",
            TeamId: "Enemy",
            DisplayName: "enemy02",
            PositionCm: { X: 280, Y: 0, Z: 120 }
          })
        ]
      });

      Runtime.FireBattleAction();
      Runtime.FireBattleAction();

      vi.advanceTimersByTime(650);
      const DuringResultWindow = Runtime.GetViewModel().Battle3CState;
      expect(DuringResultWindow.CommandStage).toBe("ActionResolve");
      expect(DuringResultWindow.ControlledCharacterId).toBe("char01");

      vi.advanceTimersByTime(800);
      const FinishedState = Runtime.GetViewModel().Battle3CState;
      expect(FinishedState.CommandStage).toBe("Root");
      expect(FinishedState.ControlledCharacterId).toBe("char02");
    } finally {
      vi.useRealTimers();
    }
  });

  it("我方全员完成行动后应进入敌方回合，敌方按屏幕左到右依次近战并回到我方回合", () => {
    vi.useFakeTimers();
    const RandomSpy = vi
      .spyOn(Math, "random")
      .mockReturnValueOnce(0.0)
      .mockReturnValueOnce(0.51)
      .mockReturnValueOnce(0.99);
    try {
      const Runtime = new UWebGameRuntime();
      const MutableRuntime = Runtime as unknown as FMutableRuntime;
      MutableRuntime.RuntimePhase = "Battle3C";
      MutableRuntime.ActiveBattleSession = CreateBattleSession({
        PlayerActiveUnitIds: ["char01", "char02", "char03"],
        EnemyActiveUnitIds: ["enemyLeft", "enemyCenter", "enemyRight"],
        ControlledCharacterId: "char01",
        Units: [
          CreateBattleUnit({
            UnitId: "char01",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: 140 },
            YawDeg: 90
          }),
          CreateBattleUnit({
            UnitId: "char02",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: 0 },
            YawDeg: 90
          }),
          CreateBattleUnit({
            UnitId: "char03",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: -140 },
            YawDeg: 90
          }),
          CreateBattleUnit({
            UnitId: "enemyLeft",
            TeamId: "Enemy",
            DisplayName: "enemyLeft",
            PositionCm: { X: 280, Y: 0, Z: 220 },
            IsEncounterPrimaryEnemy: true
          }),
          CreateBattleUnit({
            UnitId: "enemyCenter",
            TeamId: "Enemy",
            DisplayName: "enemyCenter",
            PositionCm: { X: 280, Y: 0, Z: 0 }
          }),
          CreateBattleUnit({
            UnitId: "enemyRight",
            TeamId: "Enemy",
            DisplayName: "enemyRight",
            PositionCm: { X: 280, Y: 0, Z: -220 }
          })
        ]
      });

      RunSinglePlayerMeleeAction(Runtime);
      RunSinglePlayerMeleeAction(Runtime);
      RunSinglePlayerMeleeAction(Runtime);
      AdvanceBattleTimelineForEnemyTurn();

      const EnemyActionLogs = Runtime.GetViewModel().EventLogs.filter((Log) =>
        Log.includes("EnemyTurn:Act:")
      );
      expect(EnemyActionLogs).toHaveLength(3);
      expect(EnemyActionLogs[0]).toContain("EnemyTurn:Act:enemyLeft->char01");
      expect(EnemyActionLogs[1]).toContain("EnemyTurn:Act:enemyCenter->char02");
      expect(EnemyActionLogs[2]).toContain("EnemyTurn:Act:enemyRight->char03");

      const BattleState = Runtime.GetViewModel().Battle3CState;
      expect(BattleState.CommandStage).toBe("Root");
      expect(BattleState.ControlledCharacterId).toBe("char01");
      expect(BattleState.CameraMode).toBe("PlayerFollow");
      expect(
        BattleState.Units.filter((Unit) => Unit.TeamId === "Player" && Unit.IsAlive)
      ).toHaveLength(3);
      const TotalPlayerHp = BattleState.Units.filter((Unit) => Unit.TeamId === "Player").reduce(
        (Sum, Unit) => Sum + Unit.CurrentHp,
        0
      );
      expect(TotalPlayerHp).toBeLessThan(300);
    } finally {
      RandomSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("敌方回合随机目标应只在存活我方单位中选择", () => {
    vi.useFakeTimers();
    const RandomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    try {
      const Runtime = new UWebGameRuntime();
      const MutableRuntime = Runtime as unknown as FMutableRuntime;
      MutableRuntime.RuntimePhase = "Battle3C";
      MutableRuntime.ActiveBattleSession = CreateBattleSession({
        PlayerActiveUnitIds: ["char01", "char02", "char03"],
        EnemyActiveUnitIds: ["enemy01", "enemy02", "enemy03"],
        ControlledCharacterId: "char01",
        Units: [
          CreateBattleUnit({
            UnitId: "char01",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: 140 },
            YawDeg: 90
          }),
          CreateBattleUnit({
            UnitId: "char02",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: 0 },
            YawDeg: 90,
            CurrentHp: 0,
            IsAlive: false
          }),
          CreateBattleUnit({
            UnitId: "char03",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: -140 },
            YawDeg: 90
          }),
          CreateBattleUnit({
            UnitId: "enemy01",
            TeamId: "Enemy",
            DisplayName: "enemy01",
            PositionCm: { X: 280, Y: 0, Z: 220 },
            IsEncounterPrimaryEnemy: true
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
            PositionCm: { X: 280, Y: 0, Z: -220 }
          })
        ]
      });

      RunSinglePlayerMeleeAction(Runtime);
      RunSinglePlayerMeleeAction(Runtime);
      RunSinglePlayerMeleeAction(Runtime);
      AdvanceBattleTimelineForEnemyTurn();

      const EnemyActionLogs = Runtime.GetViewModel().EventLogs.filter((Log) =>
        Log.includes("EnemyTurn:Act:")
      );
      expect(EnemyActionLogs).toHaveLength(3);
      expect(EnemyActionLogs.some((Log) => Log.includes("->char02"))).toBe(false);
    } finally {
      RandomSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("首个行动击杀一名敌人后，我方本轮其余角色行动完仍应进入敌方回合", () => {
    vi.useFakeTimers();
    const RandomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    try {
      const Runtime = new UWebGameRuntime();
      const MutableRuntime = Runtime as unknown as FMutableRuntime;
      MutableRuntime.RuntimePhase = "Battle3C";
      MutableRuntime.ActiveBattleSession = CreateBattleSession({
        PlayerActiveUnitIds: ["char01", "char02", "char03"],
        EnemyActiveUnitIds: ["enemy01", "enemy02", "enemy03"],
        ControlledCharacterId: "char01",
        Units: [
          CreateBattleUnit({
            UnitId: "char01",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: 160 },
            YawDeg: 90
          }),
          CreateBattleUnit({
            UnitId: "char02",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: 0 },
            YawDeg: 90
          }),
          CreateBattleUnit({
            UnitId: "char03",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: -160 },
            YawDeg: 90
          }),
          CreateBattleUnit({
            UnitId: "enemy01",
            TeamId: "Enemy",
            DisplayName: "enemy01",
            PositionCm: { X: 280, Y: 0, Z: 180 },
            CurrentHp: 20,
            IsEncounterPrimaryEnemy: true
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
            PositionCm: { X: 280, Y: 0, Z: -180 }
          })
        ]
      });

      // char01 首次行动击杀 enemy01
      RunSinglePlayerMeleeAction(Runtime);
      expect(
        Runtime.GetViewModel().Battle3CState.Units.find((Unit) => Unit.UnitId === "enemy01")
          ?.IsAlive
      ).toBe(false);

      // 我方剩余角色行动
      RunSinglePlayerMeleeAction(Runtime);
      RunSinglePlayerMeleeAction(Runtime);
      AdvanceBattleTimelineForEnemyTurn();

      const EnemyTurnChangedLogs = Runtime.GetViewModel().EventLogs.filter(
        (Log) => Log.includes("EBattleTurnChanged") && Log.includes("EnemyTurnStart")
      );
      const EnemyActionLogs = Runtime.GetViewModel().EventLogs.filter((Log) =>
        Log.includes("EnemyTurn:Act:")
      );
      expect(EnemyTurnChangedLogs.length).toBeGreaterThan(0);
      expect(EnemyActionLogs.length).toBeGreaterThan(0);
    } finally {
      RandomSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("敌方活跃列表异常为空但仍有存活敌人时，回合推进不应卡死", () => {
    vi.useFakeTimers();
    const RandomSpy = vi.spyOn(Math, "random").mockReturnValue(0.0);
    try {
      const Runtime = new UWebGameRuntime();
      const MutableRuntime = Runtime as unknown as FMutableRuntime;
      MutableRuntime.RuntimePhase = "Battle3C";
      MutableRuntime.ActiveBattleSession = CreateBattleSession({
        PlayerActiveUnitIds: ["char01", "char02", "char03"],
        // 模拟运行时异常：活跃列表为空，但单位实际仍存活。
        EnemyActiveUnitIds: [],
        ControlledCharacterId: "char01",
        Units: [
          CreateBattleUnit({
            UnitId: "char01",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: 140 },
            YawDeg: 90
          }),
          CreateBattleUnit({
            UnitId: "char02",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: 0 },
            YawDeg: 90
          }),
          CreateBattleUnit({
            UnitId: "char03",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: -140 },
            YawDeg: 90
          }),
          CreateBattleUnit({
            UnitId: "enemy01",
            TeamId: "Enemy",
            DisplayName: "enemy01",
            PositionCm: { X: 280, Y: 0, Z: 160 },
            IsEncounterPrimaryEnemy: true
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
            PositionCm: { X: 280, Y: 0, Z: -160 }
          })
        ]
      });

      RunSinglePlayerMeleeAction(Runtime);
      RunSinglePlayerMeleeAction(Runtime);
      RunSinglePlayerMeleeAction(Runtime);
      AdvanceBattleTimelineForEnemyTurn();

      const EnemyTurnChangedLogs = Runtime.GetViewModel().EventLogs.filter(
        (Log) => Log.includes("EBattleTurnChanged") && Log.includes("EnemyTurnStart")
      );
      expect(EnemyTurnChangedLogs.length).toBeGreaterThan(0);
    } finally {
      RandomSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("敌方单位全灭后不应停在我方回合，应进入结算阶段", () => {
    vi.useFakeTimers();
    try {
      const Runtime = new UWebGameRuntime();
      const MutableRuntime = Runtime as unknown as FMutableRuntime;
      MutableRuntime.RuntimePhase = "Battle3C";
      MutableRuntime.ActiveBattleSession = CreateBattleSession({
        PlayerActiveUnitIds: ["char01", "char02", "char03"],
        EnemyActiveUnitIds: ["enemy01", "enemy02", "enemy03"],
        ControlledCharacterId: "char01",
        Units: [
          CreateBattleUnit({
            UnitId: "char01",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: 140 },
            YawDeg: 90
          }),
          CreateBattleUnit({
            UnitId: "char02",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: 0 },
            YawDeg: 90
          }),
          CreateBattleUnit({
            UnitId: "char03",
            TeamId: "Player",
            PositionCm: { X: -220, Y: 0, Z: -140 },
            YawDeg: 90
          }),
          CreateBattleUnit({
            UnitId: "enemy01",
            TeamId: "Enemy",
            DisplayName: "enemy01",
            PositionCm: { X: 280, Y: 0, Z: 160 },
            CurrentHp: 20,
            IsEncounterPrimaryEnemy: true
          }),
          CreateBattleUnit({
            UnitId: "enemy02",
            TeamId: "Enemy",
            DisplayName: "enemy02",
            PositionCm: { X: 280, Y: 0, Z: 0 },
            CurrentHp: 20
          }),
          CreateBattleUnit({
            UnitId: "enemy03",
            TeamId: "Enemy",
            DisplayName: "enemy03",
            PositionCm: { X: 280, Y: 0, Z: -160 },
            CurrentHp: 20
          })
        ]
      });

      RunSinglePlayerMeleeAction(Runtime);
      RunSinglePlayerMeleeAction(Runtime);
      RunSinglePlayerMeleeAction(Runtime);

      // 留出动作链尾部事件处理时间
      vi.advanceTimersByTime(1000);

      expect(Runtime.GetViewModel().RuntimePhase).toBe("SettlementPreview");
      expect(
        Runtime.GetViewModel().EventLogs.some((Log) => Log.includes("ESettlementPreviewRequested"))
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("物品确认应进入我方目标选择，并在确认后记录占位行为", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession();

    Runtime.ToggleBattleItemMenu();
    Runtime.CycleBattleMenuSelection(1);
    Runtime.FireBattleAction();
    expect(Runtime.GetViewModel().Battle3CState.CommandStage).toBe("TargetSelect");
    expect(Runtime.GetViewModel().Battle3CState.PendingActionKind).toBe("Item");
    expect(Runtime.GetViewModel().Battle3CState.SelectedTargetId).toBe("char01");
    expect(Runtime.GetViewModel().Battle3CState.CameraMode).toBe("PlayerItemPreview");

    Runtime.CycleBattleTarget(1);
    expect(Runtime.GetViewModel().Battle3CState.SelectedTargetId).toBe("char02");
    Runtime.FireBattleAction();

    const State = Runtime.GetViewModel().Battle3CState;
    expect(State.CommandStage).toBe("ActionResolve");
    expect(State.PendingActionKind).toBeNull();
    expect(State.LastShot).toBeNull();
    expect(State.ActionToastText).toContain("已执行 物品2 -> char01");
    expect(State.CameraMode).toBe("PlayerItemPreview");
    expect(State.SelectedTargetId).toBe("char02");
    expect(
      Runtime.GetViewModel().EventLogs.some((Log) =>
        Log.includes("UseItemPlaceholder:item02:char02")
      )
    ).toBe(true);
  });

  it("物品目标选择阶段应响应左右导航语义（键鼠与手柄）", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession();

    Runtime.ToggleBattleItemMenu();
    Runtime.FireBattleAction();
    expect(Runtime.GetViewModel().Battle3CState.CommandStage).toBe("TargetSelect");
    expect(Runtime.GetViewModel().Battle3CState.PendingActionKind).toBe("Item");
    expect(Runtime.GetViewModel().Battle3CState.SelectedTargetId).toBe("char01");
    expect(Runtime.GetViewModel().Battle3CState.CameraMode).toBe("PlayerItemPreview");

    Runtime.ConsumeInputSnapshot(
      CreateActionSnapshot([EInputAction.UINavRight], {
        ActiveInputDevice: EInputDeviceKinds.KeyboardMouse
      })
    );
    expect(Runtime.GetViewModel().Battle3CState.SelectedTargetId).toBe("char02");
    expect(Runtime.GetViewModel().Battle3CState.CameraMode).toBe("PlayerItemPreview");

    Runtime.ConsumeInputSnapshot(
      CreateActionSnapshot([EInputAction.UINavLeft], {
        ActiveInputDevice: EInputDeviceKinds.Gamepad
      })
    );
    expect(Runtime.GetViewModel().Battle3CState.SelectedTargetId).toBe("char01");
  });

  it("物品目标选择阶段应反转左右步进方向以匹配镜像机位体感", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession({
      ControlledCharacterId: "char02",
      PlayerActiveUnitIds: ["char01", "char02", "char03"],
      SelectedTargetIndex: 1,
      Units: [
        CreateBattleUnit({
          UnitId: "char01",
          TeamId: "Player",
          PositionCm: { X: -220, Y: 0, Z: 120 },
          YawDeg: 90
        }),
        CreateBattleUnit({
          UnitId: "char02",
          TeamId: "Player",
          PositionCm: { X: -220, Y: 0, Z: 0 },
          YawDeg: 90
        }),
        CreateBattleUnit({
          UnitId: "char03",
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
      ]
    });

    Runtime.ToggleBattleItemMenu();
    Runtime.FireBattleAction();
    expect(Runtime.GetViewModel().Battle3CState.SelectedTargetId).toBe("char02");

    Runtime.CycleBattleTarget(1);
    expect(Runtime.GetViewModel().Battle3CState.SelectedTargetId).toBe("char01");

    Runtime.CycleBattleTarget(-1);
    expect(Runtime.GetViewModel().Battle3CState.SelectedTargetId).toBe("char02");

    Runtime.CycleBattleTarget(-1);
    expect(Runtime.GetViewModel().Battle3CState.SelectedTargetId).toBe("char03");
  });

  it("TargetSelect 进入后应冻结按屏幕 X 的目标顺序，并据此左右切换", () => {
    const Runtime = new UWebGameRuntime();
    const MutableRuntime = Runtime as unknown as FMutableRuntime;
    MutableRuntime.RuntimePhase = "Battle3C";
    MutableRuntime.ActiveBattleSession = CreateBattleSession({
      EnemyActiveUnitIds: ["enemy01", "enemy02", "enemy03"],
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
          PositionCm: { X: 280, Y: 0, Z: 180 },
          IsEncounterPrimaryEnemy: true
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
          PositionCm: { X: 280, Y: 0, Z: -180 }
        })
      ]
    });

    Runtime.FireBattleAction();
    const Ordered = MutableRuntime.ActiveBattleSession?.TargetSelectOrderedEnemyUnitIds ?? [];
    expect(Ordered).toHaveLength(3);
    const CurrentId = Runtime.GetViewModel().Battle3CState.SelectedTargetId;
    expect(CurrentId).not.toBeNull();
    const CurrentIndex = Ordered.indexOf(CurrentId ?? "");
    expect(CurrentIndex).toBeGreaterThanOrEqual(0);

    Runtime.CycleBattleTarget(1);
    const RightId = Runtime.GetViewModel().Battle3CState.SelectedTargetId;
    expect(RightId).toBe(Ordered[(CurrentIndex + 1) % Ordered.length]);

    Runtime.CycleBattleTarget(-1);
    const LeftBackId = Runtime.GetViewModel().Battle3CState.SelectedTargetId;
    expect(LeftBackId).toBe(Ordered[CurrentIndex]);
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
