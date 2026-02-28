import { describe, expect, it, vi } from "vitest";

import { UInputController } from "./UInputController";

interface FInputControllerProbe {
  MouseDeltaX: number;
  MouseDeltaY: number;
  PendingCancelAimEdge: boolean;
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
});
