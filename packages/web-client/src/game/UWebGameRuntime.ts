import {
  EOverworldCommandType,
  EOverworldEventType,
  UOverworldSimulation,
  type FOverworldEnemyState,
  type FOverworldVector2
} from "@fd/gameplay-core";

import { UDebugConfigStore, type FDebugConfig } from "../debug/UDebugConfigStore";

import type { FInputSnapshot } from "../input/FInputSnapshot";
import type {
  FBattle3CHudState,
  FBattleCameraMode,
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
  | "ESettlementPreviewConfirmed";

interface FImportDebugConfigResult {
  IsSuccess: boolean;
  ErrorMessage: string | null;
}

interface FEncounterContext {
  EncounterEnemyId: string;
  PlayerPosition: FOverworldVector2;
  EnemyPosition: FOverworldVector2;
  BattleAnchorCm: FVector3Cm;
  TriggeredAtMs: number;
}

interface FBattleUnitRuntimeState {
  UnitId: string;
  DisplayName: string;
  TeamId: "Player" | "Enemy";
  PositionCm: FVector3Cm;
  YawDeg: number;
  IsAlive: boolean;
  IsEncounterPrimaryEnemy: boolean;
}

interface FBattle3CSession {
  SessionId: string;
  ControlledCharacterId: string;
  CameraMode: FBattleCameraMode;
  CrosshairScreenPosition: {
    X: number;
    Y: number;
  };
  IsAimMode: boolean;
  IsSkillTargetMode: boolean;
  SelectedTargetIndex: number;
  ScriptStepIndex: number;
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
const CrosshairMin = 0.08;
const CrosshairMax = 0.92;
const CrosshairReferenceWidth = 1600;
const CrosshairReferenceHeight = 900;
const EnemyScriptCameraHoldMs = 680;

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
    }
    this.ActiveBattleSession.CameraMode = this.ResolveBattleControlCameraMode(
      this.ActiveBattleSession
    );
    this.EmitRuntimeEvent("EBattle3CActionRequested", "ToggleAim");
    this.NotifyRuntimeUpdated();
  }

  public FireBattleAction(): void {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return;
    }

    this.EmitRuntimeEvent("EBattle3CActionRequested", "Fire");
    this.AdvanceEnemyScriptStep();
  }

  public SwitchControlledCharacter(): void {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return;
    }

    this.ActiveBattleSession.ControlledCharacterId =
      this.ActiveBattleSession.ControlledCharacterId === "P_YELLOW" ? "P_RED" : "P_YELLOW";
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
    this.EmitRuntimeEvent("ESettlementPreviewConfirmed");
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
    const OverworldState = this.OverworldSimulation.GetState();
    const BattleSession = this.ActiveBattleSession;
    const EnemyTargets = BattleSession ? this.GetEnemyBattleUnits(BattleSession.Units) : [];
    const SelectedTargetId =
      BattleSession && EnemyTargets.length > 0
        ? (EnemyTargets[BattleSession.SelectedTargetIndex % EnemyTargets.length]?.UnitId ?? null)
        : null;
    const RemainingTransitionMs =
      this.RuntimePhase === "EncounterTransition" && this.EncounterTransitionEndAtMs
        ? Math.max(this.EncounterTransitionEndAtMs - Date.now(), 0)
        : 0;
    const Battle3CHudState: FBattle3CHudState = BattleSession
      ? {
          ControlledCharacterId: BattleSession.ControlledCharacterId,
          CameraMode: BattleSession.CameraMode,
          CrosshairScreenPosition: { ...BattleSession.CrosshairScreenPosition },
          ScriptStepIndex: BattleSession.ScriptStepIndex,
          IsAimMode: BattleSession.IsAimMode,
          IsSkillTargetMode: BattleSession.IsSkillTargetMode,
          SelectedTargetId,
          Units: BattleSession.Units.map((Unit) => ({
            UnitId: Unit.UnitId,
            DisplayName: Unit.DisplayName,
            TeamId: Unit.TeamId,
            PositionCm: { ...Unit.PositionCm },
            YawDeg: Unit.YawDeg,
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
            : null
        }
      : {
          ControlledCharacterId: null,
          CameraMode: "PlayerFollow",
          CrosshairScreenPosition: { X: 0.5, Y: 0.5 },
          ScriptStepIndex: 0,
          IsAimMode: false,
          IsSkillTargetMode: false,
          SelectedTargetId: null,
          Units: [],
          ScriptFocus: null
        };

    return {
      RuntimePhase: this.RuntimePhase,
      OverworldState: {
        Phase: OverworldState.Phase,
        PlayerPosition: { ...OverworldState.Player.Position },
        PlayerYawDegrees: OverworldState.Player.YawDegrees,
        Enemies: Object.values(OverworldState.Enemies),
        PendingEncounterEnemyId: OverworldState.PendingEncounterEnemyId,
        LastEncounterEnemyId: this.LastEncounterEnemyId
      },
      EncounterState: {
        EncounterEnemyId: this.ActiveEncounterContext?.EncounterEnemyId ?? null,
        PromptText: this.EncounterPromptText,
        StartedAtMs: this.EncounterTransitionStartedAtMs,
        PromptDurationSec: this.DebugConfig.BattlePromptDurationSec,
        IntroDurationSec: this.DebugConfig.BattleIntroDurationSec,
        DropDurationSec: this.DebugConfig.BattleDropDurationSec,
        RemainingTransitionMs
      },
      Battle3CState: Battle3CHudState,
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

    let IsDirty = false;
    if (InputSnapshot.ToggleAimEdge) {
      this.ToggleBattleAim();
      return;
    }
    if (InputSnapshot.SwitchCharacterEdge) {
      this.SwitchControlledCharacter();
      return;
    }
    if (InputSnapshot.ToggleSkillTargetModeEdge) {
      this.ToggleBattleSkillTargetMode();
      return;
    }

    if (InputSnapshot.CycleTargetAxis !== 0) {
      this.CycleBattleTarget(InputSnapshot.CycleTargetAxis);
      return;
    }

    if (InputSnapshot.FireEdge) {
      this.FireBattleAction();
      return;
    }

    const NextCrosshair = this.ResolveCrosshairPosition(
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

    if (IsDirty) {
      this.NotifyRuntimeUpdated();
    }
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
        Event.Payload.EnemyId,
        Event.Payload.PlayerPosition,
        Event.Payload.EnemyPosition
      );
    });
  }

  private StartEncounterPrompt(
    EncounterEnemyId: string,
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
      EncounterEnemyId,
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
      this.StartEncounterTransition(EncounterEnemyId);
    }, PromptMs);

    this.NotifyRuntimeUpdated();
  }

  private StartEncounterTransition(EncounterEnemyId: string): void {
    if (
      this.RuntimePhase !== "Overworld" ||
      !this.ActiveEncounterContext ||
      this.ActiveEncounterContext.EncounterEnemyId !== EncounterEnemyId
    ) {
      return;
    }

    const StartedAtMs = Date.now();
    const IntroMs = Math.max(Math.round(this.DebugConfig.BattleIntroDurationSec * 1000), 1);
    const DropMs = Math.max(Math.round(this.DebugConfig.BattleDropDurationSec * 1000), 1);
    const TransitionTotalMs = Math.max(IntroMs, DropMs);

    this.ActiveBattleSession = this.CreateBattle3CSession(EncounterEnemyId);
    this.ActiveBattleSession.CameraMode = "IntroDropIn";
    this.RuntimePhase = "EncounterTransition";
    this.EncounterPromptText = null;
    this.EncounterTransitionStartedAtMs = StartedAtMs;
    this.EncounterTransitionEndAtMs = StartedAtMs + TransitionTotalMs;
    this.EmitRuntimeEvent("EEncounterTransitionStarted", EncounterEnemyId);

    this.EncounterFinishTimerHandle = window.setTimeout(() => {
      this.FinishEncounterTransition(EncounterEnemyId);
    }, TransitionTotalMs);

    this.NotifyRuntimeUpdated();
  }

  private FinishEncounterTransition(EncounterEnemyId: string): void {
    if (
      this.RuntimePhase !== "EncounterTransition" ||
      !this.ActiveBattleSession ||
      this.ActiveEncounterContext?.EncounterEnemyId !== EncounterEnemyId
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
    this.EmitRuntimeEvent("EEncounterTransitionFinished", EncounterEnemyId);
    this.NotifyRuntimeUpdated();
  }

  private CreateBattle3CSession(EncounterEnemyId: string): FBattle3CSession {
    const MainEnemyId = `${EncounterEnemyId}_MAIN`;
    const GuardEnemyId = `${EncounterEnemyId}_GUARD`;
    const SupportEnemyId = `${EncounterEnemyId}_SUPPORT`;
    return {
      SessionId: `B3C_${EncounterEnemyId}_${Date.now()}`,
      ControlledCharacterId: "P_YELLOW",
      CameraMode: "IntroPullOut",
      CrosshairScreenPosition: {
        X: 0.5,
        Y: 0.5
      },
      IsAimMode: false,
      IsSkillTargetMode: false,
      SelectedTargetIndex: 0,
      ScriptStepIndex: 0,
      Units: [
        {
          UnitId: "P_YELLOW",
          DisplayName: "Yellow",
          TeamId: "Player",
          PositionCm: {
            X: -220,
            Y: 0,
            Z: -90
          },
          YawDeg: 90,
          IsAlive: true,
          IsEncounterPrimaryEnemy: false
        },
        {
          UnitId: "P_RED",
          DisplayName: "Red",
          TeamId: "Player",
          PositionCm: {
            X: -220,
            Y: 0,
            Z: 90
          },
          YawDeg: 90,
          IsAlive: true,
          IsEncounterPrimaryEnemy: false
        },
        {
          UnitId: MainEnemyId,
          DisplayName: "Enemy Main",
          TeamId: "Enemy",
          PositionCm: {
            X: 250,
            Y: 0,
            Z: 0
          },
          YawDeg: 270,
          IsAlive: true,
          IsEncounterPrimaryEnemy: true
        },
        {
          UnitId: GuardEnemyId,
          DisplayName: "Enemy Guard",
          TeamId: "Enemy",
          PositionCm: {
            X: 300,
            Y: 0,
            Z: -150
          },
          YawDeg: 250,
          IsAlive: true,
          IsEncounterPrimaryEnemy: false
        },
        {
          UnitId: SupportEnemyId,
          DisplayName: "Enemy Support",
          TeamId: "Enemy",
          PositionCm: {
            X: 300,
            Y: 0,
            Z: 150
          },
          YawDeg: 290,
          IsAlive: true,
          IsEncounterPrimaryEnemy: false
        }
      ],
      ScriptFocus: null
    };
  }

  private AdvanceEnemyScriptStep(): void {
    if (!this.ActiveBattleSession || this.RuntimePhase !== "Battle3C") {
      return;
    }

    const EnemyUnits = this.GetEnemyBattleUnits(this.ActiveBattleSession.Units);
    const YellowPlayer = this.FindBattleUnit("P_YELLOW");
    const RedPlayer = this.FindBattleUnit("P_RED");
    const MainEnemy = EnemyUnits[0];
    const GuardEnemy = EnemyUnits[1] ?? MainEnemy;
    const SupportEnemy = EnemyUnits[2] ?? GuardEnemy;
    if (!YellowPlayer || !RedPlayer || !MainEnemy || !GuardEnemy || !SupportEnemy) {
      return;
    }

    const Steps: FBattleScriptStep[] = [
      {
        CameraMode: "EnemyAttackSingle",
        AttackerUnitId: MainEnemy.UnitId,
        TargetUnitIds: [YellowPlayer.UnitId]
      },
      {
        CameraMode: "EnemyAttackSingle",
        AttackerUnitId: GuardEnemy.UnitId,
        TargetUnitIds: [RedPlayer.UnitId]
      },
      {
        CameraMode: "EnemyAttackAOE",
        AttackerUnitId: SupportEnemy.UnitId,
        TargetUnitIds: [YellowPlayer.UnitId, RedPlayer.UnitId]
      }
    ];
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
    const NextX = this.Clamp(
      Current.X + AimDelta.X / CrosshairReferenceWidth,
      CrosshairMin,
      CrosshairMax
    );
    const NextY = this.Clamp(
      Current.Y + AimDelta.Y / CrosshairReferenceHeight,
      CrosshairMin,
      CrosshairMax
    );
    return {
      X: Number(NextX.toFixed(4)),
      Y: Number(NextY.toFixed(4))
    };
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
