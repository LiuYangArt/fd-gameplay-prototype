export type TTeamId = "Player" | "Enemy";

export interface FUnitSnapshot {
  UnitId: string;
  DisplayName: string;
  TeamId: TTeamId;
  MaxHp: number;
  CurrentHp: number;
  Speed: number;
  IsAlive: boolean;
}
