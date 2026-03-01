import { describe, expect, it } from "vitest";

import { EInputAction, EInputDeviceKinds } from "./EInputAction";
import { UInputPromptRegistry } from "./UInputPromptRegistry";

describe("UInputPromptRegistry", () => {
  it("应为手柄确认键返回 A 绿色提示", () => {
    const Registry = new UInputPromptRegistry();
    const Prompt = Registry.ResolvePrompt(EInputAction.UIConfirm, EInputDeviceKinds.Gamepad);
    expect(Prompt).not.toBeNull();
    expect(Prompt?.Label).toBe("A");
    expect(Prompt?.ColorRole).toBe("GamepadA");
    expect(Prompt?.IconAssetPath).toContain("xbox_button_color_a.svg");
  });

  it("应为键鼠取消键返回 ESC 图标提示", () => {
    const Registry = new UInputPromptRegistry();
    const Prompt = Registry.ResolvePrompt(EInputAction.UICancel, EInputDeviceKinds.KeyboardMouse);
    expect(Prompt).not.toBeNull();
    expect(Prompt?.Label.toLowerCase()).toContain("esc");
    expect(Prompt?.IconPath).not.toBeNull();
    expect(Prompt?.IconAssetPath).toBeNull();
  });

  it("应为手柄取消键返回 B 红色提示", () => {
    const Registry = new UInputPromptRegistry();
    const Prompt = Registry.ResolvePrompt(EInputAction.UICancel, EInputDeviceKinds.Gamepad);
    expect(Prompt).not.toBeNull();
    expect(Prompt?.Label).toBe("B");
    expect(Prompt?.ColorRole).toBe("GamepadB");
    expect(Prompt?.IconAssetPath).toContain("xbox_button_color_b.svg");
  });

  it("应为无图标键位返回文本键帽 fallback", () => {
    const Registry = new UInputPromptRegistry();
    const Prompt = Registry.ResolvePrompt(EInputAction.BattleFlee, EInputDeviceKinds.KeyboardMouse);
    expect(Prompt).not.toBeNull();
    expect(Prompt?.IconPath).toBeNull();
    expect(Prompt?.IconAssetPath).toBeNull();
    expect(Prompt?.UseMonospace).toBe(true);
  });

  it("跳过回合与逃跑提示应匹配长按键位", () => {
    const Registry = new UInputPromptRegistry();
    const SwitchKeyboard = Registry.ResolvePrompt(
      EInputAction.BattleSwitchCharacter,
      EInputDeviceKinds.KeyboardMouse
    );
    const FleeKeyboard = Registry.ResolvePrompt(
      EInputAction.BattleFlee,
      EInputDeviceKinds.KeyboardMouse
    );
    const SwitchGamepad = Registry.ResolvePrompt(
      EInputAction.BattleSwitchCharacter,
      EInputDeviceKinds.Gamepad
    );
    const FleeGamepad = Registry.ResolvePrompt(EInputAction.BattleFlee, EInputDeviceKinds.Gamepad);

    expect(SwitchKeyboard?.Label).toBe("Tab");
    expect(SwitchKeyboard?.IconPath).not.toBeNull();
    expect(FleeKeyboard?.Label).toBe("C");
    expect(SwitchGamepad?.Label).toBe("RS");
    expect(FleeGamepad?.Label).toBe("LS");
    expect(SwitchGamepad?.IconAssetPath).toContain("xbox_rs.svg");
    expect(FleeGamepad?.IconAssetPath).toContain("xbox_ls.svg");
  });

  it("无对应映射时应返回 null", () => {
    const Registry = new UInputPromptRegistry();
    const Prompt = Registry.ResolvePrompt(
      EInputAction.SystemForceSettlement,
      EInputDeviceKinds.Gamepad
    );
    expect(Prompt).toBeNull();
  });
});
