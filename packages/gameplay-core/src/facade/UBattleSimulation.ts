import { UEventBus } from "../bus/UEventBus";
import { EGameplayCommandType } from "../commands/EGameplayCommandType";
import type { FGameplayCommand } from "../commands/FGameplayCommand";
import { EGameplayEventType } from "../events/EGameplayEventType";
import type {
  FGameplayEvent,
  FGameplayEventPayloadMap,
  FTypedGameplayEvent
} from "../events/FGameplayEvent";
import { EBattlePhase } from "../enums/EBattlePhase";
import { CreateEmptyGameplayState } from "../state/FGameplayState";
import { UGameplayStateStore } from "../state/UGameplayStateStore";
import { UDamageResolveSystem } from "../systems/UDamageResolveSystem";
import { URoundOrderSystem } from "../systems/URoundOrderSystem";
import type { TTeamId } from "../types/FUnitSnapshot";

export class UBattleSimulation {
  private readonly EventBus: UEventBus;
  private readonly StateStore: UGameplayStateStore;
  private readonly RoundOrderSystem: URoundOrderSystem;
  private readonly DamageResolveSystem: UDamageResolveSystem;
  private readonly EventHistory: FGameplayEvent[];
  private NextEventId: number;

  public constructor() {
    this.EventBus = new UEventBus();
    this.StateStore = new UGameplayStateStore(CreateEmptyGameplayState());
    this.RoundOrderSystem = new URoundOrderSystem();
    this.DamageResolveSystem = new UDamageResolveSystem();
    this.EventHistory = [];
    this.NextEventId = 1;

    this.BindInternalHandlers();
  }

  public GetState() {
    return this.StateStore.GetState();
  }

  public GetEventHistory(): readonly FGameplayEvent[] {
    return this.EventHistory;
  }

  public On<TType extends EGameplayEventType>(
    Type: TType,
    Listener: (Event: FTypedGameplayEvent<TType>) => void
  ): () => void {
    return this.EventBus.On(Type, Listener);
  }

  public SubmitCommand(Command: FGameplayCommand): boolean {
    switch (Command.Type) {
      case EGameplayCommandType.StartBattle:
        return this.HandleStartBattle(Command);
      case EGameplayCommandType.UseSkill:
        return this.HandleUseSkill(Command);
      case EGameplayCommandType.EndTurn:
        return this.HandleEndTurn(Command);
      default:
        return false;
    }
  }

  private BindInternalHandlers(): void {
    this.EventBus.On(EGameplayEventType.BattleStarted, () => {
      const NextUnitId = this.RoundOrderSystem.PickFirstActiveUnitId(this.GetState());
      if (!NextUnitId) {
        this.EmitEvent(EGameplayEventType.BattleFinished, { WinnerTeamId: null });
        return;
      }

      this.EmitEvent(EGameplayEventType.TurnBegan, { ActiveUnitId: NextUnitId });
    });

    this.EventBus.On(EGameplayEventType.SkillResolved, (Event) => {
      const Target = this.StateStore.GetUnit(Event.Payload.TargetUnitId);
      if (!Target || !Target.IsAlive) {
        return;
      }

      const ResolveResult = this.DamageResolveSystem.Resolve(Target, Event.Payload.Damage);
      this.EmitEvent(EGameplayEventType.DamageApplied, {
        SourceUnitId: Event.Payload.SourceUnitId,
        TargetUnitId: Event.Payload.TargetUnitId,
        AppliedDamage: ResolveResult.AppliedDamage,
        RemainingHp: ResolveResult.RemainingHp
      });

      if (ResolveResult.IsDefeated) {
        this.EmitEvent(EGameplayEventType.UnitDefeated, {
          UnitId: Target.UnitId
        });
      }

      this.EmitEvent(EGameplayEventType.TurnEnded, {
        ActiveUnitId: Event.Payload.SourceUnitId
      });
    });

    this.EventBus.On(EGameplayEventType.TurnEnded, (Event) => {
      const WinnerTeamId = this.ResolveWinnerTeamId();
      if (WinnerTeamId) {
        this.EmitEvent(EGameplayEventType.BattleFinished, { WinnerTeamId });
        return;
      }

      const NextUnitId = this.RoundOrderSystem.PickNextActiveUnitId(
        this.GetState(),
        Event.Payload.ActiveUnitId
      );

      if (NextUnitId) {
        this.EmitEvent(EGameplayEventType.TurnBegan, { ActiveUnitId: NextUnitId });
      }
    });
  }

  private HandleStartBattle(
    Command: Extract<FGameplayCommand, { Type: EGameplayCommandType.StartBattle }>
  ): boolean {
    if (this.GetState().Phase !== EBattlePhase.Idle) {
      return false;
    }

    this.EmitEvent(EGameplayEventType.BattleStarted, {
      BattleId: Command.BattleId,
      Units: Command.Units
    });
    return true;
  }

  private HandleUseSkill(
    Command: Extract<FGameplayCommand, { Type: EGameplayCommandType.UseSkill }>
  ): boolean {
    const State = this.GetState();
    if (State.ActiveUnitId !== Command.SourceUnitId) {
      return false;
    }

    const Source = this.StateStore.GetUnit(Command.SourceUnitId);
    const Target = this.StateStore.GetUnit(Command.TargetUnitId);
    if (!Source || !Source.IsAlive || !Target || !Target.IsAlive) {
      return false;
    }

    this.EmitEvent(EGameplayEventType.SkillResolved, {
      SourceUnitId: Command.SourceUnitId,
      TargetUnitId: Command.TargetUnitId,
      SkillId: Command.Skill.SkillId,
      Damage: Command.Skill.BaseDamage
    });
    return true;
  }

  private HandleEndTurn(
    Command: Extract<FGameplayCommand, { Type: EGameplayCommandType.EndTurn }>
  ): boolean {
    const State = this.GetState();
    if (State.ActiveUnitId !== Command.SourceUnitId) {
      return false;
    }

    this.EmitEvent(EGameplayEventType.TurnEnded, {
      ActiveUnitId: Command.SourceUnitId
    });
    return true;
  }

  private ResolveWinnerTeamId(): TTeamId | null {
    const AliveTeams = new Set(
      Object.values(this.GetState().Units)
        .filter((Unit) => Unit.IsAlive)
        .map((Unit) => Unit.TeamId)
    );

    if (AliveTeams.size !== 1) {
      return null;
    }

    return AliveTeams.values().next().value ?? null;
  }

  private EmitEvent<TType extends EGameplayEventType>(
    Type: TType,
    Payload: FGameplayEventPayloadMap[TType]
  ): void {
    const TypedEvent = {
      EventId: this.NextEventId,
      Type,
      Payload
    } as FTypedGameplayEvent<TType>;
    const Event = TypedEvent as FGameplayEvent;

    this.NextEventId += 1;
    this.StateStore.ApplyEvent(Event);
    this.EventHistory.push(Event);
    this.EventBus.Emit(Event);
  }
}
