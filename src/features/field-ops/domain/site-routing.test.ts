import { describe, expect, it } from "vitest";

import {
  buildSiteRoute,
  pointAlongRoute,
  responderDestination,
  routeTravelDuration,
  routeSegmentCrossesBuilding,
} from "./site-routing";

describe("site routing", () => {
  it("routes a north-perimeter officer around the warehouse", () => {
    const route = buildSiteRoute(
      { x: 22, y: 19 },
      responderDestination("Loading zone", "G-01"),
    );

    expect(route.length).toBeGreaterThan(2);
    expect(
      route
        .slice(1)
        .every((point, index) =>
          !routeSegmentCrossesBuilding(route[index], point),
        ),
    ).toBe(true);
  });

  it("keeps an unobstructed loading-zone response direct", () => {
    const route = buildSiteRoute(
      { x: 43, y: 71 },
      responderDestination("Loading zone", "G-03"),
    );

    expect(route).toHaveLength(2);
  });

  it("moves a marker along the same route geometry", () => {
    const route = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];

    expect(pointAlongRoute(route, 0.75)).toEqual({ x: 10, y: 5 });
  });

  it("derives travel time from the route instead of the officer", () => {
    const shortRoute = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    const longRoute = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
    ];

    expect(routeTravelDuration(shortRoute)).toBeLessThan(
      routeTravelDuration(longRoute),
    );
  });

  it("keeps every officer-to-zone route outside the warehouse clearance", () => {
    const officers = [
      { id: "G-01", position: { x: 22, y: 19 } },
      { id: "G-02", position: { x: 64, y: 61 } },
      { id: "G-03", position: { x: 43, y: 71 } },
      { id: "G-04", position: { x: 78, y: 82 } },
    ];
    const locations = [
      "Loading zone",
      "Lot 3",
      "North perimeter",
      "East entrance",
      "Receiving dock",
      "Main entrance",
      "South lot",
    ];

    for (const officer of officers) {
      for (const location of locations) {
        const route = buildSiteRoute(
          officer.position,
          responderDestination(location, officer.id),
        );
        expect(
          route
            .slice(1)
            .every((point, index) =>
              !routeSegmentCrossesBuilding(route[index], point),
            ),
          `${officer.id} route to ${location}`,
        ).toBe(true);
      }
    }
  });
});
