import {
  EMeleeCommandType,
  EMeleeEventType,
  EOverworldCommandType,
  EOverworldEventType,
  UMeleeSimulation,
  UOverworldSimulation,
  type FTeamPackageSnapshot,
  type FTypedMeleeEvent,
  type FUnitSnapshot,
  type FUnitCombatRuntimeSnapshot,
  type FUnitStaticConfig,
  type FOverworldEnemyState,
  type FOverworldVector2
} from "@fd/gameplay-core";

import { UDebugConfigStore, type FDebugConfig } from "../debug/UDebugConfigStore";
import { EInputAction, EInputDeviceKinds, type EInputDeviceKind } from "../input/EInputAction";
import { CreateEmptyInputActionFrame, type FInputActionFrame } from "../input/FInputActionFrame";
import { UInputPromptRegistry } from "../input/UInputPromptRegistry";

import type { FContextualActionSlot } from "../input/FInputPrompt";
import type { FInputSnapshot } from "../input/FInputSnapshot";
import type {
  FBattleDamageCueHudState,
  FBattle3CHudState,
  FBattleCameraMode,
  FBattleCommandOption,
  FBattleCommandStage,
  FBattleMeleeActionHudState,
  FBattlePendingActionKind,
  FBattleShotHudState,
  FBattleScriptFocusHudState,
  FHudViewModel,
  FRuntimePhase,
  FVector3Cm
} from "../ui/FHudViewModel";

type TRuntimeListener = (ViewModel: FHudViewModel) => void;

type FRuntimeEventType =
  | "EEncounterTransitionStarted"
  | "EEncounterTransitionFinished"
  | "EBattle3CActionRequested"
  | "EPlayerActionResolved"
  | "ESettlementPreviewRequested"
  | "ESettlementPreviewConfirmed"
  | "EBattleFleeRequested"
  | "ETeamValidationFailed";

interface FImportDebugConfigResult {
  IsSuccess: boolean;
  ErrorMessage: string | null;
}

interface FEncounterContext {
  EncounterId: string;
  EncounterEnemyId: string;
  PlayerTeamId: string;
  EnemyTeamId: string;
  PlayerPosition: FOverworldVector2;
  EnemyPosition: FOverworldVector2;
  BattleAnchorCm: FVector3Cm;
  TriggeredAtMs: number;
}

interface FBattleUnitRuntimeState {
  UnitId: string;
  DisplayName: string;
  TeamId: "Player" | "Enemy";
  ModelAssetPath: string | null;
  HomePositionCm: FVector3Cm;
  PositionCm: FVector3Cm;
  YawDeg: number;
  MaxHp: number;
  CurrentHp: number;
  MaxMp: number;
  CurrentMp: number;
  IsAlive: boolean;
  IsEncounterPrimaryEnemy: boolean;
}

interface FBattle3CSession {
  SessionId: string;
  PlayerTeamId: string;
  EnemyTeamId: string;
  PlayerActiveUnitIds: string[];
  EnemyActiveUnitIds: string[];
  ControlledCharacterId: string;
  CameraMode: FBattleCameraMode;
  CrosshairScreenPosition: {
    X: number;
    Y: number;
  };
  IsAimMode: boolean;
  IsSkillTargetMode: boolean;
  CommandStage?: FBattleCommandStage;
  PendingActionKind?: FBattlePendingActionKind;
  AimCameraYawDeg: number | null;
  AimCameraPitchDeg: number | null;
  SelectedTargetIndex: number;
  AimHoverTargetId: string | null;
  SkillOptions?: FBattleCommandOption[];
  ItemOptions?: FBattleCommandOption[];
  SelectedSkillOptionIndex?: number;
  SelectedItemOptionIndex?: number;
  SelectedRootCommandIndex?: number;
  SelectedSkillOptionId?: string | null;
  TargetSelectOrderedEnemyUnitIds?: string[];
  PendingActionResolvedDetail?: string | null;
  ActionResolveEndsAtMs?: number | null;
  ActionToastText?: string | null;
  ActionToastEndsAtMs?: number | null;
  ScriptStepIndex: number;
  ShotSequence: number;
  DamageCueSequence: number;
  LastShot: FBattleShotHudState | null;
  ActiveMeleeAction?: FBattleMeleeActionHudState | null;
  LastDamageCue?: FBattleDamageCueHudState | null;
  AimFacingSnapshotByUnitId?: Record<string, number>;
  Units: FBattleUnitRuntimeState[];
  ScriptFocus: FBattleScriptFocusHudState | null;
}

interface FBattleScriptStep {
  CameraMode: "EnemyAttackSingle" | "EnemyAttackAOE";
  AttackerUnitId: string;
  TargetUnitIds: string[];
}

const BattleAnchorCm: FVector3Cm = {
  X: 0,
  Y: 0,
  Z: 0
};
const CrosshairMin = 0;
const CrosshairMax = 1;
const CrosshairReferenceWidth = 1600;
const CrosshairReferenceHeight = 900;
const AimCrosshairCenter = 0.5;
const AimYawCenterFanMinHalfAngleDeg = 85;
const AimYawCenterFanMaxHalfAngleDeg = 130;
const AimYawCenterFanPaddingDeg = 8;
const EnemyScriptCameraHoldMs = 680;
const TargetSelectProjectionDepthEpsilonCm = 1;
const BattleDefaultShotDamage = 20;
const BattleHitKnockbackDistanceCm = 40;
const BattleHitReturnDurationMs = 250;
const BattleHitReactionDelaySafetyMs = 18;
const BattleShotTravelSpeedCmPerSec = 3000;
const BattleShotTravelMinMs = 80;
const BattleShotTravelMaxMs = 220;
const BattleDefaultMeleeDamage = 26;
const BattleMeleeRangeCm = 120;
const MeleeRetreatSettleMs = 180;
const MeleeContactDistanceCm = 95;
const MeleeDashSpeedMinCmPerSec = 450;
const MeleeDashMinDurationMs = 220;
const MeleeImpactHoldMs = 800;
const BattleSkillPlaceholderOptions: FBattleCommandOption[] = [
  { OptionId: "skill01", DisplayName: "技能1" },
  { OptionId: "skill02", DisplayName: "技能2" }
];
const BattleItemPlaceholderOptions: FBattleCommandOption[] = [
  { OptionId: "item01", DisplayName: "物品1" },
  { OptionId: "item02", DisplayName: "物品2" }
];
const BattleRootCommandCount = 3;
const BattleLaneTableByTeam: Record<"Player" | "Enemy", Record<number, number[]>> = {
  Player: {
    1: [0],
    2: [150, -150],
    3: [300, 0, -300]
  },
  Enemy: {
    1: [0],
    2: [-120, 120],
    3: [-240, 0, 240]
  }
};

export class UWebGameRuntime {
  private readonly RuntimeListeners: Set<TRuntimeListener>;
  private readonly MeleeSimulation: UMeleeSimulation;
  private readonly OverworldSimulation: UOverworldSimulation;
  private readonly DebugConfigStore: UDebugConfigStore;
  private readonly InputPromptRegistry: UInputPromptRegistry;
  private RuntimePhase: FRuntimePhase;
  private EventLogs: string[];
  private ActiveEncounterContext: FEncounterContext | null;
  private ActiveBattleSession: FBattle3CSession | null;
  private LastEncounterEnemyId: string | null;
  private IsDebugMenuOpen: boolean;
  private DebugConfig: FDebugConfig;
  private LastDebugUpdatedAtIso: string | null;
  private CameraPitchDegrees: number;
  private EncounterPromptText: string | null;
  private EncounterTransitionStartedAtMs: number | null;
  private EncounterTransitionEndAtMs: number | null;
  private EncounterPromptTimerHandle: number | null;
  private EncounterFinishTimerHandle: number | null;
  private EnemyScriptReturnTimerHandle: number | null;
  private ActionResolveTimerHandle: number | null;
  private ActionToastTimerHandle: number | null;
  private readonly HitReturnTimerHandleByUnitId: Map<string, number>;
  private readonly ShotImpactTimerHandleByShotId: Map<number, number>;
  private readonly MeleeTimelineTimerHandles: Set<number>;
  private SettlementSummaryText: string;
  private ActiveInputDevice: EInputDeviceKind = EInputDeviceKinds.KeyboardMouse;
  private LastInputActionFrame: FInputActionFrame;
  private HasKeyboardDirectionalFocus: boolean;

  public constructor() {
    this.RuntimeListeners = new Set();
    this.MeleeSimulation = new UMeleeSimulation();
    this.OverworldSimulation = new UOverworldSimulation();
    this.DebugConfigStore = new UDebugConfigStore();
    this.InputPromptRegistry = new UInputPromptRegistry();
    const LoadedDebugConfig = this.DebugConfigStore.Load();
    this.DebugConfig = LoadedDebugConfig.Config;
    this.LastDebugUpdatedAtIso = LoadedDebugConfig.LastUpdatedAtIso;
    this.RuntimePhase = "Overworld";
    this.EventLogs = [];
    this.ActiveEncounterContext = null;
    this.ActiveBattleSession = null;
    this.LastEncounterEnemyId = null;
    this.IsDebugMenuOpen = false;
    this.CameraPitchDegrees = 0;
    this.EncounterPromptText = null;
    this.EncounterTransitionStartedAtMs = null;
    this.EncounterTransitionEndAtMs = null;
    this.EncounterPromptTimerHandle = null;
    this.EncounterFinishTimerHandle = null;
    this.EnemyScriptReturnTimerHandle = null;
    this.ActionResolveTimerHandle = null;
    this.ActionToastTimerHandle = null;
    this.HitReturnTimerHandleByUnitId = new Map();
    this.ShotImpactTimerHandleByShotId = new Map();
    this.MeleeTimelineTimerHandles = new Set();
    this.SettlementSummaryText = "按 Enter 或手柄 A 返回大地图探索";
    this.LastInputActionFrame = CreateEmptyInputActionFrame();
    this.HasKeyboardDirectionalFocus = false;

    this.SyncCameraPitchFromConfig();
    this.BindOverworldEvents();
  }

  public StartGame(): void {
    this.ClearPhaseTimers();
    this.RuntimePhase = "Overworld";
    this.ActiveEncounterContext = null;
    this.ActiveBattleSession = null;
    this.LastEncounterEnemyId = null;
    this.EventLogs = [];
    this.EncounterPromptText = null;
    this.EncounterTransitionStartedAtMs = null;
    this.EncounterTransitionEndAtMs = null;
    this.SettlementSummaryText = "按 Enter 或手柄 A 返回大地图探索";
    this.HasKeyboardDirectionalFocus = false;
    this.SyncCameraPitchFromConfig();

    this.OverworldSimulation.SubmitCommand({
      Type: EOverworldCommandType.InitializeWorld,
      Config: {
        EnemyCount: 4,
        WorldHalfSize: 3000,
        SafePoint: { X: 0, Z: 0 },
        Tuning: {
          WalkSpeed: this.DebugConfig.WalkSpeed,
          RunSpeed: this.DebugConfig.RunSpeed,
          EncounterDistance: 120,
          PlayerRadius: 45,
          EnemyRadius: 75
        }
      }
    });

    this.NotifyRuntimeUpdated();
  }

  public ConsumeInputSnapshot(InputSnapshot: FInputSnapshot): void {
    const PreviousInputActionFrame = this.LastInputActionFrame;
    this.LastInputActionFrame = InputSnapshot.ActionFrame;
    if (InputSnapshot.ActiveInputDevice) {
      this.ActiveInputDevice = InputSnapshot.ActiveInputDevice;
    }

    if (this.IsActionTriggered(InputSnapshot, EInputAction.SystemToggleDebug)) {
      this.ToggleDebugMenu();
    }

    if (this.IsActionTriggered(InputSnapshot, EInputAction.SystemRestart)) {
      this.StartGame();
      return;
    }

    if (
      this.IsActionTriggered(InputSnapshot, EInputAction.SystemForceSettlement) &&
      (this.RuntimePhase === "Battle3C" || this.RuntimePhase === "EncounterTransition")
    ) {
      this.RequestSettlementPreview("调试触发（Alt+S）");
      return;
    }

    switch (this.RuntimePhase) {
      case "Overworld":
        this.ConsumeOverworldInput(InputSnapshot);
        return;
      case "Battle3C":
        this.ConsumeBattle3CInput(InputSnapshot, PreviousInputActionFrame);
        return;
      case "SettlementPreview":
        if (this.IsActionTriggered(InputSnapshot, EInputAction.UIConfirm)) {
          this.ConfirmSettlementPreview();
        }
        return;
      case "EncounterTransition":
      default:
        return;
    }
  }

  private IsActionTriggered(InputSnapshot: FInputSnapshot, Action: EInputAction): boolean {
    const Value = InputSnapshot.ActionFrame?.Actions?.[Action];
    return Value?.IsTriggered === true;
  }

  private IsActionTriggeredByKeyboardMouse(
    InputSnapshot: FInputSnapshot,
    Action: EInputAction
  ): boolean {
    const Value = InputSnapshot.ActionFrame?.Actions?.[Action];
    return Value?.IsTriggered === true && Value.SourceDevice === EInputDeviceKinds.KeyboardMouse;
  }

  private HasBattleHoldHudStateChanged(
    CurrentFrame: FInputActionFrame,
    PreviousFrame: FInputActionFrame
  ): boolean {
    return (
      this.HasHoldActionStateChanged(EInputAction.BattleFlee, CurrentFrame, PreviousFrame) ||
      this.HasHoldActionStateChanged(
        EInputAction.BattleSwitchCharacter,
        CurrentFrame,
        PreviousFrame
      )
    );
  }

  private HasHoldActionStateChanged(
    Action: EInputAction,
    CurrentFrame: FInputActionFrame,
    PreviousFrame: FInputActionFrame
  ): boolean {
    const CurrentValue = CurrentFrame.Actions[Action];
    const PreviousValue = PreviousFrame.Actions[Action];
    const IsCurrentHeld = CurrentValue?.IsHeld === true;
    const IsPreviousHeld = PreviousValue?.IsHeld === true;
    if (IsCurrentHeld !== IsPreviousHeld) {
      return true;
    }

    const CurrentProgress = IsCurrentHeld ? this.Clamp(CurrentValue?.Axis ?? 0, 0, 1) : 0;
    const PreviousProgress = IsPreviousHeld ? this.Clamp(PreviousValue?.Axis ?? 0, 0, 1) : 0;
    return Math.abs(CurrentProgress - PreviousProgress) > 0.001;
  }

  public ToggleBattleAim(): void {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return;
    }

    this.EnsureBattleCommandState(this.ActiveBattleSession);
    if (this.ActiveBattleSession.CommandStage !== "Root") {
      return;
    }

