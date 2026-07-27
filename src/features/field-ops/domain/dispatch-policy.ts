import { GUARDS, type Guard, type GuardId } from "../data/site";
import type { IncidentReport } from "./incident-engine";
import {
  BUILDING_OBSTACLE,
  buildSiteRoute,
  incidentMapPoint,
  type MapObstacle,
  type MapPoint,
  responderDestination,
  routeEtaMinutes,
  routeLength,
  routeTravelDuration,
} from "./site-routing";

export type ResponsePlanItem = {
  guard: Guard;
  route: MapPoint[];
  distanceToIncident: number;
  travelMs: number;
  etaMinutes: number;
};

function automaticDispatchCount(
  severity: IncidentReport["severity"],
) {
  if (severity === "Critical") return 3;
  if (severity === "High") return 2;
  if (severity === "Medium") return 1;
  return 0;
}

export function requestsAllOfficers(value: string) {
  return /\b(?:need(?:s)?|send|request(?:ing|ed)?)\s+all\s+officers?\b/i.test(
    value,
  );
}

export function requestingGuardId(value: string): GuardId | null {
  const transcript = value.toLowerCase();
  if (/\b(?:officer\s+)?chen\b/.test(transcript)) return "maya-chen";
  if (/\b(?:officer\s+)?davis\b/.test(transcript)) return "amir-davis";
  if (/\b(?:officer\s+)?lee\b/.test(transcript)) return "jordan-lee";
  if (/\b(?:officer\s+)?rivera\b/.test(transcript)) return "luis-rivera";
  return null;
}

export function responseOfficerCount(report: IncidentReport) {
  const unavailableCount = requestingGuardId(report.transcript) ? 1 : 0;
  const availableCount = GUARDS.length - unavailableCount;
  if (requestsAllOfficers(report.transcript)) return availableCount;
  return Math.min(automaticDispatchCount(report.severity), availableCount);
}

export function buildResponsePlan(
  report: IncidentReport,
  obstacle: MapObstacle = BUILDING_OBSTACLE,
): ResponsePlanItem[] {
  const requesterId = requestingGuardId(report.transcript);
  const incidentPoint = incidentMapPoint(report.location);

  return GUARDS.filter((guard) => guard.id !== requesterId)
    .map((guard) => {
      const routeToIncident = buildSiteRoute(
        guard.position,
        incidentPoint,
        obstacle,
      );
      const route = buildSiteRoute(
        guard.position,
        responderDestination(report.location, guard.id),
        obstacle,
      );
      return {
        guard,
        route,
        distanceToIncident: routeLength(routeToIncident),
        travelMs: routeTravelDuration(route),
        etaMinutes: routeEtaMinutes(routeToIncident),
      };
    })
    .sort(
      (first, second) =>
        first.distanceToIncident - second.distanceToIncident ||
        first.guard.id.localeCompare(second.guard.id),
    );
}
