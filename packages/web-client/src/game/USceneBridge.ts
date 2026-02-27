import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";

import type {
  FBattleCameraMode,
  FBattleUnitHudState,
  FHudViewModel,
  FRuntimePhase
} from "../ui/FHudViewModel";

interface FSkyCloudActor {
  Root: TransformNode;
  BaseX: number;
  Speed: number;
  DriftRange: number;
  Phase: number;
}

interface FVector3Cm {
  X: number;
  Y: number;
  Z: number;
}

interface FBattleCameraContext {
  ViewModel: FHudViewModel;
  DebugConfig: FHudViewModel["DebugState"]["Config"];
  DropOffsetCm: number;
  ControlledUnit: FBattleUnitHudState | null;
  ControlledPos: Vector3;
  SelectedPos: Vector3;
  BattleCenter: Vector3;
  Forward: Vector3;
  Right: Vector3;
}

interface FBattleFollowCameraPose {
  Focus: Vector3;
  Position: Vector3;
}

export class USceneBridge {
  private static readonly CentimetersToMeters = 0.01;
  private static readonly OverworldGroundColorHex = "#333a41";
  private static readonly OverworldPlayerColorHex = "#dba511";
  private static readonly OverworldEnemyColorHex = "#3385e8";
  private static readonly BattlePlayerSecondaryColorHex = "#be2f35";
  private static readonly BattleEnemyMainColorHex = "#2f71c7";
  private static readonly BattleEnemyColorHex = "#3385e8";
  private static readonly OverworldGridColorHex = "#50565e";
  private static readonly BattleGroundColorHex = "#2f3944";
  private static readonly BattleGridColorHex = "#4d5965";
  private static readonly MainLightGroundColorHex = "#4a5561";
  private readonly Engine: Engine;
  private readonly Scene: Scene;
  private readonly HandleWindowResize: () => void;
  private readonly CanvasResizeObserver: ResizeObserver | null;
  private readonly Camera: ArcRotateCamera;
  private readonly OverworldEnemyMeshMap: Map<string, Mesh>;
  private readonly BattleUnitMeshMap: Map<string, Mesh>;
  private readonly OverworldGround: Mesh;
  private readonly OverworldGrid: Mesh;
  private readonly BattleGround: Mesh;
  private readonly BattleGrid: Mesh;
  private readonly PlayerMesh: Mesh;
  private readonly PlayerForwardArrowMesh: Mesh;
  private readonly SkyCloudMaterial: StandardMaterial;
  private readonly SkyCloudActors: FSkyCloudActor[];
  private LastFrameTimestamp: number;
  private ElapsedSeconds: number;
  private LaggedCameraTargetCm: FVector3Cm | null;
  private LastCameraUpdateTimeMs: number | null;
  private LastCameraRuntimePhase: FRuntimePhase | null;
  private CurrentViewModel: FHudViewModel | null;

  public constructor(Canvas: HTMLCanvasElement) {
    this.Engine = new Engine(Canvas, true);
    this.Scene = new Scene(this.Engine);
    this.Scene.clearColor = new Color4(0.47, 0.71, 0.94, 1);
    this.OverworldEnemyMeshMap = new Map();
    this.BattleUnitMeshMap = new Map();
    this.CurrentViewModel = null;

    this.Camera = this.CreateCamera();
    this.OverworldGround = this.CreateOverworldGround();
    this.OverworldGrid = this.CreateOverworldGrid(30, 1, "OverworldGrid");
    this.BattleGround = this.CreateBattleGround();
    this.BattleGrid = this.CreateOverworldGrid(12, 0.5, "BattleGrid", true);
    this.PlayerMesh = this.CreatePlayerMesh();
    this.PlayerForwardArrowMesh = this.CreatePlayerForwardArrowMesh();
    this.CreateLight();
    this.SkyCloudMaterial = this.CreateSkyCloudMaterial();
    this.SkyCloudActors = this.CreateSkyCloudActors();
    this.LastFrameTimestamp = performance.now();
    this.ElapsedSeconds = 0;
    this.LaggedCameraTargetCm = null;
    this.LastCameraUpdateTimeMs = null;
    this.LastCameraRuntimePhase = null;
    this.BattleGround.setEnabled(false);
    this.BattleGrid.setEnabled(false);

    this.HandleWindowResize = () => {
      this.ResizeEngine();
    };
    this.CanvasResizeObserver = this.CreateCanvasResizeObserver(Canvas);

    this.Engine.runRenderLoop(() => {
      const Now = performance.now();
      const DeltaSeconds = Math.min(Math.max((Now - this.LastFrameTimestamp) / 1000, 0), 0.05);
      this.LastFrameTimestamp = Now;
      this.ElapsedSeconds += DeltaSeconds;
      this.UpdateSkyClouds(DeltaSeconds);
      if (this.CurrentViewModel) {
        this.RenderFromViewModel(this.CurrentViewModel);
      }
      this.Scene.render();
    });

    window.addEventListener("resize", this.HandleWindowResize);
    this.ResizeEngine();
  }

