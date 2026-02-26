import { EOverworldCommandType } from "../commands/EOverworldCommandType";
import { EOverworldPhase } from "../enums/EOverworldPhase";
import { EOverworldEventType } from "../events/EOverworldEventType";
import {
  CreateDefaultOverworldTuning,
  CreateDefaultOverworldWorldConfig,
  CreateEmptyOverworldState,
  type FOverworldEnemyState,
  type FOverworldPlayerState,
  type FOverworldTuningSnapshot,
  type FOverworldVector2,
  type FOverworldWorldConfig
} from "../state/FOverworldState";
import { UOverworldStateStore } from "../state/UOverworldStateStore";

import type { FOverworldCommand, FStepCommand } from "../commands/FOverworldCommand";
import type {
  FOverworldEvent,
  FOverworldEventPayloadMap,
  FTypedOverworldEvent
} from "../events/FOverworldEvent";

type FOverworldEventListener<TType extends EOverworldEventType> = (
  Event: FTypedOverworldEvent<TType>
) => void;

export class UOverworldSimulation {
  private readonly StateStore: UOverworldStateStore;
  private readonly EventHistory: FOverworldEvent[];
  private readonly Listeners: {
    [K in EOverworldEventType]: Set<FOverworldEventListener<K>>;
  };
  private NextEventId: number;

  public constructor() {
    this.StateStore = new UOverworldStateStore(CreateEmptyOverworldState());
    this.EventHistory = [];
    this.NextEventId = 1;
    this.Listeners = {
      [EOverworldEventType.WorldInitialized]: new Set(),
      [EOverworldEventType.PlayerMoved]: new Set(),
      [EOverworldEventType.EnemyMoved]: new Set(),
      [EOverworldEventType.EncounterTriggered]: new Set(),
      [EOverworldEventType.EncounterResolved]: new Set(),
      [EOverworldEventType.PlayerResetToSafePoint]: new Set()
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

    this.EmitEvent(EOverworldEventType.WorldInitialized, {
      WorldHalfSize: WorldConfig.WorldHalfSize,
      SafePoint: { ...WorldConfig.SafePoint },
      Player,
      Enemies,
      Tuning: { ...WorldConfig.Tuning }
    });

    return true;
  }

  private HandleStep(Command: FStepCommand): boolean {
    const State = this.GetState();
    if (State.Phase !== EOverworldPhase.Exploring) {
      return false;
    }

    const DeltaSeconds = this.Clamp(Command.DeltaSeconds, 0, 0.25);
    if (DeltaSeconds <= 0) {
      return true;
    }

    const WalkSpeed = this.Clamp(Command.WalkSpeed ?? State.Tuning.WalkSpeed, 10, 10000);
    const RunSpeed = this.Clamp(Command.RunSpeed ?? State.Tuning.RunSpeed, WalkSpeed, 16000);
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

    this.EmitEvent(EOverworldEventType.EncounterTriggered, {
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

  private ResolveWorldConfig(
    Config?: Partial<FOverworldWorldConfig>
  ): Omit<FOverworldWorldConfig, "Tuning"> & { Tuning: FOverworldTuningSnapshot } {
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
      Tuning
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
