import { describe, expect, it } from "vitest";

import { UTeamPackageValidator, type FTeamPackageSnapshot } from "../src";

function CreateValidTeamPackage(): FTeamPackageSnapshot {
  return {
    Meta: {
      SchemaVersion: "1.0.0",
      DataRevision: 1
    },
    TeamId: "TEAM_PLAYER_01",
    DisplayName: "Player Team",
    MoveConfig: {
      WalkSpeedCmPerSec: 420,
      RunSpeedCmPerSec: 750
    },
    Roster: {
      TeamId: "TEAM_PLAYER_01",
      MemberUnitIds: ["char01", "char02", "char03"]
    },
    Formation: {
      TeamId: "TEAM_PLAYER_01",
      ActiveUnitIds: ["char01", "char02", "char03"],
      LeaderUnitId: "char01",
      OverworldDisplayUnitId: "char01"
    }
  };
}

describe("UTeamPackageValidator", () => {
  it("合法 TeamPackage 应通过校验", () => {
    const Validator = new UTeamPackageValidator();
    const Result = Validator.Validate(CreateValidTeamPackage());

    expect(Result.IsValid).toBe(true);
    expect(Result.Issues).toHaveLength(0);
  });

  it("LeaderUnitId 不在 ActiveUnitIds 时应报错", () => {
    const Validator = new UTeamPackageValidator();
    const Result = Validator.Validate({
      ...CreateValidTeamPackage(),
      Formation: {
        TeamId: "TEAM_PLAYER_01",
        ActiveUnitIds: ["char01", "char02", "char03"],
        LeaderUnitId: "char99",
        OverworldDisplayUnitId: "char01"
      }
    });

    expect(Result.IsValid).toBe(false);
    expect(Result.Issues.some((Issue) => Issue.Code === "LeaderNotInActive")).toBe(true);
  });

  it("ActiveUnitIds 超过 3 时应报错", () => {
    const Validator = new UTeamPackageValidator();
    const Result = Validator.Validate({
      ...CreateValidTeamPackage(),
      Roster: {
        TeamId: "TEAM_PLAYER_01",
        MemberUnitIds: ["char01", "char02", "char03", "char04"]
      },
      Formation: {
        TeamId: "TEAM_PLAYER_01",
        ActiveUnitIds: ["char01", "char02", "char03", "char04"],
        LeaderUnitId: "char01",
        OverworldDisplayUnitId: "char01"
      }
    });

    expect(Result.IsValid).toBe(false);
    expect(Result.Issues.some((Issue) => Issue.Code === "ActiveOutOfRange")).toBe(true);
  });
});
