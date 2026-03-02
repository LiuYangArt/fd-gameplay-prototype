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
  Ray,
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

interface FBattleCameraPose {
  Target: Vector3;
  Position: Vector3;
  FovDeg: number;
}

interface FBattleCameraBlendState {
  StartElapsedSec: number;
  DurationSec: number;
  FromTarget: Vector3;
  FromPosition: Vector3;
  FromFovDeg: number;
}

interface FScreenAnchor {
  X: number;
  Y: number;
}

interface FAimHoverTargetScreenState {
  UnitId: string;
  Anchor: FScreenAnchor;
}

interface FSceneBridgeOptions {
  OnControlledUnitAnchorUpdated?: (Anchor: FScreenAnchor | null) => void;
  OnAimHoverTargetUpdated?: (State: FAimHoverTargetScreenState | null) => void;
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

interface FShotProjectileVisual {
  Mesh: Mesh;
  Material: StandardMaterial;
  StartPosition: Vector3;
  EndPosition: Vector3;
  ShouldSpawnImpact: boolean;
  ElapsedSec: number;
  DurationSec: number;
}

interface FTargetSwitchBlendOptions {
  IsModeChanged: boolean;
  CameraMode: FBattleCameraMode;
  PreviousSelectedTargetId: string | null;
  CurrentSelectedTargetId: string | null;
}

export function ShouldBlendOnBattleTargetSwitch(Options: FTargetSwitchBlendOptions): boolean {
  const BlendModes = new Set<FBattleCameraMode>(["SkillTargetZoom", "PlayerItemPreview"]);
  return (
    !Options.IsModeChanged &&
    BlendModes.has(Options.CameraMode) &&
    Options.PreviousSelectedTargetId !== null &&
    Options.CurrentSelectedTargetId !== null &&
    Options.PreviousSelectedTargetId !== Options.CurrentSelectedTargetId
  );
}

export function ResolveTargetSelectBasisForwardFromPositions(
  _SelectedPos: Vector3,
  _ControlledPos: Vector3,
  _BattleCenter: Vector3,
  TargetSelectYawDeg: number = 180
): Vector3 {
  const YawRad = (TargetSelectYawDeg * Math.PI) / 180;
  const FixedForward = new Vector3(Math.cos(YawRad), 0, Math.sin(YawRad));
  if (FixedForward.lengthSquared() > 1e-6) {
    return FixedForward.normalize();
  }

  return new Vector3(-1, 0, 0);
}

interface FShotRay {
  Origin: Vector3;
  Direction: Vector3;
}

interface FShotRayHit {
  UnitId: string;
  DistanceMeters: number;
  HitPoint: Vector3;
}

interface FHitImpactVisual {
  CoreMesh: Mesh;
  CoreMaterial: StandardMaterial;
  RingMesh: Mesh;
  RingMaterial: StandardMaterial;
  ElapsedSec: number;
  DurationSec: number;
}

interface FHitSparkVisual {
  Mesh: Mesh;
  Material: StandardMaterial;
  Velocity: Vector3;
  ElapsedSec: number;
  DurationSec: number;
}

export class USceneBridge {
  private static readonly CentimetersToMeters = 0.01;
  private static readonly AimCameraBlendDurationSec = 0.2;
  private static readonly ControlledUnitSwitchBlendDurationSec = 0.28;
  private static readonly UnitYawBlendSpeed = 14;
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
  private static readonly ShotMissTraceDistanceMeters = 36;
  private static readonly ShotRaycastEnemyRadiusMeters = 0.95;
  private static readonly HitSparkCount = 28;
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
  private CurrentFrameDeltaSeconds: number;
  private ElapsedSeconds: number;
  private LaggedCameraTargetCm: FVector3Cm | null;
  private LastCameraUpdateTimeMs: number | null;
  private LastCameraRuntimePhase: FRuntimePhase | null;
  private CurrentViewModel: FHudViewModel | null;
  private readonly OnControlledUnitAnchorUpdated: ((Anchor: FScreenAnchor | null) => void) | null;
  private readonly OnAimHoverTargetUpdated:
    | ((State: FAimHoverTargetScreenState | null) => void)
    | null;
  private LastControlledUnitAnchor: FScreenAnchor | null;
  private LastAimHoverTargetState: FAimHoverTargetScreenState | null;
  private LastConsumedShotId: number;
  private readonly ShotProjectileVisuals: FShotProjectileVisual[];
  private readonly HitImpactVisuals: FHitImpactVisual[];
  private readonly HitSparkVisuals: FHitSparkVisual[];
  private LastBattleCameraMode: FBattleCameraMode | null;
  private LastBattleControlledUnitId: string | null;
  private LastBattleSelectedTargetId: string | null;
  private BattleCameraBlendState: FBattleCameraBlendState | null;

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
    this.OnAimHoverTargetUpdated = Options?.OnAimHoverTargetUpdated ?? null;
    this.LastControlledUnitAnchor = null;
    this.LastAimHoverTargetState = null;
    this.LastConsumedShotId = 0;
    this.ShotProjectileVisuals = [];
    this.HitImpactVisuals = [];
    this.HitSparkVisuals = [];
    this.LastBattleCameraMode = null;
    this.LastBattleControlledUnitId = null;
    this.LastBattleSelectedTargetId = null;
    this.BattleCameraBlendState = null;

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
    this.CurrentFrameDeltaSeconds = 1 / 60;
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
      this.CurrentFrameDeltaSeconds = DeltaSeconds;
      this.ElapsedSeconds += DeltaSeconds;
      this.UpdateSkyClouds(DeltaSeconds);
      this.UpdateTransientBattleVisuals(DeltaSeconds);
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
    this.ClearTransientBattleVisuals();
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
    this.ConsumeBattleShotEvent(ViewModel);
    this.ApplyCamera(ViewModel);
    this.SyncControlledUnitAnchor(ViewModel);
    this.SyncAimHoverTarget(ViewModel);
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
    const Handlers: Record<FBattleCameraMode, () => FBattleCameraPose> = {
      IntroPullOut: () => this.ApplyIntroPullOutCamera(Context),
      IntroDropIn: () => this.ApplyIntroDropInCamera(Context),
      PlayerFollow: () => this.ApplyPlayerFollowCamera(Context),
      PlayerAim: () => this.ApplyPlayerAimCamera(Context),
      PlayerSkillPreview: () => this.ApplyPlayerSkillPreviewCamera(Context),
      PlayerItemPreview: () => this.ApplyPlayerItemPreviewCamera(Context),
      SkillTargetZoom: () => this.ApplySkillTargetZoomCamera(Context),
      EnemyAttackSingle: () => this.ApplyEnemyAttackCamera(Context),
      EnemyAttackAOE: () => this.ApplyEnemyAttackCamera(Context),
      SettlementCam: () => this.ApplySettlementCamera(Context)
    };
    const DesiredPose = Handlers[CameraMode]();
    const CameraPose = this.ResolveBattleCameraPoseWithBlend(ViewModel, CameraMode, DesiredPose);
    this.ApplyArcCameraFromPosition(CameraPose.Target, CameraPose.Position, CameraPose.FovDeg);
  }

