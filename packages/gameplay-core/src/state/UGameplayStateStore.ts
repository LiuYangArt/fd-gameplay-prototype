import { EBattlePhase } from "../enums/EBattlePhase";
import { EGameplayEventType } from "../events/EGameplayEventType";

import type { FGameplayState } from "./FGameplayState";
import type { FGameplayEvent } from "../events/FGameplayEvent";

export class UGameplayStateStore {
  private State: FGameplayState;

  public constructor(InitialState: FGameplayState) {
    this.State = InitialState;
  }

  public GetState(): FGameplayState {
    return this.State;
  }

  public GetUnit(UnitId: string) {
    return this.State.Units[UnitId];
  }

  public ApplyEvent(Event: FGameplayEvent): void {
    this.State = {
      ...this.State,
      LastEventId: Event.EventId
    };

    switch (Event.Type) {
      case EGameplayEventType.BattleStarted: {
        const Units = Object.fromEntries(
          Event.Payload.Units.map((Unit) => [Unit.UnitId, { ...Unit }])
        );
        const TurnOrder = [...Event.Payload.Units]
          .sort((Left, Right) => Right.Speed - Left.Speed)
          .map((Unit) => Unit.UnitId);

        this.State = {
          ...this.State,
          BattleId: Event.Payload.BattleId,
          Phase: EBattlePhase.Active,
          Units,
          TurnOrder,
          ActiveUnitId: null
        };
        break;
      }
      case EGameplayEventType.TurnBegan:
        this.State = {
          ...this.State,
          ActiveUnitId: Event.Payload.ActiveUnitId
        };
        break;
      case EGameplayEventType.DamageApplied: {
        const Target = this.State.Units[Event.Payload.TargetUnitId];
        if (!Target) {
          break;
        }

        const NextHp = Event.Payload.RemainingHp;
        this.State = {
          ...this.State,
          Units: {
            ...this.State.Units,
            [Target.UnitId]: {
              ...Target,
              CurrentHp: NextHp,
              IsAlive: NextHp > 0
            }
          }
        };
        break;
      }
      case EGameplayEventType.UnitDefeated: {
        const Target = this.State.Units[Event.Payload.UnitId];
        if (!Target) {
          break;
        }

        this.State = {
          ...this.State,
          Units: {
            ...this.State.Units,
            [Target.UnitId]: {
              ...Target,
              CurrentHp: 0,
              IsAlive: false
            }
          }
        };
        break;
      }
      case EGameplayEventType.TurnEnded:
        this.State = {
          ...this.State,
          ActiveUnitId: null
        };
        break;
      case EGameplayEventType.BattleFinished:
        this.State = {
          ...this.State,
          Phase: EBattlePhase.Finished,
          ActiveUnitId: null
        };
        break;
      default:
        break;
    }
  }
}
