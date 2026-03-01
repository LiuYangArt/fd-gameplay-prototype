import { EOverworldPhase } from "@fd/gameplay-core";
import { describe, expect, it } from "vitest";

import { UDebugConfigStore } from "../debug/UDebugConfigStore";
import { EInputAction, EInputDeviceKinds } from "../input/EInputAction";

import { ShouldShowBattleCornerActions } from "./UBattleHudVisibility";

import type { FBattle3CHudState, FHudViewModel, FRuntimePhase } from "./FHudViewModel";
import type { FResolvedActionSlot } from "../input/FInputPrompt";

function CreateGlobalSlot(): FResolvedActionSlot {
  return {
    SlotId: "BattleFlee",
    Action: EInputAction.BattleFlee,
    DisplayName: "逃跑",
    TriggerType: "Direct",
    IsFocused: false,
    IsVisible: true,
    ActiveDevice: EInputDeviceKinds.KeyboardMouse,
    Prompt: null
  };
}

function CreateHud(Overrides?: {
  RuntimePhase?: FRuntimePhase;
  Battle3CState?: Partial<FBattle3CHudState>;
  InputHudState?: Partial<FHudViewModel["InputHudState"]>;
}): FHudViewModel {
  const DebugConfig = new UDebugConfigStore().GetDefaultConfig();
  const DefaultHud: FHudViewModel = {
    RuntimePhase: Overrides?.RuntimePhase ?? "Battle3C",
    OverworldState: {
      Phase: EOverworldPhase.Exploring,
      ControlledTeamId: null,
      ControlledTeamActiveUnitIds: [],
      ControlledTeamOverworldDisplayUnitId: null,
      PlayerPosition: { X: 0, Z: 0 },
      PlayerYawDegrees: 0,
      Enemies: [],
      PendingEncounterEnemyId: null,
      LastEncounterEnemyId: null
    },
    EncounterState: {
      EncounterEnemyId: null,
      PromptText: null,
      StartedAtMs: null,
      PromptDurationSec: 0,
      IntroDurationSec: 0,
      DropDurationSec: 0,
      RemainingTransitionMs: 0
    },
    Battle3CState: {
      PlayerTeamId: null,
      EnemyTeamId: null,
      PlayerActiveUnitIds: [],
      EnemyActiveUnitIds: [],
      ControlledCharacterId: null,
      CameraMode: "PlayerFollow",
      CrosshairScreenPosition: { X: 0.5, Y: 0.5 },
      ScriptStepIndex: 0,
      IsAimMode: false,
      IsSkillTargetMode: false,
      CommandStage: "Root",
      PendingActionKind: null,
      AimCameraYawDeg: null,
      AimCameraPitchDeg: null,
      SelectedTargetId: null,
      HoveredTargetId: null,
      SkillOptions: [],
      ItemOptions: [],
      SelectedSkillOptionIndex: 0,
      SelectedItemOptionIndex: 0,
      SelectedRootCommandIndex: 0,
      SelectedSkillOptionId: null,
      Units: [],
      ScriptFocus: null,
      LastShot: null,
      ActionResolveRemainingMs: 0,
      ActionToastText: null,
      ActionToastRemainingMs: 0
    },
    SettlementState: {
      SummaryText: "",
      ConfirmHintText: ""
    },
    DebugState: {
      IsMenuOpen: false,
      Config: DebugConfig,
      LastUpdatedAtIso: null
    },
    InputHudState: {
      ActiveDevice: EInputDeviceKinds.KeyboardMouse,
      GlobalActionSlots: [CreateGlobalSlot()],
      ContextActionSlots: []
    },
    EventLogs: []
  };

  return {
    ...DefaultHud,
    InputHudState: {
      ...DefaultHud.InputHudState,
      ...(Overrides?.InputHudState ?? {})
    },
    Battle3CState: {
      ...DefaultHud.Battle3CState,
      ...(Overrides?.Battle3CState ?? {})
    }
  };
}

describe("ShouldShowBattleCornerActions", () => {
  it("仅在 Battle3C 且存在全局动作时显示左下角战斗操作 HUD", () => {
    expect(ShouldShowBattleCornerActions(CreateHud({ RuntimePhase: "Overworld" }))).toBe(false);
    expect(ShouldShowBattleCornerActions(CreateHud({ RuntimePhase: "EncounterTransition" }))).toBe(
      false
    );
    expect(ShouldShowBattleCornerActions(CreateHud({ RuntimePhase: "SettlementPreview" }))).toBe(
      false
    );
    expect(ShouldShowBattleCornerActions(CreateHud())).toBe(true);
    expect(
      ShouldShowBattleCornerActions(CreateHud({ InputHudState: { GlobalActionSlots: [] } }))
    ).toBe(false);
  });

  it("瞄准与菜单阶段只要存在全局动作都应显示左下角战斗操作 HUD", () => {
    expect(ShouldShowBattleCornerActions(CreateHud({ Battle3CState: { IsAimMode: true } }))).toBe(
      true
    );
    expect(
      ShouldShowBattleCornerActions(CreateHud({ Battle3CState: { CommandStage: "TargetSelect" } }))
    ).toBe(true);
    expect(
      ShouldShowBattleCornerActions(CreateHud({ Battle3CState: { CommandStage: "SkillMenu" } }))
    ).toBe(true);
  });
});
