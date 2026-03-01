import { EInputDeviceKinds, type EInputDeviceKind } from "./EInputAction";

interface FLastInputDeviceTrackerOptions {
  DeviceSwitchDebounceMs?: number;
}

export class ULastInputDeviceTracker {
  private readonly DeviceSwitchDebounceMs: number;
  private ActiveDevice: EInputDeviceKind;
  private LastSwitchAtMs: number;

  public constructor(Options?: FLastInputDeviceTrackerOptions) {
    this.DeviceSwitchDebounceMs = Math.max(Options?.DeviceSwitchDebounceMs ?? 180, 0);
    this.ActiveDevice = EInputDeviceKinds.KeyboardMouse;
    this.LastSwitchAtMs = 0;
  }

  public GetActiveDevice(): EInputDeviceKind {
    return this.ActiveDevice;
  }

  public RegisterInput(Device: EInputDeviceKind, TimestampMs: number): boolean {
    if (Device === this.ActiveDevice) {
      return false;
    }
    if (TimestampMs - this.LastSwitchAtMs < this.DeviceSwitchDebounceMs) {
      return false;
    }
    this.ActiveDevice = Device;
    this.LastSwitchAtMs = TimestampMs;
    return true;
  }

  public Reset(Device: EInputDeviceKind = EInputDeviceKinds.KeyboardMouse): void {
    this.ActiveDevice = Device;
    this.LastSwitchAtMs = 0;
  }
}
