import type { FInputSnapshot, FInputVector2 } from "./FInputSnapshot";

interface FGamepadSnapshot {
  MoveAxis: FInputVector2;
  LookAxis: FInputVector2;
  SprintHold: boolean;
  ConfirmEdge: boolean;
  NextTargetEdge: boolean;
  RestartEdge: boolean;
  ToggleDebugEdge: boolean;
}

interface FGamepadButtonState {
  A: boolean;
  DpadRight: boolean;
  Start: boolean;
  Back: boolean;
}

const MoveDeadzone = 0.16;
const LookDeadzone = 0.14;
const MouseYawDegreesPerPixel = 0.18;
const MousePitchDegreesPerPixel = 0.14;
const GamepadYawDegreesPerSecond = 180;
const GamepadPitchDegreesPerSecond = 135;

export class UInputController {
  private readonly OnInputFrame: (Snapshot: FInputSnapshot) => void;
  private readonly PressedKeys: Set<string>;
  private FrameHandle: number | null;
  private LastTimestamp: number | null;
  private MouseDeltaX: number;
  private MouseDeltaY: number;
  private PendingConfirmEdge: boolean;
  private PendingNextTargetEdge: boolean;
  private PendingRestartEdge: boolean;
  private PendingToggleDebugEdge: boolean;
  private PreviousGamepadA: boolean;
  private PreviousGamepadDpadRight: boolean;
  private PreviousGamepadStart: boolean;
  private PreviousGamepadBack: boolean;

  public constructor(OnInputFrame: (Snapshot: FInputSnapshot) => void) {
    this.OnInputFrame = OnInputFrame;
    this.PressedKeys = new Set();
    this.FrameHandle = null;
    this.LastTimestamp = null;
    this.MouseDeltaX = 0;
    this.MouseDeltaY = 0;
    this.PendingConfirmEdge = false;
    this.PendingNextTargetEdge = false;
    this.PendingRestartEdge = false;
    this.PendingToggleDebugEdge = false;
    this.PreviousGamepadA = false;
    this.PreviousGamepadDpadRight = false;
    this.PreviousGamepadStart = false;
    this.PreviousGamepadBack = false;
  }

  public Bind(): () => void {
    const OnKeyDown = (Event: KeyboardEvent) => this.HandleKeyDown(Event);
    const OnKeyUp = (Event: KeyboardEvent) => this.HandleKeyUp(Event);
    const OnMouseMove = (Event: MouseEvent) => this.HandleMouseMove(Event);
    const OnWindowBlur = () => this.HandleWindowBlur();

    window.addEventListener("keydown", OnKeyDown);
    window.addEventListener("keyup", OnKeyUp);
    window.addEventListener("mousemove", OnMouseMove);
    window.addEventListener("blur", OnWindowBlur);
    this.StartLoop();

    return () => {
      window.removeEventListener("keydown", OnKeyDown);
      window.removeEventListener("keyup", OnKeyUp);
      window.removeEventListener("mousemove", OnMouseMove);
      window.removeEventListener("blur", OnWindowBlur);
      this.StopLoop();
    };
  }

  private StartLoop(): void {
    const Tick = (Timestamp: number) => {
      const DeltaSeconds = this.ResolveDeltaSeconds(Timestamp);
      const GamepadSnapshot = this.ReadGamepadSnapshot();
      const KeyboardMoveAxis = this.ReadKeyboardMoveAxis();
      const MoveAxis = this.NormalizeAxis(
        KeyboardMoveAxis.X + GamepadSnapshot.MoveAxis.X,
        KeyboardMoveAxis.Y + GamepadSnapshot.MoveAxis.Y
      );

      const Snapshot: FInputSnapshot = {
        MoveAxis,
        LookYawDeltaDegrees: this.ComposeLookYawDeltaDegrees(
          GamepadSnapshot.LookAxis.X,
          DeltaSeconds
        ),
        LookPitchDeltaDegrees: this.ComposeLookPitchDeltaDegrees(
          GamepadSnapshot.LookAxis.Y,
          DeltaSeconds
        ),
        SprintHold:
          this.PressedKeys.has("ShiftLeft") ||
          this.PressedKeys.has("ShiftRight") ||
          GamepadSnapshot.SprintHold,
        ConfirmEdge: this.PendingConfirmEdge || GamepadSnapshot.ConfirmEdge,
        NextTargetEdge: this.PendingNextTargetEdge || GamepadSnapshot.NextTargetEdge,
        RestartEdge: this.PendingRestartEdge || GamepadSnapshot.RestartEdge,
        ToggleDebugEdge: this.PendingToggleDebugEdge || GamepadSnapshot.ToggleDebugEdge,
        DeltaSeconds
      };

      this.ClearFrameAccumulation();
      this.OnInputFrame(Snapshot);
      this.FrameHandle = window.requestAnimationFrame(Tick);
    };

    this.FrameHandle = window.requestAnimationFrame(Tick);
  }

