import {
  EBattlePhase,
  EGameplayCommandType,
  EGameplayEventType,
  EOverworldCommandType,
  EOverworldEventType,
  UBattleSimulation,
  UOverworldSimulation,
  type FOverworldEnemyState,
  type FUnitSnapshot
} from "@fd/gameplay-core";

import { UDebugConfigStore, type FDebugConfig } from "../debug/UDebugConfigStore";

import type { FInputSnapshot } from "../input/FInputSnapshot";
import type { FHudViewModel, FRuntimePhase } from "../ui/FHudViewModel";

type TRuntimeListener = (ViewModel: FHudViewModel) => void;

interface FImportDebugConfigResult {
  IsSuccess: boolean;
  ErrorMessage: string | null;
}

export class UWebGameRuntime {
  private readonly RuntimeListeners: Set<TRuntimeListener>;
  private readonly OverworldSimulation: UOverworldSimulation;
  private readonly DebugConfigStore: UDebugConfigStore;
  private BattleSimulation: UBattleSimulation;
  private RuntimePhase: FRuntimePhase;
  private EventLogs: string[];
  private SelectedTargetIndex: number;
  private ActiveEncounterEnemyId: string | null;
  private LastEncounterEnemyId: string | null;
  private IsDebugMenuOpen: boolean;
  private DebugConfig: FDebugConfig;
  private LastDebugUpdatedAtIso: string | null;
  private CameraPitchDegrees: number;

  public constructor() {
    this.RuntimeListeners = new Set();
    this.OverworldSimulation = new UOverworldSimulation();
    this.DebugConfigStore = new UDebugConfigStore();
    const LoadedDebugConfig = this.DebugConfigStore.Load();
    this.DebugConfig = LoadedDebugConfig.Config;
    this.LastDebugUpdatedAtIso = LoadedDebugConfig.LastUpdatedAtIso;
    this.CameraPitchDegrees = 0;
    this.SyncCameraPitchFromConfig();
    this.BattleSimulation = this.CreateBattleSimulation();
    this.RuntimePhase = "Overworld";
    this.EventLogs = [];
    this.SelectedTargetIndex = 0;
    this.ActiveEncounterEnemyId = null;
    this.LastEncounterEnemyId = null;
    this.IsDebugMenuOpen = false;

    this.BindOverworldEvents();
  }

  public StartGame(): void {
    this.RuntimePhase = "Overworld";
    this.ActiveEncounterEnemyId = null;
    this.LastEncounterEnemyId = null;
    this.SelectedTargetIndex = 0;
    this.EventLogs = [];
    this.SyncCameraPitchFromConfig();
    this.BattleSimulation = this.CreateBattleSimulation();

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

    if (this.RuntimePhase === "Battle") {
      this.ConsumeBattleInput(InputSnapshot);
      return;
    }

    this.ConsumeOverworldInput(InputSnapshot);
  }

  public UseBattleBasicSkill(): void {
    if (this.RuntimePhase !== "Battle") {
      return;
    }

    const State = this.BattleSimulation.GetState();
    if (!State.ActiveUnitId) {
      return;
    }

    const Source = State.Units[State.ActiveUnitId];
    if (!Source || Source.TeamId !== "Player" || !Source.IsAlive) {
      return;
    }

    const AvailableTargets = this.GetAvailableEnemyTargets();
    if (AvailableTargets.length === 0) {
      return;
    }

    const TargetId = AvailableTargets[this.SelectedTargetIndex % AvailableTargets.length]?.UnitId;
    if (!TargetId) {
      return;
    }

    this.BattleSimulation.SubmitCommand({
      Type: EGameplayCommandType.UseSkill,
      SourceUnitId: Source.UnitId,
      TargetUnitId: TargetId,
      Skill: {
        SkillId: "SKL_WEB_STRIKE",
        BaseDamage: 24
      }
    });
  }

  public SelectNextBattleTarget(): void {
    if (this.RuntimePhase !== "Battle") {
      return;
    }

    const AvailableTargets = this.GetAvailableEnemyTargets();
    if (AvailableTargets.length === 0) {
      return;
    }

    this.SelectedTargetIndex = (this.SelectedTargetIndex + 1) % AvailableTargets.length;
    this.NotifyRuntimeUpdated();
  }

