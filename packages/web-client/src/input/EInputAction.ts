export const EInputAction = {
  UIConfirm: "UI.Confirm",
  UICancel: "UI.Cancel",
  UINavUp: "UI.NavUp",
  UINavDown: "UI.NavDown",
  UINavLeft: "UI.NavLeft",
  UINavRight: "UI.NavRight",
  BattleToggleAim: "Battle.ToggleAim",
  BattleFire: "Battle.Fire",
  BattleSwitchCharacter: "Battle.SwitchCharacter",
  BattleFlee: "Battle.Flee",
  SystemRestart: "System.Restart",
  SystemToggleDebug: "System.ToggleDebug",
  SystemForceSettlement: "System.ForceSettlement"
} as const;

export type EInputAction = (typeof EInputAction)[keyof typeof EInputAction];

export const EInputDeviceKinds = {
  KeyboardMouse: "KeyboardMouse",
  Gamepad: "Gamepad"
} as const;

export type EInputDeviceKind = (typeof EInputDeviceKinds)[keyof typeof EInputDeviceKinds];
