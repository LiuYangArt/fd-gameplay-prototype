import { useEffect, useMemo, useRef, useState } from "react";

import { UDebugMenuLayoutStore, type FDebugMenuLayoutState } from "./debug/UDebugMenuLayoutStore";
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

interface FRangeSpec {
  Key: keyof FDebugConfig;
  Label: string;
  Min: number;
  Max: number;
  Step: number;
}

interface FRangeGroup {
  Title: string;
  Specs: FRangeSpec[];
}

interface FDebugMenuPointerAction {
  Mode: "Move" | "Resize";
  OriginClientX: number;
  OriginClientY: number;
  StartLayout: FDebugMenuLayoutState;
}

type FDebugTabKey = "Overworld" | "Battle";

const OverworldRangeGroups: FRangeGroup[] = [
  {
    Title: "探索镜头",
    Specs: [
      { Key: "TargetArmLength", Label: "探索镜头距离 (cm)", Min: 10, Max: 2800, Step: 10 },
      { Key: "CameraFov", Label: "探索镜头 Fov", Min: 40, Max: 110, Step: 0.5 },
      { Key: "CameraLagSpeed", Label: "探索镜头跟随速度", Min: 0, Max: 20, Step: 0.1 },
      {
        Key: "CameraLagMaxDistance",
        Label: "探索镜头最大滞后 (cm)",
        Min: 0,
        Max: 1200,
        Step: 10
      },
      { Key: "CameraOffsetRight", Label: "探索镜头侧偏移 (cm)", Min: -600, Max: 600, Step: 10 },
      { Key: "CameraOffsetUp", Label: "探索镜头上偏移 (cm)", Min: -300, Max: 500, Step: 10 }
    ]
  },
  {
    Title: "探索移动",
    Specs: [
      { Key: "WalkSpeed", Label: "走路速度 (cm/s)", Min: 50, Max: 2000, Step: 10 },
      { Key: "RunSpeed", Label: "跑步速度 (cm/s)", Min: 50, Max: 3000, Step: 10 },
      { Key: "LookPitchMin", Label: "俯仰下限 (deg)", Min: -80, Max: 0, Step: 1 },
      { Key: "LookPitchMax", Label: "俯仰上限 (deg)", Min: 1, Max: 80, Step: 1 }
    ]
  }
];

