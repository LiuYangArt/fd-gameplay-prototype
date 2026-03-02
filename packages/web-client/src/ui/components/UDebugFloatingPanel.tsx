import { useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

import type { FDebugConfig } from "../../debug/UDebugConfigStore";
import type { FHudViewModel } from "../FHudViewModel";

export type FDebugTabKey = "Overworld" | "Battle";
type FBattleDebugSubTabKey = "BattleFlow" | "BattleAim" | "BattlePreview" | "BattleFeedback";

type FDebugNumberKey = {
  [K in keyof FDebugConfig]: FDebugConfig[K] extends number ? K : never;
}[keyof FDebugConfig];

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

interface FBattleSubTabDefinition {
  Key: FBattleDebugSubTabKey;
  Label: string;
  Groups: FRangeGroup[];
}

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
    Title: "瞄准镜头",
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
      }
    ]
  },
  {
    Title: "技能预览机位（PlayerSkillPreview）",
    Specs: [
      { Key: "SkillPreviewFovDeg", Label: "技能预览 Fov (deg)", Min: 20, Max: 95, Step: 0.5 },
      {
        Key: "SkillPreviewDistanceCm",
        Label: "技能预览后拉距离 (cm)",
        Min: 120,
        Max: 2600,
        Step: 10
      },
      {
        Key: "SkillPreviewShoulderOffsetCm",
        Label: "技能预览肩位偏移 (cm)",
        Min: -300,
        Max: 300,
        Step: 5
      },
      {
        Key: "SkillPreviewSocketUpCm",
        Label: "技能预览 Socket 高度 (cm)",
        Min: -400,
        Max: 500,
        Step: 5
      },
      {
        Key: "SkillPreviewLookForwardDistanceCm",
        Label: "技能预览前探距离 (cm)",
        Min: 120,
        Max: 2600,
        Step: 10
      },
      {
        Key: "SkillPreviewFocusOffsetRightCm",
        Label: "技能预览焦点侧偏移 (cm)",
        Min: -400,
        Max: 400,
        Step: 5
      },
      {
        Key: "SkillPreviewFocusOffsetUpCm",
        Label: "技能预览焦点上偏移 (cm)",
        Min: -800,
        Max: 800,
        Step: 5
      }
    ]
  },
  {
    Title: "物品预览机位（PlayerItemPreview）",
    Specs: [
      { Key: "ItemPreviewFovDeg", Label: "物品预览 Fov (deg)", Min: 20, Max: 95, Step: 0.5 },
      {
        Key: "ItemPreviewDistanceCm",
        Label: "物品预览距离 (cm)",
        Min: 120,
        Max: 2600,
        Step: 10
      },
      {
        Key: "ItemPreviewLateralOffsetCm",
        Label: "物品预览侧偏移 (cm)",
        Min: -300,
        Max: 300,
        Step: 5
      },
      {
        Key: "ItemPreviewSocketUpCm",
        Label: "物品预览 Socket 高度 (cm)",
        Min: -400,
        Max: 500,
        Step: 5
      },
      {
        Key: "ItemPreviewLookAtHeightCm",
        Label: "物品预览看向高度 (cm)",
        Min: -200,
        Max: 500,
        Step: 5
      },
      {
        Key: "ItemPreviewFocusOffsetRightCm",
        Label: "物品预览焦点侧偏移 (cm)",
        Min: -400,
        Max: 400,
        Step: 5
      },
      {
        Key: "ItemPreviewFocusOffsetUpCm",
        Label: "物品预览焦点上偏移 (cm)",
        Min: -800,
        Max: 800,
        Step: 5
      }
    ]
  },
  {
    Title: "目标敌人特写（TargetSelect）",
    Specs: [
      {
        Key: "TargetSelectCloseupDistanceCm",
        Label: "特写距离 (cm)",
        Min: 120,
        Max: 2600,
        Step: 10
      },
      {
        Key: "TargetSelectCloseupHeightCm",
        Label: "特写高度 (cm)",
        Min: -300,
        Max: 600,
        Step: 5
      },
      {
        Key: "TargetSelectLookAtHeightCm",
        Label: "看向高度 (cm)",
        Min: -200,
        Max: 500,
        Step: 5
      },
      {
        Key: "TargetSelectLateralOffsetCm",
        Label: "特写侧偏移 (cm)",
        Min: -220,
        Max: 220,
        Step: 5
      },
      {
        Key: "TargetSelectYawDeg",
        Label: "特写固定朝向 (deg)",
        Min: -180,
        Max: 180,
        Step: 1
      },
      { Key: "TargetSelectFovDeg", Label: "特写 Fov (deg)", Min: 20, Max: 95, Step: 0.5 }
    ]
  },
  {
    Title: "执行反馈（ActionResolve）",
    Specs: [
      {
        Key: "ActionResolveDurationSec",
        Label: "执行阶段时长 (s)",
        Min: 0.1,
        Max: 3,
        Step: 0.05
      },
      {
        Key: "ActionResolveToastOffsetX",
        Label: "提示偏移 X (px)",
        Min: -600,
        Max: 600,
        Step: 1
      },
      {
        Key: "ActionResolveToastOffsetY",
        Label: "提示偏移 Y (px)",
        Min: -400,
        Max: 400,
        Step: 1
      },
      {
        Key: "ActionResolveToastDurationSec",
        Label: "提示显示时长 (s)",
        Min: 0.1,
        Max: 3,
        Step: 0.05
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

const BattleFlowRangeGroups = BattleRangeGroups.slice(0, 2);
const BattleAimRangeGroups = BattleRangeGroups.slice(2, 3);
const BattlePreviewRangeGroups = BattleRangeGroups.slice(3, 6);
const BattleFeedbackRangeGroups = BattleRangeGroups.slice(6, 8);

const BattleRangeSubTabs: FBattleSubTabDefinition[] = [
  {
    Key: "BattleFlow",
    Label: "待机/入场",
    Groups: BattleFlowRangeGroups
  },
  {
    Key: "BattleAim",
    Label: "瞄准机位",
    Groups: BattleAimRangeGroups
  },
  {
    Key: "BattlePreview",
    Label: "预览/特写",
    Groups: BattlePreviewRangeGroups
  },
  {
    Key: "BattleFeedback",
    Label: "反馈/结算",
    Groups: BattleFeedbackRangeGroups
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

interface FDebugFloatingPanelProps {
  IsVisible: boolean;
  Style: CSSProperties;
  ActiveTab: FDebugTabKey;
  Hud: FHudViewModel;
  DebugBuffer: string;
  DebugMessage: string | null;
  OnActiveTabChanged: (Tab: FDebugTabKey) => void;
  OnApplyDebugPatch: (Patch: Partial<FDebugConfig>) => void;
  OnExportDebugJson: () => void;
  OnImportDebugJson: () => void;
  OnDebugBufferChanged: (Value: string) => void;
  OnHeaderPointerDown: (Event: ReactPointerEvent<HTMLDivElement>) => void;
  OnResizePointerDown: (Event: ReactPointerEvent<HTMLDivElement>) => void;
}

export function UDebugFloatingPanel({
  IsVisible,
  Style,
  ActiveTab,
  Hud,
  DebugBuffer,
  DebugMessage,
  OnActiveTabChanged,
  OnApplyDebugPatch,
  OnExportDebugJson,
  OnImportDebugJson,
  OnDebugBufferChanged,
  OnHeaderPointerDown,
  OnResizePointerDown
}: FDebugFloatingPanelProps) {
  const [ActiveBattleSubTab, SetActiveBattleSubTab] = useState<FBattleDebugSubTabKey>("BattleFlow");
  const ActiveGroups =
    ActiveTab === "Overworld"
      ? OverworldRangeGroups
      : (BattleRangeSubTabs.find((SubTab) => SubTab.Key === ActiveBattleSubTab)?.Groups ??
        BattleRangeSubTabs[0].Groups);

  if (!IsVisible) {
    return null;
  }

  return (
    <section className="FloatingDebugPanel" style={Style}>
      <div className="FloatingDebugHeader" onPointerDown={OnHeaderPointerDown}>
        <h2>Debug 参数 (F3)</h2>
        <span>拖拽移动</span>
      </div>

      <div className="FloatingDebugBody">
        <div className="DebugPanel">
          <div className="DebugTabBar">
            <button
              type="button"
              className={ActiveTab === "Overworld" ? "DebugTabButton IsActive" : "DebugTabButton"}
              onClick={() => OnActiveTabChanged("Overworld")}
            >
              Overworld 参数
            </button>
            <button
              type="button"
              className={ActiveTab === "Battle" ? "DebugTabButton IsActive" : "DebugTabButton"}
              onClick={() => OnActiveTabChanged("Battle")}
            >
              Battle 参数
            </button>
          </div>

          {ActiveTab === "Battle" ? (
            <div className="DebugSubTabBar">
              {BattleRangeSubTabs.map((SubTab) => (
                <button
                  key={SubTab.Key}
                  type="button"
                  className={
                    ActiveBattleSubTab === SubTab.Key
                      ? "DebugSubTabButton IsActive"
                      : "DebugSubTabButton"
                  }
                  onClick={() => SetActiveBattleSubTab(SubTab.Key)}
                >
                  {SubTab.Label}
                </button>
              ))}
            </div>
          ) : null}

          {ActiveGroups.map((Group) => (
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
                  OnChange={(Value) =>
                    OnApplyDebugPatch({
                      [Spec.Key]: Value
                    } as Pick<FDebugConfig, typeof Spec.Key>)
                  }
                />
              ))}
            </div>
          ))}

          <div className="DebugRangeGroup">
            <h3>输入方向</h3>
            <label className="DebugField">
              <span>Overworld 上下反转</span>
              <input
                type="checkbox"
                checked={Hud.DebugState.Config.OverworldInvertLookPitch}
                onChange={(Event) =>
                  OnApplyDebugPatch({ OverworldInvertLookPitch: Event.target.checked })
                }
              />
            </label>
            <label className="DebugField">
              <span>Aim 上下反转</span>
              <input
                type="checkbox"
                checked={Hud.DebugState.Config.AimInvertLookPitch}
                onChange={(Event) =>
                  OnApplyDebugPatch({ AimInvertLookPitch: Event.target.checked })
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
              <strong>{Hud.OverworldState.ControlledTeamOverworldDisplayUnitId ?? "None"}</strong>
            </p>
          </div>

          <div className="DebugRangeGroup">
            <h3>模型调试</h3>
            <label className="DebugField">
              <span>char01 模型路径</span>
              <input
                type="text"
                value={Hud.DebugState.Config.UnitModelChar01Path}
                onChange={(Event) => OnApplyDebugPatch({ UnitModelChar01Path: Event.target.value })}
              />
            </label>
            <label className="DebugField">
              <span>char02 模型路径</span>
              <input
                type="text"
                value={Hud.DebugState.Config.UnitModelChar02Path}
                onChange={(Event) => OnApplyDebugPatch({ UnitModelChar02Path: Event.target.value })}
              />
            </label>
            <label className="DebugField">
              <span>char03 模型路径</span>
              <input
                type="text"
                value={Hud.DebugState.Config.UnitModelChar03Path}
                onChange={(Event) => OnApplyDebugPatch({ UnitModelChar03Path: Event.target.value })}
              />
            </label>
            <label className="DebugField">
              <span>轴向修正预设</span>
              <select
                value={Hud.DebugState.Config.ModelAxisFixPreset}
                onChange={(Event) =>
                  OnApplyDebugPatch({
                    ModelAxisFixPreset: Event.target.value as FDebugConfig["ModelAxisFixPreset"]
                  })
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
                  OnApplyDebugPatch({ FallbackToPlaceholderOnLoadFail: Event.target.checked })
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
                onChange={(Event) => OnApplyDebugPatch({ MuzzleSocketPrefix: Event.target.value })}
              />
            </label>
            <label className="DebugField">
              <span>显示枪口挂点 Gizmo</span>
              <input
                type="checkbox"
                checked={Hud.DebugState.Config.ShowMuzzleSocketGizmo}
                onChange={(Event) =>
                  OnApplyDebugPatch({ ShowMuzzleSocketGizmo: Event.target.checked })
                }
              />
            </label>
            <label className="DebugField">
              <span>缺失挂点时使用兜底</span>
              <input
                type="checkbox"
                checked={Hud.DebugState.Config.UseFallbackMuzzleIfMissing}
                onChange={(Event) =>
                  OnApplyDebugPatch({ UseFallbackMuzzleIfMissing: Event.target.checked })
                }
              />
            </label>
          </div>

          <div className="ControlsInline">
            <button type="button" onClick={OnExportDebugJson}>
              导出 JSON
            </button>
            <button type="button" onClick={OnImportDebugJson}>
              导入 JSON
            </button>
          </div>
          <textarea
            className="DebugTextarea"
            value={DebugBuffer}
            onChange={(Event) => OnDebugBufferChanged(Event.target.value)}
            placeholder="在此粘贴配置 JSON"
          />
          {DebugMessage ? <p className="DebugMessage">{DebugMessage}</p> : null}
        </div>
      </div>

      <div
        className="FloatingDebugResizeHandle"
        onPointerDown={OnResizePointerDown}
        role="presentation"
      />
    </section>
  );
}
