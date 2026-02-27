import {
  AbstractMesh,
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  LinesMesh,
  Matrix,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";

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

interface FScreenAnchor {
  X: number;
  Y: number;
}

interface FSceneBridgeOptions {
  OnControlledUnitAnchorUpdated?: (Anchor: FScreenAnchor | null) => void;
}

interface FCharacterModelVisual {
  UnitId: string;
  ModelPath: string;
  RootNode: TransformNode;
  RootMeshes: AbstractMesh[];
  GroundOffsetMeters: number;
  MuzzleSocketNode: TransformNode;
  UsesFallbackMuzzle: boolean;
  IsLoadFailed: boolean;
}

interface FMuzzleGizmoVisual {
  Sphere: Mesh;
  ForwardLine: LinesMesh;
}

export class USceneBridge {
  private static readonly CentimetersToMeters = 0.01;
  private static readonly OverworldGroundColorHex = "#333a41";
  private static readonly OverworldPlayerColorHex = "#dba511";
  private static readonly OverworldEnemyColorHex = "#3385e8";
  private static readonly BattlePlayerSecondaryColorHex = "#be2f35";
  private static readonly BattlePlayerTertiaryColorHex = "#5ca86a";
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
  private SunLight!: DirectionalLight;
  private SunShadowGenerator!: ShadowGenerator;
  private readonly OverworldEnemyMeshMap: Map<string, Mesh>;
  private readonly BattleUnitMeshMap: Map<string, Mesh>;
  private readonly CharacterModelVisualMap: Map<string, FCharacterModelVisual>;
  private readonly CharacterModelLoadPromiseMap: Map<string, Promise<void>>;
  private readonly MuzzleGizmoMap: Map<string, FMuzzleGizmoVisual>;
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
  private readonly OnControlledUnitAnchorUpdated: ((Anchor: FScreenAnchor | null) => void) | null;
  private LastControlledUnitAnchor: FScreenAnchor | null;

  public constructor(Canvas: HTMLCanvasElement, Options?: FSceneBridgeOptions) {
    this.Engine = new Engine(Canvas, true);
    this.Scene = new Scene(this.Engine);
    this.Scene.clearColor = new Color4(0.47, 0.71, 0.94, 1);
    this.OverworldEnemyMeshMap = new Map();
    this.BattleUnitMeshMap = new Map();
    this.CharacterModelVisualMap = new Map();
    this.CharacterModelLoadPromiseMap = new Map();
    this.MuzzleGizmoMap = new Map();
    this.CurrentViewModel = null;
    this.OnControlledUnitAnchorUpdated = Options?.OnControlledUnitAnchorUpdated ?? null;
    this.LastControlledUnitAnchor = null;

    this.Camera = this.CreateCamera();
    this.OverworldGround = this.CreateOverworldGround();
    this.OverworldGrid = this.CreateOverworldGrid(30, 1, "OverworldGrid");
    this.BattleGround = this.CreateBattleGround();
    this.BattleGrid = this.CreateOverworldGrid(12, 0.5, "BattleGrid", true);
    this.PlayerMesh = this.CreatePlayerMesh();
    this.PlayerForwardArrowMesh = this.CreatePlayerForwardArrowMesh();
    this.CreateLight();
    this.ConfigureShadowReceivers();
    this.RegisterShadowCaster(this.PlayerMesh);
    this.RegisterShadowCaster(this.PlayerForwardArrowMesh);
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
    this.MuzzleGizmoMap.forEach((Gizmo) => {
      Gizmo.ForwardLine.dispose();
      Gizmo.Sphere.dispose();
    });
    this.MuzzleGizmoMap.clear();
    this.CharacterModelVisualMap.forEach((Visual) => {
      Visual.RootNode.dispose();
    });
    this.CharacterModelVisualMap.clear();
    this.CharacterModelLoadPromiseMap.clear();
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
    this.SyncControlledUnitAnchor(ViewModel);
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
    MainLight.intensity = 0.32;
    MainLight.groundColor = Color3.FromHexString(USceneBridge.MainLightGroundColorHex);

    this.SunLight = new DirectionalLight("SunLight", new Vector3(-0.45, -1, 0.3), this.Scene);
    this.SunLight.position = new Vector3(22, 32, -14);
    this.SunLight.intensity = 2.1;
    this.SunLight.diffuse = new Color3(1, 0.97, 0.9);
    this.SunLight.specular = new Color3(1, 0.95, 0.88);
    this.SunLight.shadowMinZ = 0.1;
    this.SunLight.shadowMaxZ = 120;
    this.SunLight.autoCalcShadowZBounds = true;

    this.SunShadowGenerator = new ShadowGenerator(2048, this.SunLight);
    this.SunShadowGenerator.usePercentageCloserFiltering = true;
    this.SunShadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    this.SunShadowGenerator.bias = 0.0008;
    this.SunShadowGenerator.normalBias = 0.015;
    this.SunShadowGenerator.darkness = 0.5;
    this.SunShadowGenerator.forceBackFacesOnly = true;
  }

  private ConfigureShadowReceivers(): void {
    this.OverworldGround.receiveShadows = true;
    this.BattleGround.receiveShadows = true;
  }

  private RegisterShadowCaster(Target: AbstractMesh): void {
    if (!this.SunShadowGenerator || Target.isDisposed()) {
      return;
    }
    this.SunShadowGenerator.addShadowCaster(Target, true);
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
    this.ApplyGroundSurfaceMaterial(GroundMaterial);
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
    this.ApplyGroundSurfaceMaterial(GroundMaterial);
    Ground.material = GroundMaterial;
    return Ground;
  }

  private ApplyGroundSurfaceMaterial(Material: StandardMaterial): void {
    Material.roughness = 0.8;
    Material.specularColor = new Color3(0.12, 0.12, 0.12);
    Material.specularPower = 16;
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
    this.HideAllCharacterModels();
    this.PlayerMesh.setEnabled(true);
    this.PlayerForwardArrowMesh.setEnabled(true);

    const Player = ViewModel.OverworldState.PlayerPosition;
    this.PlayerMesh.position = new Vector3(this.ToMeters(Player.X), 0.85, this.ToMeters(Player.Z));
    this.PlayerMesh.rotation = new Vector3(
      0,
      (ViewModel.OverworldState.PlayerYawDegrees * Math.PI) / 180,
      0
    );

    this.SyncOverworldPlayerModel(ViewModel);
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
    this.HideAllCharacterModels();
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

  private HideAllCharacterModels(): void {
    this.CharacterModelVisualMap.forEach((Visual) => {
      Visual.RootNode.setEnabled(false);
      this.SetMuzzleGizmoVisible(Visual.UnitId, false);
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
      Mesh.position = this.ResolveBattleUnitPositionMeters(Unit, DropOffsetCm);
      Mesh.rotation = new Vector3(0, (Unit.YawDeg * Math.PI) / 180, 0);
      const IsPlayer = Unit.TeamId === "Player";
      const IsModelReady = IsPlayer
        ? this.SyncBattlePlayerModel(Unit, ViewModel, DropOffsetCm)
        : false;
      const ShouldShowFallback =
        !IsPlayer || (!IsModelReady && ViewModel.DebugState.Config.FallbackToPlaceholderOnLoadFail);
      Mesh.setEnabled(ShouldShowFallback);

      if (ShouldShowFallback) {
        const Material = Mesh.material as StandardMaterial;
        if (!Unit.IsAlive) {
          Material.diffuseColor = new Color3(0.24, 0.24, 0.24);
        } else {
          Material.diffuseColor = this.ResolveBattleUnitBaseColor(Unit);
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

  private SyncOverworldPlayerModel(ViewModel: FHudViewModel): void {
    const DisplayUnitId = ViewModel.OverworldState.ControlledTeamOverworldDisplayUnitId;
    if (!DisplayUnitId) {
      return;
    }

    const ModelPath = this.ResolvePlayerModelPathByUnitId(DisplayUnitId, null, ViewModel);
    if (!ModelPath) {
      return;
    }

    this.EnsureCharacterModelVisual(DisplayUnitId, ModelPath, ViewModel);
    const Visual = this.CharacterModelVisualMap.get(DisplayUnitId);
    if (!Visual || Visual.IsLoadFailed) {
      this.SetMuzzleGizmoVisible(DisplayUnitId, false);
      return;
    }

    const PlayerPosition = new Vector3(
      this.ToMeters(ViewModel.OverworldState.PlayerPosition.X),
      0,
      this.ToMeters(ViewModel.OverworldState.PlayerPosition.Z)
    );
    this.ApplyCharacterVisualPose(
      Visual,
      PlayerPosition,
      ViewModel.OverworldState.PlayerYawDegrees,
      ViewModel.DebugState.Config.ModelAxisFixPreset
    );
    this.UpdateMuzzleGizmoForVisual(Visual, ViewModel);
    this.PlayerMesh.setEnabled(false);
  }

  private SyncBattlePlayerModel(
    Unit: FBattleUnitHudState,
    ViewModel: FHudViewModel,
    DropOffsetCm: number
  ): boolean {
    const ModelPath = this.ResolvePlayerModelPathByUnitId(Unit.UnitId, Unit, ViewModel);
    if (!ModelPath) {
      return false;
    }

    this.EnsureCharacterModelVisual(Unit.UnitId, ModelPath, ViewModel);
    const Visual = this.CharacterModelVisualMap.get(Unit.UnitId);
    if (!Visual || Visual.IsLoadFailed) {
      this.SetMuzzleGizmoVisible(Unit.UnitId, false);
      return false;
    }

    this.ApplyCharacterVisualPose(
      Visual,
      this.ResolveBattlePlayerModelPositionMeters(Unit, DropOffsetCm),
      Unit.YawDeg,
      ViewModel.DebugState.Config.ModelAxisFixPreset
    );
    this.UpdateMuzzleGizmoForVisual(Visual, ViewModel);
    return true;
  }

  private ResolvePlayerModelPathByUnitId(
    UnitId: string,
    Unit: FBattleUnitHudState | null,
    ViewModel: FHudViewModel
  ): string | null {
    if (Unit?.ModelAssetPath) {
      return Unit.ModelAssetPath;
    }

    const ModelMap: Record<string, string> = {
      char01: ViewModel.DebugState.Config.UnitModelChar01Path,
      char02: ViewModel.DebugState.Config.UnitModelChar02Path,
      char03: ViewModel.DebugState.Config.UnitModelChar03Path,
      P_YELLOW: ViewModel.DebugState.Config.UnitModelChar01Path,
      P_RED: ViewModel.DebugState.Config.UnitModelChar02Path
    };
    return ModelMap[UnitId] ?? null;
  }

  private EnsureCharacterModelVisual(
    UnitId: string,
    ModelPath: string,
    ViewModel: FHudViewModel
  ): void {
    const ExistingVisual = this.CharacterModelVisualMap.get(UnitId);
    if (ExistingVisual && ExistingVisual.ModelPath === ModelPath) {
      return;
    }

    if (ExistingVisual && ExistingVisual.ModelPath !== ModelPath) {
      ExistingVisual.RootNode.dispose();
      this.CharacterModelVisualMap.delete(UnitId);
      this.SetMuzzleGizmoVisible(UnitId, false);
    }

    if (this.CharacterModelLoadPromiseMap.has(UnitId)) {
      return;
    }

    const LoadPromise = this.LoadCharacterModelVisual(
      UnitId,
      ModelPath,
      ViewModel.DebugState.Config.MuzzleSocketPrefix,
      ViewModel.DebugState.Config.UseFallbackMuzzleIfMissing
    )
      .then((Visual) => {
        this.CharacterModelVisualMap.set(UnitId, Visual);
      })
      .catch((Error) => {
        // 资源加载失败时保留占位兜底，不中断渲染循环。
        console.warn(`[USceneBridge] 角色模型加载失败: ${ModelPath}`, Error);
        this.CharacterModelVisualMap.set(
          UnitId,
          this.CreateFailedCharacterModelVisual(UnitId, ModelPath)
        );
      })
      .finally(() => {
        this.CharacterModelLoadPromiseMap.delete(UnitId);
      });
    this.CharacterModelLoadPromiseMap.set(UnitId, LoadPromise);
  }

  private async LoadCharacterModelVisual(
    UnitId: string,
    ModelPath: string,
    MuzzleSocketPrefix: string,
    UseFallbackMuzzleIfMissing: boolean
  ): Promise<FCharacterModelVisual> {
    const { RootUrl, FileName } = this.SplitModelPath(ModelPath);
    const ImportResult = await SceneLoader.ImportMeshAsync("", RootUrl, FileName, this.Scene);
    const RootNode = new TransformNode(`CharacterRoot_${UnitId}`, this.Scene);
    const RootMeshes = ImportResult.meshes.filter((ImportedMesh) => ImportedMesh.parent === null);
    RootMeshes.forEach((RootMesh) => {
      RootMesh.parent = RootNode;
      this.RegisterShadowCaster(RootMesh);
    });
    RootNode.setEnabled(false);
    const GroundOffsetMeters = this.ResolveModelGroundOffsetMeters(RootMeshes);

    const ResolvedSocket = this.ResolveMuzzleSocketNode({
      UnitId,
      RootNode,
      Prefix: MuzzleSocketPrefix,
      UseFallback: UseFallbackMuzzleIfMissing
    });

    return {
      UnitId,
      ModelPath,
      RootNode,
      RootMeshes,
      GroundOffsetMeters,
      MuzzleSocketNode: ResolvedSocket.Node,
      UsesFallbackMuzzle: ResolvedSocket.UsedFallback,
      IsLoadFailed: false
    };
  }

  private CreateFailedCharacterModelVisual(
    UnitId: string,
    ModelPath: string
  ): FCharacterModelVisual {
    const RootNode = new TransformNode(`CharacterRootFailed_${UnitId}`, this.Scene);
    RootNode.setEnabled(false);
    return {
      UnitId,
      ModelPath,
      RootNode,
      RootMeshes: [],
      GroundOffsetMeters: 0,
      MuzzleSocketNode: RootNode,
      UsesFallbackMuzzle: true,
      IsLoadFailed: true
    };
  }

  private ResolveMuzzleSocketNode(Options: {
    UnitId: string;
    RootNode: TransformNode;
    Prefix: string;
    UseFallback: boolean;
  }): { Node: TransformNode; UsedFallback: boolean } {
    const PrefixLower = Options.Prefix.toLowerCase();
    const Candidates = Options.RootNode.getChildTransformNodes(false).filter((Node) =>
      Node.name.toLowerCase().startsWith(PrefixLower)
    );
    if (Candidates.length > 0) {
      const ExactMatch =
        Candidates.find((Node) => Node.name.toLowerCase() === PrefixLower) ??
        [...Candidates].sort((Left, Right) => Left.name.localeCompare(Right.name))[0];
      return {
        Node: ExactMatch,
        UsedFallback: false
      };
    }

    if (!Options.UseFallback) {
      return {
        Node: Options.RootNode,
        UsedFallback: true
      };
    }

    const FallbackSocket = new TransformNode(`FallbackMuzzle_${Options.UnitId}`, this.Scene);
    FallbackSocket.parent = Options.RootNode;
    FallbackSocket.position = new Vector3(0.35, 1.25, 0.55);
    return {
      Node: FallbackSocket,
      UsedFallback: true
    };
  }

  private ResolveModelGroundOffsetMeters(RootMeshes: AbstractMesh[]): number {
    if (RootMeshes.length < 1) {
      return 0;
    }

    let MinY = Number.POSITIVE_INFINITY;
    RootMeshes.forEach((RootMesh) => {
      RootMesh.computeWorldMatrix(true);
      MinY = Math.min(MinY, RootMesh.getBoundingInfo().boundingBox.minimumWorld.y);
    });
    if (!Number.isFinite(MinY)) {
      return 0;
    }

    return -MinY;
  }

  private ResolveBattlePlayerModelPositionMeters(
    Unit: FBattleUnitHudState,
    DropOffsetCm: number
  ): Vector3 {
    return new Vector3(
      this.ToMeters(Unit.PositionCm.X),
      this.ToMeters(Unit.PositionCm.Y + DropOffsetCm),
      this.ToMeters(Unit.PositionCm.Z)
    );
  }

  private ApplyCharacterVisualPose(
    Visual: FCharacterModelVisual,
    Position: Vector3,
    YawDeg: number,
    AxisFixPreset: FHudViewModel["DebugState"]["Config"]["ModelAxisFixPreset"]
  ): void {
    Visual.RootNode.position = new Vector3(
      Position.x,
      Position.y + Visual.GroundOffsetMeters,
      Position.z
    );
    Visual.RootNode.rotation = new Vector3(
      0,
      (YawDeg * Math.PI) / 180 + this.ResolveAxisFixYawRadians(AxisFixPreset),
      0
    );
    Visual.RootNode.setEnabled(true);
  }

  private ResolveAxisFixYawRadians(
    AxisFixPreset: FHudViewModel["DebugState"]["Config"]["ModelAxisFixPreset"]
  ): number {
    switch (AxisFixPreset) {
      case "RotateY90":
        return Math.PI / 2;
      case "RotateYMinus90":
        return -Math.PI / 2;
      case "RotateY180":
        return Math.PI;
      case "None":
      default:
        return 0;
    }
  }

  private UpdateMuzzleGizmoForVisual(
    Visual: FCharacterModelVisual,
    ViewModel: FHudViewModel
  ): void {
    if (!ViewModel.DebugState.Config.ShowMuzzleSocketGizmo) {
      this.SetMuzzleGizmoVisible(Visual.UnitId, false);
      return;
    }

    const StartPosition = Visual.MuzzleSocketNode.getAbsolutePosition();
    const Forward = Vector3.TransformNormal(
      new Vector3(1, 0, 0),
      Visual.MuzzleSocketNode.getWorldMatrix()
    );
    if (Forward.lengthSquared() <= 1e-8) {
      this.SetMuzzleGizmoVisible(Visual.UnitId, false);
      return;
    }
    const EndPosition = StartPosition.add(Forward.normalize().scale(0.45));

    const Existing = this.MuzzleGizmoMap.get(Visual.UnitId);
    if (!Existing) {
      const Sphere = MeshBuilder.CreateSphere(
        `MuzzleSocketSphere_${Visual.UnitId}`,
        { diameter: 0.08 },
        this.Scene
      );
      const SphereMaterial = new StandardMaterial(
        `MuzzleSocketSphereMat_${Visual.UnitId}`,
        this.Scene
      );
      SphereMaterial.diffuseColor = new Color3(1, 0.86, 0.1);
      Sphere.material = SphereMaterial;
      Sphere.isPickable = false;
      const ForwardLine = MeshBuilder.CreateLines(
        `MuzzleSocketLine_${Visual.UnitId}`,
        {
          points: [StartPosition, EndPosition]
        },
        this.Scene
      );
      ForwardLine.color = new Color3(1, 0.45, 0.15);
      ForwardLine.isPickable = false;
      this.MuzzleGizmoMap.set(Visual.UnitId, {
        Sphere,
        ForwardLine
      });
    } else {
      Existing.Sphere.position.copyFrom(StartPosition);
      const UpdatedLine = MeshBuilder.CreateLines(
        `MuzzleSocketLine_${Visual.UnitId}`,
        {
          points: [StartPosition, EndPosition],
          instance: Existing.ForwardLine
        },
        this.Scene
      );
      UpdatedLine.color = new Color3(1, 0.45, 0.15);
    }

    this.SetMuzzleGizmoVisible(Visual.UnitId, true);
  }

  private SetMuzzleGizmoVisible(UnitId: string, IsVisible: boolean): void {
    const Gizmo = this.MuzzleGizmoMap.get(UnitId);
    if (!Gizmo) {
      return;
    }
    Gizmo.Sphere.setEnabled(IsVisible);
    Gizmo.ForwardLine.setEnabled(IsVisible);
  }

  private SplitModelPath(ModelPath: string): { RootUrl: string; FileName: string } {
    const LastSlashIndex = ModelPath.lastIndexOf("/");
    if (LastSlashIndex < 0) {
      return {
        RootUrl: "/",
        FileName: ModelPath
      };
    }
    return {
      RootUrl: ModelPath.slice(0, LastSlashIndex + 1),
      FileName: ModelPath.slice(LastSlashIndex + 1)
    };
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
    this.RegisterShadowCaster(EnemyMesh);
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
    this.RegisterShadowCaster(UnitMesh);

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
      if (Unit.UnitId === "char01" || Unit.UnitId === "P_YELLOW") {
        return Color3.FromHexString(USceneBridge.OverworldPlayerColorHex);
      }
      if (Unit.UnitId === "char02" || Unit.UnitId === "P_RED") {
        return Color3.FromHexString(USceneBridge.BattlePlayerSecondaryColorHex);
      }
      return Color3.FromHexString(USceneBridge.BattlePlayerTertiaryColorHex);
    }

    return Unit.IsEncounterPrimaryEnemy
      ? Color3.FromHexString(USceneBridge.BattleEnemyMainColorHex)
      : Color3.FromHexString(USceneBridge.BattleEnemyColorHex);
  }

  private SyncControlledUnitAnchor(ViewModel: FHudViewModel): void {
    if (!this.OnControlledUnitAnchorUpdated) {
      return;
    }

    if (ViewModel.RuntimePhase !== "Battle3C") {
      this.EmitControlledUnitAnchorIfChanged(null);
      return;
    }

    const ControlledUnit = this.FindBattleUnit(
      ViewModel,
      ViewModel.Battle3CState.ControlledCharacterId
    );
    if (!ControlledUnit || !ControlledUnit.IsAlive) {
      this.EmitControlledUnitAnchorIfChanged(null);
      return;
    }

    const DropOffsetCm = this.ResolveEncounterDropOffsetCm(ViewModel);
    const UnitWorldPos = this.ResolveBattleUnitPositionMeters(ControlledUnit, DropOffsetCm).add(
      new Vector3(0, 0.45, 0)
    );
    const Anchor = this.ProjectWorldToScreenAnchor(UnitWorldPos);
    this.EmitControlledUnitAnchorIfChanged(Anchor);
  }

  private ProjectWorldToScreenAnchor(WorldPosition: Vector3): FScreenAnchor | null {
    const RenderWidth = this.Engine.getRenderWidth();
    const RenderHeight = this.Engine.getRenderHeight();
    if (RenderWidth <= 0 || RenderHeight <= 0) {
      return null;
    }

    const Viewport = this.Camera.viewport.toGlobal(RenderWidth, RenderHeight);
    const ScreenPosition = Vector3.Project(
      WorldPosition,
      Matrix.IdentityReadOnly,
      this.Scene.getTransformMatrix(),
      Viewport
    );
    if (!Number.isFinite(ScreenPosition.x) || !Number.isFinite(ScreenPosition.y)) {
      return null;
    }

    const X = ScreenPosition.x / RenderWidth;
    const Y = ScreenPosition.y / RenderHeight;
    if (X < 0 || X > 1 || Y < 0 || Y > 1 || ScreenPosition.z < 0 || ScreenPosition.z > 1) {
      return null;
    }

    return {
      X,
      Y
    };
  }

  private EmitControlledUnitAnchorIfChanged(Anchor: FScreenAnchor | null): void {
    if (this.AreAnchorsEqual(this.LastControlledUnitAnchor, Anchor)) {
      return;
    }

    this.LastControlledUnitAnchor = Anchor ? { ...Anchor } : null;
    this.OnControlledUnitAnchorUpdated?.(Anchor ? { ...Anchor } : null);
  }

  private AreAnchorsEqual(Left: FScreenAnchor | null, Right: FScreenAnchor | null): boolean {
    if (!Left && !Right) {
      return true;
    }

    if (!Left || !Right) {
      return false;
    }

    const Epsilon = 0.0006;
    return Math.abs(Left.X - Right.X) <= Epsilon && Math.abs(Left.Y - Right.Y) <= Epsilon;
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