const BattleRangeGroups: FRangeGroup[] = [
  {
    Title: "战斗待机镜头",
    Specs: [
      {
        Key: "BattleIntroCameraEndDistanceCm",
        Label: "待机镜头距离 (cm)",
        Min: 120,
        Max: 3200,
        Step: 10
      },
      {
        Key: "BattleIntroCameraEndHeightCm",
        Label: "待机镜头高度 (cm)",
        Min: 20,
        Max: 1400,
        Step: 10
      },
      {
        Key: "BattleFollowShoulderOffsetCm",
        Label: "待机镜头肩位偏移 (cm)",
        Min: -220,
        Max: 220,
        Step: 5
      },
      {
        Key: "BattleIntroFovDeg",
        Label: "战斗镜头 Fov（入场+待机）(deg)",
        Min: 30,
        Max: 110,
        Step: 0.5
      }
    ]
  },
  {
    Title: "入场与下落",
    Specs: [
      {
        Key: "BattleIntroCameraStartDistanceCm",
        Label: "入场镜头起始距离 (cm)",
        Min: 200,
        Max: 6000,
        Step: 10
      },
      {
        Key: "BattleIntroCameraStartHeightCm",
        Label: "入场镜头起始高度 (cm)",
        Min: 20,
        Max: 3000,
        Step: 10
      },
      { Key: "BattleIntroDurationSec", Label: "入场推进时长 (s)", Min: 0.1, Max: 8, Step: 0.05 },
      {
        Key: "BattleDropStartHeightCm",
        Label: "单位降落起始高度 (cm)",
        Min: 0,
        Max: 3000,
        Step: 10
      },
      { Key: "BattleDropDurationSec", Label: "单位降落时长 (s)", Min: 0.1, Max: 5, Step: 0.05 },
      { Key: "BattlePromptDurationSec", Label: "遭遇提示时长 (s)", Min: 0.1, Max: 6, Step: 0.05 }
    ]
  },
  {
    Title: "瞄准与目标",
    Specs: [
      { Key: "PlayerAimFovDeg", Label: "瞄准镜头 Fov (deg)", Min: 20, Max: 95, Step: 0.5 },
      {
        Key: "PlayerAimShoulderOffsetCm",
        Label: "瞄准肩位偏移 (cm)",
        Min: -300,
        Max: 300,
        Step: 5
      },
      {
        Key: "SkillTargetZoomDistanceCm",
        Label: "目标模式镜头距离 (cm)",
        Min: 120,
        Max: 2600,
        Step: 10
      }
    ]
  },
  {
    Title: "敌方与结算机位",
    Specs: [
      {
        Key: "EnemyAttackCamDistanceCm",
        Label: "敌方攻击镜头距离 (cm)",
        Min: 120,
        Max: 2200,
        Step: 10
      },
      {
        Key: "EnemyAttackCamHeightCm",
        Label: "敌方攻击镜头高度 (cm)",
        Min: 20,
        Max: 1200,
        Step: 10
      },
      { Key: "SettlementCamDistanceCm", Label: "结算镜头距离 (cm)", Min: 200, Max: 3600, Step: 10 },
      { Key: "SettlementCamHeightCm", Label: "结算镜头高度 (cm)", Min: 40, Max: 1800, Step: 10 }
    ]
  }
];

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