  public ApplyViewModel(ViewModel: FHudViewModel): void {
    this.CurrentViewModel = ViewModel;
  }

  public Dispose(): void {
    window.removeEventListener("resize", this.HandleWindowResize);
    this.CanvasResizeObserver?.disconnect();
    this.Scene.dispose();
    this.Engine.dispose();
  }

  private RenderFromViewModel(ViewModel: FHudViewModel): void {
    if (ViewModel.RuntimePhase === "Overworld") {
      this.ApplyOverworldView(ViewModel);
    } else {
      this.ApplyBattlePocketView(ViewModel);
    }
    this.ApplyCamera(ViewModel);
  }

  private CreateCamera(): ArcRotateCamera {
    const Camera = new ArcRotateCamera(
      "MainCamera",
      Math.PI / 2,
      Math.PI / 3,
      14,
      new Vector3(0, 0, 0),
      this.Scene
    );
    Camera.lowerRadiusLimit = 0.1;
    Camera.upperRadiusLimit = 80;
    Camera.minZ = 0.02;
    return Camera;
  }

  private CreateLight(): void {
    const MainLight = new HemisphericLight("MainLight", new Vector3(0, 1, 0), this.Scene);
    MainLight.intensity = 0.95;
    MainLight.groundColor = Color3.FromHexString(USceneBridge.MainLightGroundColorHex);
  }

  private CreateOverworldGround(): Mesh {
    const Ground = MeshBuilder.CreateGround(
      "OverworldGround",
      {
        width: 60,
        height: 60
      },
      this.Scene
    );
    const GroundMaterial = new StandardMaterial("OverworldGroundMat", this.Scene);
    GroundMaterial.diffuseColor = Color3.FromHexString(USceneBridge.OverworldGroundColorHex);
    Ground.material = GroundMaterial;
    return Ground;
  }

  private CreateOverworldGrid(
    WorldHalfSize: number,
    CellSize: number,
    GridId: string,
    IsBattleGrid = false
  ): Mesh {
    const Lines: Vector3[][] = [];
    for (let Position = -WorldHalfSize; Position <= WorldHalfSize; Position += CellSize) {
      Lines.push([
        new Vector3(Position, 0.03, -WorldHalfSize),
        new Vector3(Position, 0.03, WorldHalfSize)
      ]);
      Lines.push([
        new Vector3(-WorldHalfSize, 0.03, Position),
        new Vector3(WorldHalfSize, 0.03, Position)
      ]);
    }

    const Grid = MeshBuilder.CreateLineSystem(
      GridId,
      {
        lines: Lines,
        updatable: false
      },
      this.Scene
    );
    Grid.color = Color3.FromHexString(
      IsBattleGrid ? USceneBridge.BattleGridColorHex : USceneBridge.OverworldGridColorHex
    );
    Grid.isPickable = false;
    return Grid;
  }

  private CreateBattleGround(): Mesh {
    const Ground = MeshBuilder.CreateGround(
      "BattleGround",
      {
        width: 24,
        height: 16
      },
      this.Scene
    );
    const GroundMaterial = new StandardMaterial("BattleGroundMat", this.Scene);
    GroundMaterial.diffuseColor = Color3.FromHexString(USceneBridge.BattleGroundColorHex);
    Ground.material = GroundMaterial;
    return Ground;
  }

  private CreatePlayerMesh(): Mesh {
    const Capsule = MeshBuilder.CreateCapsule(
      "OverworldPlayer",
      {
        height: 1.7,
        radius: 0.42
      },
      this.Scene
    );
    const Material = new StandardMaterial("OverworldPlayerMat", this.Scene);
    Material.diffuseColor = Color3.FromHexString(USceneBridge.OverworldPlayerColorHex);
    Capsule.material = Material;
    return Capsule;
  }

  private CreateCanvasResizeObserver(Canvas: HTMLCanvasElement): ResizeObserver | null {
    if (typeof ResizeObserver === "undefined") {
      return null;
    }

    const Observer = new ResizeObserver(() => {
      this.ResizeEngine();
    });
    Observer.observe(Canvas);
    return Observer;
  }

  private CreatePlayerForwardArrowMesh(): Mesh {
    const Arrow = MeshBuilder.CreateCylinder(
      "OverworldPlayerForwardArrow",
      {
        height: 0.4,
        diameterTop: 0,
        diameterBottom: 0.2,
        tessellation: 4
      },
      this.Scene
    );
    const Material = new StandardMaterial("OverworldPlayerForwardArrowMat", this.Scene);
    Material.diffuseColor = new Color3(1, 0.94, 0.5);
    Arrow.material = Material;
    Arrow.parent = this.PlayerMesh;
    Arrow.position = new Vector3(0, 0.95, 0.56);
    Arrow.rotation = new Vector3(Math.PI / 2, 0, 0);
    return Arrow;
  }

