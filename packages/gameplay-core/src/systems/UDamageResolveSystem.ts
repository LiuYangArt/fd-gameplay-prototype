import type { FUnitSnapshot } from "../types/FUnitSnapshot";

export interface FDamageResolveResult {
  AppliedDamage: number;
  RemainingHp: number;
  IsDefeated: boolean;
}

export class UDamageResolveSystem {
  public Resolve(Target: FUnitSnapshot, BaseDamage: number): FDamageResolveResult {
    const AppliedDamage = Math.max(0, Math.floor(BaseDamage));
    const RemainingHp = Math.max(0, Target.CurrentHp - AppliedDamage);

    return {
      AppliedDamage,
      RemainingHp,
      IsDefeated: RemainingHp <= 0
    };
  }
}