// eslint-disable-next-line complexity
export function App() {
  const CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const BattleViewportRef = useRef<HTMLDivElement | null>(null);
  const DebugMenuPointerActionRef = useRef<FDebugMenuPointerAction | null>(null);
  const Runtime = useMemo(() => new UWebGameRuntime(), []);
  const DebugMenuLayoutStore = useMemo(() => new UDebugMenuLayoutStore(), []);
  const [Hud, SetHud] = useState<FHudViewModel>(Runtime.GetViewModel());
  const [DebugBuffer, SetDebugBuffer] = useState("");
  const [DebugMessage, SetDebugMessage] = useState<string | null>(null);
  const [ActiveDebugTab, SetActiveDebugTab] = useState<FDebugTabKey>("Overworld");
  const [DebugMenuLayout, SetDebugMenuLayout] = useState<FDebugMenuLayoutState>(() =>
    DebugMenuLayoutStore.Load()
  );

  useEffect(() => {
    const Canvas = CanvasRef.current;
    if (!Canvas) {
      return;
    }

    const SceneBridge = new USceneBridge(Canvas);
    const InputController = new UInputController(
      (Snapshot) => Runtime.ConsumeInputSnapshot(Snapshot),
      {
        ResolveAimViewportRect: () => BattleViewportRef.current?.getBoundingClientRect() ?? null
      }
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

  useEffect(() => {
    if (!Hud.DebugState.IsMenuOpen) {
      return;
    }
    DebugMenuLayoutStore.Save(DebugMenuLayout);
  }, [DebugMenuLayout, DebugMenuLayoutStore, Hud.DebugState.IsMenuOpen]);

  useEffect(() => {
    const HandleWindowResize = () => {
      SetDebugMenuLayout((Prev) => DebugMenuLayoutStore.ClampToViewport(Prev));
    };

    window.addEventListener("resize", HandleWindowResize);
    return () => {
      window.removeEventListener("resize", HandleWindowResize);
    };
  }, [DebugMenuLayoutStore]);

  useEffect(() => {
    const HandlePointerMove = (Event: PointerEvent) => {
      const Action = DebugMenuPointerActionRef.current;
      if (!Action) {
        return;
      }

      const DeltaX = Event.clientX - Action.OriginClientX;
      const DeltaY = Event.clientY - Action.OriginClientY;
      if (Action.Mode === "Move") {
        SetDebugMenuLayout(
          DebugMenuLayoutStore.ClampToViewport({
            ...Action.StartLayout,
            X: Action.StartLayout.X + DeltaX,
            Y: Action.StartLayout.Y + DeltaY
          })
        );
        return;
      }

      SetDebugMenuLayout(
        DebugMenuLayoutStore.ClampToViewport({
          ...Action.StartLayout,
          Width: Action.StartLayout.Width + DeltaX,
          Height: Action.StartLayout.Height + DeltaY
        })
      );
    };

    const EndPointerAction = () => {
      DebugMenuPointerActionRef.current = null;
    };

    window.addEventListener("pointermove", HandlePointerMove);
    window.addEventListener("pointerup", EndPointerAction);
    window.addEventListener("pointercancel", EndPointerAction);
    return () => {
      window.removeEventListener("pointermove", HandlePointerMove);
      window.removeEventListener("pointerup", EndPointerAction);
      window.removeEventListener("pointercancel", EndPointerAction);
    };
  }, [DebugMenuLayoutStore]);

  const ApplyDebugNumber = <TKey extends keyof FDebugConfig>(Key: TKey, Value: number) => {
    Runtime.ApplyDebugConfig({
      [Key]: Value
    } as Pick<FDebugConfig, TKey>);
  };

  const HandleExportDebugJson = () => {
    SetDebugBuffer(Runtime.ExportDebugConfigJson());
    SetDebugMessage("已导出当前配置到文本框。");
  };

  const HandleImportDebugJson = () => {
    const Result = Runtime.ImportDebugConfigJson(DebugBuffer);
    SetDebugMessage(Result.IsSuccess ? "配置导入成功。" : Result.ErrorMessage);
  };

  const StartDebugMenuPointerAction = (
    Mode: FDebugMenuPointerAction["Mode"],
    ClientX: number,
    ClientY: number
  ) => {
    DebugMenuPointerActionRef.current = {
      Mode,
      OriginClientX: ClientX,
      OriginClientY: ClientY,
      StartLayout: DebugMenuLayout
    };
  };

  const HandleDebugMenuMovePointerDown = (Event: React.PointerEvent<HTMLDivElement>) => {
    Event.preventDefault();
    StartDebugMenuPointerAction("Move", Event.clientX, Event.clientY);
  };

  const HandleDebugMenuResizePointerDown = (Event: React.PointerEvent<HTMLDivElement>) => {
    Event.preventDefault();
    StartDebugMenuPointerAction("Resize", Event.clientX, Event.clientY);
  };

  const IsBattle3CPhase = Hud.RuntimePhase === "Battle3C";
  const IsSettlementPhase = Hud.RuntimePhase === "SettlementPreview";
  const IsCrosshairVisible =
    IsBattle3CPhase &&
    (Hud.Battle3CState.CameraMode === "PlayerAim" ||
      Hud.Battle3CState.CameraMode === "SkillTargetZoom");
  const IsAimCursorHidden = IsBattle3CPhase && Hud.Battle3CState.CameraMode === "PlayerAim";
  const DebugMenuStyle: React.CSSProperties = {
    left: `${DebugMenuLayout.X}px`,
    top: `${DebugMenuLayout.Y}px`,
    width: `${DebugMenuLayout.Width}px`,
    height: `${DebugMenuLayout.Height}px`
  };

  return (
    <main className="AppRoot">
      <section className="BattleSection">
        <div
          ref={BattleViewportRef}
          className={`BattleViewport${IsAimCursorHidden ? " BattleViewport--HideCursor" : ""}`}
        >
          <canvas ref={CanvasRef} className="BattleCanvas" />

          {Hud.EncounterState.PromptText ? (
            <div className="PhaseBanner">{Hud.EncounterState.PromptText}</div>
          ) : null}

          {IsSettlementPhase ? (
            <div className="SettlementOverlay">
              <p>{Hud.SettlementState.SummaryText}</p>
              <p>{Hud.SettlementState.ConfirmHintText}</p>
            </div>
          ) : null}

          {IsCrosshairVisible ? (
            <div
              className="Crosshair"
              style={{
                left: `${(Hud.Battle3CState.CrosshairScreenPosition.X * 100).toFixed(2)}%`,
                top: `${(Hud.Battle3CState.CrosshairScreenPosition.Y * 100).toFixed(2)}%`
              }}
            />
          ) : null}
        </div>
      </section>

      <aside className="HudPanel">
        <h1>FD Gameplay Prototype</h1>
        <p>
          Runtime Phase: <strong>{Hud.RuntimePhase}</strong>
        </p>

        <section className="PanelBlock">
          <h2>全局控制</h2>
          <div className="ControlsGrid">
            <button type="button" onClick={() => Runtime.StartGame()}>
              重开探索（R / Start）
            </button>
            <button type="button" onClick={() => Runtime.RequestSettlementPreview("面板触发")}>
              进入结算（Alt + Q）
            </button>
            <button type="button" onClick={() => Runtime.ConfirmSettlementPreview()}>
              确认回图（Enter / A）
            </button>
          </div>
          <p className="HintText">
            战斗输入：Q/LT 切瞄准，鼠标/右摇杆控准星，LMB/RT/A 开火，C/LB 切角色，Tab/RB
            切目标模式，Alt+Q 结算。
          </p>
        </section>

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
          <h2>Encounter Transition</h2>
          <p>
            Encounter Enemy: <strong>{Hud.EncounterState.EncounterEnemyId ?? "None"}</strong>
          </p>
          <p>
            Remaining: <strong>{Hud.EncounterState.RemainingTransitionMs.toFixed(0)} ms</strong>
          </p>
        </section>

        <section className="PanelBlock">
          <h2>Battle 3C</h2>
          <p>
            Controlled: <strong>{Hud.Battle3CState.ControlledCharacterId ?? "None"}</strong>
          </p>
          <p>
            Camera Mode: <strong>{Hud.Battle3CState.CameraMode}</strong>
          </p>
          <p>
            Aim/Target Mode:{" "}
            <strong>
              {Hud.Battle3CState.IsAimMode ? "Aim" : "Follow"} /{" "}
              {Hud.Battle3CState.IsSkillTargetMode ? "SkillTarget" : "Off"}
            </strong>
          </p>
          <p>
            Selected Target: <strong>{Hud.Battle3CState.SelectedTargetId ?? "None"}</strong>
          </p>
          <p>
            Crosshair:{" "}
            <strong>
              X {Hud.Battle3CState.CrosshairScreenPosition.X.toFixed(3)} / Y{" "}
              {Hud.Battle3CState.CrosshairScreenPosition.Y.toFixed(3)}
            </strong>
          </p>
          <p>
            Enemy Script Step: <strong>{Hud.Battle3CState.ScriptStepIndex}</strong>
          </p>

          <div className="ControlsGrid">
            <button
              type="button"
              disabled={!IsBattle3CPhase}
              onClick={() => Runtime.ToggleBattleAim()}
            >
              切换瞄准（Q / LT）
            </button>
            <button
              type="button"
              disabled={!IsBattle3CPhase}
              onClick={() => Runtime.FireBattleAction()}
            >
              开火（LMB / RT / A）
            </button>
            <button
              type="button"
              disabled={!IsBattle3CPhase}
              onClick={() => Runtime.SwitchControlledCharacter()}
            >
              切角色（C / LB）
            </button>
            <button
              type="button"
              disabled={!IsBattle3CPhase}
              onClick={() => Runtime.ToggleBattleSkillTargetMode()}
            >
              目标模式（Tab / RB）
            </button>
            <button
              type="button"
              disabled={!IsBattle3CPhase}
              onClick={() => Runtime.CycleBattleTarget(-1)}
            >
              上一个目标（Left）
            </button>
            <button
              type="button"
              disabled={!IsBattle3CPhase}
              onClick={() => Runtime.CycleBattleTarget(1)}
            >
              下一个目标（Right）
            </button>
          </div>

          <ul>
            {Hud.Battle3CState.Units.map((Unit) => (
              <li key={Unit.UnitId}>
                {Unit.UnitId} | {Unit.TeamId} | Pos ({Unit.PositionCm.X.toFixed(0)},{" "}
                {Unit.PositionCm.Y.toFixed(0)}, {Unit.PositionCm.Z.toFixed(0)}) |{" "}
                {Unit.IsControlled ? "Controlled" : Unit.IsSelectedTarget ? "Targeted" : "Idle"}
              </li>
            ))}
          </ul>
        </section>

        <section className="PanelBlock">
          <h2>Settlement Preview</h2>
          <p>{Hud.SettlementState.SummaryText}</p>
          <p>{Hud.SettlementState.ConfirmHintText}</p>
          <button
            type="button"
            disabled={!IsSettlementPhase}
            onClick={() => Runtime.ConfirmSettlementPreview()}
          >
            确认返回探索
          </button>
        </section>

        <section className="PanelBlock">
          <h2>Debug (F3)</h2>
          <p>
            Menu: <strong>{Hud.DebugState.IsMenuOpen ? "Open" : "Closed"}</strong>
          </p>
          <p>
            Last Saved: <strong>{Hud.DebugState.LastUpdatedAtIso ?? "Never"}</strong>
          </p>
          <p className="HintText">调试参数已改为右侧悬浮菜单，可拖拽与缩放。</p>
        </section>

        <section className="PanelBlock">
          <h2>Event Log</h2>
          <ul className="EventLogList">
            {Hud.EventLogs.map((Log, Index) => (
              <li key={`EventLog-${Index}-${Log}`}>{Log}</li>
            ))}
          </ul>
        </section>
      </aside>

      {Hud.DebugState.IsMenuOpen ? (
        <section className="FloatingDebugPanel" style={DebugMenuStyle}>
          <div className="FloatingDebugHeader" onPointerDown={HandleDebugMenuMovePointerDown}>
            <h2>Debug 参数 (F3)</h2>
            <span>拖拽移动</span>
          </div>

          <div className="FloatingDebugBody">
            <div className="DebugPanel">
              <div className="DebugTabBar">
                <button
                  type="button"
                  className={
                    ActiveDebugTab === "Overworld" ? "DebugTabButton IsActive" : "DebugTabButton"
                  }
                  onClick={() => SetActiveDebugTab("Overworld")}
                >
                  Overworld 参数
                </button>
                <button
                  type="button"
                  className={
                    ActiveDebugTab === "Battle" ? "DebugTabButton IsActive" : "DebugTabButton"
                  }
                  onClick={() => SetActiveDebugTab("Battle")}
                >
                  Battle 参数
                </button>
              </div>

              {(ActiveDebugTab === "Overworld" ? OverworldRangeGroups : BattleRangeGroups).map(
                (Group) => (
                  <div key={Group.Title} className="DebugRangeGroup">
                    <h3>{Group.Title}</h3>
                    {Group.Specs.map((Spec) => (
                      <RangeField
                        key={Spec.Key}
                        Label={Spec.Label}
                        Value={Hud.DebugState.Config[Spec.Key]}
                        Min={Spec.Min}
                        Max={Spec.Max}
                        Step={Spec.Step}
                        OnChange={(Value) => ApplyDebugNumber(Spec.Key, Value)}
                      />
                    ))}
                  </div>
                )
              )}

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
          </div>

          <div
            className="FloatingDebugResizeHandle"
            onPointerDown={HandleDebugMenuResizePointerDown}
            role="presentation"
          />
        </section>
      ) : null}
    </main>
  );
}
