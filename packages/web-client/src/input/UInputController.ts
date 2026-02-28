import type { FInputSnapshot, FInputVector2 } from "./FInputSnapshot";

interface FGamepadSnapshot {
  MoveAxis: FInputVector2;
  LookAxis: FInputVector2;
  SprintHold: boolean;
  ToggleAimEdge: boolean;
  CancelAimEdge: boolean;
  FireEdge: boolean;
  SwitchCharacterEdge: boolean;
  ToggleSkillTargetModeEdge: boolean;
  CycleTargetAxis: number;
  ConfirmSettlementEdge: boolean;
  RestartEdge: boolean;
  ToggleDebugEdge: boolean;
}

interface FGamepadButtonState {
  A: boolean;
  B: boolean;
  LB: boolean;
  RB: boolean;
  LT: boolean;
  RT: boolean;
  DpadLeft: boolean;
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
const GamepadAimPixelsPerSecond = 520;
const GamepadCycleAxisThreshold = 0.65;
const IgnoreFireInputSelector = '[data-ignore-fire-input="true"]';
const InteractiveInputSelector =
  "button, input, textarea, select, option, label, a, [role='button']";

interface FInputControllerOptions {
  ResolveAimViewportRect?: () => DOMRect | null;
}

export class UInputController {
  private readonly OnInputFrame: (Snapshot: FInputSnapshot) => void;
  private readonly ResolveAimViewportRect: () => DOMRect | null;
  private readonly PressedKeys: Set<string>;
  private readonly KeyDownEdgeHandlers: Record<string, () => void>;
  private FrameHandle: number | null;
  private LastTimestamp: number | null;
  private MouseDeltaX: number;
  private MouseDeltaY: number;
  private PendingAimScreenPosition: FInputVector2 | null;
  private PendingToggleAimEdge: boolean;
  private PendingCancelAimEdge: boolean;
  private PendingFireEdge: boolean;
  private PendingSwitchCharacterEdge: boolean;
  private PendingToggleSkillTargetModeEdge: boolean;
  private PendingCycleTargetAxis: number;
  private PendingForceSettlementEdge: boolean;
  private PendingConfirmSettlementEdge: boolean;
  private PendingRestartEdge: boolean;
  private PendingToggleDebugEdge: boolean;
  private PreviousGamepadA: boolean;
  private PreviousGamepadB: boolean;
  private PreviousGamepadLB: boolean;
  private PreviousGamepadRB: boolean;
  private PreviousGamepadLT: boolean;
  private PreviousGamepadRT: boolean;
  private PreviousGamepadDpadLeft: boolean;
  private PreviousGamepadDpadRight: boolean;
  private PreviousGamepadStart: boolean;
  private PreviousGamepadBack: boolean;
  private PreviousGamepadStickCycleDirection: number;

  public constructor(
    OnInputFrame: (Snapshot: FInputSnapshot) => void,
    Options?: FInputControllerOptions
  ) {
    this.OnInputFrame = OnInputFrame;
    this.ResolveAimViewportRect = Options?.ResolveAimViewportRect ?? (() => null);
    this.PressedKeys = new Set();
    this.KeyDownEdgeHandlers = this.CreateKeyDownEdgeHandlers();
    this.FrameHandle = null;
    this.LastTimestamp = null;
    this.MouseDeltaX = 0;
    this.MouseDeltaY = 0;
    this.PendingAimScreenPosition = null;
    this.PendingToggleAimEdge = false;
    this.PendingCancelAimEdge = false;
    this.PendingFireEdge = false;
    this.PendingSwitchCharacterEdge = false;
    this.PendingToggleSkillTargetModeEdge = false;
    this.PendingCycleTargetAxis = 0;
    this.PendingForceSettlementEdge = false;
    this.PendingConfirmSettlementEdge = false;
    this.PendingRestartEdge = false;
    this.PendingToggleDebugEdge = false;
    this.PreviousGamepadA = false;
    this.PreviousGamepadB = false;
    this.PreviousGamepadLB = false;
    this.PreviousGamepadRB = false;
    this.PreviousGamepadLT = false;
    this.PreviousGamepadRT = false;
    this.PreviousGamepadDpadLeft = false;
    this.PreviousGamepadDpadRight = false;
    this.PreviousGamepadStart = false;
    this.PreviousGamepadBack = false;
    this.PreviousGamepadStickCycleDirection = 0;
  }

