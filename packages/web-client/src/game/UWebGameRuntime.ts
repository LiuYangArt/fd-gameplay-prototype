import {
  EOverworldCommandType,
  EOverworldEventType,
  UOverworldSimulation,
  type FTeamPackageSnapshot,
  type FUnitCombatRuntimeSnapshot,
  type FUnitStaticConfig,
  type FOverworldEnemyState,
  type FOverworldVector2
} from "@fd/gameplay-core";

import { UDebugConfigStore, type FDebugConfig } from "../debug/UDebugConfigStore";

import type { FInputSnapshot } from "../input/FInputSnapshot";
import type {
  FBattle3CHudState,
  FBattleCameraMode,
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
  AimCameraYawDeg: number | null;
  SelectedTargetIndex: number;
  AimHoverTargetId: string | null;
  ScriptStepIndex: number;
  ShotSequence: number;
  LastShot: FBattleShotHudState | null;
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
const EnemyScriptCameraHoldMs = 680;
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
  private readonly OverworldSimulation: UOverworldSimulation;
  private readonly DebugConfigStore: UDebugConfigStore;
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
  private SettlementSummaryText: string;

  public constructor() {
    this.RuntimeListeners = new Set();
    this.OverworldSimulation = new UOverworldSimulation();
    this.DebugConfigStore = new UDebugConfigStore();
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
    this.SettlementSummaryText = "按 Enter 或手柄 A 返回大地图探索";

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
    if (InputSnapshot.ToggleDebugEdge) {
      this.ToggleDebugMenu();
    }

    if (InputSnapshot.RestartEdge) {
      this.StartGame();
      return;
    }

    if (
      InputSnapshot.ForceSettlementEdge &&
      (this.RuntimePhase === "Battle3C" || this.RuntimePhase === "EncounterTransition")
    ) {
      this.RequestSettlementPreview("调试触发（Alt+Q）");
      return;
    }

    switch (this.RuntimePhase) {
      case "Overworld":
        this.ConsumeOverworldInput(InputSnapshot);
        return;
      case "Battle3C":
        this.ConsumeBattle3CInput(InputSnapshot);
        return;
      case "SettlementPreview":
        if (InputSnapshot.ConfirmSettlementEdge) {
          this.ConfirmSettlementPreview();
        }
        return;
      case "EncounterTransition":
      default:
        return;
    }
  }

  public ToggleBattleAim(): void {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return;
    }

    this.ActiveBattleSession.IsAimMode = !this.ActiveBattleSession.IsAimMode;
    if (this.ActiveBattleSession.IsAimMode) {
      this.ActiveBattleSession.IsSkillTargetMode = false;
      this.ActiveBattleSession.AimFacingSnapshotByUnitId = {};
      const ControlledUnit = this.FindBattleUnit(this.ActiveBattleSession.ControlledCharacterId);
      this.ActiveBattleSession.AimCameraYawDeg = ControlledUnit?.YawDeg ?? 0;
      this.CaptureAimFacingSnapshot(this.ActiveBattleSession.ControlledCharacterId);
      this.UpdateAimControlledFacingFromCrosshair();
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

  public FireBattleAction(): void {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return;
    }

    const TargetUnitId = this.ResolveCurrentBattleTargetForFire();
    if (TargetUnitId) {
      this.FaceControlledUnitTowardsTarget(TargetUnitId);
    }
    this.EmitBattleShotEvent();
    this.EmitRuntimeEvent("EBattle3CActionRequested", "Fire");
    if (this.ActiveBattleSession.IsAimMode) {
      this.ActiveBattleSession.CameraMode = this.ResolveBattleControlCameraMode(
        this.ActiveBattleSession
      );
      this.NotifyRuntimeUpdated();
      return;
    }

    this.AdvanceEnemyScriptStep();
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

  public SwitchControlledCharacter(): void {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return;
    }

    const AlivePlayerUnitIds = this.ActiveBattleSession.PlayerActiveUnitIds.filter((UnitId) => {
      const Unit = this.FindBattleUnit(UnitId);
      return Unit?.IsAlive ?? false;
    });
    if (AlivePlayerUnitIds.length <= 1) {
      return;
    }

    const CurrentIndex = AlivePlayerUnitIds.indexOf(this.ActiveBattleSession.ControlledCharacterId);
    const NextIndex = CurrentIndex < 0 ? 0 : (CurrentIndex + 1) % AlivePlayerUnitIds.length;
    this.ActiveBattleSession.ControlledCharacterId = AlivePlayerUnitIds[NextIndex];
    this.ActiveBattleSession.AimHoverTargetId = null;
    if (this.ActiveBattleSession.IsAimMode) {
      const ControlledUnit = this.FindBattleUnit(this.ActiveBattleSession.ControlledCharacterId);
      this.ActiveBattleSession.AimCameraYawDeg = ControlledUnit?.YawDeg ?? 0;
      this.CaptureAimFacingSnapshot(this.ActiveBattleSession.ControlledCharacterId);
      this.UpdateAimControlledFacingFromCrosshair();
    }
    this.ActiveBattleSession.CameraMode = this.ResolveBattleControlCameraMode(
      this.ActiveBattleSession
    );
    this.EmitRuntimeEvent("EBattle3CActionRequested", "SwitchCharacter");
    this.NotifyRuntimeUpdated();
  }

  public ToggleBattleSkillTargetMode(): void {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return;
    }

    this.ActiveBattleSession.IsSkillTargetMode = !this.ActiveBattleSession.IsSkillTargetMode;
    if (this.ActiveBattleSession.IsSkillTargetMode) {
      this.ActiveBattleSession.IsAimMode = false;
      this.RestoreFacingAfterAim();
    }
    this.ActiveBattleSession.CameraMode = this.ResolveBattleControlCameraMode(
      this.ActiveBattleSession
    );
    this.EmitRuntimeEvent("EBattle3CActionRequested", "ToggleSkillTargetMode");
    this.NotifyRuntimeUpdated();
  }

  public CycleBattleTarget(Direction: number): void {
    if (
      !this.ActiveBattleSession ||
      this.RuntimePhase !== "Battle3C" ||
      !this.ActiveBattleSession.IsSkillTargetMode
    ) {
      return;
    }

    const EnemyTargets = this.GetEnemyBattleUnits(this.ActiveBattleSession.Units);
    if (EnemyTargets.length <= 1) {
      return;
    }

    const Delta = Direction >= 0 ? 1 : -1;
    const NextIndex =
      (this.ActiveBattleSession.SelectedTargetIndex + Delta + EnemyTargets.length) %
      EnemyTargets.length;
    this.ActiveBattleSession.SelectedTargetIndex = NextIndex;
    this.EmitRuntimeEvent(
      "EBattle3CActionRequested",
      `CycleTarget:${Delta > 0 ? "Right" : "Left"}`
    );
    this.NotifyRuntimeUpdated();
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

  public FleeBattleToOverworld(): void {
    if (
      this.RuntimePhase !== "Battle3C" &&
      this.RuntimePhase !== "EncounterTransition" &&
      this.RuntimePhase !== "SettlementPreview"
    ) {
      return;
    }

    this.ReturnToOverworldFromBattle("EBattleFleeRequested");
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
        ConfirmHintText: "确认键：Enter / 手柄 A"
      },
      DebugState: {
        IsMenuOpen: this.IsDebugMenuOpen,
        Config: {
          ...this.DebugConfig,
          CameraPitch: this.CameraPitchDegrees
        },
        LastUpdatedAtIso: this.LastDebugUpdatedAtIso
      },
      EventLogs: this.EventLogs
    };
  }

  private ResolveRemainingTransitionMs(): number {
    if (this.RuntimePhase !== "EncounterTransition" || !this.EncounterTransitionEndAtMs) {
      return 0;
    }
    return Math.max(this.EncounterTransitionEndAtMs - Date.now(), 0);
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
        AimCameraYawDeg: null,
        SelectedTargetId: null,
        HoveredTargetId: null,
        Units: [],
        ScriptFocus: null,
        LastShot: null
      };
    }

    const EnemyTargets = this.GetEnemyBattleUnits(BattleSession.Units);
    const SelectedTargetId =
      EnemyTargets.length > 0
        ? (EnemyTargets[BattleSession.SelectedTargetIndex % EnemyTargets.length]?.UnitId ?? null)
        : null;

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
      IsSkillTargetMode: BattleSession.IsSkillTargetMode,
      AimCameraYawDeg: BattleSession.AimCameraYawDeg,
      SelectedTargetId,
      HoveredTargetId: BattleSession.AimHoverTargetId,
      Units: BattleSession.Units.map((Unit) => ({
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
        IsControlled: Unit.UnitId === BattleSession.ControlledCharacterId,
        IsSelectedTarget: Unit.UnitId === SelectedTargetId,
        IsEncounterPrimaryEnemy: Unit.IsEncounterPrimaryEnemy
      })),
      ScriptFocus: BattleSession.ScriptFocus
        ? {
            AttackerUnitId: BattleSession.ScriptFocus.AttackerUnitId,
            TargetUnitIds: [...BattleSession.ScriptFocus.TargetUnitIds]
          }
        : null,
      LastShot: BattleSession.LastShot ? { ...BattleSession.LastShot } : null
    };
  }

  public GetOverworldEnemies(): FOverworldEnemyState[] {
    return Object.values(this.OverworldSimulation.GetState().Enemies);
  }

  private ConsumeOverworldInput(InputSnapshot: FInputSnapshot): void {
    const NextPitch = this.Clamp(
      this.CameraPitchDegrees + InputSnapshot.LookPitchDeltaDegrees,
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

  private ConsumeBattle3CInput(InputSnapshot: FInputSnapshot): void {
    if (!this.ActiveBattleSession) {
      return;
    }

    if (this.TryHandleBattle3CImmediateActions(InputSnapshot)) {
      return;
    }

    let IsDirty = false;

    const NextCrosshair = InputSnapshot.AimScreenPosition
      ? this.ResolveAbsoluteCrosshairPosition(InputSnapshot.AimScreenPosition)
      : this.ResolveCrosshairPosition(
          this.ActiveBattleSession.CrosshairScreenPosition,
          InputSnapshot.AimScreenDelta
        );
    if (
      NextCrosshair.X !== this.ActiveBattleSession.CrosshairScreenPosition.X ||
      NextCrosshair.Y !== this.ActiveBattleSession.CrosshairScreenPosition.Y
    ) {
      this.ActiveBattleSession.CrosshairScreenPosition = NextCrosshair;
      IsDirty = true;
    }
    if (this.UpdateAimControlledFacingFromCrosshair()) {
      IsDirty = true;
    }

    if (IsDirty) {
      this.NotifyRuntimeUpdated();
    }
  }

  private TryHandleBattle3CImmediateActions(InputSnapshot: FInputSnapshot): boolean {
    if (!this.ActiveBattleSession) {
      return false;
    }

    if (InputSnapshot.CancelAimEdge && this.ActiveBattleSession.IsAimMode) {
      this.ExitBattleAimMode();
      return true;
    }
    if (InputSnapshot.ToggleAimEdge) {
      this.ToggleBattleAim();
      return true;
    }
    if (InputSnapshot.SwitchCharacterEdge) {
      this.SwitchControlledCharacter();
      return true;
    }
    if (InputSnapshot.ToggleSkillTargetModeEdge) {
      this.ToggleBattleSkillTargetMode();
      return true;
    }
    if (InputSnapshot.CycleTargetAxis !== 0) {
      this.CycleBattleTarget(InputSnapshot.CycleTargetAxis);
      return true;
    }
    if (InputSnapshot.FireEdge) {
      this.FireBattleAction();
      return true;
    }

    return false;
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
    this.EncounterPromptTimerHandle = window.setTimeout(() => {
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
    this.ActiveBattleSession.CameraMode = "IntroDropIn";
    this.RuntimePhase = "EncounterTransition";
    this.EncounterPromptText = null;
    this.EncounterTransitionStartedAtMs = StartedAtMs;
    this.EncounterTransitionEndAtMs = StartedAtMs + TransitionTotalMs;
    this.EmitRuntimeEvent(
      "EEncounterTransitionStarted",
      this.ActiveEncounterContext.EncounterEnemyId
    );

    this.EncounterFinishTimerHandle = window.setTimeout(() => {
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
      AimCameraYawDeg: null,
      SelectedTargetIndex: 0,
      AimHoverTargetId: null,
      ScriptStepIndex: 0,
      ShotSequence: 0,
      LastShot: null,
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
        PositionCm,
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

  private UpdateAimControlledFacingFromCrosshair(): boolean {
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

    const YawRange = this.ResolveAimFacingYawRange(ControlledUnit, EnemyTargets);
    if (!YawRange) {
      return false;
    }

    this.CaptureAimFacingSnapshot(ControlledUnit.UnitId);
    const AimX = this.Clamp(
      this.ActiveBattleSession.CrosshairScreenPosition.X,
      CrosshairMin,
      CrosshairMax
    );
    const DesiredYawDeg = YawRange.MinYawDeg + (YawRange.MaxYawDeg - YawRange.MinYawDeg) * AimX;
    const DeltaYawDeg = this.NormalizeAngleDegrees(DesiredYawDeg - ControlledUnit.YawDeg);
    if (Math.abs(DeltaYawDeg) <= 1e-3) {
      return false;
    }

    ControlledUnit.YawDeg = Number(DesiredYawDeg.toFixed(2));
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

  private ResolveAimFacingYawRange(
    ControlledUnit: FBattleUnitRuntimeState,
    EnemyTargets: FBattleUnitRuntimeState[]
  ): { MinYawDeg: number; MaxYawDeg: number } | null {
    const Snapshot = this.ActiveBattleSession?.AimFacingSnapshotByUnitId ?? {};
    const ReferenceYawDeg = Snapshot[ControlledUnit.UnitId] ?? ControlledUnit.YawDeg;
    const NormalizedYawList = EnemyTargets.map((TargetUnit) => {
      const RawYawDeg = this.ResolveYawTowardsUnit(ControlledUnit, TargetUnit);
      return ReferenceYawDeg + this.NormalizeAngleDegrees(RawYawDeg - ReferenceYawDeg);
    });
    if (NormalizedYawList.length < 1) {
      return null;
    }

    return {
      MinYawDeg: Math.min(...NormalizedYawList),
      MaxYawDeg: Math.max(...NormalizedYawList)
    };
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
  }

  private FaceControlledUnitTowardsTarget(TargetUnitId: string): void {
    if (!this.ActiveBattleSession) {
      return;
    }

    const ControlledUnit = this.FindBattleUnit(this.ActiveBattleSession.ControlledCharacterId);
    const TargetUnit = this.FindBattleUnit(TargetUnitId);
    if (!ControlledUnit || !TargetUnit || !ControlledUnit.IsAlive || !TargetUnit.IsAlive) {
      return;
    }

    this.CaptureAimFacingSnapshot(ControlledUnit.UnitId);
    ControlledUnit.YawDeg = Number(
      this.ResolveYawTowardsUnit(ControlledUnit, TargetUnit).toFixed(2)
    );
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
    if (!TargetUnitId) {
      return;
    }

    const Target = this.FindBattleUnit(TargetUnitId);
    if (!Target || !Target.IsAlive) {
      return;
    }

    this.ActiveBattleSession.ShotSequence += 1;
    this.ActiveBattleSession.LastShot = {
      ShotId: this.ActiveBattleSession.ShotSequence,
      AttackerUnitId,
      TargetUnitId
    };
  }

  private ResolveCurrentBattleTargetForFire(): string | null {
    if (!this.ActiveBattleSession) {
      return null;
    }

    if (this.ActiveBattleSession.AimHoverTargetId !== null) {
      return this.ActiveBattleSession.AimHoverTargetId;
    }

    const EnemyTargets = this.GetEnemyBattleUnits(this.ActiveBattleSession.Units);
    if (EnemyTargets.length < 1) {
      return null;
    }
    return (
      EnemyTargets[this.ActiveBattleSession.SelectedTargetIndex % EnemyTargets.length]?.UnitId ??
      null
    );
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
    this.EnemyScriptReturnTimerHandle = window.setTimeout(() => {
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

  private ResolveBattleControlCameraMode(Session: FBattle3CSession): FBattleCameraMode {
    if (Session.ScriptFocus) {
      return Session.ScriptFocus.TargetUnitIds.length > 1 ? "EnemyAttackAOE" : "EnemyAttackSingle";
    }
    if (Session.IsSkillTargetMode) {
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

  private ClearEnemyScriptReturnTimer(): void {
    if (this.EnemyScriptReturnTimerHandle !== null) {
      window.clearTimeout(this.EnemyScriptReturnTimerHandle);
      this.EnemyScriptReturnTimerHandle = null;
    }
  }

  private ClearPhaseTimers(): void {
    if (this.EncounterPromptTimerHandle !== null) {
      window.clearTimeout(this.EncounterPromptTimerHandle);
      this.EncounterPromptTimerHandle = null;
    }
    if (this.EncounterFinishTimerHandle !== null) {
      window.clearTimeout(this.EncounterFinishTimerHandle);
      this.EncounterFinishTimerHandle = null;
    }
    this.ClearEnemyScriptReturnTimer();
  }
}
