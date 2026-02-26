import { EOverworldPhase } from "../enums/EOverworldPhase";
import { EOverworldEventType } from "../events/EOverworldEventType";

import type { FOverworldState } from "./FOverworldState";
import type { FOverworldEvent } from "../events/FOverworldEvent";

export class UOverworldStateStore {
  private State: FOverworldState;

  public constructor(InitialState: FOverworldState) {
    this.State = InitialState;
  }

  public GetState(): FOverworldState {
    return this.State;
  }

  public ApplyEvent(Event: FOverworldEvent): void {
    this.State = {
      ...this.State,
      LastEventId: Event.EventId
    };

    switch (Event.Type) {
      case EOverworldEventType.WorldInitialized: {
        const Enemies = Object.fromEntries(
          Event.Payload.Enemies.map((Enemy) => [Enemy.EnemyId, { ...Enemy }])
        );
        this.State = {
          ...this.State,
          Phase: EOverworldPhase.Exploring,
          Player: {
            ...Event.Payload.Player,
            Position: { ...Event.Payload.Player.Position }
          },
          SafePoint: { ...Event.Payload.SafePoint },
          Enemies,
          PendingEncounterEnemyId: null,
          Tuning: { ...Event.Payload.Tuning, WorldHalfSize: Event.Payload.WorldHalfSize }
        };
        break;
      }
      case EOverworldEventType.PlayerMoved:
        this.State = {
          ...this.State,
          Player: {
            Position: { ...Event.Payload.Position },
            YawDegrees: Event.Payload.YawDegrees
          },
          Tuning: {
            ...this.State.Tuning,
            WalkSpeed: Event.Payload.WalkSpeed,
            RunSpeed: Event.Payload.RunSpeed
          }
        };
        break;
      case EOverworldEventType.EnemyMoved: {
        const NextEnemies = {
          ...this.State.Enemies
        };
        Event.Payload.Enemies.forEach((Enemy) => {
          NextEnemies[Enemy.EnemyId] = { ...Enemy, Position: { ...Enemy.Position } };
        });
        this.State = {
          ...this.State,
          Enemies: NextEnemies
        };
        break;
      }
      case EOverworldEventType.EncounterTriggered:
        this.State = {
          ...this.State,
          Phase: EOverworldPhase.EncounterPending,
          PendingEncounterEnemyId: Event.Payload.EnemyId
        };
        break;
      case EOverworldEventType.EncounterResolved: {
        const NextEnemies = {
          ...this.State.Enemies
        };
        delete NextEnemies[Event.Payload.EnemyId];
        this.State = {
          ...this.State,
          Phase: EOverworldPhase.Exploring,
          PendingEncounterEnemyId: null,
          Enemies: NextEnemies
        };
        break;
      }
      case EOverworldEventType.PlayerResetToSafePoint:
        this.State = {
          ...this.State,
          Player: {
            ...this.State.Player,
            Position: { ...Event.Payload.Position }
          }
        };
        break;
      default:
        break;
    }
  }
}
