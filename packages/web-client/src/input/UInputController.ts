import {
  EInputAction,
  EInputDeviceKinds,
  type EInputAction as FInputAction,
  type EInputDeviceKind
} from "./EInputAction";
import { CreateEmptyInputActionFrame, type FInputActionFrame } from "./FInputActionFrame";
import { UDefaultInputBindingProfile } from "./UInputBindingProfile";
import { ULastInputDeviceTracker } from "./ULastInputDeviceTracker";

import type { FInputSnapshot, FInputVector2 } from "./FInputSnapshot";

interface FGamepadSnapshot {
  MoveAxis: FInputVector2;
  LookAxis: FInputVector2;
  SprintHold: boolean;
  ToggleAimEdge: boolean;
  CancelAimEdge: boolean;
  FireEdge: boolean;
  SwitchCharacterEdge: boolean;
  SwitchCharacterHold: boolean;
  ToggleSkillTargetModeEdge: boolean;
  ToggleItemMenuEdge: boolean;
  CycleTargetAxis: number;
  CycleMenuAxis: number;
  ConfirmSettlementEdge: boolean;
  RestartEdge: boolean;
  ToggleDebugEdge: boolean;
  BattleFleeEdge: boolean;
  BattleFleeHold: boolean;
}

interface FGamepadButtonState {
  A: boolean;
  B: boolean;
  LeftStick: boolean;
  LB: boolean;
  LT: boolean;
  RT: boolean;
  DpadUp: boolean;
  DpadDown: boolean;
  DpadLeft: boolean;
  DpadRight: boolean;
  Start: boolean;
  Back: boolean;
  RightStick: boolean;
}

interface FLongHoldTracker {
  StartedAtMs: number | null;
  HasTriggered: boolean;
}

interface FLongHoldFrameState {
  IsHeld: boolean;
  IsTriggered: boolean;
  ProgressNormalized: number;
}

const MoveDeadzone = 0.16;
const LookDeadzone = 0.14;
const MouseYawDegreesPerPixel = 0.18;
const MousePitchDegreesPerPixel = 0.14;
const GamepadYawDegreesPerSecond = 180;
const GamepadPitchDegreesPerSecond = 135;
const GamepadAimPixelsPerSecond = 520;
const BattleFleeHoldDurationMs =
  UDefaultInputBindingProfile.ActionBindings[EInputAction.BattleFlee].HoldDurationMs ?? 620;
const BattleSwitchHoldDurationMs =
  UDefaultInputBindingProfile.ActionBindings[EInputAction.BattleSwitchCharacter].HoldDurationMs ??
  620;
const IgnoreFireInputSelector = '[data-ignore-fire-input="true"]';
const InteractiveInputSelector =
  "button, input, textarea, select, option, label, a, [role='button']";
