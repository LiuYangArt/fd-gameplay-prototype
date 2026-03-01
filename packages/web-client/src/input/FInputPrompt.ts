import type { EInputAction, EInputDeviceKind } from "./EInputAction";

export type EInputPromptColorRole = "Neutral" | "GamepadA" | "GamepadB" | "GamepadX" | "GamepadY";

export interface FInputPromptToken {
  Label: string;
  IconPath: string | null;
  ColorRole: EInputPromptColorRole;
  UseMonospace: boolean;
}

export type EActionTriggerType = "Direct" | "FocusedConfirm";

export interface FContextualActionSlot {
  SlotId: string;
  Action: EInputAction;
  DisplayName: string;
  TriggerType: EActionTriggerType;
  IsFocused: boolean;
  IsVisible: boolean;
  RequiresHold?: boolean;
  IsHoldActive?: boolean;
  HoldProgressNormalized?: number;
}

export interface FResolvedActionSlot extends FContextualActionSlot {
  ActiveDevice: EInputDeviceKind;
  Prompt: FInputPromptToken | null;
}
