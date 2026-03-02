import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";

import { EInputAction } from "../../input/EInputAction";
import { UDefaultInputBindingProfile } from "../../input/UInputBindingProfile";

import { UBattleActionButton } from "./UBattleActionButton";

import type { FResolvedActionSlot } from "../../input/FInputPrompt";

interface FBattleGlobalActionBarProps {
  Slots: FResolvedActionSlot[];
  OnActionTriggered: (Action: EInputAction) => void;
}

interface FPointerHoldState {
  SlotId: string;
  Action: EInputAction;
  StartedAtMs: number;
  DurationMs: number;
  HasTriggered: boolean;
}

interface FHoldVisualState {
  RequiresHold: boolean;
  IsHoldActive: boolean;
  HoldProgressNormalized: number;
}

function ResolveActionHoldDurationMs(Action: EInputAction): number {
  const ConfigDuration = UDefaultInputBindingProfile.ActionBindings[Action]?.HoldDurationMs;
  if (typeof ConfigDuration === "number" && Number.isFinite(ConfigDuration) && ConfigDuration > 0) {
    return ConfigDuration;
  }
  return 620;
}

function ResolveHoldVisualState(
  Slot: FResolvedActionSlot,
  PointerHoldState: FPointerHoldState | null,
  PointerHoldProgressNormalized: number
): FHoldVisualState {
  const RequiresHold = Slot.RequiresHold === true;
  if (!RequiresHold) {
    return {
      RequiresHold: false,
      IsHoldActive: false,
      HoldProgressNormalized: 0
    };
  }

  const IsPointerHoldingThisSlot = PointerHoldState?.SlotId === Slot.SlotId;
  return {
    RequiresHold: true,
    IsHoldActive: IsPointerHoldingThisSlot ? true : Slot.IsHoldActive === true,
    HoldProgressNormalized: IsPointerHoldingThisSlot
      ? PointerHoldProgressNormalized
      : (Slot.HoldProgressNormalized ?? 0)
  };
}

export function UBattleGlobalActionBar({ Slots, OnActionTriggered }: FBattleGlobalActionBarProps) {
  const [PointerHoldState, SetPointerHoldState] = useState<FPointerHoldState | null>(null);
  const [PointerHoldProgressNormalized, SetPointerHoldProgressNormalized] = useState(0);

  const CancelPointerHold = useCallback((SlotId: string) => {
    SetPointerHoldState((PreviousState) => {
      if (!PreviousState || PreviousState.SlotId !== SlotId) {
        return PreviousState;
      }
      return null;
    });
    SetPointerHoldProgressNormalized(0);
  }, []);

  const HandleSlotClick = useCallback(
    (Slot: FResolvedActionSlot) => {
      if (Slot.RequiresHold === true) {
        return;
      }
      OnActionTriggered(Slot.Action);
    },
    [OnActionTriggered]
  );

  const HandleSlotPointerDown = useCallback(
    (Slot: FResolvedActionSlot, Event: ReactPointerEvent<HTMLButtonElement>) => {
      if (Slot.RequiresHold !== true || Event.button !== 0) {
        return;
      }
      Event.preventDefault();
      SetPointerHoldProgressNormalized(0);
      SetPointerHoldState({
        SlotId: Slot.SlotId,
        Action: Slot.Action,
        StartedAtMs: performance.now(),
        DurationMs: ResolveActionHoldDurationMs(Slot.Action),
        HasTriggered: false
      });
    },
    []
  );

  const HandleSlotPointerUp = useCallback(
    (Slot: FResolvedActionSlot) => {
      if (Slot.RequiresHold !== true) {
        return;
      }
      CancelPointerHold(Slot.SlotId);
    },
    [CancelPointerHold]
  );

  useEffect(() => {
    if (!PointerHoldState || PointerHoldState.HasTriggered) {
      return;
    }

    let FrameId = 0;
    const Tick = () => {
      const ActiveSlot = Slots.find((Slot) => Slot.SlotId === PointerHoldState.SlotId);
      if (!ActiveSlot || ActiveSlot.RequiresHold !== true) {
        CancelPointerHold(PointerHoldState.SlotId);
        return;
      }
      const ElapsedMs = Math.max(performance.now() - PointerHoldState.StartedAtMs, 0);
      const ProgressNormalized = Math.min(ElapsedMs / PointerHoldState.DurationMs, 1);
      SetPointerHoldProgressNormalized(ProgressNormalized);
      if (ProgressNormalized >= 1) {
        OnActionTriggered(PointerHoldState.Action);
        SetPointerHoldState((PreviousState) => {
          if (!PreviousState || PreviousState.SlotId !== PointerHoldState.SlotId) {
            return PreviousState;
          }
          return {
            ...PreviousState,
            HasTriggered: true
          };
        });
        return;
      }
      FrameId = window.requestAnimationFrame(Tick);
    };

    FrameId = window.requestAnimationFrame(Tick);
    return () => {
      window.cancelAnimationFrame(FrameId);
    };
  }, [PointerHoldState, OnActionTriggered, Slots, CancelPointerHold]);

  if (Slots.length < 1) {
    return null;
  }

  return (
    <div className="BattleCornerActions" data-ignore-fire-input="true">
      {Slots.map((Slot) => {
        const HoldVisualState = ResolveHoldVisualState(
          Slot,
          PointerHoldState,
          PointerHoldProgressNormalized
        );
        return (
          <UBattleActionButton
            key={Slot.SlotId}
            Label={Slot.DisplayName}
            Prompt={Slot.Prompt}
            TriggerType={Slot.TriggerType}
            IsFocused={Slot.IsFocused}
            RequiresHold={HoldVisualState.RequiresHold}
            IsHoldActive={HoldVisualState.IsHoldActive}
            HoldProgressNormalized={HoldVisualState.HoldProgressNormalized}
            OnClick={() => HandleSlotClick(Slot)}
            OnPointerDown={(Event) => HandleSlotPointerDown(Slot, Event)}
            OnPointerUp={() => HandleSlotPointerUp(Slot)}
            OnPointerCancel={() => HandleSlotPointerUp(Slot)}
            OnPointerLeave={() => HandleSlotPointerUp(Slot)}
            ClassName="BattleCornerButton"
          />
        );
      })}
    </div>
  );
}
