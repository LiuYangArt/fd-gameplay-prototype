import { UTeamPackageValidator } from "../../team/validator/UTeamPackageValidator";
import { EOverworldCommandType } from "../commands/EOverworldCommandType";
import { EOverworldPhase } from "../enums/EOverworldPhase";
import { EOverworldEventType } from "../events/EOverworldEventType";
import {
  CreateDefaultOverworldTuning,
  CreateDefaultOverworldWorldConfig,
  CreateEmptyOverworldState,
  type FOverworldEnemyState,
  type FOverworldPlayerState,
  type FOverworldTeamSeedConfig,
  type FOverworldTuningSnapshot,
  type FOverworldVector2,
  type FOverworldWorldConfig
} from "../state/FOverworldState";
import { UOverworldStateStore } from "../state/UOverworldStateStore";

import type {
  FTeamPackageSnapshot,
  FUnitCombatRuntimeSnapshot,
  FUnitStaticConfig
} from "../../team/state/FTeamPackageSnapshot";
import type { FOverworldCommand, FStepCommand } from "../commands/FOverworldCommand";
import type {
  FOverworldEvent,
  FOverworldEventPayloadMap,
  FTypedOverworldEvent
} from "../events/FOverworldEvent";

type FOverworldEventListener<TType extends EOverworldEventType> = (
  Event: FTypedOverworldEvent<TType>
) => void;

interface FResolvedWorldConfig extends Omit<FOverworldWorldConfig, "Tuning"> {
  Tuning: FOverworldTuningSnapshot;
}

interface FTeamSeedContext {
  ControlledTeamId: string;
  TeamPackages: FTeamPackageSnapshot[];
  UnitStaticConfigs: FUnitStaticConfig[];
  UnitRuntimeSnapshots: FUnitCombatRuntimeSnapshot[];
  EnemyTeamBindings: Record<string, string>;
}

export class UOverworldSimulation {
  private readonly StateStore: UOverworldStateStore;
  private readonly EventHistory: FOverworldEvent[];
  private readonly TeamPackageValidator: UTeamPackageValidator;
  private readonly Listeners: {
    [K in EOverworldEventType]: Set<FOverworldEventListener<K>>;
  };
  private NextEventId: number;

  public constructor() {
    this.StateStore = new UOverworldStateStore(CreateEmptyOverworldState());
    this.EventHistory = [];
    this.TeamPackageValidator = new UTeamPackageValidator();
    this.NextEventId = 1;
    this.Listeners = {
      [EOverworldEventType.WorldInitialized]: new Set(),
      [EOverworldEventType.PlayerMoved]: new Set(),
      [EOverworldEventType.EnemyMoved]: new Set(),
      [EOverworldEventType.EncounterTriggered]: new Set(),
      [EOverworldEventType.EncounterResolved]: new Set(),
      [EOverworldEventType.PlayerResetToSafePoint]: new Set(),
      [EOverworldEventType.TeamValidationFailed]: new Set()
    };
  }

  public GetState() {
    return this.StateStore.GetState();
  }

  public GetEventHistory(): readonly FOverworldEvent[] {
    return this.EventHistory;
  }

  public On<TType extends EOverworldEventType>(
    Type: TType,
    Listener: FOverworldEventListener<TType>
  ): () => void {
    const TypedSet = this.Listeners[Type] as Set<FOverworldEventListener<TType>>;
    TypedSet.add(Listener);
    return () => TypedSet.delete(Listener);
  }

  public SubmitCommand(Command: FOverworldCommand): boolean {
    switch (Command.Type) {
      case EOverworldCommandType.InitializeWorld:
        return this.HandleInitializeWorld(Command);
      case EOverworldCommandType.Step:
        return this.HandleStep(Command);
      case EOverworldCommandType.ResolveEncounter:
        return this.HandleResolveEncounter();
      case EOverworldCommandType.ResetPlayerToSafePoint:
        return this.HandleResetPlayerToSafePoint();
      default:
        return false;
    }
  }

