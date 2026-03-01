import {
  mdiKeyboardEsc,
  mdiKeyboardReturn,
  mdiKeyboardTab,
  mdiMouseLeftClick,
  mdiMouseRightClick
} from "@mdi/js";

import {
  EInputAction,
  EInputDeviceKinds,
  type EInputAction as FInputAction,
  type EInputDeviceKind
} from "./EInputAction";

import type { FContextualActionSlot, FInputPromptToken, FResolvedActionSlot } from "./FInputPrompt";

const KenneyXboxSeriesAssetBasePath = "/assets/input/kenney/xbox-series";
type FPromptTokenOptions = Partial<
  Pick<FInputPromptToken, "IconPath" | "IconAssetPath" | "ColorRole" | "UseMonospace">
>;

function CreatePromptToken(Label: string, Options: FPromptTokenOptions = {}): FInputPromptToken {
  return {
    Label,
    IconPath: Options.IconPath ?? null,
    IconAssetPath: Options.IconAssetPath ?? null,
    ColorRole: Options.ColorRole ?? "Neutral",
    UseMonospace: Options.UseMonospace ?? true
  };
}

function CreateKenneyXboxPromptToken(
  Label: string,
  FileName: string,
  ColorRole: FInputPromptToken["ColorRole"] = "Neutral"
): FInputPromptToken {
  return CreatePromptToken(Label, {
    IconAssetPath: `${KenneyXboxSeriesAssetBasePath}/${FileName}`,
    ColorRole
  });
}

const KeyboardMousePromptMap: Partial<Record<FInputAction, FInputPromptToken>> = {
  [EInputAction.UIConfirm]: CreatePromptToken("Enter", { IconPath: mdiKeyboardReturn }),
  [EInputAction.UICancel]: CreatePromptToken("Esc", { IconPath: mdiKeyboardEsc }),
  [EInputAction.BattleToggleAim]: CreatePromptToken("RMB", { IconPath: mdiMouseRightClick }),
  [EInputAction.BattleFire]: CreatePromptToken("LMB", { IconPath: mdiMouseLeftClick }),
  [EInputAction.BattleSwitchCharacter]: CreatePromptToken("Tab", { IconPath: mdiKeyboardTab }),
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
  [EInputAction.UIConfirm]: CreateKenneyXboxPromptToken("A", "xbox_button_color_a.svg", "GamepadA"),
  [EInputAction.UICancel]: CreateKenneyXboxPromptToken("B", "xbox_button_color_b.svg", "GamepadB"),
  [EInputAction.BattleToggleAim]: CreateKenneyXboxPromptToken("LT", "xbox_lt.svg"),
  [EInputAction.BattleFire]: CreateKenneyXboxPromptToken("RT", "xbox_rt.svg"),
  [EInputAction.BattleSwitchCharacter]: CreateKenneyXboxPromptToken("RS", "xbox_rs.svg"),
  [EInputAction.BattleFlee]: CreateKenneyXboxPromptToken("LS", "xbox_ls.svg"),
  [EInputAction.SystemRestart]: CreateKenneyXboxPromptToken("Menu", "xbox_button_menu.svg"),
  [EInputAction.SystemToggleDebug]: CreateKenneyXboxPromptToken("View", "xbox_button_view.svg"),
  [EInputAction.UINavUp]: CreateKenneyXboxPromptToken("D↑", "xbox_dpad_up.svg"),
  [EInputAction.UINavDown]: CreateKenneyXboxPromptToken("D↓", "xbox_dpad_down.svg"),
  [EInputAction.UINavLeft]: CreateKenneyXboxPromptToken("D←", "xbox_dpad_left.svg"),
  [EInputAction.UINavRight]: CreateKenneyXboxPromptToken("D→", "xbox_dpad_right.svg")
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