  private ApplyCamera(ViewModel: FHudViewModel): void {
    this.SyncCameraTrackingPhase(ViewModel.RuntimePhase);
    if (ViewModel.RuntimePhase === "Overworld") {
      this.ApplyOverworldCamera(ViewModel);
      return;
    }

    this.ApplyBattleCamera(ViewModel);
  }

  private ApplyOverworldCamera(ViewModel: FHudViewModel): void {
    const DebugConfig = ViewModel.DebugState.Config;
    this.Camera.fov = (DebugConfig.CameraFov * Math.PI) / 180;

    const Player = ViewModel.OverworldState.PlayerPosition;
    const PlayerYawRadians = (ViewModel.OverworldState.PlayerYawDegrees * Math.PI) / 180;
    const RightX = Math.cos(PlayerYawRadians);
    const RightZ = -Math.sin(PlayerYawRadians);
    const DesiredTargetCm: FVector3Cm = {
      X: Player.X + RightX * DebugConfig.CameraOffsetRight,
      Y: 85 + DebugConfig.CameraOffsetUp,
      Z: Player.Z + RightZ * DebugConfig.CameraOffsetRight
    };
    const LaggedTargetCm = this.ResolveSpringArmTargetCm(
      DesiredTargetCm,
      DebugConfig.CameraLagSpeed,
      DebugConfig.CameraLagMaxDistance
    );
    this.Camera.target = new Vector3(
      this.ToMeters(LaggedTargetCm.X),
      this.ToMeters(LaggedTargetCm.Y),
      this.ToMeters(LaggedTargetCm.Z)
    );
    this.Camera.alpha = -PlayerYawRadians - Math.PI / 2;
    this.Camera.beta = this.ToArcCameraBeta(DebugConfig.CameraPitch);
    this.Camera.radius = this.ToMeters(DebugConfig.TargetArmLength);
  }

  private ApplyBattleCamera(ViewModel: FHudViewModel): void {
    const Context = this.BuildBattleCameraContext(ViewModel);
    const CameraMode: FBattleCameraMode =
      ViewModel.RuntimePhase === "SettlementPreview"
        ? "SettlementCam"
        : ViewModel.Battle3CState.CameraMode;

    if (CameraMode === "EnemyAttackSingle" || CameraMode === "EnemyAttackAOE") {
      this.ApplyEnemyAttackCamera(Context);
      return;
    }

    const Handlers: Record<
      Exclude<FBattleCameraMode, "EnemyAttackSingle" | "EnemyAttackAOE">,
      () => void
    > = {
      IntroPullOut: () => this.ApplyIntroPullOutCamera(Context),
      IntroDropIn: () => this.ApplyIntroDropInCamera(Context),
      PlayerFollow: () => this.ApplyPlayerFollowCamera(Context),
      PlayerAim: () => this.ApplyPlayerAimCamera(Context),
      SkillTargetZoom: () => this.ApplySkillTargetZoomCamera(Context),
      SettlementCam: () => this.ApplySettlementCamera(Context)
    };
    Handlers[CameraMode]();
  }

  private BuildBattleCameraContext(ViewModel: FHudViewModel): FBattleCameraContext {
    const DropOffsetCm = this.ResolveEncounterDropOffsetCm(ViewModel);
    const ControlledUnit = this.FindBattleUnit(
      ViewModel,
      ViewModel.Battle3CState.ControlledCharacterId
    );
    const ControlledPos =
      ControlledUnit !== null
        ? this.ResolveBattleUnitPositionMeters(ControlledUnit, DropOffsetCm)
        : Vector3.Zero();
    const SelectedUnit = this.FindBattleUnit(ViewModel, ViewModel.Battle3CState.SelectedTargetId);
    const SelectedPos =
      SelectedUnit !== null
        ? this.ResolveBattleUnitPositionMeters(SelectedUnit, DropOffsetCm)
        : this.ResolveBattleCenterMeters(ViewModel, DropOffsetCm);
    const YawDeg = ControlledUnit?.YawDeg ?? 0;

    return {
      ViewModel,
      DebugConfig: ViewModel.DebugState.Config,
      DropOffsetCm,
      ControlledUnit,
      ControlledPos,
      SelectedPos,
      BattleCenter: this.ResolveBattleCenterMeters(ViewModel, DropOffsetCm),
      Forward: this.ResolveForwardVectorFromYawDeg(YawDeg),
      Right: this.ResolveRightVectorFromYawDeg(YawDeg)
    };
  }

  private ApplyIntroPullOutCamera(Context: FBattleCameraContext): void {
    const FollowPose = this.ResolvePlayerFollowCameraPose(Context);
    const Position = FollowPose.Focus.add(
      Context.Forward.scale(-this.ToMeters(Context.DebugConfig.BattleIntroCameraStartDistanceCm))
    )
      .add(Context.Right.scale(this.ToMeters(Context.DebugConfig.BattleFollowShoulderOffsetCm)))
      .add(new Vector3(0, this.ToMeters(Context.DebugConfig.BattleIntroCameraStartHeightCm), 0));
    this.ApplyArcCameraFromPosition(
      FollowPose.Focus,
      Position,
      Context.DebugConfig.BattleIntroFovDeg
    );
  }

