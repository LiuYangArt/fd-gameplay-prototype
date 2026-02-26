import {
  ArcRotateCamera,
  Color3,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3
} from "@babylonjs/core";

import type { FHudViewModel } from "../ui/FHudViewModel";

export class USceneBridge {
  private static readonly CentimetersToMeters = 0.01;
  private readonly Engine: Engine;
  private readonly Scene: Scene;
  private readonly Camera: ArcRotateCamera;
  private readonly OverworldEnemyMeshMap: Map<string, Mesh>;
  private readonly BattleUnitMeshMap: Map<string, Mesh>;
  private readonly OverworldGround: Mesh;
  private readonly OverworldGrid: Mesh;
  private readonly BattleGround: Mesh;
  private readonly PlayerMesh: Mesh;
  private readonly PlayerForwardArrowMesh: Mesh;

  public constructor(Canvas: HTMLCanvasElement) {
    this.Engine = new Engine(Canvas, true);
    this.Scene = new Scene(this.Engine);
    this.OverworldEnemyMeshMap = new Map();
    this.BattleUnitMeshMap = new Map();

    this.Camera = this.CreateCamera();
    this.OverworldGround = this.CreateOverworldGround();
    this.OverworldGrid = this.CreateOverworldGrid(30, 1);
    this.BattleGround = this.CreateBattleGround();
    this.PlayerMesh = this.CreatePlayerMesh();
    this.PlayerForwardArrowMesh = this.CreatePlayerForwardArrowMesh();
    this.CreateLight();
    this.BattleGround.setEnabled(false);

    this.Engine.runRenderLoop(() => {
      this.Scene.render();
    });

    window.addEventListener("resize", () => {
      this.Engine.resize();
    });
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
    new HemisphericLight("MainLight", new Vector3(0, 1, 0), this.Scene);
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
    GroundMaterial.diffuseColor = new Color3(0.11, 0.17, 0.11);
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
    Grid.color = new Color3(0.26, 0.35, 0.26);
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
    Material.diffuseColor = new Color3(0.93, 0.45, 0.12);
    Capsule.material = Material;
    return Capsule;
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

  private ToMeters(Centimeters: number): number {
    return Centimeters * USceneBridge.CentimetersToMeters;
  }
}
