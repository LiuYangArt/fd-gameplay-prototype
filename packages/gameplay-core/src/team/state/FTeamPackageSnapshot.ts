export interface FSchemaMeta {
  SchemaVersion: string;
  DataRevision: number;
}

export interface FUnitStaticConfig {
  UnitId: string;
  DisplayName: string;
  BaseMaxHp: number;
  BaseMaxMp: number;
  BaseAttack: number;
  BaseDefense: number;
  BaseSpeed: number;
  SkillIds: string[];
  Tags: string[];
  WeakPointSocketIds?: string[];
}

export interface FUnitCombatRuntimeSnapshot {
  UnitId: string;
  CurrentHp: number;
  CurrentMp: number;
  IsAlive: boolean;
  Cooldowns: Record<string, number>;
  StatusEffects: string[];
  ReactionWindowMs?: {
    Dodge: number;
    Parry: number;
    Counter: number;
  };
}

export interface FTeamMoveConfig {
  WalkSpeedCmPerSec: number;
  RunSpeedCmPerSec: number;
}

export interface FTeamRosterSnapshot {
  TeamId: string;
  MemberUnitIds: string[];
}

export interface FTeamFormationSnapshot {
  TeamId: string;
  ActiveUnitIds: string[];
  LeaderUnitId: string;
  OverworldDisplayUnitId: string;
}

export interface FTeamPackageSnapshot {
  Meta: FSchemaMeta;
  TeamId: string;
  DisplayName: string;
  MoveConfig: FTeamMoveConfig;
  Roster: FTeamRosterSnapshot;
  Formation: FTeamFormationSnapshot;
}
