const DebugConfigStorageKeyV2 = "FD_DEBUG_CONFIG_V2";
const DebugConfigStorageKeyV3 = "FD_DEBUG_CONFIG_V3";
const DebugConfigStorageKeyV4 = "FD_DEBUG_CONFIG_V4";
const DebugConfigStorageKeyV5 = "FD_DEBUG_CONFIG_V5";

const DebugWideCmMin = -12000;
const DebugWideCmMax = 12000;
const DebugWideFovMinDeg = 5;
const DebugWideFovMaxDeg = 170;
const DebugWideYawMinDeg = -180;
const DebugWideYawMaxDeg = 180;
const DebugWideDurationMinSec = 0.01;
const DebugWideDurationMaxSec = 30;

interface FDebugConfigStoragePayload {
  Config: FDebugConfig;
  LastUpdatedAtIso: string | null;
}

export interface FDebugConfig {
  TargetArmLength: number;
  CameraPitch: number;
  CameraFov: number;
  CameraLagSpeed: number;
  CameraLagMaxDistance: number;
  CameraOffsetRight: number;
  CameraOffsetUp: number;
  WalkSpeed: number;
  RunSpeed: number;
  LookPitchMin: number;
  LookPitchMax: number;
  OverworldInvertLookPitch: boolean;
  AimInvertLookPitch: boolean;
  BattleIntroCameraStartDistanceCm: number;
  BattleIntroCameraStartHeightCm: number;
  BattleIntroCameraEndDistanceCm: number;
  BattleIntroCameraEndHeightCm: number;
  BattleIntroDurationSec: number;
  BattleIntroFovDeg: number;
  BattleFollowFocusOffsetRightCm: number;
  BattleFollowFocusOffsetUpCm: number;
  BattleDropStartHeightCm: number;
  BattleDropDurationSec: number;
  BattlePromptDurationSec: number;
  BattleFollowShoulderOffsetCm: number;
  PlayerAimFovDeg: number;
  PlayerAimDistanceCm: number;
  PlayerAimShoulderOffsetCm: number;
  PlayerAimSocketUpCm: number;
  PlayerAimLookForwardDistanceCm: number;
  PlayerAimFocusOffsetRightCm: number;
  PlayerAimFocusOffsetUpCm: number;
  SkillPreviewFovDeg: number;
  SkillPreviewDistanceCm: number;
  SkillPreviewShoulderOffsetCm: number;
  SkillPreviewSocketUpCm: number;
  SkillPreviewLookForwardDistanceCm: number;
  SkillPreviewFocusOffsetRightCm: number;
  SkillPreviewFocusOffsetUpCm: number;
  ItemPreviewFovDeg: number;
  ItemPreviewDistanceCm: number;
  ItemPreviewLateralOffsetCm: number;
  ItemPreviewSocketUpCm: number;
  ItemPreviewLookAtHeightCm: number;
  ItemPreviewFocusOffsetRightCm: number;
  ItemPreviewFocusOffsetUpCm: number;
  TargetSelectCloseupDistanceCm: number;
  TargetSelectCloseupHeightCm: number;
  TargetSelectLookAtHeightCm: number;
  TargetSelectLateralOffsetCm: number;
  TargetSelectYawDeg: number;
  TargetSelectFovDeg: number;
  ActionResolveDurationSec: number;
  ActionResolveToastOffsetX: number;
  ActionResolveToastOffsetY: number;
  ActionResolveToastDurationSec: number;
  EnemyAttackCamDistanceCm: number;
  EnemyAttackCamHeightCm: number;
  SettlementCamDistanceCm: number;
  SettlementCamHeightCm: number;
  UnitModelChar01Path: string;
  UnitModelChar02Path: string;
  UnitModelChar03Path: string;
  ModelAxisFixPreset: "None" | "RotateY90" | "RotateYMinus90" | "RotateY180";
  FallbackToPlaceholderOnLoadFail: boolean;
  MuzzleSocketPrefix: string;
  ShowMuzzleSocketGizmo: boolean;
  UseFallbackMuzzleIfMissing: boolean;
}

