import type { MapPoint } from "../domain/site-routing";

export type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  tone?: "alert" | "success";
};

export const GUARDS = [
  {
    id: "jordan-lee",
    initials: "JL",
    name: "Jordan Lee",
    post: "North perimeter",
    position: { x: 22, y: 19 },
    className: "guard-one",
  },
  {
    id: "amir-davis",
    initials: "AD",
    name: "Amir Davis",
    post: "Main entrance",
    position: { x: 64, y: 61 },
    className: "guard-two",
  },
  {
    id: "maya-chen",
    initials: "MC",
    name: "Maya Chen",
    post: "Loading zone",
    position: { x: 43, y: 71 },
    className: "guard-three",
  },
  {
    id: "luis-rivera",
    initials: "LR",
    name: "Luis Rivera",
    post: "South lot",
    position: { x: 78, y: 82 },
    className: "guard-four",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  initials: string;
  name: string;
  post: string;
  position: MapPoint;
  className: string;
}>;

export type Guard = (typeof GUARDS)[number];
export type GuardId = Guard["id"];

export const CAMERAS = [
  {
    id: 1,
    zone: "North perimeter",
    orientation: "South-facing",
    status: "No motion detected",
  },
  {
    id: 2,
    zone: "North perimeter east",
    orientation: "Southwest-facing",
    status: "No motion detected",
  },
  {
    id: 3,
    zone: "Receiving lane",
    orientation: "East-facing",
    status: "No motion detected",
  },
  {
    id: 4,
    zone: "Loading Gate B",
    orientation: "North-facing",
    status: "Motion event detected",
  },
  {
    id: 5,
    zone: "South parking lot",
    orientation: "Northwest-facing",
    status: "No motion detected",
  },
  {
    id: 6,
    zone: "Vehicle entrance",
    orientation: "East-facing",
    status: "No motion detected",
  },
] as const;

export const BASE_ACTIVITY: ActivityItem[] = [
  {
    id: "checkpoint",
    title: "Checkpoint verified",
    detail: "North perimeter · Jordan Lee",
    meta: "2m ago",
    tone: "success",
  },
  {
    id: "camera",
    title: "Camera health check",
    detail: "6 of 6 feeds online",
    meta: "5m ago",
  },
  {
    id: "briefing",
    title: "Briefing acknowledged",
    detail: "All four officers",
    meta: "18m ago",
  },
];