  private HandleInitializeWorld(
    Command: Extract<FOverworldCommand, { Type: EOverworldCommandType.InitializeWorld }>
  ): boolean {
    const WorldConfig = this.ResolveWorldConfig(Command.Config);
    const Enemies = this.CreateSeedEnemies(
      WorldConfig.EnemyCount,
      WorldConfig.WorldHalfSize,
      WorldConfig.Tuning.EnemyRadius
    );

    const Player: FOverworldPlayerState = {
      Position: { ...WorldConfig.SafePoint },
      YawDegrees: 0
    };

    const TeamSeedContext = this.CreateTeamSeedContext(WorldConfig.TeamSeed, Enemies, WorldConfig);
    const InvalidTeam = TeamSeedContext.TeamPackages.find((TeamPackage) => {
      const ValidationResult = this.TeamPackageValidator.Validate(TeamPackage);
      if (ValidationResult.IsValid) {
        return false;
      }

      this.EmitTeamValidationFailed(
        TeamPackage.TeamId,
        "InitializeWorld 校验失败",
        ValidationResult.Issues.map((Issue) => Issue.Message),
        null
      );
      return true;
    });
    if (InvalidTeam) {
      return false;
    }

    const ControlledTeamExists = TeamSeedContext.TeamPackages.some(
      (TeamPackage) => TeamPackage.TeamId === TeamSeedContext.ControlledTeamId
    );
    if (!ControlledTeamExists) {
      this.EmitTeamValidationFailed(
        TeamSeedContext.ControlledTeamId,
        "InitializeWorld 缺少 ControlledTeamId 对应队伍",
        ["ControlledTeamId 不存在于 TeamPackages"],
        null
      );
      return false;
    }

    this.EmitEvent(EOverworldEventType.WorldInitialized, {
      WorldHalfSize: WorldConfig.WorldHalfSize,
      SafePoint: { ...WorldConfig.SafePoint },
      ControlledTeamId: TeamSeedContext.ControlledTeamId,
      Player,
      Enemies,
      Tuning: { ...WorldConfig.Tuning },
      TeamPackages: TeamSeedContext.TeamPackages,
      UnitStaticConfigs: TeamSeedContext.UnitStaticConfigs,
      UnitRuntimeSnapshots: TeamSeedContext.UnitRuntimeSnapshots,
      EnemyTeamBindings: { ...TeamSeedContext.EnemyTeamBindings }
    });

    return true;
  }