  public Bind(): () => void {
    const OnKeyDown = (Event: KeyboardEvent) => this.HandleKeyDown(Event);
    const OnKeyUp = (Event: KeyboardEvent) => this.HandleKeyUp(Event);
    const OnMouseMove = (Event: MouseEvent) => this.HandleMouseMove(Event);
    const OnMouseDown = (Event: MouseEvent) => this.HandleMouseDown(Event);
    const OnWindowBlur = () => this.HandleWindowBlur();

    window.addEventListener("keydown", OnKeyDown);
    window.addEventListener("keyup", OnKeyUp);
    window.addEventListener("mousemove", OnMouseMove);
    window.addEventListener("mousedown", OnMouseDown);
    window.addEventListener("blur", OnWindowBlur);
    this.StartLoop();

    return () => {
      window.removeEventListener("keydown", OnKeyDown);
      window.removeEventListener("keyup", OnKeyUp);
      window.removeEventListener("mousemove", OnMouseMove);
      window.removeEventListener("mousedown", OnMouseDown);
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

      const CycleTargetAxis = this.ResolveCycleTargetAxis(GamepadSnapshot.CycleTargetAxis);
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
        AimScreenDelta: this.ComposeAimScreenDelta(GamepadSnapshot.LookAxis, DeltaSeconds),
        AimScreenPosition: this.PendingAimScreenPosition,
        SprintHold:
          this.PressedKeys.has("ShiftLeft") ||
          this.PressedKeys.has("ShiftRight") ||
          GamepadSnapshot.SprintHold,
        ToggleAimEdge: this.PendingToggleAimEdge || GamepadSnapshot.ToggleAimEdge,
        CancelAimEdge: this.PendingCancelAimEdge || GamepadSnapshot.CancelAimEdge,
        FireEdge: this.PendingFireEdge || GamepadSnapshot.FireEdge,
        SwitchCharacterEdge: this.PendingSwitchCharacterEdge || GamepadSnapshot.SwitchCharacterEdge,
        ToggleSkillTargetModeEdge:
          this.PendingToggleSkillTargetModeEdge || GamepadSnapshot.ToggleSkillTargetModeEdge,
        CycleTargetAxis,
        ForceSettlementEdge: this.PendingForceSettlementEdge,
        ConfirmSettlementEdge:
          this.PendingConfirmSettlementEdge || GamepadSnapshot.ConfirmSettlementEdge,
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

    if (Event.code === "KeyQ" && Event.altKey) {
      Event.preventDefault();
      this.PendingForceSettlementEdge = true;
      return;
    }

    const Handler = this.KeyDownEdgeHandlers[Event.code];
    if (Handler) {
      Handler();
    }
  }

  private HandleKeyUp(Event: KeyboardEvent): void {
    this.PressedKeys.delete(Event.code);
  }

  private HandleMouseMove(Event: MouseEvent): void {
    this.MouseDeltaX += Event.movementX;
    this.MouseDeltaY += Event.movementY;
    this.PendingAimScreenPosition = this.ResolveAimScreenPosition(Event.clientX, Event.clientY);
  }

  private HandleMouseDown(Event: MouseEvent): void {
    if (Event.button !== 0 || this.ShouldIgnoreMouseFire(Event.target)) {
      return;
    }
    this.PendingAimScreenPosition = this.ResolveAimScreenPosition(Event.clientX, Event.clientY);
  }

  private HandleWindowBlur(): void {
    this.PressedKeys.clear();
    this.MouseDeltaX = 0;
    this.MouseDeltaY = 0;
    this.PendingAimScreenPosition = null;
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
    const StickCycleAxis = this.ReadGamepadStickCycleAxis(ActiveGamepad);
    const DpadCycleAxis = this.ResolveDpadCycleAxis(Buttons);
    const CycleTargetAxis = DpadCycleAxis !== 0 ? DpadCycleAxis : StickCycleAxis;
    const FireFromA = this.ResolvePressedEdge(Buttons.A, this.PreviousGamepadA);
    const FireFromRT = this.ResolvePressedEdge(Buttons.RT, this.PreviousGamepadRT);

    const Snapshot: FGamepadSnapshot = {
      MoveAxis: this.ReadGamepadMoveAxis(ActiveGamepad),
      LookAxis: this.ReadGamepadLookAxis(ActiveGamepad),
      SprintHold: ActiveGamepad.buttons[10]?.pressed ?? false,
      ToggleAimEdge: this.ResolvePressedEdge(Buttons.LT, this.PreviousGamepadLT),
      CancelAimEdge: this.ResolvePressedEdge(Buttons.B, this.PreviousGamepadB),
      FireEdge: FireFromA || FireFromRT,
      SwitchCharacterEdge: this.ResolvePressedEdge(Buttons.LB, this.PreviousGamepadLB),
      ToggleSkillTargetModeEdge: this.ResolvePressedEdge(Buttons.RB, this.PreviousGamepadRB),
      CycleTargetAxis,
      ConfirmSettlementEdge: FireFromA,
      RestartEdge: this.ResolvePressedEdge(Buttons.Start, this.PreviousGamepadStart),
      ToggleDebugEdge: this.ResolvePressedEdge(Buttons.Back, this.PreviousGamepadBack)
    };

    this.PreviousGamepadA = Buttons.A;
    this.PreviousGamepadB = Buttons.B;
    this.PreviousGamepadLB = Buttons.LB;
    this.PreviousGamepadRB = Buttons.RB;
    this.PreviousGamepadLT = Buttons.LT;
    this.PreviousGamepadRT = Buttons.RT;
    this.PreviousGamepadDpadLeft = Buttons.DpadLeft;
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
      ToggleAimEdge: false,
      CancelAimEdge: false,
      FireEdge: false,
      SwitchCharacterEdge: false,
      ToggleSkillTargetModeEdge: false,
      CycleTargetAxis: 0,
      ConfirmSettlementEdge: false,
      RestartEdge: false,
      ToggleDebugEdge: false
    };
  }

