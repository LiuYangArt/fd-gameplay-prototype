import type { FBattlePendingActionKind, FHudViewModel } from "./FHudViewModel";

export interface FBattleTargetPromptModel {
  PromptText: string;
}

function ResolvePromptText(PendingActionKind: FBattlePendingActionKind): string {
  switch (PendingActionKind) {
    case "Attack":
      return "选择攻击目标";
    case "Skill":
      return "选择技能目标";
    case "Item":
      return "选择道具目标";
    default:
      return "";
  }
}

export function ResolveBattleTargetPromptModel(
  Hud: FHudViewModel
): FBattleTargetPromptModel | null {
  if (Hud.RuntimePhase !== "Battle3C") {
    return null;
  }

  const BattleState = Hud.Battle3CState;
  if (BattleState.CommandStage !== "TargetSelect" || BattleState.PendingActionKind === null) {
    return null;
  }

  return {
    PromptText: ResolvePromptText(BattleState.PendingActionKind)
  };
}
