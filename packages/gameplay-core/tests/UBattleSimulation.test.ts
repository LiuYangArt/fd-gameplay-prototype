import { describe, expect, it } from "vitest";

import {
  EBattlePhase,
  EGameplayCommandType,
  EGameplayEventType,
  UBattleSimulation,
  type FUnitSnapshot
} from "../src";

function CreateSeedUnits(): FUnitSnapshot[] {
  return [
    {
      UnitId: "P01",
      DisplayName: "Hero",
      TeamId: "Player",
      MaxHp: 100,
      CurrentHp: 100,
      Speed: 12,
      IsAlive: true
    },
    {
      UnitId: "E01",
      DisplayName: "Enemy",
      TeamId: "Enemy",
      MaxHp: 60,
      CurrentHp: 60,
      Speed: 8,
      IsAlive: true
    }
  ];
}

describe("UBattleSimulation", () => {
  it("应按速度选出首个行动单位", () => {
    const Simulation = new UBattleSimulation();

    const IsAccepted = Simulation.SubmitCommand({
      Type: EGameplayCommandType.StartBattle,
      BattleId: "B-001",
      Units: CreateSeedUnits()
    });

    expect(IsAccepted).toBe(true);
    expect(Simulation.GetState().ActiveUnitId).toBe("P01");
    expect(Simulation.GetState().Phase).toBe(EBattlePhase.Active);
  });

  it("应在单位被击败后结束战斗并给出胜者", () => {
    const Simulation = new UBattleSimulation();

    Simulation.SubmitCommand({
      Type: EGameplayCommandType.StartBattle,
      BattleId: "B-002",
      Units: CreateSeedUnits()
    });

    const IsSkillAccepted = Simulation.SubmitCommand({
      Type: EGameplayCommandType.UseSkill,
      SourceUnitId: "P01",
      TargetUnitId: "E01",
      Skill: {
        SkillId: "SKL_HEAVY_STRIKE",
        BaseDamage: 99
      }
    });

    expect(IsSkillAccepted).toBe(true);
    expect(Simulation.GetState().Phase).toBe(EBattlePhase.Finished);

    const LastBattleFinishedEvent = Simulation.GetEventHistory()
      .filter((Event) => Event.Type === EGameplayEventType.BattleFinished)
      .at(-1);

    expect(LastBattleFinishedEvent?.Payload.WinnerTeamId).toBe("Player");
  });
});