  private HandleStep(Command: FStepCommand): boolean {
    const State = this.GetState();
    if (State.Phase !== EOverworldPhase.Exploring) {
      return false;
    }

    const ControlledTeamId = State.ControlledTeamId;
    if (!ControlledTeamId) {
      this.EmitTeamValidationFailed(
        "UNKNOWN",
        "Step 缺少 ControlledTeamId",
        ["状态中 ControlledTeamId 为空"],
        null
      );
      return false;
    }

    const ControlledTeam = State.TeamPackages[ControlledTeamId];
    if (!ControlledTeam) {
      this.EmitTeamValidationFailed(
        ControlledTeamId,
        "Step 找不到 ControlledTeam",
        ["ControlledTeamId 不存在于 TeamPackages"],
        null
      );
      return false;
    }

    const DeltaSeconds = this.Clamp(Command.DeltaSeconds, 0, 0.25);
    if (DeltaSeconds <= 0) {
      return true;
    }

    const WalkSpeed = this.Clamp(
      Command.WalkSpeed ?? ControlledTeam.MoveConfig.WalkSpeedCmPerSec,
      10,
      10000
    );
    const RunSpeed = this.Clamp(
      Command.RunSpeed ?? ControlledTeam.MoveConfig.RunSpeedCmPerSec,
      WalkSpeed,
      16000
    );
    const MoveAxis = this.NormalizeAxis(Command.MoveAxis.X, Command.MoveAxis.Y);
    const MoveSpeed = Command.IsSprinting ? RunSpeed : WalkSpeed;
    const MoveDistance = MoveSpeed * DeltaSeconds;
    const NextYawDegrees = this.NormalizeDegrees(
      State.Player.YawDegrees + Command.LookYawDeltaDegrees
    );
    const NextPosition = this.CalculatePlayerPosition(
      State.Player.Position,
      NextYawDegrees,
      MoveAxis,
      {
        MoveDistance,
        WorldHalfSize: State.Tuning.WorldHalfSize
      }
    );

    this.EmitEvent(EOverworldEventType.PlayerMoved, {
      TeamId: ControlledTeamId,
      Position: NextPosition,
      YawDegrees: NextYawDegrees,
      IsSprinting: Command.IsSprinting,
      WalkSpeed,
      RunSpeed
    });

    const NextState = this.GetState();
    const NextEnemies = this.StepEnemies(NextState.Enemies, DeltaSeconds, NextState.Tuning);
    this.EmitEvent(EOverworldEventType.EnemyMoved, { Enemies: NextEnemies });

    const EncounterEnemy = this.FindEncounterEnemy(
      NextPosition,
      NextEnemies,
      NextState.Tuning.PlayerRadius,
      NextState.Tuning.EncounterDistance
    );
    if (!EncounterEnemy) {
      return true;
    }

    const EncounterId = this.CreateEncounterId(EncounterEnemy.EnemyId);
    const EnemyTeamId = NextState.EnemyTeamBindings[EncounterEnemy.EnemyId];
    if (!EnemyTeamId) {
      this.EmitTeamValidationFailed(
        "UNKNOWN_ENEMY_TEAM",
        `遭遇敌人 ${EncounterEnemy.EnemyId} 时缺少 EnemyTeamId`,
        ["EncounterTriggered 需要 EnemyTeamId"],
        EncounterId
      );
      return false;
    }

    const EnemyTeam = NextState.TeamPackages[EnemyTeamId];
    if (!EnemyTeam) {
      this.EmitTeamValidationFailed(
        EnemyTeamId,
        "遭遇敌人时 EnemyTeamId 未找到对应 TeamPackage",
        ["EnemyTeamId 不存在于 TeamPackages"],
        EncounterId
      );
      return false;
    }

    const EnemyValidation = this.TeamPackageValidator.Validate(EnemyTeam);
    if (!EnemyValidation.IsValid) {
      this.EmitTeamValidationFailed(
        EnemyTeamId,
        "遭遇敌人时 EnemyTeam 配置非法",
        EnemyValidation.Issues.map((Issue) => Issue.Message),
        EncounterId
      );
      return false;
    }

    this.EmitEvent(EOverworldEventType.EncounterTriggered, {
      EncounterId,
      PlayerTeamId: ControlledTeamId,
      EnemyTeamId,
      EnemyId: EncounterEnemy.EnemyId,
      PlayerPosition: { ...NextPosition },
      EnemyPosition: { ...EncounterEnemy.Position }
    });

    return true;
  }

  private HandleResolveEncounter(): boolean {
    const State = this.GetState();
    if (State.Phase !== EOverworldPhase.EncounterPending || !State.PendingEncounterEnemyId) {
      return false;
    }

    this.EmitEvent(EOverworldEventType.EncounterResolved, {
      EnemyId: State.PendingEncounterEnemyId
    });
    return true;
  }

  private HandleResetPlayerToSafePoint(): boolean {
    const State = this.GetState();
    this.EmitEvent(EOverworldEventType.PlayerResetToSafePoint, {
      Position: { ...State.SafePoint }
    });
    return true;
  }

  private ResolveWorldConfig(Config?: Partial<FOverworldWorldConfig>): FResolvedWorldConfig {
    const DefaultConfig = CreateDefaultOverworldWorldConfig();
    const DefaultTuning = CreateDefaultOverworldTuning();
    const NextWorldHalfSize = this.ResolveWorldHalfSize(Config, DefaultConfig);
    const NextEnemyCount = this.ResolveEnemyCount(Config, DefaultConfig);
    const SafePoint = this.ResolveSafePoint(Config, DefaultConfig, NextWorldHalfSize);
    const Tuning = this.ResolveTuning(Config, DefaultTuning, NextWorldHalfSize);

    return {
      EnemyCount: NextEnemyCount,
      WorldHalfSize: NextWorldHalfSize,
      SafePoint,
      Tuning,
      TeamSeed: Config?.TeamSeed
    };
  }