  private BuildBattleCameraContext(ViewModel: FHudViewModel): FBattleCameraContext {
    const DropOffsetCm = this.ResolveEncounterDropOffsetCm(ViewModel);
    const BattleState = ViewModel.Battle3CState;
    const ControlledUnit = this.FindBattleUnit(ViewModel, BattleState.ControlledCharacterId);
    const SelectedUnit = this.FindBattleUnit(ViewModel, BattleState.SelectedTargetId);
    const CameraAnchorUnit = this.ResolveBattleCameraAnchorUnit(
      BattleState,
      ControlledUnit,
      SelectedUnit
    );
    const ControlledPos = this.ResolveBattleUnitPositionOrZero(CameraAnchorUnit, DropOffsetCm);
    const BattleCenter = this.ResolveBattleCenterMeters(ViewModel, DropOffsetCm);
    const SelectedPos = this.ResolveBattleUnitPositionOrFallback(
      SelectedUnit,
      DropOffsetCm,
      BattleCenter
    );
    const { YawDeg, PitchDeg } = this.ResolveBattleCameraAnchorYawPitch(
      BattleState,
      CameraAnchorUnit
    );

    return {
      ViewModel,
      DebugConfig: ViewModel.DebugState.Config,
      DropOffsetCm,
      ControlledUnit,
      ControlledPos,
      SelectedPos,
      BattleCenter,
      Forward: this.ResolveForwardVectorFromYawPitchDeg(YawDeg, PitchDeg),
      Right: this.ResolveRightVectorFromYawDeg(YawDeg)
    };
  }

  private ResolveBattleCameraAnchorUnit(
    BattleState: FHudViewModel["Battle3CState"],
    ControlledUnit: FBattleUnitHudState | null,
    SelectedUnit: FBattleUnitHudState | null
  ): FBattleUnitHudState | null {
    if (BattleState.CommandStage === "TargetSelect" && BattleState.PendingActionKind === "Item") {
      return SelectedUnit ?? ControlledUnit;
    }
    if (
      BattleState.CommandStage === "ActionResolve" &&
      BattleState.CameraMode === "PlayerItemPreview"
    ) {
      return SelectedUnit ?? ControlledUnit;
    }
    return ControlledUnit;
  }

  private ResolveBattleUnitPositionOrZero(
    Unit: FBattleUnitHudState | null,
    DropOffsetCm: number
  ): Vector3 {
    if (Unit === null) {
      return Vector3.Zero();
    }
    return this.ResolveBattleUnitPositionMeters(Unit, DropOffsetCm);
  }

  private ResolveBattleUnitPositionOrFallback(
    Unit: FBattleUnitHudState | null,
    DropOffsetCm: number,
    Fallback: Vector3
  ): Vector3 {
    if (Unit === null) {
      return Fallback;
    }
    return this.ResolveBattleUnitPositionMeters(Unit, DropOffsetCm);
  }

  private ResolveBattleCameraAnchorYawPitch(
    BattleState: FHudViewModel["Battle3CState"],
    CameraAnchorUnit: FBattleUnitHudState | null
  ): { YawDeg: number; PitchDeg: number } {
    if (BattleState.IsAimMode) {
      return {
        YawDeg: BattleState.AimCameraYawDeg ?? CameraAnchorUnit?.YawDeg ?? 0,
        PitchDeg: BattleState.AimCameraPitchDeg ?? 0
      };
    }
    return {
      YawDeg: CameraAnchorUnit?.YawDeg ?? 0,
      PitchDeg: 0
    };
  }

  private ApplyIntroPullOutCamera(Context: FBattleCameraContext): FBattleCameraPose {
    const FollowPose = this.ResolvePlayerFollowCameraPose(Context);
    const Position = FollowPose.Focus.add(
      Context.Forward.scale(-this.ToMeters(Context.DebugConfig.BattleIntroCameraStartDistanceCm))
    )
      .add(Context.Right.scale(this.ToMeters(Context.DebugConfig.BattleFollowShoulderOffsetCm)))
      .add(new Vector3(0, this.ToMeters(Context.DebugConfig.BattleIntroCameraStartHeightCm), 0));
    return {
      Target: FollowPose.Focus,
      Position,
      FovDeg: Context.DebugConfig.BattleIntroFovDeg
    };
  }

  private ApplyIntroDropInCamera(Context: FBattleCameraContext): FBattleCameraPose {
    const FollowPose = this.ResolvePlayerFollowCameraPose(Context);
    const IntroProgress = this.ResolveEncounterIntroProgress(Context.ViewModel);
    const StartPosition = FollowPose.Focus.add(
      Context.Forward.scale(-this.ToMeters(Context.DebugConfig.BattleIntroCameraStartDistanceCm))
    )
      .add(Context.Right.scale(this.ToMeters(Context.DebugConfig.BattleFollowShoulderOffsetCm)))
      .add(new Vector3(0, this.ToMeters(Context.DebugConfig.BattleIntroCameraStartHeightCm), 0));
    const Position = Vector3.Lerp(StartPosition, FollowPose.Position, IntroProgress);
    return {
      Target: FollowPose.Focus,
      Position,
      FovDeg: Context.DebugConfig.BattleIntroFovDeg
    };
  }

  private ApplyPlayerFollowCamera(Context: FBattleCameraContext): FBattleCameraPose {
    const FollowPose = this.ResolvePlayerFollowCameraPose(Context);
    return {
      Target: FollowPose.Focus,
      Position: FollowPose.Position,
      FovDeg: Context.DebugConfig.BattleIntroFovDeg
    };
  }

