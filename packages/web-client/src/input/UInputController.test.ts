import { describe, expect, it, vi } from "vitest";

import { UInputController } from "./UInputController";

interface FInputControllerProbe {
  MouseDeltaX: number;
  MouseDeltaY: number;
  PendingCancelAimEdge: boolean;
  PendingBattleFleeEdge: boolean;
  PendingCycleMenuAxis: number;
  WasPointerLockedToBattleViewport: boolean;
  ResolvePointerLockElement: () => HTMLElement | null;
  ShouldLockPointer: () => boolean;
  AttachPointerLockAsyncErrorLog: (Result: unknown, Prefix: string) => void;
  ComposeLookPitchDeltaDegrees: (GamepadLookY: number, DeltaSeconds: number) => number;
  ComposeAimScreenDelta: (
    GamepadLookAxis: { X: number; Y: number },
    DeltaSeconds: number
  ) => { X: number; Y: number };
  SyncPointerLockState: () => void;
}

function CreateControllerProbe(): FInputControllerProbe {
  return Object.create(UInputController.prototype) as FInputControllerProbe;
}

const PreviousGamepadBooleanKeys = [
  "PreviousGamepadA",
  "PreviousGamepadB",
  "PreviousGamepadLeftStick",
  "PreviousGamepadLB",
  "PreviousGamepadLT",
  "PreviousGamepadRT",
  "PreviousGamepadDpadUp",
  "PreviousGamepadDpadDown",
  "PreviousGamepadDpadLeft",
  "PreviousGamepadDpadRight",
  "PreviousGamepadStart",
  "PreviousGamepadBack",
  "PreviousGamepadRightStick"
] as const;

const PreviousGamepadNumberKeys = [
  "PreviousGamepadStickTargetDirection",
  "PreviousGamepadStickMenuDirection"
] as const;

function ResetGamepadPreviousState(Controller: Record<string, unknown>): void {
  for (const Key of PreviousGamepadBooleanKeys) {
    if (Key in Controller) {
      Controller[Key] = false;
    }
  }
  for (const Key of PreviousGamepadNumberKeys) {
    if (Key in Controller) {
      Controller[Key] = 0;
    }
  }
}

function CreateGamepadWithButtons(
  Buttons: Partial<Record<number, { pressed: boolean; value: number }>>
): Gamepad {
  return {
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from(
      { length: 16 },
      (_, Index) => Buttons[Index] ?? { pressed: false, value: 0 }
    )
  } as unknown as Gamepad;
}

function CreateGamepadWithAxes(Axes: number[]): Gamepad {
  return {
    connected: true,
    axes: Axes,
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }))
  } as unknown as Gamepad;
}

