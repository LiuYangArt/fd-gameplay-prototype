import { UBattleActionButton } from "./UBattleActionButton";

import type { FResolvedActionSlot } from "../../input/FInputPrompt";

interface FBattleCommandListProps {
  Slots: FResolvedActionSlot[];
  OnSlotTriggered: (Slot: FResolvedActionSlot) => void;
}

export function UBattleCommandList({ Slots, OnSlotTriggered }: FBattleCommandListProps) {
  if (Slots.length < 1) {
    return null;
  }

  return (
    <div className="BattleCommandList">
      {Slots.map((Slot) => (
        <UBattleActionButton
          key={Slot.SlotId}
          Label={Slot.DisplayName}
          Prompt={Slot.Prompt}
          TriggerType={Slot.TriggerType}
          IsFocused={Slot.IsFocused}
          IsActive={Slot.IsFocused}
          OnClick={() => OnSlotTriggered(Slot)}
          ClassName="BattleCommandList__Button"
        />
      ))}
    </div>
  );
}
