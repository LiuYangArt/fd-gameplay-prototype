const DebugConfigStorageKey = "FD_DEBUG_CONFIG_V1";

interface FDebugConfigStoragePayload {
  Config: FDebugConfig;
  LastUpdatedAtIso: string | null;
}

export interface FDebugConfig {
  CameraDistance: number;
  CameraPitch: number;
  CameraFov: number;
  CameraOffsetRight: number;
  CameraOffsetUp: number;
  WalkSpeed: number;
  RunSpeed: number;
  LookPitchMin: number;
  LookPitchMax: number;
}

const DefaultDebugConfig: FDebugConfig = {
  CameraDistance: 1000,
  CameraPitch: 22,
  CameraFov: 65,
  CameraOffsetRight: 0,
  CameraOffsetUp: 0,
  WalkSpeed: 420,
  RunSpeed: 750,
  LookPitchMin: -20,
  LookPitchMax: 55
};

export class UDebugConfigStore {
  public GetDefaultConfig(): FDebugConfig {
    return { ...DefaultDebugConfig };
  }

  public Load(): FDebugConfigStoragePayload {
    if (!this.CanUseStorage()) {
      return {
        Config: this.GetDefaultConfig(),
        LastUpdatedAtIso: null
      };
    }

    const Raw = window.localStorage.getItem(DebugConfigStorageKey);
    if (!Raw) {
      return {
        Config: this.GetDefaultConfig(),
        LastUpdatedAtIso: null
      };
    }

    try {
      const Parsed = JSON.parse(Raw) as Partial<FDebugConfigStoragePayload>;
      return {
        Config: this.SanitizeConfig(Parsed.Config, this.GetDefaultConfig()),
        LastUpdatedAtIso:
          typeof Parsed.LastUpdatedAtIso === "string" ? Parsed.LastUpdatedAtIso : null
      };
    } catch {
      return {
        Config: this.GetDefaultConfig(),
        LastUpdatedAtIso: null
      };
    }
  }

  public Save(Config: FDebugConfig): string {
    const Payload: FDebugConfigStoragePayload = {
      Config: this.SanitizeConfig(Config, this.GetDefaultConfig()),
      LastUpdatedAtIso: new Date().toISOString()
    };

    if (this.CanUseStorage()) {
      window.localStorage.setItem(DebugConfigStorageKey, JSON.stringify(Payload));
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

  private SanitizeConfig(
    Input: Partial<FDebugConfig> | undefined,
    Base: FDebugConfig
  ): FDebugConfig {
    const WalkSpeed = this.Clamp(this.PickNumber(Input?.WalkSpeed, Base.WalkSpeed), 50, 2000);
    const RunSpeed = this.Clamp(this.PickNumber(Input?.RunSpeed, Base.RunSpeed), WalkSpeed, 3000);
    const LookPitchMin = this.Clamp(
      this.PickNumber(Input?.LookPitchMin, Base.LookPitchMin),
      -80,
      0
    );
    const LookPitchMax = this.Clamp(
      this.PickNumber(Input?.LookPitchMax, Base.LookPitchMax),
      LookPitchMin + 1,
      80
    );

    return {
      CameraDistance: this.Clamp(
        this.PickNumber(Input?.CameraDistance, Base.CameraDistance),
        10,
        2800
      ),
      CameraPitch: this.Clamp(
        this.PickNumber(Input?.CameraPitch, Base.CameraPitch),
        LookPitchMin,
        LookPitchMax
      ),
      CameraFov: this.Clamp(this.PickNumber(Input?.CameraFov, Base.CameraFov), 40, 110),
      CameraOffsetRight: this.Clamp(
        this.PickNumber(Input?.CameraOffsetRight, Base.CameraOffsetRight),
        -600,
        600
      ),
      CameraOffsetUp: this.Clamp(
        this.PickNumber(Input?.CameraOffsetUp, Base.CameraOffsetUp),
        -300,
        500
      ),
      WalkSpeed: this.Clamp(WalkSpeed, 50, 2000),
      RunSpeed: this.Clamp(RunSpeed, WalkSpeed, 3000),
      LookPitchMin,
      LookPitchMax
    };
  }

  private PickNumber(Value: unknown, Fallback: number): number {
    return typeof Value === "number" && Number.isFinite(Value) ? Value : Fallback;
  }

  private Clamp(Value: number, Min: number, Max: number): number {
    return Math.min(Math.max(Value, Min), Max);
  }

  private CanUseStorage(): boolean {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  }
}
