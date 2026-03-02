import { EMeleeEventType } from "./EMeleeEventType";

export type FMeleeMissReason =
  | "None"
  | "OutOfRange"
  | "InvalidSource"
  | "InvalidTarget"
  | "InvalidTeam";

export interface FMeleeResolvedPayload {
  SourceUnitId: string;
  TargetUnitId: string;
  IsHit: boolean;
  MissReason: FMeleeMissReason;
  DistanceCm: number;
  RangeCm: number;
  DamageAttempted: number;
}

export interface FMeleeDamageAppliedPayload {
  SourceUnitId: string;
  TargetUnitId: string;
  AppliedDamage: number;
  RemainingHp: number;
}

export interface FMeleeEventPayloadMap {
  [EMeleeEventType.MeleeResolved]: FMeleeResolvedPayload;
  [EMeleeEventType.DamageApplied]: FMeleeDamageAppliedPayload;
}

export interface FTypedMeleeEvent<TType extends EMeleeEventType> {
  EventId: number;
  Type: TType;
  Payload: FMeleeEventPayloadMap[TType];
}

export type FMeleeEvent = {
  [K in EMeleeEventType]: FTypedMeleeEvent<K>;
}[EMeleeEventType];
