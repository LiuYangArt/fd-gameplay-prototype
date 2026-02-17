import {
  EBattlePhase,
  EGameplayCommandType,
  EGameplayEventType,
  UBattleSimulation,
  type FUnitSnapshot
} from "@fd/gameplay-core";
import type { FHudViewModel } from "../ui/FHudViewModel";

type TRuntimeListener = (ViewModel: FHudViewModel) => void;

export class UWebBattleRuntime {
  private Simulation: UBattleSimulation;
  private readonly RuntimeListeners: Set<TRuntimeListener>;
  private SelectedTargetIndex: number;
  private EventLogs: string[];

  public constructor() {
    this.RuntimeListeners = new Set();
    this.SelectedTargetIndex = 0;
    this.EventLogs = [];
    this.Simulation = this.CreateSimulation();
  }

  public StartBattle(): void {
    this.EventLogs = [];
    this.SelectedTargetIndex = 0;
    if (this.Simulation.GetState().Phase !== EBattlePhase.Idle) {
      this.Simulation = this.CreateSimulation();
    }

    this.Simulation.SubmitCommand({
      Type: EGameplayCommandType.StartBattle,
      BattleId: "BATTLE_WEB_001",
      Units: this.CreateSeedUnits()
    });

    this.NotifyRuntimeUpdated();
  }

  public UseBasicSkill(): void {
    const State = this.Simulation.GetState();
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

    this.Simulation.SubmitCommand({
      Type: EGameplayCommandType.UseSkill,
      SourceUnitId: Source.UnitId,
      TargetUnitId: TargetId,
      Skill: {
        SkillId: "SKL_WEB_STRIKE",
        BaseDamage: 24
      }
    });
  }

  public SelectNextTarget(): void {
    const AvailableTargets = this.GetAvailableEnemyTargets();
    if (AvailableTargets.length === 0) {
      return;
    }

    this.SelectedTargetIndex = (this.SelectedTargetIndex + 1) % AvailableTargets.length;
    this.NotifyRuntimeUpdated();
  }

  public OnRuntimeUpdated(Listener: TRuntimeListener): () => void {
    this.RuntimeListeners.add(Listener);
    Listener(this.GetViewModel());

    return () => {
      this.RuntimeListeners.delete(Listener);
    };
  }

  public GetViewModel(): FHudViewModel {
    const State = this.Simulation.GetState();
    const Units = Object.values(State.Units);
    const EnemyTargets = this.GetAvailableEnemyTargets();
    const SelectedTargetId =
      EnemyTargets.length > 0
        ? EnemyTargets[this.SelectedTargetIndex % EnemyTargets.length]?.UnitId ?? null
        : null;

    return {
      Phase: State.Phase,
      ActiveUnitId: State.ActiveUnitId,
      SelectedTargetId,
      Units,
      EventLogs: this.EventLogs
    };
  }

  private NotifyRuntimeUpdated(): void {
    const ViewModel = this.GetViewModel();
    this.RuntimeListeners.forEach((Listener) => Listener(ViewModel));
  }

  private GetAvailableEnemyTargets(): FUnitSnapshot[] {
    const State = this.Simulation.GetState();
    return Object.values(State.Units).filter((Unit) => Unit.TeamId === "Enemy" && Unit.IsAlive);
  }

  private CreateSeedUnits(): FUnitSnapshot[] {
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
        UnitId: "E_SCOUT_01",
        DisplayName: "Scout",
        TeamId: "Enemy",
        MaxHp: 70,
        CurrentHp: 70,
        Speed: 9,
        IsAlive: true
      },
      {
        UnitId: "E_GUARD_01",
        DisplayName: "Guard",
        TeamId: "Enemy",
        MaxHp: 85,
        CurrentHp: 85,
        Speed: 7,
        IsAlive: true
      }
    ];
  }

  public IsBattleFinished(): boolean {
    return this.Simulation.GetState().Phase === EBattlePhase.Finished;
  }

  private CreateSimulation(): UBattleSimulation {
    const Simulation = new UBattleSimulation();
    Object.values(EGameplayEventType).forEach((EventType) => {
      Simulation.On(EventType, (Event) => {
        this.EventLogs = [...this.EventLogs, `${Event.EventId} | ${Event.Type}`].slice(-12);
        this.NotifyRuntimeUpdated();
      });
    });
    return Simulation;
  }
}
