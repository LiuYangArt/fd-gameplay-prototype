import { mdiKeyboardEsc, mdiKeyboardReturn, mdiMouseLeftClick, mdiMouseRightClick } from "@mdi/js";

import {
  EInputAction,
  EInputDeviceKinds,
  type EInputAction as FInputAction,
  type EInputDeviceKind
} from "./EInputAction";

import type { FContextualActionSlot, FInputPromptToken, FResolvedActionSlot } from "./FInputPrompt";

function CreatePromptToken(
  Label: string,
  Options: Partial<Pick<FInputPromptToken, "IconPath" | "ColorRole" | "UseMonospace">> = {}
): FInputPromptToken {
  return {
    Label,
    IconPath: Options.IconPath ?? null,
    ColorRole: Options.ColorRole ?? "Neutral",
    UseMonospace: Options.UseMonospace ?? true
  };
}

const KeyboardMousePromptMap: Partial<Record<FInputAction, FInputPromptToken>> = {
  [EInputAction.UIConfirm]: CreatePromptToken("Enter", { IconPath: mdiKeyboardReturn }),
  [EInputAction.UICancel]: CreatePromptToken("Esc", { IconPath: mdiKeyboardEsc }),
  [EInputAction.BattleToggleAim]: CreatePromptToken("RMB", { IconPath: mdiMouseRightClick }),
  [EInputAction.BattleFire]: CreatePromptToken("LMB", { IconPath: mdiMouseLeftClick }),
  [EInputAction.BattleSwitchCharacter]: CreatePromptToken("Tab"),
  [EInputAction.BattleFlee]: CreatePromptToken("C"),
  [EInputAction.SystemRestart]: CreatePromptToken("R"),
  [EInputAction.SystemToggleDebug]: CreatePromptToken("F3"),
  [EInputAction.SystemForceSettlement]: CreatePromptToken("Alt+S"),
  [EInputAction.UINavUp]: CreatePromptToken("↑"),
  [EInputAction.UINavDown]: CreatePromptToken("↓"),
  [EInputAction.UINavLeft]: CreatePromptToken("←"),
  [EInputAction.UINavRight]: CreatePromptToken("→")
};

const GamepadPromptMap: Partial<Record<FInputAction, FInputPromptToken>> = {
  [EInputAction.UIConfirm]: CreatePromptToken("A", { ColorRole: "GamepadA" }),
  [EInputAction.UICancel]: CreatePromptToken("B", { ColorRole: "GamepadB" }),
  [EInputAction.BattleToggleAim]: CreatePromptToken("LT"),
  [EInputAction.BattleFire]: CreatePromptToken("RT"),
  [EInputAction.BattleSwitchCharacter]: CreatePromptToken("RS"),
  [EInputAction.BattleFlee]: CreatePromptToken("LS"),
  [EInputAction.SystemRestart]: CreatePromptToken("Menu"),
  [EInputAction.SystemToggleDebug]: CreatePromptToken("View"),
  [EInputAction.UINavUp]: CreatePromptToken("D↑"),
  [EInputAction.UINavDown]: CreatePromptToken("D↓"),
  [EInputAction.UINavLeft]: CreatePromptToken("D←"),
  [EInputAction.UINavRight]: CreatePromptToken("D→")
};

export class UInputPromptRegistry {
  public ResolvePrompt(Action: FInputAction, Device: EInputDeviceKind): FInputPromptToken | null {
    if (Device === EInputDeviceKinds.Gamepad) {
      return this.ResolveGamepadPrompt(Action);
    }
    return this.ResolveKeyboardMousePrompt(Action);
  }

  public ResolveSlots(
    Slots: FContextualActionSlot[],
    ActiveDevice: EInputDeviceKind
  ): FResolvedActionSlot[] {
    return Slots.filter((Slot) => Slot.IsVisible).map((Slot) => ({
      ...Slot,
      ActiveDevice,
      Prompt: this.ResolvePrompt(Slot.Action, ActiveDevice)
    }));
  }

  private ResolveKeyboardMousePrompt(Action: FInputAction): FInputPromptToken | null {
    return KeyboardMousePromptMap[Action] ?? null;
  }

  private ResolveGamepadPrompt(Action: FInputAction): FInputPromptToken | null {
    return GamepadPromptMap[Action] ?? null;
  }
}
