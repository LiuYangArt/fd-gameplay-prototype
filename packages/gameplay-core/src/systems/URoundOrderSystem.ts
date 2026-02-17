import type { FGameplayState } from "../state/FGameplayState";

export class URoundOrderSystem {
  public PickFirstActiveUnitId(State: FGameplayState): string | null {
    return this.PickNextActiveUnitId(State, null);
  }

  public PickNextActiveUnitId(
    State: FGameplayState,
    CurrentActiveUnitId: string | null
  ): string | null {
    if (State.TurnOrder.length === 0) {
      return null;
    }

    const AliveOrder = State.TurnOrder.filter((UnitId) => State.Units[UnitId]?.IsAlive);
    if (AliveOrder.length === 0) {
      return null;
    }

    if (!CurrentActiveUnitId) {
      return AliveOrder[0] ?? null;
    }

    const CurrentIndex = AliveOrder.indexOf(CurrentActiveUnitId);
    if (CurrentIndex === -1) {
      return AliveOrder[0] ?? null;
    }

    const NextIndex = (CurrentIndex + 1) % AliveOrder.length;
    return AliveOrder[NextIndex] ?? null;
  }
}
