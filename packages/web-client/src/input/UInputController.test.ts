import { describe, expect, it } from "vitest";

import { UInputController } from "./UInputController";

interface FInputControllerProbe {
  MouseDeltaX: number;
  MouseDeltaY: number;
  ComposeLookPitchDeltaDegrees: (GamepadLookY: number, DeltaSeconds: number) => number;
  ComposeAimScreenDelta: (
    GamepadLookAxis: { X: number; Y: number },
    DeltaSeconds: number
  ) => { X: number; Y: number };
}

function CreateControllerProbe(): FInputControllerProbe {
  return Object.create(UInputController.prototype) as FInputControllerProbe;
}

describe("UInputController", () => {
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
