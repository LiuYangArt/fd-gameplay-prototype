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
  const ClassName = `InputPromptBadge ${ColorClass}${Token.UseMonospace ? " InputPromptBadge--Mono" : ""}`;
  const RenderPromptVisual = () => {
    if (Token.IconAssetPath !== null) {
      return (
        <img
          className="InputPromptBadge__Image"
          src={Token.IconAssetPath}
          alt=""
          aria-hidden="true"
        />
      );
    }
    if (Token.IconPath !== null) {
      return <Icon className="InputPromptBadge__Icon" path={Token.IconPath} size={0.86} />;
    }
    return <span className="InputPromptBadge__Label">{Token.Label}</span>;
  };
  return (
    <span className={ClassName} title={Token.Label}>
      {RenderPromptVisual()}
    </span>
  );
}
