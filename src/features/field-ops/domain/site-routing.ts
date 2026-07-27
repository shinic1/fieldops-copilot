export type MapPoint = {
  x: number;
  y: number;
};

export type MapObstacle = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export const BUILDING_OBSTACLE: MapObstacle = {
  left: 24,
  right: 94,
  top: 9,
  bottom: 57,
} as const;

const RESPONSE_OFFSETS: Record<string, MapPoint> = {
  "jordan-lee": { x: -3, y: -2 },
  "amir-davis": { x: 3, y: -1 },
  "maya-chen": { x: -2, y: 2 },
  "luis-rivera": { x: 4, y: 3 },
};

function routeDistance(first: MapPoint, second: MapPoint) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

export function routeLength(route: MapPoint[]) {
  return route
    .slice(1)
    .reduce(
      (total, point, index) =>
        total + routeDistance(route[index], point),
      0,
    );
}

export function routeTravelDuration(route: MapPoint[]) {
  return Math.round(Math.max(2_600, Math.min(5_600, routeLength(route) * 55)));
}

export function routeEtaMinutes(route: MapPoint[]) {
  return Math.max(1, Math.ceil(routeLength(route) / 30));
}

export function routeSegmentCrossesBuilding(
  start: MapPoint,
  end: MapPoint,
  obstacle: MapObstacle = BUILDING_OBSTACLE,
) {
  const samples = Math.max(80, Math.ceil(routeDistance(start, end) * 4));

  for (let index = 1; index < samples; index += 1) {
    const progress = index / samples;
    const x = start.x + (end.x - start.x) * progress;
    const y = start.y + (end.y - start.y) * progress;

    if (
      x > obstacle.left &&
      x < obstacle.right &&
      y > obstacle.top &&
      y < obstacle.bottom
    ) {
      return true;
    }
  }

  return false;
}

export function buildSiteRoute(
  start: MapPoint,
  end: MapPoint,
  obstacle: MapObstacle = BUILDING_OBSTACLE,
): MapPoint[] {
  if (!routeSegmentCrossesBuilding(start, end, obstacle)) return [start, end];

  const routeCorners: MapPoint[] = [
    { x: obstacle.left - 1, y: obstacle.top - 1 },
    { x: obstacle.right + 1, y: obstacle.top - 1 },
    { x: obstacle.left - 1, y: obstacle.bottom + 1 },
    { x: obstacle.right + 1, y: obstacle.bottom + 1 },
  ];

  const nodes = [start, end, ...routeCorners];
  const distances = nodes.map(() => Number.POSITIVE_INFINITY);
  const previous = nodes.map(() => -1);
  const visited = nodes.map(() => false);
  distances[0] = 0;

  for (let step = 0; step < nodes.length; step += 1) {
    let current = -1;
    for (let index = 0; index < nodes.length; index += 1) {
      if (
        !visited[index] &&
        (current === -1 || distances[index] < distances[current])
      ) {
        current = index;
      }
    }

    if (current === -1 || !Number.isFinite(distances[current])) break;
    if (current === 1) break;
    visited[current] = true;

    for (let next = 0; next < nodes.length; next += 1) {
      if (
        next === current ||
        visited[next] ||
        routeSegmentCrossesBuilding(nodes[current], nodes[next], obstacle)
      ) {
        continue;
      }

      const candidate =
        distances[current] + routeDistance(nodes[current], nodes[next]);
      if (candidate < distances[next]) {
        distances[next] = candidate;
        previous[next] = current;
      }
    }
  }

  if (!Number.isFinite(distances[1])) {
    const side = start.x < obstacle.left ? 0 : 1;
    return [start, routeCorners[side], routeCorners[side + 2], end];
  }

  const route: MapPoint[] = [];
  let current = 1;
  while (current !== -1) {
    route.unshift(nodes[current]);
    current = previous[current];
  }
  return route;
}

export function pointAlongRoute(route: MapPoint[], progress: number): MapPoint {
  if (route.length === 0) return { x: 0, y: 0 };
  if (route.length === 1 || progress <= 0) return route[0];
  if (progress >= 1) return route[route.length - 1];

  const segmentLengths = route.slice(1).map((point, index) =>
    routeDistance(route[index], point),
  );
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  const targetLength = totalLength * progress;
  let traversed = 0;

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index];
    if (traversed + segmentLength >= targetLength) {
      const segmentProgress =
        segmentLength === 0 ? 1 : (targetLength - traversed) / segmentLength;
      return {
        x:
          route[index].x +
          (route[index + 1].x - route[index].x) * segmentProgress,
        y:
          route[index].y +
          (route[index + 1].y - route[index].y) * segmentProgress,
      };
    }
    traversed += segmentLength;
  }

  return route[route.length - 1];
}

export function incidentMapPoint(location: string | null): MapPoint {
  const value = location?.toLowerCase() ?? "";

  if (value.includes("lot 3")) return { x: 29, y: 79 };
  if (value.includes("north")) return { x: 50, y: 8 };
  if (value.includes("east") || value.includes("receiving")) {
    return { x: 92, y: 43 };
  }
  if (value.includes("main entrance") || value.includes("main lobby")) {
    return { x: 65, y: 61 };
  }
  if (value.includes("south lot")) return { x: 75, y: 84 };
  return { x: 52, y: 68 };
}

export function responderDestination(
  location: string | null,
  guardId: string,
): MapPoint {
  const destination = incidentMapPoint(location);
  const offset = RESPONSE_OFFSETS[guardId] ?? { x: 0, y: 0 };
  const value = location?.toLowerCase() ?? "";

  if (value.includes("east") || value.includes("receiving")) {
    return {
      x: 95,
      y: Math.max(5, Math.min(95, destination.y + offset.y)),
    };
  }

  if (value.includes("north")) {
    return {
      x: Math.max(5, Math.min(95, destination.x + offset.x)),
      y: 7,
    };
  }

  return {
    x: Math.max(3, Math.min(97, destination.x + offset.x)),
    y: Math.max(3, Math.min(97, destination.y + offset.y)),
  };
}
