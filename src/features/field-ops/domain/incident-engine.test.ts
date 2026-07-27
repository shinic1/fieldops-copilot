import { describe, expect, it } from "vitest";

import {
  analyzeIncident,
  analyzeIncidentWithExtraction,
  DEMO_SCENARIOS,
  runEvaluationSuite,
} from "./incident-engine";

describe("incident engine", () => {
  it("extracts an unauthorized vehicle report without inventing fields", () => {
    const report = analyzeIncident(DEMO_SCENARIOS[0].transcript);

    expect(report.category).toBe("Unauthorized access");
    expect(report.severity).toBe("High");
    expect(report.location).toBe("Loading gate");
    expect(report.subject).toContain("Honda");
    expect(report.missingFields).toHaveLength(0);
  });

  it("normalizes a Spanish report into a structured incident", () => {
    const report = analyzeIncident(DEMO_SCENARIOS[1].transcript);

    expect(report.detectedLanguage).toBe("Spanish");
    expect(report.category).toBe("Unattended item");
    expect(report.location).toBe("East entrance");
  });

  it("escalates a medical emergency immediately", () => {
    const report = analyzeIncident(DEMO_SCENARIOS[2].transcript);

    expect(report.severity).toBe("Critical");
    expect(report.policy).toContain("Immediate escalation");
  });

  it("preserves Lot 3 and classifies a plural officer request", () => {
    const transcript = "Needs officers in Lot 3.";
    const report = analyzeIncident(transcript);

    expect(report.transcript).toBe(transcript);
    expect(report.category).toBe("Assistance request");
    expect(report.severity).toBe("High");
    expect(report.location).toBe("Lot 3");
    expect(report.actionTaken).toBe("Officer assistance requested");
    expect(report.missingFields).toHaveLength(0);
  });

  it("uses a requesting officer's assigned post without treating them as backup", () => {
    const transcript = "Officer Chen needs immediate support.";
    const report = analyzeIncident(transcript);

    expect(report.category).toBe("Assistance request");
    expect(report.severity).toBe("High");
    expect(report.location).toBe("Loading zone");
    expect(report.subject).toBe("Officer Chen");
    expect(report.actionTaken).toBe("Officer assistance requested");
    expect(report.missingFields).toHaveLength(0);
  });

  it("preserves an explicit full-roster request at the north perimeter", () => {
    const transcript = "Need all officers in the north perimeter.";
    const report = analyzeIncident(transcript);

    expect(report.category).toBe("Assistance request");
    expect(report.severity).toBe("High");
    expect(report.location).toBe("North perimeter");
    expect(report.actionTaken).toBe("Officer assistance requested");
    expect(report.missingFields).toHaveLength(0);
  });

  it("accepts AI-extracted facts only when exact transcript evidence exists", () => {
    const transcript =
      "Someone is circling beside Dock C and photographing employee badges. I continued observation.";
    const report = analyzeIncidentWithExtraction(transcript, {
      detectedLanguage: "English",
      category: "Suspicious activity",
      location: "Dock C",
      subject: "Person photographing employee badges",
      time: null,
      actionTaken: "Continued observation",
      evidence: {
        incidentTypeQuote: "circling",
        locationQuote: "Dock C",
        subjectQuote: "photographing employee badges",
        timeQuote: null,
        actionQuote: "continued observation",
      },
    });

    expect(report.analysisMode).toBe("OpenAI");
    expect(report.location).toBe("Dock C");
    expect(report.severity).toBe("Medium");
    expect(report.policy).toContain("Suspicious behavior");
  });

  it("rejects an AI field whose evidence quote is not in the transcript", () => {
    const report = analyzeIncidentWithExtraction(
      "A person is taking photos of badges. I notified the supervisor.",
      {
        detectedLanguage: "English",
        category: "Suspicious activity",
        location: "South gate",
        subject: "Person taking photos",
        time: null,
        actionTaken: "Supervisor notified",
        evidence: {
          incidentTypeQuote: "taking photos",
          locationQuote: "South gate",
          subjectQuote: "person is taking photos",
          timeQuote: null,
          actionQuote: "notified the supervisor",
        },
      },
    );

    expect(report.location).toBeNull();
    expect(report.missingFields).toContain("Exact location");
  });

  it("passes the public reliability suite", () => {
    const results = runEvaluationSuite();
    const checks = results.flatMap((result) => result.checks);

    expect(checks).toHaveLength(27);
    expect(checks.every((check) => check.passed)).toBe(true);
  });
});
