"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  analyzeIncident,
  DEMO_SCENARIOS,
  type DemoScenario,
  type IncidentReport,
  runEvaluationSuite,
} from "../domain/incident-engine";
import {
  BUILDING_OBSTACLE,
  incidentMapPoint,
  type MapObstacle,
  type MapPoint,
  pointAlongRoute,
} from "../domain/site-routing";
import {
  buildResponsePlan,
  requestingGuardId,
  requestsAllOfficers,
  responseOfficerCount,
} from "../domain/dispatch-policy";
import {
  BASE_ACTIVITY,
  CAMERAS,
  GUARDS,
  type ActivityItem,
} from "../data/site";
import { Icon, type IconName } from "./Icon";

type RecognitionResult = {
  readonly 0: { readonly transcript: string };
};

type RecognitionEvent = {
  readonly results: ArrayLike<RecognitionResult>;
};

type RecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type RecognitionConstructor = new () => RecognitionInstance;

type AnalyzeResponse = {
  report?: IncidentReport;
  error?: string;
};

type MobileView = "site" | "report" | "response";
type DemoStage = "ready" | "capturing" | "analyzing" | "review" | "responded";
type ResponseState = "idle" | "dispatched" | "resolved";
type CopilotTab = "incident" | "trace";

const QUEUED_REPORT_KEY = "fieldops-queued-report";

const delay = (duration: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, duration));

function normalizeVoiceTranscript(value: string) {
  return value
    .replace(/\bofficer\s+(?:chain|chin)\b/gi, "Officer Chen")
    .replace(
      /\b(?:and|at|in)\s+(?:parking\s+)?(?:lot|locked)\s+(?:3|three|tree)\b/gi,
      "in Lot 3",
    )
    .replace(/\b(?:lot|locked)\s+(?:3|three|tree)\b/gi, "Lot 3");
}

function createInitialGuardPositions(): Record<string, MapPoint> {
  return Object.fromEntries(
    GUARDS.map((guard) => [guard.id, { ...guard.position }]),
  );
}

function measuredBuildingObstacle(
  mapElement: HTMLDivElement | null,
  buildingElement: HTMLDivElement | null,
): MapObstacle {
  if (!mapElement || !buildingElement) return BUILDING_OBSTACLE;

  const map = mapElement.getBoundingClientRect();
  const building = buildingElement.getBoundingClientRect();
  if (map.width === 0 || map.height === 0) return BUILDING_OBSTACLE;

  const markerClearance = 24;
  return {
    left: ((building.left - map.left - markerClearance) / map.width) * 100,
    right: ((building.right - map.left + markerClearance) / map.width) * 100,
    top: ((building.top - map.top - markerClearance) / map.height) * 100,
    bottom:
      ((building.bottom - map.top + markerClearance) / map.height) * 100,
  };
}

