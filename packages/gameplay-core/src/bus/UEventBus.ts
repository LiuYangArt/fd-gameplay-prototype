import { EGameplayEventType } from "../events/EGameplayEventType";

import type { FGameplayEvent, FTypedGameplayEvent } from "../events/FGameplayEvent";

type FEventListener<TType extends EGameplayEventType> = (Event: FTypedGameplayEvent<TType>) => void;

export class UEventBus {
  private readonly Listeners: {
    [K in EGameplayEventType]: Set<FEventListener<K>>;
  } = {
    [EGameplayEventType.BattleStarted]: new Set(),
    [EGameplayEventType.TurnBegan]: new Set(),
    [EGameplayEventType.SkillResolved]: new Set(),
    [EGameplayEventType.DamageApplied]: new Set(),
    [EGameplayEventType.UnitDefeated]: new Set(),
    [EGameplayEventType.TurnEnded]: new Set(),
    [EGameplayEventType.BattleFinished]: new Set()
  };

  public On<TType extends EGameplayEventType>(
    Type: TType,
    Listener: FEventListener<TType>
  ): () => void {
    const TypedSet = this.Listeners[Type] as Set<FEventListener<TType>>;
    TypedSet.add(Listener);
    return () => TypedSet.delete(Listener);
  }

  public Emit(Event: FGameplayEvent): void {
    const TypedSet = this.Listeners[Event.Type] as Set<FEventListener<typeof Event.Type>>;
    TypedSet.forEach((Listener) => Listener(Event));
  }
}