    this.ActiveBattleSession.IsAimMode = !this.ActiveBattleSession.IsAimMode;
    if (this.ActiveBattleSession.IsAimMode) {
      this.SetCommandStage(this.ActiveBattleSession, "Root");
      this.ActiveBattleSession.CrosshairScreenPosition = {
        X: AimCrosshairCenter,
        Y: AimCrosshairCenter
      };
      this.AlignSelectedTargetForControlledCharacter();
      this.ActiveBattleSession.AimFacingSnapshotByUnitId = {};
      const ControlledUnit = this.FindBattleUnit(this.ActiveBattleSession.ControlledCharacterId);
      this.ActiveBattleSession.AimCameraYawDeg = ControlledUnit?.YawDeg ?? 0;
      this.ActiveBattleSession.AimCameraPitchDeg = 0;
      this.CaptureAimFacingSnapshot(this.ActiveBattleSession.ControlledCharacterId);
      this.AlignAimFacingToEnemyCenterAxis();
      this.SyncAimCameraYawToControlledFacing();
    } else {
      this.RestoreFacingAfterAim();
    }
    this.ActiveBattleSession.CameraMode = this.ResolveBattleControlCameraMode(
      this.ActiveBattleSession
    );
    this.EmitRuntimeEvent("EBattle3CActionRequested", "ToggleAim");
    this.NotifyRuntimeUpdated();
  }

  public ExitBattleAimMode(): void {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return;
    }
    this.EnsureBattleCommandState(this.ActiveBattleSession);
    if (!this.ActiveBattleSession.IsAimMode) {
      return;
    }

    this.ActiveBattleSession.IsAimMode = false;
    this.RestoreFacingAfterAim();
    this.ActiveBattleSession.CameraMode = this.ResolveBattleControlCameraMode(
      this.ActiveBattleSession
    );
    this.EmitRuntimeEvent("EBattle3CActionRequested", "CancelAim");
    this.NotifyRuntimeUpdated();
  }

  public RequestUICancelAction(): boolean {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return false;
    }
    if (this.ActiveBattleSession.IsAimMode) {
      this.ExitBattleAimMode();
      return true;
    }
    return this.CancelBattleCommandStage(this.ActiveBattleSession);
  }

  public FireBattleAction(): void {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return;
    }

    this.EnsureBattleCommandState(this.ActiveBattleSession);
    if (this.ActiveBattleSession.IsAimMode) {
      this.SyncAimCameraYawToControlledFacing();
      this.EmitBattleShotEvent();
      this.EmitRuntimeEvent("EBattle3CActionRequested", "FireAim");
      this.ActiveBattleSession.CameraMode = this.ResolveBattleControlCameraMode(
        this.ActiveBattleSession
      );
      this.NotifyRuntimeUpdated();
      return;
    }

    switch (this.ActiveBattleSession.CommandStage) {
      case "Root":
        this.BeginTargetSelectionFromAttack(this.ActiveBattleSession);
        return;
      case "SkillMenu":
        this.ConfirmSkillSelectionAndEnterTargetSelection(this.ActiveBattleSession);
        return;
      case "ItemMenu":
        this.ConfirmItemSelectionAndEnterTargetSelection(this.ActiveBattleSession);
        return;
      case "TargetSelect":
        this.CommitTargetSelectionAction(this.ActiveBattleSession);
        return;
      case "ActionResolve":
        return;
      default:
        return;
    }
  }

  public SetBattleAimHoverTarget(UnitId: string | null): void {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return;
    }
    if (!this.ActiveBattleSession.IsAimMode) {
      return;
    }

    const EnemyTargets = this.GetEnemyBattleUnits(this.ActiveBattleSession.Units);
    const NextHoverId =
      UnitId !== null
        ? (EnemyTargets.find((Target) => Target.UnitId === UnitId)?.UnitId ?? null)
        : null;
    if (this.ActiveBattleSession.AimHoverTargetId === NextHoverId) {
      return;
    }

    this.ActiveBattleSession.AimHoverTargetId = NextHoverId;
    this.NotifyRuntimeUpdated();
  }

  public SwitchControlledCharacter(): boolean {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return false;
    }
    this.EnsureBattleCommandState(this.ActiveBattleSession);
    if (!this.IsBattleIdleControlState(this.ActiveBattleSession)) {
      return false;
    }

    const AlivePlayerUnitIds = this.ActiveBattleSession.PlayerActiveUnitIds.filter((UnitId) => {
      const Unit = this.FindBattleUnit(UnitId);
      return Unit?.IsAlive ?? false;
    });
    if (AlivePlayerUnitIds.length <= 1) {
      return false;
    }
    const DidSwitch = this.SwitchToNextAliveControlledCharacter(
      this.ActiveBattleSession,
      "SwitchCharacter"
    );
    if (!DidSwitch) {
      return false;
    }
    this.NotifyRuntimeUpdated();
    return true;
  }

  public ToggleBattleSkillTargetMode(): void {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return;
    }

    this.EnsureBattleCommandState(this.ActiveBattleSession);
    if (this.ActiveBattleSession.CommandStage === "SkillMenu") {
      this.ReturnToRootCommandStage(this.ActiveBattleSession);
      this.EmitRuntimeEvent("EBattle3CActionRequested", "SkillMenu:Close");
      this.NotifyRuntimeUpdated();
      return;
    }
    if (this.ActiveBattleSession.CommandStage !== "Root") {
      return;
    }

    this.EnterSkillMenuStage(this.ActiveBattleSession);
    this.EmitRuntimeEvent("EBattle3CActionRequested", "SkillMenu:Open");
    this.NotifyRuntimeUpdated();
  }

  public ToggleBattleItemMenu(): void {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return;
    }

    this.EnsureBattleCommandState(this.ActiveBattleSession);
    if (this.ActiveBattleSession.CommandStage === "ItemMenu") {
      this.ReturnToRootCommandStage(this.ActiveBattleSession);
      this.EmitRuntimeEvent("EBattle3CActionRequested", "ItemMenu:Close");
      this.NotifyRuntimeUpdated();
      return;
    }
    if (this.ActiveBattleSession.CommandStage !== "Root") {
      return;
    }

    this.EnterItemMenuStage(this.ActiveBattleSession);
    this.EmitRuntimeEvent("EBattle3CActionRequested", "ItemMenu:Open");
    this.NotifyRuntimeUpdated();
  }

  public ActivateBattleSkillOption(OptionIndex: number): void {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return;
    }

    this.EnsureBattleCommandState(this.ActiveBattleSession);
    if (this.ActiveBattleSession.CommandStage !== "SkillMenu") {
      return;
    }

    this.SetSkillMenuOptionIndex(this.ActiveBattleSession, OptionIndex);
    this.ConfirmSkillSelectionAndEnterTargetSelection(this.ActiveBattleSession);
  }

  public ActivateBattleItemOption(OptionIndex: number): void {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return;
    }

    this.EnsureBattleCommandState(this.ActiveBattleSession);
    if (this.ActiveBattleSession.CommandStage !== "ItemMenu") {
      return;
    }

    this.SetItemMenuOptionIndex(this.ActiveBattleSession, OptionIndex);
    this.ConfirmItemSelectionAndEnterTargetSelection(this.ActiveBattleSession);
  }

  public CycleBattleTarget(Direction: number): void {
    if (
      !this.ActiveBattleSession ||
      this.RuntimePhase !== "Battle3C" ||
      this.ActiveBattleSession.IsAimMode
    ) {
      return;
    }

    this.EnsureBattleCommandState(this.ActiveBattleSession);
    if (this.ActiveBattleSession.CommandStage !== "TargetSelect") {
      return;
    }

    const SelectableTargets = this.ResolveSelectableBattleTargetsForCurrentCommand(
      this.ActiveBattleSession
    );
    if (SelectableTargets.length <= 1) {
      return;
    }

    const Delta = Direction >= 0 ? 1 : -1;
    // 物品目标阶段使用镜像机位，左右体感与常规目标特写相反，这里做方向修正。
    const EffectiveDelta = this.ActiveBattleSession.PendingActionKind === "Item" ? -Delta : Delta;
    const NextIndex =
      (this.ActiveBattleSession.SelectedTargetIndex + EffectiveDelta + SelectableTargets.length) %
      SelectableTargets.length;
    this.ActiveBattleSession.SelectedTargetIndex = NextIndex;
    this.EmitRuntimeEvent(
      "EBattle3CActionRequested",
      `CycleTarget:${Delta > 0 ? "Right" : "Left"}`
    );
    this.NotifyRuntimeUpdated();
  }

  public CycleBattleMenuSelection(Direction: number): void {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return;
    }

    this.EnsureBattleCommandState(this.ActiveBattleSession);
    const Delta = Direction >= 0 ? 1 : -1;
    if (this.ActiveBattleSession.CommandStage === "SkillMenu") {
      this.CycleSkillMenuOption(this.ActiveBattleSession, Delta);
      return;
    }

    if (this.ActiveBattleSession.CommandStage === "ItemMenu") {
      this.CycleItemMenuOption(this.ActiveBattleSession, Delta);
    }
  }

  public RequestSettlementPreview(Reason = "手动触发"): void {
    if (
      this.RuntimePhase !== "Battle3C" &&
      this.RuntimePhase !== "EncounterTransition" &&
      this.RuntimePhase !== "SettlementPreview"
    ) {
      return;
    }

    this.RuntimePhase = "SettlementPreview";
    this.ClearPhaseTimers();
    if (this.ActiveBattleSession) {
      this.ActiveBattleSession.CameraMode = "SettlementCam";
      this.ActiveBattleSession.ScriptFocus = null;
    }
    const EncounterEnemyId = this.ActiveEncounterContext?.EncounterEnemyId ?? "UNKNOWN";
    this.SettlementSummaryText = `结算预览：遭遇敌人 ${EncounterEnemyId}，原因：${Reason}`;
    this.EmitRuntimeEvent("ESettlementPreviewRequested", Reason);
    this.NotifyRuntimeUpdated();
  }

  public ConfirmSettlementPreview(): void {
    if (this.RuntimePhase !== "SettlementPreview") {
      return;
    }

    this.ReturnToOverworldFromBattle("ESettlementPreviewConfirmed");
  }

  public FleeBattleToOverworld(): boolean {
    if (this.RuntimePhase !== "Battle3C" || !this.ActiveBattleSession) {
      return false;
    }
    this.EnsureBattleCommandState(this.ActiveBattleSession);
    if (!this.IsBattleIdleControlState(this.ActiveBattleSession)) {
      return false;
    }

    this.ReturnToOverworldFromBattle("EBattleFleeRequested");
    return true;
  }

  private ReturnToOverworldFromBattle(
    EventType: "ESettlementPreviewConfirmed" | "EBattleFleeRequested"
  ): void {
    if (this.ActiveEncounterContext) {
      this.OverworldSimulation.SubmitCommand({
        Type: EOverworldCommandType.ResolveEncounter
      });
      this.OverworldSimulation.SubmitCommand({
        Type: EOverworldCommandType.ResetPlayerToSafePoint
      });
      this.LastEncounterEnemyId = this.ActiveEncounterContext.EncounterEnemyId;
    }

    this.ClearPhaseTimers();
    this.RuntimePhase = "Overworld";
    this.ActiveEncounterContext = null;
    this.ActiveBattleSession = null;
    this.EncounterPromptText = null;
    this.EncounterTransitionStartedAtMs = null;
    this.EncounterTransitionEndAtMs = null;
    this.EmitRuntimeEvent(EventType);
    this.NotifyRuntimeUpdated();
  }

  private EnsureBattleCommandState(Session: FBattle3CSession): void {
    Session.CommandStage =
      Session.CommandStage ?? (Session.IsSkillTargetMode ? "TargetSelect" : "Root");
    Session.PendingActionKind = Session.PendingActionKind ?? null;
    this.EnsureBattleCommandOptions(Session);
    this.EnsureBattleCommandSelection(Session);
    this.EnsureBattleActionResolveState(Session);
    Session.IsSkillTargetMode = Session.CommandStage === "TargetSelect";
  }

  private EnsureBattleCommandOptions(Session: FBattle3CSession): void {
    Session.SkillOptions = this.ResolveBattleCommandOptions(
      Session.SkillOptions,
      BattleSkillPlaceholderOptions
    );
    Session.ItemOptions = this.ResolveBattleCommandOptions(
      Session.ItemOptions,
      BattleItemPlaceholderOptions
    );
  }

  private EnsureBattleCommandSelection(Session: FBattle3CSession): void {
    Session.SelectedSkillOptionIndex = this.ResolveWrappedIndex(
      Session.SelectedSkillOptionIndex ?? 0,
      Session.SkillOptions?.length ?? 0
    );
    Session.SelectedItemOptionIndex = this.ResolveWrappedIndex(
      Session.SelectedItemOptionIndex ?? 0,
      Session.ItemOptions?.length ?? 0
    );
    Session.SelectedRootCommandIndex = this.ResolveWrappedIndex(
      Session.SelectedRootCommandIndex ?? 0,
      BattleRootCommandCount
    );
    Session.SelectedSkillOptionId = Session.SelectedSkillOptionId ?? null;
  }

  private EnsureBattleActionResolveState(Session: FBattle3CSession): void {
    Session.TargetSelectOrderedEnemyUnitIds = Session.TargetSelectOrderedEnemyUnitIds ?? [];
    Session.PendingActionResolvedDetail = Session.PendingActionResolvedDetail ?? null;
    Session.ActionResolveEndsAtMs = Session.ActionResolveEndsAtMs ?? null;
    Session.ActionToastText = Session.ActionToastText ?? null;
    Session.ActionToastEndsAtMs = Session.ActionToastEndsAtMs ?? null;
    Session.ActiveMeleeAction = Session.ActiveMeleeAction ?? null;
    Session.DamageCueSequence = Session.DamageCueSequence ?? 0;
    Session.LastDamageCue = Session.LastDamageCue ?? null;
  }

  private ResolveBattleCommandOptions(
    CurrentOptions: FBattleCommandOption[] | undefined,
    DefaultOptions: FBattleCommandOption[]
  ): FBattleCommandOption[] {
    if (CurrentOptions && CurrentOptions.length > 0) {
      return CurrentOptions;
    }
    return [...DefaultOptions];
  }

  private CycleSkillMenuOption(Session: FBattle3CSession, Delta: number): void {
    const SkillOptions = Session.SkillOptions ?? [];
    if (SkillOptions.length <= 1) {
      return;
    }

    const CurrentIndex = Session.SelectedSkillOptionIndex ?? 0;
    Session.SelectedSkillOptionIndex =
      (CurrentIndex + Delta + SkillOptions.length) % SkillOptions.length;
    this.EmitRuntimeEvent(
      "EBattle3CActionRequested",
      `SkillMenu:Cycle:${Delta > 0 ? "Down" : "Up"}`
    );
    this.NotifyRuntimeUpdated();
  }

  private SetSkillMenuOptionIndex(Session: FBattle3CSession, NextIndex: number): void {
    const SkillOptions = Session.SkillOptions ?? [];
    if (SkillOptions.length < 1) {
      return;
    }
    Session.SelectedSkillOptionIndex = this.ResolveWrappedIndex(NextIndex, SkillOptions.length);
  }

  private CycleItemMenuOption(Session: FBattle3CSession, Delta: number): void {
    const ItemOptions = Session.ItemOptions ?? [];
    if (ItemOptions.length <= 1) {
      return;
    }

    const CurrentIndex = Session.SelectedItemOptionIndex ?? 0;
    Session.SelectedItemOptionIndex =
      (CurrentIndex + Delta + ItemOptions.length) % ItemOptions.length;
    this.EmitRuntimeEvent(
      "EBattle3CActionRequested",
      `ItemMenu:Cycle:${Delta > 0 ? "Down" : "Up"}`
    );
    this.NotifyRuntimeUpdated();
  }

  private SetItemMenuOptionIndex(Session: FBattle3CSession, NextIndex: number): void {
    const ItemOptions = Session.ItemOptions ?? [];
    if (ItemOptions.length < 1) {
      return;
    }
    Session.SelectedItemOptionIndex = this.ResolveWrappedIndex(NextIndex, ItemOptions.length);
  }

  private SetCommandStage(Session: FBattle3CSession, Stage: FBattleCommandStage): void {
    Session.CommandStage = Stage;
    Session.IsSkillTargetMode = Stage === "TargetSelect";
  }

  private ReturnToRootCommandStage(Session: FBattle3CSession): void {
    this.SetCommandStage(Session, "Root");
    Session.PendingActionKind = null;
    Session.PendingActionResolvedDetail = null;
    Session.TargetSelectOrderedEnemyUnitIds = [];
    Session.ActionResolveEndsAtMs = null;
    Session.AimHoverTargetId = null;
    Session.ActiveMeleeAction = null;
    this.ClearAllMeleeTimelineTimers();
    Session.CameraMode = this.ResolveBattleControlCameraMode(Session);
  }

  private EnterSkillMenuStage(Session: FBattle3CSession): void {
    if (Session.IsAimMode) {
      Session.IsAimMode = false;
      this.RestoreFacingAfterAim();
    }
    this.SetCommandStage(Session, "SkillMenu");
    Session.PendingActionKind = null;
    Session.TargetSelectOrderedEnemyUnitIds = [];
    Session.ActionResolveEndsAtMs = null;
    Session.ActiveMeleeAction = null;
    this.ClearAllMeleeTimelineTimers();
    Session.CameraMode = this.ResolveBattleControlCameraMode(Session);
  }

  private EnterItemMenuStage(Session: FBattle3CSession): void {
    if (Session.IsAimMode) {
      Session.IsAimMode = false;
      this.RestoreFacingAfterAim();
    }
    this.SetCommandStage(Session, "ItemMenu");
    Session.PendingActionKind = null;
    Session.TargetSelectOrderedEnemyUnitIds = [];
    Session.ActionResolveEndsAtMs = null;
    Session.ActiveMeleeAction = null;
    this.ClearAllMeleeTimelineTimers();
    Session.CameraMode = this.ResolveBattleControlCameraMode(Session);
  }

  private BeginTargetSelectionFromAttack(Session: FBattle3CSession): void {
    const EnemyTargets = this.GetEnemyBattleUnits(Session.Units).filter((Unit) => Unit.IsAlive);
    if (EnemyTargets.length < 1) {
      this.EmitRuntimeEvent("EBattle3CActionRequested", "TargetSelect:NoEnemy");
      this.NotifyRuntimeUpdated();
      return;
    }

    if (Session.IsAimMode) {
      Session.IsAimMode = false;
      this.RestoreFacingAfterAim();
    }
    this.EnterTargetSelectionStage(Session, "Attack");
    this.EmitRuntimeEvent("EBattle3CActionRequested", "TargetSelect:AttackStart");
    this.NotifyRuntimeUpdated();
  }

  private ConfirmSkillSelectionAndEnterTargetSelection(Session: FBattle3CSession): void {
    const SkillOptions = Session.SkillOptions ?? [];
    if (SkillOptions.length < 1) {
      this.EmitRuntimeEvent("EBattle3CActionRequested", "SkillMenu:NoOption");
      this.NotifyRuntimeUpdated();
      return;
    }

    const SelectedIndex = this.ResolveWrappedIndex(
      Session.SelectedSkillOptionIndex ?? 0,
      SkillOptions.length
    );
    const SelectedSkill = SkillOptions[SelectedIndex];
    Session.SelectedSkillOptionIndex = SelectedIndex;
    Session.SelectedSkillOptionId = SelectedSkill.OptionId;

    const EnemyTargets = this.GetEnemyBattleUnits(Session.Units).filter((Unit) => Unit.IsAlive);
    if (EnemyTargets.length < 1) {
      this.EmitRuntimeEvent(
        "EBattle3CActionRequested",
        `TargetSelect:SkillNoEnemy:${SelectedSkill.OptionId}`
      );
      this.NotifyRuntimeUpdated();
      return;
    }

    this.EnterTargetSelectionStage(Session, "Skill");
    this.EmitRuntimeEvent(
      "EBattle3CActionRequested",
      `TargetSelect:SkillStart:${SelectedSkill.OptionId}`
    );
    this.NotifyRuntimeUpdated();
  }

  private EnterTargetSelectionStage(
    Session: FBattle3CSession,
    PendingActionKind: Exclude<FBattlePendingActionKind, null>
  ): void {
    this.SetCommandStage(Session, "TargetSelect");
    this.ClearAllMeleeTimelineTimers();
    Session.PendingActionKind = PendingActionKind;
    Session.PendingActionResolvedDetail = null;
    Session.ActionResolveEndsAtMs = null;
    Session.ActiveMeleeAction = null;
    Session.AimHoverTargetId = null;
    this.RebuildTargetSelectOrder(Session);
    this.AlignSelectedTargetForControlledCharacter();
    Session.CameraMode = this.ResolveBattleControlCameraMode(Session);
  }

  private ConfirmItemSelectionAndEnterTargetSelection(Session: FBattle3CSession): void {
    const ItemOptions = Session.ItemOptions ?? [];
    if (ItemOptions.length < 1) {
      this.ReturnToRootCommandStage(Session);
      this.EmitRuntimeEvent("EBattle3CActionRequested", "ItemMenu:NoOption");
      this.NotifyRuntimeUpdated();
      return;
    }

    const SelectedIndex = this.ResolveWrappedIndex(
      Session.SelectedItemOptionIndex ?? 0,
      ItemOptions.length
    );
    Session.SelectedItemOptionIndex = SelectedIndex;
    const SelectedItem = ItemOptions[SelectedIndex];

    const PlayerTargets = this.ResolveSelectablePlayerTargets(Session);
    if (PlayerTargets.length < 1) {
      this.EmitRuntimeEvent(
        "EBattle3CActionRequested",
        `TargetSelect:ItemNoPlayer:${SelectedItem.OptionId}`
      );
      this.NotifyRuntimeUpdated();
      return;
    }

    this.EnterTargetSelectionStage(Session, "Item");
    this.EmitRuntimeEvent(
      "EBattle3CActionRequested",
      `TargetSelect:ItemStart:${SelectedItem.OptionId}`
    );
    this.NotifyRuntimeUpdated();
  }

  private CommitTargetSelectionAction(Session: FBattle3CSession): void {
    const PendingAction = Session.PendingActionKind;
    if (!PendingAction) {
      this.ReturnToRootCommandStage(Session);
      this.NotifyRuntimeUpdated();
      return;
    }

    const TargetId = this.ResolveCurrentBattleTargetForCommandSelection(Session) ?? "MISS";
    if (PendingAction === "Skill") {
      this.EmitBattleShotEvent();
    }
    this.EmitRuntimeEvent("EBattle3CActionRequested", `ConfirmTarget:${PendingAction}:${TargetId}`);
    const ActionDisplayName =
      PendingAction === "Skill"
        ? this.ResolveSelectedSkillDisplayName(Session)
        : PendingAction === "Item"
          ? this.ResolveSelectedItemDisplayName(Session)
          : "近战攻击";
    const TargetDisplayName = this.ResolveBattleTargetDisplayName(TargetId);
    Session.PendingActionResolvedDetail = `${PendingAction}:${TargetId}`;
    if (PendingAction === "Item") {
      this.EmitRuntimeEvent(
        "EBattle3CActionRequested",
        `UseItemPlaceholder:${this.ResolveSelectedItemOptionId(Session) ?? "UNKNOWN"}:${TargetId}`
      );
    }

    if (PendingAction === "Attack") {
      this.StartMeleeResolveSequence(Session, TargetId, ActionDisplayName, TargetDisplayName);
      this.NotifyRuntimeUpdated();
      return;
    }

    this.ShowBattleActionToast(Session, `已执行 ${ActionDisplayName} -> ${TargetDisplayName}`);
    this.EnterActionResolveStage(Session);
    this.NotifyRuntimeUpdated();
  }

  private CancelBattleCommandStage(Session: FBattle3CSession): boolean {
    this.EnsureBattleCommandState(Session);
    if (Session.CommandStage === "TargetSelect") {
      if (Session.PendingActionKind === "Skill") {
        this.SetCommandStage(Session, "SkillMenu");
      } else if (Session.PendingActionKind === "Item") {
        this.SetCommandStage(Session, "ItemMenu");
      } else {
        this.SetCommandStage(Session, "Root");
      }
      Session.PendingActionKind = null;
      Session.PendingActionResolvedDetail = null;
      Session.TargetSelectOrderedEnemyUnitIds = [];
      Session.ActionResolveEndsAtMs = null;
      Session.ActiveMeleeAction = null;
      this.ClearAllMeleeTimelineTimers();
      Session.AimHoverTargetId = null;
      Session.CameraMode = this.ResolveBattleControlCameraMode(Session);
      this.EmitRuntimeEvent("EBattle3CActionRequested", "CancelTargetSelect");
      this.NotifyRuntimeUpdated();
      return true;
    }

    if (Session.CommandStage === "SkillMenu" || Session.CommandStage === "ItemMenu") {
      this.ReturnToRootCommandStage(Session);
      this.EmitRuntimeEvent("EBattle3CActionRequested", "CancelCommandMenu");
      this.NotifyRuntimeUpdated();
      return true;
    }

    return false;
  }

  private EnterActionResolveStage(Session: FBattle3CSession, DurationMsOverride?: number): void {
    const DurationMs =
      DurationMsOverride !== undefined
        ? Math.max(Math.round(DurationMsOverride), 1)
        : Math.max(Math.round(this.DebugConfig.ActionResolveDurationSec * 1000), 1);
    const SessionId = Session.SessionId;
    Session.IsAimMode = false;
    Session.ScriptFocus = null;
    this.SetCommandStage(Session, "ActionResolve");
    Session.PendingActionKind = null;
    const IsAttackResolve = (Session.PendingActionResolvedDetail ?? "").startsWith("Attack:");
    if (!IsAttackResolve) {
      Session.ActiveMeleeAction = null;
      this.ClearAllMeleeTimelineTimers();
    }
    Session.AimHoverTargetId = null;
    Session.ActionResolveEndsAtMs = Date.now() + DurationMs;
    Session.CameraMode = this.ResolveBattleControlCameraMode(Session);

    this.ClearActionResolveTimer();
    this.ActionResolveTimerHandle = this.SetRuntimeTimeout(() => {
      this.ActionResolveTimerHandle = null;
      if (
        this.RuntimePhase !== "Battle3C" ||
        !this.ActiveBattleSession ||
        this.ActiveBattleSession.SessionId !== SessionId
      ) {
        return;
      }
      this.FinishActionResolveStage(this.ActiveBattleSession);
    }, DurationMs);
  }

  private FinishActionResolveStage(Session: FBattle3CSession): void {
    if (Session.CommandStage !== "ActionResolve") {
      return;
    }
    const EventDetail = Session.PendingActionResolvedDetail ?? "Unknown";
    this.ReturnToRootCommandStage(Session);
    if (EventDetail.startsWith("Attack:")) {
      this.SwitchToNextAliveControlledCharacter(Session, "AutoSwitchCharacterAfterAttack");
    }
    this.EmitRuntimeEvent("EPlayerActionResolved", EventDetail);
    this.NotifyRuntimeUpdated();
  }

  private ShowBattleActionToast(Session: FBattle3CSession, ToastText: string): void {
    const DurationMs = Math.max(
      Math.round(this.DebugConfig.ActionResolveToastDurationSec * 1000),
      1
    );
    const SessionId = Session.SessionId;
    Session.ActionToastText = ToastText;
    Session.ActionToastEndsAtMs = Date.now() + DurationMs;

    this.ClearActionToastTimer();
    this.ActionToastTimerHandle = this.SetRuntimeTimeout(() => {
      this.ActionToastTimerHandle = null;
      if (
        this.RuntimePhase !== "Battle3C" ||
        !this.ActiveBattleSession ||
        this.ActiveBattleSession.SessionId !== SessionId
      ) {
        return;
      }
      if (
        this.ActiveBattleSession.ActionToastEndsAtMs !== null &&
        this.ActiveBattleSession.ActionToastEndsAtMs !== undefined &&
        this.ActiveBattleSession.ActionToastEndsAtMs > Date.now()
      ) {
        return;
      }
      this.ActiveBattleSession.ActionToastText = null;
      this.ActiveBattleSession.ActionToastEndsAtMs = null;
      this.NotifyRuntimeUpdated();
    }, DurationMs);
  }

  private StartMeleeResolveSequence(
    Session: FBattle3CSession,
    TargetId: string,
    ActionDisplayName: string,
    TargetDisplayName: string
  ): void {
    const Attacker = this.FindBattleUnit(Session.ControlledCharacterId);
    const Target = this.FindBattleUnit(TargetId);
    if (!Attacker || !Target) {
      Session.PendingActionResolvedDetail = `Attack:${TargetId}`;
      this.ShowBattleActionToast(Session, `已执行 ${ActionDisplayName} -> ${TargetDisplayName}`);
      this.EnterActionResolveStage(Session);
      return;
    }

    const AttackerHome = Attacker.HomePositionCm ?? Attacker.PositionCm;
    const StartPositionCm = { ...AttackerHome };
    const ContactPositionCm = this.ResolveMeleeContactPositionCm(Attacker, Target);
    const DashDistanceCm = Math.hypot(
      ContactPositionCm.X - StartPositionCm.X,
      ContactPositionCm.Z - StartPositionCm.Z
    );
    const DashSpeedCmPerSec = Math.max(this.DebugConfig.RunSpeed, MeleeDashSpeedMinCmPerSec);
    const DashDurationMs = this.ResolveMeleeDashDurationMs(DashDistanceCm, DashSpeedCmPerSec);
    const NowMs = Date.now();
    const RetreatStartAtMs = NowMs;
    const RetreatEndAtMs = RetreatStartAtMs + MeleeRetreatSettleMs;
    const DashStartAtMs = RetreatEndAtMs;
    const DashEndAtMs = DashStartAtMs + DashDurationMs;
    const ReturnStartAtMs = DashEndAtMs + MeleeImpactHoldMs;
    const ReturnEndAtMs = ReturnStartAtMs;

    Session.PendingActionResolvedDetail = `Attack:${TargetId}`;
    Session.ActiveMeleeAction = {
      ActionId: Session.ShotSequence + 1,
      AttackerUnitId: Attacker.UnitId,
      TargetUnitId: Target.UnitId,
      Phase: "Retreat",
      RetreatStartAtMs,
      RetreatEndAtMs,
      DashStartAtMs,
      DashEndAtMs,
      ReturnStartAtMs,
      ReturnEndAtMs,
      StartPositionCm,
      ContactPositionCm
    };
    Attacker.PositionCm = { ...StartPositionCm };
    Session.ShotSequence += 1;

    const TotalDurationMs = Math.max(ReturnStartAtMs - NowMs + 16, 1);
    this.ShowBattleActionToast(Session, `已执行 ${ActionDisplayName} -> ${TargetDisplayName}`);
    this.EnterActionResolveStage(Session, TotalDurationMs);

    this.ClearAllMeleeTimelineTimers();
    const SessionId = Session.SessionId;
    const ActionId = Session.ActiveMeleeAction.ActionId;
    this.RegisterMeleeTimelineTimer(
      () => {
        if (!this.IsMeleeActionStillValid(SessionId, ActionId)) {
          return;
        }
        if (!this.ActiveBattleSession?.ActiveMeleeAction) {
          return;
        }
        this.ActiveBattleSession.ActiveMeleeAction.Phase = "Advance";
        this.NotifyRuntimeUpdated();
      },
      Math.max(RetreatEndAtMs - Date.now(), 0)
    );

    this.RegisterMeleeTimelineTimer(
      () => {
        this.ResolveMeleeImpact(SessionId, ActionId, Attacker.UnitId, Target.UnitId, DashEndAtMs);
      },
      Math.max(DashEndAtMs - Date.now(), 0)
    );

    this.RegisterMeleeTimelineTimer(
      () => {
        if (!this.IsMeleeActionStillValid(SessionId, ActionId)) {
          return;
        }
        if (!this.ActiveBattleSession || !this.ActiveBattleSession.ActiveMeleeAction) {
          return;
        }
        const CurrentAttacker = this.FindBattleUnit(Attacker.UnitId);
        if (CurrentAttacker) {
          CurrentAttacker.PositionCm = { ...StartPositionCm };
        }
        this.ActiveBattleSession.ActiveMeleeAction = null;
        this.NotifyRuntimeUpdated();
      },
      Math.max(ReturnStartAtMs - Date.now(), 0)
    );
  }

  private ResolveMeleeContactPositionCm(
    Attacker: FBattleUnitRuntimeState,
    Target: FBattleUnitRuntimeState
  ): FVector3Cm {
    const AttackerHome = Attacker.HomePositionCm ?? Attacker.PositionCm;
    const TargetHome = Target.HomePositionCm ?? Target.PositionCm;
    const DeltaX = TargetHome.X - AttackerHome.X;
    const DeltaZ = TargetHome.Z - AttackerHome.Z;
    const Distance = Math.hypot(DeltaX, DeltaZ);
    if (Distance <= 1e-4) {
      return { ...AttackerHome };
    }
    const InvDistance = 1 / Distance;
    return {
      X: TargetHome.X - DeltaX * InvDistance * MeleeContactDistanceCm,
      Y: AttackerHome.Y,
      Z: TargetHome.Z - DeltaZ * InvDistance * MeleeContactDistanceCm
    };
  }

  private ResolveMeleeDashDurationMs(DistanceCm: number, SpeedCmPerSec: number): number {
    const SafeSpeed = Math.max(SpeedCmPerSec, 1);
    const EstimatedMs = (Math.max(DistanceCm, 0) / SafeSpeed) * 1000;
    return Math.max(Math.round(EstimatedMs), MeleeDashMinDurationMs);
  }

  private ResolveMeleeImpact(
    SessionId: string,
    ActionId: number,
    AttackerUnitId: string,
    TargetUnitId: string,
    ImpactAtMs: number
  ): void {
    if (!this.IsMeleeActionStillValid(SessionId, ActionId)) {
      return;
    }
    if (!this.ActiveBattleSession) {
      return;
    }

    const MeleeAction = this.ActiveBattleSession.ActiveMeleeAction;
    if (!MeleeAction) {
      return;
    }
    MeleeAction.Phase = "Impact";

    const Attacker = this.FindBattleUnit(AttackerUnitId);
    const Target = this.FindBattleUnit(TargetUnitId);
    if (!Attacker || !Target) {
      this.NotifyRuntimeUpdated();
      return;
    }

    Attacker.PositionCm = { ...MeleeAction.ContactPositionCm };
    const TargetHome = Target.HomePositionCm ?? Target.PositionCm;
    const DistanceCm = Math.hypot(
      TargetHome.X - Attacker.PositionCm.X,
      TargetHome.Z - Attacker.PositionCm.Z
    );
    const HistoryStartIndex = this.MeleeSimulation.GetEventHistory().length;
    const IsAccepted = this.MeleeSimulation.SubmitCommand({
      Type: EMeleeCommandType.ResolveStrike,
      SourceUnit: this.CloneBattleUnitAsSnapshot(Attacker),
      TargetUnit: this.CloneBattleUnitAsSnapshot(Target),
      DistanceCm,
      RangeCm: BattleMeleeRangeCm,
      BaseDamage: BattleDefaultMeleeDamage
    });
    if (!IsAccepted) {
      this.EmitRuntimeEvent("EBattle3CActionRequested", `MeleeResolved:Rejected:${TargetUnitId}`);
      this.NotifyRuntimeUpdated();
      return;
    }

    const NewEvents = this.MeleeSimulation.GetEventHistory().slice(HistoryStartIndex);
    const ResolvedEvent = NewEvents.find(
      (Event): Event is FTypedMeleeEvent<EMeleeEventType.MeleeResolved> =>
        Event.Type === EMeleeEventType.MeleeResolved
    );
    if (!ResolvedEvent) {
      this.NotifyRuntimeUpdated();
      return;
    }
    if (!ResolvedEvent.Payload.IsHit) {
      this.EmitRuntimeEvent(
        "EBattle3CActionRequested",
        `MeleeResolved:Miss:${ResolvedEvent.Payload.MissReason}:${TargetUnitId}`
      );
      this.NotifyRuntimeUpdated();
      return;
    }

    const DamageEvent = NewEvents.find(
      (Event): Event is FTypedMeleeEvent<EMeleeEventType.DamageApplied> =>
        Event.Type === EMeleeEventType.DamageApplied
    );
    if (!DamageEvent) {
      this.NotifyRuntimeUpdated();
      return;
    }

    const DamageResult = this.ApplyDamageToBattleUnit(
      this.ActiveBattleSession,
      Target,
      DamageEvent.Payload.AppliedDamage
    );
    if (DamageResult.AppliedDamageAmount > 0) {
      this.QueueDamageCue(
        this.ActiveBattleSession,
        "Melee",
        Target.UnitId,
        DamageResult.AppliedDamageAmount,
        ImpactAtMs
      );
      this.TryScheduleUnitHitReaction(Attacker, Target, DamageResult.IsDefeated);
    }
    this.EmitRuntimeEvent(
      "EBattle3CActionRequested",
      `MeleeResolved:Hit:${Target.UnitId}:${DamageResult.AppliedDamageAmount}`
    );
    this.NotifyRuntimeUpdated();
  }

  private TryScheduleUnitHitReaction(
    Attacker: FBattleUnitRuntimeState,
    Target: FBattleUnitRuntimeState,
    IsDefeated: boolean
  ): void {
    if (IsDefeated) {
      return;
    }
    this.ScheduleUnitKnockbackAndReturn(Attacker, Target, 0);
  }

  private CloneBattleUnitAsSnapshot(Unit: FBattleUnitRuntimeState): FUnitSnapshot {
    return {
      UnitId: Unit.UnitId,
      DisplayName: Unit.DisplayName,
      TeamId: Unit.TeamId,
      MaxHp: Unit.MaxHp,
      CurrentHp: Unit.CurrentHp,
      Speed: 10,
      IsAlive: Unit.IsAlive
    };
  }

  private QueueDamageCue(
    Session: FBattle3CSession,
    SourceKind: FBattleDamageCueHudState["SourceKind"],
    TargetUnitId: string,
    DamageAmount: number,
    PopAtMs: number
  ): void {
    if (DamageAmount <= 0) {
      return;
    }

    Session.DamageCueSequence += 1;
    Session.LastDamageCue = {
      CueId: Session.DamageCueSequence,
      SourceKind,
      TargetUnitId,
      DamageAmount,
      PopAtMs
    };
  }

  private RegisterMeleeTimelineTimer(Handler: () => void, DelayMs: number): void {
    let Handle = 0;
    Handle = this.SetRuntimeTimeout(
      () => {
        this.MeleeTimelineTimerHandles.delete(Handle);
        Handler();
      },
      Math.max(DelayMs, 0)
    );
    this.MeleeTimelineTimerHandles.add(Handle);
  }

  private IsMeleeActionStillValid(SessionId: string, ActionId: number): boolean {
    return (
      this.RuntimePhase === "Battle3C" &&
      !!this.ActiveBattleSession &&
      this.ActiveBattleSession.SessionId === SessionId &&
      this.ActiveBattleSession.ActiveMeleeAction?.ActionId === ActionId
    );
  }

  private SwitchToNextAliveControlledCharacter(
    Session: FBattle3CSession,
    EventDetail: string
  ): boolean {
    const AlivePlayerUnitIds = Session.PlayerActiveUnitIds.filter((UnitId) => {
      const Unit = this.FindBattleUnit(UnitId);
      return Unit?.IsAlive ?? false;
    });
    if (AlivePlayerUnitIds.length <= 1) {
      return false;
    }

    const CurrentIndex = AlivePlayerUnitIds.indexOf(Session.ControlledCharacterId);
    const NextIndex = CurrentIndex < 0 ? 0 : (CurrentIndex + 1) % AlivePlayerUnitIds.length;
    Session.ControlledCharacterId = AlivePlayerUnitIds[NextIndex];
    Session.AimHoverTargetId = null;
    this.AlignSelectedTargetForControlledCharacter();
    if (Session.IsAimMode) {
      const ControlledUnit = this.FindBattleUnit(Session.ControlledCharacterId);
      Session.AimCameraYawDeg = ControlledUnit?.YawDeg ?? 0;
      Session.AimCameraPitchDeg = 0;
      this.CaptureAimFacingSnapshot(Session.ControlledCharacterId);
      this.AlignAimFacingToEnemyCenterAxis();
      this.SyncAimCameraYawToControlledFacing();
    }
    Session.CameraMode = this.ResolveBattleControlCameraMode(Session);
    this.EmitRuntimeEvent("EBattle3CActionRequested", EventDetail);
    return true;
  }

  private ResolveSelectedSkillDisplayName(Session: FBattle3CSession): string {
    const SkillOptions = Session.SkillOptions ?? [];
    if (SkillOptions.length < 1) {
      return "技能";
    }
    const SelectedById = SkillOptions.find(
      (Option) => Option.OptionId === Session.SelectedSkillOptionId
    );
    if (SelectedById) {
      return SelectedById.DisplayName;
    }
    const SelectedIndex = this.ResolveWrappedIndex(
      Session.SelectedSkillOptionIndex ?? 0,
      SkillOptions.length
    );
    return SkillOptions[SelectedIndex]?.DisplayName ?? "技能";
  }

  private ResolveSelectedItemDisplayName(Session: FBattle3CSession): string {
    const ItemOptions = Session.ItemOptions ?? [];
    if (ItemOptions.length < 1) {
      return "物品";
    }
    const SelectedIndex = this.ResolveWrappedIndex(
      Session.SelectedItemOptionIndex ?? 0,
      ItemOptions.length
    );
    return ItemOptions[SelectedIndex]?.DisplayName ?? "物品";
  }

  private ResolveSelectedItemOptionId(Session: FBattle3CSession): string | null {
    const ItemOptions = Session.ItemOptions ?? [];
    if (ItemOptions.length < 1) {
      return null;
    }
    const SelectedIndex = this.ResolveWrappedIndex(
      Session.SelectedItemOptionIndex ?? 0,
      ItemOptions.length
    );
    return ItemOptions[SelectedIndex]?.OptionId ?? null;
  }

  private ResolveBattleTargetDisplayName(TargetId: string): string {
    if (TargetId === "MISS") {
      return "未命中";
    }
    return this.FindBattleUnit(TargetId)?.DisplayName ?? TargetId;
  }

  private RebuildTargetSelectOrder(Session: FBattle3CSession): void {
    if (Session.PendingActionKind === "Item") {
      Session.TargetSelectOrderedEnemyUnitIds = [];
      return;
    }

    const EnemyTargets = this.GetEnemyBattleUnits(Session.Units).filter((Unit) => Unit.IsAlive);
    if (EnemyTargets.length < 1) {
      Session.TargetSelectOrderedEnemyUnitIds = [];
      return;
    }

    const PreferredByProjection = this.TryResolveTargetOrderByProjectedX(Session, EnemyTargets);
    if (PreferredByProjection) {
      Session.TargetSelectOrderedEnemyUnitIds = PreferredByProjection;
      return;
    }

    Session.TargetSelectOrderedEnemyUnitIds = this.ResolveFallbackTargetOrder(EnemyTargets);
  }

  private TryResolveTargetOrderByProjectedX(
    Session: FBattle3CSession,
    EnemyTargets: FBattleUnitRuntimeState[]
  ): string[] | null {
    const ControlledUnit = this.FindBattleUnit(Session.ControlledCharacterId);
    if (!ControlledUnit || !ControlledUnit.IsAlive) {
      return null;
    }

    const Forward = this.ResolveForwardVectorFromYawDeg(ControlledUnit.YawDeg);
    const Right = this.ResolveRightVectorFromYawDeg(ControlledUnit.YawDeg);
    const Projected = EnemyTargets.map((EnemyUnit) => {
      const DeltaX = EnemyUnit.PositionCm.X - ControlledUnit.PositionCm.X;
      const DeltaZ = EnemyUnit.PositionCm.Z - ControlledUnit.PositionCm.Z;
      const Depth = DeltaX * Forward.X + DeltaZ * Forward.Z;
      if (Depth <= TargetSelectProjectionDepthEpsilonCm) {
        return null;
      }
      const Lateral = DeltaX * Right.X + DeltaZ * Right.Z;
      return {
        UnitId: EnemyUnit.UnitId,
        ScreenX: Lateral / Depth,
        Z: EnemyUnit.PositionCm.Z
      };
    });
    if (Projected.some((Entry) => Entry === null)) {
      return null;
    }

    return Projected.filter((Entry): Entry is NonNullable<typeof Entry> => Entry !== null)
      .sort((Left, RightItem) => {
        if (Math.abs(Left.ScreenX - RightItem.ScreenX) > 1e-6) {
          return Left.ScreenX - RightItem.ScreenX;
        }
        if (Math.abs(Left.Z - RightItem.Z) > 1e-6) {
          return Left.Z - RightItem.Z;
        }
        return Left.UnitId.localeCompare(RightItem.UnitId);
      })
      .map((Entry) => Entry.UnitId);
  }

  private ResolveFallbackTargetOrder(EnemyTargets: FBattleUnitRuntimeState[]): string[] {
    return [...EnemyTargets]
      .sort((Left, Right) => {
        if (Math.abs(Left.PositionCm.Z - Right.PositionCm.Z) > 1e-6) {
          return Left.PositionCm.Z - Right.PositionCm.Z;
        }
        if (Math.abs(Left.PositionCm.X - Right.PositionCm.X) > 1e-6) {
          return Left.PositionCm.X - Right.PositionCm.X;
        }
        return Left.UnitId.localeCompare(Right.UnitId);
      })
      .map((Unit) => Unit.UnitId);
  }

  private ResolveSelectableEnemyTargets(Session: FBattle3CSession): FBattleUnitRuntimeState[] {
    const AliveTargets = this.GetEnemyBattleUnits(Session.Units).filter((Unit) => Unit.IsAlive);
    const ShouldUseFrozenOrder =
      Session.CommandStage === "TargetSelect" || Session.CommandStage === "ActionResolve";
    if (!ShouldUseFrozenOrder || !Session.TargetSelectOrderedEnemyUnitIds) {
      return AliveTargets;
    }

    const TargetMap = new Map(AliveTargets.map((Unit) => [Unit.UnitId, Unit] as const));
    const OrderedTargets = Session.TargetSelectOrderedEnemyUnitIds.map((UnitId) =>
      TargetMap.get(UnitId)
    ).filter((Unit): Unit is FBattleUnitRuntimeState => Unit !== undefined);
    if (OrderedTargets.length === 0) {
      return AliveTargets;
    }

    const OrderedIdSet = new Set(OrderedTargets.map((Unit) => Unit.UnitId));
    const MissingTargets = AliveTargets.filter((Unit) => !OrderedIdSet.has(Unit.UnitId));
    if (MissingTargets.length > 0) {
      OrderedTargets.push(
        ...this.ResolveFallbackTargetOrder(MissingTargets)
          .map((UnitId) => TargetMap.get(UnitId))
          .filter((Unit): Unit is FBattleUnitRuntimeState => Unit !== undefined)
      );
    }
    return OrderedTargets;
  }

  private ResolveSelectablePlayerTargets(Session: FBattle3CSession): FBattleUnitRuntimeState[] {
    const AliveTargets = this.GetPlayerBattleUnits(Session.Units).filter((Unit) => Unit.IsAlive);
    if (AliveTargets.length < 1) {
      return [];
    }

    const TargetMap = new Map(AliveTargets.map((Unit) => [Unit.UnitId, Unit] as const));
    const OrderedTargets = Session.PlayerActiveUnitIds.map((UnitId) =>
      TargetMap.get(UnitId)
    ).filter((Unit): Unit is FBattleUnitRuntimeState => Unit !== undefined);
    if (OrderedTargets.length >= AliveTargets.length) {
      return OrderedTargets;
    }

    const OrderedIdSet = new Set(OrderedTargets.map((Unit) => Unit.UnitId));
    const MissingTargets = AliveTargets.filter((Unit) => !OrderedIdSet.has(Unit.UnitId)).sort(
      (Left, Right) => Left.UnitId.localeCompare(Right.UnitId)
    );
    return [...OrderedTargets, ...MissingTargets];
  }

  private ResolveSelectableBattleTargetsForCurrentCommand(
    Session: FBattle3CSession
  ): FBattleUnitRuntimeState[] {
    const IsItemTargetSelect =
      Session.CommandStage === "TargetSelect" && Session.PendingActionKind === "Item";
    const IsItemActionResolve =
      Session.CommandStage === "ActionResolve" &&
      (Session.PendingActionResolvedDetail ?? "").startsWith("Item:");
    if (IsItemTargetSelect || IsItemActionResolve) {
      return this.ResolveSelectablePlayerTargets(Session);
    }
    return this.ResolveSelectableEnemyTargets(Session);
  }

  private ResolveCurrentBattleTargetForCommandSelection(Session: FBattle3CSession): string | null {
    const SelectableTargets = this.ResolveSelectableBattleTargetsForCurrentCommand(Session);
    if (SelectableTargets.length < 1) {
      return null;
    }

    const SelectedIndex = this.ResolveWrappedIndex(
      Session.SelectedTargetIndex,
      SelectableTargets.length
    );
    return SelectableTargets[SelectedIndex]?.UnitId ?? null;
  }

  private ResolveWrappedIndex(Index: number, Length: number): number {
    if (Length <= 0) {
      return 0;
    }
    const SafeIndex = Number.isFinite(Index) ? Math.trunc(Index) : 0;
    return ((SafeIndex % Length) + Length) % Length;
  }

  public ApplyDebugConfig(Patch: Partial<FDebugConfig>): void {
    this.DebugConfig = this.DebugConfigStore.ApplyPatch(this.DebugConfig, Patch);
    this.SyncCameraPitchFromConfig();
    this.LastDebugUpdatedAtIso = this.DebugConfigStore.Save(this.DebugConfig);
    this.NotifyRuntimeUpdated();
  }

  public ToggleDebugMenu(): void {
    this.IsDebugMenuOpen = !this.IsDebugMenuOpen;
    this.NotifyRuntimeUpdated();
  }

  public ImportDebugConfigJson(JsonText: string): FImportDebugConfigResult {
    try {
      this.DebugConfig = this.DebugConfigStore.ImportJson(JsonText, this.DebugConfig);
      this.SyncCameraPitchFromConfig();
      this.LastDebugUpdatedAtIso = this.DebugConfigStore.Save(this.DebugConfig);
      this.NotifyRuntimeUpdated();
      return {
        IsSuccess: true,
        ErrorMessage: null
      };
    } catch (UnknownError: unknown) {
      const Message = UnknownError instanceof Error ? UnknownError.message : "未知错误";
      return {
        IsSuccess: false,
        ErrorMessage: `导入失败：${Message}`
      };
    }
  }

  public ExportDebugConfigJson(): string {
    return this.DebugConfigStore.ExportJson({
      ...this.DebugConfig,
      CameraPitch: this.CameraPitchDegrees
    });
  }

  public OnRuntimeUpdated(Listener: TRuntimeListener): () => void {
    this.RuntimeListeners.add(Listener);
    Listener(this.GetViewModel());

    return () => {
      this.RuntimeListeners.delete(Listener);
    };
  }

  public GetViewModel(): FHudViewModel {
    const RemainingTransitionMs = this.ResolveRemainingTransitionMs();
    return {
      RuntimePhase: this.RuntimePhase,
      OverworldState: this.BuildOverworldHudState(),
      EncounterState: {
        EncounterEnemyId: this.ActiveEncounterContext?.EncounterEnemyId ?? null,
        PromptText: this.EncounterPromptText,
        StartedAtMs: this.EncounterTransitionStartedAtMs,
        PromptDurationSec: this.DebugConfig.BattlePromptDurationSec,
        IntroDurationSec: this.DebugConfig.BattleIntroDurationSec,
        DropDurationSec: this.DebugConfig.BattleDropDurationSec,
        RemainingTransitionMs
      },
      Battle3CState: this.BuildBattle3CHudState(this.ActiveBattleSession),
      SettlementState: {
        SummaryText: this.SettlementSummaryText,
        ConfirmHintText: "确认键：F / Enter / 手柄 A"
      },
      DebugState: {
        IsMenuOpen: this.IsDebugMenuOpen,
        Config: {
          ...this.DebugConfig,
          CameraPitch: this.CameraPitchDegrees
        },
        LastUpdatedAtIso: this.LastDebugUpdatedAtIso
      },
      InputHudState: this.BuildInputHudState(),
      EventLogs: this.EventLogs
    };
  }

  // 输入 HUD 组装会按阶段与设备聚合多个动作槽位，分支较多但集中可维护。
  // eslint-disable-next-line complexity
  private BuildInputHudState(): FHudViewModel["InputHudState"] {
    const GlobalSlots: FContextualActionSlot[] = [];
    const ContextSlots: FContextualActionSlot[] = [];

    if (this.RuntimePhase === "SettlementPreview") {
      ContextSlots.push({
        SlotId: "SettlementConfirm",
        Action: EInputAction.UIConfirm,
        DisplayName: "确认返回探索",
        TriggerType: "Direct",
        IsFocused: false,
        IsVisible: true
      });
    }

    if (this.RuntimePhase === "Battle3C" && this.ActiveBattleSession) {
      this.EnsureBattleCommandState(this.ActiveBattleSession);
      const Session = this.ActiveBattleSession;
      const ShouldShowFocusedSelection =
        this.ActiveInputDevice === EInputDeviceKinds.Gamepad || this.HasKeyboardDirectionalFocus;
      const IsRootIdle =
        Session.CommandStage === "Root" && !Session.IsAimMode && Session.ScriptFocus === null;
      if (IsRootIdle) {
        const BattleFleeHoldState = this.ResolveHoldActionState(EInputAction.BattleFlee);
        const BattleSwitchHoldState = this.ResolveHoldActionState(
          EInputAction.BattleSwitchCharacter
        );
        GlobalSlots.push(
          {
            SlotId: "BattleFlee",
            Action: EInputAction.BattleFlee,
            DisplayName: "逃跑",
            TriggerType: "Direct",
            IsFocused: false,
            IsVisible: true,
            RequiresHold: true,
            IsHoldActive: BattleFleeHoldState.IsActive,
            HoldProgressNormalized: BattleFleeHoldState.ProgressNormalized
          },
          {
            SlotId: "BattleSwitchCharacter",
            Action: EInputAction.BattleSwitchCharacter,
            DisplayName: "跳过回合",
            TriggerType: "Direct",
            IsFocused: false,
            IsVisible: true,
            RequiresHold: true,
            IsHoldActive: BattleSwitchHoldState.IsActive,
            HoldProgressNormalized: BattleSwitchHoldState.ProgressNormalized
          }
        );
      }

      if (Session.IsAimMode) {
        GlobalSlots.push({
          SlotId: "AimCancelGlobal",
          Action: EInputAction.UICancel,
          DisplayName: "返回",
          TriggerType: "Direct",
          IsFocused: false,
          IsVisible: true
        });
      } else if (Session.CommandStage === "Root") {
        const FocusedRootIndex = Session.SelectedRootCommandIndex ?? 0;
        ContextSlots.push(
          {
            SlotId: "RootAim",
            Action: EInputAction.BattleToggleAim,
            DisplayName: "瞄准",
            TriggerType: "Direct",
            IsFocused: false,
            IsVisible: true
          },
          {
            SlotId: "RootAttack",
            Action: EInputAction.UIConfirm,
            DisplayName: "近战攻击",
            TriggerType: "FocusedConfirm",
            IsFocused: ShouldShowFocusedSelection && FocusedRootIndex === 0,
            IsVisible: true
          },
          {
            SlotId: "RootSkill",
            Action: EInputAction.UIConfirm,
            DisplayName: "技能",
            TriggerType: "FocusedConfirm",
            IsFocused: ShouldShowFocusedSelection && FocusedRootIndex === 1,
            IsVisible: true
          },
          {
            SlotId: "RootItem",
            Action: EInputAction.UIConfirm,
            DisplayName: "物品",
            TriggerType: "FocusedConfirm",
            IsFocused: ShouldShowFocusedSelection && FocusedRootIndex === 2,
            IsVisible: true
          }
        );
      } else if (Session.CommandStage === "ActionResolve") {
        // 动作执行阶段输入锁定，不展示确认/返回动作。
      } else {
        GlobalSlots.push({
          SlotId: "ContextCancelGlobal",
          Action: EInputAction.UICancel,
          DisplayName: "返回",
          TriggerType: "Direct",
          IsFocused: false,
          IsVisible: true
        });
        if (Session.CommandStage === "TargetSelect") {
          GlobalSlots.push(
            {
              SlotId: "TargetNavLeft",
              Action: EInputAction.UINavLeft,
              DisplayName: "左目标",
              TriggerType: "Direct",
              IsFocused: false,
              IsVisible: true
            },
            {
              SlotId: "TargetNavRight",
              Action: EInputAction.UINavRight,
              DisplayName: "右目标",
              TriggerType: "Direct",
              IsFocused: false,
              IsVisible: true
            },
            {
              SlotId: "TargetConfirmGlobal",
              Action: EInputAction.UIConfirm,
              DisplayName: "确认目标",
              TriggerType: "Direct",
              IsFocused: false,
              IsVisible: true
            }
          );
        }
        ContextSlots.push({
          SlotId: "ContextConfirm",
          Action: EInputAction.UIConfirm,
          DisplayName: "确认",
          TriggerType: "FocusedConfirm",
          IsFocused: ShouldShowFocusedSelection,
          IsVisible: true
        });
      }
    }

    return {
      ActiveDevice: this.ActiveInputDevice,
      GlobalActionSlots: this.InputPromptRegistry.ResolveSlots(GlobalSlots, this.ActiveInputDevice),
      ContextActionSlots: this.InputPromptRegistry.ResolveSlots(
        ContextSlots,
        this.ActiveInputDevice
      )
    };
  }

  private ResolveHoldActionState(Action: EInputAction): {
    IsActive: boolean;
    ProgressNormalized: number;
  } {
    const Value = this.LastInputActionFrame.Actions[Action];
    if (!Value || !Value.IsHeld) {
      return {
        IsActive: false,
        ProgressNormalized: 0
      };
    }
    return {
      IsActive: true,
      ProgressNormalized: this.Clamp(Value.Axis, 0, 1)
    };
  }

  private ResolveRemainingTransitionMs(): number {
    if (this.RuntimePhase !== "EncounterTransition" || !this.EncounterTransitionEndAtMs) {
      return 0;
    }
    return Math.max(this.EncounterTransitionEndAtMs - Date.now(), 0);
  }

  private ResolveRemainingMs(EndAtMs: number | null | undefined, NowMs: number): number {
    if (EndAtMs === null || EndAtMs === undefined) {
      return 0;
    }
    return Math.max(EndAtMs - NowMs, 0);
  }

  private BuildOverworldHudState(): FHudViewModel["OverworldState"] {
    const OverworldState = this.OverworldSimulation.GetState();
    const ControlledTeam =
      OverworldState.ControlledTeamId !== null
        ? (OverworldState.TeamPackages[OverworldState.ControlledTeamId] ?? null)
        : null;

    return {
      Phase: OverworldState.Phase,
      ControlledTeamId: OverworldState.ControlledTeamId,
      ControlledTeamActiveUnitIds: ControlledTeam?.Formation.ActiveUnitIds ?? [],
      ControlledTeamOverworldDisplayUnitId:
        ControlledTeam?.Formation.OverworldDisplayUnitId ?? null,
      PlayerPosition: { ...OverworldState.Player.Position },
      PlayerYawDegrees: OverworldState.Player.YawDegrees,
      Enemies: Object.values(OverworldState.Enemies),
      PendingEncounterEnemyId: OverworldState.PendingEncounterEnemyId,
      LastEncounterEnemyId: this.LastEncounterEnemyId
    };
  }

  private BuildBattle3CHudState(BattleSession: FBattle3CSession | null): FBattle3CHudState {
    if (!BattleSession) {
      return this.CreateEmptyBattle3CHudState();
    }

    this.EnsureBattleCommandState(BattleSession);
    return this.BuildBattle3CHudStateFromSession(BattleSession);
  }

  // eslint-disable-next-line complexity
  private BuildBattle3CHudStateFromSession(BattleSession: FBattle3CSession): FBattle3CHudState {
    const SelectedTargetId = this.ResolveBattleSessionSelectedTargetId(BattleSession);
    const NowMs = Date.now();
    const ActionResolveRemainingMs = this.ResolveRemainingMs(
      BattleSession.ActionResolveEndsAtMs,
      NowMs
    );
    const ActionToastRemainingMs = this.ResolveRemainingMs(
      BattleSession.ActionToastEndsAtMs,
      NowMs
    );
    const ActionToastText =
      ActionToastRemainingMs > 0 ? (BattleSession.ActionToastText ?? null) : null;

    return {
      PlayerTeamId: BattleSession.PlayerTeamId,
      EnemyTeamId: BattleSession.EnemyTeamId,
      PlayerActiveUnitIds: [...BattleSession.PlayerActiveUnitIds],
      EnemyActiveUnitIds: [...BattleSession.EnemyActiveUnitIds],
      ControlledCharacterId: BattleSession.ControlledCharacterId,
      CameraMode: BattleSession.CameraMode,
      CrosshairScreenPosition: { ...BattleSession.CrosshairScreenPosition },
      ScriptStepIndex: BattleSession.ScriptStepIndex,
      IsAimMode: BattleSession.IsAimMode,
      IsSkillTargetMode: BattleSession.CommandStage === "TargetSelect",
      CommandStage: BattleSession.CommandStage ?? "Root",
      PendingActionKind: BattleSession.PendingActionKind ?? null,
      AimCameraYawDeg: BattleSession.AimCameraYawDeg,
      AimCameraPitchDeg: BattleSession.AimCameraPitchDeg,
      SelectedTargetId,
      HoveredTargetId: BattleSession.AimHoverTargetId,
      SkillOptions: [...(BattleSession.SkillOptions ?? [])],
      ItemOptions: [...(BattleSession.ItemOptions ?? [])],
      SelectedSkillOptionIndex: BattleSession.SelectedSkillOptionIndex ?? 0,
      SelectedItemOptionIndex: BattleSession.SelectedItemOptionIndex ?? 0,
      SelectedRootCommandIndex: BattleSession.SelectedRootCommandIndex ?? 0,
      SelectedSkillOptionId: BattleSession.SelectedSkillOptionId ?? null,
      Units: this.BuildBattleHudUnits(BattleSession, SelectedTargetId),
      ScriptFocus: this.CloneBattleScriptFocus(BattleSession.ScriptFocus),
      LastShot: BattleSession.LastShot ? { ...BattleSession.LastShot } : null,
      ActiveMeleeAction: BattleSession.ActiveMeleeAction
        ? {
            ...BattleSession.ActiveMeleeAction,
            StartPositionCm: { ...BattleSession.ActiveMeleeAction.StartPositionCm },
            ContactPositionCm: { ...BattleSession.ActiveMeleeAction.ContactPositionCm }
          }
        : null,
      LastDamageCue: BattleSession.LastDamageCue ? { ...BattleSession.LastDamageCue } : null,
      ActionResolveRemainingMs,
      ActionToastText,
      ActionToastRemainingMs
    };
  }

  private CreateEmptyBattle3CHudState(): FBattle3CHudState {
    return {
      PlayerTeamId: null,
      EnemyTeamId: null,
      PlayerActiveUnitIds: [],
      EnemyActiveUnitIds: [],
      ControlledCharacterId: null,
      CameraMode: "PlayerFollow",
      CrosshairScreenPosition: { X: 0.5, Y: 0.5 },
      ScriptStepIndex: 0,
      IsAimMode: false,
      IsSkillTargetMode: false,
      CommandStage: "Root",
      PendingActionKind: null,
      AimCameraYawDeg: null,
      AimCameraPitchDeg: null,
      SelectedTargetId: null,
      HoveredTargetId: null,
      SkillOptions: [...BattleSkillPlaceholderOptions],
      ItemOptions: [...BattleItemPlaceholderOptions],
      SelectedSkillOptionIndex: 0,
      SelectedItemOptionIndex: 0,
      SelectedRootCommandIndex: 0,
      SelectedSkillOptionId: null,
      Units: [],
      ScriptFocus: null,
      LastShot: null,
      ActiveMeleeAction: null,
      LastDamageCue: null,
      ActionResolveRemainingMs: 0,
      ActionToastText: null,
      ActionToastRemainingMs: 0
    };
  }

  private ResolveBattleSessionSelectedTargetId(Session: FBattle3CSession): string | null {
    return this.ResolveCurrentBattleTargetForCommandSelection(Session);
  }

  private BuildBattleHudUnits(
    Session: FBattle3CSession,
    SelectedTargetId: string | null
  ): FBattle3CHudState["Units"] {
    return Session.Units.map((Unit) => ({
      UnitId: Unit.UnitId,
      DisplayName: Unit.DisplayName,
      TeamId: Unit.TeamId,
      ModelAssetPath: Unit.ModelAssetPath,
      PositionCm: { ...Unit.PositionCm },
      YawDeg: Unit.YawDeg,
      MaxHp: Unit.MaxHp,
      CurrentHp: Unit.CurrentHp,
      MaxMp: Unit.MaxMp,
      CurrentMp: Unit.CurrentMp,
      IsAlive: Unit.IsAlive,
      IsControlled: Unit.UnitId === Session.ControlledCharacterId,
      IsSelectedTarget: Unit.UnitId === SelectedTargetId,
      IsEncounterPrimaryEnemy: Unit.IsEncounterPrimaryEnemy
    }));
  }

  private CloneBattleScriptFocus(
    ScriptFocus: FBattleScriptFocusHudState | null
  ): FBattleScriptFocusHudState | null {
    if (!ScriptFocus) {
      return null;
    }
    return {
      AttackerUnitId: ScriptFocus.AttackerUnitId,
      TargetUnitIds: [...ScriptFocus.TargetUnitIds]
    };
  }

  public GetOverworldEnemies(): FOverworldEnemyState[] {
    return Object.values(this.OverworldSimulation.GetState().Enemies);
  }

  private ConsumeOverworldInput(InputSnapshot: FInputSnapshot): void {
    const OverworldLookPitchDeltaDegrees = this.ResolveOverworldLookPitchDeltaDegrees(
      InputSnapshot.LookPitchDeltaDegrees
    );
    const NextPitch = this.Clamp(
      this.CameraPitchDegrees + OverworldLookPitchDeltaDegrees,
      this.DebugConfig.LookPitchMin,
      this.DebugConfig.LookPitchMax
    );
    this.CameraPitchDegrees = NextPitch;

    this.OverworldSimulation.SubmitCommand({
      Type: EOverworldCommandType.Step,
      MoveAxis: {
        X: InputSnapshot.MoveAxis.X,
        Y: InputSnapshot.MoveAxis.Y
      },
      LookYawDeltaDegrees: InputSnapshot.LookYawDeltaDegrees,
      DeltaSeconds: InputSnapshot.DeltaSeconds,
      IsSprinting: InputSnapshot.SprintHold,
      WalkSpeed: this.DebugConfig.WalkSpeed,
      RunSpeed: this.DebugConfig.RunSpeed
    });

    this.NotifyRuntimeUpdated();
  }

  private ConsumeBattle3CInput(
    InputSnapshot: FInputSnapshot,
    PreviousInputActionFrame: FInputActionFrame
  ): void {
    if (!this.ActiveBattleSession) {
      return;
    }
    this.EnsureBattleCommandState(this.ActiveBattleSession);

    if (this.TryHandleBattle3CImmediateActions(InputSnapshot)) {
      return;
    }

    const IsDirty = this.ActiveBattleSession.IsAimMode
      ? this.ConsumeBattleAimInput(InputSnapshot)
      : this.ConsumeBattleRootCrosshairInput(InputSnapshot);

    const HasHoldHudDelta = this.HasBattleHoldHudStateChanged(
      InputSnapshot.ActionFrame,
      PreviousInputActionFrame
    );
    if (IsDirty || HasHoldHudDelta) {
      this.NotifyRuntimeUpdated();
    }
  }

  private TryHandleBattle3CImmediateActions(InputSnapshot: FInputSnapshot): boolean {
    if (!this.ActiveBattleSession) {
      return false;
    }

    this.EnsureBattleCommandState(this.ActiveBattleSession);
    if (this.TryHandleBattleCancelAction(InputSnapshot)) {
      return true;
    }
    if (this.TryHandleBattleToggleAimAction(InputSnapshot)) {
      return true;
    }
    if (this.IsActionTriggered(InputSnapshot, EInputAction.BattleSwitchCharacter)) {
      return this.SwitchControlledCharacter();
    }
    if (this.IsActionTriggered(InputSnapshot, EInputAction.BattleFlee)) {
      return this.FleeBattleToOverworld();
    }
    return this.TryHandleBattleCommandAction(InputSnapshot);
  }

  private ConsumeBattleAimInput(InputSnapshot: FInputSnapshot): boolean {
    let IsDirty = false;
    if (this.EnsureAimCrosshairCentered()) {
      IsDirty = true;
    }
    if (this.UpdateAimControlledFacingFromLookYaw(InputSnapshot.LookYawDeltaDegrees)) {
      IsDirty = true;
    }
    if (
      this.UpdateAimCameraPitchFromLookInput(
        this.ResolveAimLookPitchDeltaDegrees(InputSnapshot.LookPitchDeltaDegrees)
      )
    ) {
      IsDirty = true;
    }
    if (this.SyncAimCameraYawToControlledFacing()) {
      IsDirty = true;
    }
    return IsDirty;
  }

  private ConsumeBattleRootCrosshairInput(InputSnapshot: FInputSnapshot): boolean {
    if (!this.ActiveBattleSession || this.ActiveBattleSession.CommandStage !== "Root") {
      return false;
    }

    const NextCrosshair = InputSnapshot.AimScreenPosition
      ? this.ResolveAbsoluteCrosshairPosition(InputSnapshot.AimScreenPosition)
      : this.ResolveCrosshairPosition(
          this.ActiveBattleSession.CrosshairScreenPosition,
          InputSnapshot.AimScreenDelta
        );
    if (
      NextCrosshair.X === this.ActiveBattleSession.CrosshairScreenPosition.X &&
      NextCrosshair.Y === this.ActiveBattleSession.CrosshairScreenPosition.Y
    ) {
      return false;
    }

    this.ActiveBattleSession.CrosshairScreenPosition = NextCrosshair;
    return true;
  }

  private TryHandleBattleCancelAction(InputSnapshot: FInputSnapshot): boolean {
    if (
      !this.ActiveBattleSession ||
      !this.IsActionTriggered(InputSnapshot, EInputAction.UICancel)
    ) {
      return false;
    }
    return this.RequestUICancelAction();
  }

  private TryHandleBattleToggleAimAction(InputSnapshot: FInputSnapshot): boolean {
    if (
      !this.ActiveBattleSession ||
      !this.IsActionTriggered(InputSnapshot, EInputAction.BattleToggleAim)
    ) {
      return false;
    }
    if (this.ActiveBattleSession.CommandStage !== "Root") {
      return false;
    }
    this.ToggleBattleAim();
    return true;
  }

  private TryHandleBattleCommandAction(InputSnapshot: FInputSnapshot): boolean {
    if (!this.ActiveBattleSession) {
      return false;
    }

    const IsKeyboardDirectionalNavTriggered =
      this.IsActionTriggeredByKeyboardMouse(InputSnapshot, EInputAction.UINavUp) ||
      this.IsActionTriggeredByKeyboardMouse(InputSnapshot, EInputAction.UINavDown) ||
      this.IsActionTriggeredByKeyboardMouse(InputSnapshot, EInputAction.UINavLeft) ||
      this.IsActionTriggeredByKeyboardMouse(InputSnapshot, EInputAction.UINavRight);
    if (IsKeyboardDirectionalNavTriggered) {
      this.HasKeyboardDirectionalFocus = true;
    }

    const VerticalDelta = this.ResolveBattleMenuVerticalDelta(InputSnapshot);
    if (VerticalDelta !== 0) {
      this.HandleBattleMenuVerticalNavigate(VerticalDelta);
      return true;
    }

    const HorizontalDelta = this.ResolveBattleTargetHorizontalDelta(InputSnapshot);
    if (HorizontalDelta !== 0) {
      this.CycleBattleTarget(HorizontalDelta);
      return true;
    }

    if (this.TryHandleBattleConfirmAction(InputSnapshot)) {
      return true;
    }

    return this.TryHandleBattleFireAction(InputSnapshot);
  }

  private ResolveBattleMenuVerticalDelta(InputSnapshot: FInputSnapshot): number {
    return (
      (this.IsActionTriggered(InputSnapshot, EInputAction.UINavDown) ? 1 : 0) -
      (this.IsActionTriggered(InputSnapshot, EInputAction.UINavUp) ? 1 : 0)
    );
  }

  private ResolveBattleTargetHorizontalDelta(InputSnapshot: FInputSnapshot): number {
    return (
      (this.IsActionTriggered(InputSnapshot, EInputAction.UINavRight) ? 1 : 0) -
      (this.IsActionTriggered(InputSnapshot, EInputAction.UINavLeft) ? 1 : 0)
    );
  }

  private HandleBattleMenuVerticalNavigate(VerticalDelta: number): void {
    if (!this.ActiveBattleSession) {
      return;
    }
    if (this.ActiveBattleSession.CommandStage === "Root" && !this.ActiveBattleSession.IsAimMode) {
      this.CycleBattleRootCommandSelection(VerticalDelta);
      return;
    }
    this.CycleBattleMenuSelection(VerticalDelta);
  }

  private TryHandleBattleConfirmAction(InputSnapshot: FInputSnapshot): boolean {
    if (!this.ActiveBattleSession) {
      return false;
    }
    if (!this.IsActionTriggered(InputSnapshot, EInputAction.UIConfirm)) {
      return false;
    }
    if (this.ActiveBattleSession.CommandStage === "Root" && !this.ActiveBattleSession.IsAimMode) {
      this.ConfirmBattleRootCommandSelection(this.ActiveBattleSession);
      return true;
    }
    this.FireBattleAction();
    return true;
  }

  private TryHandleBattleFireAction(InputSnapshot: FInputSnapshot): boolean {
    if (!this.ActiveBattleSession) {
      return false;
    }
    if (!this.IsActionTriggered(InputSnapshot, EInputAction.BattleFire)) {
      return false;
    }
    if (!this.ActiveBattleSession.IsAimMode) {
      return false;
    }
    this.FireBattleAction();
    return true;
  }

  private CycleBattleRootCommandSelection(Direction: number): void {
    if (!this.ActiveBattleSession) {
      return;
    }
    this.EnsureBattleCommandState(this.ActiveBattleSession);
    if (this.ActiveBattleSession.CommandStage !== "Root" || this.ActiveBattleSession.IsAimMode) {
      return;
    }

    const Delta = Direction >= 0 ? 1 : -1;
    this.ActiveBattleSession.SelectedRootCommandIndex = this.ResolveWrappedIndex(
      (this.ActiveBattleSession.SelectedRootCommandIndex ?? 0) + Delta,
      BattleRootCommandCount
    );
    this.EmitRuntimeEvent(
      "EBattle3CActionRequested",
      `RootMenu:Cycle:${Delta > 0 ? "Down" : "Up"}`
    );
    this.NotifyRuntimeUpdated();
  }

  private ConfirmBattleRootCommandSelection(Session: FBattle3CSession): void {
    this.EnsureBattleCommandState(Session);
    const SelectedIndex = Session.SelectedRootCommandIndex ?? 0;
    if (SelectedIndex === 1) {
      this.EnterSkillMenuStage(Session);
      this.EmitRuntimeEvent("EBattle3CActionRequested", "SkillMenu:Open");
      this.NotifyRuntimeUpdated();
      return;
    }
    if (SelectedIndex === 2) {
      this.EnterItemMenuStage(Session);
      this.EmitRuntimeEvent("EBattle3CActionRequested", "ItemMenu:Open");
      this.NotifyRuntimeUpdated();
      return;
    }

    this.BeginTargetSelectionFromAttack(Session);
  }

  private BindOverworldEvents(): void {
    Object.values(EOverworldEventType).forEach((EventType) => {
      this.OverworldSimulation.On(EventType, (Event) => {
        this.AppendLog(`OW ${Event.EventId} | ${Event.Type}`);
        this.NotifyRuntimeUpdated();
      });
    });

    this.OverworldSimulation.On(EOverworldEventType.EncounterTriggered, (Event) => {
      this.StartEncounterPrompt(
        Event.Payload.EncounterId,
        Event.Payload.EnemyId,
        Event.Payload.PlayerTeamId,
        Event.Payload.EnemyTeamId,
        Event.Payload.PlayerPosition,
        Event.Payload.EnemyPosition
      );
    });

    this.OverworldSimulation.On(EOverworldEventType.TeamValidationFailed, (Event) => {
      this.EmitRuntimeEvent(
        "ETeamValidationFailed",
        `${Event.Payload.TeamId}:${Event.Payload.FailureReason}`
      );
    });
  }

  private StartEncounterPrompt(
    EncounterId: string,
    EncounterEnemyId: string,
    PlayerTeamId: string,
    EnemyTeamId: string,
    PlayerPosition: FOverworldVector2,
    EnemyPosition: FOverworldVector2
  ): void {
    if (this.RuntimePhase !== "Overworld") {
      return;
    }

    this.ClearPhaseTimers();
    const StartedAtMs = Date.now();
    const PromptMs = Math.max(Math.round(this.DebugConfig.BattlePromptDurationSec * 1000), 1);
    this.ActiveEncounterContext = {
      EncounterId,
      EncounterEnemyId,
      PlayerTeamId,
      EnemyTeamId,
      PlayerPosition: { ...PlayerPosition },
      EnemyPosition: { ...EnemyPosition },
      BattleAnchorCm: { ...BattleAnchorCm },
      TriggeredAtMs: StartedAtMs
    };
    this.ActiveBattleSession = null;
    this.RuntimePhase = "Overworld";
    this.EncounterPromptText = "遭遇敌人，进入战斗";
    this.EncounterTransitionStartedAtMs = null;
    this.EncounterTransitionEndAtMs = null;
    this.EncounterPromptTimerHandle = this.SetRuntimeTimeout(() => {
      this.StartEncounterTransition(EncounterId);
    }, PromptMs);

    this.NotifyRuntimeUpdated();
  }

  private StartEncounterTransition(EncounterId: string): void {
    if (
      this.RuntimePhase !== "Overworld" ||
      !this.ActiveEncounterContext ||
      this.ActiveEncounterContext.EncounterId !== EncounterId
    ) {
      return;
    }

    const StartedAtMs = Date.now();
    const IntroMs = Math.max(Math.round(this.DebugConfig.BattleIntroDurationSec * 1000), 1);
    const DropMs = Math.max(Math.round(this.DebugConfig.BattleDropDurationSec * 1000), 1);
    const TransitionTotalMs = Math.max(IntroMs, DropMs);
    const BattleSession = this.CreateBattle3CSession(this.ActiveEncounterContext);
    if (!BattleSession) {
      this.BlockBattleSessionTransition(this.ActiveEncounterContext);
      return;
    }

    this.ActiveBattleSession = BattleSession;
    this.HasKeyboardDirectionalFocus = false;
    this.ActiveBattleSession.CameraMode = "IntroDropIn";
    this.RuntimePhase = "EncounterTransition";
    this.EncounterPromptText = null;
    this.EncounterTransitionStartedAtMs = StartedAtMs;
    this.EncounterTransitionEndAtMs = StartedAtMs + TransitionTotalMs;
    this.EmitRuntimeEvent(
      "EEncounterTransitionStarted",
      this.ActiveEncounterContext.EncounterEnemyId
    );

    this.EncounterFinishTimerHandle = this.SetRuntimeTimeout(() => {
      this.FinishEncounterTransition(EncounterId);
    }, TransitionTotalMs);

    this.NotifyRuntimeUpdated();
  }

  private FinishEncounterTransition(EncounterId: string): void {
    if (
      this.RuntimePhase !== "EncounterTransition" ||
      !this.ActiveBattleSession ||
      this.ActiveEncounterContext?.EncounterId !== EncounterId
    ) {
      return;
    }

    this.RuntimePhase = "Battle3C";
    this.EncounterPromptText = null;
    this.EncounterTransitionStartedAtMs = null;
    this.EncounterTransitionEndAtMs = null;
    this.ActiveBattleSession.CameraMode = this.ResolveBattleControlCameraMode(
      this.ActiveBattleSession
    );
    this.EmitRuntimeEvent(
      "EEncounterTransitionFinished",
      this.ActiveEncounterContext.EncounterEnemyId
    );
    this.NotifyRuntimeUpdated();
  }

  private BlockBattleSessionTransition(Context: FEncounterContext): void {
    this.EmitRuntimeEvent(
      "ETeamValidationFailed",
      `阻断遭遇 ${Context.EncounterId}（${Context.EncounterEnemyId}）`
    );
    this.OverworldSimulation.SubmitCommand({
      Type: EOverworldCommandType.ResolveEncounter
    });
    this.OverworldSimulation.SubmitCommand({
      Type: EOverworldCommandType.ResetPlayerToSafePoint
    });
    this.LastEncounterEnemyId = Context.EncounterEnemyId;
    this.ClearPhaseTimers();
    this.RuntimePhase = "Overworld";
    this.ActiveEncounterContext = null;
    this.ActiveBattleSession = null;
    this.EncounterPromptText = "队伍配置非法，已阻断进入战斗";
    this.EncounterTransitionStartedAtMs = null;
    this.EncounterTransitionEndAtMs = null;
    this.NotifyRuntimeUpdated();
  }

  private CreateBattle3CSession(Context: FEncounterContext): FBattle3CSession | null {
    const OverworldState = this.OverworldSimulation.GetState();
    const PlayerTeam = OverworldState.TeamPackages[Context.PlayerTeamId];
    const EnemyTeam = OverworldState.TeamPackages[Context.EnemyTeamId];
    if (!PlayerTeam || !EnemyTeam) {
      this.EmitRuntimeEvent(
        "ETeamValidationFailed",
        `创建战斗会话失败：缺少 TeamPackage（Player=${Context.PlayerTeamId}, Enemy=${Context.EnemyTeamId}）`
      );
      return null;
    }

    if (!this.IsFormationValid(PlayerTeam) || !this.IsFormationValid(EnemyTeam)) {
      this.EmitRuntimeEvent("ETeamValidationFailed", "创建战斗会话失败：Formation 非法");
      return null;
    }

    const PlayerUnits = this.BuildBattleTeamUnits({
      TeamPackage: PlayerTeam,
      TeamRole: "Player",
      UnitStaticConfigMap: OverworldState.UnitStaticConfigs,
      UnitRuntimeSnapshotMap: OverworldState.UnitRuntimeSnapshots
    });
    const EnemyUnits = this.BuildBattleTeamUnits({
      TeamPackage: EnemyTeam,
      TeamRole: "Enemy",
      UnitStaticConfigMap: OverworldState.UnitStaticConfigs,
      UnitRuntimeSnapshotMap: OverworldState.UnitRuntimeSnapshots
    });
    if (PlayerUnits.length < 1 || EnemyUnits.length < 1) {
      this.EmitRuntimeEvent("ETeamValidationFailed", "创建战斗会话失败：缺少可展开战斗单位");
      return null;
    }

    const AlivePlayerUnitIds = PlayerUnits.filter((Unit) => Unit.IsAlive).map(
      (Unit) => Unit.UnitId
    );
    const ControlledCharacterId = AlivePlayerUnitIds.includes(PlayerTeam.Formation.LeaderUnitId)
      ? PlayerTeam.Formation.LeaderUnitId
      : (AlivePlayerUnitIds[0] ?? PlayerUnits[0].UnitId);

    return {
      SessionId: `B3C_${Context.EncounterId}_${Date.now()}`,
      PlayerTeamId: PlayerTeam.TeamId,
      EnemyTeamId: EnemyTeam.TeamId,
      PlayerActiveUnitIds: [...PlayerTeam.Formation.ActiveUnitIds],
      EnemyActiveUnitIds: [...EnemyTeam.Formation.ActiveUnitIds],
      ControlledCharacterId,
      CameraMode: "IntroPullOut",
      CrosshairScreenPosition: {
        X: 0.5,
        Y: 0.5
      },
      IsAimMode: false,
      IsSkillTargetMode: false,
      CommandStage: "Root",
      PendingActionKind: null,
      AimCameraYawDeg: null,
      AimCameraPitchDeg: null,
      SelectedTargetIndex: 0,
      AimHoverTargetId: null,
      SkillOptions: [...BattleSkillPlaceholderOptions],
      ItemOptions: [...BattleItemPlaceholderOptions],
      SelectedSkillOptionIndex: 0,
      SelectedItemOptionIndex: 0,
      SelectedRootCommandIndex: 0,
      SelectedSkillOptionId: null,
      TargetSelectOrderedEnemyUnitIds: [],
      PendingActionResolvedDetail: null,
      ActionResolveEndsAtMs: null,
      ActionToastText: null,
      ActionToastEndsAtMs: null,
      ScriptStepIndex: 0,
      ShotSequence: 0,
      DamageCueSequence: 0,
      LastShot: null,
      ActiveMeleeAction: null,
      LastDamageCue: null,
      AimFacingSnapshotByUnitId: {},
      Units: [...PlayerUnits, ...EnemyUnits],
      ScriptFocus: null
    };
  }

  private IsFormationValid(TeamPackage: FTeamPackageSnapshot): boolean {
    const ActiveIds = TeamPackage.Formation.ActiveUnitIds;
    if (ActiveIds.length < 1 || ActiveIds.length > 3) {
      return false;
    }

    const RosterSet = new Set(TeamPackage.Roster.MemberUnitIds);
    const ActiveSet = new Set<string>();
    for (const ActiveUnitId of ActiveIds) {
      if (ActiveSet.has(ActiveUnitId) || !RosterSet.has(ActiveUnitId)) {
        return false;
      }
      ActiveSet.add(ActiveUnitId);
    }

    return (
      ActiveSet.has(TeamPackage.Formation.LeaderUnitId) &&
      ActiveSet.has(TeamPackage.Formation.OverworldDisplayUnitId)
    );
  }

  private BuildBattleTeamUnits(Options: {
    TeamPackage: FTeamPackageSnapshot;
    TeamRole: "Player" | "Enemy";
    UnitStaticConfigMap: Record<string, FUnitStaticConfig>;
    UnitRuntimeSnapshotMap: Record<string, FUnitCombatRuntimeSnapshot>;
  }): FBattleUnitRuntimeState[] {
    const ActiveUnitIds = Options.TeamPackage.Formation.ActiveUnitIds;
    return ActiveUnitIds.map((UnitId, Index) => {
      const UnitConfig = Options.UnitStaticConfigMap[UnitId];
      const RuntimeSnapshot = Options.UnitRuntimeSnapshotMap[UnitId];
      if (!UnitConfig || !RuntimeSnapshot) {
        return null;
      }

      const PositionCm = this.ResolveBattleSlotPositionCm(
        Options.TeamRole,
        Index,
        ActiveUnitIds.length
      );
      const IsEnemyPrimary =
        Options.TeamRole === "Enemy" && UnitId === Options.TeamPackage.Formation.LeaderUnitId;
      return {
        UnitId,
        DisplayName: UnitConfig.DisplayName,
        TeamId: Options.TeamRole,
        ModelAssetPath:
          Options.TeamRole === "Player" ? this.ResolveModelAssetPathByUnitId(UnitId) : null,
        HomePositionCm: { ...PositionCm },
        PositionCm: { ...PositionCm },
        YawDeg: Options.TeamRole === "Player" ? 90 : 270,
        MaxHp: UnitConfig.BaseMaxHp,
        CurrentHp: this.Clamp(RuntimeSnapshot.CurrentHp, 0, UnitConfig.BaseMaxHp),
        MaxMp: UnitConfig.BaseMaxMp,
        CurrentMp: this.Clamp(RuntimeSnapshot.CurrentMp, 0, UnitConfig.BaseMaxMp),
        IsAlive: RuntimeSnapshot.IsAlive && RuntimeSnapshot.CurrentHp > 0,
        IsEncounterPrimaryEnemy: IsEnemyPrimary
      };
    }).filter((Unit): Unit is FBattleUnitRuntimeState => Unit !== null);
  }

  private ResolveBattleSlotPositionCm(
    TeamRole: "Player" | "Enemy",
    Index: number,
    TotalCount: number
  ): FVector3Cm {
    const LaneTable = BattleLaneTableByTeam[TeamRole];
    const Lane = LaneTable[TotalCount] ?? LaneTable[3];
    const SafeLaneIndex = Math.min(Math.max(Index, 0), Lane.length - 1);

    return {
      X: TeamRole === "Player" ? -220 : 280,
      Y: 0,
      Z: Lane[SafeLaneIndex]
    };
  }

  private ResolveModelAssetPathByUnitId(UnitId: string): string | null {
    const Mapping: Record<string, string> = {
      char01: this.DebugConfig.UnitModelChar01Path,
      char02: this.DebugConfig.UnitModelChar02Path,
      char03: this.DebugConfig.UnitModelChar03Path,
      P_YELLOW: this.DebugConfig.UnitModelChar01Path,
      P_RED: this.DebugConfig.UnitModelChar02Path
    };
    return Mapping[UnitId] ?? null;
  }

  private CaptureAimFacingSnapshot(UnitId: string): void {
    if (!this.ActiveBattleSession || !this.ActiveBattleSession.IsAimMode) {
      return;
    }

    const Unit = this.FindBattleUnit(UnitId);
    if (!Unit) {
      return;
    }

    const Snapshot = this.EnsureAimFacingSnapshotMap();
    if (Snapshot[UnitId] === undefined) {
      Snapshot[UnitId] = Unit.YawDeg;
    }
  }

  private EnsureAimCrosshairCentered(): boolean {
    if (!this.ActiveBattleSession) {
      return false;
    }

    if (
      this.ActiveBattleSession.CrosshairScreenPosition.X === AimCrosshairCenter &&
      this.ActiveBattleSession.CrosshairScreenPosition.Y === AimCrosshairCenter
    ) {
      return false;
    }

    this.ActiveBattleSession.CrosshairScreenPosition = {
      X: AimCrosshairCenter,
      Y: AimCrosshairCenter
    };
    return true;
  }

  private SyncAimCameraYawToControlledFacing(): boolean {
    if (
      !this.ActiveBattleSession ||
      this.RuntimePhase !== "Battle3C" ||
      !this.ActiveBattleSession.IsAimMode
    ) {
      return false;
    }

    const ControlledUnit = this.FindBattleUnit(this.ActiveBattleSession.ControlledCharacterId);
    if (!ControlledUnit || !ControlledUnit.IsAlive) {
      return false;
    }

    const NextYaw = Number(ControlledUnit.YawDeg.toFixed(2));
    if (
      this.ActiveBattleSession.AimCameraYawDeg !== null &&
      Math.abs(this.ActiveBattleSession.AimCameraYawDeg - NextYaw) <= 1e-3
    ) {
      return false;
    }

    this.ActiveBattleSession.AimCameraYawDeg = NextYaw;
    return true;
  }

  private UpdateAimCameraPitchFromLookInput(LookPitchDeltaDegrees: number): boolean {
    if (
      !this.ActiveBattleSession ||
      this.RuntimePhase !== "Battle3C" ||
      !this.ActiveBattleSession.IsAimMode
    ) {
      return false;
    }

    const CurrentPitchDeg = this.ActiveBattleSession.AimCameraPitchDeg ?? 0;
    const NextPitchDeg = Number(
      this.Clamp(
        CurrentPitchDeg + LookPitchDeltaDegrees,
        this.DebugConfig.LookPitchMin,
        this.DebugConfig.LookPitchMax
      ).toFixed(2)
    );
    if (
      this.ActiveBattleSession.AimCameraPitchDeg !== null &&
      Math.abs(this.ActiveBattleSession.AimCameraPitchDeg - NextPitchDeg) <= 1e-3
    ) {
      return false;
    }

    this.ActiveBattleSession.AimCameraPitchDeg = NextPitchDeg;
    return true;
  }

  private ResolveOverworldLookPitchDeltaDegrees(LookPitchDeltaDegrees: number): number {
    return this.ResolveLookPitchDeltaDegrees(
      LookPitchDeltaDegrees,
      this.DebugConfig.OverworldInvertLookPitch
    );
  }

  private ResolveAimLookPitchDeltaDegrees(LookPitchDeltaDegrees: number): number {
    return this.ResolveLookPitchDeltaDegrees(
      LookPitchDeltaDegrees,
      this.DebugConfig.AimInvertLookPitch
    );
  }

  private ResolveLookPitchDeltaDegrees(
    LookPitchDeltaDegrees: number,
    IsInvertEnabled: boolean
  ): number {
    return IsInvertEnabled ? -LookPitchDeltaDegrees : LookPitchDeltaDegrees;
  }

  private UpdateAimControlledFacingFromLookYaw(LookYawDeltaDegrees: number): boolean {
    if (
      !this.ActiveBattleSession ||
      this.RuntimePhase !== "Battle3C" ||
      !this.ActiveBattleSession.IsAimMode
    ) {
      return false;
    }

    const ControlledUnit = this.FindBattleUnit(this.ActiveBattleSession.ControlledCharacterId);
    if (!ControlledUnit || !ControlledUnit.IsAlive) {
      return false;
    }
    if (Math.abs(LookYawDeltaDegrees) <= 1e-4) {
      return false;
    }

    this.CaptureAimFacingSnapshot(ControlledUnit.UnitId);
    const DesiredYawDeg = this.ResolveAimYawWithEnemyCenteredFan(
      ControlledUnit,
      ControlledUnit.YawDeg + LookYawDeltaDegrees
    );
    const DeltaYawDeg = this.NormalizeAngleDegrees(DesiredYawDeg - ControlledUnit.YawDeg);
    if (Math.abs(DeltaYawDeg) <= 1e-3) {
      return false;
    }

    ControlledUnit.YawDeg = Number(DesiredYawDeg.toFixed(2));
    return true;
  }

  private ResolveAimYawWithEnemyCenteredFan(
    ControlledUnit: FBattleUnitRuntimeState,
    DesiredYawDeg: number
  ): number {
    if (!this.ActiveBattleSession) {
      return DesiredYawDeg;
    }

    const EnemyTargets = this.GetEnemyBattleUnits(this.ActiveBattleSession.Units).filter(
      (Unit) => Unit.IsAlive
    );
    if (EnemyTargets.length < 1) {
      return DesiredYawDeg;
    }

    const CenterYawDeg = this.ResolveEnemyCenterAxisYawDeg(ControlledUnit, EnemyTargets);
    const HalfAngleDeg = this.ResolveEnemyCenteredFanHalfAngleDeg(
      ControlledUnit,
      EnemyTargets,
      CenterYawDeg
    );
    const OffsetFromCenter = this.NormalizeAngleDegrees(DesiredYawDeg - CenterYawDeg);
    const ClampedOffset = this.Clamp(OffsetFromCenter, -HalfAngleDeg, HalfAngleDeg);
    return CenterYawDeg + ClampedOffset;
  }

  private ResolveEnemyCenterAxisYawDeg(
    ControlledUnit: FBattleUnitRuntimeState,
    EnemyTargets: FBattleUnitRuntimeState[]
  ): number {
    if (EnemyTargets.length < 1) {
      return ControlledUnit.YawDeg;
    }

    let SumX = 0;
    let SumZ = 0;
    EnemyTargets.forEach((EnemyUnit) => {
      SumX += EnemyUnit.PositionCm.X;
      SumZ += EnemyUnit.PositionCm.Z;
    });

    const CenterX = SumX / EnemyTargets.length;
    const CenterZ = SumZ / EnemyTargets.length;
    const DeltaX = CenterX - ControlledUnit.PositionCm.X;
    const DeltaZ = CenterZ - ControlledUnit.PositionCm.Z;
    if (Math.abs(DeltaX) <= 1e-4 && Math.abs(DeltaZ) <= 1e-4) {
      return ControlledUnit.YawDeg;
    }

    return (Math.atan2(DeltaX, DeltaZ) * 180) / Math.PI;
  }

  private ResolveEnemyCenteredFanHalfAngleDeg(
    ControlledUnit: FBattleUnitRuntimeState,
    EnemyTargets: FBattleUnitRuntimeState[],
    CenterYawDeg: number
  ): number {
    if (EnemyTargets.length < 1) {
      return AimYawCenterFanMinHalfAngleDeg;
    }

    let MaxAbsOffsetDeg = 0;
    EnemyTargets.forEach((EnemyUnit) => {
      const EnemyYawDeg = this.ResolveYawTowardsUnit(ControlledUnit, EnemyUnit);
      const OffsetDeg = Math.abs(this.NormalizeAngleDegrees(EnemyYawDeg - CenterYawDeg));
      MaxAbsOffsetDeg = Math.max(MaxAbsOffsetDeg, OffsetDeg);
    });

    return this.Clamp(
      MaxAbsOffsetDeg + AimYawCenterFanPaddingDeg,
      AimYawCenterFanMinHalfAngleDeg,
      AimYawCenterFanMaxHalfAngleDeg
    );
  }

  private AlignAimFacingToEnemyCenterAxis(): boolean {
    if (
      !this.ActiveBattleSession ||
      this.RuntimePhase !== "Battle3C" ||
      !this.ActiveBattleSession.IsAimMode
    ) {
      return false;
    }

    const ControlledUnit = this.FindBattleUnit(this.ActiveBattleSession.ControlledCharacterId);
    if (!ControlledUnit || !ControlledUnit.IsAlive) {
      return false;
    }

    const EnemyTargets = this.GetEnemyBattleUnits(this.ActiveBattleSession.Units).filter(
      (Unit) => Unit.IsAlive
    );
    if (EnemyTargets.length < 1) {
      return false;
    }

    const CenterYawDeg = this.ResolveEnemyCenterAxisYawDeg(ControlledUnit, EnemyTargets);
    const NextYawDeg = this.NormalizeAngleDegrees(CenterYawDeg);
    if (Math.abs(this.NormalizeAngleDegrees(ControlledUnit.YawDeg - NextYawDeg)) <= 1e-3) {
      return false;
    }

    ControlledUnit.YawDeg = Number(NextYawDeg.toFixed(2));
    return true;
  }

  private EnsureAimFacingSnapshotMap(): Record<string, number> {
    if (!this.ActiveBattleSession) {
      return {};
    }

    if (!this.ActiveBattleSession.AimFacingSnapshotByUnitId) {
      this.ActiveBattleSession.AimFacingSnapshotByUnitId = {};
    }
    return this.ActiveBattleSession.AimFacingSnapshotByUnitId;
  }

  private RestoreFacingAfterAim(): void {
    if (!this.ActiveBattleSession) {
      return;
    }

    const Snapshot = this.ActiveBattleSession.AimFacingSnapshotByUnitId ?? {};
    Object.entries(Snapshot).forEach(([UnitId, YawDeg]) => {
      const Unit = this.FindBattleUnit(UnitId);
      if (Unit) {
        Unit.YawDeg = YawDeg;
      }
    });

    this.ActiveBattleSession.AimFacingSnapshotByUnitId = {};
    this.ActiveBattleSession.AimHoverTargetId = null;
    this.ActiveBattleSession.AimCameraYawDeg = null;
    this.ActiveBattleSession.AimCameraPitchDeg = null;
  }

  private ResolveYawTowardsUnit(
    OriginUnit: FBattleUnitRuntimeState,
    TargetUnit: FBattleUnitRuntimeState
  ): number {
    const DeltaX = TargetUnit.PositionCm.X - OriginUnit.PositionCm.X;
    const DeltaZ = TargetUnit.PositionCm.Z - OriginUnit.PositionCm.Z;
    if (Math.abs(DeltaX) <= 1e-4 && Math.abs(DeltaZ) <= 1e-4) {
      return OriginUnit.YawDeg;
    }

    return (Math.atan2(DeltaX, DeltaZ) * 180) / Math.PI;
  }

  private ResolveForwardVectorFromYawDeg(YawDeg: number): { X: number; Z: number } {
    const YawRadians = (YawDeg * Math.PI) / 180;
    return {
      X: Math.sin(YawRadians),
      Z: Math.cos(YawRadians)
    };
  }

  private ResolveRightVectorFromYawDeg(YawDeg: number): { X: number; Z: number } {
    const YawRadians = (YawDeg * Math.PI) / 180;
    return {
      X: Math.cos(YawRadians),
      Z: -Math.sin(YawRadians)
    };
  }

  // eslint-disable-next-line complexity
  private EmitBattleShotEvent(): void {
    if (!this.ActiveBattleSession) {
      return;
    }

    const AttackerUnitId = this.ActiveBattleSession.ControlledCharacterId;
    const Attacker = this.FindBattleUnit(AttackerUnitId);
    if (!Attacker || !Attacker.IsAlive) {
      return;
    }

    const TargetUnitId = this.ResolveCurrentBattleTargetForFire();
    const Target = TargetUnitId !== null ? this.FindBattleUnit(TargetUnitId) : null;
    const ResolvedTargetUnitId = Target && Target.IsAlive ? Target.UnitId : null;
    const PredictedDamageAmount =
      Target && Target.IsAlive ? this.ResolveShotPredictedDamageAmount(Target) : 0;
    const ImpactAtMs =
      Target && Target.IsAlive
        ? Date.now() +
          this.ResolveShotTravelDurationMs(Attacker, Target) +
          BattleHitReactionDelaySafetyMs
        : null;

    this.ActiveBattleSession.ShotSequence += 1;
    const ShotId = this.ActiveBattleSession.ShotSequence;
    this.ActiveBattleSession.LastShot = {
      ShotId,
      AttackerUnitId,
      TargetUnitId: ResolvedTargetUnitId,
      DamageAmount: PredictedDamageAmount,
      ImpactAtMs
    };

    if (ResolvedTargetUnitId && PredictedDamageAmount > 0 && ImpactAtMs !== null) {
      this.ScheduleShotImpact({
        ShotId,
        SessionId: this.ActiveBattleSession.SessionId,
        AttackerUnitId,
        TargetUnitId: ResolvedTargetUnitId,
        PredictedDamageAmount,
        ImpactAtMs
      });
    }
  }

  private ResolveShotPredictedDamageAmount(Target: FBattleUnitRuntimeState): number {
    const MaxDamageCanApply = Math.max(Target.CurrentHp, 0);
    return this.Clamp(BattleDefaultShotDamage, 0, MaxDamageCanApply);
  }

  private ScheduleShotImpact(Params: {
    ShotId: number;
    SessionId: string;
    AttackerUnitId: string;
    TargetUnitId: string;
    PredictedDamageAmount: number;
    ImpactAtMs: number;
  }): void {
    const DelayMs = Math.max(Params.ImpactAtMs - Date.now(), 0);
    const Handle = this.SetRuntimeTimeout(() => {
      this.ShotImpactTimerHandleByShotId.delete(Params.ShotId);
      if (
        this.RuntimePhase !== "Battle3C" ||
        !this.ActiveBattleSession ||
        this.ActiveBattleSession.SessionId !== Params.SessionId
      ) {
        return;
      }

      const Target = this.FindBattleUnit(Params.TargetUnitId);
      if (!Target || !Target.IsAlive) {
        return;
      }

      const DamageResult = this.ApplyDamageToBattleUnit(
        this.ActiveBattleSession,
        Target,
        Params.PredictedDamageAmount
      );
      if (DamageResult.AppliedDamageAmount <= 0) {
        return;
      }

      const Attacker = this.FindBattleUnit(Params.AttackerUnitId) ?? Target;
      this.QueueDamageCue(
        this.ActiveBattleSession,
        "Shot",
        Params.TargetUnitId,
        DamageResult.AppliedDamageAmount,
        Params.ImpactAtMs
      );
      if (!DamageResult.IsDefeated) {
        this.ScheduleUnitKnockbackAndReturn(Attacker, Target, 0);
      }
      this.NotifyRuntimeUpdated();
    }, DelayMs);
    this.ShotImpactTimerHandleByShotId.set(Params.ShotId, Handle);
  }

  private ApplyDamageToBattleUnit(
    Session: FBattle3CSession,
    Target: FBattleUnitRuntimeState,
    DamageAmount: number
  ): {
    AppliedDamageAmount: number;
    IsDefeated: boolean;
  } {
    const MaxDamageCanApply = Math.max(Target.CurrentHp, 0);
    const ActualDamageAmount = this.Clamp(DamageAmount, 0, MaxDamageCanApply);
    if (ActualDamageAmount <= 0) {
      return {
        AppliedDamageAmount: 0,
        IsDefeated: !Target.IsAlive
      };
    }

    const WasAlive = Target.IsAlive;
    Target.CurrentHp = this.Clamp(Target.CurrentHp - ActualDamageAmount, 0, Target.MaxHp);
    Target.IsAlive = Target.CurrentHp > 0;
    const IsDefeated = WasAlive && !Target.IsAlive;
    if (IsDefeated) {
      this.HandleBattleUnitDefeated(Session, Target);
    }
    return {
      AppliedDamageAmount: ActualDamageAmount,
      IsDefeated
    };
  }

  private HandleBattleUnitDefeated(
    Session: FBattle3CSession,
    Target: FBattleUnitRuntimeState
  ): void {
    this.ClearUnitHitReturnTimer(Target.UnitId);
    if (Session.AimHoverTargetId === Target.UnitId) {
      Session.AimHoverTargetId = null;
    }
    if (Session.ScriptFocus) {
      Session.ScriptFocus.TargetUnitIds = Session.ScriptFocus.TargetUnitIds.filter(
        (UnitId) => UnitId !== Target.UnitId
      );
      if (
        Session.ScriptFocus.AttackerUnitId === Target.UnitId ||
        Session.ScriptFocus.TargetUnitIds.length < 1
      ) {
        Session.ScriptFocus = null;
      }
    }

    if (Target.TeamId === "Enemy") {
      this.HandleEnemyUnitDefeated(Session, Target.UnitId);
      return;
    }

    this.HandlePlayerUnitDefeated(Session, Target.UnitId);
  }

  private HandleEnemyUnitDefeated(Session: FBattle3CSession, UnitId: string): void {
    Session.EnemyActiveUnitIds = Session.EnemyActiveUnitIds.filter(
      (ActiveUnitId) => ActiveUnitId !== UnitId
    );
    Session.TargetSelectOrderedEnemyUnitIds = (
      Session.TargetSelectOrderedEnemyUnitIds ?? []
    ).filter((OrderedUnitId) => OrderedUnitId !== UnitId);
    this.RebuildTargetSelectOrder(Session);
    this.AlignSelectedTargetForControlledCharacter();
  }

  private HandlePlayerUnitDefeated(Session: FBattle3CSession, UnitId: string): void {
    Session.PlayerActiveUnitIds = Session.PlayerActiveUnitIds.filter(
      (ActiveUnitId) => ActiveUnitId !== UnitId
    );
    if (Session.ControlledCharacterId !== UnitId) {
      return;
    }
    this.SwitchToNextAliveControlledCharacter(Session, "AutoSwitchCharacterAfterDefeat");
  }

  private ScheduleUnitKnockbackAndReturn(
    Attacker: FBattleUnitRuntimeState,
    Target: FBattleUnitRuntimeState,
    KnockbackDelayMs: number
  ): void {
    if (!this.ActiveBattleSession) {
      return;
    }

    const HomePosition = Target.HomePositionCm ?? { ...Target.PositionCm };
    Target.HomePositionCm = HomePosition;
    const KnockbackDirection = this.ResolveKnockbackDirection(Attacker, Target);
    const KnockedPosition = {
      X: HomePosition.X + KnockbackDirection.X * BattleHitKnockbackDistanceCm,
      Y: HomePosition.Y,
      Z: HomePosition.Z + KnockbackDirection.Z * BattleHitKnockbackDistanceCm
    };

    this.ClearUnitHitReturnTimer(Target.UnitId);
    const SessionId = this.ActiveBattleSession.SessionId;
    const KnockbackStartHandle = this.SetRuntimeTimeout(
      () => {
        this.HitReturnTimerHandleByUnitId.delete(Target.UnitId);
        if (
          this.RuntimePhase !== "Battle3C" ||
          !this.ActiveBattleSession ||
          this.ActiveBattleSession.SessionId !== SessionId
        ) {
          return;
        }

        const CurrentTarget = this.FindBattleUnit(Target.UnitId);
        if (!CurrentTarget) {
          return;
        }
        if (!CurrentTarget.HomePositionCm) {
          return;
        }
        CurrentTarget.PositionCm = { ...KnockedPosition };
        this.NotifyRuntimeUpdated();

        const ReturnHandle = this.SetRuntimeTimeout(() => {
          this.HitReturnTimerHandleByUnitId.delete(Target.UnitId);
          if (
            this.RuntimePhase !== "Battle3C" ||
            !this.ActiveBattleSession ||
            this.ActiveBattleSession.SessionId !== SessionId
          ) {
            return;
          }
          const ReturnTarget = this.FindBattleUnit(Target.UnitId);
          if (!ReturnTarget || !ReturnTarget.HomePositionCm) {
            return;
          }
          ReturnTarget.PositionCm = { ...ReturnTarget.HomePositionCm };
          this.NotifyRuntimeUpdated();
        }, BattleHitReturnDurationMs);
        this.HitReturnTimerHandleByUnitId.set(Target.UnitId, ReturnHandle);
      },
      Math.max(KnockbackDelayMs, 0)
    );
    this.HitReturnTimerHandleByUnitId.set(Target.UnitId, KnockbackStartHandle);
  }

  private ResolveShotTravelDurationMs(
    Attacker: FBattleUnitRuntimeState,
    Target: FBattleUnitRuntimeState
  ): number {
    const TargetHome = Target.HomePositionCm ?? Target.PositionCm;
    const DeltaX = TargetHome.X - Attacker.PositionCm.X;
    const DeltaY = TargetHome.Y - Attacker.PositionCm.Y;
    const DeltaZ = TargetHome.Z - Attacker.PositionCm.Z;
    const DistanceCm = Math.hypot(DeltaX, DeltaY, DeltaZ);
    if (!Number.isFinite(DistanceCm) || DistanceCm <= 0) {
      return BattleShotTravelMinMs;
    }

    const EstimatedMs = (DistanceCm / BattleShotTravelSpeedCmPerSec) * 1000;
    return this.Clamp(EstimatedMs, BattleShotTravelMinMs, BattleShotTravelMaxMs);
  }

  private ResolveKnockbackDirection(
    Attacker: FBattleUnitRuntimeState,
    Target: FBattleUnitRuntimeState
  ): { X: number; Z: number } {
    const HomePosition = Target.HomePositionCm ?? Target.PositionCm;
    const DeltaX = HomePosition.X - Attacker.PositionCm.X;
    const DeltaZ = HomePosition.Z - Attacker.PositionCm.Z;
    const Distance = Math.hypot(DeltaX, DeltaZ);
    if (Distance > 1e-4) {
      return {
        X: DeltaX / Distance,
        Z: DeltaZ / Distance
      };
    }

    const Facing = this.ResolveForwardVectorFromYawDeg(Target.YawDeg);
    return {
      X: Facing.X,
      Z: Facing.Z
    };
  }

  private ResolveCurrentBattleTargetForFire(): string | null {
    if (!this.ActiveBattleSession) {
      return null;
    }
    this.EnsureBattleCommandState(this.ActiveBattleSession);

    const EnemyTargets = this.ResolveSelectableEnemyTargets(this.ActiveBattleSession);
    if (EnemyTargets.length < 1) {
      return null;
    }

    if (this.ActiveBattleSession.IsAimMode) {
      return this.ActiveBattleSession.AimHoverTargetId;
    }

    return (
      EnemyTargets[this.ActiveBattleSession.SelectedTargetIndex % EnemyTargets.length]?.UnitId ??
      null
    );
  }

  private AlignSelectedTargetForControlledCharacter(): void {
    if (!this.ActiveBattleSession) {
      return;
    }
    if (
      this.ActiveBattleSession.CommandStage === "TargetSelect" &&
      this.ActiveBattleSession.PendingActionKind === "Item"
    ) {
      this.AlignSelectedPlayerTargetForItem(this.ActiveBattleSession);
      return;
    }

    const ControlledUnit = this.FindBattleUnit(this.ActiveBattleSession.ControlledCharacterId);
    if (!ControlledUnit || !ControlledUnit.IsAlive) {
      return;
    }

    const EnemyTargets = this.GetEnemyBattleUnits(this.ActiveBattleSession.Units).filter(
      (Unit) => Unit.IsAlive
    );
    if (EnemyTargets.length < 1) {
      return;
    }

    const BestIndex = this.ResolvePreferredTargetIndexForControlledCharacter(
      ControlledUnit,
      EnemyTargets
    );
    if (BestIndex === null) {
      return;
    }

    const PreferredTargetId = EnemyTargets[BestIndex]?.UnitId;
    const OrderedTargets = this.ResolveSelectableEnemyTargets(this.ActiveBattleSession);
    if (PreferredTargetId) {
      const OrderedIndex = OrderedTargets.findIndex((Unit) => Unit.UnitId === PreferredTargetId);
      if (OrderedIndex >= 0) {
        this.ActiveBattleSession.SelectedTargetIndex = OrderedIndex;
        return;
      }
    }
    this.ActiveBattleSession.SelectedTargetIndex = BestIndex;
  }

  private AlignSelectedPlayerTargetForItem(Session: FBattle3CSession): void {
    const PlayerTargets = this.ResolveSelectablePlayerTargets(Session);
    if (PlayerTargets.length < 1) {
      return;
    }

    const ControlledIndex = PlayerTargets.findIndex(
      (Unit) => Unit.UnitId === Session.ControlledCharacterId
    );
    Session.SelectedTargetIndex = ControlledIndex >= 0 ? ControlledIndex : 0;
  }

  private ResolvePreferredTargetIndexForControlledCharacter(
    ControlledUnit: FBattleUnitRuntimeState,
    EnemyTargets: FBattleUnitRuntimeState[]
  ): number | null {
    if (EnemyTargets.length < 1) {
      return null;
    }

    const ReferenceYawDeg = ControlledUnit.YawDeg;
    let BestIndex = 0;
    let BestYawDeltaAbs = Number.POSITIVE_INFINITY;
    let BestDistanceSquared = Number.POSITIVE_INFINITY;

    EnemyTargets.forEach((EnemyUnit, Index) => {
      const TargetYawDeg = this.ResolveYawTowardsUnit(ControlledUnit, EnemyUnit);
      const YawDeltaAbs = Math.abs(this.NormalizeAngleDegrees(TargetYawDeg - ReferenceYawDeg));
      const DeltaX = EnemyUnit.PositionCm.X - ControlledUnit.PositionCm.X;
      const DeltaZ = EnemyUnit.PositionCm.Z - ControlledUnit.PositionCm.Z;
      const DistanceSquared = DeltaX * DeltaX + DeltaZ * DeltaZ;
      if (
        YawDeltaAbs < BestYawDeltaAbs - 1e-6 ||
        (Math.abs(YawDeltaAbs - BestYawDeltaAbs) <= 1e-6 && DistanceSquared < BestDistanceSquared)
      ) {
        BestIndex = Index;
        BestYawDeltaAbs = YawDeltaAbs;
        BestDistanceSquared = DistanceSquared;
      }
    });

    return BestIndex;
  }

  private IsBattleIdleControlState(Session: FBattle3CSession): boolean {
    this.EnsureBattleCommandState(Session);
    return Session.CommandStage === "Root" && !Session.IsAimMode && Session.ScriptFocus === null;
  }

  private AdvanceEnemyScriptStep(): void {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return;
    }

    const EnemyUnits = this.GetEnemyBattleUnits(this.ActiveBattleSession.Units);
    const PlayerUnits = this.GetPlayerBattleUnits(this.ActiveBattleSession.Units).filter(
      (Unit) => Unit.IsAlive
    );
    if (EnemyUnits.length < 1 || PlayerUnits.length < 1) {
      return;
    }

    const Steps: FBattleScriptStep[] = EnemyUnits.map((EnemyUnit, Index) => {
      const IsAOE = Index === EnemyUnits.length - 1 && PlayerUnits.length > 1;
      return {
        CameraMode: IsAOE ? "EnemyAttackAOE" : "EnemyAttackSingle",
        AttackerUnitId: EnemyUnit.UnitId,
        TargetUnitIds: IsAOE
          ? PlayerUnits.map((Unit) => Unit.UnitId)
          : [PlayerUnits[Index % PlayerUnits.length].UnitId]
      };
    });
    const CurrentStep = Steps[this.ActiveBattleSession.ScriptStepIndex % Steps.length];
    this.ActiveBattleSession.ScriptFocus = {
      AttackerUnitId: CurrentStep.AttackerUnitId,
      TargetUnitIds: [...CurrentStep.TargetUnitIds]
    };
    this.ActiveBattleSession.CameraMode = CurrentStep.CameraMode;
    this.ActiveBattleSession.ScriptStepIndex =
      (this.ActiveBattleSession.ScriptStepIndex + 1) % Steps.length;
    this.EmitRuntimeEvent(
      "EBattle3CActionRequested",
      `EnemyScript:${CurrentStep.CameraMode}:${CurrentStep.AttackerUnitId}`
    );

    this.ClearEnemyScriptReturnTimer();
    const SessionId = this.ActiveBattleSession.SessionId;
    this.EnemyScriptReturnTimerHandle = this.SetRuntimeTimeout(() => {
      if (
        this.RuntimePhase !== "Battle3C" ||
        !this.ActiveBattleSession ||
        this.ActiveBattleSession.SessionId !== SessionId
      ) {
        return;
      }
      this.ActiveBattleSession.ScriptFocus = null;
      this.ActiveBattleSession.CameraMode = this.ResolveBattleControlCameraMode(
        this.ActiveBattleSession
      );
      this.NotifyRuntimeUpdated();
    }, EnemyScriptCameraHoldMs);

    this.NotifyRuntimeUpdated();
  }

  private ResolveCrosshairPosition(
    Current: { X: number; Y: number },
    AimDelta: { X: number; Y: number }
  ): { X: number; Y: number } {
    return {
      X: this.NormalizeCrosshairCoordinate(Current.X + AimDelta.X / CrosshairReferenceWidth),
      Y: this.NormalizeCrosshairCoordinate(Current.Y + AimDelta.Y / CrosshairReferenceHeight)
    };
  }

  private ResolveAbsoluteCrosshairPosition(ScreenPosition: { X: number; Y: number }): {
    X: number;
    Y: number;
  } {
    return {
      X: this.NormalizeCrosshairCoordinate(ScreenPosition.X),
      Y: this.NormalizeCrosshairCoordinate(ScreenPosition.Y)
    };
  }

  private NormalizeCrosshairCoordinate(Value: number): number {
    return Number(this.Clamp(Value, CrosshairMin, CrosshairMax).toFixed(4));
  }

  // eslint-disable-next-line complexity
  private ResolveBattleControlCameraMode(Session: FBattle3CSession): FBattleCameraMode {
    this.EnsureBattleCommandState(Session);
    if (Session.ScriptFocus) {
      return Session.ScriptFocus.TargetUnitIds.length > 1 ? "EnemyAttackAOE" : "EnemyAttackSingle";
    }
    if (Session.CommandStage === "SkillMenu") {
      return "PlayerSkillPreview";
    }
    if (Session.CommandStage === "ItemMenu") {
      return "PlayerItemPreview";
    }
    if (Session.CommandStage === "TargetSelect") {
      if (Session.PendingActionKind === "Item") {
        return "PlayerItemPreview";
      }
      return "SkillTargetZoom";
    }
    if (Session.CommandStage === "ActionResolve") {
      if ((Session.PendingActionResolvedDetail ?? "").startsWith("Item:")) {
        return "PlayerItemPreview";
      }
      if ((Session.PendingActionResolvedDetail ?? "").startsWith("Attack:")) {
        return "PlayerFollow";
      }
      return "SkillTargetZoom";
    }
    if (Session.IsAimMode) {
      return "PlayerAim";
    }
    return "PlayerFollow";
  }

  private FindBattleUnit(UnitId: string): FBattleUnitRuntimeState | null {
    const Found = this.ActiveBattleSession?.Units.find((Unit) => Unit.UnitId === UnitId);
    return Found ?? null;
  }

  private GetEnemyBattleUnits(Units: FBattleUnitRuntimeState[]): FBattleUnitRuntimeState[] {
    return Units.filter((Unit) => Unit.TeamId === "Enemy" && Unit.IsAlive);
  }

  private GetPlayerBattleUnits(Units: FBattleUnitRuntimeState[]): FBattleUnitRuntimeState[] {
    return Units.filter((Unit) => Unit.TeamId === "Player");
  }

  private NotifyRuntimeUpdated(): void {
    const ViewModel = this.GetViewModel();
    this.RuntimeListeners.forEach((Listener) => Listener(ViewModel));
  }

  private AppendLog(LogLine: string): void {
    this.EventLogs = [...this.EventLogs, LogLine].slice(-36);
  }

  private EmitRuntimeEvent(EventType: FRuntimeEventType, Detail?: string): void {
    this.AppendLog(Detail ? `RT | ${EventType} | ${Detail}` : `RT | ${EventType}`);
  }

  private Clamp(Value: number, Min: number, Max: number): number {
    return Math.min(Math.max(Value, Min), Max);
  }

  private NormalizeAngleDegrees(AngleDeg: number): number {
    let Normalized = (AngleDeg + 180) % 360;
    if (Normalized < 0) {
      Normalized += 360;
    }
    return Normalized - 180;
  }

  private SyncCameraPitchFromConfig(): void {
    this.CameraPitchDegrees = this.Clamp(
      this.DebugConfig.CameraPitch,
      this.DebugConfig.LookPitchMin,
      this.DebugConfig.LookPitchMax
    );
    this.DebugConfig = {
      ...this.DebugConfig,
      CameraPitch: this.CameraPitchDegrees
    };
  }

  private SetRuntimeTimeout(Handler: () => void, DelayMs: number): number {
    if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
      return window.setTimeout(Handler, DelayMs);
    }
    return globalThis.setTimeout(Handler, DelayMs) as unknown as number;
  }

  private ClearRuntimeTimeout(Handle: number): void {
    if (typeof window !== "undefined" && typeof window.clearTimeout === "function") {
      window.clearTimeout(Handle);
      return;
    }
    globalThis.clearTimeout(Handle as unknown as ReturnType<typeof setTimeout>);
  }

  private ClearEnemyScriptReturnTimer(): void {
    if (this.EnemyScriptReturnTimerHandle !== null) {
      this.ClearRuntimeTimeout(this.EnemyScriptReturnTimerHandle);
      this.EnemyScriptReturnTimerHandle = null;
    }
  }

  private ClearActionResolveTimer(): void {
    if (this.ActionResolveTimerHandle !== null) {
      this.ClearRuntimeTimeout(this.ActionResolveTimerHandle);
      this.ActionResolveTimerHandle = null;
    }
  }

  private ClearActionToastTimer(): void {
    if (this.ActionToastTimerHandle !== null) {
      this.ClearRuntimeTimeout(this.ActionToastTimerHandle);
      this.ActionToastTimerHandle = null;
    }
  }

  private ClearUnitHitReturnTimer(UnitId: string): void {
    const Handle = this.HitReturnTimerHandleByUnitId.get(UnitId);
    if (Handle === undefined) {
      return;
    }
    this.ClearRuntimeTimeout(Handle);
    this.HitReturnTimerHandleByUnitId.delete(UnitId);
  }

  private ClearAllUnitHitReturnTimers(): void {
    this.HitReturnTimerHandleByUnitId.forEach((Handle) => {
      this.ClearRuntimeTimeout(Handle);
    });
    this.HitReturnTimerHandleByUnitId.clear();
  }

  private ClearAllShotImpactTimers(): void {
    this.ShotImpactTimerHandleByShotId.forEach((Handle) => {
      this.ClearRuntimeTimeout(Handle);
    });
    this.ShotImpactTimerHandleByShotId.clear();
  }

  private ClearAllMeleeTimelineTimers(): void {
    this.MeleeTimelineTimerHandles.forEach((Handle) => {
      this.ClearRuntimeTimeout(Handle);
    });
    this.MeleeTimelineTimerHandles.clear();
  }

  private ClearPhaseTimers(): void {
    if (this.EncounterPromptTimerHandle !== null) {
      this.ClearRuntimeTimeout(this.EncounterPromptTimerHandle);
      this.EncounterPromptTimerHandle = null;
    }
    if (this.EncounterFinishTimerHandle !== null) {
      this.ClearRuntimeTimeout(this.EncounterFinishTimerHandle);
      this.EncounterFinishTimerHandle = null;
    }
    this.ClearEnemyScriptReturnTimer();
    this.ClearActionResolveTimer();
    this.ClearActionToastTimer();
    this.ClearAllUnitHitReturnTimers();
    this.ClearAllShotImpactTimers();
    this.ClearAllMeleeTimelineTimers();
  }
}
