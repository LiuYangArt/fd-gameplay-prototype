import { describe, expect, it, vi } from "vitest";

import { UInputController } from "./UInputController";

interface FInputControllerProbe {
  MouseDeltaX: number;
  MouseDeltaY: number;
  PendingCancelAimEdge: boolean;
  PendingToggleItemMenuEdge: boolean;
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

describe("UInputController", () => {
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

  it("战斗中按 Q 进入瞄准时应请求指针锁定，避免鼠标边界导致横向旋转假限位", () => {
    const RequestPointerLock = vi.fn();
    const Controller = new UInputController(() => undefined, {
      ResolvePointerLockElement: () =>
        ({
          requestPointerLock: RequestPointerLock
        }) as unknown as HTMLElement,
      ShouldRequestPointerLockOnToggleAim: () => true
    });
    const MutableController = Controller as unknown as {
      HandleKeyDown: (Event: KeyboardEvent) => void;
    };

    MutableController.HandleKeyDown({
      code: "KeyQ",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);

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

  it("战斗阶段按 W 应触发物品菜单边沿输入", () => {
    const Controller = new UInputController(() => undefined);
    const MutableController = Controller as unknown as {
      HandleKeyDown: (Event: KeyboardEvent) => void;
      PendingToggleItemMenuEdge: boolean;
    };

    MutableController.PendingToggleItemMenuEdge = false;
    MutableController.HandleKeyDown({
      code: "KeyW",
      altKey: false,
      repeat: false,
      preventDefault: () => undefined
    } as KeyboardEvent);

    expect(MutableController.PendingToggleItemMenuEdge).toBe(true);
  });

  it("方向键上下应输出菜单切换轴", () => {
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
  });

  it("手柄 Y 应触发物品菜单边沿，D-Pad 上下应触发菜单切换轴", () => {
    const Controller = new UInputController(() => undefined);
    const MutableController = Controller as unknown as {
      GetActiveGamepad: () => Gamepad | null;
      ReadGamepadSnapshot: () => {
        ToggleItemMenuEdge: boolean;
        CycleMenuAxis: number;
      };
      PreviousGamepadA: boolean;
      PreviousGamepadB: boolean;
      PreviousGamepadY: boolean;
      PreviousGamepadLB: boolean;
      PreviousGamepadRB: boolean;
      PreviousGamepadLT: boolean;
      PreviousGamepadRT: boolean;
      PreviousGamepadDpadUp: boolean;
      PreviousGamepadDpadDown: boolean;
      PreviousGamepadDpadLeft: boolean;
      PreviousGamepadDpadRight: boolean;
      PreviousGamepadStart: boolean;
      PreviousGamepadBack: boolean;
      PreviousGamepadStickCycleDirection: number;
    };

    const CreateGamepad = (Buttons: Partial<Record<number, { pressed: boolean; value: number }>>) =>
      ({
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: Array.from(
          { length: 16 },
          (_, Index) => Buttons[Index] ?? { pressed: false, value: 0 }
        )
      }) as unknown as Gamepad;

    MutableController.PreviousGamepadA = false;
    MutableController.PreviousGamepadB = false;
    MutableController.PreviousGamepadY = false;
    MutableController.PreviousGamepadLB = false;
    MutableController.PreviousGamepadRB = false;
    MutableController.PreviousGamepadLT = false;
    MutableController.PreviousGamepadRT = false;
    MutableController.PreviousGamepadDpadUp = false;
    MutableController.PreviousGamepadDpadDown = false;
    MutableController.PreviousGamepadDpadLeft = false;
    MutableController.PreviousGamepadDpadRight = false;
    MutableController.PreviousGamepadStart = false;
    MutableController.PreviousGamepadBack = false;
    MutableController.PreviousGamepadStickCycleDirection = 0;

    MutableController.GetActiveGamepad = () =>
      CreateGamepad({
        3: { pressed: true, value: 1 },
        12: { pressed: true, value: 1 }
      });
    const SnapshotUp = MutableController.ReadGamepadSnapshot();
    expect(SnapshotUp.ToggleItemMenuEdge).toBe(true);
    expect(SnapshotUp.CycleMenuAxis).toBe(-1);

    MutableController.GetActiveGamepad = () =>
      CreateGamepad({
        3: { pressed: false, value: 0 },
        13: { pressed: true, value: 1 }
      });
    const SnapshotDown = MutableController.ReadGamepadSnapshot();
    expect(SnapshotDown.CycleMenuAxis).toBe(1);
  });
});
