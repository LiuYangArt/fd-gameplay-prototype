import { EMeleeCommandType } from "./EMeleeCommandType";

import type { FUnitSnapshot } from "../../types/FUnitSnapshot";

export interface FResolveStrikeCommand {
  Type: EMeleeCommandType.ResolveStrike;
  SourceUnit: FUnitSnapshot;
  TargetUnit: FUnitSnapshot;
  DistanceCm: number;
  RangeCm: number;
  BaseDamage: number;
}

export type FMeleeCommand = FResolveStrikeCommand;
