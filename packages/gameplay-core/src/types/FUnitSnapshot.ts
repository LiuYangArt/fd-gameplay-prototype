export type FTeamId = "Player" | "Enemy";

export interface FUnitSnapshot {
  UnitId: string;
  DisplayName: string;
  TeamId: FTeamId;
  MaxHp: number;
  CurrentHp: number;
  Speed: number;
  IsAlive: boolean;
}
