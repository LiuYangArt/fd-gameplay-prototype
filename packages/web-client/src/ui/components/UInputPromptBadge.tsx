import Icon from "@mdi/react";

import type { FInputPromptToken } from "../../input/FInputPrompt";

interface FInputPromptBadgeProps {
  Token: FInputPromptToken;
}

function ResolvePromptColorClass(ColorRole: FInputPromptToken["ColorRole"]): string {
  switch (ColorRole) {
    case "GamepadA":
      return "InputPromptBadge--A";
    case "GamepadB":
      return "InputPromptBadge--B";
    case "GamepadX":
      return "InputPromptBadge--X";
    case "GamepadY":
      return "InputPromptBadge--Y";
    default:
      return "InputPromptBadge--Neutral";
  }
}

export function UInputPromptBadge({ Token }: FInputPromptBadgeProps) {
  const ColorClass = ResolvePromptColorClass(Token.ColorRole);
  return (
    <span
      className={`InputPromptBadge ${ColorClass}${Token.UseMonospace ? " InputPromptBadge--Mono" : ""}`}
      title={Token.Label}
    >
      {Token.IconPath !== null ? (
        <Icon className="InputPromptBadge__Icon" path={Token.IconPath} size={0.86} />
      ) : (
        <span className="InputPromptBadge__Label">{Token.Label}</span>
      )}
    </span>
  );
}
