import type { EInputAction, EInputDeviceKind } from "./EInputAction";

export interface FInputActionValue {
  IsTriggered: boolean;
  IsHeld: boolean;
  Axis: number;
  SourceDevice: EInputDeviceKind;
}

export interface FInputActionFrame {
  Actions: Partial<Record<EInputAction, FInputActionValue>>;
  TriggeredActions: EInputAction[];
  HeldActions: EInputAction[];
}

export function CreateEmptyInputActionFrame(): FInputActionFrame {
  return {
    Actions: {},
    TriggeredActions: [],
    HeldActions: []
  };
}
