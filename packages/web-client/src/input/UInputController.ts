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
  ToggleItemMenuEdge: boolean;
  CycleTargetAxis: number;
  CycleMenuAxis: number;
  ConfirmSettlementEdge: boolean;
  RestartEdge: boolean;
  ToggleDebugEdge: boolean;
}

interface FGamepadButtonState {
  A: boolean;
  B: boolean;
  Y: boolean;
  LB: boolean;
  RB: boolean;
  LT: boolean;
  RT: boolean;
  DpadUp: boolean;
  DpadDown: boolean;
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
  ResolvePointerLockElement?: () => HTMLElement | null;
  ShouldLockPointer?: () => boolean;
  ShouldRequestPointerLockOnToggleAim?: () => boolean;
}

export class UInputController {
  private readonly OnInputFrame: (Snapshot: FInputSnapshot) => void;
  private readonly ResolveAimViewportRect: () => DOMRect | null;
  private readonly ResolvePointerLockElement: () => HTMLElement | null;
  private readonly ShouldLockPointer: () => boolean;
  private readonly ShouldRequestPointerLockOnToggleAim: () => boolean;
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
  private PendingToggleItemMenuEdge: boolean;
  private PendingCycleTargetAxis: number;
  private PendingCycleMenuAxis: number;
  private PendingForceSettlementEdge: boolean;
  private PendingConfirmSettlementEdge: boolean;
  private PendingRestartEdge: boolean;
  private PendingToggleDebugEdge: boolean;
  private WasPointerLockedToBattleViewport: boolean;
  private PreviousGamepadA: boolean;
  private PreviousGamepadB: boolean;
  private PreviousGamepadY: boolean;
  private PreviousGamepadLB: boolean;
  private PreviousGamepadRB: boolean;
  private PreviousGamepadLT: boolean;
  private PreviousGamepadRT: boolean;
  private PreviousGamepadDpadUp: boolean;
  private PreviousGamepadDpadDown: boolean;
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
    this.ResolvePointerLockElement = Options?.ResolvePointerLockElement ?? (() => null);
    this.ShouldLockPointer = Options?.ShouldLockPointer ?? (() => false);
    this.ShouldRequestPointerLockOnToggleAim =
      Options?.ShouldRequestPointerLockOnToggleAim ?? (() => false);
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
    this.PendingToggleItemMenuEdge = false;
    this.PendingCycleTargetAxis = 0;
    this.PendingCycleMenuAxis = 0;
    this.PendingForceSettlementEdge = false;
    this.PendingConfirmSettlementEdge = false;
    this.PendingRestartEdge = false;
    this.PendingToggleDebugEdge = false;
    this.WasPointerLockedToBattleViewport = false;
    this.PreviousGamepadA = false;
    this.PreviousGamepadB = false;
    this.PreviousGamepadY = false;
    this.PreviousGamepadLB = false;
    this.PreviousGamepadRB = false;
    this.PreviousGamepadLT = false;
    this.PreviousGamepadRT = false;
    this.PreviousGamepadDpadUp = false;
    this.PreviousGamepadDpadDown = false;
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
      this.SyncPointerLockState();
      const GamepadSnapshot = this.ReadGamepadSnapshot();
      const KeyboardMoveAxis = this.ReadKeyboardMoveAxis();
      const MoveAxis = this.NormalizeAxis(
        KeyboardMoveAxis.X + GamepadSnapshot.MoveAxis.X,
        KeyboardMoveAxis.Y + GamepadSnapshot.MoveAxis.Y
      );