  private ResolveWorldHalfSize(
    Config: Partial<FOverworldWorldConfig> | undefined,
    DefaultConfig: FOverworldWorldConfig
  ): number {
    return this.Clamp(
      this.PickNumber(Config?.WorldHalfSize, DefaultConfig.WorldHalfSize),
      100,
      200000
    );
  }

  private ResolveEnemyCount(
    Config: Partial<FOverworldWorldConfig> | undefined,
    DefaultConfig: FOverworldWorldConfig
  ): number {
    return Math.round(
      this.Clamp(this.PickNumber(Config?.EnemyCount, DefaultConfig.EnemyCount), 1, 30)
    );
  }

  private ResolveSafePoint(
    Config: Partial<FOverworldWorldConfig> | undefined,
    DefaultConfig: FOverworldWorldConfig,
    WorldHalfSize: number
  ): FOverworldVector2 {
    return {
      X: this.Clamp(
        this.PickNumber(Config?.SafePoint?.X, DefaultConfig.SafePoint.X),
        -WorldHalfSize,
        WorldHalfSize
      ),
      Z: this.Clamp(
        this.PickNumber(Config?.SafePoint?.Z, DefaultConfig.SafePoint.Z),
        -WorldHalfSize,
        WorldHalfSize
      )
    };
  }

  private ResolveTuning(
    Config: Partial<FOverworldWorldConfig> | undefined,
    DefaultTuning: FOverworldTuningSnapshot,
    WorldHalfSize: number
  ): FOverworldTuningSnapshot {
    const RequestedTuning = Config?.Tuning;
    const WalkSpeed = this.Clamp(
      this.PickNumber(RequestedTuning?.WalkSpeed, DefaultTuning.WalkSpeed),
      10,
      10000
    );
    const RunSpeed = this.Clamp(
      this.PickNumber(RequestedTuning?.RunSpeed, DefaultTuning.RunSpeed),
      WalkSpeed,
      16000
    );

    return {
      ...DefaultTuning,
      ...RequestedTuning,
      WorldHalfSize,
      WalkSpeed,
      RunSpeed,
      EnemyWanderSpeed: this.Clamp(
        this.PickNumber(RequestedTuning?.EnemyWanderSpeed, DefaultTuning.EnemyWanderSpeed),
        0,
        2000
      ),
      EnemyWanderTurnSpeed: this.Clamp(
        this.PickNumber(RequestedTuning?.EnemyWanderTurnSpeed, DefaultTuning.EnemyWanderTurnSpeed),
        0,
        360
      ),
      EncounterDistance: this.Clamp(
        this.PickNumber(RequestedTuning?.EncounterDistance, DefaultTuning.EncounterDistance),
        20,
        400
      ),
      PlayerRadius: this.Clamp(
        this.PickNumber(RequestedTuning?.PlayerRadius, DefaultTuning.PlayerRadius),
        10,
        300
      ),
      EnemyRadius: this.Clamp(
        this.PickNumber(RequestedTuning?.EnemyRadius, DefaultTuning.EnemyRadius),
        10,
        300
      )
    };
  }

  private CreateSeedEnemies(
    EnemyCount: number,
    WorldHalfSize: number,
    EnemyRadius: number
  ): FOverworldEnemyState[] {
    const SpawnRadius = WorldHalfSize * 0.55;
    return Array.from({ length: EnemyCount }, (_, Index) => {
      const AngleRadians = (Math.PI * 2 * Index) / EnemyCount;
      const AngleDegrees = this.NormalizeDegrees((AngleRadians * 180) / Math.PI);
      return {
        EnemyId: `OW_ENEMY_${String(Index + 1).padStart(2, "0")}`,
        Position: {
          X: this.Round(Math.sin(AngleRadians) * SpawnRadius),
          Z: this.Round(Math.cos(AngleRadians) * SpawnRadius)
        },
        WanderYawDegrees: this.NormalizeDegrees(AngleDegrees + 180),
        Radius: EnemyRadius
      };
    });
  }