  private StopLoop(): void {
    if (this.FrameHandle !== null) {
      window.cancelAnimationFrame(this.FrameHandle);
      this.FrameHandle = null;
    }
    this.LastTimestamp = null;
  }

  private HandleKeyDown(Event: KeyboardEvent): void {
    if (Event.code === "Tab" || Event.code === "F3") {
      Event.preventDefault();
    }

    if (this.IsStateKey(Event.code)) {
      this.PressedKeys.add(Event.code);
    }

    if (Event.repeat) {
      return;
    }

    switch (Event.code) {
      case "Enter":
      case "Space":
        this.PendingConfirmEdge = true;
        break;
      case "Tab":
        this.PendingNextTargetEdge = true;
        break;
      case "KeyR":
        this.PendingRestartEdge = true;
        break;
      case "F3":
        this.PendingToggleDebugEdge = true;
        break;
      default:
        break;
    }
  }

  private HandleKeyUp(Event: KeyboardEvent): void {
    this.PressedKeys.delete(Event.code);
  }

  private HandleMouseMove(Event: MouseEvent): void {
    this.MouseDeltaX += Event.movementX;
    this.MouseDeltaY += Event.movementY;
  }

  private HandleWindowBlur(): void {
    this.PressedKeys.clear();
    this.MouseDeltaX = 0;
    this.MouseDeltaY = 0;
    this.ClearFrameEdges();
    this.ResetGamepadEdges();
  }

  private ResolveDeltaSeconds(Timestamp: number): number {
    if (this.LastTimestamp === null) {
      this.LastTimestamp = Timestamp;
      return 1 / 60;
    }

    const DeltaSeconds = (Timestamp - this.LastTimestamp) / 1000;
    this.LastTimestamp = Timestamp;
    return Math.min(Math.max(DeltaSeconds, 1 / 120), 0.1);
  }

  private ReadKeyboardMoveAxis(): FInputVector2 {
    const X = (this.PressedKeys.has("KeyD") ? 1 : 0) - (this.PressedKeys.has("KeyA") ? 1 : 0);
    const Y = (this.PressedKeys.has("KeyW") ? 1 : 0) - (this.PressedKeys.has("KeyS") ? 1 : 0);
    return { X, Y };
  }

  private ReadGamepadSnapshot(): FGamepadSnapshot {
    const ActiveGamepad = this.GetActiveGamepad();
    if (!ActiveGamepad) {
      this.ResetGamepadEdges();
      return this.CreateEmptyGamepadSnapshot();
    }

    const Buttons = this.ReadGamepadButtonState(ActiveGamepad);

    const Snapshot: FGamepadSnapshot = {
      MoveAxis: this.ReadGamepadMoveAxis(ActiveGamepad),
      LookAxis: this.ReadGamepadLookAxis(ActiveGamepad),
      SprintHold: (ActiveGamepad.buttons[7]?.value ?? 0) > 0.25,
      ConfirmEdge: this.ResolvePressedEdge(Buttons.A, this.PreviousGamepadA),
      NextTargetEdge: this.ResolvePressedEdge(Buttons.DpadRight, this.PreviousGamepadDpadRight),
      RestartEdge: this.ResolvePressedEdge(Buttons.Start, this.PreviousGamepadStart),
      ToggleDebugEdge: this.ResolvePressedEdge(Buttons.Back, this.PreviousGamepadBack)
    };

    this.PreviousGamepadA = Buttons.A;
    this.PreviousGamepadDpadRight = Buttons.DpadRight;
    this.PreviousGamepadStart = Buttons.Start;
    this.PreviousGamepadBack = Buttons.Back;

    return Snapshot;
  }

