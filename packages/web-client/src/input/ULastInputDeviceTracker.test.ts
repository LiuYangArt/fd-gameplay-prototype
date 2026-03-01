import { describe, expect, it } from "vitest";

import { EInputDeviceKinds } from "./EInputAction";
import { ULastInputDeviceTracker } from "./ULastInputDeviceTracker";

describe("ULastInputDeviceTracker", () => {
  it("应在防抖时间窗外切换最新输入设备", () => {
    const Tracker = new ULastInputDeviceTracker({ DeviceSwitchDebounceMs: 180 });
    expect(Tracker.GetActiveDevice()).toBe(EInputDeviceKinds.KeyboardMouse);

    const FirstSwitch = Tracker.RegisterInput(EInputDeviceKinds.Gamepad, 1000);
    expect(FirstSwitch).toBe(true);
    expect(Tracker.GetActiveDevice()).toBe(EInputDeviceKinds.Gamepad);

    const BlockedSwitch = Tracker.RegisterInput(EInputDeviceKinds.KeyboardMouse, 1100);
    expect(BlockedSwitch).toBe(false);
    expect(Tracker.GetActiveDevice()).toBe(EInputDeviceKinds.Gamepad);

    const AllowedSwitch = Tracker.RegisterInput(EInputDeviceKinds.KeyboardMouse, 1200);
    expect(AllowedSwitch).toBe(true);
    expect(Tracker.GetActiveDevice()).toBe(EInputDeviceKinds.KeyboardMouse);
  });
});