  private CreateTeamSeedContext(
    TeamSeed: FOverworldTeamSeedConfig | undefined,
    Enemies: FOverworldEnemyState[],
    WorldConfig: FResolvedWorldConfig
  ): FTeamSeedContext {
    const PlayerUnitIds = ["char01", "char02", "char03"];
    const UnitStaticConfigMap = new Map<string, FUnitStaticConfig>();
    const UnitRuntimeSnapshotMap = new Map<string, FUnitCombatRuntimeSnapshot>();
    const TeamPackageMap = new Map<string, FTeamPackageSnapshot>();

    const AddUnitSnapshotPair = (
      UnitConfig: FUnitStaticConfig,
      RuntimeSnapshot: FUnitCombatRuntimeSnapshot
    ) => {
      UnitStaticConfigMap.set(UnitConfig.UnitId, UnitConfig);
      UnitRuntimeSnapshotMap.set(RuntimeSnapshot.UnitId, RuntimeSnapshot);
    };

    PlayerUnitIds.forEach((UnitId, Index) => {
      AddUnitSnapshotPair(
        {
          UnitId,
          DisplayName: `Player ${Index + 1}`,
          BaseMaxHp: 140,
          BaseMaxMp: 90,
          BaseAttack: 32,
          BaseDefense: 18,
          BaseSpeed: 24,
          SkillIds: ["SKL_BASIC_SHOT", "SKL_POWER_SHOT"],
          Tags: ["Player"]
        },
        {
          UnitId,
          CurrentHp: 140,
          CurrentMp: 90,
          IsAlive: true,
          Cooldowns: {},
          StatusEffects: []
        }
      );
    });

    const PlayerTeamId = "TEAM_PLAYER_01";
    TeamPackageMap.set(PlayerTeamId, {
      Meta: {
        SchemaVersion: "1.0.0",
        DataRevision: 1
      },
      TeamId: PlayerTeamId,
      DisplayName: "Player Team",
      MoveConfig: {
        WalkSpeedCmPerSec: WorldConfig.Tuning.WalkSpeed,
        RunSpeedCmPerSec: WorldConfig.Tuning.RunSpeed
      },
      Roster: {
        TeamId: PlayerTeamId,
        MemberUnitIds: [...PlayerUnitIds]
      },
      Formation: {
        TeamId: PlayerTeamId,
        ActiveUnitIds: [...PlayerUnitIds],
        LeaderUnitId: PlayerUnitIds[0],
        OverworldDisplayUnitId: PlayerUnitIds[0]
      }
    });

    const EnemyTeamBindings: Record<string, string> = {};
    Enemies.forEach((Enemy, Index) => {
      const EnemyTeamId = `TEAM_${Enemy.EnemyId}`;
      const EnemyMainId = `${Enemy.EnemyId}_MAIN`;
      const EnemyGuardId = `${Enemy.EnemyId}_GUARD`;
      const EnemySupportId = `${Enemy.EnemyId}_SUPPORT`;
      const EnemyUnitIds = [EnemyMainId, EnemyGuardId, EnemySupportId];

      EnemyUnitIds.forEach((UnitId, UnitIndex) => {
        AddUnitSnapshotPair(
          {
            UnitId,
            DisplayName: `Enemy ${Index + 1}-${UnitIndex + 1}`,
            BaseMaxHp: UnitIndex === 0 ? 180 : 120,
            BaseMaxMp: 0,
            BaseAttack: UnitIndex === 2 ? 22 : 28,
            BaseDefense: UnitIndex === 0 ? 16 : 10,
            BaseSpeed: 14,
            SkillIds: ["SKL_ENEMY_BITE"],
            Tags: ["Enemy"]
          },
          {
            UnitId,
            CurrentHp: UnitIndex === 0 ? 180 : 120,
            CurrentMp: 0,
            IsAlive: true,
            Cooldowns: {},
            StatusEffects: []
          }
        );
      });

      TeamPackageMap.set(EnemyTeamId, {
        Meta: {
          SchemaVersion: "1.0.0",
          DataRevision: 1
        },
        TeamId: EnemyTeamId,
        DisplayName: `${Enemy.EnemyId} Team`,
        MoveConfig: {
          WalkSpeedCmPerSec: 260,
          RunSpeedCmPerSec: 420
        },
        Roster: {
          TeamId: EnemyTeamId,
          MemberUnitIds: EnemyUnitIds
        },
        Formation: {
          TeamId: EnemyTeamId,
          ActiveUnitIds: EnemyUnitIds,
          LeaderUnitId: EnemyMainId,
          OverworldDisplayUnitId: EnemyMainId
        }
      });

      EnemyTeamBindings[Enemy.EnemyId] = EnemyTeamId;
    });

    TeamSeed?.UnitStaticConfigs?.forEach((UnitConfig) => {
      UnitStaticConfigMap.set(UnitConfig.UnitId, { ...UnitConfig });
    });

    TeamSeed?.UnitRuntimeSnapshots?.forEach((RuntimeSnapshot) => {
      UnitRuntimeSnapshotMap.set(RuntimeSnapshot.UnitId, {
        ...RuntimeSnapshot,
        Cooldowns: { ...RuntimeSnapshot.Cooldowns },
        StatusEffects: [...RuntimeSnapshot.StatusEffects],
        ReactionWindowMs: RuntimeSnapshot.ReactionWindowMs
          ? { ...RuntimeSnapshot.ReactionWindowMs }
          : undefined
      });
    });

    TeamSeed?.TeamPackages?.forEach((TeamPackage) => {
      TeamPackageMap.set(TeamPackage.TeamId, {
        ...TeamPackage,
        Meta: { ...TeamPackage.Meta },
        MoveConfig: { ...TeamPackage.MoveConfig },
        Roster: {
          ...TeamPackage.Roster,
          MemberUnitIds: [...TeamPackage.Roster.MemberUnitIds]
        },
        Formation: {
          ...TeamPackage.Formation,
          ActiveUnitIds: [...TeamPackage.Formation.ActiveUnitIds]
        }
      });
    });

    const ControlledTeamId = TeamSeed?.ControlledTeamId ?? PlayerTeamId;

    return {
      ControlledTeamId,
      TeamPackages: [...TeamPackageMap.values()].sort((Left, Right) =>
        Left.TeamId.localeCompare(Right.TeamId)
      ),
      UnitStaticConfigs: [...UnitStaticConfigMap.values()].sort((Left, Right) =>
        Left.UnitId.localeCompare(Right.UnitId)
      ),
      UnitRuntimeSnapshots: [...UnitRuntimeSnapshotMap.values()].sort((Left, Right) =>
        Left.UnitId.localeCompare(Right.UnitId)
      ),
      EnemyTeamBindings: TeamSeed?.EnemyTeamBindings
        ? { ...TeamSeed.EnemyTeamBindings }
        : EnemyTeamBindings
    };
  }

