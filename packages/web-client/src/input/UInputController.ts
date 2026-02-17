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
      if (Event.code === "Enter" || Event.code === "Space") {
        this.Runtime.UseBasicSkill();
      }

      if (Event.code === "Tab") {
        Event.preventDefault();
        this.Runtime.SelectNextTarget();
      }

      if (Event.code === "KeyR") {
        this.Runtime.StartBattle();
      }
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
    const Gamepad = navigator.getGamepads().find((Pad) => Pad?.connected);
    if (!Gamepad) {
      this.PreviousA = false;
      this.PreviousDpadRight = false;
      this.PreviousStart = false;
      return;
    }

    const CurrentA = Gamepad.buttons[0]?.pressed ?? false;
    const CurrentDpadRight = Gamepad.buttons[15]?.pressed ?? false;
    const CurrentStart = Gamepad.buttons[9]?.pressed ?? false;

    if (CurrentA && !this.PreviousA) {
      this.Runtime.UseBasicSkill();
    }

    if (CurrentDpadRight && !this.PreviousDpadRight) {
      this.Runtime.SelectNextTarget();
    }

    if (CurrentStart && !this.PreviousStart) {
      this.Runtime.StartBattle();
    }

    this.PreviousA = CurrentA;
    this.PreviousDpadRight = CurrentDpadRight;
    this.PreviousStart = CurrentStart;
  }
}
