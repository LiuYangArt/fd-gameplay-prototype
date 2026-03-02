import { UInputPromptBadge } from "./UInputPromptBadge";

import type { EActionTriggerType, FInputPromptToken } from "../../input/FInputPrompt";
import type { CSSProperties, PointerEventHandler } from "react";

interface FBattleActionButtonProps {
  Label: string;
  OnClick: () => void;
  Prompt: FInputPromptToken | null;
  TriggerType: EActionTriggerType;
  IsFocused: boolean;
  IsActive?: boolean;
  ClassName?: string;
  HintText?: string;
  Disabled?: boolean;
  RequiresHold?: boolean;
  IsHoldActive?: boolean;
  HoldProgressNormalized?: number;
  OnPointerDown?: PointerEventHandler<HTMLButtonElement>;
  OnPointerUp?: PointerEventHandler<HTMLButtonElement>;
  OnPointerCancel?: PointerEventHandler<HTMLButtonElement>;
  OnPointerLeave?: PointerEventHandler<HTMLButtonElement>;
}

function Clamp01(Value: number): number {
  return Math.min(Math.max(Value, 0), 1);
}

function ResolveHoldStyle(
  RequiresHold: boolean,
  HoldProgressNormalized: number
): CSSProperties | undefined {
  if (!RequiresHold) {
    return undefined;
  }
  const NormalizedHoldProgress = Clamp01(HoldProgressNormalized);
  return { "--hold-progress": `${NormalizedHoldProgress}` } as CSSProperties;
}

function ResolveHoldClassNames(
  RequiresHold: boolean,
  IsHoldActive: boolean,
  HoldProgressNormalized: number
): string {
  if (!RequiresHold) {
    return "";
  }
  const NormalizedHoldProgress = Clamp01(HoldProgressNormalized);
  return ` IsHoldAction${IsHoldActive ? " IsHoldActive" : ""}${
    NormalizedHoldProgress >= 0.999 ? " IsHoldReady" : ""
  }`;
}

// eslint-disable-next-line complexity
export function UBattleActionButton({
  Label,
  OnClick,
  Prompt,
  TriggerType,
  IsFocused,
  IsActive = false,
  ClassName = "",
  HintText,
  Disabled = false,
  RequiresHold = false,
  IsHoldActive = false,
  HoldProgressNormalized = 0,
  OnPointerDown,
  OnPointerUp,
  OnPointerCancel,
  OnPointerLeave
}: FBattleActionButtonProps) {
  const ShouldShowPrompt = Prompt && (TriggerType === "Direct" || IsFocused);
  const HoldStyle = ResolveHoldStyle(RequiresHold, HoldProgressNormalized);
  const HoldClassNames = ResolveHoldClassNames(RequiresHold, IsHoldActive, HoldProgressNormalized);
  return (
    <button
      type="button"
      className={`BattleActionButton${IsActive ? " IsActive" : ""}${HoldClassNames}${
        ClassName ? ` ${ClassName}` : ""
      }`}
      onClick={OnClick}
      onPointerDown={OnPointerDown}
      onPointerUp={OnPointerUp}
      onPointerCancel={OnPointerCancel}
      onPointerLeave={OnPointerLeave}
      disabled={Disabled}
      style={HoldStyle}
    >
      <span className="BattleActionButton__Main">
        {ShouldShowPrompt ? <UInputPromptBadge Token={Prompt} /> : null}
        <span className="BattleActionButton__LabelText">{Label}</span>
      </span>
      {HintText ? <span className="BattleActionButton__HintText">{HintText}</span> : null}
    </button>
  );
}