  private ApplyIntroDropInCamera(Context: FBattleCameraContext): void {
    const FollowPose = this.ResolvePlayerFollowCameraPose(Context);
    const IntroProgress = this.ResolveEncounterIntroProgress(Context.ViewModel);
    const StartPosition = FollowPose.Focus.add(
      Context.Forward.scale(-this.ToMeters(Context.DebugConfig.BattleIntroCameraStartDistanceCm))
    )
      .add(Context.Right.scale(this.ToMeters(Context.DebugConfig.BattleFollowShoulderOffsetCm)))
      .add(new Vector3(0, this.ToMeters(Context.DebugConfig.BattleIntroCameraStartHeightCm), 0));
    const Position = Vector3.Lerp(StartPosition, FollowPose.Position, IntroProgress);
    this.ApplyArcCameraFromPosition(
      FollowPose.Focus,
      Position,
      Context.DebugConfig.BattleIntroFovDeg
    );
  }

  private ApplyPlayerFollowCamera(Context: FBattleCameraContext): void {
    const FollowPose = this.ResolvePlayerFollowCameraPose(Context);
    this.ApplyArcCameraFromPosition(
      FollowPose.Focus,
      FollowPose.Position,
      Context.DebugConfig.BattleIntroFovDeg
    );
  }

  private ApplyPlayerAimCamera(Context: FBattleCameraContext): void {
    const DistanceCm = Math.max(220, Context.DebugConfig.TargetArmLength * 0.58);
    const Position = Context.ControlledPos.add(Context.Forward.scale(-this.ToMeters(DistanceCm)))
      .add(Context.Right.scale(this.ToMeters(Context.DebugConfig.PlayerAimShoulderOffsetCm)))
      .add(new Vector3(0, this.ToMeters(145), 0));
    const Target = Context.SelectedPos.add(new Vector3(0, 0.75, 0));
    this.ApplyArcCameraFromPosition(Target, Position, Context.DebugConfig.PlayerAimFovDeg);
  }

  private ApplySkillTargetZoomCamera(Context: FBattleCameraContext): void {
    const Direction = Context.ControlledPos.subtract(Context.SelectedPos);
    const SafeDirection =
      Direction.length() > 0.001 ? Direction.normalize() : new Vector3(-1, 0, 0);
    const Position = Context.SelectedPos.add(
      SafeDirection.scale(this.ToMeters(Context.DebugConfig.SkillTargetZoomDistanceCm))
    ).add(new Vector3(0, this.ToMeters(120), 0));
    const Target = Context.SelectedPos.add(new Vector3(0, 0.75, 0));
    const FovDeg = Math.max(Context.DebugConfig.PlayerAimFovDeg - 3, 32);
    this.ApplyArcCameraFromPosition(Target, Position, FovDeg);
  }

  private ApplyEnemyAttackCamera(Context: FBattleCameraContext): void {
    const ScriptFocus = Context.ViewModel.Battle3CState.ScriptFocus;
    if (!ScriptFocus) {
      this.ApplyPlayerFollowCamera(Context);
      return;
    }

    const VictimCenter = this.ResolveTargetGroupCenterMeters(
      Context.ViewModel,
      ScriptFocus.TargetUnitIds,
      Context.DropOffsetCm
    );
    const AttackerUnit = this.FindBattleUnit(Context.ViewModel, ScriptFocus.AttackerUnitId);
    const AttackerPos =
      AttackerUnit !== null
        ? this.ResolveBattleUnitPositionMeters(AttackerUnit, Context.DropOffsetCm)
        : Context.BattleCenter;
    const TargetToAttacker = AttackerPos.subtract(VictimCenter);
    const SafeDirection =
      TargetToAttacker.length() > 0.001 ? TargetToAttacker.normalize() : new Vector3(1, 0, 0);
    const CameraPos = VictimCenter.add(
      SafeDirection.scale(-this.ToMeters(Context.DebugConfig.EnemyAttackCamDistanceCm))
    ).add(new Vector3(0, this.ToMeters(Context.DebugConfig.EnemyAttackCamHeightCm), 0));
    const Target = VictimCenter.add(SafeDirection.scale(this.ToMeters(70)));
    this.ApplyArcCameraFromPosition(Target, CameraPos, Context.DebugConfig.BattleIntroFovDeg);
  }

  private ApplySettlementCamera(Context: FBattleCameraContext): void {
    const Position = Context.BattleCenter.add(
      new Vector3(
        -this.ToMeters(Context.DebugConfig.SettlementCamDistanceCm),
        this.ToMeters(Context.DebugConfig.SettlementCamHeightCm),
        -this.ToMeters(Context.DebugConfig.SettlementCamDistanceCm * 0.1)
      )
    );
    this.ApplyArcCameraFromPosition(
      Context.BattleCenter.add(new Vector3(0, 0.75, 0)),
      Position,
      46
    );
  }

