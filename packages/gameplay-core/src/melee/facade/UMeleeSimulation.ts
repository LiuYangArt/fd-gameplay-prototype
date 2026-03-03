import { EMeleeCommandType } from "../commands/EMeleeCommandType";
import { EMeleeEventType } from "../events/EMeleeEventType";

import type { FMeleeCommand, FResolveStrikeCommand } from "../commands/FMeleeCommand";
import type {
  FMeleeEvent,
  FMeleeEventPayloadMap,
  FMeleeMissReason,
  FTypedMeleeEvent
} from "../events/FMeleeEvent";

type FMeleeEventListener<TType extends EMeleeEventType> = (Event: FTypedMeleeEvent<TType>) => void;

export class UMeleeSimulation {
  private readonly EventHistory: FMeleeEvent[];
  private readonly Listeners: {
    [K in EMeleeEventType]: Set<FMeleeEventListener<K>>;
  };
  private NextEventId: number;

  public constructor() {
    this.EventHistory = [];
    this.Listeners = {
      [EMeleeEventType.MeleeResolved]: new Set(),
      [EMeleeEventType.DamageApplied]: new Set()
    };
    this.NextEventId = 1;
  }

  public SubmitCommand(Command: FMeleeCommand): boolean {
    switch (Command.Type) {
      case EMeleeCommandType.ResolveStrike:
        return this.HandleResolveStrike(Command);
      default:
        return false;
    }
  }

  public GetEventHistory(): readonly FMeleeEvent[] {
    return this.EventHistory;
  }

  public On<TType extends EMeleeEventType>(
    Type: TType,
    Listener: FMeleeEventListener<TType>
  ): () => void {
    const ListenerSet = this.Listeners[Type] as Set<FMeleeEventListener<TType>>;
    ListenerSet.add(Listener);
    return () => ListenerSet.delete(Listener);
  }

  private HandleResolveStrike(Command: FResolveStrikeCommand): boolean {
    if (
      !Number.isFinite(Command.DistanceCm) ||
      !Number.isFinite(Command.RangeCm) ||
      !Number.isFinite(Command.BaseDamage)
    ) {
      return false;
    }

    let IsHit = true;
    let MissReason: FMeleeMissReason = "None";
    if (!Command.SourceUnit.IsAlive) {
      IsHit = false;
      MissReason = "InvalidSource";
    } else if (!Command.TargetUnit.IsAlive) {
      IsHit = false;
      MissReason = "InvalidTarget";
    } else if (Command.SourceUnit.TeamId === Command.TargetUnit.TeamId) {
      IsHit = false;
      MissReason = "InvalidTeam";
    } else if (Command.DistanceCm > Command.RangeCm) {
      IsHit = false;
      MissReason = "OutOfRange";
    }

    this.EmitEvent(EMeleeEventType.MeleeResolved, {
      SourceUnitId: Command.SourceUnit.UnitId,
      TargetUnitId: Command.TargetUnit.UnitId,
      IsHit,
      MissReason,
      DistanceCm: Command.DistanceCm,
      RangeCm: Command.RangeCm,
      DamageAttempted: this.ClampDamage(Command.BaseDamage)
    });

    if (!IsHit) {
      return true;
    }

    const MaxDamageCanApply = Math.max(Command.TargetUnit.CurrentHp, 0);
    const AppliedDamage = this.Clamp(this.ClampDamage(Command.BaseDamage), 0, MaxDamageCanApply);
    const RemainingHp = this.Clamp(
      Command.TargetUnit.CurrentHp - AppliedDamage,
      0,
      Command.TargetUnit.MaxHp
    );

    this.EmitEvent(EMeleeEventType.DamageApplied, {
      SourceUnitId: Command.SourceUnit.UnitId,
      TargetUnitId: Command.TargetUnit.UnitId,
      AppliedDamage,
      RemainingHp
    });
    return true;
  }

  private ClampDamage(Damage: number): number {
    return Math.max(0, Math.floor(Damage));
  }

  private Clamp(Value: number, Min: number, Max: number): number {
    return Math.min(Math.max(Value, Min), Max);
  }

  private EmitEvent<TType extends EMeleeEventType>(
    Type: TType,
    Payload: FMeleeEventPayloadMap[TType]
  ): void {
    const TypedEvent = {
      EventId: this.NextEventId,
      Type,
      Payload
    } as FTypedMeleeEvent<TType>;
    this.NextEventId += 1;
    this.EventHistory.push(TypedEvent as FMeleeEvent);
    const ListenerSet = this.Listeners[Type] as Set<FMeleeEventListener<TType>>;
    ListenerSet.forEach((Listener) => Listener(TypedEvent));
  }
}
