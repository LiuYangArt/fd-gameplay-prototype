import { EOverworldEventType } from "./EOverworldEventType";

import type {
  FTeamPackageSnapshot,
  FUnitCombatRuntimeSnapshot,
  FUnitStaticConfig
} from "../../team/state/FTeamPackageSnapshot";
import type {
  FOverworldEnemyState,
  FOverworldPlayerState,
  FOverworldTuningSnapshot,
  FOverworldVector2
} from "../state/FOverworldState";

export interface FWorldInitializedPayload {
  WorldHalfSize: number;
  SafePoint: FOverworldVector2;
  ControlledTeamId: string;
  Player: FOverworldPlayerState;
  Enemies: FOverworldEnemyState[];
  Tuning: FOverworldTuningSnapshot;
  TeamPackages: FTeamPackageSnapshot[];
  UnitStaticConfigs: FUnitStaticConfig[];
  UnitRuntimeSnapshots: FUnitCombatRuntimeSnapshot[];
  EnemyTeamBindings: Record<string, string>;
}

export interface FPlayerMovedPayload {
  TeamId: string;
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
  EncounterId: string;
  PlayerTeamId: string;
  EnemyTeamId: string;
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

export interface FTeamValidationFailedPayload {
  TeamId: string;
  EncounterId: string | null;
  FailureReason: string;
  Violations: string[];
}

export interface FOverworldEventPayloadMap {
  [EOverworldEventType.WorldInitialized]: FWorldInitializedPayload;
  [EOverworldEventType.PlayerMoved]: FPlayerMovedPayload;
  [EOverworldEventType.EnemyMoved]: FEnemyMovedPayload;
  [EOverworldEventType.EncounterTriggered]: FEncounterTriggeredPayload;
  [EOverworldEventType.EncounterResolved]: FEncounterResolvedPayload;
  [EOverworldEventType.PlayerResetToSafePoint]: FPlayerResetToSafePointPayload;
  [EOverworldEventType.TeamValidationFailed]: FTeamValidationFailedPayload;
}

export interface FTypedOverworldEvent<TType extends EOverworldEventType> {
  EventId: number;
  Type: TType;
  Payload: FOverworldEventPayloadMap[TType];
}

export type FOverworldEvent = {
  [K in EOverworldEventType]: FTypedOverworldEvent<K>;
}[EOverworldEventType];