  private ApplyPlayerAimCamera(Context: FBattleCameraContext): FBattleCameraPose {
    const FocusOffset = Context.Right.scale(
      this.ToMeters(Context.DebugConfig.PlayerAimFocusOffsetRightCm)
    ).add(new Vector3(0, this.ToMeters(Context.DebugConfig.PlayerAimFocusOffsetUpCm), 0));
    const SocketPos = Context.ControlledPos.add(
      Context.Right.scale(this.ToMeters(Context.DebugConfig.PlayerAimShoulderOffsetCm))
    ).add(new Vector3(0, this.ToMeters(Context.DebugConfig.PlayerAimSocketUpCm), 0));
    const Position = SocketPos.add(
      Context.Forward.scale(-this.ToMeters(Context.DebugConfig.PlayerAimDistanceCm))
    );
    const Target = SocketPos.add(
      Context.Forward.scale(this.ToMeters(Context.DebugConfig.PlayerAimLookForwardDistanceCm))
    ).add(FocusOffset);
    return {
      Target,
      Position,
      FovDeg: Context.DebugConfig.PlayerAimFovDeg
    };
  }

  private ApplyPlayerSkillPreviewCamera(Context: FBattleCameraContext): FBattleCameraPose {
    const FocusOffset = Context.Right.scale(
      this.ToMeters(Context.DebugConfig.SkillPreviewFocusOffsetRightCm)
    ).add(new Vector3(0, this.ToMeters(Context.DebugConfig.SkillPreviewFocusOffsetUpCm), 0));
    const SocketPos = Context.ControlledPos.add(
      Context.Right.scale(this.ToMeters(Context.DebugConfig.SkillPreviewShoulderOffsetCm))
    ).add(new Vector3(0, this.ToMeters(Context.DebugConfig.SkillPreviewSocketUpCm), 0));
    const Position = SocketPos.add(
      Context.Forward.scale(-this.ToMeters(Context.DebugConfig.SkillPreviewDistanceCm))
    );
    const Target = SocketPos.add(
      Context.Forward.scale(this.ToMeters(Context.DebugConfig.SkillPreviewLookForwardDistanceCm))
    ).add(FocusOffset);
    return {
      Target,
      Position,
      FovDeg: Context.DebugConfig.SkillPreviewFovDeg
    };
  }

  private ApplyPlayerItemPreviewCamera(Context: FBattleCameraContext): FBattleCameraPose {
    const FocusOffset = Context.Right.scale(
      this.ToMeters(Context.DebugConfig.ItemPreviewFocusOffsetRightCm)
    ).add(new Vector3(0, this.ToMeters(Context.DebugConfig.ItemPreviewFocusOffsetUpCm), 0));
    const SocketPos = Context.ControlledPos.add(
      Context.Right.scale(this.ToMeters(Context.DebugConfig.ItemPreviewLateralOffsetCm))
    ).add(new Vector3(0, this.ToMeters(Context.DebugConfig.ItemPreviewSocketUpCm), 0));
    const Position = SocketPos.add(
      Context.Forward.scale(this.ToMeters(Context.DebugConfig.ItemPreviewDistanceCm))
    );
    const Target = Context.ControlledPos.add(
      new Vector3(0, this.ToMeters(Context.DebugConfig.ItemPreviewLookAtHeightCm), 0)
    ).add(FocusOffset);
    return {
      Target,
      Position,
      FovDeg: Context.DebugConfig.ItemPreviewFovDeg
    };
  }

  private ApplySkillTargetZoomCamera(Context: FBattleCameraContext): FBattleCameraPose {
    const Target = Context.SelectedPos.add(
      new Vector3(0, this.ToMeters(Context.DebugConfig.TargetSelectLookAtHeightCm), 0)
    );
    const BasisForward = this.ResolveTargetSelectBasisForward(Context);
    const BasisRight = new Vector3(BasisForward.z, 0, -BasisForward.x);
    const ForwardDistance = this.ToMeters(Context.DebugConfig.TargetSelectCloseupDistanceCm);
    const LateralOffset = this.ToMeters(Context.DebugConfig.TargetSelectLateralOffsetCm);
    const BaseVerticalOffset = this.ToMeters(
      Context.DebugConfig.TargetSelectCloseupHeightCm -
        Context.DebugConfig.TargetSelectLookAtHeightCm
    );
    const MaxYawRad = (35 * Math.PI) / 180;
    const ClampedLateralOffset = this.Clamp(
      LateralOffset,
      -Math.abs(ForwardDistance) * Math.tan(MaxYawRad),
      Math.abs(ForwardDistance) * Math.tan(MaxYawRad)
    );
    const PlanarDistance = Math.max(
      Math.sqrt(ForwardDistance * ForwardDistance + ClampedLateralOffset * ClampedLateralOffset),
      0.01
    );
    const MinPitchRad = (-8 * Math.PI) / 180;
    const MaxPitchRad = (25 * Math.PI) / 180;
    const ClampedVerticalOffset = this.Clamp(
      BaseVerticalOffset,
      Math.tan(MinPitchRad) * PlanarDistance,
      Math.tan(MaxPitchRad) * PlanarDistance
    );
    const Position = Target.add(BasisForward.scale(ForwardDistance))
      .add(BasisRight.scale(ClampedLateralOffset))
      .add(new Vector3(0, ClampedVerticalOffset, 0));
    return {
      Target,
      Position,
      FovDeg: Context.DebugConfig.TargetSelectFovDeg
    };
  }

  private ResolveTargetSelectBasisForward(Context: FBattleCameraContext): Vector3 {
    return ResolveTargetSelectBasisForwardFromPositions(
      Context.SelectedPos,
      Context.ControlledPos,
      Context.BattleCenter,
      Context.DebugConfig.TargetSelectYawDeg
    );
  }

