import { EBattlePhase } from "@fd/gameplay-core";
import { useEffect, useMemo, useRef, useState } from "react";

import { USceneBridge } from "./game/USceneBridge";
import { UWebBattleRuntime } from "./game/UWebBattleRuntime";
import { UInputController } from "./input/UInputController";

import type { FHudViewModel } from "./ui/FHudViewModel";

export function App() {
  const CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const Runtime = useMemo(() => new UWebBattleRuntime(), []);
  const [Hud, SetHud] = useState<FHudViewModel>(Runtime.GetViewModel());

  useEffect(() => {
    const Canvas = CanvasRef.current;
    if (!Canvas) {
      return;
    }

    const SceneBridge = new USceneBridge(Canvas);
    const InputController = new UInputController(Runtime);

    const UnbindInput = InputController.Bind();
    const UnsubscribeRuntime = Runtime.OnRuntimeUpdated((ViewModel) => {
      SceneBridge.ApplyViewModel(ViewModel);
      SetHud(ViewModel);
    });

    Runtime.StartBattle();

    return () => {
      UnsubscribeRuntime();
      UnbindInput();
      SceneBridge.Dispose();
    };
  }, [Runtime]);

  return (
    <main className="AppRoot">
      <section className="BattleSection">
        <canvas ref={CanvasRef} className="BattleCanvas" />
      </section>

      <aside className="HudPanel">
        <h1>FD Gameplay Prototype</h1>
        <p>
          Phase: <strong>{Hud.Phase}</strong>
        </p>
        <p>
          Active Unit: <strong>{Hud.ActiveUnitId ?? "None"}</strong>
        </p>
        <p>
          Selected Target: <strong>{Hud.SelectedTargetId ?? "None"}</strong>
        </p>

        <div className="Controls">
          <button type="button" onClick={() => Runtime.UseBasicSkill()}>
            Confirm / Attack (Enter, Space, Gamepad A)
          </button>
          <button type="button" onClick={() => Runtime.SelectNextTarget()}>
            Next Target (Tab, Gamepad D-Pad Right)
          </button>
          <button type="button" onClick={() => Runtime.StartBattle()}>
            Restart Battle (R, Gamepad Start)
          </button>
        </div>

        <h2>Units</h2>
        <ul>
          {Hud.Units.map((Unit) => (
            <li key={Unit.UnitId}>
              {Unit.UnitId} | {Unit.TeamId} | HP {Unit.CurrentHp}/{Unit.MaxHp} |{" "}
              {Unit.IsAlive ? "Alive" : "Defeated"}
            </li>
          ))}
        </ul>

        <h2>Event Log</h2>
        <ul className="EventLogList">
          {Hud.EventLogs.map((Log) => (
            <li key={Log}>{Log}</li>
          ))}
        </ul>

        {Hud.Phase === EBattlePhase.Finished ? <p className="DoneText">Battle Finished</p> : null}
      </aside>
    </main>
  );
}
