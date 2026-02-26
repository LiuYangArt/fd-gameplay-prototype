import { EOverworldCommandType } from "./EOverworldCommandType";

import type { FOverworldWorldConfig } from "../state/FOverworldState";

export interface FOverworldInputVector {
  X: number;
  Y: number;
}

export interface FInitializeWorldCommand {
  Type: EOverworldCommandType.InitializeWorld;
  Config?: Partial<FOverworldWorldConfig>;
}

export interface FStepCommand {
  Type: EOverworldCommandType.Step;
  MoveAxis: FOverworldInputVector;
  LookYawDeltaDegrees: number;
  DeltaSeconds: number;
  IsSprinting: boolean;
  WalkSpeed?: number;
  RunSpeed?: number;
}

export interface FResolveEncounterCommand {
  Type: EOverworldCommandType.ResolveEncounter;
}

export interface FResetPlayerToSafePointCommand {
  Type: EOverworldCommandType.ResetPlayerToSafePoint;
}

export type FOverworldCommand =
  | FInitializeWorldCommand
  | FStepCommand
  | FResolveEncounterCommand
  | FResetPlayerToSafePointCommand;