  private CalculatePlayerPosition(
    Position: FOverworldVector2,
    YawDegrees: number,
    MoveAxis: { X: number; Y: number },
    Options: { MoveDistance: number; WorldHalfSize: number }
  ): FOverworldVector2 {
    const YawRadians = (YawDegrees * Math.PI) / 180;
    const ForwardX = Math.sin(YawRadians);
    const ForwardZ = Math.cos(YawRadians);
    const RightX = Math.cos(YawRadians);
    const RightZ = -Math.sin(YawRadians);

    const DeltaX = (ForwardX * MoveAxis.Y + RightX * MoveAxis.X) * Options.MoveDistance;
    const DeltaZ = (ForwardZ * MoveAxis.Y + RightZ * MoveAxis.X) * Options.MoveDistance;

    return {
      X: this.Clamp(this.Round(Position.X + DeltaX), -Options.WorldHalfSize, Options.WorldHalfSize),
      Z: this.Clamp(this.Round(Position.Z + DeltaZ), -Options.WorldHalfSize, Options.WorldHalfSize)
    };
  }

  private StepEnemies(
    Enemies: Record<string, FOverworldEnemyState>,
    DeltaSeconds: number,
    Tuning: FOverworldTuningSnapshot
  ): FOverworldEnemyState[] {
    return Object.values(Enemies)
      .sort((Left, Right) => Left.EnemyId.localeCompare(Right.EnemyId))
      .map((Enemy, Index) => {
        const Direction = Index % 2 === 0 ? 1 : -1;
        let NextYaw = this.NormalizeDegrees(
          Enemy.WanderYawDegrees + Direction * Tuning.EnemyWanderTurnSpeed * DeltaSeconds
        );
        const YawRadians = (NextYaw * Math.PI) / 180;
        const StepDistance = Tuning.EnemyWanderSpeed * DeltaSeconds;
        let NextX = Enemy.Position.X + Math.sin(YawRadians) * StepDistance;
        let NextZ = Enemy.Position.Z + Math.cos(YawRadians) * StepDistance;

        const Boundary = Tuning.WorldHalfSize - Enemy.Radius;
        const IsOutOfBoundary = Math.abs(NextX) > Boundary || Math.abs(NextZ) > Boundary;
        if (IsOutOfBoundary) {
          NextX = this.Clamp(NextX, -Boundary, Boundary);
          NextZ = this.Clamp(NextZ, -Boundary, Boundary);
          NextYaw = this.NormalizeDegrees(NextYaw + 180);
        }

        return {
          ...Enemy,
          Position: {
            X: this.Round(NextX),
            Z: this.Round(NextZ)
          },
          WanderYawDegrees: NextYaw
        };
      });
  }

