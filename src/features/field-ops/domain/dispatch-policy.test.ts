import { describe, expect, it } from "vitest";

import { analyzeIncident } from "./incident-engine";
import {
  buildResponsePlan,
  requestingGuardId,
  responseOfficerCount,
} from "./dispatch-policy";

describe("dispatch policy", () => {
  it("ranks responders by walkable route length", () => {
    const northReport = analyzeIncident(
      "Need all officers in the north perimeter.",
    );
    const southReport = analyzeIncident("Need an officer in the south lot.");

    expect(
      buildResponsePlan(northReport).map((item) => item.guard.id),
    ).toEqual(["jordan-lee", "maya-chen", "amir-davis", "luis-rivera"]);
    expect(buildResponsePlan(southReport)[0]?.guard.id).toBe("luis-rivera");
  });

  it("excludes the officer requesting support", () => {
    const report = analyzeIncident("Officer Chen needs immediate support.");

    expect(requestingGuardId(report.transcript)).toBe("maya-chen");
    expect(buildResponsePlan(report).map((item) => item.guard.id)).not.toContain(
      "maya-chen",
    );
  });

  it("honors explicit full-roster requests", () => {
    const report = analyzeIncident(
      "Need all officers in the north perimeter.",
    );

    expect(responseOfficerCount(report)).toBe(4);
  });
});