  private ReadGamepadButtonState(Pad: Gamepad): FGamepadButtonState {
    const LTValue = this.ReadGamepadButtonValue(Pad, 6);
    const RTValue = this.ReadGamepadButtonValue(Pad, 7);
    return {
      A: this.ReadGamepadButtonPressed(Pad, 0),
      B: this.ReadGamepadButtonPressed(Pad, 1),
      LB: this.ReadGamepadButtonPressed(Pad, 4),
      RB: this.ReadGamepadButtonPressed(Pad, 5),
      LT: LTValue > 0.5,
      RT: RTValue > 0.35,
      DpadLeft: this.ReadGamepadButtonPressed(Pad, 14),
      DpadRight: this.ReadGamepadButtonPressed(Pad, 15),
      Start: this.ReadGamepadButtonPressed(Pad, 9),
      Back: this.ReadGamepadButtonPressed(Pad, 8)
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

  private ReadGamepadStickCycleAxis(Pad: Gamepad): number {
    const StickX = Pad.axes[0] ?? 0;
    const DigitalDirection =
      StickX >= GamepadCycleAxisThreshold ? 1 : StickX <= -GamepadCycleAxisThreshold ? -1 : 0;
    const IsRisingEdge =
      DigitalDirection !== 0 && DigitalDirection !== this.PreviousGamepadStickCycleDirection;
    this.PreviousGamepadStickCycleDirection = DigitalDirection;
    return IsRisingEdge ? DigitalDirection : 0;
  }

  private ResolveDpadCycleAxis(Buttons: FGamepadButtonState): number {
    const LeftEdge = this.ResolvePressedEdge(Buttons.DpadLeft, this.PreviousGamepadDpadLeft);
    const RightEdge = this.ResolvePressedEdge(Buttons.DpadRight, this.PreviousGamepadDpadRight);
    if (LeftEdge && !RightEdge) {
      return -1;
    }
    if (RightEdge && !LeftEdge) {
      return 1;
    }
    return 0;
  }

  private CreateKeyDownEdgeHandlers(): Record<string, () => void> {
    return {
      KeyQ: () => {
        this.PendingToggleAimEdge = true;
      },
      Escape: () => {
        this.PendingCancelAimEdge = true;
      },
      KeyC: () => {
        this.PendingSwitchCharacterEdge = true;
      },
      Tab: () => {
        this.PendingToggleSkillTargetModeEdge = true;
      },
      Enter: () => {
        this.PendingConfirmSettlementEdge = true;
      },
      KeyR: () => {
        this.PendingRestartEdge = true;
      },
      F3: () => {
        this.PendingToggleDebugEdge = true;
      },
      ArrowLeft: () => {
        this.PendingCycleTargetAxis = -1;
      },
      KeyA: () => {
        this.PendingCycleTargetAxis = -1;
      },
      ArrowRight: () => {
        this.PendingCycleTargetAxis = 1;
      },
      KeyD: () => {
        this.PendingCycleTargetAxis = 1;
      }
    };
  }

  private ReadGamepadButtonPressed(Pad: Gamepad, ButtonIndex: number): boolean {
    return Pad.buttons[ButtonIndex]?.pressed ?? false;
  }

  private ReadGamepadButtonValue(Pad: Gamepad, ButtonIndex: number): number {
    return Pad.buttons[ButtonIndex]?.value ?? 0;
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

  private ComposeAimScreenDelta(
    GamepadLookAxis: FInputVector2,
    DeltaSeconds: number
  ): FInputVector2 {
    const AimDeltaY =
      this.MouseDeltaY + GamepadLookAxis.Y * GamepadAimPixelsPerSecond * DeltaSeconds;
    return {
      X: this.MouseDeltaX + GamepadLookAxis.X * GamepadAimPixelsPerSecond * DeltaSeconds,
      Y: AimDeltaY
    };
  }

  private ResolveAimScreenPosition(ClientX: number, ClientY: number): FInputVector2 | null {
    const ViewportRect = this.ResolveAimViewportRect();
    if (ViewportRect && ViewportRect.width > 0 && ViewportRect.height > 0) {
      const LocalX = (ClientX - ViewportRect.left) / ViewportRect.width;
      const LocalY = (ClientY - ViewportRect.top) / ViewportRect.height;
      if (LocalX < 0 || LocalX > 1 || LocalY < 0 || LocalY > 1) {
        return null;
      }

      return {
        X: LocalX,
        Y: LocalY
      };
    }

    if (window.innerWidth <= 0 || window.innerHeight <= 0) {
      return null;
    }

    return {
      X: this.Clamp(ClientX / window.innerWidth, 0, 1),
      Y: this.Clamp(ClientY / window.innerHeight, 0, 1)
    };
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

  private ResolveCycleTargetAxis(GamepadAxis: number): number {
    if (this.PendingCycleTargetAxis !== 0) {
      return this.PendingCycleTargetAxis;
    }
    return GamepadAxis;
  }

  private ResolvePressedEdge(Current: boolean, Previous: boolean): boolean {
    return Current && !Previous;
  }

  private ShouldIgnoreMouseFire(Target: EventTarget | null): boolean {
    if (!(Target instanceof Element)) {
      return false;
    }

    return (
      Target.closest(IgnoreFireInputSelector) !== null ||
      Target.closest(InteractiveInputSelector) !== null
    );
  }

  private Clamp(Value: number, Min: number, Max: number): number {
    return Math.min(Math.max(Value, Min), Max);
  }

  private ClearFrameAccumulation(): void {
    this.MouseDeltaX = 0;
    this.MouseDeltaY = 0;
    this.PendingAimScreenPosition = null;
    this.ClearFrameEdges();
  }

  private ClearFrameEdges(): void {
    this.PendingToggleAimEdge = false;
    this.PendingCancelAimEdge = false;
    this.PendingFireEdge = false;
    this.PendingSwitchCharacterEdge = false;
    this.PendingToggleSkillTargetModeEdge = false;
    this.PendingCycleTargetAxis = 0;
    this.PendingForceSettlementEdge = false;
    this.PendingConfirmSettlementEdge = false;
    this.PendingRestartEdge = false;
    this.PendingToggleDebugEdge = false;
  }

  private ResetGamepadEdges(): void {
    this.PreviousGamepadA = false;
    this.PreviousGamepadB = false;
    this.PreviousGamepadLB = false;
    this.PreviousGamepadRB = false;
    this.PreviousGamepadLT = false;
    this.PreviousGamepadRT = false;
    this.PreviousGamepadDpadLeft = false;
    this.PreviousGamepadDpadRight = false;
    this.PreviousGamepadStart = false;
    this.PreviousGamepadBack = false;
    this.PreviousGamepadStickCycleDirection = 0;
  }
}
