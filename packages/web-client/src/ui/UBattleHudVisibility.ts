import type { FHudViewModel } from "./FHudViewModel";

export function ShouldShowBattleCornerActions(Hud: FHudViewModel): boolean {
  if (Hud.RuntimePhase !== "Battle3C") {
    return false;
  }

  const BattleState = Hud.Battle3CState;
  return (
    BattleState.CameraMode === "PlayerFollow" &&
    !BattleState.IsAimMode &&
    BattleState.CommandStage === "Root" &&
    BattleState.ScriptFocus === null
  );
}
