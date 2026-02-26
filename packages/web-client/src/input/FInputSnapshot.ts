export interface FInputVector2 {
  X: number;
  Y: number;
}

export interface FInputSnapshot {
  MoveAxis: FInputVector2;
  LookYawDeltaDegrees: number;
  LookPitchDeltaDegrees: number;
  SprintHold: boolean;
  ConfirmEdge: boolean;
  NextTargetEdge: boolean;
  RestartEdge: boolean;
  ToggleDebugEdge: boolean;
  DeltaSeconds: number;
}
