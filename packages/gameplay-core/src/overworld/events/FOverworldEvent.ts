import { EOverworldEventType } from "./EOverworldEventType";

import type {
  FOverworldEnemyState,
  FOverworldPlayerState,
  FOverworldTuningSnapshot,
  FOverworldVector2
} from "../state/FOverworldState";

export interface FWorldInitializedPayload {
  WorldHalfSize: number;
  SafePoint: FOverworldVector2;
  Player: FOverworldPlayerState;
  Enemies: FOverworldEnemyState[];
  Tuning: FOverworldTuningSnapshot;
}

export interface FPlayerMovedPayload {
  Position: FOverworldVector2;
  YawDegrees: number;
  IsSprinting: boolean;
  WalkSpeed: number;
  RunSpeed: number;
}

export interface FEnemyMovedPayload {
  Enemies: FOverworldEnemyState[];
}

export interface FEncounterTriggeredPayload {
  EnemyId: string;
  PlayerPosition: FOverworldVector2;
  EnemyPosition: FOverworldVector2;
}

export interface FEncounterResolvedPayload {
  EnemyId: string;
}

export interface FPlayerResetToSafePointPayload {
  Position: FOverworldVector2;
}

export interface FOverworldEventPayloadMap {
  [EOverworldEventType.WorldInitialized]: FWorldInitializedPayload;
  [EOverworldEventType.PlayerMoved]: FPlayerMovedPayload;
  [EOverworldEventType.EnemyMoved]: FEnemyMovedPayload;
  [EOverworldEventType.EncounterTriggered]: FEncounterTriggeredPayload;
  [EOverworldEventType.EncounterResolved]: FEncounterResolvedPayload;
  [EOverworldEventType.PlayerResetToSafePoint]: FPlayerResetToSafePointPayload;
}

export interface FTypedOverworldEvent<TType extends EOverworldEventType> {
  EventId: number;
  Type: TType;
  Payload: FOverworldEventPayloadMap[TType];
}

export type FOverworldEvent = {
  [K in EOverworldEventType]: FTypedOverworldEvent<K>;
}[EOverworldEventType];