const DefaultDebugConfig: FDebugConfig = {
  TargetArmLength: 200,
  CameraPitch: 22,
  CameraFov: 65,
  CameraLagSpeed: 5,
  CameraLagMaxDistance: 300,
  CameraOffsetRight: 50,
  CameraOffsetUp: 70,
  WalkSpeed: 300,
  RunSpeed: 500,
  LookPitchMin: -20,
  LookPitchMax: 55,
  OverworldInvertLookPitch: false,
  AimInvertLookPitch: true,
  BattleIntroCameraStartDistanceCm: 1200,
  BattleIntroCameraStartHeightCm: 420,
  BattleIntroCameraEndDistanceCm: 520,
  BattleIntroCameraEndHeightCm: 180,
  BattleIntroDurationSec: 1.35,
  BattleIntroFovDeg: 58,
  BattleFollowFocusOffsetRightCm: 110,
  BattleFollowFocusOffsetUpCm: 0,
  BattleDropStartHeightCm: 460,
  BattleDropDurationSec: 0.82,
  BattlePromptDurationSec: 0.55,
  BattleFollowShoulderOffsetCm: 0,
  PlayerAimFovDeg: 52,
  PlayerAimDistanceCm: 360,
  PlayerAimShoulderOffsetCm: 45,
  PlayerAimSocketUpCm: 145,
  PlayerAimLookForwardDistanceCm: 620,
  PlayerAimFocusOffsetRightCm: 0,
  PlayerAimFocusOffsetUpCm: 0,
  SkillPreviewFovDeg: 52,
  SkillPreviewDistanceCm: 360,
  SkillPreviewShoulderOffsetCm: 45,
  SkillPreviewSocketUpCm: 145,
  SkillPreviewLookForwardDistanceCm: 620,
  SkillPreviewFocusOffsetRightCm: 0,
  SkillPreviewFocusOffsetUpCm: 0,
  ItemPreviewFovDeg: 52,
  ItemPreviewDistanceCm: 360,
  ItemPreviewLateralOffsetCm: -45,
  ItemPreviewSocketUpCm: 145,
  ItemPreviewLookAtHeightCm: 95,
  ItemPreviewFocusOffsetRightCm: 0,
  ItemPreviewFocusOffsetUpCm: 0,
  TargetSelectCloseupDistanceCm: 210,
  TargetSelectCloseupHeightCm: 135,
  TargetSelectLookAtHeightCm: 95,
  TargetSelectLateralOffsetCm: 20,
  TargetSelectYawDeg: 180,
  TargetSelectFovDeg: 38,
  ActionResolveDurationSec: 0.65,
  ActionResolveToastOffsetX: 0,
  ActionResolveToastOffsetY: -180,
  ActionResolveToastDurationSec: 0.65,
  EnemyAttackCamDistanceCm: 360,
  EnemyAttackCamHeightCm: 130,
  SettlementCamDistanceCm: 760,
  SettlementCamHeightCm: 280,
  UnitModelChar01Path: "/assets/models/characters/SM_Char01.glb",
  UnitModelChar02Path: "/assets/models/characters/SM_Char02.glb",
  UnitModelChar03Path: "/assets/models/characters/SM_Char03.glb",
  ModelAxisFixPreset: "None",
  FallbackToPlaceholderOnLoadFail: true,
  MuzzleSocketPrefix: "SOCKET_Muzzle",
  ShowMuzzleSocketGizmo: false,
  UseFallbackMuzzleIfMissing: true
};

export class UDebugConfigStore {
  public GetDefaultConfig(): FDebugConfig {
    return { ...DefaultDebugConfig };
  }

