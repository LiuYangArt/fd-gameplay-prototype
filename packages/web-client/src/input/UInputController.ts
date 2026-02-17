import { UWebBattleRuntime } from "../game/UWebBattleRuntime";

export class UInputController {
  private readonly Runtime: UWebBattleRuntime;
  private FrameHandle: number | null;
  private PreviousA: boolean;
  private PreviousDpadRight: boolean;
  private PreviousStart: boolean;

  public constructor(Runtime: UWebBattleRuntime) {
    this.Runtime = Runtime;
    this.FrameHandle = null;
    this.PreviousA = false;
    this.PreviousDpadRight = false;
    this.PreviousStart = false;
  }

  public Bind(): () => void {
    const OnKeyDown = (Event: KeyboardEvent) => {
      this.HandleKeyboardAction(Event);
    };

    window.addEventListener("keydown", OnKeyDown);
    this.StartGamepadLoop();

    return () => {
      window.removeEventListener("keydown", OnKeyDown);
      this.StopGamepadLoop();
    };
  }

  private StartGamepadLoop(): void {
    const Tick = () => {
      this.ReadGamepadState();
      this.FrameHandle = window.requestAnimationFrame(Tick);
    };

    this.FrameHandle = window.requestAnimationFrame(Tick);
  }

  private StopGamepadLoop(): void {
    if (this.FrameHandle !== null) {
      window.cancelAnimationFrame(this.FrameHandle);
      this.FrameHandle = null;
    }
  }

  private ReadGamepadState(): void {
    const ActiveGamepad = navigator.getGamepads().find((Pad) => Pad?.connected);
    if (!ActiveGamepad) {
      this.ResetButtonEdges();
      return;
    }

    const CurrentA = ActiveGamepad.buttons[0]?.pressed ?? false;
    const CurrentDpadRight = ActiveGamepad.buttons[15]?.pressed ?? false;
    const CurrentStart = ActiveGamepad.buttons[9]?.pressed ?? false;

    this.HandlePressedEdge(CurrentA, this.PreviousA, () => this.Runtime.UseBasicSkill());
    this.HandlePressedEdge(CurrentDpadRight, this.PreviousDpadRight, () =>
      this.Runtime.SelectNextTarget()
    );
    this.HandlePressedEdge(CurrentStart, this.PreviousStart, () => this.Runtime.StartBattle());

    this.PreviousA = CurrentA;
    this.PreviousDpadRight = CurrentDpadRight;
    this.PreviousStart = CurrentStart;
  }

  private HandleKeyboardAction(Event: KeyboardEvent): void {
    switch (Event.code) {
      case "Enter":
      case "Space":
        this.Runtime.UseBasicSkill();
        break;
      case "Tab":
        Event.preventDefault();
        this.Runtime.SelectNextTarget();
        break;
      case "KeyR":
        this.Runtime.StartBattle();
        break;
      default:
        break;
    }
  }

  private ResetButtonEdges(): void {
    this.PreviousA = false;
    this.PreviousDpadRight = false;
    this.PreviousStart = false;
  }

  private HandlePressedEdge(Current: boolean, Previous: boolean, Action: () => void): void {
    if (Current && !Previous) {
      Action();
    }
  }
}