  public RestartBattle(): void {
    if (this.RuntimePhase === "Battle" && this.ActiveEncounterEnemyId) {
      this.StartBattleForEncounter(this.ActiveEncounterEnemyId);
      return;
    }

    this.StartGame();
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
    const BattleState = this.BattleSimulation.GetState();
    const BattleTargets = Object.values(BattleState.Units).filter(
      (Unit) => Unit.TeamId === "Enemy" && Unit.IsAlive
    );
    const SelectedTargetId =
      BattleTargets.length > 0
        ? (BattleTargets[this.SelectedTargetIndex % BattleTargets.length]?.UnitId ?? null)
        : null;

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
      BattleState: {
        Phase: BattleState.Phase,
        ActiveUnitId: BattleState.ActiveUnitId,
        SelectedTargetId,
        Units: Object.values(BattleState.Units),
        IsFinished: BattleState.Phase === EBattlePhase.Finished
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

    if (InputSnapshot.RestartEdge) {
      this.StartGame();
      return;
    }

    this.NotifyRuntimeUpdated();
  }

  private ConsumeBattleInput(InputSnapshot: FInputSnapshot): void {
    if (InputSnapshot.ConfirmEdge) {
      this.UseBattleBasicSkill();
    }
    if (InputSnapshot.NextTargetEdge) {
      this.SelectNextBattleTarget();
    }
    if (InputSnapshot.RestartEdge) {
      this.RestartBattle();
    }
  }

  private StartBattleForEncounter(EnemyId: string): void {
    this.ActiveEncounterEnemyId = EnemyId;
    this.RuntimePhase = "Battle";
    this.SelectedTargetIndex = 0;
    this.BattleSimulation = this.CreateBattleSimulation();
    this.BattleSimulation.SubmitCommand({
      Type: EGameplayCommandType.StartBattle,
      BattleId: `BATTLE_${EnemyId}_${Date.now()}`,
      Units: this.CreateEncounterUnits(EnemyId)
    });
    this.NotifyRuntimeUpdated();
  }

  private HandleBattleFinished(): void {
    if (this.RuntimePhase !== "Battle") {
      return;
    }

    if (this.ActiveEncounterEnemyId) {
      this.OverworldSimulation.SubmitCommand({
        Type: EOverworldCommandType.ResolveEncounter
      });
      this.OverworldSimulation.SubmitCommand({
        Type: EOverworldCommandType.ResetPlayerToSafePoint
      });
      this.LastEncounterEnemyId = this.ActiveEncounterEnemyId;
      this.ActiveEncounterEnemyId = null;
    }

    this.RuntimePhase = "Overworld";
    this.NotifyRuntimeUpdated();
  }

  private BindOverworldEvents(): void {
    Object.values(EOverworldEventType).forEach((EventType) => {
      this.OverworldSimulation.On(EventType, (Event) => {
        this.AppendLog(`OW ${Event.EventId} | ${Event.Type}`);
        this.NotifyRuntimeUpdated();
      });
    });

    this.OverworldSimulation.On(EOverworldEventType.EncounterTriggered, (Event) => {
      this.StartBattleForEncounter(Event.Payload.EnemyId);
    });
  }

  private CreateBattleSimulation(): UBattleSimulation {
    const Simulation = new UBattleSimulation();
    Object.values(EGameplayEventType).forEach((EventType) => {
      Simulation.On(EventType, (Event) => {
        this.AppendLog(`BT ${Event.EventId} | ${Event.Type}`);
        if (Event.Type === EGameplayEventType.BattleFinished) {
          this.HandleBattleFinished();
          return;
        }
        this.NotifyRuntimeUpdated();
      });
    });
    return Simulation;
  }

  private CreateEncounterUnits(EnemyId: string): FUnitSnapshot[] {
    return [
      {
        UnitId: "P_HERO_01",
        DisplayName: "Hero",
        TeamId: "Player",
        MaxHp: 120,
        CurrentHp: 120,
        Speed: 12,
        IsAlive: true
      },
      {
        UnitId: `${EnemyId}_MAIN`,
        DisplayName: `Wanderer ${EnemyId}`,
        TeamId: "Enemy",
        MaxHp: 74,
        CurrentHp: 74,
        Speed: 9,
        IsAlive: true
      },
      {
        UnitId: `${EnemyId}_GUARD`,
        DisplayName: "Guard",
        TeamId: "Enemy",
        MaxHp: 88,
        CurrentHp: 88,
        Speed: 7,
        IsAlive: true
      }
    ];
  }

  private NotifyRuntimeUpdated(): void {
    const ViewModel = this.GetViewModel();
    this.RuntimeListeners.forEach((Listener) => Listener(ViewModel));
  }

  private AppendLog(LogLine: string): void {
    this.EventLogs = [...this.EventLogs, LogLine].slice(-24);
  }

  private GetAvailableEnemyTargets(): FUnitSnapshot[] {
    const State = this.BattleSimulation.GetState();
    return Object.values(State.Units).filter((Unit) => Unit.TeamId === "Enemy" && Unit.IsAlive);
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

  public GetOverworldEnemies(): FOverworldEnemyState[] {
    return Object.values(this.OverworldSimulation.GetState().Enemies);
  }
}
