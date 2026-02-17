import { EGameplayCommandType } from "./EGameplayCommandType";

import type { FSkillPayload } from "../types/FSkillPayload";
import type { FUnitSnapshot } from "../types/FUnitSnapshot";

export interface FStartBattleCommand {
  Type: EGameplayCommandType.StartBattle;
  BattleId: string;
  Units: FUnitSnapshot[];
}

export interface FUseSkillCommand {
  Type: EGameplayCommandType.UseSkill;
  SourceUnitId: string;
  TargetUnitId: string;
  Skill: FSkillPayload;
}

export interface FEndTurnCommand {
  Type: EGameplayCommandType.EndTurn;
  SourceUnitId: string;
}

export type FGameplayCommand = FStartBattleCommand | FUseSkillCommand | FEndTurnCommand;
