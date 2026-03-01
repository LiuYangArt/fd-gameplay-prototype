import { EInputAction, type EInputAction as FInputAction } from "./EInputAction";

export interface FKeyboardKeyBinding {
  Code: string;
  Alt?: boolean;
  Ctrl?: boolean;
  Shift?: boolean;
  Meta?: boolean;
}

export interface FInputActionBinding {
  KeyboardKeys: FKeyboardKeyBinding[];
  MouseButtons: number[];
  GamepadButtons: number[];
  GamepadAxisButtons: Array<{
    AxisIndex: number;
    Threshold: number;
    Direction: "Positive" | "Negative";
  }>;
  HoldDurationMs?: number;
}

export interface FInputBindingProfile {
  Name: string;
  DeviceSwitchDebounceMs: number;
  StickDigitalThreshold: number;
  ActionBindings: Record<FInputAction, FInputActionBinding>;
}

function CreateActionBinding(Partial?: Partial<FInputActionBinding>): FInputActionBinding {
  return {
    KeyboardKeys: Partial?.KeyboardKeys ?? [],
    MouseButtons: Partial?.MouseButtons ?? [],
    GamepadButtons: Partial?.GamepadButtons ?? [],
    GamepadAxisButtons: Partial?.GamepadAxisButtons ?? []
  };
}

export const UDefaultInputBindingProfile: FInputBindingProfile = {
  Name: "Default.ConsolePc.V1",
  DeviceSwitchDebounceMs: 180,
  StickDigitalThreshold: 0.55,
  ActionBindings: {
    [EInputAction.UIConfirm]: CreateActionBinding({
      KeyboardKeys: [{ Code: "Enter" }],
      MouseButtons: [0],
      GamepadButtons: [0]
    }),
    [EInputAction.UICancel]: CreateActionBinding({
      KeyboardKeys: [{ Code: "Escape" }],
      GamepadButtons: [1]
    }),
    [EInputAction.UINavUp]: CreateActionBinding({
      KeyboardKeys: [{ Code: "ArrowUp" }],
      GamepadButtons: [12]
    }),
    [EInputAction.UINavDown]: CreateActionBinding({
      KeyboardKeys: [{ Code: "ArrowDown" }],
      GamepadButtons: [13]
    }),
    [EInputAction.UINavLeft]: CreateActionBinding({
      KeyboardKeys: [{ Code: "ArrowLeft" }],
      GamepadButtons: [14]
    }),
    [EInputAction.UINavRight]: CreateActionBinding({
      KeyboardKeys: [{ Code: "ArrowRight" }],
      GamepadButtons: [15]
    }),
    [EInputAction.BattleToggleAim]: CreateActionBinding({
      MouseButtons: [2],
      GamepadAxisButtons: [{ AxisIndex: 6, Threshold: 0.5, Direction: "Positive" }]
    }),
    [EInputAction.BattleFire]: CreateActionBinding({
      MouseButtons: [0],
      GamepadAxisButtons: [{ AxisIndex: 7, Threshold: 0.35, Direction: "Positive" }]
    }),
    [EInputAction.BattleSwitchCharacter]: CreateActionBinding({
      KeyboardKeys: [{ Code: "Tab" }],
      GamepadButtons: [11],
      HoldDurationMs: 620
    }),
    [EInputAction.BattleFlee]: CreateActionBinding({
      KeyboardKeys: [{ Code: "KeyC" }],
      GamepadButtons: [10],
      HoldDurationMs: 620
    }),
    [EInputAction.SystemRestart]: CreateActionBinding({
      KeyboardKeys: [{ Code: "KeyR" }],
      GamepadButtons: [9]
    }),
    [EInputAction.SystemToggleDebug]: CreateActionBinding({
      KeyboardKeys: [{ Code: "F3" }],
      GamepadButtons: [8]
    }),
    [EInputAction.SystemForceSettlement]: CreateActionBinding({
      KeyboardKeys: [{ Code: "KeyS", Alt: true }]
    })
  }
};

export function MatchKeyboardBinding(Event: KeyboardEvent, Binding: FKeyboardKeyBinding): boolean {
  if (Event.code !== Binding.Code) {
    return false;
  }
  if ((Binding.Alt ?? false) !== Event.altKey) {
    return false;
  }
  if ((Binding.Ctrl ?? false) !== Event.ctrlKey) {
    return false;
  }
  if ((Binding.Shift ?? false) !== Event.shiftKey) {
    return false;
  }
  if ((Binding.Meta ?? false) !== Event.metaKey) {
    return false;
  }
  return true;
}
