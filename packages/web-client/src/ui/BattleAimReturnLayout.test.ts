import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

function ExtractCssRuleBody(Content: string, Selector: string): string {
  const EscapedSelector = Selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const Match = new RegExp(`${EscapedSelector}\\s*\\{([\\s\\S]*?)\\}`, "m").exec(Content);
  if (!Match) {
    throw new Error(`未找到 CSS 规则：${Selector}`);
  }
  return Match[1];
}

describe("BattleAimReturnGroup 布局约束", () => {
  it("瞄准返回按钮应挂在角色右侧偏下，避免超出视口且遮挡角色", () => {
    const CurrentDir = dirname(fileURLToPath(import.meta.url));
    const CssPath = resolve(CurrentDir, "../styles.css");
    const CssContent = readFileSync(CssPath, "utf-8");
    const RuleBody = ExtractCssRuleBody(CssContent, ".BattleAimReturnGroup");

    expect(RuleBody).toContain("left: calc(100% + 132px);");
    expect(RuleBody).toContain("top: calc(100% + 72px);");
    expect(RuleBody).not.toContain("translateX(-50%)");
  });
});
