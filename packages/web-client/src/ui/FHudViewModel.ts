import type { FDebugConfig } from "../debug/UDebugConfigStore";
import type { EInputDeviceKind } from "../input/EInputAction";
import type { FResolvedActionSlot } from "../input/FInputPrompt";
import type { EOverworldPhase, FOverworldEnemyState, FOverworldVector2 } from "@fd/gameplay-core";

export type FRuntimePhase = "Overworld" | "EncounterTransition" | "Battle3C" | "SettlementPreview";

export type FBattleCameraMode =
  | "IntroPullOut"
  | "IntroDropIn"
  | "PlayerFollow"
  | "PlayerAim"
  | "PlayerSkillPreview"
  | "PlayerItemPreview"
  | "SkillTargetZoom"
  | "EnemyAttackSingle"
  | "EnemyAttackAOE"
  | "SettlementCam";

export type FBattleCommandStage =
  | "Root"
  | "SkillMenu"
  | "ItemMenu"
  | "TargetSelect"
  | "ActionResolve";

export type FBattlePendingActionKind = "Attack" | "Skill" | "Item" | null;

export interface FBattleCommandOption {
  OptionId: string;
  DisplayName: string;
}

export interface FVector3Cm {
  X: number;
  Y: number;
  Z: number;
}

export interface FCrosshairScreenPosition {
  X: number;
  Y: number;
}

export interface FOverworldHudState {
  Phase: EOverworldPhase;
  ControlledTeamId: string | null;
  ControlledTeamActiveUnitIds: string[];
  ControlledTeamOverworldDisplayUnitId: string | null;
  PlayerPosition: FOverworldVector2;
  PlayerYawDegrees: number;
  Enemies: FOverworldEnemyState[];
  PendingEncounterEnemyId: string | null;
  LastEncounterEnemyId: string | null;
}

export interface FEncounterHudState {
  EncounterEnemyId: string | null;
  PromptText: string | null;
  StartedAtMs: number | null;
  PromptDurationSec: number;
  IntroDurationSec: number;
  DropDurationSec: number;
  RemainingTransitionMs: number;
}

export interface FBattleUnitHudState {
  UnitId: string;
  DisplayName: string;
  TeamId: "Player" | "Enemy";
  ModelAssetPath: string | null;
  PositionCm: FVector3Cm;
  YawDeg: number;
  MaxHp: number;
  CurrentHp: number;
  MaxMp: number;
  CurrentMp: number;
  IsAlive: boolean;
  IsControlled: boolean;
  IsSelectedTarget: boolean;
  IsEncounterPrimaryEnemy: boolean;
}

export interface FBattleScriptFocusHudState {
  AttackerUnitId: string;
  TargetUnitIds: string[];
}

export interface FBattleShotHudState {
  ShotId: number;
  AttackerUnitId: string;
  TargetUnitId: string | null;
  DamageAmount: number;
  ImpactAtMs: number | null;
}

export interface FBattleMeleeActionHudState {
  ActionId: number;
  AttackerUnitId: string;
  TargetUnitId: string;
  Phase: "Retreat" | "Advance" | "Impact" | "Return";
  RetreatStartAtMs: number;
  RetreatEndAtMs: number;
  DashStartAtMs: number;
  DashEndAtMs: number;
  ReturnStartAtMs: number;
  ReturnEndAtMs: number;
  StartPositionCm: FVector3Cm;
  ContactPositionCm: FVector3Cm;
}

export interface FBattleDamageCueHudState {
  CueId: number;
  SourceKind: "Shot" | "Melee";
  TargetUnitId: string;
  DamageAmount: number;
  PopAtMs: number;
}

export interface FBattle3CHudState {
  PlayerTeamId: string | null;
  EnemyTeamId: string | null;
  PlayerActiveUnitIds: string[];
  EnemyActiveUnitIds: string[];
  ControlledCharacterId: string | null;
  CameraMode: FBattleCameraMode;
  CrosshairScreenPosition: FCrosshairScreenPosition;
  ScriptStepIndex: number;
  IsAimMode: boolean;
  IsSkillTargetMode: boolean;
  CommandStage: FBattleCommandStage;
  PendingActionKind: FBattlePendingActionKind;
  AimCameraYawDeg: number | null;
  AimCameraPitchDeg: number | null;
  SelectedTargetId: string | null;
  HoveredTargetId: string | null;
  SkillOptions: FBattleCommandOption[];
  ItemOptions: FBattleCommandOption[];
  SelectedSkillOptionIndex: number;
  SelectedItemOptionIndex: number;
  SelectedRootCommandIndex: number;
  SelectedSkillOptionId: string | null;
  Units: FBattleUnitHudState[];
  ScriptFocus: FBattleScriptFocusHudState | null;
  LastShot: FBattleShotHudState | null;
  ActiveMeleeAction?: FBattleMeleeActionHudState | null;
  LastDamageCue?: FBattleDamageCueHudState | null;
  ActionResolveRemainingMs: number;
  ActionToastText: string | null;
  ActionToastRemainingMs: number;
}

export interface FSettlementPreviewHudState {
  SummaryText: string;
  ConfirmHintText: string;
}

export interface FDebugHudState {
  IsMenuOpen: boolean;
  Config: FDebugConfig;
  LastUpdatedAtIso: string | null;
}

export interface FInputHudState {
  ActiveDevice: EInputDeviceKind;
  GlobalActionSlots: FResolvedActionSlot[];
  ContextActionSlots: FResolvedActionSlot[];
}

export interface FHudViewModel {
  RuntimePhase: FRuntimePhase;
  OverworldState: FOverworldHudState;
  EncounterState: FEncounterHudState;
  Battle3CState: FBattle3CHudState;
  SettlementState: FSettlementPreviewHudState;
  DebugState: FDebugHudState;
  InputHudState: FInputHudState;
  EventLogs: string[];
}
