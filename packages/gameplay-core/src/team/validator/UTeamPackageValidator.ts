import type { FTeamPackageSnapshot } from "../state/FTeamPackageSnapshot";

export interface FTeamValidationIssue {
  Code:
    | "RosterEmpty"
    | "RosterDuplicate"
    | "ActiveOutOfRange"
    | "ActiveDuplicate"
    | "ActiveNotInRoster"
    | "LeaderNotInActive"
    | "DisplayNotInActive"
    | "TeamIdMismatch";
  Message: string;
}

export interface FTeamValidationResult {
  IsValid: boolean;
  Issues: FTeamValidationIssue[];
}

export class UTeamPackageValidator {
  public Validate(TeamPackage: FTeamPackageSnapshot): FTeamValidationResult {
    const Issues: FTeamValidationIssue[] = [];
    const TeamId = TeamPackage.TeamId;
    const RosterIds = TeamPackage.Roster.MemberUnitIds;
    const ActiveIds = TeamPackage.Formation.ActiveUnitIds;

    if (TeamPackage.Roster.TeamId !== TeamId || TeamPackage.Formation.TeamId !== TeamId) {
      Issues.push({
        Code: "TeamIdMismatch",
        Message: `队伍 ${TeamId} 的 TeamId 在 Team/Roster/Formation 间不一致`
      });
    }

    if (RosterIds.length < 1) {
      Issues.push({
        Code: "RosterEmpty",
        Message: `队伍 ${TeamId} 的 Roster.MemberUnitIds 至少需要 1 名成员`
      });
    }

    const RosterDuplicates = this.ResolveDuplicates(RosterIds);
    if (RosterDuplicates.length > 0) {
      Issues.push({
        Code: "RosterDuplicate",
        Message: `队伍 ${TeamId} 的 Roster 存在重复成员: ${RosterDuplicates.join(",")}`
      });
    }

    if (ActiveIds.length < 1 || ActiveIds.length > 3) {
      Issues.push({
        Code: "ActiveOutOfRange",
        Message: `队伍 ${TeamId} 的 Formation.ActiveUnitIds 必须为 1..3 人`
      });
    }

    const ActiveDuplicates = this.ResolveDuplicates(ActiveIds);
    if (ActiveDuplicates.length > 0) {
      Issues.push({
        Code: "ActiveDuplicate",
        Message: `队伍 ${TeamId} 的 ActiveUnitIds 存在重复成员: ${ActiveDuplicates.join(",")}`
      });
    }

    const RosterSet = new Set(RosterIds);
    ActiveIds.forEach((ActiveUnitId) => {
      if (RosterSet.has(ActiveUnitId)) {
        return;
      }
      Issues.push({
        Code: "ActiveNotInRoster",
        Message: `队伍 ${TeamId} 的 Active 成员 ${ActiveUnitId} 不在 Roster 中`
      });
    });

    if (!ActiveIds.includes(TeamPackage.Formation.LeaderUnitId)) {
      Issues.push({
        Code: "LeaderNotInActive",
        Message: `队伍 ${TeamId} 的 LeaderUnitId 必须属于 ActiveUnitIds`
      });
    }

    if (!ActiveIds.includes(TeamPackage.Formation.OverworldDisplayUnitId)) {
      Issues.push({
        Code: "DisplayNotInActive",
        Message: `队伍 ${TeamId} 的 OverworldDisplayUnitId 必须属于 ActiveUnitIds`
      });
    }

    return {
      IsValid: Issues.length === 0,
      Issues
    };
  }

  private ResolveDuplicates(UnitIds: string[]): string[] {
    const Seen = new Set<string>();
    const Duplicates = new Set<string>();
    UnitIds.forEach((UnitId) => {
      if (Seen.has(UnitId)) {
        Duplicates.add(UnitId);
        return;
      }
      Seen.add(UnitId);
    });
    return [...Duplicates].sort((Left, Right) => Left.localeCompare(Right));
  }
}
