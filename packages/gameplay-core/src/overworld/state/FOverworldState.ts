import { EOverworldPhase } from "../enums/EOverworldPhase";

export interface FOverworldVector2 {
  X: number;
  Z: number;
}

export interface FOverworldPlayerState {
  Position: FOverworldVector2;
  YawDegrees: number;
}

export interface FOverworldEnemyState {
  EnemyId: string;
  Position: FOverworldVector2;
  WanderYawDegrees: number;
  Radius: number;
}

export interface FOverworldTuningSnapshot {
  WalkSpeed: number;
  RunSpeed: number;
  EnemyWanderSpeed: number;
  EnemyWanderTurnSpeed: number;
  WorldHalfSize: number;
  EncounterDistance: number;
  PlayerRadius: number;
  EnemyRadius: number;
}

export interface FOverworldWorldConfig {
  EnemyCount: number;
  WorldHalfSize: number;
  SafePoint: FOverworldVector2;
  Tuning: Partial<FOverworldTuningSnapshot>;
}

export interface FOverworldState {
  Phase: EOverworldPhase;
  Player: FOverworldPlayerState;
  Enemies: Record<string, FOverworldEnemyState>;
  SafePoint: FOverworldVector2;
  Tuning: FOverworldTuningSnapshot;
  PendingEncounterEnemyId: string | null;
  LastEventId: number;
}

export function CreateDefaultOverworldTuning(): FOverworldTuningSnapshot {
  return {
    WalkSpeed: 420,
    RunSpeed: 750,
    EnemyWanderSpeed: 160,
    EnemyWanderTurnSpeed: 65,
    WorldHalfSize: 3000,
    EncounterDistance: 120,
    PlayerRadius: 45,
    EnemyRadius: 75
  };
}

export function CreateDefaultOverworldWorldConfig(): FOverworldWorldConfig {
  return {
    EnemyCount: 4,
    WorldHalfSize: 3000,
    SafePoint: { X: 0, Z: 0 },
    Tuning: {}
  };
}

export function CreateEmptyOverworldState(): FOverworldState {
  return {
    Phase: EOverworldPhase.Idle,
    Player: {
      Position: { X: 0, Z: 0 },
      YawDegrees: 0
    },
    Enemies: {},
    SafePoint: { X: 0, Z: 0 },
    Tuning: CreateDefaultOverworldTuning(),
    PendingEncounterEnemyId: null,
    LastEventId: 0
  };
}
