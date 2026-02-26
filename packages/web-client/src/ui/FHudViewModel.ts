import type { FDebugConfig } from "../debug/UDebugConfigStore";
import type {
  EBattlePhase,
  EOverworldPhase,
  FOverworldEnemyState,
  FOverworldVector2,
  FUnitSnapshot
} from "@fd/gameplay-core";

export type FRuntimePhase = "Overworld" | "Battle";

export interface FOverworldHudState {
  Phase: EOverworldPhase;
  PlayerPosition: FOverworldVector2;
  PlayerYawDegrees: number;
  Enemies: FOverworldEnemyState[];
  PendingEncounterEnemyId: string | null;
  LastEncounterEnemyId: string | null;
}

export interface FBattleHudState {
  Phase: EBattlePhase;
  ActiveUnitId: string | null;
  SelectedTargetId: string | null;
  Units: FUnitSnapshot[];
  IsFinished: boolean;
}

export interface FDebugHudState {
  IsMenuOpen: boolean;
  Config: FDebugConfig;
  LastUpdatedAtIso: string | null;
}

export interface FHudViewModel {
  RuntimePhase: FRuntimePhase;
  OverworldState: FOverworldHudState;
  BattleState: FBattleHudState;
  DebugState: FDebugHudState;
  EventLogs: string[];
}
