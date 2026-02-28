import type { FDebugConfig } from "../debug/UDebugConfigStore";
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

export type FBattlePendingActionKind = "Attack" | "Skill" | null;

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
  SelectedSkillOptionId: string | null;
  Units: FBattleUnitHudState[];
  ScriptFocus: FBattleScriptFocusHudState | null;
  LastShot: FBattleShotHudState | null;
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

export interface FHudViewModel {
  RuntimePhase: FRuntimePhase;
  OverworldState: FOverworldHudState;
  EncounterState: FEncounterHudState;
  Battle3CState: FBattle3CHudState;
  SettlementState: FSettlementPreviewHudState;
  DebugState: FDebugHudState;
  EventLogs: string[];
}
