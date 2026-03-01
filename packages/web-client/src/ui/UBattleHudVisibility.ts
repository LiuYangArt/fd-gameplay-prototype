import type { FHudViewModel } from "./FHudViewModel";

export function ShouldShowBattleCornerActions(Hud: FHudViewModel): boolean {
  if (Hud.RuntimePhase !== "Battle3C") {
    return false;
  }
  return Hud.InputHudState.GlobalActionSlots.length > 0;
}
