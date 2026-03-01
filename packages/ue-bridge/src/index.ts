import { UBattleSimulation, type FGameplayCommand } from "@fd/gameplay-core";

export interface IUECommandAdapter {
  ToGameplayCommand(RawPayload: unknown): FGameplayCommand | null;
}

export interface FUEInputActionBindingProfile {
  ProfileName: string;
  Version: number;
  ActionBindings: Array<{
    ActionTag: string;
    DisplayName: string;
    TriggerType: "Direct" | "FocusedConfirm";
    KeyboardMouseBindings: string[];
    GamepadBindings: string[];
  }>;
}

export class UUEBattleBridge {
  private readonly Simulation: UBattleSimulation;
  private InputBindingProfile: FUEInputActionBindingProfile | null;

  public constructor() {
    this.Simulation = new UBattleSimulation();
    this.InputBindingProfile = null;
  }

  public ExecuteFromUE(AdaptedCommand: FGameplayCommand): boolean {
    return this.Simulation.SubmitCommand(AdaptedCommand);
  }

  public GetSnapshot() {
    return this.Simulation.GetState();
  }

  public SetInputBindingProfile(Profile: FUEInputActionBindingProfile): void {
    this.InputBindingProfile = Profile;
  }

  public GetInputBindingProfile(): FUEInputActionBindingProfile | null {
    return this.InputBindingProfile;
  }
}
