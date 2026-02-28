import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { UDebugMenuLayoutStore, type FDebugMenuLayoutState } from "./debug/UDebugMenuLayoutStore";
import { USceneBridge } from "./game/USceneBridge";
import { UWebGameRuntime } from "./game/UWebGameRuntime";
import { UInputController } from "./input/UInputController";
import { ShouldShowBattleCornerActions } from "./ui/UBattleHudVisibility";

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
  Key: FDebugNumberKey;
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

interface FControlledUnitAnchor {
  X: number;
  Y: number;
}

interface FAimHoverTargetAnchor {
  UnitId: string;
  Anchor: {
    X: number;
    Y: number;
  };
}

type FDebugNumberKey = {
  [K in keyof FDebugConfig]: FDebugConfig[K] extends number ? K : never;
}[keyof FDebugConfig];

type FDebugStringKey = {
  [K in keyof FDebugConfig]: FDebugConfig[K] extends string ? K : never;
}[keyof FDebugConfig];

type FDebugBooleanKey = {
  [K in keyof FDebugConfig]: FDebugConfig[K] extends boolean ? K : never;
}[keyof FDebugConfig];

const IgnoreFireInputSelector = '[data-ignore-fire-input="true"]';
const InteractiveInputSelector =
  "button, input, textarea, select, option, label, a, [role='button']";

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
        Min: -3000,
        Max: 3200,
        Step: 10
      },
      {
        Key: "BattleIntroCameraEndHeightCm",
        Label: "待机镜头高度 (cm)",
        Min: -3000,
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
      },
      {
        Key: "BattleFollowFocusOffsetRightCm",
        Label: "待机焦点侧偏移 (cm)",
        Min: -400,
        Max: 400,
        Step: 5
      },
      {
        Key: "BattleFollowFocusOffsetUpCm",
        Label: "待机焦点高偏移 (cm)",
        Min: -800,
        Max: 800,
        Step: 5
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
        Min: -3000,
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
        Key: "PlayerAimDistanceCm",
        Label: "瞄准相机后拉距离（Socket）(cm)",
        Min: 120,
        Max: 2600,
        Step: 10
      },
      {
        Key: "PlayerAimShoulderOffsetCm",
        Label: "瞄准 Socket 侧偏移 (cm)",
        Min: -300,
        Max: 300,
        Step: 5
      },
      {
        Key: "PlayerAimSocketUpCm",
        Label: "瞄准 Socket 高度 (cm)",
        Min: -400,
        Max: 500,
        Step: 5
      },
      {
        Key: "PlayerAimLookForwardDistanceCm",
        Label: "瞄准视线前探距离 (cm)",
        Min: 120,
        Max: 2600,
        Step: 10
      },
      {
        Key: "PlayerAimFocusOffsetRightCm",
        Label: "瞄准视线侧微调 (cm)",
        Min: -400,
        Max: 400,
        Step: 5
      },
      {
        Key: "PlayerAimFocusOffsetUpCm",
        Label: "瞄准视线上微调 (cm)",
        Min: -800,
        Max: 800,
        Step: 5
      },
      {
        Key: "SkillTargetZoomDistanceCm",
        Label: "目标模式镜头距离（SkillTarget）(cm)",
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
        Min: -3000,
        Max: 1200,
        Step: 10
      },
      { Key: "SettlementCamDistanceCm", Label: "结算镜头距离 (cm)", Min: 200, Max: 3600, Step: 10 },
      { Key: "SettlementCamHeightCm", Label: "结算镜头高度 (cm)", Min: -3000, Max: 1800, Step: 10 }
    ]
  }
];

