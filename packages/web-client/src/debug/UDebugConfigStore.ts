const DebugConfigStorageKeyV2 = "FD_DEBUG_CONFIG_V2";
const DebugConfigStorageKeyV3 = "FD_DEBUG_CONFIG_V3";
const DebugConfigStorageKeyV4 = "FD_DEBUG_CONFIG_V4";
const DebugConfigStorageKeyV5 = "FD_DEBUG_CONFIG_V5";

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
  BattleIntroCameraStartDistanceCm: number;
  BattleIntroCameraStartHeightCm: number;
  BattleIntroCameraEndDistanceCm: number;
  BattleIntroCameraEndHeightCm: number;
  BattleIntroDurationSec: number;
  BattleIntroFovDeg: number;
  BattleDropStartHeightCm: number;
  BattleDropDurationSec: number;
  BattlePromptDurationSec: number;
  BattleFollowShoulderOffsetCm: number;
  PlayerAimFovDeg: number;
  PlayerAimShoulderOffsetCm: number;
  SkillTargetZoomDistanceCm: number;
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
  BattleIntroCameraStartDistanceCm: 1200,
  BattleIntroCameraStartHeightCm: 420,
  BattleIntroCameraEndDistanceCm: 520,
  BattleIntroCameraEndHeightCm: 180,
  BattleIntroDurationSec: 1.35,
  BattleIntroFovDeg: 58,
  BattleDropStartHeightCm: 460,
  BattleDropDurationSec: 0.82,
  BattlePromptDurationSec: 0.55,
  BattleFollowShoulderOffsetCm: 0,
  PlayerAimFovDeg: 52,
  PlayerAimShoulderOffsetCm: 45,
  SkillTargetZoomDistanceCm: 420,
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
      BattleIntroCameraStartDistanceCm: this.Clamp(
        this.ResolveNumber(
          Source,
          "BattleIntroCameraStartDistanceCm",
          Base.BattleIntroCameraStartDistanceCm
        ),
        200,
        6000
      ),
      BattleIntroCameraStartHeightCm: this.Clamp(
        this.ResolveNumber(
          Source,
          "BattleIntroCameraStartHeightCm",
          Base.BattleIntroCameraStartHeightCm
        ),
        20,
        3000
      ),
      BattleIntroCameraEndDistanceCm: this.Clamp(
        this.ResolveNumber(
          Source,
          "BattleIntroCameraEndDistanceCm",
          Base.BattleIntroCameraEndDistanceCm
        ),
        120,
        3200
      ),
      BattleIntroCameraEndHeightCm: this.Clamp(
        this.ResolveNumber(
          Source,
          "BattleIntroCameraEndHeightCm",
          Base.BattleIntroCameraEndHeightCm
        ),
        20,
        1400
      ),
      BattleIntroDurationSec: this.Clamp(
        this.ResolveNumber(Source, "BattleIntroDurationSec", Base.BattleIntroDurationSec),
        0.1,
        8
      ),
      BattleIntroFovDeg: this.Clamp(
        this.ResolveNumber(Source, "BattleIntroFovDeg", Base.BattleIntroFovDeg),
        30,
        110
      ),
      BattleDropStartHeightCm: this.Clamp(
        this.ResolveNumber(Source, "BattleDropStartHeightCm", Base.BattleDropStartHeightCm),
        0,
        3000
      ),
      BattleDropDurationSec: this.Clamp(
        this.ResolveNumber(Source, "BattleDropDurationSec", Base.BattleDropDurationSec),
        0.1,
        5
      ),
      BattlePromptDurationSec: this.Clamp(
        this.ResolveNumber(Source, "BattlePromptDurationSec", Base.BattlePromptDurationSec),
        0.1,
        6
      ),
      BattleFollowShoulderOffsetCm: this.Clamp(
        this.ResolveNumber(
          Source,
          "BattleFollowShoulderOffsetCm",
          Base.BattleFollowShoulderOffsetCm
        ),
        -220,
        220
      ),
      PlayerAimFovDeg: this.Clamp(
        this.ResolveNumber(Source, "PlayerAimFovDeg", Base.PlayerAimFovDeg),
        20,
        95
      ),
      PlayerAimShoulderOffsetCm: this.Clamp(
        this.ResolveNumber(Source, "PlayerAimShoulderOffsetCm", Base.PlayerAimShoulderOffsetCm),
        -300,
        300
      ),
      SkillTargetZoomDistanceCm: this.Clamp(
        this.ResolveNumber(Source, "SkillTargetZoomDistanceCm", Base.SkillTargetZoomDistanceCm),
        120,
        2600
      ),
      EnemyAttackCamDistanceCm: this.Clamp(
        this.ResolveNumber(Source, "EnemyAttackCamDistanceCm", Base.EnemyAttackCamDistanceCm),
        120,
        2200
      ),
      EnemyAttackCamHeightCm: this.Clamp(
        this.ResolveNumber(Source, "EnemyAttackCamHeightCm", Base.EnemyAttackCamHeightCm),
        20,
        1200
      ),
      SettlementCamDistanceCm: this.Clamp(
        this.ResolveNumber(Source, "SettlementCamDistanceCm", Base.SettlementCamDistanceCm),
        200,
        3600
      ),
      SettlementCamHeightCm: this.Clamp(
        this.ResolveNumber(Source, "SettlementCamHeightCm", Base.SettlementCamHeightCm),
        40,
        1800
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
