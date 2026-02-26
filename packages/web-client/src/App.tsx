import { useEffect, useMemo, useRef, useState } from "react";

import { USceneBridge } from "./game/USceneBridge";
import { UWebGameRuntime } from "./game/UWebGameRuntime";
import { UInputController } from "./input/UInputController";

import type { FDebugConfig } from "./debug/UDebugConfigStore";
import type { FHudViewModel } from "./ui/FHudViewModel";

interface FRangeFieldProps {
  Label: string;
  Value: number;
  Min: number;
  Max: number;
  Step: number;
  OnChange: (Value: number) => void;
}

function RangeField({ Label, Value, Min, Max, Step, OnChange }: FRangeFieldProps) {
  return (
    <label className="DebugField">
      <span>
        {Label}: <strong>{Value.toFixed(2)}</strong>
      </span>
      <input
        type="range"
        min={Min}
        max={Max}
        step={Step}
        value={Value}
        onChange={(Event) => OnChange(Number(Event.target.value))}
      />
    </label>
  );
}

export function App() {
  const CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const Runtime = useMemo(() => new UWebGameRuntime(), []);
  const [Hud, SetHud] = useState<FHudViewModel>(Runtime.GetViewModel());
  const [DebugBuffer, SetDebugBuffer] = useState("");
  const [DebugMessage, SetDebugMessage] = useState<string | null>(null);

  useEffect(() => {
    const Canvas = CanvasRef.current;
    if (!Canvas) {
      return;
    }

    const SceneBridge = new USceneBridge(Canvas);
    const InputController = new UInputController((Snapshot) =>
      Runtime.ConsumeInputSnapshot(Snapshot)
    );

    const UnbindInput = InputController.Bind();
    const UnsubscribeRuntime = Runtime.OnRuntimeUpdated((ViewModel) => {
      SceneBridge.ApplyViewModel(ViewModel);
      SetHud(ViewModel);
    });

    Runtime.StartGame();

    return () => {
      UnsubscribeRuntime();
      UnbindInput();
      SceneBridge.Dispose();
    };
  }, [Runtime]);

  const ApplyDebugPatch = (Patch: Partial<FDebugConfig>) => {
    Runtime.ApplyDebugConfig(Patch);
  };

  const HandleExportDebugJson = () => {
    SetDebugBuffer(Runtime.ExportDebugConfigJson());
    SetDebugMessage("已导出当前配置到文本框。");
  };

  const HandleImportDebugJson = () => {
    const Result = Runtime.ImportDebugConfigJson(DebugBuffer);
    SetDebugMessage(Result.IsSuccess ? "配置导入成功。" : Result.ErrorMessage);
  };

  return (
    <main className="AppRoot">
      <section className="BattleSection">
        <canvas ref={CanvasRef} className="BattleCanvas" />
      </section>

      <aside className="HudPanel">
        <h1>FD Gameplay Prototype</h1>
        <p>
          Runtime Phase: <strong>{Hud.RuntimePhase}</strong>
        </p>

        <section className="PanelBlock">
          <h2>Overworld</h2>
          <p>
            Phase: <strong>{Hud.OverworldState.Phase}</strong>
          </p>
          <p>
            Player (cm): X {Hud.OverworldState.PlayerPosition.X.toFixed(1)} / Z{" "}
            {Hud.OverworldState.PlayerPosition.Z.toFixed(1)}
          </p>
          <p>
            Enemy Count: <strong>{Hud.OverworldState.Enemies.length}</strong>
          </p>
          <p>
            Pending Encounter:{" "}
            <strong>{Hud.OverworldState.PendingEncounterEnemyId ?? "None"}</strong>
          </p>
          <p>
            Last Encounter: <strong>{Hud.OverworldState.LastEncounterEnemyId ?? "None"}</strong>
          </p>
        </section>

        <section className="PanelBlock">
          <h2>Battle</h2>
          <p>
            Phase: <strong>{Hud.BattleState.Phase}</strong>
          </p>
          <p>
            Active Unit: <strong>{Hud.BattleState.ActiveUnitId ?? "None"}</strong>
          </p>
          <p>
            Selected Target: <strong>{Hud.BattleState.SelectedTargetId ?? "None"}</strong>
          </p>

          <div className="Controls">
            <button type="button" onClick={() => Runtime.UseBattleBasicSkill()}>
              Confirm / Attack (Enter, Space, Gamepad A)
            </button>
            <button type="button" onClick={() => Runtime.SelectNextBattleTarget()}>
              Next Target (Tab, Gamepad D-Pad Right)
            </button>
            <button type="button" onClick={() => Runtime.RestartBattle()}>
              Restart (R, Gamepad Start)
            </button>
          </div>

          <ul>
            {Hud.BattleState.Units.map((Unit) => (
              <li key={Unit.UnitId}>
                {Unit.UnitId} | {Unit.TeamId} | HP {Unit.CurrentHp}/{Unit.MaxHp} |{" "}
                {Unit.IsAlive ? "Alive" : "Defeated"}
              </li>
            ))}
          </ul>
        </section>

        <section className="PanelBlock">
          <h2>Debug (F3)</h2>
          <p>
            Menu: <strong>{Hud.DebugState.IsMenuOpen ? "Open" : "Closed"}</strong>
          </p>
          <p>
            Last Saved: <strong>{Hud.DebugState.LastUpdatedAtIso ?? "Never"}</strong>
          </p>

          {Hud.DebugState.IsMenuOpen ? (
            <div className="DebugPanel">
              <RangeField
                Label="Camera Distance (cm)"
                Value={Hud.DebugState.Config.CameraDistance}
                Min={10}
                Max={2800}
                Step={10}
                OnChange={(Value) => ApplyDebugPatch({ CameraDistance: Value })}
              />
              <RangeField
                Label="Camera Fov"
                Value={Hud.DebugState.Config.CameraFov}
                Min={40}
                Max={110}
                Step={0.5}
                OnChange={(Value) => ApplyDebugPatch({ CameraFov: Value })}
              />
              <RangeField
                Label="Camera Offset Right (cm)"
                Value={Hud.DebugState.Config.CameraOffsetRight}
                Min={-600}
                Max={600}
                Step={10}
                OnChange={(Value) => ApplyDebugPatch({ CameraOffsetRight: Value })}
              />
              <RangeField
                Label="Camera Offset Up (cm)"
                Value={Hud.DebugState.Config.CameraOffsetUp}
                Min={-300}
                Max={500}
                Step={10}
                OnChange={(Value) => ApplyDebugPatch({ CameraOffsetUp: Value })}
              />
              <RangeField
                Label="Walk Speed (cm/s)"
                Value={Hud.DebugState.Config.WalkSpeed}
                Min={50}
                Max={2000}
                Step={10}
                OnChange={(Value) => ApplyDebugPatch({ WalkSpeed: Value })}
              />
              <RangeField
                Label="Run Speed (cm/s)"
                Value={Hud.DebugState.Config.RunSpeed}
                Min={Hud.DebugState.Config.WalkSpeed}
                Max={3000}
                Step={10}
                OnChange={(Value) => ApplyDebugPatch({ RunSpeed: Value })}
              />

              <div className="ControlsInline">
                <button type="button" onClick={HandleExportDebugJson}>
                  导出 JSON
                </button>
                <button type="button" onClick={HandleImportDebugJson}>
                  导入 JSON
                </button>
              </div>
              <textarea
                className="DebugTextarea"
                value={DebugBuffer}
                onChange={(Event) => SetDebugBuffer(Event.target.value)}
                placeholder="在此粘贴配置 JSON"
              />
              {DebugMessage ? <p className="DebugMessage">{DebugMessage}</p> : null}
            </div>
          ) : null}
        </section>

        <section className="PanelBlock">
          <h2>Event Log</h2>
          <ul className="EventLogList">
            {Hud.EventLogs.map((Log) => (
              <li key={Log}>{Log}</li>
            ))}
          </ul>
        </section>
      </aside>
    </main>
  );
}