describe("UInputController", () => {
  it("输入绑定应在捕获阶段监听鼠标右键相关事件，避免画布层吞掉冒泡导致 RMB 切瞄准失效", () => {
    const OriginalWindow = (globalThis as { window?: Window }).window;
    const AddEventListener = vi.fn();
    const RemoveEventListener = vi.fn();
    const RequestAnimationFrame = vi.fn(() => 1);
    const CancelAnimationFrame = vi.fn();
    const FakeWindow = {
      addEventListener: AddEventListener,
      removeEventListener: RemoveEventListener,
      requestAnimationFrame: RequestAnimationFrame,
      cancelAnimationFrame: CancelAnimationFrame
    } as unknown as Window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: FakeWindow
    });

    try {
      const Controller = new UInputController(() => undefined);
      const Unbind = Controller.Bind();

      expect(AddEventListener).toHaveBeenCalledWith(
        "mousedown",
        expect.any(Function),
        expect.objectContaining({ capture: true })
      );
      expect(AddEventListener).toHaveBeenCalledWith(
        "contextmenu",
        expect.any(Function),
        expect.objectContaining({ capture: true })
      );

      Unbind();

      expect(RemoveEventListener).toHaveBeenCalledWith(
        "mousedown",
        expect.any(Function),
        expect.objectContaining({ capture: true })
      );
      expect(RemoveEventListener).toHaveBeenCalledWith(
        "contextmenu",
        expect.any(Function),
        expect.objectContaining({ capture: true })
      );
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        writable: true,
        value: OriginalWindow
      });
    }
  });

  it("浏览器支持 PointerEvent 时应优先监听 pointerdown，避免 mousedown 兼容事件被画布层抑制", () => {
    const OriginalWindow = (globalThis as { window?: Window }).window;
    const AddEventListener = vi.fn();
    const RemoveEventListener = vi.fn();
    const RequestAnimationFrame = vi.fn(() => 1);
    const CancelAnimationFrame = vi.fn();
    const FakeWindow = {
      addEventListener: AddEventListener,
      removeEventListener: RemoveEventListener,
      requestAnimationFrame: RequestAnimationFrame,
      cancelAnimationFrame: CancelAnimationFrame,
      PointerEvent: function PointerEvent() {}
    } as unknown as Window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: FakeWindow
    });

    try {
      const Controller = new UInputController(() => undefined);
      const Unbind = Controller.Bind();

      expect(AddEventListener).toHaveBeenCalledWith(
        "pointerdown",
        expect.any(Function),
        expect.objectContaining({ capture: true })
      );

      Unbind();

      expect(RemoveEventListener).toHaveBeenCalledWith(
        "pointerdown",
        expect.any(Function),
        expect.objectContaining({ capture: true })
      );
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        writable: true,
        value: OriginalWindow
      });
    }
  });

  it("瞄准态下 pointer lock 被 Esc 解除时应自动生成一次 CancelAimEdge，避免需要按两次 Esc", () => {
    const Probe = CreateControllerProbe();
    const PointerTarget = {} as HTMLElement;
    const OriginalDocument = (globalThis as { document?: Document }).document;
    const FakeDocument = {
      pointerLockElement: PointerTarget,
      exitPointerLock: vi.fn()
    } as unknown as Document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      writable: true,
      value: FakeDocument
    });

    try {
      Probe.PendingCancelAimEdge = false;
      Probe.WasPointerLockedToBattleViewport = false;
      Probe.ResolvePointerLockElement = () => PointerTarget;
      Probe.ShouldLockPointer = () => true;
      Probe.AttachPointerLockAsyncErrorLog = () => undefined;

      Probe.SyncPointerLockState();
      expect(Probe.WasPointerLockedToBattleViewport).toBe(true);
      expect(Probe.PendingCancelAimEdge).toBe(false);

      (FakeDocument as { pointerLockElement: Element | null }).pointerLockElement = null;
      Probe.SyncPointerLockState();
      expect(Probe.PendingCancelAimEdge).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        writable: true,
        value: OriginalDocument
      });
    }
  });

  it("战斗中按鼠标右键切瞄准时应请求指针锁定，避免鼠标边界导致横向旋转假限位", () => {
    const RequestPointerLock = vi.fn();
    const Controller = new UInputController(() => undefined, {
      ResolvePointerLockElement: () =>
        ({
          requestPointerLock: RequestPointerLock
        }) as unknown as HTMLElement,
      ShouldRequestPointerLockOnToggleAim: () => true
    });
    const MutableController = Controller as unknown as {
      HandleMouseDown: (Event: MouseEvent) => void;
    };

    MutableController.HandleMouseDown({
      button: 2,
      target: null,
      preventDefault: () => undefined
    } as MouseEvent);

    expect(RequestPointerLock).toHaveBeenCalledTimes(1);
  });

  it("输入层应输出未反转的俯仰增量（反转由运行时模式开关处理）", () => {
    const Probe = CreateControllerProbe();
    Probe.MouseDeltaX = 0;
    Probe.MouseDeltaY = 20;

    const Delta = Probe.ComposeLookPitchDeltaDegrees(0.5, 1);
    expect(Delta).toBeCloseTo(70.3, 4);
  });

  it("输入层应输出未反转的准星纵向屏幕增量", () => {
    const Probe = CreateControllerProbe();
    Probe.MouseDeltaX = 10;
    Probe.MouseDeltaY = 30;

    const AimDelta = Probe.ComposeAimScreenDelta({ X: 0.25, Y: 0.25 }, 0.5);
    expect(AimDelta.X).toBeCloseTo(75, 4);
    expect(AimDelta.Y).toBeCloseTo(95, 4);
  });

  it("战斗阶段按 C 应进入逃跑长按状态，且旧键位 F 不再触发逃跑边沿", () => {
    const Controller = new UInputController(() => undefined);
    const MutableController = Controller as unknown as {
      HandleKeyDown: (Event: KeyboardEvent) => void;
      PendingBattleFleeEdge: boolean;
      PressedKeys: Set<string>;
    };

    MutableController.PendingBattleFleeEdge = false;
    MutableController.HandleKeyDown({
      code: "KeyC",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);
    MutableController.HandleKeyDown({
      code: "KeyF",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);

    expect(MutableController.PressedKeys.has("KeyC")).toBe(true);
    expect(MutableController.PendingBattleFleeEdge).toBe(false);
  });

  it("键盘 F/Enter/Escape 应分别映射 Confirm/Cancel 语义边沿", () => {
    const Controller = new UInputController(() => undefined);
    const MutableController = Controller as unknown as {
      HandleKeyDown: (Event: KeyboardEvent) => void;
      PendingConfirmSettlementEdge: boolean;
      PendingCancelAimEdge: boolean;
    };

    MutableController.PendingConfirmSettlementEdge = false;
    MutableController.PendingCancelAimEdge = false;
    MutableController.HandleKeyDown({
      code: "KeyF",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);
    MutableController.HandleKeyDown({
      code: "Enter",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);
    MutableController.HandleKeyDown({
      code: "Escape",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);

    expect(MutableController.PendingConfirmSettlementEdge).toBe(true);
    expect(MutableController.PendingCancelAimEdge).toBe(true);
  });

  it("鼠标右键应映射 Battle.ToggleAim，左键应映射 Battle.Fire", () => {
    const Controller = new UInputController(() => undefined, {
      ShouldRequestPointerLockOnToggleAim: () => false,
      ResolveAimViewportRect: () =>
        ({
          left: 0,
          top: 0,
          width: 1000,
          height: 1000
        }) as DOMRect
    });
    const MutableController = Controller as unknown as {
      HandleMouseDown: (Event: MouseEvent) => void;
      PendingToggleAimEdge: boolean;
      PendingFireEdge: boolean;
      ShouldIgnoreMouseFire: (Target: EventTarget | null) => boolean;
    };

    MutableController.PendingToggleAimEdge = false;
    MutableController.PendingFireEdge = false;
    MutableController.ShouldIgnoreMouseFire = () => false;
    MutableController.HandleMouseDown({
      button: 2,
      target: null,
      clientX: 300,
      clientY: 200,
      preventDefault: () => undefined
    } as MouseEvent);
    MutableController.HandleMouseDown({
      button: 0,
      target: null,
      preventDefault: () => undefined,
      clientX: 300,
      clientY: 200
    } as MouseEvent);

    expect(MutableController.PendingToggleAimEdge).toBe(true);
    expect(MutableController.PendingFireEdge).toBe(true);
  });

  it("战斗输入仅应在 viewport 内响应 RMB：内部触发、外部忽略", () => {
    const Controller = new UInputController(() => undefined, {
      ShouldRequestPointerLockOnToggleAim: () => true,
      ResolveAimViewportRect: () =>
        ({
          left: 100,
          top: 50,
          width: 400,
          height: 300
        }) as DOMRect
    });
    const MutableController = Controller as unknown as {
      HandleMouseDown: (Event: MouseEvent) => void;
      PendingToggleAimEdge: boolean;
    };

    MutableController.PendingToggleAimEdge = false;
    MutableController.HandleMouseDown({
      button: 2,
      target: null,
      clientX: 180,
      clientY: 120,
      preventDefault: () => undefined
    } as MouseEvent);
    expect(MutableController.PendingToggleAimEdge).toBe(true);

    MutableController.PendingToggleAimEdge = false;
    MutableController.HandleMouseDown({
      button: 2,
      target: null,
      clientX: 20,
      clientY: 20,
      preventDefault: () => undefined
    } as MouseEvent);
    expect(MutableController.PendingToggleAimEdge).toBe(false);
  });

  it("右键即使落在忽略开火区域也应触发瞄准切换，避免提示存在但实际不生效", () => {
    const Controller = new UInputController(() => undefined, {
      ShouldRequestPointerLockOnToggleAim: () => true
    });
    const MutableController = Controller as unknown as {
      HandleMouseDown: (Event: MouseEvent) => void;
      PendingToggleAimEdge: boolean;
      ShouldIgnoreMouseFire: (Target: EventTarget | null) => boolean;
    };
    const PreventDefault = vi.fn();

    MutableController.PendingToggleAimEdge = false;
    MutableController.ShouldIgnoreMouseFire = () => true;
    MutableController.HandleMouseDown({
      button: 2,
      target: null,
      preventDefault: PreventDefault
    } as unknown as MouseEvent);

    expect(MutableController.PendingToggleAimEdge).toBe(true);
    expect(PreventDefault).toHaveBeenCalledTimes(1);
  });

  it("战斗输入上下文应拦截 contextmenu，避免右键触发浏览器菜单导致输入边沿丢失", () => {
    const Controller = new UInputController(() => undefined, {
      ShouldLockPointer: () => true
    });
    const MutableController = Controller as unknown as {
      HandleContextMenu: (Event: MouseEvent) => void;
    };
    const PreventDefault = vi.fn();

    MutableController.HandleContextMenu({
      preventDefault: PreventDefault
    } as unknown as MouseEvent);

    expect(PreventDefault).toHaveBeenCalledTimes(1);
  });

  it("Tab 进入跳过回合长按状态，但不应再触发旧菜单导航或即时切角色边沿", () => {
    const Controller = new UInputController(() => undefined);
    const MutableController = Controller as unknown as {
      HandleKeyDown: (Event: KeyboardEvent) => void;
      PendingCycleMenuAxis: number;
      PendingConfirmSettlementEdge: boolean;
      PendingCancelAimEdge: boolean;
      PendingSwitchCharacterEdge: boolean;
      PressedKeys: Set<string>;
    };

    MutableController.PendingCycleMenuAxis = 0;
    MutableController.PendingConfirmSettlementEdge = false;
    MutableController.PendingCancelAimEdge = false;
    MutableController.PendingSwitchCharacterEdge = false;
    MutableController.HandleKeyDown({
      code: "Tab",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);

    expect(MutableController.PressedKeys.has("Tab")).toBe(true);
    expect(MutableController.PendingCycleMenuAxis).toBe(0);
    expect(MutableController.PendingConfirmSettlementEdge).toBe(false);
    expect(MutableController.PendingCancelAimEdge).toBe(false);
    expect(MutableController.PendingSwitchCharacterEdge).toBe(false);
  });

  it("方向键与 W/S 应输出同一菜单切换轴", () => {
    const Controller = new UInputController(() => undefined);
    const MutableController = Controller as unknown as {
      HandleKeyDown: (Event: KeyboardEvent) => void;
      PendingCycleMenuAxis: number;
    };

    MutableController.PendingCycleMenuAxis = 0;
    MutableController.HandleKeyDown({
      code: "ArrowUp",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);
    expect(MutableController.PendingCycleMenuAxis).toBe(-1);

    MutableController.PendingCycleMenuAxis = 0;
    MutableController.HandleKeyDown({
      code: "ArrowDown",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);
    expect(MutableController.PendingCycleMenuAxis).toBe(1);

    MutableController.PendingCycleMenuAxis = 0;
    MutableController.HandleKeyDown({
      code: "KeyW",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);
    expect(MutableController.PendingCycleMenuAxis).toBe(-1);

    MutableController.PendingCycleMenuAxis = 0;
    MutableController.HandleKeyDown({
      code: "KeyS",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);
    expect(MutableController.PendingCycleMenuAxis).toBe(1);
  });

  it("方向键与 A/D 应输出同一目标切换轴", () => {
    const Controller = new UInputController(() => undefined);
    const MutableController = Controller as unknown as {
      HandleKeyDown: (Event: KeyboardEvent) => void;
      PendingCycleTargetAxis: number;
    };

    MutableController.PendingCycleTargetAxis = 0;
    MutableController.HandleKeyDown({
      code: "ArrowLeft",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);
    expect(MutableController.PendingCycleTargetAxis).toBe(-1);

    MutableController.PendingCycleTargetAxis = 0;
    MutableController.HandleKeyDown({
      code: "KeyA",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);
    expect(MutableController.PendingCycleTargetAxis).toBe(-1);

    MutableController.PendingCycleTargetAxis = 0;
    MutableController.HandleKeyDown({
      code: "ArrowRight",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);
    expect(MutableController.PendingCycleTargetAxis).toBe(1);

    MutableController.PendingCycleTargetAxis = 0;
    MutableController.HandleKeyDown({
      code: "KeyD",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);
    expect(MutableController.PendingCycleTargetAxis).toBe(1);
  });

  it("WASD 与方向键应输出等价移动轴", () => {
    const Controller = new UInputController(() => undefined);
    const MutableController = Controller as unknown as {
      HandleKeyDown: (Event: KeyboardEvent) => void;
      ReadKeyboardMoveAxis: () => { X: number; Y: number };
      PressedKeys: Set<string>;
    };

    MutableController.PressedKeys.clear();
    MutableController.HandleKeyDown({
      code: "KeyW",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);
    expect(MutableController.ReadKeyboardMoveAxis()).toEqual({ X: 0, Y: 1 });

    MutableController.PressedKeys.clear();
    MutableController.HandleKeyDown({
      code: "ArrowUp",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);
    expect(MutableController.ReadKeyboardMoveAxis()).toEqual({ X: 0, Y: 1 });

    MutableController.PressedKeys.clear();
    MutableController.HandleKeyDown({
      code: "KeyA",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);
    expect(MutableController.ReadKeyboardMoveAxis()).toEqual({ X: -1, Y: 0 });

    MutableController.PressedKeys.clear();
    MutableController.HandleKeyDown({
      code: "ArrowLeft",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);
    expect(MutableController.ReadKeyboardMoveAxis()).toEqual({ X: -1, Y: 0 });
  });

  it("手柄 L3/R3 应输出逃跑/跳过回合长按状态，D-Pad 上下应触发菜单切换轴", () => {
    const Controller = new UInputController(() => undefined);
    const MutableController = Controller as unknown as {
      GetActiveGamepad: () => Gamepad | null;
      ReadGamepadSnapshot: () => {
        BattleFleeHold: boolean;
        SwitchCharacterHold: boolean;
        CycleMenuAxis: number;
      };
      PreviousGamepadA: boolean;
      PreviousGamepadB: boolean;
      PreviousGamepadLeftStick: boolean;
      PreviousGamepadLB: boolean;
      PreviousGamepadLT: boolean;
      PreviousGamepadRT: boolean;
      PreviousGamepadDpadUp: boolean;
      PreviousGamepadDpadDown: boolean;
      PreviousGamepadDpadLeft: boolean;
      PreviousGamepadDpadRight: boolean;
      PreviousGamepadStart: boolean;
      PreviousGamepadBack: boolean;
      PreviousGamepadRightStick: boolean;
      PreviousGamepadStickTargetDirection: number;
      PreviousGamepadStickMenuDirection: number;
    };

    ResetGamepadPreviousState(MutableController as unknown as Record<string, unknown>);

    MutableController.GetActiveGamepad = () =>
      CreateGamepadWithButtons({
        10: { pressed: true, value: 1 },
        11: { pressed: true, value: 1 },
        12: { pressed: true, value: 1 }
      });
    const SnapshotUp = MutableController.ReadGamepadSnapshot();
    expect(SnapshotUp.BattleFleeHold).toBe(true);
    expect(SnapshotUp.SwitchCharacterHold).toBe(true);
    expect(SnapshotUp.CycleMenuAxis).toBe(-1);

    MutableController.GetActiveGamepad = () =>
      CreateGamepadWithButtons({
        10: { pressed: false, value: 0 },
        11: { pressed: false, value: 0 },
        13: { pressed: true, value: 1 }
      });
    const SnapshotDown = MutableController.ReadGamepadSnapshot();
    expect(SnapshotDown.BattleFleeHold).toBe(false);
    expect(SnapshotDown.SwitchCharacterHold).toBe(false);
    expect(SnapshotDown.CycleMenuAxis).toBe(1);
  });

  it("长按状态机应在达到阈值时只触发一次，并持续输出 0-1 进度", () => {
    const Probe = CreateControllerProbe() as FInputControllerProbe & {
      UpdateLongHoldTracker: (
        Tracker: { StartedAtMs: number | null; HasTriggered: boolean },
        IsHoldInputActive: boolean,
        TimestampMs: number,
        HoldDurationMs: number
      ) => { IsHeld: boolean; IsTriggered: boolean; ProgressNormalized: number };
    };
    const Tracker = {
      StartedAtMs: null as number | null,
      HasTriggered: false
    };

    const Started = Probe.UpdateLongHoldTracker(Tracker, true, 1000, 620);
    expect(Started.IsHeld).toBe(true);
    expect(Started.IsTriggered).toBe(false);
    expect(Started.ProgressNormalized).toBe(0);

    const Mid = Probe.UpdateLongHoldTracker(Tracker, true, 1310, 620);
    expect(Mid.IsTriggered).toBe(false);
    expect(Mid.ProgressNormalized).toBeGreaterThan(0);
    expect(Mid.ProgressNormalized).toBeLessThan(1);

    const Reached = Probe.UpdateLongHoldTracker(Tracker, true, 1620, 620);
    expect(Reached.IsTriggered).toBe(true);
    expect(Reached.ProgressNormalized).toBe(1);

    const Holding = Probe.UpdateLongHoldTracker(Tracker, true, 1740, 620);
    expect(Holding.IsTriggered).toBe(false);
    expect(Holding.ProgressNormalized).toBe(1);

    const Released = Probe.UpdateLongHoldTracker(Tracker, false, 1741, 620);
    expect(Released.IsHeld).toBe(false);
    expect(Released.ProgressNormalized).toBe(0);
  });

  it("手柄左摇杆上下应触发菜单切换轴（无需 D-Pad）", () => {
    const Controller = new UInputController(() => undefined);
    const MutableController = Controller as unknown as {
      GetActiveGamepad: () => Gamepad | null;
      ReadGamepadSnapshot: () => {
        CycleMenuAxis: number;
      };
      PreviousGamepadA: boolean;
      PreviousGamepadB: boolean;
      PreviousGamepadLB: boolean;
      PreviousGamepadLT: boolean;
      PreviousGamepadRT: boolean;
      PreviousGamepadDpadUp: boolean;
      PreviousGamepadDpadDown: boolean;
      PreviousGamepadDpadLeft: boolean;
      PreviousGamepadDpadRight: boolean;
      PreviousGamepadStart: boolean;
      PreviousGamepadBack: boolean;
      PreviousGamepadRightStick: boolean;
      PreviousGamepadStickTargetDirection: number;
      PreviousGamepadStickMenuDirection: number;
    };

    ResetGamepadPreviousState(MutableController as unknown as Record<string, unknown>);

    MutableController.GetActiveGamepad = () => CreateGamepadWithAxes([0, -1, 0, 0]);
    const SnapshotUp = MutableController.ReadGamepadSnapshot();
    expect(SnapshotUp.CycleMenuAxis).toBe(-1);

    MutableController.GetActiveGamepad = () => CreateGamepadWithAxes([0, 1, 0, 0]);
    const SnapshotDown = MutableController.ReadGamepadSnapshot();
    expect(SnapshotDown.CycleMenuAxis).toBe(1);
  });

  it("手柄 LT/B/A 应分别映射 ToggleAim/Cancel/Confirm 边沿", () => {
    const Controller = new UInputController(() => undefined);
    const MutableController = Controller as unknown as {
      GetActiveGamepad: () => Gamepad | null;
      ReadGamepadSnapshot: () => {
        ToggleAimEdge: boolean;
        CancelAimEdge: boolean;
        ConfirmSettlementEdge: boolean;
      };
      PreviousGamepadA: boolean;
      PreviousGamepadB: boolean;
      PreviousGamepadLB: boolean;
      PreviousGamepadLT: boolean;
      PreviousGamepadRT: boolean;
      PreviousGamepadDpadUp: boolean;
      PreviousGamepadDpadDown: boolean;
      PreviousGamepadDpadLeft: boolean;
      PreviousGamepadDpadRight: boolean;
      PreviousGamepadStart: boolean;
      PreviousGamepadBack: boolean;
      PreviousGamepadRightStick: boolean;
      PreviousGamepadStickTargetDirection: number;
      PreviousGamepadStickMenuDirection: number;
    };
    ResetGamepadPreviousState(MutableController as unknown as Record<string, unknown>);

    MutableController.GetActiveGamepad = () =>
      CreateGamepadWithButtons({
        0: { pressed: true, value: 1 },
        1: { pressed: true, value: 1 },
        6: { pressed: true, value: 1 }
      });

    const Snapshot = MutableController.ReadGamepadSnapshot();
    expect(Snapshot.ToggleAimEdge).toBe(true);
    expect(Snapshot.CancelAimEdge).toBe(true);
    expect(Snapshot.ConfirmSettlementEdge).toBe(true);
  });

  it("openworld 冲刺应映射 RT 按住，L3 不应触发 SprintHold", () => {
    const Controller = new UInputController(() => undefined);
    const MutableController = Controller as unknown as {
      GetActiveGamepad: () => Gamepad | null;
      ReadGamepadSnapshot: () => {
        SprintHold: boolean;
      };
      PreviousGamepadA: boolean;
      PreviousGamepadB: boolean;
      PreviousGamepadLB: boolean;
      PreviousGamepadLT: boolean;
      PreviousGamepadRT: boolean;
      PreviousGamepadDpadUp: boolean;
      PreviousGamepadDpadDown: boolean;
      PreviousGamepadDpadLeft: boolean;
      PreviousGamepadDpadRight: boolean;
      PreviousGamepadStart: boolean;
      PreviousGamepadBack: boolean;
      PreviousGamepadRightStick: boolean;
      PreviousGamepadStickTargetDirection: number;
      PreviousGamepadStickMenuDirection: number;
    };
    ResetGamepadPreviousState(MutableController as unknown as Record<string, unknown>);

    const ReadSprintHold = (
      Buttons: Partial<Record<number, { pressed: boolean; value: number }>>
    ): boolean => {
      MutableController.GetActiveGamepad = () => CreateGamepadWithButtons(Buttons);
      return MutableController.ReadGamepadSnapshot().SprintHold;
    };

    expect(
      ReadSprintHold({
        10: { pressed: true, value: 1 },
        7: { pressed: false, value: 0 }
      })
    ).toBe(false);
    expect(
      ReadSprintHold({
        10: { pressed: false, value: 0 },
        7: { pressed: true, value: 1 }
      })
    ).toBe(true);
  });
});