  public Load(): FDebugConfigStoragePayload {
    const DefaultPayload: FDebugConfigStoragePayload = {
      Config: this.GetDefaultConfig(),
      LastUpdatedAtIso: null
    };
    if (!this.CanUseStorage()) {
      return DefaultPayload;
    }

    const V5Payload = this.TryReadPayload(DebugConfigStorageKeyV5);
    if (V5Payload) {
      return {
        Config: this.SanitizeConfig(V5Payload.Config, this.GetDefaultConfig()),
        LastUpdatedAtIso: V5Payload.LastUpdatedAtIso
      };
    }

    const V4Payload = this.TryReadPayload(DebugConfigStorageKeyV4);
    if (V4Payload) {
      const MigratedConfig = this.MigrateConfigToV5(
        this.SanitizeConfig(V4Payload.Config, this.GetDefaultConfig())
      );
      const MigratedPayload: FDebugConfigStoragePayload = {
        Config: MigratedConfig,
        LastUpdatedAtIso: V4Payload.LastUpdatedAtIso
      };
      window.localStorage.setItem(DebugConfigStorageKeyV5, JSON.stringify(MigratedPayload));
      return {
        Config: MigratedConfig,
        LastUpdatedAtIso: MigratedPayload.LastUpdatedAtIso
      };
    }

    const V3Payload = this.TryReadPayload(DebugConfigStorageKeyV3);
    if (V3Payload) {
      const MigratedPayload: FDebugConfigStoragePayload = {
        Config: this.MigrateConfigToV5(
          this.SanitizeConfig(V3Payload.Config, this.GetDefaultConfig())
        ),
        LastUpdatedAtIso: V3Payload.LastUpdatedAtIso
      };
      window.localStorage.setItem(DebugConfigStorageKeyV5, JSON.stringify(MigratedPayload));
      return MigratedPayload;
    }

    const V2Payload = this.TryReadPayload(DebugConfigStorageKeyV2);
    if (!V2Payload) {
      return DefaultPayload;
    }

    const MigratedPayload: FDebugConfigStoragePayload = {
      Config: this.MigrateConfigToV5(
        this.SanitizeConfig(V2Payload.Config, this.GetDefaultConfig())
      ),
      LastUpdatedAtIso: V2Payload.LastUpdatedAtIso
    };
    window.localStorage.setItem(DebugConfigStorageKeyV5, JSON.stringify(MigratedPayload));
    return MigratedPayload;
  }

  public Save(Config: FDebugConfig): string {
    const Payload: FDebugConfigStoragePayload = {
      Config: this.SanitizeConfig(Config, this.GetDefaultConfig()),
      LastUpdatedAtIso: new Date().toISOString()
    };

    if (this.CanUseStorage()) {
      window.localStorage.setItem(DebugConfigStorageKeyV5, JSON.stringify(Payload));
    }

    return Payload.LastUpdatedAtIso ?? "";
  }

  public ApplyPatch(Current: FDebugConfig, Patch: Partial<FDebugConfig>): FDebugConfig {
    return this.SanitizeConfig(Patch, Current);
  }

  public ImportJson(JsonText: string, Current: FDebugConfig): FDebugConfig {
    const Parsed = JSON.parse(JsonText) as Partial<FDebugConfig>;
    return this.SanitizeConfig(Parsed, Current);
  }

  public ExportJson(Config: FDebugConfig): string {
    const Sanitized = this.SanitizeConfig(Config, this.GetDefaultConfig());
    return JSON.stringify(Sanitized, null, 2);
  }

  private TryReadPayload(StorageKey: string): FDebugConfigStoragePayload | null {
    if (!this.CanUseStorage()) {
      return null;
    }

    const Raw = window.localStorage.getItem(StorageKey);
    if (!Raw) {
      return null;
    }

    try {
      const Parsed = JSON.parse(Raw) as Partial<FDebugConfigStoragePayload>;
      return {
        Config: this.SanitizeConfig(Parsed.Config, this.GetDefaultConfig()),
        LastUpdatedAtIso:
          typeof Parsed.LastUpdatedAtIso === "string" ? Parsed.LastUpdatedAtIso : null
      };
    } catch {
      return null;
    }
  }