  private ResolvePlayerFollowCameraPose(Context: FBattleCameraContext): FBattleFollowCameraPose {
    const Focus = Context.ControlledPos.add(new Vector3(0, 0.8, 0));
    const Position = Focus.add(
      Context.Forward.scale(-this.ToMeters(Context.DebugConfig.BattleIntroCameraEndDistanceCm))
    )
      .add(Context.Right.scale(this.ToMeters(Context.DebugConfig.BattleFollowShoulderOffsetCm)))
      .add(new Vector3(0, this.ToMeters(Context.DebugConfig.BattleIntroCameraEndHeightCm), 0));
    return {
      Focus,
      Position
    };
  }

  private ApplyArcCameraFromPosition(Target: Vector3, Position: Vector3, FovDeg: number): void {
    this.Camera.fov = (FovDeg * Math.PI) / 180;
    this.Camera.setTarget(Target);
    this.Camera.setPosition(Position);
  }

  private SyncCameraTrackingPhase(RuntimePhase: FRuntimePhase): void {
    if (this.LastCameraRuntimePhase === RuntimePhase) {
      return;
    }

    this.LastCameraRuntimePhase = RuntimePhase;
    this.ResetSpringArmLagState();
  }

  private ResetSpringArmLagState(): void {
    this.LaggedCameraTargetCm = null;
    this.LastCameraUpdateTimeMs = null;
  }

  private ResolveSpringArmTargetCm(
    DesiredTargetCm: FVector3Cm,
    CameraLagSpeed: number,
    CameraLagMaxDistance: number
  ): FVector3Cm {
    const DeltaSeconds = this.ResolveCameraLagDeltaSeconds();
    if (!this.LaggedCameraTargetCm || CameraLagSpeed <= 0) {
      const SyncedTargetCm = { ...DesiredTargetCm };
      this.LaggedCameraTargetCm = SyncedTargetCm;
      return SyncedTargetCm;
    }

    const Alpha = 1 - Math.exp(-CameraLagSpeed * DeltaSeconds);
    const Current = this.LaggedCameraTargetCm;
    const InterpolatedTargetCm: FVector3Cm = {
      X: Current.X + (DesiredTargetCm.X - Current.X) * Alpha,
      Y: Current.Y + (DesiredTargetCm.Y - Current.Y) * Alpha,
      Z: Current.Z + (DesiredTargetCm.Z - Current.Z) * Alpha
    };
    const LimitedTargetCm = this.LimitLagDistanceToDesiredTarget(
      DesiredTargetCm,
      InterpolatedTargetCm,
      CameraLagMaxDistance
    );

    this.LaggedCameraTargetCm = LimitedTargetCm;
    return { ...LimitedTargetCm };
  }

  private LimitLagDistanceToDesiredTarget(
    DesiredTargetCm: FVector3Cm,
    CandidateTargetCm: FVector3Cm,
    CameraLagMaxDistance: number
  ): FVector3Cm {
    if (CameraLagMaxDistance <= 0) {
      return CandidateTargetCm;
    }

    const DeltaX = DesiredTargetCm.X - CandidateTargetCm.X;
    const DeltaY = DesiredTargetCm.Y - CandidateTargetCm.Y;
    const DeltaZ = DesiredTargetCm.Z - CandidateTargetCm.Z;
    const DistanceToDesiredCm = Math.sqrt(DeltaX * DeltaX + DeltaY * DeltaY + DeltaZ * DeltaZ);
    if (DistanceToDesiredCm <= CameraLagMaxDistance || DistanceToDesiredCm <= 1e-6) {
      return CandidateTargetCm;
    }

    const Ratio = CameraLagMaxDistance / DistanceToDesiredCm;
    return {
      X: DesiredTargetCm.X - DeltaX * Ratio,
      Y: DesiredTargetCm.Y - DeltaY * Ratio,
      Z: DesiredTargetCm.Z - DeltaZ * Ratio
    };
  }

  private ResolveCameraLagDeltaSeconds(): number {
    const Now = performance.now();
    if (this.LastCameraUpdateTimeMs === null) {
      this.LastCameraUpdateTimeMs = Now;
      return 1 / 60;
    }

    const DeltaSeconds = Math.min(Math.max((Now - this.LastCameraUpdateTimeMs) / 1000, 0), 0.05);
    this.LastCameraUpdateTimeMs = Now;
    return DeltaSeconds;
  }

  private ToArcCameraBeta(PitchDegrees: number): number {
    const Degrees = 90 - PitchDegrees;
    const Radians = (Degrees * Math.PI) / 180;
    return Math.min(Math.max(Radians, 0.05), Math.PI - 0.05);
  }

