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
  private readonly Engine: Engine;
  private readonly Scene: Scene;
  private readonly UnitMeshMap: Map<string, Mesh>;

  public constructor(Canvas: HTMLCanvasElement) {
    this.Engine = new Engine(Canvas, true);
    this.Scene = new Scene(this.Engine);
    this.UnitMeshMap = new Map();

    this.BuildScene();
    this.Engine.runRenderLoop(() => {
      this.Scene.render();
    });

    window.addEventListener("resize", () => {
      this.Engine.resize();
    });
  }

  public ApplyViewModel(ViewModel: FHudViewModel): void {
    this.SyncUnitMeshes(ViewModel);
  }

  public Dispose(): void {
    this.Scene.dispose();
    this.Engine.dispose();
  }

  private BuildScene(): void {
    const Camera = new ArcRotateCamera(
      "MainCamera",
      Math.PI / 2,
      Math.PI / 3,
      14,
      new Vector3(0, 0, 0),
      this.Scene
    );
    Camera.attachControl();

    new HemisphericLight("MainLight", new Vector3(0, 1, 0), this.Scene);

    const Ground = MeshBuilder.CreateGround(
      "BattleGround",
      {
        width: 14,
        height: 8
      },
      this.Scene
    );
    const GroundMaterial = new StandardMaterial("GroundMat", this.Scene);
    GroundMaterial.diffuseColor = new Color3(0.08, 0.1, 0.13);
    Ground.material = GroundMaterial;
  }

  private SyncUnitMeshes(ViewModel: FHudViewModel): void {
    const ExistingIds = new Set(this.UnitMeshMap.keys());

    ViewModel.Units.forEach((Unit, Index) => {
      const Mesh = this.UnitMeshMap.get(Unit.UnitId) ?? this.CreateUnitMesh(Unit.UnitId);
      const TeamOffset = Unit.TeamId === "Player" ? -3.5 : 3.5;
      const EnemyIndex = Unit.TeamId === "Enemy" ? Index : 0;
      Mesh.position = new Vector3(TeamOffset, 0.8, EnemyIndex * 2 - 2);

      const Material = Mesh.material as StandardMaterial;
      if (!Unit.IsAlive) {
        Material.diffuseColor = new Color3(0.24, 0.24, 0.24);
      } else if (ViewModel.SelectedTargetId === Unit.UnitId) {
        Material.diffuseColor = new Color3(0.88, 0.65, 0.12);
      } else if (ViewModel.ActiveUnitId === Unit.UnitId) {
        Material.diffuseColor = new Color3(0.15, 0.65, 0.95);
      } else if (Unit.TeamId === "Player") {
        Material.diffuseColor = new Color3(0.2, 0.82, 0.42);
      } else {
        Material.diffuseColor = new Color3(0.84, 0.3, 0.24);
      }

      ExistingIds.delete(Unit.UnitId);
    });

    ExistingIds.forEach((UnitId) => {
      const Mesh = this.UnitMeshMap.get(UnitId);
      if (Mesh) {
        Mesh.dispose();
      }
      this.UnitMeshMap.delete(UnitId);
    });
  }

  private CreateUnitMesh(UnitId: string): Mesh {
    const UnitMesh = MeshBuilder.CreateBox(
      `Unit_${UnitId}`,
      {
        size: 1.3
      },
      this.Scene
    );

    const Material = new StandardMaterial(`UnitMat_${UnitId}`, this.Scene);
    Material.diffuseColor = new Color3(0.7, 0.7, 0.7);
    UnitMesh.material = Material;

    this.UnitMeshMap.set(UnitId, UnitMesh);
    return UnitMesh;
  }
}