const MouseInputCaptureOptions: AddEventListenerOptions = { capture: true };

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
  private readonly LastInputDeviceTracker: ULastInputDeviceTracker;
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
  private PendingBattleFleeEdge: boolean;
  private PendingCycleTargetAxis: number;
  private PendingCycleMenuAxis: number;
  private PendingForceSettlementEdge: boolean;
  private PendingConfirmSettlementEdge: boolean;
  private PendingRestartEdge: boolean;
  private PendingToggleDebugEdge: boolean;
  private WasPointerLockedToBattleViewport: boolean;
  private PreviousGamepadA: boolean;
  private PreviousGamepadB: boolean;
  private PreviousGamepadLB: boolean;
  private PreviousGamepadLT: boolean;
  private PreviousGamepadRT: boolean;
  private PreviousGamepadDpadUp: boolean;
  private PreviousGamepadDpadDown: boolean;
  private PreviousGamepadDpadLeft: boolean;
  private PreviousGamepadDpadRight: boolean;
  private PreviousGamepadStart: boolean;
  private PreviousGamepadBack: boolean;
  private PreviousGamepadLeftStick: boolean;
  private PreviousGamepadRightStick: boolean;
  private PreviousGamepadStickTargetDirection: number;
  private PreviousGamepadStickMenuDirection: number;
  private readonly BattleFleeHoldTracker: FLongHoldTracker;
  private readonly BattleSwitchHoldTracker: FLongHoldTracker;

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
    this.LastInputDeviceTracker = new ULastInputDeviceTracker({
      DeviceSwitchDebounceMs: UDefaultInputBindingProfile.DeviceSwitchDebounceMs
    });
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
    this.PendingBattleFleeEdge = false;
    this.PendingCycleTargetAxis = 0;
    this.PendingCycleMenuAxis = 0;
    this.PendingForceSettlementEdge = false;
    this.PendingConfirmSettlementEdge = false;
    this.PendingRestartEdge = false;
    this.PendingToggleDebugEdge = false;
    this.WasPointerLockedToBattleViewport = false;
    this.PreviousGamepadA = false;
    this.PreviousGamepadB = false;
    this.PreviousGamepadLB = false;
    this.PreviousGamepadLT = false;
    this.PreviousGamepadRT = false;
    this.PreviousGamepadDpadUp = false;
    this.PreviousGamepadDpadDown = false;
    this.PreviousGamepadDpadLeft = false;
    this.PreviousGamepadDpadRight = false;
    this.PreviousGamepadStart = false;
    this.PreviousGamepadBack = false;
    this.PreviousGamepadLeftStick = false;
    this.PreviousGamepadRightStick = false;
    this.PreviousGamepadStickTargetDirection = 0;
    this.PreviousGamepadStickMenuDirection = 0;
    this.BattleFleeHoldTracker = {
      StartedAtMs: null,
      HasTriggered: false
    };
    this.BattleSwitchHoldTracker = {
      StartedAtMs: null,
      HasTriggered: false
    };
  }

  public Bind(): () => void {
    const OnKeyDown = (Event: KeyboardEvent) => this.HandleKeyDown(Event);
    const OnKeyUp = (Event: KeyboardEvent) => this.HandleKeyUp(Event);
    const OnMouseMove = (Event: MouseEvent) => this.HandleMouseMove(Event);
    const OnPointerOrMouseDown: EventListener = (Event) =>
      this.HandleMouseDown(Event as MouseEvent);
    const OnContextMenu = (Event: MouseEvent) => this.HandleContextMenu(Event);
    const OnWindowBlur = () => this.HandleWindowBlur();
    const MouseDownEventName = this.ResolveMouseDownEventName();

    window.addEventListener("keydown", OnKeyDown);
    window.addEventListener("keyup", OnKeyUp);
    window.addEventListener("mousemove", OnMouseMove);
    window.addEventListener(MouseDownEventName, OnPointerOrMouseDown, MouseInputCaptureOptions);
    window.addEventListener("contextmenu", OnContextMenu, MouseInputCaptureOptions);
    window.addEventListener("blur", OnWindowBlur);
    this.StartLoop();

    return () => {
      window.removeEventListener("keydown", OnKeyDown);
      window.removeEventListener("keyup", OnKeyUp);
      window.removeEventListener("mousemove", OnMouseMove);
      window.removeEventListener(
        MouseDownEventName,
        OnPointerOrMouseDown,
        MouseInputCaptureOptions
      );
      window.removeEventListener("contextmenu", OnContextMenu, MouseInputCaptureOptions);
      window.removeEventListener("blur", OnWindowBlur);
      this.StopLoop();
    };
  }

  private ResolveMouseDownEventName(): "pointerdown" | "mousedown" {
    if (typeof window !== "undefined" && typeof window.PointerEvent !== "undefined") {
      return "pointerdown";
    }
    return "mousedown";
  }

  private StartLoop(): void {
    // 采样主循环会聚合设备输入、边沿与长按状态，逻辑不可避免较集中。
    // eslint-disable-next-line complexity
    const Tick = (Timestamp: number) => {
      const DeltaSeconds = this.ResolveDeltaSeconds(Timestamp);
      this.SyncPointerLockState();
      const GamepadSnapshot = this.ReadGamepadSnapshot();
      const NowMs = performance.now();
      const KeyboardMoveAxis = this.ReadKeyboardMoveAxis();
      const MoveAxis = this.NormalizeAxis(
        KeyboardMoveAxis.X + GamepadSnapshot.MoveAxis.X,
        KeyboardMoveAxis.Y + GamepadSnapshot.MoveAxis.Y
      );
      const IsKeyboardFleeHold = this.PressedKeys.has("KeyC");
      const IsKeyboardSwitchHold = this.PressedKeys.has("Tab");
      const BattleFleeHoldState = this.UpdateLongHoldTracker(
        this.BattleFleeHoldTracker,
        IsKeyboardFleeHold || GamepadSnapshot.BattleFleeHold,
        NowMs,
        BattleFleeHoldDurationMs
      );
      const BattleSwitchHoldState = this.UpdateLongHoldTracker(
        this.BattleSwitchHoldTracker,
        IsKeyboardSwitchHold || GamepadSnapshot.SwitchCharacterHold,
        NowMs,
        BattleSwitchHoldDurationMs
      );

      const CycleTargetAxis = this.ResolveCycleTargetAxis(GamepadSnapshot.CycleTargetAxis);
      const CycleMenuAxis = this.ResolveCycleMenuAxis(GamepadSnapshot.CycleMenuAxis);
      const ToggleAimEdge = this.PendingToggleAimEdge || GamepadSnapshot.ToggleAimEdge;
      const CancelEdge = this.PendingCancelAimEdge || GamepadSnapshot.CancelAimEdge;
      const FireEdge = this.PendingFireEdge || GamepadSnapshot.FireEdge;
      const SwitchCharacterEdge =
        this.PendingSwitchCharacterEdge ||
        GamepadSnapshot.SwitchCharacterEdge ||
        BattleSwitchHoldState.IsTriggered;
      const ConfirmEdge =
        this.PendingConfirmSettlementEdge || GamepadSnapshot.ConfirmSettlementEdge;
      const RestartEdge = this.PendingRestartEdge || GamepadSnapshot.RestartEdge;
      const ToggleDebugEdge = this.PendingToggleDebugEdge || GamepadSnapshot.ToggleDebugEdge;
      const BattleFleeEdge =
        this.PendingBattleFleeEdge ||
        GamepadSnapshot.BattleFleeEdge ||
        BattleFleeHoldState.IsTriggered;
      const BattleFleeSourceDevice = this.ResolveHoldSourceDevice(
        IsKeyboardFleeHold,
        GamepadSnapshot.BattleFleeHold
      );
      const BattleSwitchSourceDevice = this.ResolveHoldSourceDevice(
        IsKeyboardSwitchHold,
        GamepadSnapshot.SwitchCharacterHold
      );
      const ActionFrame = this.BuildActionFrame({
        ToggleAimEdge,
        CancelEdge,
        FireEdge,
        SwitchCharacterEdge,
        SwitchCharacterHold: BattleSwitchHoldState.IsHeld,
        SwitchCharacterHoldProgress: BattleSwitchHoldState.ProgressNormalized,
        SwitchCharacterSourceDevice: BattleSwitchSourceDevice,
        BattleFleeEdge,
        BattleFleeHold: BattleFleeHoldState.IsHeld,
        BattleFleeHoldProgress: BattleFleeHoldState.ProgressNormalized,
        BattleFleeSourceDevice,
        ConfirmEdge,
        RestartEdge,
        ToggleDebugEdge,
        ForceSettlementEdge: this.PendingForceSettlementEdge,
        CycleTargetAxis,
        CycleMenuAxis
      });
      const Snapshot: FInputSnapshot = {
        ActiveInputDevice: this.LastInputDeviceTracker.GetActiveDevice(),
        ActionFrame,
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
        ToggleAimEdge,
        CancelAimEdge: CancelEdge,
        FireEdge,
        SwitchCharacterEdge,
        ToggleSkillTargetModeEdge: false,
        ToggleItemMenuEdge: false,
        CycleTargetAxis,
        CycleMenuAxis,
        ForceSettlementEdge: this.PendingForceSettlementEdge,
        ConfirmSettlementEdge: ConfirmEdge,
        RestartEdge,
        ToggleDebugEdge,
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
    if (
      Event.code === "ArrowUp" ||
      Event.code === "ArrowDown" ||
      Event.code === "ArrowLeft" ||
      Event.code === "ArrowRight" ||
      Event.code === "F3" ||
      Event.code === "Tab"
    ) {
      Event.preventDefault();
    }

    if (this.IsStateKey(Event.code)) {
      this.PressedKeys.add(Event.code);
    }
    this.LastInputDeviceTracker.RegisterInput(EInputDeviceKinds.KeyboardMouse, performance.now());

    if (Event.repeat) {
      return;
    }

    if (Event.code === "KeyS" && Event.altKey) {
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
    if (Math.abs(Event.movementX) + Math.abs(Event.movementY) > 0.5) {
      this.LastInputDeviceTracker.RegisterInput(EInputDeviceKinds.KeyboardMouse, performance.now());
    }
  }

  private HandleMouseDown(Event: MouseEvent): void {
    const IsInBattleViewport = this.IsMouseEventInBattleViewport(Event);
    const ShouldIgnoreFire = this.ShouldIgnoreMouseFire(Event.target);
    const IsBattleInputContext = this.IsBattleInputContext();
    if (Event.button === 2) {
      if (!IsInBattleViewport) {
        return;
      }
      if (IsBattleInputContext) {
        Event.preventDefault();
      }
      if (this.ShouldRequestPointerLockOnToggleAim()) {
        this.TryRequestPointerLock();
      }
      this.PendingToggleAimEdge = true;
      this.LastInputDeviceTracker.RegisterInput(EInputDeviceKinds.KeyboardMouse, performance.now());
      return;
    }

    if (!IsInBattleViewport) {
      return;
    }
    if (Event.button === 0 && this.ShouldLockPointer() && !ShouldIgnoreFire) {
      this.TryRequestPointerLock();
    }
    if (Event.button !== 0 || ShouldIgnoreFire) {
      return;
    }
    this.PendingAimScreenPosition = this.ResolveAimScreenPosition(Event.clientX, Event.clientY);
    this.PendingFireEdge = true;
    this.LastInputDeviceTracker.RegisterInput(EInputDeviceKinds.KeyboardMouse, performance.now());
  }

  private HandleContextMenu(Event: MouseEvent): void {
    if (this.IsBattleInputContext() && this.IsMouseEventInBattleViewport(Event)) {
      Event.preventDefault();
    }
  }

  private IsBattleInputContext(): boolean {
    return this.ShouldRequestPointerLockOnToggleAim() || this.ShouldLockPointer();
  }

  private IsMouseEventInBattleViewport(Event: MouseEvent): boolean {
    const ViewportRect = this.ResolveAimViewportRect();
    if (!ViewportRect) {
      return true;
    }
    if (!Number.isFinite(Event.clientX) || !Number.isFinite(Event.clientY)) {
      return true;
    }
    const Right = ViewportRect.left + ViewportRect.width;
    const Bottom = ViewportRect.top + ViewportRect.height;
    return (
      Event.clientX >= ViewportRect.left &&
      Event.clientX <= Right &&
      Event.clientY >= ViewportRect.top &&
      Event.clientY <= Bottom
    );
  }

  private HandleWindowBlur(): void {
    this.PressedKeys.clear();
    this.MouseDeltaX = 0;
    this.MouseDeltaY = 0;
    this.PendingAimScreenPosition = null;
    this.ClearFrameEdges();
    this.ResetLongHoldTrackers();
    this.ResetGamepadEdges();
    this.LastInputDeviceTracker.Reset();
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
    const StickTargetAxis = this.ReadGamepadStickTargetAxis(ActiveGamepad);
    const StickMenuAxis = this.ReadGamepadStickMenuAxis(ActiveGamepad);
    const DpadCycleAxis = this.ResolveDpadCycleAxis(Buttons);
    const DpadMenuAxis = this.ResolveDpadMenuAxis(Buttons);
    const CycleTargetAxis = DpadCycleAxis !== 0 ? DpadCycleAxis : StickTargetAxis;
    const CycleMenuAxis = DpadMenuAxis !== 0 ? DpadMenuAxis : StickMenuAxis;
    const Snapshot = this.BuildGamepadSnapshot(
      ActiveGamepad,
      Buttons,
      CycleTargetAxis,
      CycleMenuAxis
    );

    if (this.IsGamepadSnapshotActive(Snapshot)) {
      this.LastInputDeviceTracker.RegisterInput(EInputDeviceKinds.Gamepad, performance.now());
    }

    this.UpdatePreviousGamepadButtons(Buttons);

    return Snapshot;
  }

  private BuildGamepadSnapshot(
    ActiveGamepad: Gamepad,
    Buttons: FGamepadButtonState,
    CycleTargetAxis: number,
    CycleMenuAxis: number
  ): FGamepadSnapshot {
    return {
      MoveAxis: this.ReadGamepadMoveAxis(ActiveGamepad),
      LookAxis: this.ReadGamepadLookAxis(ActiveGamepad),
      SprintHold: Buttons.RT,
      ToggleAimEdge: this.ResolvePressedEdge(Buttons.LT, this.PreviousGamepadLT),
      CancelAimEdge: this.ResolvePressedEdge(Buttons.B, this.PreviousGamepadB),
      FireEdge: this.ResolvePressedEdge(Buttons.RT, this.PreviousGamepadRT),
      SwitchCharacterEdge: false,
      SwitchCharacterHold: Buttons.RightStick,
      ToggleSkillTargetModeEdge: false,
      ToggleItemMenuEdge: false,
      CycleTargetAxis,
      CycleMenuAxis,
      ConfirmSettlementEdge: this.ResolvePressedEdge(Buttons.A, this.PreviousGamepadA),
      RestartEdge: this.ResolvePressedEdge(Buttons.Start, this.PreviousGamepadStart),
      ToggleDebugEdge: this.ResolvePressedEdge(Buttons.Back, this.PreviousGamepadBack),
      BattleFleeEdge: false,
      BattleFleeHold: Buttons.LeftStick
    };
  }

  private IsGamepadSnapshotActive(Snapshot: FGamepadSnapshot): boolean {
    const EdgeTriggeredFlags = [
      Snapshot.ToggleAimEdge,
      Snapshot.CancelAimEdge,
      Snapshot.FireEdge,
      Snapshot.SwitchCharacterEdge,
      Snapshot.SwitchCharacterHold,
      Snapshot.CycleTargetAxis !== 0,
      Snapshot.CycleMenuAxis !== 0,
      Snapshot.ConfirmSettlementEdge,
      Snapshot.RestartEdge,
      Snapshot.ToggleDebugEdge,
      Snapshot.BattleFleeEdge,
      Snapshot.BattleFleeHold
    ];
    if (EdgeTriggeredFlags.some((IsTriggered) => IsTriggered)) {
      return true;
    }

    const AxisMagnitudes = [
      Math.abs(Snapshot.MoveAxis.X),
      Math.abs(Snapshot.MoveAxis.Y),
      Math.abs(Snapshot.LookAxis.X),
      Math.abs(Snapshot.LookAxis.Y)
    ];
    return AxisMagnitudes.some((Magnitude) => Magnitude > 0.05);
  }

  private UpdatePreviousGamepadButtons(Buttons: FGamepadButtonState): void {
    this.PreviousGamepadA = Buttons.A;
    this.PreviousGamepadB = Buttons.B;
    this.PreviousGamepadLB = Buttons.LB;
    this.PreviousGamepadLT = Buttons.LT;
    this.PreviousGamepadRT = Buttons.RT;
    this.PreviousGamepadDpadUp = Buttons.DpadUp;
    this.PreviousGamepadDpadDown = Buttons.DpadDown;
    this.PreviousGamepadDpadLeft = Buttons.DpadLeft;
    this.PreviousGamepadDpadRight = Buttons.DpadRight;
    this.PreviousGamepadStart = Buttons.Start;
    this.PreviousGamepadBack = Buttons.Back;
    this.PreviousGamepadLeftStick = Buttons.LeftStick;
    this.PreviousGamepadRightStick = Buttons.RightStick;
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
      SwitchCharacterHold: false,
      ToggleSkillTargetModeEdge: false,
      ToggleItemMenuEdge: false,
      CycleTargetAxis: 0,
      CycleMenuAxis: 0,
      ConfirmSettlementEdge: false,
      RestartEdge: false,
      ToggleDebugEdge: false,
      BattleFleeEdge: false,
      BattleFleeHold: false
    };
  }

  private ReadGamepadButtonState(Pad: Gamepad): FGamepadButtonState {
    const LTValue = this.ReadGamepadButtonValue(Pad, 6);
    const RTValue = this.ReadGamepadButtonValue(Pad, 7);
    return {
      A: this.ReadGamepadButtonPressed(Pad, 0),
      B: this.ReadGamepadButtonPressed(Pad, 1),
      LeftStick: this.ReadGamepadButtonPressed(Pad, 10),
      LB: this.ReadGamepadButtonPressed(Pad, 4),
      LT: LTValue > 0.5,
      RT: RTValue > 0.35,
      DpadUp: this.ReadGamepadButtonPressed(Pad, 12),
      DpadDown: this.ReadGamepadButtonPressed(Pad, 13),
      DpadLeft: this.ReadGamepadButtonPressed(Pad, 14),
      DpadRight: this.ReadGamepadButtonPressed(Pad, 15),
      Start: this.ReadGamepadButtonPressed(Pad, 9),
      Back: this.ReadGamepadButtonPressed(Pad, 8),
      RightStick: this.ReadGamepadButtonPressed(Pad, 11)
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

  private ReadGamepadStickTargetAxis(Pad: Gamepad): number {
    const StickX = Pad.axes[0] ?? 0;
    const DigitalDirection =
      StickX >= UDefaultInputBindingProfile.StickDigitalThreshold
        ? 1
        : StickX <= -UDefaultInputBindingProfile.StickDigitalThreshold
          ? -1
          : 0;
    const IsRisingEdge =
      DigitalDirection !== 0 && DigitalDirection !== this.PreviousGamepadStickTargetDirection;
    this.PreviousGamepadStickTargetDirection = DigitalDirection;
    return IsRisingEdge ? DigitalDirection : 0;
  }

  private ReadGamepadStickMenuAxis(Pad: Gamepad): number {
    const StickY = -(Pad.axes[1] ?? 0);
    const DigitalDirection =
      StickY >= UDefaultInputBindingProfile.StickDigitalThreshold
        ? -1
        : StickY <= -UDefaultInputBindingProfile.StickDigitalThreshold
          ? 1
          : 0;
    const IsRisingEdge =
      DigitalDirection !== 0 && DigitalDirection !== this.PreviousGamepadStickMenuDirection;
    this.PreviousGamepadStickMenuDirection = DigitalDirection;
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
      Escape: () => {
        this.PendingCancelAimEdge = true;
      },
      Enter: () => {
        this.PendingConfirmSettlementEdge = true;
      },
      KeyF: () => {
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
      ArrowUp: () => {
        this.PendingCycleMenuAxis = -1;
      },
      ArrowRight: () => {
        this.PendingCycleTargetAxis = 1;
      },
      KeyD: () => {
        this.PendingCycleTargetAxis = 1;
      },
      ArrowDown: () => {
        this.PendingCycleMenuAxis = 1;
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
      Code === "KeyC" ||
      Code === "Tab" ||
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

  private UpdateLongHoldTracker(
    Tracker: FLongHoldTracker,
    IsHoldInputActive: boolean,
    TimestampMs: number,
    HoldDurationMs: number
  ): FLongHoldFrameState {
    if (!IsHoldInputActive) {
      Tracker.StartedAtMs = null;
      Tracker.HasTriggered = false;
      return {
        IsHeld: false,
        IsTriggered: false,
        ProgressNormalized: 0
      };
    }

    if (Tracker.StartedAtMs === null) {
      Tracker.StartedAtMs = TimestampMs;
      Tracker.HasTriggered = false;
    }
    const SafeDurationMs = Math.max(HoldDurationMs, 1);
    const ElapsedMs = Math.max(TimestampMs - Tracker.StartedAtMs, 0);
    const ProgressNormalized = this.Clamp(ElapsedMs / SafeDurationMs, 0, 1);
    const IsTriggered = !Tracker.HasTriggered && ElapsedMs >= SafeDurationMs;
    if (IsTriggered) {
      Tracker.HasTriggered = true;
    }

    return {
      IsHeld: true,
      IsTriggered,
      ProgressNormalized
    };
  }

  private ResolveHoldSourceDevice(
    IsKeyboardHold: boolean,
    IsGamepadHold: boolean
  ): EInputDeviceKind {
    if (IsKeyboardHold && !IsGamepadHold) {
      return EInputDeviceKinds.KeyboardMouse;
    }
    if (IsGamepadHold && !IsKeyboardHold) {
      return EInputDeviceKinds.Gamepad;
    }
    return this.LastInputDeviceTracker.GetActiveDevice();
  }

  private BuildActionFrame(Input: {
    ToggleAimEdge: boolean;
    CancelEdge: boolean;
    FireEdge: boolean;
    SwitchCharacterEdge: boolean;
    SwitchCharacterHold: boolean;
    SwitchCharacterHoldProgress: number;
    SwitchCharacterSourceDevice: EInputDeviceKind;
    BattleFleeEdge: boolean;
    BattleFleeHold: boolean;
    BattleFleeHoldProgress: number;
    BattleFleeSourceDevice: EInputDeviceKind;
    ConfirmEdge: boolean;
    RestartEdge: boolean;
    ToggleDebugEdge: boolean;
    ForceSettlementEdge: boolean;
    CycleTargetAxis: number;
    CycleMenuAxis: number;
  }): FInputActionFrame {
    const Frame = CreateEmptyInputActionFrame();

    const AddAction = (
      Action: FInputAction,
      IsTriggered: boolean,
      SourceDevice: EInputDeviceKind,
      Axis = 1,
      IsHeld = IsTriggered
    ) => {
      if (!IsTriggered && !IsHeld) {
        return;
      }
      Frame.Actions[Action] = {
        IsTriggered,
        IsHeld,
        Axis,
        SourceDevice
      };
      if (IsTriggered) {
        Frame.TriggeredActions.push(Action);
      }
      if (IsHeld) {
        Frame.HeldActions.push(Action);
      }
    };

    AddAction(
      EInputAction.BattleToggleAim,
      Input.ToggleAimEdge,
      this.LastInputDeviceTracker.GetActiveDevice()
    );
    AddAction(
      EInputAction.UICancel,
      Input.CancelEdge,
      this.LastInputDeviceTracker.GetActiveDevice()
    );
    AddAction(
      EInputAction.BattleFire,
      Input.FireEdge,
      this.LastInputDeviceTracker.GetActiveDevice()
    );
    AddAction(
      EInputAction.BattleSwitchCharacter,
      Input.SwitchCharacterEdge,
      Input.SwitchCharacterSourceDevice,
      Input.SwitchCharacterHoldProgress,
      Input.SwitchCharacterHold
    );
    AddAction(
      EInputAction.BattleFlee,
      Input.BattleFleeEdge,
      Input.BattleFleeSourceDevice,
      Input.BattleFleeHoldProgress,
      Input.BattleFleeHold
    );
    AddAction(
      EInputAction.UIConfirm,
      Input.ConfirmEdge,
      this.LastInputDeviceTracker.GetActiveDevice()
    );
    AddAction(
      EInputAction.SystemRestart,
      Input.RestartEdge,
      this.LastInputDeviceTracker.GetActiveDevice()
    );
    AddAction(
      EInputAction.SystemToggleDebug,
      Input.ToggleDebugEdge,
      this.LastInputDeviceTracker.GetActiveDevice()
    );
    AddAction(
      EInputAction.SystemForceSettlement,
      Input.ForceSettlementEdge,
      this.LastInputDeviceTracker.GetActiveDevice()
    );

    if (Input.CycleTargetAxis < 0) {
      AddAction(EInputAction.UINavLeft, true, this.LastInputDeviceTracker.GetActiveDevice(), -1);
    } else if (Input.CycleTargetAxis > 0) {
      AddAction(EInputAction.UINavRight, true, this.LastInputDeviceTracker.GetActiveDevice(), 1);
    }
    if (Input.CycleMenuAxis < 0) {
      AddAction(EInputAction.UINavUp, true, this.LastInputDeviceTracker.GetActiveDevice(), -1);
    } else if (Input.CycleMenuAxis > 0) {
      AddAction(EInputAction.UINavDown, true, this.LastInputDeviceTracker.GetActiveDevice(), 1);
    }

    return Frame;
  }

  private ShouldIgnoreMouseFire(Target: EventTarget | null): boolean {
    if (typeof Element === "undefined" || !(Target instanceof Element)) {
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
    this.PendingBattleFleeEdge = false;
    this.PendingCycleTargetAxis = 0;
    this.PendingCycleMenuAxis = 0;
    this.PendingForceSettlementEdge = false;
    this.PendingConfirmSettlementEdge = false;
    this.PendingRestartEdge = false;
    this.PendingToggleDebugEdge = false;
  }

  private ResetLongHoldTrackers(): void {
    this.BattleFleeHoldTracker.StartedAtMs = null;
    this.BattleFleeHoldTracker.HasTriggered = false;
    this.BattleSwitchHoldTracker.StartedAtMs = null;
    this.BattleSwitchHoldTracker.HasTriggered = false;
  }

  private ResetGamepadEdges(): void {
    this.PreviousGamepadA = false;
    this.PreviousGamepadB = false;
    this.PreviousGamepadLB = false;
    this.PreviousGamepadLT = false;
    this.PreviousGamepadRT = false;
    this.PreviousGamepadDpadUp = false;
    this.PreviousGamepadDpadDown = false;
    this.PreviousGamepadDpadLeft = false;
    this.PreviousGamepadDpadRight = false;
    this.PreviousGamepadStart = false;
    this.PreviousGamepadBack = false;
    this.PreviousGamepadLeftStick = false;
    this.PreviousGamepadRightStick = false;
    this.PreviousGamepadStickTargetDirection = 0;
    this.PreviousGamepadStickMenuDirection = 0;
  }
}