  private ApplyOverworldView(ViewModel: FHudViewModel): void {
    this.OverworldGround.setEnabled(true);
    this.OverworldGrid.setEnabled(true);
    this.BattleGround.setEnabled(false);
    this.BattleGrid.setEnabled(false);
    this.PlayerMesh.setEnabled(true);
    this.PlayerForwardArrowMesh.setEnabled(true);

    const Player = ViewModel.OverworldState.PlayerPosition;
    this.PlayerMesh.position = new Vector3(this.ToMeters(Player.X), 0.85, this.ToMeters(Player.Z));
    this.PlayerMesh.rotation = new Vector3(
      0,
      (ViewModel.OverworldState.PlayerYawDegrees * Math.PI) / 180,
      0
    );

    this.SyncOverworldEnemies(ViewModel);
    this.HideAllBattleUnits();
  }

  private ApplyBattlePocketView(ViewModel: FHudViewModel): void {
    this.OverworldGround.setEnabled(false);
    this.OverworldGrid.setEnabled(false);
    this.BattleGround.setEnabled(true);
    this.BattleGrid.setEnabled(true);
    this.PlayerMesh.setEnabled(false);
    this.PlayerForwardArrowMesh.setEnabled(false);
    this.HideAllOverworldEnemies();
    const DropOffsetCm = this.ResolveEncounterDropOffsetCm(ViewModel);
    this.SyncBattleUnits(ViewModel, DropOffsetCm);
  }

  private HideAllOverworldEnemies(): void {
    this.OverworldEnemyMeshMap.forEach((EnemyMesh) => {
      EnemyMesh.setEnabled(false);
    });
  }

  private HideAllBattleUnits(): void {
    this.BattleUnitMeshMap.forEach((UnitMesh) => {
      UnitMesh.setEnabled(false);
    });
  }

  private SyncOverworldEnemies(ViewModel: FHudViewModel): void {
    const ExistingEnemyIds = new Set(this.OverworldEnemyMeshMap.keys());

    ViewModel.OverworldState.Enemies.forEach((Enemy) => {
      const EnemyMesh =
        this.OverworldEnemyMeshMap.get(Enemy.EnemyId) ??
        this.CreateOverworldEnemyMesh(Enemy.EnemyId);
      EnemyMesh.setEnabled(true);
      EnemyMesh.position = new Vector3(
        this.ToMeters(Enemy.Position.X),
        1,
        this.ToMeters(Enemy.Position.Z)
      );
      EnemyMesh.rotation = new Vector3(0, (Enemy.WanderYawDegrees * Math.PI) / 180, 0);

      const Material = EnemyMesh.material as StandardMaterial;
      if (ViewModel.OverworldState.PendingEncounterEnemyId === Enemy.EnemyId) {
        Material.diffuseColor = new Color3(0.88, 0.2, 0.2);
      } else {
        Material.diffuseColor = Color3.FromHexString(USceneBridge.OverworldEnemyColorHex);
      }

      ExistingEnemyIds.delete(Enemy.EnemyId);
    });

    ExistingEnemyIds.forEach((EnemyId) => {
      const EnemyMesh = this.OverworldEnemyMeshMap.get(EnemyId);
      if (EnemyMesh) {
        EnemyMesh.dispose();
      }
      this.OverworldEnemyMeshMap.delete(EnemyId);
    });
  }

  private SyncBattleUnits(ViewModel: FHudViewModel, DropOffsetCm: number): void {
    const ExistingIds = new Set(this.BattleUnitMeshMap.keys());
    ViewModel.Battle3CState.Units.forEach((Unit) => {
      const Mesh = this.BattleUnitMeshMap.get(Unit.UnitId) ?? this.CreateBattleUnitMesh(Unit);
      Mesh.setEnabled(true);
      Mesh.position = this.ResolveBattleUnitPositionMeters(Unit, DropOffsetCm);
      Mesh.rotation = new Vector3(0, (Unit.YawDeg * Math.PI) / 180, 0);

      const Material = Mesh.material as StandardMaterial;
      if (!Unit.IsAlive) {
        Material.diffuseColor = new Color3(0.24, 0.24, 0.24);
      } else {
        const BaseColor = this.ResolveBattleUnitBaseColor(Unit);
        if (Unit.IsSelectedTarget) {
          Material.diffuseColor = this.AdjustColorBrightness(BaseColor, 0.34);
        } else if (Unit.IsControlled) {
          Material.diffuseColor = this.AdjustColorBrightness(BaseColor, 0.2);
        } else {
          Material.diffuseColor = BaseColor;
        }
      }

      ExistingIds.delete(Unit.UnitId);
    });

    ExistingIds.forEach((UnitId) => {
      const UnitMesh = this.BattleUnitMeshMap.get(UnitId);
      if (UnitMesh) {
        UnitMesh.dispose();
      }
      this.BattleUnitMeshMap.delete(UnitId);
    });
  }

  private ResolveBattleUnitPositionMeters(
    Unit: FBattleUnitHudState,
    DropOffsetCm: number
  ): Vector3 {
    const BaseHeightMeters = Unit.TeamId === "Player" ? 0.85 : 0.9;
    return new Vector3(
      this.ToMeters(Unit.PositionCm.X),
      BaseHeightMeters + this.ToMeters(Unit.PositionCm.Y + DropOffsetCm),
      this.ToMeters(Unit.PositionCm.Z)
    );
  }

