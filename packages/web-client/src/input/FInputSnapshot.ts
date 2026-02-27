export interface FInputVector2 {
  X: number;
  Y: number;
}

export interface FInputSnapshot {
  MoveAxis: FInputVector2;
  LookYawDeltaDegrees: number;
  LookPitchDeltaDegrees: number;
  AimScreenDelta: FInputVector2;
  AimScreenPosition: FInputVector2 | null;
  SprintHold: boolean;
  ToggleAimEdge: boolean;
  FireEdge: boolean;
  SwitchCharacterEdge: boolean;
  ToggleSkillTargetModeEdge: boolean;
  CycleTargetAxis: number;
  ForceSettlementEdge: boolean;
  ConfirmSettlementEdge: boolean;
  RestartEdge: boolean;
  ToggleDebugEdge: boolean;
  DeltaSeconds: number;
}
