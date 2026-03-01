import { UBattleActionButton } from "./UBattleActionButton";

import type { EInputAction } from "../../input/EInputAction";
import type { FResolvedActionSlot } from "../../input/FInputPrompt";

interface FBattleGlobalActionBarProps {
  Slots: FResolvedActionSlot[];
  OnActionTriggered: (Action: EInputAction) => void;
}

export function UBattleGlobalActionBar({ Slots, OnActionTriggered }: FBattleGlobalActionBarProps) {
  if (Slots.length < 1) {
    return null;
  }

  return (
    <div className="BattleCornerActions" data-ignore-fire-input="true">
      {Slots.map((Slot) => (
        <UBattleActionButton
          key={Slot.SlotId}
          Label={Slot.DisplayName}
          Prompt={Slot.Prompt}
          TriggerType={Slot.TriggerType}
          IsFocused={Slot.IsFocused}
          RequiresHold={Slot.RequiresHold === true}
          IsHoldActive={Slot.IsHoldActive === true}
          HoldProgressNormalized={Slot.HoldProgressNormalized ?? 0}
          OnClick={() => OnActionTriggered(Slot.Action)}
          ClassName="BattleCornerButton"
        />
      ))}
    </div>
  );
}