  private CreateEmptyGamepadSnapshot(): FGamepadSnapshot {
    return {
      MoveAxis: { X: 0, Y: 0 },
      LookAxis: { X: 0, Y: 0 },
      SprintHold: false,
      ConfirmEdge: false,
      NextTargetEdge: false,
      RestartEdge: false,
      ToggleDebugEdge: false
    };
  }

  private ReadGamepadButtonState(Pad: Gamepad): FGamepadButtonState {
    return {
      A: Pad.buttons[0]?.pressed ?? false,
      DpadRight: Pad.buttons[15]?.pressed ?? false,
      Start: Pad.buttons[9]?.pressed ?? false,
      Back: Pad.buttons[8]?.pressed ?? false
    };
  }

  private ReadGamepadMoveAxis(Pad: Gamepad): FInputVector2 {
    return this.ApplyRadialDeadzone(
      {
        X: Pad.axes[0] ?? 0,
        Y: -(Pad.axes[1] ?? 0)
      },
      MoveDeadzone
    );
  }

  private ReadGamepadLookAxis(Pad: Gamepad): FInputVector2 {
    return this.ApplyRadialDeadzone(
      {
        X: Pad.axes[2] ?? 0,
        Y: Pad.axes[3] ?? 0
      },
      LookDeadzone
    );
  }

  private ComposeLookYawDeltaDegrees(GamepadLookX: number, DeltaSeconds: number): number {
    const MouseYawDelta = this.MouseDeltaX * MouseYawDegreesPerPixel;
    const GamepadYawDelta = GamepadLookX * GamepadYawDegreesPerSecond * DeltaSeconds;
    return MouseYawDelta + GamepadYawDelta;
  }

  private ComposeLookPitchDeltaDegrees(GamepadLookY: number, DeltaSeconds: number): number {
    const MousePitchDelta = this.MouseDeltaY * MousePitchDegreesPerPixel;
    const GamepadPitchDelta = GamepadLookY * GamepadPitchDegreesPerSecond * DeltaSeconds;
    return MousePitchDelta + GamepadPitchDelta;
  }

  private GetActiveGamepad(): Gamepad | null {
    const Gamepads = navigator.getGamepads();
    for (const Pad of Gamepads) {
      if (Pad && Pad.connected) {
        return Pad;
      }
    }
    return null;
  }

  private NormalizeAxis(X: number, Y: number): FInputVector2 {
    const Length = Math.sqrt(X * X + Y * Y);
    if (Length <= 1e-6) {
      return { X: 0, Y: 0 };
    }

    if (Length <= 1) {
      return { X, Y };
    }

    return {
      X: X / Length,
      Y: Y / Length
    };
  }

  private ApplyRadialDeadzone(Axis: FInputVector2, Deadzone: number): FInputVector2 {
    const Length = Math.sqrt(Axis.X * Axis.X + Axis.Y * Axis.Y);
    if (Length <= Deadzone) {
      return { X: 0, Y: 0 };
    }

    const NormalizedLength = (Length - Deadzone) / (1 - Deadzone);
    const Scale = NormalizedLength / Length;
    return {
      X: Axis.X * Scale,
      Y: Axis.Y * Scale
    };
  }

  private IsStateKey(Code: string): boolean {
    return (
      Code === "KeyW" ||
      Code === "KeyA" ||
      Code === "KeyS" ||
      Code === "KeyD" ||
      Code === "ShiftLeft" ||
      Code === "ShiftRight"
    );
  }

  private ResolvePressedEdge(Current: boolean, Previous: boolean): boolean {
    return Current && !Previous;
  }

  private ClearFrameAccumulation(): void {
    this.MouseDeltaX = 0;
    this.MouseDeltaY = 0;
    this.ClearFrameEdges();
  }

  private ClearFrameEdges(): void {
    this.PendingConfirmEdge = false;
    this.PendingNextTargetEdge = false;
    this.PendingRestartEdge = false;
    this.PendingToggleDebugEdge = false;
  }

  private ResetGamepadEdges(): void {
    this.PreviousGamepadA = false;
    this.PreviousGamepadDpadRight = false;
    this.PreviousGamepadStart = false;
    this.PreviousGamepadBack = false;
  }
}
