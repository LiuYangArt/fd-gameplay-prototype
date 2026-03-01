import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { UDebugMenuLayoutStore, type FDebugMenuLayoutState } from "./debug/UDebugMenuLayoutStore";
import { USceneBridge } from "./game/USceneBridge";
import { UWebGameRuntime } from "./game/UWebGameRuntime";
import { EInputAction } from "./input/EInputAction";
import { UInputController } from "./input/UInputController";
import { UBattleCommandList } from "./ui/components/UBattleCommandList";
import { UBattleGlobalActionBar } from "./ui/components/UBattleGlobalActionBar";
import { UDebugFloatingPanel, type FDebugTabKey } from "./ui/components/UDebugFloatingPanel";
import { UInputPromptBadge } from "./ui/components/UInputPromptBadge";
import { ShouldShowBattleCornerActions } from "./ui/UBattleHudVisibility";

import type { FDebugConfig } from "./debug/UDebugConfigStore";
import type { FResolvedActionSlot } from "./input/FInputPrompt";
import type { FHudViewModel } from "./ui/FHudViewModel";

interface FDebugMenuPointerAction {
  Mode: "Move" | "Resize";
  OriginClientX: number;
  OriginClientY: number;
  StartLayout: FDebugMenuLayoutState;
}

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

const IssueFeedbackUrl = "https://github.com/LiuYangArt/fd-gameplay-prototype/issues";

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
  const [IsHudPanelVisible, SetIsHudPanelVisible] = useState(false);
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

    document.addEventListener("pointerlockchange", HandlePointerLockChange);
    document.addEventListener("pointerlockerror", HandlePointerLockError);
    return () => {
      document.removeEventListener("pointerlockchange", HandlePointerLockChange);
      document.removeEventListener("pointerlockerror", HandlePointerLockError);
    };
  }, []);

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
    const IsEditableTarget = (Target: EventTarget | null) => {
      if (!(Target instanceof HTMLElement)) {
        return false;
      }
      const TagName = Target.tagName;
      return (
        TagName === "INPUT" ||
        TagName === "TEXTAREA" ||
        TagName === "SELECT" ||
        Target.isContentEditable
      );
    };

    const HandleGlobalHotkey = (Event: KeyboardEvent) => {
      if (Event.altKey && Event.shiftKey && Event.code === "KeyI") {
        Event.preventDefault();
        if (Event.repeat) {
          return;
        }
        SetIsHudPanelVisible((Previous) => !Previous);
        return;
      }

      if (Event.code !== "F2" || Event.repeat || IsEditableTarget(Event.target)) {
        return;
      }
      Event.preventDefault();
      const OpenedWindow = window.open(IssueFeedbackUrl, "_blank", "noopener,noreferrer");
      OpenedWindow?.focus();
    };

    window.addEventListener("keydown", HandleGlobalHotkey);
    return () => {
      window.removeEventListener("keydown", HandleGlobalHotkey);
    };
  }, []);

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

  const HandleApplyDebugPatch = useCallback(
    (Patch: Partial<FDebugConfig>) => {
      Runtime.ApplyDebugConfig(Patch);
    },
    [Runtime]
  );

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

  const HandleBattleViewportPointerDown = (Event: React.PointerEvent<HTMLDivElement>) => {
    if (Event.button !== 0 || !IsBattle3CPhase) {
      return;
    }
    if (Hud.Battle3CState.IsAimMode) {
      TryRequestBattlePointerLock();
    }
  };

  const HandleToggleBattleAimWithPointerLock = () => {
    TryRequestBattlePointerLock();
    Runtime.ToggleBattleAim();
  };

  const IsBattle3CPhase = Hud.RuntimePhase === "Battle3C";
  const IsSettlementPhase = Hud.RuntimePhase === "SettlementPreview";
  const IsCrosshairVisible = IsBattle3CPhase && Hud.Battle3CState.CameraMode === "PlayerAim";
  const IsBattleAimMode = IsBattle3CPhase && Hud.Battle3CState.IsAimMode;
  const BattleCommandStage = Hud.Battle3CState.CommandStage;
  const IsBattleRootCommandStage = IsBattle3CPhase && BattleCommandStage === "Root";
  const IsBattleSkillMenuStage = IsBattle3CPhase && BattleCommandStage === "SkillMenu";
  const IsBattleItemMenuStage = IsBattle3CPhase && BattleCommandStage === "ItemMenu";
  const IsBattleTargetSelectStage = IsBattle3CPhase && BattleCommandStage === "TargetSelect";
  const IsBattleActionResolveStage = IsBattle3CPhase && BattleCommandStage === "ActionResolve";
  const IsItemTargetSelectStage =
    IsBattleTargetSelectStage && Hud.Battle3CState.PendingActionKind === "Item";
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
  const SelectedTargetBattleUnit =
    Hud.Battle3CState.SelectedTargetId !== null
      ? (Hud.Battle3CState.Units.find(
          (Unit) => Unit.UnitId === Hud.Battle3CState.SelectedTargetId && Unit.IsAlive
        ) ?? null)
      : null;
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
  const ActionToastStyle: React.CSSProperties = {
    left: `calc(50% + ${Hud.DebugState.Config.ActionResolveToastOffsetX}px)`,
    top: `calc(50% + ${Hud.DebugState.Config.ActionResolveToastOffsetY}px)`
  };
  const RootCommandSlots = Hud.InputHudState.ContextActionSlots.filter(
    (Slot) =>
      Slot.SlotId === "RootAttack" || Slot.SlotId === "RootSkill" || Slot.SlotId === "RootItem"
  );
  const ResolveContextPrompt = (SlotId: string) =>
    Hud.InputHudState.ContextActionSlots.find((Slot) => Slot.SlotId === SlotId)?.Prompt ?? null;
  const ContextConfirmPrompt = ResolveContextPrompt("ContextConfirm");
  const IsContextConfirmFocused = Hud.InputHudState.ContextActionSlots.some(
    (Slot) => Slot.SlotId === "ContextConfirm" && Slot.IsFocused
  );
  const SkillCommandSlots: FResolvedActionSlot[] = Hud.Battle3CState.SkillOptions.map(
    (Option, Index) => ({
      SlotId: `SkillOption:${Index}`,
      Action: EInputAction.UIConfirm,
      DisplayName: Option.DisplayName,
      TriggerType: "FocusedConfirm",
      IsFocused: IsContextConfirmFocused && Index === Hud.Battle3CState.SelectedSkillOptionIndex,
      IsVisible: true,
      ActiveDevice: Hud.InputHudState.ActiveDevice,
      Prompt: ContextConfirmPrompt
    })
  );
  const ItemCommandSlots: FResolvedActionSlot[] = Hud.Battle3CState.ItemOptions.map(
    (Option, Index) => ({
      SlotId: `ItemOption:${Index}`,
      Action: EInputAction.UIConfirm,
      DisplayName: Option.DisplayName,
      TriggerType: "FocusedConfirm",
      IsFocused: IsContextConfirmFocused && Index === Hud.Battle3CState.SelectedItemOptionIndex,
      IsVisible: true,
      ActiveDevice: Hud.InputHudState.ActiveDevice,
      Prompt: ContextConfirmPrompt
    })
  );
  const HandleRootCommandSlotTriggered = useCallback(
    (Slot: FResolvedActionSlot) => {
      switch (Slot.SlotId) {
        case "RootAttack":
          Runtime.FireBattleAction();
          return;
        case "RootSkill":
          Runtime.ToggleBattleSkillTargetMode();
          return;
        case "RootItem":
          Runtime.ToggleBattleItemMenu();
          return;
        default:
          Runtime.FireBattleAction();
      }
    },
    [Runtime]
  );
  const HandleSkillOptionSlotTriggered = useCallback(
    (Slot: FResolvedActionSlot) => {
      if (!Slot.SlotId.startsWith("SkillOption:")) {
        return;
      }
      const OptionIndex = Number.parseInt(Slot.SlotId.slice("SkillOption:".length), 10);
      if (!Number.isFinite(OptionIndex)) {
        return;
      }
      if (OptionIndex < 0 || OptionIndex >= Hud.Battle3CState.SkillOptions.length) {
        return;
      }
      Runtime.ActivateBattleSkillOption(OptionIndex);
    },
    [Hud.Battle3CState.SkillOptions.length, Runtime]
  );
  const HandleItemOptionSlotTriggered = useCallback(
    (Slot: FResolvedActionSlot) => {
      if (!Slot.SlotId.startsWith("ItemOption:")) {
        return;
      }
      const OptionIndex = Number.parseInt(Slot.SlotId.slice("ItemOption:".length), 10);
      if (!Number.isFinite(OptionIndex)) {
        return;
      }
      if (OptionIndex < 0 || OptionIndex >= Hud.Battle3CState.ItemOptions.length) {
        return;
      }
      Runtime.ActivateBattleItemOption(OptionIndex);
    },
    [Hud.Battle3CState.ItemOptions.length, Runtime]
  );
  const HandleGlobalActionTriggered = useCallback(
    (Action: EInputAction) => {
      switch (Action) {
        case EInputAction.UICancel:
          Runtime.RequestUICancelAction();
          return;
        case EInputAction.UINavLeft:
          Runtime.CycleBattleTarget(-1);
          return;
        case EInputAction.UINavRight:
          Runtime.CycleBattleTarget(1);
          return;
        case EInputAction.UIConfirm:
          Runtime.FireBattleAction();
          return;
        case EInputAction.BattleFlee:
          Runtime.FleeBattleToOverworld();
          return;
        case EInputAction.BattleSwitchCharacter:
          Runtime.SwitchControlledCharacter();
          return;
        default:
          return;
      }
    },
    [Runtime]
  );

  return (
    <main className={`AppRoot${IsHudPanelVisible ? " AppRoot--InfoVisible" : ""}`}>
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

          <div className="ViewportHotkeyHints" data-ignore-fire-input="true">
            <p>
              <kbd>F3</kbd>
              <span>显示 Debug</span>
            </p>
            <p>
              <kbd>Alt + Shift + I</kbd>
              <span>{IsHudPanelVisible ? "隐藏信息栏" : "显示信息栏"}</span>
            </p>
            <p>
              <kbd>F2</kbd>
              <span>提反馈 / Issue</span>
            </p>
          </div>

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

          {IsBattle3CPhase && Hud.Battle3CState.ActionToastText ? (
            <div
              className="BattleActionToast"
              style={ActionToastStyle}
              data-ignore-fire-input="true"
            >
              {Hud.Battle3CState.ActionToastText}
            </div>
          ) : null}

          {(IsBattleAimMode || IsBattleTargetSelectStage || IsBattleActionResolveStage) &&
          HoveredEnemyUnit &&
          EnemyHpBarStyle ? (
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
              {IsBattleAimMode ? null : IsBattleSkillMenuStage ? (
                <div className="BattleActionHudRight">
                  <UBattleCommandList
                    Slots={SkillCommandSlots}
                    OnSlotTriggered={HandleSkillOptionSlotTriggered}
                  />
                </div>
              ) : IsBattleItemMenuStage ? (
                <div className="BattleActionHudRight">
                  <UBattleCommandList
                    Slots={ItemCommandSlots}
                    OnSlotTriggered={HandleItemOptionSlotTriggered}
                  />
                </div>
              ) : IsBattleTargetSelectStage ? (
                IsItemTargetSelectStage ? null : (
                  <div className="BattleCommandPanel">
                    <div className="BattleCommandPanel__Title">选择目标敌人</div>
                    <div className="BattleCommandPanel__Target">
                      当前目标：{SelectedTargetBattleUnit?.DisplayName ?? "无可用目标"}
                    </div>
                    <div className="BattleCommandPanel__Actions">
                      <button
                        type="button"
                        className="BattleActionButton BattleActionButton--Confirm"
                        onClick={() => Runtime.FireBattleAction()}
                      >
                        <span className="BattleActionButton__Main">
                          {ContextConfirmPrompt ? (
                            <UInputPromptBadge Token={ContextConfirmPrompt} />
                          ) : null}
                          <span className="BattleActionButton__LabelText">确认目标</span>
                        </span>
                      </button>
                    </div>
                    <p className="BattleCommandHint">
                      左右切换：A/D 或 ←/→ 或 D-Pad 左/右；确认：F 或 Enter 或 手柄 A
                    </p>
                  </div>
                )
              ) : IsBattleActionResolveStage ? (
                <div className="BattleCommandPanel BattleCommandPanel--Resolve">
                  <div className="BattleCommandPanel__Title">动作执行中</div>
                  <div className="BattleCommandPanel__Target">
                    输入已锁定，等待执行完成（
                    {(Hud.Battle3CState.ActionResolveRemainingMs / 1000).toFixed(2)}
                    s）
                  </div>
                </div>
              ) : IsBattleRootCommandStage ? (
                <>
                  <div className="BattleActionHudLeft">
                    <button
                      type="button"
                      className="BattleActionButton BattleActionButton--Aim"
                      onClick={HandleToggleBattleAimWithPointerLock}
                    >
                      <span className="BattleActionButton__Main">
                        {ResolveContextPrompt("RootAim") ? (
                          <UInputPromptBadge Token={ResolveContextPrompt("RootAim")!} />
                        ) : null}
                        <span className="BattleActionButton__LabelText">瞄准</span>
                      </span>
                    </button>
                  </div>

                  <div className="BattleActionHudRight">
                    <UBattleCommandList
                      Slots={RootCommandSlots}
                      OnSlotTriggered={HandleRootCommandSlotTriggered}
                    />
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {IsBattleCornerActionsVisible ? (
            <UBattleGlobalActionBar
              Slots={Hud.InputHudState.GlobalActionSlots}
              OnActionTriggered={HandleGlobalActionTriggered}
            />
          ) : null}

          {IsBattle3CPhase && BattlePartyUnits.length > 0 ? (
            <div className="BattlePartyHud" data-ignore-fire-input="true">
              {BattlePartyUnits.map((Unit) => {
                const HpRatio = Unit.CurrentHp / Math.max(Unit.MaxHp, 1);
                const MpRatio = Unit.CurrentMp / Math.max(Unit.MaxMp, 1);
                const IsItemTargetHighlighted = IsItemTargetSelectStage && Unit.IsSelectedTarget;
                return (
                  <article
                    key={Unit.UnitId}
                    className={`BattlePartyCard${Unit.IsControlled ? " IsControlled" : ""}${IsItemTargetHighlighted ? " IsTargeted" : ""}`}
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

      {IsHudPanelVisible ? (
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
                进入结算（Alt + S）
              </button>
              <button type="button" onClick={() => Runtime.ConfirmSettlementPreview()}>
                确认回图（Enter / A）
              </button>
            </div>
            <p className="HintText">
              战斗输入：RMB/LT 切瞄准，F/Enter/A 确认，Esc/B 返回，↑/↓ 与 D-Pad 上下做菜单导航，A/D
              或 ←/→ 与 D-Pad 左右做目标导航；瞄准开火使用 LMB/RT。左下 HUD：长按 C/LS 逃跑，长按
              Tab/RS 跳过回合。
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
              Aim/Command:{" "}
              <strong>
                {Hud.Battle3CState.IsAimMode ? "Aim" : "Follow"} / {Hud.Battle3CState.CommandStage}
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
                切换瞄准（RMB / LT）
              </button>
              <button
                type="button"
                disabled={!IsBattle3CPhase}
                onClick={() => Runtime.FireBattleAction()}
              >
                确认/执行（Enter / A，瞄准中 LMB / RT）
              </button>
              <button
                type="button"
                disabled={!IsBattle3CPhase}
                onClick={() => Runtime.SwitchControlledCharacter()}
              >
                跳过回合（长按 Tab / RS）
              </button>
              <button
                type="button"
                disabled={!IsBattle3CPhase}
                onClick={() => Runtime.ToggleBattleSkillTargetMode()}
              >
                技能菜单（根命令选中“技能”后 Enter / A）
              </button>
              <button
                type="button"
                disabled={!IsBattle3CPhase}
                onClick={() => Runtime.ToggleBattleItemMenu()}
              >
                物品菜单（根命令选中“物品”后 Enter / A）
              </button>
              <button
                type="button"
                disabled={!IsBattle3CPhase}
                onClick={() => Runtime.CycleBattleTarget(-1)}
              >
                上一个目标（A / Left / D-Pad 左）
              </button>
              <button
                type="button"
                disabled={!IsBattle3CPhase}
                onClick={() => Runtime.CycleBattleTarget(1)}
              >
                下一个目标（D / Right / D-Pad 右）
              </button>
              <button
                type="button"
                disabled={!IsBattle3CPhase}
                onClick={() => Runtime.CycleBattleMenuSelection(-1)}
              >
                菜单上移（↑ / D-Pad 上）
              </button>
              <button
                type="button"
                disabled={!IsBattle3CPhase}
                onClick={() => Runtime.CycleBattleMenuSelection(1)}
              >
                菜单下移（↓ / D-Pad 下）
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
      ) : null}

      <UDebugFloatingPanel
        IsVisible={Hud.DebugState.IsMenuOpen}
        Style={DebugMenuStyle}
        ActiveTab={ActiveDebugTab}
        Hud={Hud}
        DebugBuffer={DebugBuffer}
        DebugMessage={DebugMessage}
        OnActiveTabChanged={SetActiveDebugTab}
        OnApplyDebugPatch={HandleApplyDebugPatch}
        OnExportDebugJson={HandleExportDebugJson}
        OnImportDebugJson={HandleImportDebugJson}
        OnDebugBufferChanged={SetDebugBuffer}
        OnHeaderPointerDown={HandleDebugMenuMovePointerDown}
        OnResizePointerDown={HandleDebugMenuResizePointerDown}
      />
    </main>
  );
}
