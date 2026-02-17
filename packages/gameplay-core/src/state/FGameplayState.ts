import { EBattlePhase } from "../enums/EBattlePhase";

import type { FUnitSnapshot } from "../types/FUnitSnapshot";

export interface FGameplayState {
  BattleId: string;
  Phase: EBattlePhase;
  Units: Record<string, FUnitSnapshot>;
  TurnOrder: string[];
  ActiveUnitId: string | null;
  LastEventId: number;
}

export function CreateEmptyGameplayState(): FGameplayState {
  return {
    BattleId: "",
    Phase: EBattlePhase.Idle,
    Units: {},
    TurnOrder: [],
    ActiveUnitId: null,
    LastEventId: 0
  };
}
