import { UBattleSimulation, type FGameplayCommand } from "@fd/gameplay-core";

export interface IUECommandAdapter {
  ToGameplayCommand(RawPayload: unknown): FGameplayCommand | null;
}

export class UUEBattleBridge {
  private readonly Simulation: UBattleSimulation;

  public constructor() {
    this.Simulation = new UBattleSimulation();
  }

  public ExecuteFromUE(AdaptedCommand: FGameplayCommand): boolean {
    return this.Simulation.SubmitCommand(AdaptedCommand);
  }

  public GetSnapshot() {
    return this.Simulation.GetState();
  }
}