  private FindBattleUnit(
    ViewModel: FHudViewModel,
    UnitId: string | null
  ): FBattleUnitHudState | null {
    if (!UnitId) {
      return null;
    }
    return ViewModel.Battle3CState.Units.find((Unit) => Unit.UnitId === UnitId) ?? null;
  }

  private ResolveBattleCenterMeters(ViewModel: FHudViewModel, DropOffsetCm: number): Vector3 {
    if (ViewModel.Battle3CState.Units.length === 0) {
      return Vector3.Zero();
    }
    let SumX = 0;
    let SumY = 0;
    let SumZ = 0;
    ViewModel.Battle3CState.Units.forEach((Unit) => {
      const Position = this.ResolveBattleUnitPositionMeters(Unit, DropOffsetCm);
      SumX += Position.x;
      SumY += Position.y;
      SumZ += Position.z;
    });
    const Count = ViewModel.Battle3CState.Units.length;
    return new Vector3(SumX / Count, SumY / Count, SumZ / Count);
  }

  private ResolveTargetGroupCenterMeters(
    ViewModel: FHudViewModel,
    TargetUnitIds: string[],
    DropOffsetCm: number
  ): Vector3 {
    const Targets = TargetUnitIds.map((TargetId) =>
      this.FindBattleUnit(ViewModel, TargetId)
    ).filter((Unit): Unit is FBattleUnitHudState => Unit !== null);
    if (Targets.length === 0) {
      return this.ResolveBattleCenterMeters(ViewModel, DropOffsetCm);
    }

    let SumX = 0;
    let SumY = 0;
    let SumZ = 0;
    Targets.forEach((Unit) => {
      const Position = this.ResolveBattleUnitPositionMeters(Unit, DropOffsetCm);
      SumX += Position.x;
      SumY += Position.y;
      SumZ += Position.z;
    });
    const Count = Targets.length;
    return new Vector3(SumX / Count, SumY / Count, SumZ / Count);
  }

  private ResolveEncounterDropOffsetCm(ViewModel: FHudViewModel): number {
    if (ViewModel.RuntimePhase !== "EncounterTransition" || !ViewModel.EncounterState.StartedAtMs) {
      return 0;
    }

    const ElapsedMs = Date.now() - ViewModel.EncounterState.StartedAtMs;
    const DropMs = Math.max(ViewModel.EncounterState.DropDurationSec * 1000, 1);
    const StartHeight = ViewModel.DebugState.Config.BattleDropStartHeightCm;
    const DropProgress = this.Clamp(ElapsedMs / DropMs, 0, 1);
    return this.Lerp(StartHeight, 0, DropProgress);
  }

  private ResolveEncounterIntroProgress(ViewModel: FHudViewModel): number {
    if (ViewModel.RuntimePhase !== "EncounterTransition" || !ViewModel.EncounterState.StartedAtMs) {
      return 1;
    }

    const ElapsedMs = Date.now() - ViewModel.EncounterState.StartedAtMs;
    const IntroMs = Math.max(ViewModel.EncounterState.IntroDurationSec * 1000, 1);
    return this.Clamp(ElapsedMs / IntroMs, 0, 1);
  }

  private ResolveForwardVectorFromYawDeg(YawDeg: number): Vector3 {
    const YawRadians = (YawDeg * Math.PI) / 180;
    return new Vector3(Math.sin(YawRadians), 0, Math.cos(YawRadians));
  }

  private ResolveRightVectorFromYawDeg(YawDeg: number): Vector3 {
    const YawRadians = (YawDeg * Math.PI) / 180;
    return new Vector3(Math.cos(YawRadians), 0, -Math.sin(YawRadians));
  }

  private CreateOverworldEnemyMesh(EnemyId: string): Mesh {
    const EnemyMesh = MeshBuilder.CreateCylinder(
      `OverworldEnemy_${EnemyId}`,
      {
        height: 2,
        diameterTop: 1.25,
        diameterBottom: 0.08,
        tessellation: 4
      },
      this.Scene
    );
    const Material = new StandardMaterial(`OverworldEnemyMat_${EnemyId}`, this.Scene);
    Material.diffuseColor = Color3.FromHexString(USceneBridge.OverworldEnemyColorHex);
    EnemyMesh.material = Material;
    this.OverworldEnemyMeshMap.set(EnemyId, EnemyMesh);
    return EnemyMesh;
  }

  private CreateBattleUnitMesh(Unit: FBattleUnitHudState): Mesh {
    const UnitMesh =
      Unit.TeamId === "Player"
        ? MeshBuilder.CreateCapsule(
            `BattleUnit_${Unit.UnitId}`,
            {
              height: 1.7,
              radius: 0.38
            },
            this.Scene
          )
        : MeshBuilder.CreateCylinder(
            `BattleUnit_${Unit.UnitId}`,
            {
              height: 1.8,
              diameterTop: 1.2,
              diameterBottom: 0.06,
              tessellation: 4
            },
            this.Scene
          );

    const Material = new StandardMaterial(`BattleUnitMat_${Unit.UnitId}`, this.Scene);
    Material.diffuseColor = new Color3(0.7, 0.7, 0.7);
    UnitMesh.material = Material;

    this.BattleUnitMeshMap.set(Unit.UnitId, UnitMesh);
    return UnitMesh;
  }