  private FindEncounterEnemy(
    PlayerPosition: FOverworldVector2,
    Enemies: FOverworldEnemyState[],
    PlayerRadius: number,
    EncounterDistance: number
  ): FOverworldEnemyState | null {
    for (const Enemy of Enemies) {
      const DeltaX = Enemy.Position.X - PlayerPosition.X;
      const DeltaZ = Enemy.Position.Z - PlayerPosition.Z;
      const Distance = Math.sqrt(DeltaX * DeltaX + DeltaZ * DeltaZ);
      const TriggerDistance = Math.max(EncounterDistance, PlayerRadius + Enemy.Radius);
      if (Distance <= TriggerDistance) {
        return Enemy;
      }
    }

    return null;
  }

  private NormalizeAxis(X: number, Y: number): { X: number; Y: number } {
    const Length = Math.sqrt(X * X + Y * Y);
    if (Length <= 1e-6) {
      return { X: 0, Y: 0 };
    }

    if (Length <= 1) {
      return { X, Y };
    }

    return {
      X: X / Length,
      Y: Y / Length
    };
  }

  private NormalizeDegrees(Value: number): number {
    const Wrapped = ((Value % 360) + 360) % 360;
    return this.Round(Wrapped);
  }

  private Clamp(Value: number, Min: number, Max: number): number {
    return Math.min(Math.max(Value, Min), Max);
  }

  private PickNumber(Value: unknown, Fallback: number): number {
    return typeof Value === "number" && Number.isFinite(Value) ? Value : Fallback;
  }

  private Round(Value: number): number {
    return Number(Value.toFixed(4));
  }

  private CreateEncounterId(EnemyId: string): string {
    return `ENC_${EnemyId}_${this.NextEventId}`;
  }

  private EmitTeamValidationFailed(
    TeamId: string,
    FailureReason: string,
    Violations: string[],
    EncounterId: string | null
  ): void {
    this.EmitEvent(EOverworldEventType.TeamValidationFailed, {
      TeamId,
      EncounterId,
      FailureReason,
      Violations
    });
  }

  private EmitEvent<TType extends EOverworldEventType>(
    Type: TType,
    Payload: FOverworldEventPayloadMap[TType]
  ): void {
    const TypedEvent = {
      EventId: this.NextEventId,
      Type,
      Payload
    } as FTypedOverworldEvent<TType>;
    const Event = TypedEvent as FOverworldEvent;
    const TypedListeners = this.Listeners[Type] as Set<FOverworldEventListener<TType>>;

    this.NextEventId += 1;
    this.StateStore.ApplyEvent(Event);
    this.EventHistory.push(Event);
    TypedListeners.forEach((Listener) => Listener(TypedEvent));
  }
}
