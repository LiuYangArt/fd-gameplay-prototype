import { EOverworldPhase } from "@fd/gameplay-core";
import { describe, expect, it } from "vitest";

import { UDebugConfigStore } from "../debug/UDebugConfigStore";
import { EInputDeviceKinds } from "../input/EInputAction";

import { ResolveBattleTargetPromptModel } from "./UBattleTargetPromptResolver";

import type { FBattle3CHudState, FHudViewModel, FRuntimePhase } from "./FHudViewModel";

function CreateHud(Overrides?: {
  RuntimePhase?: FRuntimePhase;
  Battle3CState?: Partial<FBattle3CHudState>;
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
      PlayerTeamId: "Player",
      EnemyTeamId: "Enemy",
      PlayerActiveUnitIds: ["char01"],
      EnemyActiveUnitIds: ["enemy01"],
      ControlledCharacterId: "char01",
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
      Units: [
        {
          UnitId: "char01",
          DisplayName: "队友1",
          TeamId: "Player",
          ModelAssetPath: null,
          PositionCm: { X: 0, Y: 0, Z: 0 },
          YawDeg: 0,
          MaxHp: 120,
          CurrentHp: 120,
          MaxMp: 90,
          CurrentMp: 90,
          IsAlive: true,
          IsControlled: true,
          IsSelectedTarget: false,
          IsEncounterPrimaryEnemy: false
        },
        {
          UnitId: "enemy01",
          DisplayName: "敌人1",
          TeamId: "Enemy",
          ModelAssetPath: null,
          PositionCm: { X: 0, Y: 0, Z: 0 },
          YawDeg: 180,
          MaxHp: 120,
          CurrentHp: 120,
          MaxMp: 90,
          CurrentMp: 90,
          IsAlive: true,
          IsControlled: false,
          IsSelectedTarget: false,
          IsEncounterPrimaryEnemy: true
        }
      ],
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
      GlobalActionSlots: [],
      ContextActionSlots: []
    },
    EventLogs: []
  };

  return {
    ...DefaultHud,
    Battle3CState: {
      ...DefaultHud.Battle3CState,
      ...(Overrides?.Battle3CState ?? {})
    }
  };
}

describe("ResolveBattleTargetPromptModel", () => {
  it("仅在 Battle3C 的 TargetSelect 阶段展示目标选择提示", () => {
    expect(ResolveBattleTargetPromptModel(CreateHud({ RuntimePhase: "Overworld" }))).toBeNull();
    expect(
      ResolveBattleTargetPromptModel(CreateHud({ Battle3CState: { CommandStage: "Root" } }))
    ).toBeNull();
  });

  it("攻击/技能/道具目标选择都应生成简洁提示文案", () => {
    const AttackPrompt = ResolveBattleTargetPromptModel(
      CreateHud({
        Battle3CState: {
          CommandStage: "TargetSelect",
          PendingActionKind: "Attack",
          SelectedTargetId: "enemy01"
        }
      })
    );
    expect(AttackPrompt?.PromptText).toBe("选择攻击目标");

    const SkillPrompt = ResolveBattleTargetPromptModel(
      CreateHud({
        Battle3CState: {
          CommandStage: "TargetSelect",
          PendingActionKind: "Skill",
          SelectedTargetId: "enemy01"
        }
      })
    );
    expect(SkillPrompt?.PromptText).toBe("选择技能目标");

    const ItemPrompt = ResolveBattleTargetPromptModel(
      CreateHud({
        Battle3CState: {
          CommandStage: "TargetSelect",
          PendingActionKind: "Item",
          SelectedTargetId: "char01"
        }
      })
    );
    expect(ItemPrompt?.PromptText).toBe("选择道具目标");
  });
});
