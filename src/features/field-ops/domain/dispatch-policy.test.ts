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
    ).toEqual(["G-01", "G-03", "G-04", "G-02"]);
    expect(buildResponsePlan(southReport)[0]?.guard.id).toBe("G-04");
  });

  it("excludes the officer requesting support", () => {
    const report = analyzeIncident("Officer Chen needs immediate support.");

    expect(requestingGuardId(report.transcript)).toBe("G-03");
    expect(buildResponsePlan(report).map((item) => item.guard.id)).not.toContain(
      "G-03",
    );
  });

  it("honors explicit full-roster requests", () => {
    const report = analyzeIncident(
      "Need all officers in the north perimeter.",
    );

    expect(responseOfficerCount(report)).toBe(4);
  });
});
