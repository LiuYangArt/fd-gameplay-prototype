import type { EBattlePhase, FUnitSnapshot } from "@fd/gameplay-core";

export interface FHudViewModel {
  Phase: EBattlePhase;
  ActiveUnitId: string | null;
  SelectedTargetId: string | null;
  Units: FUnitSnapshot[];
  EventLogs: string[];
}