      const CycleTargetAxis = this.ResolveCycleTargetAxis(GamepadSnapshot.CycleTargetAxis);
      const CycleMenuAxis = this.ResolveCycleMenuAxis(GamepadSnapshot.CycleMenuAxis);
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
        ToggleItemMenuEdge: this.PendingToggleItemMenuEdge || GamepadSnapshot.ToggleItemMenuEdge,
        CycleTargetAxis,
        CycleMenuAxis,
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
    if (Event.code === "KeyQ" && !Event.altKey && this.ShouldRequestPointerLockOnToggleAim()) {
      this.TryRequestPointerLock();
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
    const ShouldIgnoreFire = this.ShouldIgnoreMouseFire(Event.target);
    if (Event.button === 0 && this.ShouldLockPointer() && !ShouldIgnoreFire) {
      this.TryRequestPointerLock();
    }
    if (Event.button !== 0 || ShouldIgnoreFire) {
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
    const DpadMenuAxis = this.ResolveDpadMenuAxis(Buttons);
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
      ToggleItemMenuEdge: this.ResolvePressedEdge(Buttons.Y, this.PreviousGamepadY),
      CycleTargetAxis,
      CycleMenuAxis: DpadMenuAxis,
      ConfirmSettlementEdge: FireFromA,
      RestartEdge: this.ResolvePressedEdge(Buttons.Start, this.PreviousGamepadStart),
      ToggleDebugEdge: this.ResolvePressedEdge(Buttons.Back, this.PreviousGamepadBack)
    };

    this.PreviousGamepadA = Buttons.A;
    this.PreviousGamepadB = Buttons.B;
    this.PreviousGamepadY = Buttons.Y;
    this.PreviousGamepadLB = Buttons.LB;
    this.PreviousGamepadRB = Buttons.RB;
    this.PreviousGamepadLT = Buttons.LT;
    this.PreviousGamepadRT = Buttons.RT;
    this.PreviousGamepadDpadUp = Buttons.DpadUp;
    this.PreviousGamepadDpadDown = Buttons.DpadDown;
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
      ToggleItemMenuEdge: false,
      CycleTargetAxis: 0,
      CycleMenuAxis: 0,
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
      Y: this.ReadGamepadButtonPressed(Pad, 3),
      LB: this.ReadGamepadButtonPressed(Pad, 4),
      RB: this.ReadGamepadButtonPressed(Pad, 5),
      LT: LTValue > 0.5,
      RT: RTValue > 0.35,
      DpadUp: this.ReadGamepadButtonPressed(Pad, 12),
      DpadDown: this.ReadGamepadButtonPressed(Pad, 13),
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

  private ResolveDpadMenuAxis(Buttons: FGamepadButtonState): number {
    const UpEdge = this.ResolvePressedEdge(Buttons.DpadUp, this.PreviousGamepadDpadUp);
    const DownEdge = this.ResolvePressedEdge(Buttons.DpadDown, this.PreviousGamepadDpadDown);
    if (UpEdge && !DownEdge) {
      return -1;
    }
    if (DownEdge && !UpEdge) {
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
      KeyF: () => {
        this.PendingFireEdge = true;
      },
      Tab: () => {
        this.PendingToggleSkillTargetModeEdge = true;
      },
      KeyW: () => {
        this.PendingToggleItemMenuEdge = true;
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
      ArrowUp: () => {
        this.PendingCycleMenuAxis = -1;
      },
      KeyA: () => {
        this.PendingCycleTargetAxis = -1;
      },
      ArrowRight: () => {
        this.PendingCycleTargetAxis = 1;
      },
      ArrowDown: () => {
        this.PendingCycleMenuAxis = 1;
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

  private ResolveCycleMenuAxis(GamepadAxis: number): number {
    if (this.PendingCycleMenuAxis !== 0) {
      return this.PendingCycleMenuAxis;
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

  private AttachPointerLockAsyncErrorLog(Result: unknown, Prefix: string): void {
    if (typeof Result !== "object" || Result === null || !("catch" in Result)) {
      return;
    }

    const CatchFn = Result.catch;
    if (typeof CatchFn !== "function") {
      return;
    }

    void CatchFn.call(Result, (Err: unknown) => {
      const ErrorMessage =
        Err instanceof globalThis.Error ? `${Err.name}: ${Err.message}` : String(Err);
      console.warn(`[Input] ${Prefix}: ${ErrorMessage}`);
    });
  }

  private TryRequestPointerLock(): void {
    const PointerLockElement = this.ResolvePointerLockElement();
    if (!PointerLockElement || typeof PointerLockElement.requestPointerLock !== "function") {
      return;
    }

    const CurrentPointerLockElement =
      typeof document !== "undefined" ? document.pointerLockElement : null;
    if (CurrentPointerLockElement === PointerLockElement) {
      return;
    }

    try {
      const RequestResult = PointerLockElement.requestPointerLock();
      this.AttachPointerLockAsyncErrorLog(RequestResult, "Pointer lock request rejected");
    } catch (Err) {
      const ErrorMessage =
        Err instanceof globalThis.Error ? `${Err.name}: ${Err.message}` : String(Err);
      console.warn(`[Input] Pointer lock request threw: ${ErrorMessage}`);
    }
  }

  private SyncPointerLockState(): void {
    if (typeof document === "undefined") {
      this.WasPointerLockedToBattleViewport = false;
      return;
    }

    const PointerLockElement = this.ResolvePointerLockElement();
    if (!PointerLockElement) {
      this.WasPointerLockedToBattleViewport = false;
      return;
    }
    const IsPointerLockedToBattleViewport = document.pointerLockElement === PointerLockElement;

    if (this.ShouldLockPointer()) {
      if (this.WasPointerLockedToBattleViewport && !IsPointerLockedToBattleViewport) {
        this.PendingCancelAimEdge = true;
      }
      this.WasPointerLockedToBattleViewport = IsPointerLockedToBattleViewport;
      return;
    }

    if (!IsPointerLockedToBattleViewport) {
      this.WasPointerLockedToBattleViewport = false;
      return;
    }

    try {
      const ExitResult = document.exitPointerLock();
      this.AttachPointerLockAsyncErrorLog(ExitResult, "Pointer lock exit rejected");
    } catch (Err) {
      const ErrorMessage =
        Err instanceof globalThis.Error ? `${Err.name}: ${Err.message}` : String(Err);
      console.warn(`[Input] Pointer lock exit threw: ${ErrorMessage}`);
    }
    this.WasPointerLockedToBattleViewport = false;
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
    this.PendingToggleItemMenuEdge = false;
    this.PendingCycleTargetAxis = 0;
    this.PendingCycleMenuAxis = 0;
    this.PendingForceSettlementEdge = false;
    this.PendingConfirmSettlementEdge = false;
    this.PendingRestartEdge = false;
    this.PendingToggleDebugEdge = false;
  }

  private ResetGamepadEdges(): void {
    this.PreviousGamepadA = false;
    this.PreviousGamepadB = false;
    this.PreviousGamepadY = false;
    this.PreviousGamepadLB = false;
    this.PreviousGamepadRB = false;
    this.PreviousGamepadLT = false;
    this.PreviousGamepadRT = false;
    this.PreviousGamepadDpadUp = false;
    this.PreviousGamepadDpadDown = false;
    this.PreviousGamepadDpadLeft = false;
    this.PreviousGamepadDpadRight = false;
    this.PreviousGamepadStart = false;
    this.PreviousGamepadBack = false;
    this.PreviousGamepadStickCycleDirection = 0;
  }
}