  private ApplyEnemyAttackCamera(Context: FBattleCameraContext): FBattleCameraPose {
    const ScriptFocus = Context.ViewModel.Battle3CState.ScriptFocus;
    if (!ScriptFocus) {
      return this.ApplyPlayerFollowCamera(Context);
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
    return {
      Target,
      Position: CameraPos,
      FovDeg: Context.DebugConfig.BattleIntroFovDeg
    };
  }

  private ApplySettlementCamera(Context: FBattleCameraContext): FBattleCameraPose {
    const Position = Context.BattleCenter.add(
      new Vector3(
        -this.ToMeters(Context.DebugConfig.SettlementCamDistanceCm),
        this.ToMeters(Context.DebugConfig.SettlementCamHeightCm),
        -this.ToMeters(Context.DebugConfig.SettlementCamDistanceCm * 0.1)
      )
    );
    return {
      Target: Context.BattleCenter.add(new Vector3(0, 0.75, 0)),
      Position,
      FovDeg: 46
    };
  }

  private ResolvePlayerFollowCameraPose(Context: FBattleCameraContext): FBattleFollowCameraPose {
    const Focus = Context.ControlledPos.add(new Vector3(0, 0.8, 0))
      .add(Context.Right.scale(this.ToMeters(Context.DebugConfig.BattleFollowFocusOffsetRightCm)))
      .add(new Vector3(0, this.ToMeters(Context.DebugConfig.BattleFollowFocusOffsetUpCm), 0));
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

  private ResolveBattleCameraPoseWithBlend(
    ViewModel: FHudViewModel,
    CameraMode: FBattleCameraMode,
    DesiredPose: FBattleCameraPose
  ): FBattleCameraPose {
    const PreviousMode = this.LastBattleCameraMode;
    const PreviousControlledUnitId = this.LastBattleControlledUnitId;
    const PreviousSelectedTargetId = this.LastBattleSelectedTargetId;
    const CurrentControlledUnitId = ViewModel.Battle3CState.ControlledCharacterId;
    const CurrentSelectedTargetId = ViewModel.Battle3CState.SelectedTargetId;
    const IsModeChanged = PreviousMode !== CameraMode;
    const IsControlledUnitSwitched = this.IsBattleControlledUnitSwitched(
      IsModeChanged,
      CameraMode,
      PreviousControlledUnitId,
      CurrentControlledUnitId
    );
    const IsTargetSwitchedInTargetZoom = this.IsTargetSwitchedInTargetZoom(
      IsModeChanged,
      CameraMode,
      PreviousSelectedTargetId,
      CurrentSelectedTargetId
    );

    if (IsModeChanged || IsControlledUnitSwitched || IsTargetSwitchedInTargetZoom) {
      const BlendDecision = this.ResolveBattleCameraBlendDecision({
        IsModeChanged,
        IsControlledUnitSwitched,
        IsTargetSwitchedInTargetZoom,
        PreviousMode,
        CameraMode
      });
      this.BattleCameraBlendState = BlendDecision.ShouldBlend
        ? {
            StartElapsedSec: this.ElapsedSeconds,
            DurationSec: BlendDecision.BlendDurationSec,
            FromTarget: this.Camera.getTarget().clone(),
            FromPosition: this.Camera.position.clone(),
            FromFovDeg: (this.Camera.fov * 180) / Math.PI
          }
        : null;
    }
    this.LastBattleCameraMode = CameraMode;
    this.LastBattleControlledUnitId = CurrentControlledUnitId;
    this.LastBattleSelectedTargetId = CurrentSelectedTargetId;

    const BlendState = this.BattleCameraBlendState;
    if (!BlendState) {
      return DesiredPose;
    }

    const RawProgress = (this.ElapsedSeconds - BlendState.StartElapsedSec) / BlendState.DurationSec;
    const Progress = Math.min(Math.max(RawProgress, 0), 1);
    const SmoothProgress = Progress * Progress * (3 - 2 * Progress);
    const BlendedPose: FBattleCameraPose = {
      Target: Vector3.Lerp(BlendState.FromTarget, DesiredPose.Target, SmoothProgress),
      Position: Vector3.Lerp(BlendState.FromPosition, DesiredPose.Position, SmoothProgress),
      FovDeg: BlendState.FromFovDeg + (DesiredPose.FovDeg - BlendState.FromFovDeg) * SmoothProgress
    };
    if (Progress >= 1) {
      this.BattleCameraBlendState = null;
    }
    return BlendedPose;
  }

  private IsBattleControlledUnitSwitched(
    IsModeChanged: boolean,
    CameraMode: FBattleCameraMode,
    PreviousControlledUnitId: string | null,
    CurrentControlledUnitId: string | null
  ): boolean {
    return (
      !IsModeChanged &&
      CameraMode === "PlayerFollow" &&
      PreviousControlledUnitId !== null &&
      CurrentControlledUnitId !== null &&
      PreviousControlledUnitId !== CurrentControlledUnitId
    );
  }

  private IsTargetSwitchedInTargetZoom(
    IsModeChanged: boolean,
    CameraMode: FBattleCameraMode,
    PreviousSelectedTargetId: string | null,
    CurrentSelectedTargetId: string | null
  ): boolean {
    return ShouldBlendOnBattleTargetSwitch({
      IsModeChanged,
      CameraMode,
      PreviousSelectedTargetId,
      CurrentSelectedTargetId
    });
  }

  private ResolveBattleCameraBlendDecision(Options: {
    IsModeChanged: boolean;
    IsControlledUnitSwitched: boolean;
    IsTargetSwitchedInTargetZoom: boolean;
    PreviousMode: FBattleCameraMode | null;
    CameraMode: FBattleCameraMode;
  }): { ShouldBlend: boolean; BlendDurationSec: number } {
    if (Options.IsControlledUnitSwitched) {
      return {
        ShouldBlend: true,
        BlendDurationSec: USceneBridge.ControlledUnitSwitchBlendDurationSec
      };
    }
    if (Options.IsTargetSwitchedInTargetZoom) {
      return {
        ShouldBlend: true,
        BlendDurationSec: USceneBridge.AimCameraBlendDurationSec
      };
    }
    if (Options.IsModeChanged) {
      return {
        ShouldBlend: this.ShouldBlendBattleCameraMode(Options.PreviousMode, Options.CameraMode),
        BlendDurationSec: USceneBridge.AimCameraBlendDurationSec
      };
    }
    return {
      ShouldBlend: false,
      BlendDurationSec: USceneBridge.AimCameraBlendDurationSec
    };
  }

  private ShouldBlendBattleCameraMode(
    PreviousMode: FBattleCameraMode | null,
    NextMode: FBattleCameraMode
  ): boolean {
    if (PreviousMode === null) {
      return false;
    }

    const BlendModes = new Set<FBattleCameraMode>([
      "PlayerFollow",
      "PlayerAim",
      "PlayerSkillPreview",
      "PlayerItemPreview",
      "SkillTargetZoom"
    ]);
    return BlendModes.has(PreviousMode) && BlendModes.has(NextMode) && PreviousMode !== NextMode;
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
    this.LastBattleCameraMode = null;
    this.LastBattleControlledUnitId = null;
    this.LastBattleSelectedTargetId = null;
    this.BattleCameraBlendState = null;
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
      const ExistingMesh = this.BattleUnitMeshMap.get(Unit.UnitId);
      const Mesh = ExistingMesh ?? this.CreateBattleUnitMesh(Unit);
      const HasExistingMesh = ExistingMesh !== undefined;
      const ShouldHideInAimMode = this.ShouldHideBattleUnitInAimMode(ViewModel, Unit);
      Mesh.position = this.ResolveBattleUnitPositionMeters(Unit, DropOffsetCm);
      const TargetYawRadians = (Unit.YawDeg * Math.PI) / 180;
      const NextYawRadians = HasExistingMesh
        ? this.ResolveSmoothedYawRadians(Mesh.rotation.y, TargetYawRadians)
        : TargetYawRadians;
      Mesh.rotation = new Vector3(0, NextYawRadians, 0);
      const IsPlayer = Unit.TeamId === "Player";
      const IsModelReady =
        IsPlayer && !ShouldHideInAimMode
          ? this.SyncBattlePlayerModel(Unit, ViewModel, DropOffsetCm)
          : false;
      if (ShouldHideInAimMode) {
        this.CharacterModelVisualMap.get(Unit.UnitId)?.RootNode.setEnabled(false);
        this.SetMuzzleGizmoVisible(Unit.UnitId, false);
      }
      const ShouldShowFallback =
        !ShouldHideInAimMode &&
        (!IsPlayer ||
          (!IsModelReady && ViewModel.DebugState.Config.FallbackToPlaceholderOnLoadFail));
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

  private ShouldHideBattleUnitInAimMode(
    ViewModel: FHudViewModel,
    Unit: FBattleUnitHudState
  ): boolean {
    return (
      ViewModel.RuntimePhase === "Battle3C" &&
      ViewModel.Battle3CState.IsAimMode &&
      Unit.TeamId === "Player" &&
      !Unit.IsControlled
    );
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
    const TargetYawRadians =
      (YawDeg * Math.PI) / 180 + this.ResolveAxisFixYawRadians(AxisFixPreset);
    const IsFirstEnable = !Visual.RootNode.isEnabled();
    let NextYawRadians = TargetYawRadians;
    if (!IsFirstEnable) {
      NextYawRadians = this.ResolveSmoothedYawRadians(Visual.RootNode.rotation.y, TargetYawRadians);
    }
    Visual.RootNode.rotation = new Vector3(0, NextYawRadians, 0);
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

  private ResolveSmoothedYawRadians(CurrentYawRadians: number, TargetYawRadians: number): number {
    const Alpha = this.ResolveFrameBlendAlpha(USceneBridge.UnitYawBlendSpeed);
    if (Alpha >= 1) {
      return TargetYawRadians;
    }
    const Delta = this.NormalizeRadians(TargetYawRadians - CurrentYawRadians);
    return CurrentYawRadians + Delta * Alpha;
  }

  private ResolveFrameBlendAlpha(BlendSpeed: number): number {
    if (BlendSpeed <= 0) {
      return 1;
    }
    return 1 - Math.exp(-BlendSpeed * this.CurrentFrameDeltaSeconds);
  }

  private NormalizeRadians(AngleRadians: number): number {
    const Tau = Math.PI * 2;
    let Normalized = (AngleRadians + Math.PI) % Tau;
    if (Normalized < 0) {
      Normalized += Tau;
    }
    return Normalized - Math.PI;
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

  private ConsumeBattleShotEvent(ViewModel: FHudViewModel): void {
    if (ViewModel.RuntimePhase !== "Battle3C") {
      this.LastConsumedShotId = 0;
      if (this.ShotProjectileVisuals.length > 0 || this.HitImpactVisuals.length > 0) {
        this.ClearTransientBattleVisuals();
      }
      return;
    }

    const Shot = ViewModel.Battle3CState.LastShot;
    if (!Shot || Shot.ShotId <= this.LastConsumedShotId) {
      return;
    }

    this.LastConsumedShotId = Shot.ShotId;
    const Trajectory = this.ResolveShotTrajectory(
      ViewModel,
      Shot.AttackerUnitId,
      Shot.TargetUnitId,
      Shot.DamageAmount
    );
    if (!Trajectory) {
      return;
    }

    const { StartPosition, EndPosition, ShouldSpawnImpact } = Trajectory;
    const Distance = Math.max(Vector3.Distance(StartPosition, EndPosition), 0.15);
    const DurationSec = this.Clamp(Distance / 30, 0.08, 0.22);
    const ShotMesh = MeshBuilder.CreateSphere(
      `ShotProjectile_${Shot.ShotId}`,
      { diameter: 0.08 },
      this.Scene
    );
    const ShotMaterial = new StandardMaterial(`ShotProjectileMat_${Shot.ShotId}`, this.Scene);
    ShotMaterial.diffuseColor = new Color3(1, 0.85, 0.3);
    ShotMaterial.emissiveColor = new Color3(1, 0.62, 0.18);
    ShotMaterial.disableLighting = true;
    ShotMesh.material = ShotMaterial;
    ShotMesh.isPickable = false;
    ShotMesh.position.copyFrom(StartPosition);

    this.ShotProjectileVisuals.push({
      Mesh: ShotMesh,
      Material: ShotMaterial,
      StartPosition,
      EndPosition,
      ShouldSpawnImpact,
      ElapsedSec: 0,
      DurationSec
    });
  }

  private ResolveShotTrajectory(
    ViewModel: FHudViewModel,
    AttackerUnitId: string,
    PreferredTargetUnitId: string | null,
    DamageAmount: number
  ): {
    StartPosition: Vector3;
    EndPosition: Vector3;
    ShouldSpawnImpact: boolean;
  } | null {
    const StartPosition = this.ResolveShotSpawnPosition(ViewModel, AttackerUnitId);
    if (!StartPosition) {
      return null;
    }

    if (PreferredTargetUnitId && DamageAmount > 0) {
      const DropOffsetCm = this.ResolveEncounterDropOffsetCm(ViewModel);
      const AimRay = this.ResolveCenterAimRay();
      const ForcedHit = AimRay
        ? this.ResolveAimRayHitAgainstEnemies(
            ViewModel,
            DropOffsetCm,
            AimRay,
            PreferredTargetUnitId
          )
        : null;
      if (ForcedHit && ForcedHit.UnitId === PreferredTargetUnitId) {
        return {
          StartPosition,
          EndPosition: ForcedHit.HitPoint,
          ShouldSpawnImpact: true
        };
      }

      const TargetUnit = this.FindBattleUnit(ViewModel, PreferredTargetUnitId);
      if (TargetUnit && TargetUnit.TeamId === "Enemy") {
        return {
          StartPosition,
          EndPosition: this.ResolveBattleUnitPositionMeters(TargetUnit, DropOffsetCm).add(
            new Vector3(0, 1.05, 0)
          ),
          ShouldSpawnImpact: true
        };
      }
    }

    const AimRay = this.ResolveCenterAimRay();
    if (!AimRay) {
      const FallbackDirection = this.ResolveShotFallbackDirection(ViewModel, AttackerUnitId);
      return {
        StartPosition,
        EndPosition: StartPosition.add(
          FallbackDirection.scale(USceneBridge.ShotMissTraceDistanceMeters)
        ),
        ShouldSpawnImpact: false
      };
    }

    const DropOffsetCm = this.ResolveEncounterDropOffsetCm(ViewModel);
    const Hit = this.ResolveAimRayHitAgainstEnemies(
      ViewModel,
      DropOffsetCm,
      AimRay,
      PreferredTargetUnitId
    );
    if (Hit) {
      return {
        StartPosition,
        EndPosition: Hit.HitPoint,
        ShouldSpawnImpact: true
      };
    }

    return {
      StartPosition,
      EndPosition: StartPosition.add(
        AimRay.Direction.scale(USceneBridge.ShotMissTraceDistanceMeters)
      ),
      ShouldSpawnImpact: false
    };
  }

  private ResolveShotSpawnPosition(
    ViewModel: FHudViewModel,
    AttackerUnitId: string
  ): Vector3 | null {
    const Visual = this.CharacterModelVisualMap.get(AttackerUnitId);
    if (Visual && !Visual.IsLoadFailed) {
      return Visual.MuzzleSocketNode.getAbsolutePosition().clone();
    }

    const AttackerUnit = this.FindBattleUnit(ViewModel, AttackerUnitId);
    if (!AttackerUnit) {
      return null;
    }

    const DropOffsetCm = this.ResolveEncounterDropOffsetCm(ViewModel);
    return this.ResolveBattleUnitPositionMeters(AttackerUnit, DropOffsetCm).add(
      new Vector3(0, 0.9, 0)
    );
  }

  private ResolveShotFallbackDirection(ViewModel: FHudViewModel, AttackerUnitId: string): Vector3 {
    const Visual = this.CharacterModelVisualMap.get(AttackerUnitId);
    if (Visual && !Visual.IsLoadFailed) {
      const SocketForward = Vector3.TransformNormal(
        new Vector3(1, 0, 0),
        Visual.MuzzleSocketNode.getWorldMatrix()
      );
      if (SocketForward.lengthSquared() > 1e-8) {
        return SocketForward.normalize();
      }
    }

    const AttackerUnit = this.FindBattleUnit(ViewModel, AttackerUnitId);
    if (AttackerUnit) {
      const YawRadians = (AttackerUnit.YawDeg * Math.PI) / 180;
      return new Vector3(Math.sin(YawRadians), 0, Math.cos(YawRadians));
    }

    return new Vector3(1, 0, 0);
  }

  private ResolveCenterAimRay(): FShotRay | null {
    const Direction = this.Camera.getTarget().subtract(this.Camera.position);
    if (Direction.lengthSquared() <= 1e-8) {
      return null;
    }

    return {
      Origin: this.Camera.position.clone(),
      Direction: Direction.normalize()
    };
  }

  private ResolveAimRayHitAgainstEnemies(
    ViewModel: FHudViewModel,
    DropOffsetCm: number,
    AimRay: FShotRay,
    PreferredTargetUnitId: string | null
  ): FShotRayHit | null {
    const EnemyUnits = ViewModel.Battle3CState.Units.filter(
      (Unit) => Unit.TeamId === "Enemy" && Unit.IsAlive
    );
    if (EnemyUnits.length < 1) {
      return null;
    }

    if (PreferredTargetUnitId) {
      const PreferredUnit = EnemyUnits.find((Unit) => Unit.UnitId === PreferredTargetUnitId);
      if (PreferredUnit) {
        const PreferredHit = this.ResolveAimRayHitAgainstUnit(PreferredUnit, DropOffsetCm, AimRay);
        if (PreferredHit) {
          return PreferredHit;
        }
      }
    }

    let BestHit: FShotRayHit | null = null;
    EnemyUnits.forEach((EnemyUnit) => {
      const CandidateHit = this.ResolveAimRayHitAgainstUnit(EnemyUnit, DropOffsetCm, AimRay);
      if (!CandidateHit) {
        return;
      }
      if (!BestHit || CandidateHit.DistanceMeters < BestHit.DistanceMeters) {
        BestHit = CandidateHit;
      }
    });
    return BestHit;
  }

  private ResolveAimRayHitAgainstUnit(
    Unit: FBattleUnitHudState,
    DropOffsetCm: number,
    AimRay: FShotRay
  ): FShotRayHit | null {
    const MeshHitDistanceMeters = this.ResolveAimRayMeshHitDistanceMeters(Unit.UnitId, AimRay);
    if (MeshHitDistanceMeters !== null) {
      return {
        UnitId: Unit.UnitId,
        DistanceMeters: MeshHitDistanceMeters,
        HitPoint: AimRay.Origin.add(AimRay.Direction.scale(MeshHitDistanceMeters))
      };
    }

    const UnitCenter = this.ResolveBattleUnitPositionMeters(Unit, DropOffsetCm).add(
      new Vector3(0, 0.95, 0)
    );
    const HitDistanceMeters = this.ResolveRaySphereHitDistanceMeters(
      AimRay.Origin,
      AimRay.Direction,
      UnitCenter,
      USceneBridge.ShotRaycastEnemyRadiusMeters
    );
    if (HitDistanceMeters === null) {
      return null;
    }

    return {
      UnitId: Unit.UnitId,
      DistanceMeters: HitDistanceMeters,
      HitPoint: AimRay.Origin.add(AimRay.Direction.scale(HitDistanceMeters))
    };
  }

  private ResolveAimRayMeshHitDistanceMeters(UnitId: string, AimRay: FShotRay): number | null {
    const UnitMesh = this.BattleUnitMeshMap.get(UnitId);
    if (!UnitMesh || !UnitMesh.isEnabled()) {
      return null;
    }

    const Raycast = new Ray(
      AimRay.Origin.clone(),
      AimRay.Direction.clone(),
      USceneBridge.ShotMissTraceDistanceMeters
    );
    const PickResult = this.Scene.pickWithRay(
      Raycast,
      (MeshCandidate) => MeshCandidate === UnitMesh,
      false
    );
    if (!PickResult || !PickResult.hit || PickResult.distance === undefined) {
      return null;
    }
    return PickResult.distance;
  }

  private ResolveRaySphereHitDistanceMeters(
    RayOrigin: Vector3,
    RayDirection: Vector3,
    SphereCenter: Vector3,
    SphereRadiusMeters: number
  ): number | null {
    const OriginToCenter = RayOrigin.subtract(SphereCenter);
    const HalfB = Vector3.Dot(OriginToCenter, RayDirection);
    const C = Vector3.Dot(OriginToCenter, OriginToCenter) - SphereRadiusMeters * SphereRadiusMeters;
    const Discriminant = HalfB * HalfB - C;
    if (Discriminant < 0) {
      return null;
    }

    const SqrtDiscriminant = Math.sqrt(Discriminant);
    const NearHit = -HalfB - SqrtDiscriminant;
    const FarHit = -HalfB + SqrtDiscriminant;
    if (NearHit >= 0) {
      return NearHit;
    }
    if (FarHit >= 0) {
      return FarHit;
    }
    return null;
  }

  private UpdateTransientBattleVisuals(DeltaSeconds: number): void {
    this.UpdateShotProjectileVisuals(DeltaSeconds);
    this.UpdateHitImpactVisuals(DeltaSeconds);
    this.UpdateHitSparkVisuals(DeltaSeconds);
  }

  private UpdateShotProjectileVisuals(DeltaSeconds: number): void {
    for (let Index = this.ShotProjectileVisuals.length - 1; Index >= 0; Index -= 1) {
      const Projectile = this.ShotProjectileVisuals[Index];
      Projectile.ElapsedSec += DeltaSeconds;
      const Alpha = this.Clamp(Projectile.ElapsedSec / Projectile.DurationSec, 0, 1);
      Projectile.Mesh.position = Vector3.Lerp(
        Projectile.StartPosition,
        Projectile.EndPosition,
        Alpha
      );

      if (Alpha < 1) {
        continue;
      }

      if (Projectile.ShouldSpawnImpact) {
        this.CreateHitImpactVisual(Projectile.EndPosition);
      }
      Projectile.Mesh.dispose();
      Projectile.Material.dispose();
      this.ShotProjectileVisuals.splice(Index, 1);
    }
  }

  private CreateHitImpactVisual(Position: Vector3): void {
    const CoreMesh = MeshBuilder.CreateSphere(
      `HitImpact_${Date.now()}_${this.HitImpactVisuals.length}`,
      { diameter: 0.44 },
      this.Scene
    );
    const CoreMaterial = new StandardMaterial(
      `HitImpactMat_${Date.now()}_${this.HitImpactVisuals.length}`,
      this.Scene
    );
    CoreMaterial.diffuseColor = new Color3(1, 0.82, 0.5);
    CoreMaterial.emissiveColor = new Color3(1, 0.95, 0.62);
    CoreMaterial.alpha = 1;
    CoreMaterial.disableLighting = true;
    CoreMesh.material = CoreMaterial;
    CoreMesh.isPickable = false;
    CoreMesh.position.copyFrom(Position);
    CoreMesh.scaling = new Vector3(0.75, 0.75, 0.75);

    const RingMesh = MeshBuilder.CreateTorus(
      `HitImpactRing_${Date.now()}_${this.HitImpactVisuals.length}`,
      { diameter: 0.46, thickness: 0.08, tessellation: 28 },
      this.Scene
    );
    const RingMaterial = new StandardMaterial(
      `HitImpactRingMat_${Date.now()}_${this.HitImpactVisuals.length}`,
      this.Scene
    );
    RingMaterial.diffuseColor = new Color3(1, 0.65, 0.24);
    RingMaterial.emissiveColor = new Color3(1, 0.78, 0.32);
    RingMaterial.alpha = 0.95;
    RingMaterial.disableLighting = true;
    RingMesh.material = RingMaterial;
    RingMesh.isPickable = false;
    RingMesh.position.copyFrom(Position);
    RingMesh.rotation.x = Math.PI / 2;
    RingMesh.scaling = new Vector3(0.55, 0.55, 0.55);

    this.SpawnHitSparkVisuals(Position);
    this.HitImpactVisuals.push({
      CoreMesh,
      CoreMaterial,
      RingMesh,
      RingMaterial,
      ElapsedSec: 0,
      DurationSec: 0.3
    });
  }

  private UpdateHitImpactVisuals(DeltaSeconds: number): void {
    for (let Index = this.HitImpactVisuals.length - 1; Index >= 0; Index -= 1) {
      const Impact = this.HitImpactVisuals[Index];
      Impact.ElapsedSec += DeltaSeconds;
      const Alpha = this.Clamp(Impact.ElapsedSec / Impact.DurationSec, 0, 1);
      const CoreScale = this.Lerp(0.95, 2.9, Alpha);
      const RingScale = this.Lerp(0.55, 3.4, Alpha);
      Impact.CoreMesh.scaling = new Vector3(CoreScale, CoreScale, CoreScale);
      Impact.RingMesh.scaling = new Vector3(RingScale, RingScale, RingScale);
      Impact.CoreMaterial.alpha = this.Lerp(0.98, 0, Alpha);
      Impact.RingMaterial.alpha = this.Lerp(0.95, 0, Alpha);

      if (Alpha < 1) {
        continue;
      }

      Impact.CoreMesh.dispose();
      Impact.CoreMaterial.dispose();
      Impact.RingMesh.dispose();
      Impact.RingMaterial.dispose();
      this.HitImpactVisuals.splice(Index, 1);
    }
  }

  private SpawnHitSparkVisuals(Position: Vector3): void {
    for (let Index = 0; Index < USceneBridge.HitSparkCount; Index += 1) {
      const SparkMesh = MeshBuilder.CreateSphere(
        `HitSpark_${Date.now()}_${this.HitSparkVisuals.length}_${Index}`,
        { diameter: 0.08 },
        this.Scene
      );
      const SparkMaterial = new StandardMaterial(
        `HitSparkMat_${Date.now()}_${this.HitSparkVisuals.length}_${Index}`,
        this.Scene
      );
      SparkMaterial.diffuseColor = new Color3(1, 0.82, 0.46);
      SparkMaterial.emissiveColor = new Color3(1, 0.85, 0.3);
      SparkMaterial.alpha = 0.98;
      SparkMaterial.disableLighting = true;
      SparkMesh.material = SparkMaterial;
      SparkMesh.isPickable = false;
      SparkMesh.position.copyFrom(Position);

      const RandomDirection = new Vector3(
        Math.random() * 2 - 1,
        Math.random() * 0.9 + 0.1,
        Math.random() * 2 - 1
      );
      const Direction =
        RandomDirection.lengthSquared() > 1e-6 ? RandomDirection.normalize() : new Vector3(0, 1, 0);
      const Speed = this.Lerp(3.2, 6.8, Math.random());

      this.HitSparkVisuals.push({
        Mesh: SparkMesh,
        Material: SparkMaterial,
        Velocity: Direction.scale(Speed),
        ElapsedSec: 0,
        DurationSec: this.Lerp(0.24, 0.4, Math.random())
      });
    }
  }

  private UpdateHitSparkVisuals(DeltaSeconds: number): void {
    for (let Index = this.HitSparkVisuals.length - 1; Index >= 0; Index -= 1) {
      const Spark = this.HitSparkVisuals[Index];
      Spark.ElapsedSec += DeltaSeconds;
      Spark.Mesh.position.addInPlace(Spark.Velocity.scale(DeltaSeconds));
      Spark.Velocity.y -= 7.2 * DeltaSeconds;
      const Alpha = this.Clamp(Spark.ElapsedSec / Spark.DurationSec, 0, 1);
      const Scale = this.Lerp(1, 0.35, Alpha);
      Spark.Mesh.scaling = new Vector3(Scale, Scale, Scale);
      Spark.Material.alpha = this.Lerp(0.98, 0, Alpha);

      if (Alpha < 1) {
        continue;
      }

      Spark.Mesh.dispose();
      Spark.Material.dispose();
      this.HitSparkVisuals.splice(Index, 1);
    }
  }

  private ClearTransientBattleVisuals(): void {
    this.ShotProjectileVisuals.forEach((Projectile) => {
      Projectile.Mesh.dispose();
      Projectile.Material.dispose();
    });
    this.ShotProjectileVisuals.length = 0;

    this.HitImpactVisuals.forEach((Impact) => {
      Impact.CoreMesh.dispose();
      Impact.CoreMaterial.dispose();
      Impact.RingMesh.dispose();
      Impact.RingMaterial.dispose();
    });
    this.HitImpactVisuals.length = 0;

    this.HitSparkVisuals.forEach((Spark) => {
      Spark.Mesh.dispose();
      Spark.Material.dispose();
    });
    this.HitSparkVisuals.length = 0;
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

  private ResolveForwardVectorFromYawPitchDeg(YawDeg: number, PitchDeg: number): Vector3 {
    const YawRadians = (YawDeg * Math.PI) / 180;
    const PitchRadians = (PitchDeg * Math.PI) / 180;
    const CosPitch = Math.cos(PitchRadians);
    return new Vector3(
      Math.sin(YawRadians) * CosPitch,
      Math.sin(PitchRadians),
      Math.cos(YawRadians) * CosPitch
    );
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

  private SyncAimHoverTarget(ViewModel: FHudViewModel): void {
    if (!this.OnAimHoverTargetUpdated) {
      return;
    }

    this.EmitAimHoverTargetIfChanged(this.ResolveAimHoverTargetState(ViewModel));
  }

  private ResolveAimHoverTargetState(ViewModel: FHudViewModel): FAimHoverTargetScreenState | null {
    if (ViewModel.RuntimePhase !== "Battle3C") {
      return null;
    }

    if (!ViewModel.Battle3CState.IsAimMode) {
      return this.ResolveSelectedTargetScreenState(ViewModel);
    }

    const AimRay = this.ResolveCenterAimRay();
    if (!AimRay) {
      return null;
    }

    const DropOffsetCm = this.ResolveEncounterDropOffsetCm(ViewModel);
    const Hit = this.ResolveAimRayHitAgainstEnemies(
      ViewModel,
      DropOffsetCm,
      AimRay,
      ViewModel.Battle3CState.HoveredTargetId
    );
    if (!Hit) {
      return null;
    }
    const HitUnit = this.FindBattleUnit(ViewModel, Hit.UnitId);
    if (!HitUnit || HitUnit.TeamId !== "Enemy" || !HitUnit.IsAlive) {
      return null;
    }

    const Anchor = this.ProjectWorldToScreenAnchor(
      this.ResolveBattleUnitPositionMeters(HitUnit, DropOffsetCm).add(new Vector3(0, 1, 0))
    );
    if (!Anchor) {
      return null;
    }

    return {
      UnitId: HitUnit.UnitId,
      Anchor: { ...Anchor }
    };
  }

  private ResolveSelectedTargetScreenState(
    ViewModel: FHudViewModel
  ): FAimHoverTargetScreenState | null {
    const Stage = ViewModel.Battle3CState.CommandStage;
    if (Stage !== "TargetSelect" && Stage !== "ActionResolve") {
      return null;
    }

    const SelectedTargetId = ViewModel.Battle3CState.SelectedTargetId;
    if (!SelectedTargetId) {
      return null;
    }

    const SelectedTargetUnit = this.FindBattleUnit(ViewModel, SelectedTargetId);
    if (
      !SelectedTargetUnit ||
      SelectedTargetUnit.TeamId !== "Enemy" ||
      !SelectedTargetUnit.IsAlive
    ) {
      return null;
    }

    const DropOffsetCm = this.ResolveEncounterDropOffsetCm(ViewModel);
    const HeadWorldPos = this.ResolveBattleUnitPositionMeters(SelectedTargetUnit, DropOffsetCm).add(
      new Vector3(0, 1, 0)
    );
    const Anchor = this.ProjectWorldToScreenAnchor(HeadWorldPos);
    if (!Anchor) {
      return null;
    }

    return {
      UnitId: SelectedTargetUnit.UnitId,
      Anchor: { ...Anchor }
    };
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

  private EmitAimHoverTargetIfChanged(State: FAimHoverTargetScreenState | null): void {
    if (this.AreAimHoverTargetStatesEqual(this.LastAimHoverTargetState, State)) {
      return;
    }

    this.LastAimHoverTargetState = State
      ? {
          UnitId: State.UnitId,
          Anchor: { ...State.Anchor }
        }
      : null;
    this.OnAimHoverTargetUpdated?.(
      State
        ? {
            UnitId: State.UnitId,
            Anchor: { ...State.Anchor }
          }
        : null
    );
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

  private AreAimHoverTargetStatesEqual(
    Left: FAimHoverTargetScreenState | null,
    Right: FAimHoverTargetScreenState | null
  ): boolean {
    if (!Left && !Right) {
      return true;
    }
    if (!Left || !Right) {
      return false;
    }
    return Left.UnitId === Right.UnitId && this.AreAnchorsEqual(Left.Anchor, Right.Anchor);
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