  private CreateSkyCloudMaterial(): StandardMaterial {
    const Material = new StandardMaterial("SkyCloudMaterial", this.Scene);
    Material.diffuseColor = new Color3(1, 1, 1);
    Material.emissiveColor = new Color3(0.92, 0.95, 1);
    Material.alpha = 0.86;
    return Material;
  }

  private CreateSkyCloudActors(): FSkyCloudActor[] {
    const Seeds = [
      { X: -22, Y: 8.5, Z: -14, Scale: 1.1, Speed: 0.75, Drift: 0.75, Phase: 0.2 },
      { X: -8, Y: 9.2, Z: -2, Scale: 0.95, Speed: 0.63, Drift: 0.55, Phase: 0.8 },
      { X: 7, Y: 8.8, Z: -18, Scale: 1.05, Speed: 0.7, Drift: 0.62, Phase: 1.5 },
      { X: 18, Y: 9.5, Z: 3, Scale: 0.9, Speed: 0.58, Drift: 0.48, Phase: 2.1 },
      { X: 26, Y: 8.7, Z: -9, Scale: 1.2, Speed: 0.82, Drift: 0.72, Phase: 2.8 }
    ];

    return Seeds.map((Seed, Index) => {
      const Root = new TransformNode(`SkyCloud_${Index}`, this.Scene);
      Root.position = new Vector3(Seed.X, Seed.Y, Seed.Z);

      this.CreateCloudPuff(`Cloud_${Index}_A`, Root, new Vector3(-0.9, 0, 0), 1.2 * Seed.Scale);
      this.CreateCloudPuff(`Cloud_${Index}_B`, Root, new Vector3(0, 0.15, 0.18), 1.35 * Seed.Scale);
      this.CreateCloudPuff(
        `Cloud_${Index}_C`,
        Root,
        new Vector3(0.95, 0.04, -0.12),
        1.05 * Seed.Scale
      );

      return {
        Root,
        BaseX: Seed.X,
        Speed: Seed.Speed,
        DriftRange: Seed.Drift,
        Phase: Seed.Phase
      };
    });
  }

  private CreateCloudPuff(Name: string, Root: TransformNode, Offset: Vector3, Scale: number): void {
    const Puff = MeshBuilder.CreateSphere(
      Name,
      {
        diameter: 1
      },
      this.Scene
    );
    Puff.parent = Root;
    Puff.position = Offset;
    Puff.scaling = new Vector3(2.4 * Scale, 0.65 * Scale, 1.25 * Scale);
    Puff.material = this.SkyCloudMaterial;
  }

  private ResolveBattleUnitBaseColor(Unit: FBattleUnitHudState): Color3 {
    if (Unit.TeamId === "Player") {
      return Unit.UnitId === "P_YELLOW"
        ? Color3.FromHexString(USceneBridge.OverworldPlayerColorHex)
        : Color3.FromHexString(USceneBridge.BattlePlayerSecondaryColorHex);
    }

    return Unit.IsEncounterPrimaryEnemy
      ? Color3.FromHexString(USceneBridge.BattleEnemyMainColorHex)
      : Color3.FromHexString(USceneBridge.BattleEnemyColorHex);
  }

  private AdjustColorBrightness(Color: Color3, Delta: number): Color3 {
    return new Color3(
      this.Clamp(Color.r + Delta, 0, 1),
      this.Clamp(Color.g + Delta, 0, 1),
      this.Clamp(Color.b + Delta, 0, 1)
    );
  }

  private UpdateSkyClouds(DeltaSeconds: number): void {
    const WrapLimit = 44;
    this.SkyCloudActors.forEach((CloudActor) => {
      let NextZ = CloudActor.Root.position.z + CloudActor.Speed * DeltaSeconds;
      if (NextZ > WrapLimit) {
        NextZ = -WrapLimit;
      }

      const DriftX =
        CloudActor.BaseX +
        Math.sin(this.ElapsedSeconds * 0.16 + CloudActor.Phase) * CloudActor.DriftRange;
      CloudActor.Root.position.x = DriftX;
      CloudActor.Root.position.z = NextZ;
    });
  }

  private ToMeters(Centimeters: number): number {
    return Centimeters * USceneBridge.CentimetersToMeters;
  }

  private Clamp(Value: number, Min: number, Max: number): number {
    return Math.min(Math.max(Value, Min), Max);
  }

  private Lerp(Start: number, End: number, Alpha: number): number {
    return Start + (End - Start) * this.Clamp(Alpha, 0, 1);
  }

  private ResizeEngine(): void {
    this.Engine.resize();
  }
}
