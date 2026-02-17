import { EGameplayEventType } from "./EGameplayEventType";
import type { FUnitSnapshot, TTeamId } from "../types/FUnitSnapshot";

export interface FBattleStartedPayload {
  BattleId: string;
  Units: FUnitSnapshot[];
}

export interface FTurnBeganPayload {
  ActiveUnitId: string;
}

export interface FSkillResolvedPayload {
  SourceUnitId: string;
  TargetUnitId: string;
  SkillId: string;
  Damage: number;
}

export interface FDamageAppliedPayload {
  SourceUnitId: string;
  TargetUnitId: string;
  AppliedDamage: number;
  RemainingHp: number;
}

export interface FUnitDefeatedPayload {
  UnitId: string;
}

export interface FTurnEndedPayload {
  ActiveUnitId: string;
}

export interface FBattleFinishedPayload {
  WinnerTeamId: TTeamId | null;
}

export interface FGameplayEventPayloadMap {
  [EGameplayEventType.BattleStarted]: FBattleStartedPayload;
  [EGameplayEventType.TurnBegan]: FTurnBeganPayload;
  [EGameplayEventType.SkillResolved]: FSkillResolvedPayload;
  [EGameplayEventType.DamageApplied]: FDamageAppliedPayload;
  [EGameplayEventType.UnitDefeated]: FUnitDefeatedPayload;
  [EGameplayEventType.TurnEnded]: FTurnEndedPayload;
  [EGameplayEventType.BattleFinished]: FBattleFinishedPayload;
}

export interface FTypedGameplayEvent<TType extends EGameplayEventType> {
  EventId: number;
  Type: TType;
  Payload: FGameplayEventPayloadMap[TType];
}

export type FGameplayEvent = {
  [K in EGameplayEventType]: FTypedGameplayEvent<K>;
}[EGameplayEventType];
