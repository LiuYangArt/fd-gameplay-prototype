import { describe, expect, it } from "vitest";

import {
  EOverworldCommandType,
  EOverworldEventType,
  EOverworldPhase,
  UOverworldSimulation
} from "../src";

describe("UOverworldSimulation", () => {
  it("InitializeWorld 后应进入 Exploring 阶段", () => {
    const Simulation = new UOverworldSimulation();

    const IsAccepted = Simulation.SubmitCommand({
      Type: EOverworldCommandType.InitializeWorld
    });

    expect(IsAccepted).toBe(true);
    expect(Simulation.GetState().Phase).toBe(EOverworldPhase.Exploring);
    expect(Object.keys(Simulation.GetState().Enemies)).toHaveLength(4);
  });

  it("Step 在走路与跑步下位移应有明显差异", () => {
    const WalkSimulation = new UOverworldSimulation();
    WalkSimulation.SubmitCommand({ Type: EOverworldCommandType.InitializeWorld });
    WalkSimulation.SubmitCommand({
      Type: EOverworldCommandType.Step,
      MoveAxis: { X: 0, Y: 1 },
      LookYawDeltaDegrees: 0,
      DeltaSeconds: 1,
      IsSprinting: false
    });

    const RunSimulation = new UOverworldSimulation();
    RunSimulation.SubmitCommand({ Type: EOverworldCommandType.InitializeWorld });
    RunSimulation.SubmitCommand({
      Type: EOverworldCommandType.Step,
      MoveAxis: { X: 0, Y: 1 },
      LookYawDeltaDegrees: 0,
      DeltaSeconds: 1,
      IsSprinting: true
    });

    const WalkDistance = WalkSimulation.GetState().Player.Position.Z;
    const RunDistance = RunSimulation.GetState().Player.Position.Z;

    expect(RunDistance).toBeGreaterThan(WalkDistance);
    expect(RunDistance - WalkDistance).toBeGreaterThan(50);
  });

  it("敌人游荡应保持在世界边界内", () => {
    const Simulation = new UOverworldSimulation();
    Simulation.SubmitCommand({
      Type: EOverworldCommandType.InitializeWorld,
      Config: {
        WorldHalfSize: 1200
      }
    });

    for (let Index = 0; Index < 200; Index += 1) {
      Simulation.SubmitCommand({
        Type: EOverworldCommandType.Step,
        MoveAxis: { X: 0, Y: 0 },
        LookYawDeltaDegrees: 0,
        DeltaSeconds: 0.016,
        IsSprinting: false
      });
    }

    const Boundary = Simulation.GetState().Tuning.WorldHalfSize;
    Object.values(Simulation.GetState().Enemies).forEach((Enemy) => {
      expect(Math.abs(Enemy.Position.X)).toBeLessThanOrEqual(Boundary);
      expect(Math.abs(Enemy.Position.Z)).toBeLessThanOrEqual(Boundary);
    });
  });

  it("遇敌事件在 ResolveEncounter 前只触发一次", () => {
    const Simulation = new UOverworldSimulation();
    Simulation.SubmitCommand({
      Type: EOverworldCommandType.InitializeWorld,
      Config: {
        EnemyCount: 1,
        WorldHalfSize: 400,
        Tuning: {
          EncounterDistance: 500
        }
      }
    });

    const FirstStepAccepted = Simulation.SubmitCommand({
      Type: EOverworldCommandType.Step,
      MoveAxis: { X: 0, Y: 1 },
      LookYawDeltaDegrees: 0,
      DeltaSeconds: 0.3,
      IsSprinting: true
    });
    const SecondStepAccepted = Simulation.SubmitCommand({
      Type: EOverworldCommandType.Step,
      MoveAxis: { X: 0, Y: 1 },
      LookYawDeltaDegrees: 0,
      DeltaSeconds: 0.3,
      IsSprinting: true
    });

    const EncounterEvents = Simulation.GetEventHistory().filter(
      (Event) => Event.Type === EOverworldEventType.EncounterTriggered
    );

    expect(FirstStepAccepted).toBe(true);
    expect(SecondStepAccepted).toBe(false);
    expect(Simulation.GetState().Phase).toBe(EOverworldPhase.EncounterPending);
    expect(EncounterEvents).toHaveLength(1);
  });

  it("ResolveEncounter 后应移除敌人并回到 Exploring", () => {
    const Simulation = new UOverworldSimulation();
    Simulation.SubmitCommand({
      Type: EOverworldCommandType.InitializeWorld,
      Config: {
        EnemyCount: 1,
        WorldHalfSize: 400,
        Tuning: {
          EncounterDistance: 500
        }
      }
    });
    Simulation.SubmitCommand({
      Type: EOverworldCommandType.Step,
      MoveAxis: { X: 0, Y: 1 },
      LookYawDeltaDegrees: 0,
      DeltaSeconds: 0.3,
      IsSprinting: true
    });

    const EncounterEnemyId = Simulation.GetState().PendingEncounterEnemyId;
    const IsResolved = Simulation.SubmitCommand({
      Type: EOverworldCommandType.ResolveEncounter
    });

    expect(IsResolved).toBe(true);
    expect(EncounterEnemyId).not.toBeNull();
    expect(Simulation.GetState().Phase).toBe(EOverworldPhase.Exploring);
    expect(Simulation.GetState().PendingEncounterEnemyId).toBeNull();
    expect(
      EncounterEnemyId ? Simulation.GetState().Enemies[EncounterEnemyId] : "missing"
    ).toBeUndefined();
  });

  it("ResetPlayerToSafePoint 后玩家位置应回到安全点", () => {
    const Simulation = new UOverworldSimulation();
    Simulation.SubmitCommand({ Type: EOverworldCommandType.InitializeWorld });
    Simulation.SubmitCommand({
      Type: EOverworldCommandType.Step,
      MoveAxis: { X: 0.5, Y: 1 },
      LookYawDeltaDegrees: 30,
      DeltaSeconds: 0.5,
      IsSprinting: true
    });

    const PositionBeforeReset = Simulation.GetState().Player.Position;
    const IsAccepted = Simulation.SubmitCommand({
      Type: EOverworldCommandType.ResetPlayerToSafePoint
    });
    const PositionAfterReset = Simulation.GetState().Player.Position;

    expect(IsAccepted).toBe(true);
    expect(PositionBeforeReset.X !== 0 || PositionBeforeReset.Z !== 0).toBe(true);
    expect(PositionAfterReset).toEqual({ X: 0, Z: 0 });
  });
});
