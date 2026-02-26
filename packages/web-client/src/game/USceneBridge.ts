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

import type { FHudViewModel } from "../ui/FHudViewModel";

interface FSkyCloudActor {
  Root: TransformNode;
  BaseX: number;
  Speed: number;
  DriftRange: number;
  Phase: number;
}

export class USceneBridge {
  private static readonly CentimetersToMeters = 0.01;
  private static readonly OverworldGroundColorHex = "#333a41";
  private static readonly OverworldPlayerColorHex = "#dba511";
  private static readonly OverworldGridColorHex = "#50565e";
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
  private readonly PlayerMesh: Mesh;
  private readonly PlayerForwardArrowMesh: Mesh;
  private readonly SkyCloudMaterial: StandardMaterial;
  private readonly SkyCloudActors: FSkyCloudActor[];
  private LastFrameTimestamp: number;
  private ElapsedSeconds: number;

  public constructor(Canvas: HTMLCanvasElement) {
    this.Engine = new Engine(Canvas, true);
    this.Scene = new Scene(this.Engine);
    this.Scene.clearColor = new Color4(0.47, 0.71, 0.94, 1);
    this.OverworldEnemyMeshMap = new Map();
    this.BattleUnitMeshMap = new Map();

    this.Camera = this.CreateCamera();
    this.OverworldGround = this.CreateOverworldGround();
    this.OverworldGrid = this.CreateOverworldGrid(30, 1);
    this.BattleGround = this.CreateBattleGround();
    this.PlayerMesh = this.CreatePlayerMesh();
    this.PlayerForwardArrowMesh = this.CreatePlayerForwardArrowMesh();
    this.CreateLight();
    this.SkyCloudMaterial = this.CreateSkyCloudMaterial();
    this.SkyCloudActors = this.CreateSkyCloudActors();
    this.LastFrameTimestamp = performance.now();
    this.ElapsedSeconds = 0;
    this.BattleGround.setEnabled(false);
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
      this.Scene.render();
    });

    window.addEventListener("resize", this.HandleWindowResize);
    this.ResizeEngine();
  }

  public ApplyViewModel(ViewModel: FHudViewModel): void {
    this.ApplyCamera(ViewModel);
    if (ViewModel.RuntimePhase === "Overworld") {
      this.ApplyOverworldView(ViewModel);
      return;
    }

    this.ApplyBattleView(ViewModel);
  }

  public Dispose(): void {
    window.removeEventListener("resize", this.HandleWindowResize);
    this.CanvasResizeObserver?.disconnect();
    this.Scene.dispose();
    this.Engine.dispose();
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
    Camera.upperRadiusLimit = 50;
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

  private CreateOverworldGrid(WorldHalfSize: number, CellSize: number): Mesh {
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
      "OverworldGrid",
      {
        lines: Lines,
        updatable: false
      },
      this.Scene
    );
    Grid.color = Color3.FromHexString(USceneBridge.OverworldGridColorHex);
    Grid.isPickable = false;
    return Grid;
  }

  private CreateBattleGround(): Mesh {
    const Ground = MeshBuilder.CreateGround(
      "BattleGround",
      {
        width: 14,
        height: 8
      },
      this.Scene
    );
    const GroundMaterial = new StandardMaterial("BattleGroundMat", this.Scene);
    GroundMaterial.diffuseColor = new Color3(0.08, 0.1, 0.13);
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
    this.Camera.fov = (ViewModel.DebugState.Config.CameraFov * Math.PI) / 180;
    if (ViewModel.RuntimePhase === "Overworld") {
      const Player = ViewModel.OverworldState.PlayerPosition;
      const PlayerYawRadians = (ViewModel.OverworldState.PlayerYawDegrees * Math.PI) / 180;
      const RightX = Math.cos(PlayerYawRadians);
      const RightZ = -Math.sin(PlayerYawRadians);
      const TargetX = Player.X + RightX * ViewModel.DebugState.Config.CameraOffsetRight;
      const TargetY = 85 + ViewModel.DebugState.Config.CameraOffsetUp;
      const TargetZ = Player.Z + RightZ * ViewModel.DebugState.Config.CameraOffsetRight;
      this.Camera.target = new Vector3(
        this.ToMeters(TargetX),
        this.ToMeters(TargetY),
        this.ToMeters(TargetZ)
      );
      // ArcRotate 的平面坐标是 x=cos(alpha), z=sin(alpha)，此处显式映射到“角色后方”
      this.Camera.alpha = -PlayerYawRadians - Math.PI / 2;
      this.Camera.beta = this.ToArcCameraBeta(ViewModel.DebugState.Config.CameraPitch);
      this.Camera.radius = this.ToMeters(ViewModel.DebugState.Config.CameraDistance);
      return;
    }

    this.Camera.target = Vector3.Zero();
    this.Camera.alpha = Math.PI / 2;
    this.Camera.beta = Math.PI / 3;
    this.Camera.radius = 14;
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

  private ApplyBattleView(ViewModel: FHudViewModel): void {
    this.OverworldGround.setEnabled(false);
    this.OverworldGrid.setEnabled(false);
    this.BattleGround.setEnabled(true);
    this.PlayerMesh.setEnabled(false);
    this.PlayerForwardArrowMesh.setEnabled(false);
    this.HideAllOverworldEnemies();
    this.SyncBattleUnits(ViewModel);
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
        Material.diffuseColor = new Color3(0.2, 0.52, 0.91);
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

  private SyncBattleUnits(ViewModel: FHudViewModel): void {
    const ExistingIds = new Set(this.BattleUnitMeshMap.keys());
    const EnemyIndexMap = new Map<string, number>();
    let EnemyCount = 0;

    ViewModel.BattleState.Units.forEach((Unit) => {
      if (Unit.TeamId === "Enemy") {
        EnemyIndexMap.set(Unit.UnitId, EnemyCount);
        EnemyCount += 1;
      }
    });

    ViewModel.BattleState.Units.forEach((Unit) => {
      const Mesh =
        this.BattleUnitMeshMap.get(Unit.UnitId) ?? this.CreateBattleUnitMesh(Unit.UnitId);
      Mesh.setEnabled(true);
      const TeamOffset = Unit.TeamId === "Player" ? -3.5 : 3.5;
      const EnemyIndex = EnemyIndexMap.get(Unit.UnitId) ?? 0;
      const Spread = Math.max(EnemyCount - 1, 1);
      Mesh.position = new Vector3(TeamOffset, 0.8, (EnemyIndex / Spread) * 4 - 2);

      const Material = Mesh.material as StandardMaterial;
      if (!Unit.IsAlive) {
        Material.diffuseColor = new Color3(0.24, 0.24, 0.24);
      } else if (ViewModel.BattleState.SelectedTargetId === Unit.UnitId) {
        Material.diffuseColor = new Color3(0.88, 0.65, 0.12);
      } else if (ViewModel.BattleState.ActiveUnitId === Unit.UnitId) {
        Material.diffuseColor = new Color3(0.15, 0.65, 0.95);
      } else if (Unit.TeamId === "Player") {
        Material.diffuseColor = new Color3(0.2, 0.82, 0.42);
      } else {
        Material.diffuseColor = new Color3(0.84, 0.3, 0.24);
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
    Material.diffuseColor = new Color3(0.2, 0.52, 0.91);
    EnemyMesh.material = Material;
    this.OverworldEnemyMeshMap.set(EnemyId, EnemyMesh);
    return EnemyMesh;
  }

  private CreateBattleUnitMesh(UnitId: string): Mesh {
    const UnitMesh = MeshBuilder.CreateBox(
      `BattleUnit_${UnitId}`,
      {
        size: 1.3
      },
      this.Scene
    );

    const Material = new StandardMaterial(`BattleUnitMat_${UnitId}`, this.Scene);
    Material.diffuseColor = new Color3(0.7, 0.7, 0.7);
    UnitMesh.material = Material;

    this.BattleUnitMeshMap.set(UnitId, UnitMesh);
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

  private ResizeEngine(): void {
    this.Engine.resize();
  }
}
