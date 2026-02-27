import type { FRuntimePhase } from "./FHudViewModel";

export function ShouldShowBattleCornerActions(RuntimePhase: FRuntimePhase): boolean {
  return RuntimePhase === "Battle3C";
}
