import { NextResponse } from "next/server";

import {
  analyzeIncident,
  analyzeIncidentWithExtraction,
} from "@/src/features/field-ops/domain/incident-engine";
import { extractIncidentWithOpenAI } from "@/src/features/field-ops/server/openai-incident";

const WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 18;
const MAX_RATE_LIMIT_ENTRIES = 1_000;
const requestWindows = new Map<string, { count: number; resetAt: number }>();

function response(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function clientAddress(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}

function exceedsRateLimit(key: string): boolean {
  const now = Date.now();

  if (requestWindows.size >= MAX_RATE_LIMIT_ENTRIES) {
    for (const [address, window] of requestWindows) {
      if (window.resetAt <= now) requestWindows.delete(address);
    }

    if (requestWindows.size >= MAX_RATE_LIMIT_ENTRIES) {
      const oldestAddress = requestWindows.keys().next().value;
      if (oldestAddress) requestWindows.delete(oldestAddress);
    }
  }

  const current = requestWindows.get(key);

  if (!current || current.resetAt <= now) {
    requestWindows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > REQUESTS_PER_WINDOW;
}

async function safetyIdentifier(address: string): Promise<string> {
  const bytes = new TextEncoder().encode(`fieldops-demo:${address}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `fieldops-${hash}`;
}

async function openAIKey(): Promise<string | undefined> {
  const processKey = process.env.OPENAI_API_KEY?.trim();
  if (processKey) return processKey;

  try {
    const { env } = await import("cloudflare:workers");
    const binding = (env as Record<string, unknown>).OPENAI_API_KEY;
    return typeof binding === "string" && binding.trim()
      ? binding.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return response({ error: "Cross-origin requests are not allowed." }, 403);
  }

  const address = clientAddress(request);
  if (exceedsRateLimit(address)) {
    return response(
      { error: "Demo request limit reached. Try again in one minute." },
      429,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response({ error: "Request body must be valid JSON." }, 400);
  }

  const transcript =
    body && typeof body === "object" && "transcript" in body
      ? (body as { transcript?: unknown }).transcript
      : null;

  if (typeof transcript !== "string") {
    return response({ error: "Transcript is required." }, 400);
  }

  const cleanTranscript = transcript.trim().replace(/\s+/g, " ");
  if (cleanTranscript.length < 12 || cleanTranscript.length > 2_000) {
    return response(
      { error: "Transcript must be between 12 and 2,000 characters." },
      400,
    );
  }

  const fallbackReport = analyzeIncident(cleanTranscript);
  const apiKey = await openAIKey();

  if (!apiKey) {
    return response({
      report: fallbackReport,
      source: "fallback",
      reason: "AI extraction is not configured.",
    });
  }

  try {
    const { extraction, model } = await extractIncidentWithOpenAI({
      transcript: cleanTranscript,
      apiKey,
      safetyIdentifier: await safetyIdentifier(address),
    });

    return response({
      report: analyzeIncidentWithExtraction(cleanTranscript, extraction),
      source: "openai",
      model,
    });
  } catch {
    return response({
      report: fallbackReport,
      source: "fallback",
      reason: "AI extraction was unavailable, so the on-device rules took over.",
    });
  }
}
