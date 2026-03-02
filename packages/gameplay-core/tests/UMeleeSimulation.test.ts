import { describe, expect, it } from "vitest";

import { EMeleeCommandType, EMeleeEventType, UMeleeSimulation, type FUnitSnapshot } from "../src";

function CreateUnit(Override: Partial<FUnitSnapshot>): FUnitSnapshot {
  return {
    UnitId: Override.UnitId ?? "P01",
    DisplayName: Override.DisplayName ?? "Unit",
    TeamId: Override.TeamId ?? "Player",
    MaxHp: Override.MaxHp ?? 100,
    CurrentHp: Override.CurrentHp ?? 100,
    Speed: Override.Speed ?? 10,
    IsAlive: Override.IsAlive ?? true
  };
}

describe("UMeleeSimulation", () => {
  it("应在距离范围内命中并产生伤害事件", () => {
    const Simulation = new UMeleeSimulation();

    const IsAccepted = Simulation.SubmitCommand({
      Type: EMeleeCommandType.ResolveStrike,
      SourceUnit: CreateUnit({ UnitId: "P01", TeamId: "Player" }),
      TargetUnit: CreateUnit({
        UnitId: "E01",
        TeamId: "Enemy",
        MaxHp: 80,
        CurrentHp: 80
      }),
      DistanceCm: 90,
      RangeCm: 120,
      BaseDamage: 26
    });

    expect(IsAccepted).toBe(true);

    const Events = Simulation.GetEventHistory();
    expect(Events).toHaveLength(2);
    expect(Events[0]?.Type).toBe(EMeleeEventType.MeleeResolved);
    expect(Events[1]?.Type).toBe(EMeleeEventType.DamageApplied);
    expect(Events[0]?.Payload).toMatchObject({
      SourceUnitId: "P01",
      TargetUnitId: "E01",
      IsHit: true,
      MissReason: "None"
    });
    expect(Events[1]?.Payload).toMatchObject({
      SourceUnitId: "P01",
      TargetUnitId: "E01",
      AppliedDamage: 26,
      RemainingHp: 54
    });
  });

  it("应在超出攻击距离时判定未命中且不产生伤害事件", () => {
    const Simulation = new UMeleeSimulation();

    const IsAccepted = Simulation.SubmitCommand({
      Type: EMeleeCommandType.ResolveStrike,
      SourceUnit: CreateUnit({ UnitId: "P01", TeamId: "Player" }),
      TargetUnit: CreateUnit({ UnitId: "E01", TeamId: "Enemy", CurrentHp: 70, MaxHp: 70 }),
      DistanceCm: 220,
      RangeCm: 120,
      BaseDamage: 30
    });

    expect(IsAccepted).toBe(true);

    const Events = Simulation.GetEventHistory();
    expect(Events).toHaveLength(1);
    expect(Events[0]?.Type).toBe(EMeleeEventType.MeleeResolved);
    expect(Events[0]?.Payload).toMatchObject({
      IsHit: false,
      MissReason: "OutOfRange"
    });
  });

  it("目标死亡时应判定未命中并给出 InvalidTarget", () => {
    const Simulation = new UMeleeSimulation();

    const IsAccepted = Simulation.SubmitCommand({
      Type: EMeleeCommandType.ResolveStrike,
      SourceUnit: CreateUnit({ UnitId: "P01", TeamId: "Player" }),
      TargetUnit: CreateUnit({
        UnitId: "E01",
        TeamId: "Enemy",
        CurrentHp: 0,
        IsAlive: false
      }),
      DistanceCm: 60,
      RangeCm: 120,
      BaseDamage: 18
    });

    expect(IsAccepted).toBe(true);

    const Events = Simulation.GetEventHistory();
    expect(Events).toHaveLength(1);
    expect(Events[0]?.Type).toBe(EMeleeEventType.MeleeResolved);
    expect(Events[0]?.Payload).toMatchObject({
      IsHit: false,
      MissReason: "InvalidTarget"
    });
  });

  it("同一次命令事件顺序应稳定为 MeleeResolved -> DamageApplied", () => {
    const Simulation = new UMeleeSimulation();

    Simulation.SubmitCommand({
      Type: EMeleeCommandType.ResolveStrike,
      SourceUnit: CreateUnit({ UnitId: "P01", TeamId: "Player" }),
      TargetUnit: CreateUnit({ UnitId: "E01", TeamId: "Enemy", CurrentHp: 50, MaxHp: 50 }),
      DistanceCm: 88,
      RangeCm: 120,
      BaseDamage: 12
    });

    const Events = Simulation.GetEventHistory();
    expect(Events.map((Event) => Event.Type)).toEqual([
      EMeleeEventType.MeleeResolved,
      EMeleeEventType.DamageApplied
    ]);
    expect(Events[0]?.EventId).toBe(1);
    expect(Events[1]?.EventId).toBe(2);
  });
});