function RangeField({ Label, Value, Min, Max, Step, OnChange }: FRangeFieldProps) {
  const SliderValue = Math.min(Math.max(Value, Min), Max);

  return (
    <label className="DebugField">
      <span className="DebugFieldHeader">
        <span>{Label}</span>
        <input
          className="DebugFieldValueInput"
          type="number"
          step={Step}
          value={Number.isFinite(Value) ? Value : 0}
          onChange={(Event) => {
            const Parsed = Number(Event.target.value);
            if (Number.isFinite(Parsed)) {
              OnChange(Parsed);
            }
          }}
        />
      </span>
      <input
        type="range"
        min={Min}
        max={Max}
        step={Step}
        value={SliderValue}
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
  const [IsBattlePointerLocked, SetIsBattlePointerLocked] = useState(false);
  const [ControlledUnitAnchor, SetControlledUnitAnchor] = useState<FControlledUnitAnchor | null>(
    null
  );
  const [AimHoverTargetAnchor, SetAimHoverTargetAnchor] = useState<FAimHoverTargetAnchor | null>(
    null
  );
  const [DebugMenuLayout, SetDebugMenuLayout] = useState<FDebugMenuLayoutState>(() =>
    DebugMenuLayoutStore.Load()
  );
  const HudRef = useRef(Hud);
  const AttachPointerLockAsyncErrorLog = useCallback((Result: unknown, Prefix: string) => {
    if (typeof Result !== "object" || Result === null || !("catch" in Result)) {
      return;
    }

    const CatchFn = Result.catch;
    if (typeof CatchFn !== "function") {
      return;
    }

    void CatchFn.call(Result, (Err: unknown) => {
      const ErrorMessage =
        Err instanceof globalThis.Error ? `${Err.name}: ${Err.message}` : String(Err);
      console.warn(`[App] ${Prefix}: ${ErrorMessage}`);
    });
  }, []);
  const TryRequestBattlePointerLock = useCallback(() => {
    const CurrentHud = HudRef.current;
    if (CurrentHud.RuntimePhase !== "Battle3C") {
      return;
    }

    const PointerTarget = CanvasRef.current ?? BattleViewportRef.current;
    if (!PointerTarget || typeof PointerTarget.requestPointerLock !== "function") {
      return;
    }
    if (document.pointerLockElement === PointerTarget) {
      return;
    }

    try {
      const RequestResult = PointerTarget.requestPointerLock();
      AttachPointerLockAsyncErrorLog(RequestResult, "Pointer lock request rejected");
    } catch (Err) {
      const ErrorMessage =
        Err instanceof globalThis.Error ? `${Err.name}: ${Err.message}` : String(Err);
      console.warn(`[App] Pointer lock request threw: ${ErrorMessage}`);
    }
  }, [AttachPointerLockAsyncErrorLog]);

  useEffect(() => {
    HudRef.current = Hud;
  }, [Hud]);

  useEffect(() => {
    const Canvas = CanvasRef.current;
    if (!Canvas) {
      return;
    }

    const SceneBridge = new USceneBridge(Canvas, {
      OnControlledUnitAnchorUpdated: (Anchor) => {
        SetControlledUnitAnchor((PreviousAnchor) => {
          if (!Anchor && !PreviousAnchor) {
            return PreviousAnchor;
          }
          if (!Anchor || !PreviousAnchor) {
            return Anchor;
          }
          const Epsilon = 0.0006;
          const IsUnchanged =
            Math.abs(PreviousAnchor.X - Anchor.X) <= Epsilon &&
            Math.abs(PreviousAnchor.Y - Anchor.Y) <= Epsilon;
          return IsUnchanged ? PreviousAnchor : Anchor;
        });
      },
      OnAimHoverTargetUpdated: (State) => {
        Runtime.SetBattleAimHoverTarget(State?.UnitId ?? null);
        SetAimHoverTargetAnchor((PreviousState) => {
          if (!State && !PreviousState) {
            return PreviousState;
          }
          if (!State || !PreviousState) {
            return State;
          }
          const Epsilon = 0.0006;
          const IsUnchanged =
            PreviousState.UnitId === State.UnitId &&
            Math.abs(PreviousState.Anchor.X - State.Anchor.X) <= Epsilon &&
            Math.abs(PreviousState.Anchor.Y - State.Anchor.Y) <= Epsilon;
          return IsUnchanged ? PreviousState : State;
        });
      }
    });
    const InputController = new UInputController(
      (Snapshot) => Runtime.ConsumeInputSnapshot(Snapshot),
      {
        ResolveAimViewportRect: () => BattleViewportRef.current?.getBoundingClientRect() ?? null,
        ResolvePointerLockElement: () => CanvasRef.current ?? BattleViewportRef.current,
        ShouldLockPointer: () => {
          const CurrentHud = HudRef.current;
          return CurrentHud.RuntimePhase === "Battle3C" && CurrentHud.Battle3CState.IsAimMode;
        },
        ShouldRequestPointerLockOnToggleAim: () => {
          const CurrentHud = HudRef.current;
          return CurrentHud.RuntimePhase === "Battle3C" && !CurrentHud.Battle3CState.IsAimMode;
        }
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
      SetControlledUnitAnchor(null);
    };
  }, [Runtime]);

  useEffect(() => {
    const HandlePointerLockChange = () => {
      const Target = CanvasRef.current ?? BattleViewportRef.current;
      const IsLocked = Target !== null && document.pointerLockElement === Target;
      SetIsBattlePointerLocked(IsLocked);
      console.info(`[App] pointerlockchange: ${IsLocked ? "locked" : "unlocked"}`);
    };
    const HandlePointerLockError = () => {
      console.warn("[App] pointerlockerror");
    };
    const HandleKeyDown = (Event: KeyboardEvent) => {
      if (Event.code !== "KeyQ" || Event.altKey || Event.repeat) {
        return;
      }
      const CurrentHud = HudRef.current;
      if (CurrentHud.RuntimePhase === "Battle3C" && !CurrentHud.Battle3CState.IsAimMode) {
        TryRequestBattlePointerLock();
      }
    };

    document.addEventListener("pointerlockchange", HandlePointerLockChange);
    document.addEventListener("pointerlockerror", HandlePointerLockError);
    window.addEventListener("keydown", HandleKeyDown);
    return () => {
      document.removeEventListener("pointerlockchange", HandlePointerLockChange);
      document.removeEventListener("pointerlockerror", HandlePointerLockError);
      window.removeEventListener("keydown", HandleKeyDown);
    };
  }, [TryRequestBattlePointerLock]);

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

  const ApplyDebugNumber = <TKey extends FDebugNumberKey>(Key: TKey, Value: number) => {
    Runtime.ApplyDebugConfig({
      [Key]: Value
    } as Pick<FDebugConfig, TKey>);
  };

  const ApplyDebugString = <TKey extends FDebugStringKey>(Key: TKey, Value: string) => {
    Runtime.ApplyDebugConfig({
      [Key]: Value
    } as Pick<FDebugConfig, TKey>);
  };

  const ApplyDebugBoolean = <TKey extends FDebugBooleanKey>(Key: TKey, Value: boolean) => {
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

  const ShouldIgnoreBattleViewportFireTarget = (Target: EventTarget | null): boolean => {
    if (!(Target instanceof Element)) {
      return false;
    }

    return (
      Target.closest(IgnoreFireInputSelector) !== null ||
      Target.closest(InteractiveInputSelector) !== null
    );
  };

  const HandleBattleViewportPointerDown = (Event: React.PointerEvent<HTMLDivElement>) => {
    if (Event.button !== 0 || !IsBattle3CPhase) {
      return;
    }
    if (Hud.Battle3CState.IsAimMode) {
      TryRequestBattlePointerLock();
    }
    if (ShouldIgnoreBattleViewportFireTarget(Event.target)) {
      return;
    }

    Runtime.FireBattleAction();
  };

  const HandleToggleBattleAimWithPointerLock = () => {
    TryRequestBattlePointerLock();
    Runtime.ToggleBattleAim();
  };

  const IsBattle3CPhase = Hud.RuntimePhase === "Battle3C";
  const IsSettlementPhase = Hud.RuntimePhase === "SettlementPreview";
  const IsCrosshairVisible =
    IsBattle3CPhase &&
    (Hud.Battle3CState.CameraMode === "PlayerAim" ||
      Hud.Battle3CState.CameraMode === "SkillTargetZoom");
  const IsBattleAimMode = IsBattle3CPhase && Hud.Battle3CState.IsAimMode;
  const IsAimCursorHidden = IsBattle3CPhase && Hud.Battle3CState.CameraMode === "PlayerAim";
  const IsBattleCornerActionsVisible = ShouldShowBattleCornerActions(Hud);
  const ControlledUnit =
    Hud.Battle3CState.Units.find(
      (Unit) => Unit.UnitId === Hud.Battle3CState.ControlledCharacterId
    ) ?? null;
  const IsBattleActionHudVisible =
    IsBattle3CPhase && ControlledUnit !== null && ControlledUnitAnchor !== null;
  const BattlePartyUnits = Hud.Battle3CState.PlayerActiveUnitIds.map((UnitId) =>
    Hud.Battle3CState.Units.find((Unit) => Unit.UnitId === UnitId)
  ).filter((Unit): Unit is NonNullable<typeof ControlledUnit> => Unit !== undefined);
  const HoveredEnemyUnit =
    AimHoverTargetAnchor !== null
      ? (Hud.Battle3CState.Units.find(
          (Unit) =>
            Unit.UnitId === AimHoverTargetAnchor.UnitId && Unit.TeamId === "Enemy" && Unit.IsAlive
        ) ?? null)
      : null;
  const EnemyHpBarStyle: React.CSSProperties | undefined =
    AimHoverTargetAnchor !== null
      ? {
          left: `${(AimHoverTargetAnchor.Anchor.X * 100).toFixed(2)}%`,
          top: `${(AimHoverTargetAnchor.Anchor.Y * 100).toFixed(2)}%`
        }
      : undefined;
  const ControlledUnitHudStyle: React.CSSProperties | undefined =
    ControlledUnitAnchor !== null
      ? {
          left: `${(ControlledUnitAnchor.X * 100).toFixed(2)}%`,
          top: `${(ControlledUnitAnchor.Y * 100).toFixed(2)}%`
        }
      : undefined;
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
          onPointerDown={HandleBattleViewportPointerDown}
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

          {IsBattleAimMode && HoveredEnemyUnit && EnemyHpBarStyle ? (
            <div className="EnemyHeadHpHud" style={EnemyHpBarStyle}>
              <div className="EnemyHeadHpHud__Name">{HoveredEnemyUnit.DisplayName}</div>
              <div className="EnemyHeadHpHud__Bar">
                <div
                  className="EnemyHeadHpHud__Fill"
                  style={{
                    width: `${((HoveredEnemyUnit.CurrentHp / Math.max(HoveredEnemyUnit.MaxHp, 1)) * 100).toFixed(2)}%`
                  }}
                />
              </div>
              <div className="EnemyHeadHpHud__Value">
                {HoveredEnemyUnit.CurrentHp} / {HoveredEnemyUnit.MaxHp}
              </div>
            </div>
          ) : null}

          {IsBattleActionHudVisible && ControlledUnitHudStyle ? (
            <div
              className="BattleActionHudAnchor"
              style={ControlledUnitHudStyle}
              data-ignore-fire-input="true"
            >
              {IsBattleAimMode ? (
                <div className="BattleAimReturnGroup">
                  <button
                    type="button"
                    className="BattleActionButton BattleActionButton--Return"
                    onClick={() => Runtime.ExitBattleAimMode()}
                  >
                    返回
                    <span>B / Esc</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="BattleActionHudLeft">
                    <button
                      type="button"
                      className="BattleActionButton BattleActionButton--Aim"
                      onClick={HandleToggleBattleAimWithPointerLock}
                    >
                      瞄准
                      <span>Q / LT</span>
                    </button>
                  </div>

                  <div className="BattleActionHudRight">
                    <button
                      type="button"
                      className="BattleActionButton"
                      onClick={() => Runtime.FireBattleAction()}
                    >
                      攻击
                      <span>LMB / RT / A</span>
                    </button>
                    <button
                      type="button"
                      className={`BattleActionButton${Hud.Battle3CState.IsSkillTargetMode ? " IsActive" : ""}`}
                      onClick={() => Runtime.ToggleBattleSkillTargetMode()}
                    >
                      技能
                      <span>Tab / RB</span>
                    </button>
                    <button type="button" className="BattleActionButton" disabled>
                      物品
                      <span>开发中</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {IsBattleCornerActionsVisible ? (
            <div className="BattleCornerActions" data-ignore-fire-input="true">
              <button
                type="button"
                className="BattleCornerButton"
                onClick={() => Runtime.FleeBattleToOverworld()}
              >
                逃跑
              </button>
              <button
                type="button"
                className="BattleCornerButton"
                onClick={() => Runtime.SwitchControlledCharacter()}
              >
                跳过回合
              </button>
            </div>
          ) : null}

          {IsBattle3CPhase && BattlePartyUnits.length > 0 ? (
            <div className="BattlePartyHud" data-ignore-fire-input="true">
              {BattlePartyUnits.map((Unit) => {
                const HpRatio = Unit.CurrentHp / Math.max(Unit.MaxHp, 1);
                const MpRatio = Unit.CurrentMp / Math.max(Unit.MaxMp, 1);
                return (
                  <article
                    key={Unit.UnitId}
                    className={`BattlePartyCard${Unit.IsControlled ? " IsControlled" : ""}`}
                  >
                    <div className="BattlePartyPortrait">{Unit.DisplayName.slice(0, 1)}</div>
                    <div className="BattlePartyVitals">
                      <div className="BattlePartyValueLine">
                        <span>HP</span>
                        <strong>
                          {Unit.CurrentHp}/{Unit.MaxHp}
                        </strong>
                      </div>
                      <div className="BattlePartyBar">
                        <div
                          className="BattlePartyBarFill IsHp"
                          style={{ width: `${(HpRatio * 100).toFixed(2)}%` }}
                        />
                      </div>
                      <div className="BattlePartyValueLine">
                        <span>MP</span>
                        <strong>
                          {Unit.CurrentMp}/{Unit.MaxMp}
                        </strong>
                      </div>
                      <div className="BattlePartyBar">
                        <div
                          className="BattlePartyBarFill IsMp"
                          style={{ width: `${(MpRatio * 100).toFixed(2)}%` }}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
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
            切目标模式，Esc/B 返回。左下 HUD：逃跑（返回探索）、跳过回合（切下一个我方）。
          </p>
        </section>

        <section className="PanelBlock">
          <h2>Overworld</h2>
          <p>
            Phase: <strong>{Hud.OverworldState.Phase}</strong>
          </p>
          <p>
            Controlled Team: <strong>{Hud.OverworldState.ControlledTeamId ?? "None"}</strong>
          </p>
          <p>
            Active Units:{" "}
            <strong>
              {Hud.OverworldState.ControlledTeamActiveUnitIds.length > 0
                ? Hud.OverworldState.ControlledTeamActiveUnitIds.join(", ")
                : "None"}
            </strong>
          </p>
          <p>
            Display Unit:{" "}
            <strong>{Hud.OverworldState.ControlledTeamOverworldDisplayUnitId ?? "None"}</strong>
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
            Team: <strong>{Hud.Battle3CState.PlayerTeamId ?? "None"}</strong> vs{" "}
            <strong>{Hud.Battle3CState.EnemyTeamId ?? "None"}</strong>
          </p>
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
            Pointer Lock: <strong>{IsBattlePointerLocked ? "Locked" : "Unlocked"}</strong>
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
              onClick={HandleToggleBattleAimWithPointerLock}
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
                {Unit.PositionCm.Y.toFixed(0)}, {Unit.PositionCm.Z.toFixed(0)}) | HP{" "}
                {Unit.CurrentHp}/{Unit.MaxHp} | MP {Unit.CurrentMp}/{Unit.MaxMp} |{" "}
                {Unit.IsControlled ? "Controlled" : Unit.IsSelectedTarget ? "Targeted" : "Idle"} |{" "}
                {Unit.ModelAssetPath ?? "NoModel"}
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

              <div className="DebugRangeGroup">
                <h3>输入方向</h3>
                <label className="DebugField">
                  <span>Overworld 上下反转</span>
                  <input
                    type="checkbox"
                    checked={Hud.DebugState.Config.OverworldInvertLookPitch}
                    onChange={(Event) =>
                      ApplyDebugBoolean("OverworldInvertLookPitch", Event.target.checked)
                    }
                  />
                </label>
                <label className="DebugField">
                  <span>Aim 上下反转</span>
                  <input
                    type="checkbox"
                    checked={Hud.DebugState.Config.AimInvertLookPitch}
                    onChange={(Event) =>
                      ApplyDebugBoolean("AimInvertLookPitch", Event.target.checked)
                    }
                  />
                </label>
              </div>

              <div className="DebugRangeGroup">
                <h3>Team 调试</h3>
                <p>
                  ControlledTeamId: <strong>{Hud.OverworldState.ControlledTeamId ?? "None"}</strong>
                </p>
                <p>
                  ActiveUnitIds:{" "}
                  <strong>
                    {Hud.OverworldState.ControlledTeamActiveUnitIds.length > 0
                      ? Hud.OverworldState.ControlledTeamActiveUnitIds.join(", ")
                      : "None"}
                  </strong>
                </p>
                <p>
                  OverworldDisplayUnitId:{" "}
                  <strong>
                    {Hud.OverworldState.ControlledTeamOverworldDisplayUnitId ?? "None"}
                  </strong>
                </p>
              </div>

              <div className="DebugRangeGroup">
                <h3>模型调试</h3>
                <label className="DebugField">
                  <span>char01 模型路径</span>
                  <input
                    type="text"
                    value={Hud.DebugState.Config.UnitModelChar01Path}
                    onChange={(Event) =>
                      ApplyDebugString("UnitModelChar01Path", Event.target.value)
                    }
                  />
                </label>
                <label className="DebugField">
                  <span>char02 模型路径</span>
                  <input
                    type="text"
                    value={Hud.DebugState.Config.UnitModelChar02Path}
                    onChange={(Event) =>
                      ApplyDebugString("UnitModelChar02Path", Event.target.value)
                    }
                  />
                </label>
                <label className="DebugField">
                  <span>char03 模型路径</span>
                  <input
                    type="text"
                    value={Hud.DebugState.Config.UnitModelChar03Path}
                    onChange={(Event) =>
                      ApplyDebugString("UnitModelChar03Path", Event.target.value)
                    }
                  />
                </label>
                <label className="DebugField">
                  <span>轴向修正预设</span>
                  <select
                    value={Hud.DebugState.Config.ModelAxisFixPreset}
                    onChange={(Event) =>
                      ApplyDebugString(
                        "ModelAxisFixPreset",
                        Event.target.value as FDebugConfig["ModelAxisFixPreset"]
                      )
                    }
                  >
                    <option value="None">None</option>
                    <option value="RotateY90">RotateY90</option>
                    <option value="RotateYMinus90">RotateYMinus90</option>
                    <option value="RotateY180">RotateY180</option>
                  </select>
                </label>
                <label className="DebugField">
                  <span>加载失败回退占位体</span>
                  <input
                    type="checkbox"
                    checked={Hud.DebugState.Config.FallbackToPlaceholderOnLoadFail}
                    onChange={(Event) =>
                      ApplyDebugBoolean("FallbackToPlaceholderOnLoadFail", Event.target.checked)
                    }
                  />
                </label>
              </div>

              <div className="DebugRangeGroup">
                <h3>挂点调试</h3>
                <label className="DebugField">
                  <span>MuzzleSocketPrefix</span>
                  <input
                    type="text"
                    value={Hud.DebugState.Config.MuzzleSocketPrefix}
                    onChange={(Event) => ApplyDebugString("MuzzleSocketPrefix", Event.target.value)}
                  />
                </label>
                <label className="DebugField">
                  <span>显示枪口挂点 Gizmo</span>
                  <input
                    type="checkbox"
                    checked={Hud.DebugState.Config.ShowMuzzleSocketGizmo}
                    onChange={(Event) =>
                      ApplyDebugBoolean("ShowMuzzleSocketGizmo", Event.target.checked)
                    }
                  />
                </label>
                <label className="DebugField">
                  <span>缺失挂点时使用兜底</span>
                  <input
                    type="checkbox"
                    checked={Hud.DebugState.Config.UseFallbackMuzzleIfMissing}
                    onChange={(Event) =>
                      ApplyDebugBoolean("UseFallbackMuzzleIfMissing", Event.target.checked)
                    }
                  />
                </label>
              </div>

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
