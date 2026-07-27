# FieldOps interface direction

FieldOps should look like operational software used during a shift, not a
generic AI dashboard. The interface is a site canvas beside an incident desk.
Every visual element must support reporting, verification, dispatch, or review.

## Rules

- Use one workspace. Do not add a sidebar unless the product gains real
  top-level destinations.
- Prefer alignment, spacing, and dividers to nested cards.
- Write in sentence case. Use short, literal labels instead of marketing copy.
- Do not label ordinary product behavior as AI. Explain the model boundary only
  where a reviewer needs it.
- Reserve orange for an incident or action and green for a confirmed response.
- Keep surfaces square and restrained: 2–3px radii, no decorative shadows,
  glows, glass, gradients, or pulsing status dots.
- Keep interface text readable: 12px body copy, 10px metadata, and clear
  15–25px heading steps.
- Motion must communicate a state change. Respect reduced-motion preferences.
- Projected response paths and officer markers must use the same route
  geometry, with the warehouse treated as an obstacle.
- Show only real product data. Do not invent metrics to fill space.

## Interaction hierarchy

1. Understand the site and current shift.
2. Capture or load a field report.
3. Review extracted facts and the applicable policy.
4. Dispatch one or more officers.
5. Resolve the incident with a human-confirmed action.

The model structures a report. Deterministic policy evaluates severity and
routes the minimum response. A supervisor can add responders and confirms
resolution.

| Severity | Initial response |
| --- | --- |
| Low | Supervisor dispatch |
| Medium | 1 officer |
| High | 2 officers |
| Critical | 3 officers |