function severityClass(value: IncidentReport["severity"]) {
  return value.toLowerCase();
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function FieldOpsDemo() {
  const [transcript, setTranscript] = useState("");
  const [language, setLanguage] = useState<"en-US" | "es-US">("en-US");
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [report, setReport] = useState<IncidentReport | null>(null);
  const [queuedReport, setQueuedReport] = useState<IncidentReport | null>(null);
  const [pendingReport, setPendingReport] = useState<IncidentReport | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("site");
  const [demoStage, setDemoStage] = useState<DemoStage>("ready");
  const [responseState, setResponseState] =
    useState<ResponseState>("idle");
  const [copilotTab, setCopilotTab] = useState<CopilotTab>("incident");
  const [selectedGuard, setSelectedGuard] = useState("maya-chen");
  const [dispatchedGuards, setDispatchedGuards] = useState<string[]>([]);
  const [arrivedGuards, setArrivedGuards] = useState<string[]>([]);
  const [guardPositions, setGuardPositions] = useState<
    Record<string, MapPoint>
  >(createInitialGuardPositions);
  const [responseRoutes, setResponseRoutes] = useState<
    Record<string, MapPoint[]>
  >({});
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState(4);
  const [testsOpen, setTestsOpen] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>(BASE_ACTIVITY);
  const [notice, setNotice] = useState(
    "Operations console ready. Start the live incident when you are.",
  );
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const warehouseRef = useRef<HTMLDivElement | null>(null);
  const demoRunRef = useRef(0);
  const responseRunRef = useRef(0);
  const dispatchedGuardIdsRef = useRef(new Set<string>());

  const evaluations = useMemo(() => runEvaluationSuite(), []);
  const evaluationChecks = evaluations.flatMap((item) => item.checks);
  const passedChecks = evaluationChecks.filter((item) => item.passed).length;
  const nearestGuard = GUARDS.find((guard) => guard.id === selectedGuard)!;
  const requestingOfficerId = report
    ? requestingGuardId(report.transcript)
    : null;
  const responsePlan = useMemo(
    () => (report ? buildResponsePlan(report) : []),
    [report],
  );
  const nextResponse = responsePlan.find(
    ({ guard }) => !dispatchedGuards.includes(guard.id),
  );
  const nextResponseGuard = nextResponse?.guard;
  const nextResponseGuardId = nextResponseGuard?.id;
  const selectedResponse = responsePlan.find(
    ({ guard }) => guard.id === nearestGuard.id,
  );
  const selectedCamera =
    CAMERAS.find((camera) => camera.id === selectedCameraId) ?? CAMERAS[3];
  const cameraMatchesIncident = selectedCamera.id === 4 && report !== null;
  const cameraCanDispatch =
    cameraMatchesIncident && nextResponseGuardId !== undefined;
  const automaticOfficerCount = report
    ? responseOfficerCount(report)
    : 0;
  const currentIncidentPoint = incidentMapPoint(report?.location ?? null);

  useEffect(() => {
    const stored = window.localStorage.getItem(QUEUED_REPORT_KEY);
    if (!stored) return;

    try {
      const recoveredReport = JSON.parse(stored) as IncidentReport;
      const timeout = window.setTimeout(() => {
        setQueuedReport(recoveredReport);
        setNotice("Recovered one incident queued on this device.");
      }, 0);
      return () => window.clearTimeout(timeout);
    } catch {
      window.localStorage.removeItem(QUEUED_REPORT_KEY);
    }
  }, []);

  useEffect(() => {
    if (!isOnline || !queuedReport) return;

    const timeout = window.setTimeout(() => {
      setReport(queuedReport);
      setQueuedReport(null);
      setDemoStage("review");
      setMobileView("response");
      setActivity((items) => [
        {
          id: `synced-${Date.now()}`,
          title: "Offline incident synchronized",
          detail: queuedReport.location ?? "Location pending",
          meta: "Just now",
          tone: "alert",
        },
        ...items,
      ]);
      window.localStorage.removeItem(QUEUED_REPORT_KEY);
      setNotice("Connection restored. The queued incident is now live.");
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [isOnline, queuedReport]);

  function dispatchReport(nextReport: IncidentReport) {
    if (!isOnline) {
      setQueuedReport(nextReport);
      window.localStorage.setItem(
        QUEUED_REPORT_KEY,
        JSON.stringify(nextReport),
      );
      setDemoStage("review");
      setNotice("Saved locally. The report will sync when the network returns.");
      return;
    }

    setReport(nextReport);
    setDemoStage("review");
    setResponseState("idle");
    setDispatchedGuards([]);
    setArrivedGuards([]);
    setGuardPositions(createInitialGuardPositions());
    setResponseRoutes({});
    dispatchedGuardIdsRef.current.clear();
    responseRunRef.current += 1;
    setCopilotTab("incident");
    setActivity((items) => [
      {
        id: nextReport.id,
        title: nextReport.category,
        detail: nextReport.location ?? "Location pending",
        meta: "Just now · Copilot",
        tone: "alert",
      },
      ...items.filter((item) => item.id !== nextReport.id),
    ]);
    const automaticCount = responseOfficerCount(nextReport);
    const fullRosterRequested = requestsAllOfficers(nextReport.transcript);
    const requestingOfficerId = requestingGuardId(nextReport.transcript);
    const obstacle = measuredBuildingObstacle(
      mapRef.current,
      warehouseRef.current,
    );
    const rankedResponders = buildResponsePlan(nextReport, obstacle);
    const requestingOfficer = GUARDS.find(
      (guard) => guard.id === requestingOfficerId,
    );
    setNotice(
      automaticCount > 0
        ? `${
            requestingOfficer
              ? `${requestingOfficer.name} remains on scene. `
              : ""
          }${
            fullRosterRequested
              ? "Explicit full-roster request."
              : `${nextReport.severity} severity.`
          } Routing ${automaticCount} ${
            automaticCount === 1 ? "officer" : "officers"
          } ${fullRosterRequested ? "to the stated location" : "by site policy"}.`
        : "Report structured. A supervisor can dispatch an officer if needed.",
    );
    window.setTimeout(() => setMobileView("response"), 250);

    if (automaticCount > 0) {
      const responseRun = responseRunRef.current;
      window.setTimeout(() => {
        if (responseRunRef.current !== responseRun) return;
        rankedResponders
          .slice(0, automaticCount)
          .forEach(({ guard }) => {
            dispatchGuardForReport(guard.id, nextReport, true);
          });
      }, 450);
    }
  }

  async function analyzeAndRoute(value: string, forceDispatch = false) {
    const cleanValue = value.trim();
    if (cleanValue.length < 12) {
      setNotice("Add the event, location, and any action already taken.");
      return;
    }

    setIsAnalyzing(true);
    setDemoStage("analyzing");
    setPendingReport(null);
    setMobileView("report");
    setNotice("Extracting stated facts and checking deterministic site policy…");

    let nextReport: IncidentReport;
    try {
      if (!isOnline) {
        nextReport = analyzeIncident(cleanValue);
      } else {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 20_000);

        try {
          const response = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: cleanValue }),
            signal: controller.signal,
          });
          const payload = (await response.json()) as AnalyzeResponse;
          if (!response.ok || !payload.report) {
            throw new Error(payload.error ?? "Analysis request failed.");
          }
          nextReport = payload.report;
        } finally {
          window.clearTimeout(timeout);
        }
      }
    } catch {
      nextReport = analyzeIncident(cleanValue);
    }

    setIsAnalyzing(false);

    if (nextReport.missingFields.length > 0 && !forceDispatch) {
      setPendingReport(nextReport);
      setDemoStage("review");
      setNotice("The copilot needs one operational detail before routing.");
      return;
    }

    dispatchReport(nextReport);
  }

  async function runScenario(scenario: DemoScenario) {
    const runId = demoRunRef.current + 1;
    demoRunRef.current = runId;
    recognitionRef.current?.stop();
    setReport(null);
    setQueuedReport(null);
    setPendingReport(null);
    setResponseState("idle");
    setDispatchedGuards([]);
    setArrivedGuards([]);
    setGuardPositions(createInitialGuardPositions());
    setResponseRoutes({});
    dispatchedGuardIdsRef.current.clear();
    responseRunRef.current += 1;
    setCameraOpen(false);
    setTranscript("");
    setLanguage(scenario.language);
    setDemoStage("capturing");
    setMobileView("report");
    setNotice("Incoming guard transmission on Channel 4…");

    const words = scenario.transcript.split(" ");
    for (let index = 0; index < words.length; index += 1) {
      if (demoRunRef.current !== runId) return;
      setTranscript(words.slice(0, index + 1).join(" "));
      await delay(24);
    }

    if (demoRunRef.current !== runId) return;
    await delay(240);
    await analyzeAndRoute(scenario.transcript);
  }

  function answerClarification(value: string) {
    const needsLocation =
      pendingReport?.missingFields.includes("Exact location") ?? false;
    const addition = needsLocation
      ? ` Location: ${value}.`
      : ` I ${value}.`;
    const updatedTranscript = `${pendingReport?.transcript ?? transcript}${addition}`;
    setTranscript(updatedTranscript);
    setPendingReport(null);
    void analyzeAndRoute(updatedTranscript, true);
  }

  function startVoice() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const browserWindow = window as typeof window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const Recognition =
      browserWindow.SpeechRecognition ??
      browserWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setNotice(
        "Voice capture is unavailable in this browser. Type a report or run a scenario.",
      );
      return;
    }

    const recognition = new Recognition();
    recognition.lang = language;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let nextTranscript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        nextTranscript += event.results[index][0].transcript;
      }
      setTranscript(normalizeVoiceTranscript(nextTranscript));
    };
    recognition.onerror = () => {
      setNotice("Microphone capture stopped. You can continue by typing.");
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
      setDemoStage("ready");
      setNotice("Transmission captured. Review it and run the copilot.");
    };
    recognitionRef.current = recognition;
    setIsListening(true);
    setDemoStage("capturing");
    setTranscript("");
    setMobileView("report");
    setNotice("Listening on Channel 4…");
    recognition.start();
  }

  function dispatchGuardForReport(
    guardId: string,
    activeReport: IncidentReport,
    automated: boolean,
  ) {
    const guard = GUARDS.find((item) => item.id === guardId);
    if (
      !guard ||
      dispatchedGuardIdsRef.current.has(guardId) ||
      requestingGuardId(activeReport.transcript) === guardId
    ) {
      return;
    }

    const obstacle = measuredBuildingObstacle(
      mapRef.current,
      warehouseRef.current,
    );
    const response = buildResponsePlan(activeReport, obstacle).find(
      ({ guard: candidate }) => candidate.id === guardId,
    );
    if (!response) return;

    const { route, travelMs, etaMinutes } = response;
    const destination = route[route.length - 1];
    dispatchedGuardIdsRef.current.add(guardId);
    setSelectedGuard(guardId);
    setDispatchedGuards((items) => [...items, guardId]);
    setResponseRoutes((routes) => ({ ...routes, [guardId]: route }));
    setResponseState("dispatched");
    setDemoStage("responded");
    setActivity((items) => [
      {
        id: `dispatch-${activeReport.id}-${guard.id}`,
        title: `${guard.name} ${
          automated ? "auto-dispatched" : "dispatched"
        }`,
        detail: `${guard.name} → ${
          activeReport.location ?? "incident location"
        }`,
        meta: `Just now · ETA ${etaMinutes} min`,
        tone: "success",
      },
      ...items,
    ]);
    setNotice(
      `${guard.name} ${
        automated ? "was routed by severity policy" : "accepted the dispatch"
      }. Route projected.`,
    );
    setMobileView("site");

    const responseRun = responseRunRef.current;
    const startedAt = window.performance.now();
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : travelMs;
    let finished = false;

    const markArrived = () => {
      if (finished || responseRunRef.current !== responseRun) return;
      finished = true;
      setGuardPositions((positions) => ({
        ...positions,
        [guard.id]: destination,
      }));
      setArrivedGuards((items) =>
        items.includes(guard.id) ? items : [...items, guard.id],
      );
      setActivity((items) => [
        {
          id: `arrival-${activeReport.id}-${guard.id}`,
          title: `${guard.name} arrived`,
          detail: `${guard.name} · ${
            activeReport.location ?? "incident location"
          }`,
          meta: "Just now · On scene",
          tone: "success",
        },
        ...items,
      ]);
      setNotice(`${guard.name} arrived at the incident.`);
    };

    const animateRoute = (timestamp: number) => {
      if (responseRunRef.current !== responseRun) return;
      const progress =
        duration === 0 ? 1 : Math.min((timestamp - startedAt) / duration, 1);
      setGuardPositions((positions) => ({
        ...positions,
        [guard.id]: pointAlongRoute(route, progress),
      }));

      if (progress < 1) {
        window.requestAnimationFrame(animateRoute);
      } else {
        markArrived();
      }
    };

    window.requestAnimationFrame(animateRoute);
  }

  function dispatchGuard(guardId: string) {
    if (!report) return;
    dispatchGuardForReport(guardId, report, false);
  }

  function dispatchNearestGuard() {
    if (nextResponseGuardId) dispatchGuard(nextResponseGuardId);
  }

  function openCamera(cameraId: number) {
    setSelectedCameraId(cameraId);
    setCameraOpen(true);
  }

  function resolveIncident() {
    if (!report) return;
    setResponseState("resolved");
    setDemoStage("responded");
    setActivity((items) => [
      {
        id: `resolved-${report.id}`,
        title: "Incident resolved",
        detail: "Expected delivery verified with dispatch",
        meta: "Just now · Supervisor",
        tone: "success",
      },
      ...items,
    ]);
    setNotice("Incident resolved. The audit trail and report are ready.");
  }

  function resetDemo() {
    demoRunRef.current += 1;
    recognitionRef.current?.stop();
    setTranscript("");
    setLanguage("en-US");
    setIsListening(false);
    setIsAnalyzing(false);
    setIsOnline(true);
    setReport(null);
    setQueuedReport(null);
    setPendingReport(null);
    setMobileView("site");
    setDemoStage("ready");
    setResponseState("idle");
    setCopilotTab("incident");
    setSelectedGuard("maya-chen");
    setDispatchedGuards([]);
    setArrivedGuards([]);
    setGuardPositions(createInitialGuardPositions());
    setResponseRoutes({});
    dispatchedGuardIdsRef.current.clear();
    responseRunRef.current += 1;
    setCameraOpen(false);
    setSelectedCameraId(4);
    setActivity(BASE_ACTIVITY);
    setNotice("Operations console reset. Start a live incident when ready.");
    window.localStorage.removeItem(QUEUED_REPORT_KEY);
  }

  return (
    <main className="ops-shell">
      <section className="ops-main">
        <header className="ops-topbar">
          <div className="product-identity">
            <span>F</span>
            <strong>FieldOps</strong>
          </div>
          <div className="site-title">
            <div>
              <h1>Ridgeway Distribution Center</h1>
              <span>Miami, FL · Site 028</span>
            </div>
            <button aria-label="Change site">
              <Icon name="chevron" size={14} />
            </button>
          </div>
          <dl className="shift-summary">
            <div>
              <dt>Shift</dt>
              <dd>22:00–06:00</dd>
            </div>
            <div>
              <dt>On site</dt>
              <dd>4 officers</dd>
            </div>
            <div>
              <dt>Open</dt>
              <dd>{report && responseState !== "resolved" ? 1 : 0} incidents</dd>
            </div>
          </dl>
          <div className="topbar-status">
            <button
              className={`network-button ${isOnline ? "" : "offline"}`}
              onClick={() => setIsOnline((value) => !value)}
              title="Simulate connectivity"
            >
              <Icon name={isOnline ? "wifi" : "offline"} size={15} />
              {isOnline ? "Online" : "Offline"}
            </button>
            <button
              className="checks-button"
              onClick={() => setTestsOpen(true)}
            >
              <Icon name="tests" size={15} />
              {passedChecks}/{evaluationChecks.length}
            </button>
            <button
              aria-label="Reset simulation"
              className="square-button"
              onClick={resetDemo}
            >
              <Icon name="reset" size={16} />
            </button>
          </div>
        </header>

        <nav className="mobile-tabs" aria-label="Demo views">
          {(
            [
              ["site", "Site", "location"],
              ["report", "Report", "mic"],
              ["response", "Response", "alert"],
            ] as Array<[MobileView, string, IconName]>
          ).map(([value, label, icon]) => (
            <button
              aria-current={mobileView === value ? "page" : undefined}
              className={mobileView === value ? "active" : ""}
              disabled={value === "response" && !report}
              key={value}
              onClick={() => setMobileView(value)}
            >
              <Icon name={icon} size={15} />
              {label}
              {value === "response" && report && <i />}
            </button>
          ))}
        </nav>

        {report && mobileView === "site" && (
          <button
            className="mobile-incident-banner"
            onClick={() => setMobileView("response")}
          >
            <span className={severityClass(report.severity)}>
              {report.severity}
            </span>
            <div>
              <strong>{report.category}</strong>
              <small>{report.location ?? "Location pending"}</small>
            </div>
            <div>
              <strong>
                {responseState === "resolved"
                  ? "Resolved"
                  : `${dispatchedGuards.length} responding`}
              </strong>
              <small>Open incident</small>
            </div>
            <Icon name="chevron" size={15} />
          </button>
        )}

        <div className="ops-content">
          <section
            className={`site-workspace ${
              mobileView !== "site" ? "mobile-hidden" : ""
            }`}
          >
            <header className="workspace-heading">
              <div>
                <h2>Site overview</h2>
                <p>{notice}</p>
              </div>
              <button
                className="run-simulation"
                disabled={isAnalyzing || demoStage === "capturing"}
                onClick={() => void runScenario(DEMO_SCENARIOS[0])}
              >
                <Icon
                  name={demoStage === "ready" ? "play" : "reset"}
                  size={15}
                />
                {demoStage === "ready" ? "Run sample incident" : "Run again"}
              </button>
            </header>

            <div className="map-card">
              <div className="map-toolbar">
                <div>
                  <strong>Ridgeway site plan</strong>
                  <span>Camera and officer positions</span>
                </div>
                <div className="map-metrics">
                  <span>
                    <Icon name="users" size={14} />
                    4 officers
                  </span>
                  <span>
                    <Icon name="camera" size={14} />
                    6 cameras
                  </span>
                  <span>
                    <Icon name="radio" size={14} />
                    Channel 4
                  </span>
                </div>
              </div>

              <div className="officer-strip" aria-label="Officers on duty">
                {GUARDS.map((guard) => (
                  <button
                    className={selectedGuard === guard.id ? "selected" : ""}
                    key={guard.id}
                    onClick={() => setSelectedGuard(guard.id)}
                  >
                    <span>{guard.initials}</span>
                    <strong>{guard.name}</strong>
                    <small>
                      {requestingOfficerId === guard.id
                        ? "Requesting support"
                        : arrivedGuards.includes(guard.id)
                        ? "On scene"
                        : dispatchedGuards.includes(guard.id)
                          ? "Responding"
                          : guard.post}
                    </small>
                  </button>
                ))}
              </div>

              <div className="operations-map" ref={mapRef}>
                <div className="map-grid" />
                <div className="map-road horizontal-road" />
                <div className="map-road vertical-road" />
                <div className="map-zone north-zone">
                  <span>NORTH PERIMETER</span>
                </div>
                <div className="map-zone lot-zone">
                  <span>LOT 3</span>
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="warehouse-building" ref={warehouseRef}>
                  <div className="warehouse-name">
                    <strong>RIDGEWAY</strong>
                    <span>DISTRIBUTION CENTER</span>
                  </div>
                  <div className="warehouse-aisles">
                    {Array.from({ length: 6 }, (_, index) => (
                      <i key={index} />
                    ))}
                  </div>
                  <div className="loading-bays">
                    {Array.from({ length: 5 }, (_, index) => (
                      <i key={index} />
                    ))}
                  </div>
                </div>
                <span className="zone-label main-label">MAIN ENTRANCE</span>
                <span className="zone-label loading-label">LOADING GATE B</span>
                <span className="zone-label receiving-label">RECEIVING</span>

                {CAMERAS.map((camera) => (
                  <button
                    aria-label={`Open camera ${camera.id}, ${camera.zone}`}
                    className={`camera-node camera-${camera.id}`}
                    key={camera.id}
                    onClick={() => openCamera(camera.id)}
                  >
                    <Icon name="camera" size={11} />
                  </button>
                ))}

                {dispatchedGuards.length > 0 && (
                  <svg
                    aria-hidden="true"
                    className="response-routes"
                    preserveAspectRatio="none"
                    viewBox="0 0 100 100"
                  >
                    {GUARDS.filter(
                      (guard) =>
                        dispatchedGuards.includes(guard.id) &&
                        responseRoutes[guard.id],
                    ).map((guard) => (
                      <g
                        className={
                          arrivedGuards.includes(guard.id) ? "arrived" : ""
                        }
                        key={guard.id}
                      >
                        <polyline
                          pathLength="100"
                          points={responseRoutes[guard.id]
                            .map((point) => `${point.x},${point.y}`)
                            .join(" ")}
                          vectorEffect="non-scaling-stroke"
                        />
                        <circle
                          cx={
                            responseRoutes[guard.id][
                              responseRoutes[guard.id].length - 1
                            ].x
                          }
                          cy={
                            responseRoutes[guard.id][
                              responseRoutes[guard.id].length - 1
                            ].y
                          }
                          r="0.8"
                          vectorEffect="non-scaling-stroke"
                        />
                      </g>
                    ))}
                  </svg>
                )}

                {GUARDS.map((guard) => (
                  <button
                    aria-label={`Select ${guard.name}`}
                    className={`guard-marker ${guard.className} ${
                      selectedGuard === guard.id ? "selected" : ""
                    } ${
                      dispatchedGuards.includes(guard.id)
                        ? "dispatched"
                        : ""
                    } ${
                      arrivedGuards.includes(guard.id) ? "arrived" : ""
                    }`}
                    key={guard.id}
                    onClick={() => setSelectedGuard(guard.id)}
                    style={{
                      bottom: "auto",
                      left: `${guardPositions[guard.id]?.x ?? guard.position.x}%`,
                      right: "auto",
                      top: `${guardPositions[guard.id]?.y ?? guard.position.y}%`,
                    }}
                  >
                    <span>{guard.initials}</span>
                    <i />
                  </button>
                ))}

                {report && (
                  <button
                    className={`incident-marker ${
                      responseState === "resolved" ? "resolved" : ""
                    }`}
                    onClick={() => setMobileView("response")}
                    style={{
                      left: `${currentIncidentPoint.x}%`,
                      top: `${currentIncidentPoint.y}%`,
                    }}
                  >
                    <span>
                      {responseState === "resolved" ? (
                        <Icon name="check" size={16} />
                      ) : (
                        <Icon name="alert" size={16} />
                      )}
                    </span>
                    <div>
                      <strong>{report.category}</strong>
                      <small>{report.location ?? "Location pending"}</small>
                    </div>
                  </button>
                )}

                {dispatchedGuards.some(
                  (guardId) => !arrivedGuards.includes(guardId),
                ) && (
                  <div className="response-in-motion">
                    <Icon name="route" size={13} />
                    {
                      dispatchedGuards.filter(
                        (guardId) => !arrivedGuards.includes(guardId),
                      ).length
                    }{" "}
                    en route
                  </div>
                )}

                <div className="map-compass">
                  <span>N</span>
                  <i />
                </div>

                <div className="selected-officer">
                  <span className="selected-avatar">
                    {nearestGuard.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")}
                  </span>
                  <div>
                    <small>SELECTED OFFICER</small>
                    <strong>{nearestGuard.name}</strong>
                    <span>
                      {requestingOfficerId === nearestGuard.id
                        ? `Requesting support · ${nearestGuard.post}`
                        : arrivedGuards.includes(nearestGuard.id)
                        ? `On scene · ${report?.location ?? "Incident"}`
                        : dispatchedGuards.includes(nearestGuard.id)
                          ? "Responding · En route"
                          : `${nearestGuard.post}${
                              selectedResponse
                                ? ` · ETA ${selectedResponse.etaMinutes} min`
                                : ""
                            }`}
                    </span>
                  </div>
                  <button
                    aria-label={
                      report &&
                      responseState !== "resolved" &&
                      !dispatchedGuards.includes(nearestGuard.id) &&
                      requestingOfficerId !== nearestGuard.id
                        ? `Dispatch ${nearestGuard.name}`
                        : `Message ${nearestGuard.name}`
                    }
                    disabled={
                      !report ||
                      responseState === "resolved" ||
                      dispatchedGuards.includes(nearestGuard.id) ||
                      requestingOfficerId === nearestGuard.id
                    }
                    onClick={() => dispatchGuard(nearestGuard.id)}
                  >
                    <Icon
                      name={
                        arrivedGuards.includes(nearestGuard.id)
                          ? "check"
                          : dispatchedGuards.includes(nearestGuard.id) ||
                              (report && responseState !== "resolved")
                            ? "route"
                            : "radio"
                      }
                      size={15}
                    />
                  </button>
                </div>
              </div>
            </div>

            <section className="activity-card">
              <div className="card-heading">
                <h2>Recent activity</h2>
                <span>Current shift</span>
              </div>
              <div className="activity-table">
                {activity.slice(0, 4).map((item) => (
                  <div className="activity-row" key={item.id}>
                    <span className={`activity-mark ${item.tone ?? ""}`}>
                      <Icon
                        name={
                          item.tone === "alert"
                            ? "alert"
                            : item.tone === "success"
                              ? "check"
                              : "activity"
                        }
                        size={14}
                      />
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <small>{item.meta}</small>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <aside
            className={`copilot-panel mobile-mode-${mobileView} ${
              mobileView === "site" ? "mobile-hidden" : ""
            }`}
          >
            <div className="copilot-heading">
              <div>
                <div>
                  <strong>Incident desk</strong>
                  <span>
                    {isAnalyzing
                      ? "Reviewing report"
                      : report
                        ? report.id
                        : "No open report"}
                  </span>
                </div>
              </div>
              {report && (
                <div className="copilot-tabs">
                  <button
                    className={copilotTab === "incident" ? "active" : ""}
                    onClick={() => setCopilotTab("incident")}
                  >
                    Report
                  </button>
                  <button
                    className={copilotTab === "trace" ? "active" : ""}
                    onClick={() => setCopilotTab("trace")}
                  >
                    Evidence
                  </button>
                </div>
              )}
            </div>

            <div className="copilot-scroll">
              {!report && !pendingReport && !isAnalyzing && (
                <section className="report-intro">
                  <h2>New incident report</h2>
                  <p>
                    Enter a field report below, or use the sample to see the
                    review and dispatch workflow.
                  </p>
                  <button
                    onClick={() => void runScenario(DEMO_SCENARIOS[0])}
                  >
                    <span>
                      <strong>Use sample report</strong>
                      <small>
                        Unknown driver at Loading Gate B
                      </small>
                    </span>
                    <Icon name="arrow" size={16} />
                  </button>
                  <dl>
                    <div>
                      <dt>Scheduled delivery</dt>
                      <dd>02:00 · Loading Gate B</dd>
                    </div>
                    <div>
                      <dt>Standing instruction</dt>
                      <dd>Verify driver with dispatch before entry</dd>
                    </div>
                  </dl>
                </section>
              )}

              {isAnalyzing && (
                <section className="analysis-state">
                  <h2>Reviewing report</h2>
                  <p>Checking the report against site policy.</p>
                  <div className="analysis-steps">
                    <div className="complete">
                      <Icon name="check" size={13} />
                      <span>
                        <strong>Transcript received</strong>
                        <small>Original evidence preserved</small>
                      </span>
                    </div>
                    <div className="active">
                      <span className="mini-spinner" />
                      <span>
                        <strong>Extracting stated facts</strong>
                        <small>Strict structured output</small>
                      </span>
                    </div>
                    <div>
                      <span>3</span>
                      <span>
                        <strong>Applying site policy</strong>
                        <small>Deterministic safety rules</small>
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {pendingReport && (
                <section className="clarification-panel">
                  <span className="panel-kicker">
                    <Icon name="spark" size={14} />
                    ONE DETAIL NEEDED
                  </span>
                  <h2>
                    {pendingReport.missingFields.includes("Exact location")
                      ? "Where exactly did this happen?"
                      : "What immediate action did you take?"}
                  </h2>
                  <p>
                    The copilot will not invent a missing operational fact.
                  </p>
                  <div>
                    {(pendingReport.missingFields.includes("Exact location")
                      ? ["Loading gate", "East entrance", "Parking lot 3"]
                      : [
                          "notified dispatch",
                          "secured the area",
                          "continued observation",
                        ]
                    ).map((option) => (
                      <button
                        key={option}
                        onClick={() => answerClarification(option)}
                      >
                        {option}
                        <Icon name="arrow" size={14} />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {report && copilotTab === "incident" && (
                <section className="incident-review">
                  <div className="incident-meta">
                    <span
                      className={`severity-chip ${severityClass(report.severity)}`}
                    >
                      {report.severity}
                    </span>
                    <span>{report.id}</span>
                    <span>{formatTimestamp(report.createdAt)}</span>
                  </div>
                  <div className="incident-review-title">
                    <div>
                      <h2>{report.category}</h2>
                    </div>
                    <span className="confidence-score">
                      <strong>{report.confidence}%</strong>
                      confidence
                    </span>
                  </div>

                  <div className="source-badge">
                    {report.analysisMode === "OpenAI"
                      ? "Structured from the field report"
                      : "Structured on this device"}
                    <span>
                      {automaticOfficerCount > 0
                        ? `${automaticOfficerCount} ${
                            automaticOfficerCount === 1
                              ? "officer"
                              : "officers"
                          } ${
                            requestsAllOfficers(report.transcript)
                              ? "routed by explicit request"
                              : "routed by policy"
                          }`
                        : "Supervisor dispatch required"}
                    </span>
                  </div>

                  <p className="incident-summary">{report.summary}</p>

                  <div className="incident-fields">
                    <div>
                      <span>
                        <Icon name="location" size={13} />
                        Location
                      </span>
                      <strong>{report.location ?? "Not provided"}</strong>
                    </div>
                    <div>
                      <span>
                        <Icon name="users" size={13} />
                        Subject
                      </span>
                      <strong>{report.subject}</strong>
                    </div>
                    <div>
                      <span>
                        <Icon name="clock" size={13} />
                        Reported time
                      </span>
                      <strong>{report.time}</strong>
                    </div>
                    <div>
                      <span>
                        <Icon name="globe" size={13} />
                        Language
                      </span>
                      <strong>{report.detectedLanguage}</strong>
                    </div>
                  </div>

                  <div className="policy-card">
                    <div>
                      <div>
                        <span>Recommended response</span>
                        <small>{report.policy}</small>
                      </div>
                    </div>
                    <p>{report.recommendation}</p>
                  </div>

                  {responseState === "idle" ? (
                    <div className="response-actions">
                      <button
                        className="dispatch-button"
                        onClick={dispatchNearestGuard}
                      >
                        <Icon name="route" size={16} />
                        Dispatch nearest officer
                        <span>
                          {nextResponseGuard
                            ? `${nextResponseGuard.id} · ETA ${nextResponse?.etaMinutes} min`
                            : "No officer available"}
                        </span>
                      </button>
                      <button
                        className="camera-button"
                        onClick={() => openCamera(4)}
                      >
                        <Icon name="camera" size={16} />
                        Open camera 04
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`response-confirmation ${responseState}`}
                      >
                        <span>
                          <Icon name="check" size={18} />
                        </span>
                        <div>
                          <strong>
                            {responseState === "dispatched"
                              ? `${dispatchedGuards.length} ${
                                  dispatchedGuards.length === 1
                                    ? "officer"
                                    : "officers"
                                } responding`
                              : "Incident resolved"}
                          </strong>
                          <p>
                            {responseState === "dispatched"
                              ? `${arrivedGuards.length} on scene · ${
                                  dispatchedGuards.length -
                                  arrivedGuards.length
                                } en route`
                              : "Report and audit trail are ready"}
                          </p>
                        </div>
                      </div>
                      {responseState === "dispatched" &&
                        dispatchedGuards.length <
                          GUARDS.length - (requestingOfficerId ? 1 : 0) && (
                          <div className="additional-dispatch">
                            <strong>Send another officer</strong>
                            <div>
                              {responsePlan
                                .filter(
                                  ({ guard }) =>
                                    !dispatchedGuards.includes(guard.id),
                                )
                                .map(({ guard, etaMinutes }) => (
                                  <button
                                    key={guard.id}
                                    onClick={() => dispatchGuard(guard.id)}
                                  >
                                    <span>{guard.initials}</span>
                                    {guard.name}
                                    <small>ETA {etaMinutes} min</small>
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                    </>
                  )}

                  {responseState === "dispatched" && (
                    <button
                      className="resolve-button"
                      onClick={resolveIncident}
                    >
                      Mark expected delivery verified
                      <Icon name="check" size={15} />
                    </button>
                  )}
                </section>
              )}

              {report && copilotTab === "trace" && (
                <section className="trace-panel">
                  <div className="trace-heading">
                    <h2>Report evidence</h2>
                    <p>
                      Each value below is tied to the original transmission.
                    </p>
                  </div>
                  <div className="trace-list">
                    {report.evidence.map((item) => (
                      <div key={item.field}>
                        <span>{item.field}</span>
                        <strong>{item.value}</strong>
                        <blockquote>“{item.source}”</blockquote>
                        <div>
                          <i
                            style={{
                              width: `${Math.round(item.confidence * 100)}%`,
                            }}
                          />
                        </div>
                        <small>
                          {Math.round(item.confidence * 100)}% supported
                        </small>
                      </div>
                    ))}
                  </div>
                  <div className="safety-boundary">
                    <Icon name="shield" size={16} />
                    <p>
                      <strong>The model cannot choose the response.</strong>
                      Severity and staffing are evaluated by deterministic
                      rules. A supervisor can add responders and confirms
                      resolution.
                    </p>
                  </div>
                </section>
              )}
            </div>

            <section
              className={`report-composer ${
                report ? "has-active-report" : ""
              }`}
            >
              <div className="composer-topline">
                <span>
                  New report · Channel 4
                </span>
                <div className="language-toggle">
                  <button
                    className={language === "en-US" ? "active" : ""}
                    onClick={() => setLanguage("en-US")}
                  >
                    EN
                  </button>
                  <button
                    className={language === "es-US" ? "active" : ""}
                    onClick={() => setLanguage("es-US")}
                  >
                    ES
                  </button>
                </div>
              </div>

              <div
                className={`transcript-box ${
                  isListening || demoStage === "capturing" ? "listening" : ""
                }`}
              >
                {(isListening || demoStage === "capturing") && (
                  <div className="voice-wave" aria-hidden="true">
                    {Array.from({ length: 20 }, (_, index) => (
                      <i
                        key={index}
                        style={{ animationDelay: `${index * 45}ms` }}
                      />
                    ))}
                  </div>
                )}
                <textarea
                  aria-label="Incident report"
                  onChange={(event) => setTranscript(event.target.value)}
                  placeholder="Describe what happened, where, who was involved, and what you did…"
                  value={transcript}
                />
                <button
                  aria-label={isListening ? "Stop recording" : "Report by voice"}
                  className={isListening ? "active" : ""}
                  onClick={startVoice}
                >
                  <Icon name="mic" size={18} />
                </button>
              </div>

              <div className="composer-actions">
                <div className="scenario-chips">
                  <span>Examples:</span>
                  {DEMO_SCENARIOS.slice(1).map((scenario) => (
                    <button
                      key={scenario.id}
                      onClick={() => void runScenario(scenario)}
                    >
                      {scenario.label}
                    </button>
                  ))}
                </div>
                <button
                  className="analyze-button"
                  disabled={
                    isAnalyzing ||
                    isListening ||
                    demoStage === "capturing" ||
                    transcript.trim().length < 12
                  }
                  onClick={() => void analyzeAndRoute(transcript)}
                >
                  {isAnalyzing ? (
                    <>
                      <span className="button-spinner" />
                      Analyzing
                    </>
                  ) : (
                    <>
                      Review report
                      <Icon name="arrow" size={15} />
                    </>
                  )}
                </button>
              </div>
            </section>
          </aside>
        </div>

        <div className="system-toast" role="status">
          <span className={isOnline ? "online" : "offline"} />
          {notice}
        </div>
      </section>

      {cameraOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setCameraOpen(false)}
        >
          <section
            aria-labelledby="camera-title"
            aria-modal="true"
            className="camera-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header>
              <div>
                <span className="camera-live">
                  <i />
                  LIVE
                </span>
                <div>
                  <h2 id="camera-title">
                    Camera {String(selectedCamera.id).padStart(2, "0")} ·{" "}
                    {selectedCamera.zone}
                  </h2>
                  <p>
                    {selectedCamera.orientation} · 1080p ·{" "}
                    {selectedCamera.status}
                  </p>
                </div>
              </div>
              <button
                aria-label="Close camera"
                onClick={() => setCameraOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </header>
            <div
              className={`camera-feed camera-view-${selectedCamera.id}`}
            >
              <div className="camera-noise" />
              <div
                className={`camera-yard camera-yard-${selectedCamera.id}`}
              >
                <div className="camera-building" />
                <div className="camera-gate" />
                {selectedCamera.id === 4 ? (
                  <>
                    <div className="camera-vehicle">
                      <span />
                      <i />
                      <i />
                    </div>
                    <div className="detection-box">
                      <span>VEHICLE · 94%</span>
                    </div>
                  </>
                ) : (
                  <span className="camera-clear">NO ACTIVE DETECTIONS</span>
                )}
              </div>
              <span className="camera-timestamp">
                CAM-{String(selectedCamera.id).padStart(2, "0")} · 2026-07-26
                22:42:18
              </span>
              <span className="camera-zone">
                {selectedCamera.zone.toUpperCase()}
              </span>
            </div>
            <footer>
              <div>
                <span>
                  <Icon
                    name={selectedCamera.id === 4 ? "alert" : "check"}
                    size={15}
                  />
                </span>
                <p>
                  <strong>
                    {cameraMatchesIncident
                      ? "Visual matches guard report"
                      : selectedCamera.id === 4
                        ? "Vehicle detection active"
                      : "Camera feed clear"}
                  </strong>
                  {cameraMatchesIncident
                    ? "Blue sedan is stationary inside the loading-gate geofence."
                    : selectedCamera.id === 4
                      ? "Blue sedan is stationary inside the loading-gate geofence."
                      : `No active detection in the ${selectedCamera.zone.toLowerCase()} view.`}
                </p>
              </div>
              <button
                onClick={() => {
                  setCameraOpen(false);
                  if (cameraCanDispatch) {
                    dispatchNearestGuard();
                  }
                }}
              >
                {cameraCanDispatch
                  ? `Verify & dispatch ${nextResponseGuardId}`
                  : cameraMatchesIncident
                    ? "Verify incident"
                    : "Return to site"}
                <Icon
                  name={cameraCanDispatch ? "arrow" : "check"}
                  size={15}
                />
              </button>
            </footer>
          </section>
        </div>
      )}

      {testsOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setTestsOpen(false)}
        >
          <section
            aria-labelledby="evaluation-title"
            aria-modal="true"
            className="tests-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header>
              <div>
                <span>PUBLIC RELIABILITY SUITE</span>
                <h2 id="evaluation-title">
                  {passedChecks}/{evaluationChecks.length} checks passing
                </h2>
                <p>
                  Synthetic scenarios test extraction, escalation, bilingual
                  handling, and restraint.
                </p>
              </div>
              <button
                aria-label="Close evaluation suite"
                onClick={() => setTestsOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </header>
            <div className="score-track">
              <i
                style={{
                  width: `${(passedChecks / evaluationChecks.length) * 100}%`,
                }}
              />
            </div>
            <div className="test-list">
              {evaluations.map((evaluation) => (
                <div className="test-case" key={evaluation.name}>
                  <strong>{evaluation.name}</strong>
                  {evaluation.checks.map((check) => (
                    <span key={check.label}>
                      <Icon
                        name={check.passed ? "check" : "alert"}
                        size={13}
                      />
                      {check.label}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