  private SanitizeConfig(
    Input: Partial<FDebugConfig> | undefined,
    Base: FDebugConfig
  ): FDebugConfig {
    const Source = Input ?? {};
    const WalkSpeed = this.Clamp(this.ResolveNumber(Source, "WalkSpeed", Base.WalkSpeed), 50, 2000);
    const RunSpeed = this.Clamp(
      this.ResolveNumber(Source, "RunSpeed", Base.RunSpeed),
      WalkSpeed,
      3000
    );
    const LookPitchMin = this.Clamp(
      this.ResolveNumber(Source, "LookPitchMin", Base.LookPitchMin),
      -80,
      0
    );
    const LookPitchMax = this.Clamp(
      this.ResolveNumber(Source, "LookPitchMax", Base.LookPitchMax),
      LookPitchMin + 1,
      80
    );

    return {
      TargetArmLength: this.Clamp(
        this.ResolveNumber(Source, "TargetArmLength", Base.TargetArmLength),
        10,
        2800
      ),
      CameraPitch: this.Clamp(
        this.ResolveNumber(Source, "CameraPitch", Base.CameraPitch),
        LookPitchMin,
        LookPitchMax
      ),
      CameraFov: this.Clamp(this.ResolveNumber(Source, "CameraFov", Base.CameraFov), 40, 110),
      CameraLagSpeed: this.Clamp(
        this.ResolveNumber(Source, "CameraLagSpeed", Base.CameraLagSpeed),
        0,
        20
      ),
      CameraLagMaxDistance: this.Clamp(
        this.ResolveNumber(Source, "CameraLagMaxDistance", Base.CameraLagMaxDistance),
        0,
        1200
      ),
      CameraOffsetRight: this.Clamp(
        this.ResolveNumber(Source, "CameraOffsetRight", Base.CameraOffsetRight),
        -600,
        600
      ),
      CameraOffsetUp: this.Clamp(
        this.ResolveNumber(Source, "CameraOffsetUp", Base.CameraOffsetUp),
        -300,
        500
      ),
      WalkSpeed,
      RunSpeed,
      LookPitchMin,
      LookPitchMax,
      OverworldInvertLookPitch: this.ResolveBoolean(
        Source,
        "OverworldInvertLookPitch",
        Base.OverworldInvertLookPitch
      ),
      AimInvertLookPitch: this.ResolveBoolean(
        Source,
        "AimInvertLookPitch",
        Base.AimInvertLookPitch
      ),
      BattleIntroCameraStartDistanceCm: this.Clamp(
        this.ResolveNumber(
          Source,
          "BattleIntroCameraStartDistanceCm",
          Base.BattleIntroCameraStartDistanceCm
        ),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      BattleIntroCameraStartHeightCm: this.Clamp(
        this.ResolveNumber(
          Source,
          "BattleIntroCameraStartHeightCm",
          Base.BattleIntroCameraStartHeightCm
        ),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      BattleIntroCameraEndDistanceCm: this.Clamp(
        this.ResolveNumber(
          Source,
          "BattleIntroCameraEndDistanceCm",
          Base.BattleIntroCameraEndDistanceCm
        ),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      BattleIntroCameraEndHeightCm: this.Clamp(
        this.ResolveNumber(
          Source,
          "BattleIntroCameraEndHeightCm",
          Base.BattleIntroCameraEndHeightCm
        ),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      BattleIntroDurationSec: this.Clamp(
        this.ResolveNumber(Source, "BattleIntroDurationSec", Base.BattleIntroDurationSec),
        DebugWideDurationMinSec,
        DebugWideDurationMaxSec
      ),
      BattleIntroFovDeg: this.Clamp(
        this.ResolveNumber(Source, "BattleIntroFovDeg", Base.BattleIntroFovDeg),
        DebugWideFovMinDeg,
        DebugWideFovMaxDeg
      ),
      BattleFollowFocusOffsetRightCm: this.Clamp(
        this.ResolveNumber(
          Source,
          "BattleFollowFocusOffsetRightCm",
          Base.BattleFollowFocusOffsetRightCm
        ),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      BattleFollowFocusOffsetUpCm: this.Clamp(
        this.ResolveNumber(Source, "BattleFollowFocusOffsetUpCm", Base.BattleFollowFocusOffsetUpCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      BattleDropStartHeightCm: this.Clamp(
        this.ResolveNumber(Source, "BattleDropStartHeightCm", Base.BattleDropStartHeightCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      BattleDropDurationSec: this.Clamp(
        this.ResolveNumber(Source, "BattleDropDurationSec", Base.BattleDropDurationSec),
        DebugWideDurationMinSec,
        DebugWideDurationMaxSec
      ),
      BattlePromptDurationSec: this.Clamp(
        this.ResolveNumber(Source, "BattlePromptDurationSec", Base.BattlePromptDurationSec),
        DebugWideDurationMinSec,
        DebugWideDurationMaxSec
      ),
      BattleFollowShoulderOffsetCm: this.Clamp(
        this.ResolveNumber(
          Source,
          "BattleFollowShoulderOffsetCm",
          Base.BattleFollowShoulderOffsetCm
        ),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      PlayerAimFovDeg: this.Clamp(
        this.ResolveNumber(Source, "PlayerAimFovDeg", Base.PlayerAimFovDeg),
        DebugWideFovMinDeg,
        DebugWideFovMaxDeg
      ),
      PlayerAimDistanceCm: this.Clamp(
        this.ResolveNumber(Source, "PlayerAimDistanceCm", Base.PlayerAimDistanceCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      PlayerAimShoulderOffsetCm: this.Clamp(
        this.ResolveNumber(Source, "PlayerAimShoulderOffsetCm", Base.PlayerAimShoulderOffsetCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      PlayerAimSocketUpCm: this.Clamp(
        this.ResolveNumber(Source, "PlayerAimSocketUpCm", Base.PlayerAimSocketUpCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      PlayerAimLookForwardDistanceCm: this.Clamp(
        this.ResolveNumber(
          Source,
          "PlayerAimLookForwardDistanceCm",
          Base.PlayerAimLookForwardDistanceCm
        ),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      PlayerAimFocusOffsetRightCm: this.Clamp(
        this.ResolveNumber(Source, "PlayerAimFocusOffsetRightCm", Base.PlayerAimFocusOffsetRightCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      PlayerAimFocusOffsetUpCm: this.Clamp(
        this.ResolveNumber(Source, "PlayerAimFocusOffsetUpCm", Base.PlayerAimFocusOffsetUpCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      SkillPreviewFovDeg: this.Clamp(
        this.ResolveNumber(Source, "SkillPreviewFovDeg", Base.SkillPreviewFovDeg),
        DebugWideFovMinDeg,
        DebugWideFovMaxDeg
      ),
      SkillPreviewDistanceCm: this.Clamp(
        this.ResolveNumber(Source, "SkillPreviewDistanceCm", Base.SkillPreviewDistanceCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      SkillPreviewShoulderOffsetCm: this.Clamp(
        this.ResolveNumber(
          Source,
          "SkillPreviewShoulderOffsetCm",
          Base.SkillPreviewShoulderOffsetCm
        ),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      SkillPreviewSocketUpCm: this.Clamp(
        this.ResolveNumber(Source, "SkillPreviewSocketUpCm", Base.SkillPreviewSocketUpCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      SkillPreviewLookForwardDistanceCm: this.Clamp(
        this.ResolveNumber(
          Source,
          "SkillPreviewLookForwardDistanceCm",
          Base.SkillPreviewLookForwardDistanceCm
        ),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      SkillPreviewFocusOffsetRightCm: this.Clamp(
        this.ResolveNumber(
          Source,
          "SkillPreviewFocusOffsetRightCm",
          Base.SkillPreviewFocusOffsetRightCm
        ),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      SkillPreviewFocusOffsetUpCm: this.Clamp(
        this.ResolveNumber(Source, "SkillPreviewFocusOffsetUpCm", Base.SkillPreviewFocusOffsetUpCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      ItemPreviewFovDeg: this.Clamp(
        this.ResolveNumber(Source, "ItemPreviewFovDeg", Base.ItemPreviewFovDeg),
        DebugWideFovMinDeg,
        DebugWideFovMaxDeg
      ),
      ItemPreviewDistanceCm: this.Clamp(
        this.ResolveNumber(Source, "ItemPreviewDistanceCm", Base.ItemPreviewDistanceCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      ItemPreviewLateralOffsetCm: this.Clamp(
        this.ResolveNumber(Source, "ItemPreviewLateralOffsetCm", Base.ItemPreviewLateralOffsetCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      ItemPreviewSocketUpCm: this.Clamp(
        this.ResolveNumber(Source, "ItemPreviewSocketUpCm", Base.ItemPreviewSocketUpCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      ItemPreviewLookAtHeightCm: this.Clamp(
        this.ResolveNumber(Source, "ItemPreviewLookAtHeightCm", Base.ItemPreviewLookAtHeightCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      ItemPreviewFocusOffsetRightCm: this.Clamp(
        this.ResolveNumber(
          Source,
          "ItemPreviewFocusOffsetRightCm",
          Base.ItemPreviewFocusOffsetRightCm
        ),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      ItemPreviewFocusOffsetUpCm: this.Clamp(
        this.ResolveNumber(Source, "ItemPreviewFocusOffsetUpCm", Base.ItemPreviewFocusOffsetUpCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      TargetSelectCloseupDistanceCm: this.Clamp(
        this.ResolveNumber(
          Source,
          "TargetSelectCloseupDistanceCm",
          Base.TargetSelectCloseupDistanceCm
        ),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      TargetSelectCloseupHeightCm: this.Clamp(
        this.ResolveNumber(Source, "TargetSelectCloseupHeightCm", Base.TargetSelectCloseupHeightCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      TargetSelectLookAtHeightCm: this.Clamp(
        this.ResolveNumber(Source, "TargetSelectLookAtHeightCm", Base.TargetSelectLookAtHeightCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      TargetSelectLateralOffsetCm: this.Clamp(
        this.ResolveNumber(Source, "TargetSelectLateralOffsetCm", Base.TargetSelectLateralOffsetCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      TargetSelectYawDeg: this.Clamp(
        this.ResolveNumber(Source, "TargetSelectYawDeg", Base.TargetSelectYawDeg),
        DebugWideYawMinDeg,
        DebugWideYawMaxDeg
      ),
      TargetSelectFovDeg: this.Clamp(
        this.ResolveNumber(Source, "TargetSelectFovDeg", Base.TargetSelectFovDeg),
        DebugWideFovMinDeg,
        DebugWideFovMaxDeg
      ),
      ActionResolveDurationSec: this.Clamp(
        this.ResolveNumber(Source, "ActionResolveDurationSec", Base.ActionResolveDurationSec),
        DebugWideDurationMinSec,
        DebugWideDurationMaxSec
      ),
      ActionResolveToastOffsetX: this.Clamp(
        this.ResolveNumber(Source, "ActionResolveToastOffsetX", Base.ActionResolveToastOffsetX),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      ActionResolveToastOffsetY: this.Clamp(
        this.ResolveNumber(Source, "ActionResolveToastOffsetY", Base.ActionResolveToastOffsetY),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      ActionResolveToastDurationSec: this.Clamp(
        this.ResolveNumber(
          Source,
          "ActionResolveToastDurationSec",
          Base.ActionResolveToastDurationSec
        ),
        DebugWideDurationMinSec,
        DebugWideDurationMaxSec
      ),
      EnemyAttackCamDistanceCm: this.Clamp(
        this.ResolveNumber(Source, "EnemyAttackCamDistanceCm", Base.EnemyAttackCamDistanceCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      EnemyAttackCamHeightCm: this.Clamp(
        this.ResolveNumber(Source, "EnemyAttackCamHeightCm", Base.EnemyAttackCamHeightCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      SettlementCamDistanceCm: this.Clamp(
        this.ResolveNumber(Source, "SettlementCamDistanceCm", Base.SettlementCamDistanceCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      SettlementCamHeightCm: this.Clamp(
        this.ResolveNumber(Source, "SettlementCamHeightCm", Base.SettlementCamHeightCm),
        DebugWideCmMin,
        DebugWideCmMax
      ),
      UnitModelChar01Path: this.ResolveString(
        Source,
        "UnitModelChar01Path",
        Base.UnitModelChar01Path
      ),
      UnitModelChar02Path: this.ResolveString(
        Source,
        "UnitModelChar02Path",
        Base.UnitModelChar02Path
      ),
      UnitModelChar03Path: this.ResolveString(
        Source,
        "UnitModelChar03Path",
        Base.UnitModelChar03Path
      ),
      ModelAxisFixPreset: this.ResolveModelAxisFixPreset(
        Source.ModelAxisFixPreset,
        Base.ModelAxisFixPreset
      ),
      FallbackToPlaceholderOnLoadFail: this.ResolveBoolean(
        Source,
        "FallbackToPlaceholderOnLoadFail",
        Base.FallbackToPlaceholderOnLoadFail
      ),
      MuzzleSocketPrefix: this.ResolveString(Source, "MuzzleSocketPrefix", Base.MuzzleSocketPrefix),
      ShowMuzzleSocketGizmo: this.ResolveBoolean(
        Source,
        "ShowMuzzleSocketGizmo",
        Base.ShowMuzzleSocketGizmo
      ),
      UseFallbackMuzzleIfMissing: this.ResolveBoolean(
        Source,
        "UseFallbackMuzzleIfMissing",
        Base.UseFallbackMuzzleIfMissing
      )
    };
  }

  private MigrateConfigToV5(Config: FDebugConfig): FDebugConfig {
    // V5: 统一把历史默认的 RotateYMinus90 调整为 None（整体右转 90 度）。
    if (Config.ModelAxisFixPreset === "RotateYMinus90") {
      return {
        ...Config,
        ModelAxisFixPreset: "None"
      };
    }
    return Config;
  }

  private ResolveNumber(
    Source: Partial<FDebugConfig>,
    Key: keyof FDebugConfig,
    Fallback: number
  ): number {
    return this.PickNumber(Source[Key], Fallback);
  }

  private ResolveString(
    Source: Partial<FDebugConfig>,
    Key: keyof FDebugConfig,
    Fallback: string
  ): string {
    return this.PickString(Source[Key], Fallback);
  }

  private ResolveBoolean(
    Source: Partial<FDebugConfig>,
    Key: keyof FDebugConfig,
    Fallback: boolean
  ): boolean {
    return this.PickBoolean(Source[Key], Fallback);
  }

  private ResolveModelAxisFixPreset(
    Value: unknown,
    Fallback: FDebugConfig["ModelAxisFixPreset"]
  ): FDebugConfig["ModelAxisFixPreset"] {
    if (
      Value === "None" ||
      Value === "RotateY90" ||
      Value === "RotateYMinus90" ||
      Value === "RotateY180"
    ) {
      return Value;
    }

    return Fallback;
  }

  private PickNumber(Value: unknown, Fallback: number): number {
    return typeof Value === "number" && Number.isFinite(Value) ? Value : Fallback;
  }

  private PickString(Value: unknown, Fallback: string): string {
    return typeof Value === "string" ? Value : Fallback;
  }

  private PickBoolean(Value: unknown, Fallback: boolean): boolean {
    return typeof Value === "boolean" ? Value : Fallback;
  }

  private Clamp(Value: number, Min: number, Max: number): number {
    return Math.min(Math.max(Value, Min), Max);
  }

  private CanUseStorage(): boolean {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  }
}
