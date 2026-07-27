type Severity = "Critical" | "High" | "Medium" | "Low";

export type IncidentCategory =
  | "Unauthorized access"
  | "Medical emergency"
  | "Unattended item"
  | "Safety hazard"
  | "Suspicious activity"
  | "Assistance request"
  | "Routine observation";

type Evidence = {
  field: string;
  value: string;
  source: string;
  confidence: number;
};

export type IncidentReport = {
  id: string;
  transcript: string;
  analysisMode: "OpenAI" | "Deterministic fallback";
  detectedLanguage: "English" | "Spanish";
  category: IncidentCategory;
  severity: Severity;
  location: string | null;
  subject: string;
  time: string;
  actionTaken: string | null;
  summary: string;
  recommendation: string;
  confidence: number;
  evidence: Evidence[];
  missingFields: string[];
  policy: string;
  createdAt: string;
};

export type AiIncidentExtraction = {
  detectedLanguage: "English" | "Spanish";
  category: IncidentCategory;
  location: string | null;
  subject: string | null;
  time: string | null;
  actionTaken: string | null;
  evidence: {
    incidentTypeQuote: string | null;
    locationQuote: string | null;
    subjectQuote: string | null;
    timeQuote: string | null;
    actionQuote: string | null;
  };
};

export type DemoScenario = {
  id: string;
  label: string;
  eyebrow: string;
  transcript: string;
  language: "en-US" | "es-US";
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "vehicle",
    label: "Unauthorized vehicle",
    eyebrow: "Loading gate · High priority",
    transcript:
      "A blue Honda entered through the loading gate without authorization. The driver says he has a 2 a.m. delivery. I asked him to hold position and notified dispatch.",
    language: "en-US",
  },
  {
    id: "spanish",
    label: "Reporte en español",
    eyebrow: "East entrance · Bilingual",
    transcript:
      "Hay una mochila abandonada en la entrada este. Nadie la ha tocado y mantuve a las personas alejadas del área.",
    language: "es-US",
  },
  {
    id: "medical",
    label: "Medical emergency",
    eyebrow: "Receiving dock · Critical",
    transcript:
      "A delivery driver collapsed near the receiving dock and is not responding. I called emergency services and cleared space around him.",
    language: "en-US",
  },
];

const locationMatchers: Array<[RegExp, string]> = [
  [/\bloading gate\b/i, "Loading gate"],
  [/\breceiving dock\b/i, "Receiving dock"],
  [/\bnorth perimeter\b/i, "North perimeter"],
  [/\bnorth gate\b/i, "North gate"],
  [/\bsouth (?:parking )?lot\b/i, "South lot"],
  [/\b(?:parking )?lot 3\b/i, "Lot 3"],
  [/\beast entrance\b/i, "East entrance"],
  [/\bmain lobby\b/i, "Main lobby"],
  [/\b(?:parking\s+)?lot\b/i, "Parking lot"],
  [/\bentrada este\b/i, "East entrance"],
  [/\bmuelle de recepci[oó]n\b/i, "Receiving dock"],
  [/\bpuerta norte\b/i, "North gate"],
  [/\bvest[ií]bulo principal\b/i, "Main lobby"],
];

const actionMatchers: Array<[RegExp, string]> = [
  [
    /\b(?:needs?|request(?:ing|ed)?)\s+(?:immediate\s+)?support\b/i,
    "Officer assistance requested",
  ],
  [
    /\b(?:need(?:s)?|send|request(?:ing|ed)?)\s+(?:(?:additional|all)\s+)?(?:officer|officers|backup)\b/i,
    "Officer assistance requested",
  ],
  [
    /\b(?:asked (?:him|her|them) to hold|hold position|mantuve .* alejadas|kept .* away)\b/i,
    "Secured the immediate area",
  ],
  [
    /\b(?:called emergency services|called 911|llam[eé] (?:a )?emergencias)\b/i,
    "Emergency services contacted",
  ],
  [
    /\b(?:notified dispatch|notified (?:the )?supervisor|avis[eé] (?:a )?(?:despacho|supervisor))\b/i,
    "Dispatch notified",
  ],
  [
    /\b(?:cleared space|established a perimeter|cordoned off)\b/i,
    "Safety perimeter established",
  ],
];

const includesAny = (value: string, terms: string[]) =>
  terms.some((term) => value.includes(term));

function detectLanguage(transcript: string): "English" | "Spanish" {
  const normalized = transcript.toLowerCase();
  const spanishSignals = [
    " hay ",
    " una ",
    " nadie ",
    " entrada ",
    " mantuve ",
    " personas ",
    " mochila ",
    " alejadas ",
    " vehículo ",
    " emergencia ",
  ];

  return spanishSignals.some((signal) => ` ${normalized} `.includes(signal))
    ? "Spanish"
    : "English";
}

function detectCategory(transcript: string): IncidentCategory {
  const value = transcript.toLowerCase();

  if (
    /\b(?:need(?:s)?|send|request(?:ing|ed)?)\s+(?:(?:additional|all)\s+)?(?:officer|officers|backup)\b/i.test(
      transcript,
    )
  ) {
    return "Assistance request";
  }

  if (
    includesAny(value, [
      "collapsed",
      "not responding",
      "unconscious",
      "medical",
      "injured",
      "emergency services",
      "no responde",
      "herido",
      "emergencia médica",
    ])
  ) {
    return "Medical emergency";
  }

  if (
    includesAny(value, [
      "backpack",
      "bag",
      "package",
      "mochila",
      "bolsa",
      "paquete",
    ]) &&
    includesAny(value, ["unattended", "abandoned", "abandonada", "sin dueño"])
  ) {
    return "Unattended item";
  }

  if (
    includesAny(value, [
      "without authorization",
      "forced through",
      "breach",
      "trespass",
      "unauthorized",
      "sin autorización",
      "no autorizado",
    ])
  ) {
    return "Unauthorized access";
  }

  if (
    includesAny(value, [
      "fire",
      "smoke",
      "spill",
      "broken glass",
      "hazard",
      "humo",
      "incendio",
      "derrame",
    ])
  ) {
    return "Safety hazard";
  }

  if (
    includesAny(value, [
      "suspicious",
      "watching",
      "circling",
      "taking photos",
      "sospechoso",
      "merodeando",
    ])
  ) {
    return "Suspicious activity";
  }

  if (
    includesAny(value, [
      "need officer",
      "needs officer",
      "need additional officer",
      "send officer",
      "requesting officer",
      "requesting backup",
      "need backup",
      "needs support",
      "need support",
      "needs immediate support",
      "requesting support",
      "necesito un oficial",
      "necesitamos oficiales",
      "envíen oficiales",
    ])
  ) {
    return "Assistance request";
  }

  return "Routine observation";
}

function detectSeverity(
  transcript: string,
  category: IncidentCategory,
): Severity {
  const value = transcript.toLowerCase();

  if (
    includesAny(value, [
      "weapon",
      "gun",
      "knife",
      "shots",
      "fire",
      "not responding",
      "unconscious",
      "arma",
      "disparos",
      "no responde",
    ]) ||
    category === "Medical emergency"
  ) {
    return "Critical";
  }

  if (
    category === "Unauthorized access" ||
    category === "Unattended item" ||
    includesAny(value, ["forced", "threat", "amenaza"])
  ) {
    return "High";
  }

  if (
    category === "Safety hazard" ||
    category === "Suspicious activity"
  ) {
    return "Medium";
  }

  if (category === "Assistance request") {
    return includesAny(value, [
      "officers",
      "additional officers",
      "backup",
      "immediate support",
      "oficiales",
    ])
      ? "High"
      : "Medium";
  }

  return "Low";
}

function detectLocation(transcript: string): string | null {
  const numberedLot = transcript.match(
    /\b(?:parking\s+)?(?:lot|locked)\s*(?:number|#)?\s*(\d+|one|two|three|tree|four|five|six)\b/i,
  );
  if (numberedLot?.[1]) {
    const lotNumbers: Record<string, string> = {
      one: "1",
      two: "2",
      three: "3",
      tree: "3",
      four: "4",
      five: "5",
      six: "6",
    };
    const number =
      lotNumbers[numberedLot[1].toLowerCase()] ?? numberedLot[1];
    return `Lot ${number}`;
  }

  const officerPostMatchers: Array<[RegExp, string]> = [
    [/\b(?:officer\s+)?chen\b/i, "Loading zone"],
    [/\b(?:officer\s+)?davis\b/i, "Main entrance"],
    [/\b(?:officer\s+)?lee\b/i, "North perimeter"],
    [/\b(?:officer\s+)?rivera\b/i, "South lot"],
  ];
  const officerPost = officerPostMatchers.find(([pattern]) =>
    pattern.test(transcript),
  );
  if (officerPost) return officerPost[1];

  const match = locationMatchers.find(([pattern]) => pattern.test(transcript));
  return match?.[1] ?? null;
}

function detectAction(transcript: string): string | null {
  const matches = actionMatchers
    .filter(([pattern]) => pattern.test(transcript))
    .map(([, action]) => action);

  return matches.length > 0 ? matches.join(" · ") : null;
}

function detectTime(transcript: string): string {
  const explicit = transcript.match(
    /\b(?:at\s*)?(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\b/i,
  );
  return explicit?.[1]?.replace(/\./g, "").toUpperCase() ?? "Just now";
}

function detectSubject(
  transcript: string,
  category: IncidentCategory,
): string {
  const value = transcript.toLowerCase();
  const colors = [
    "blue",
    "black",
    "white",
    "red",
    "silver",
    "gray",
    "grey",
    "azul",
    "negro",
    "blanco",
    "rojo",
  ];
  const vehicles = ["Honda", "Toyota", "Ford", "truck", "van", "SUV", "vehicle"];
  const color = colors.find((candidate) => value.includes(candidate));
  const vehicle = vehicles.find((candidate) =>
    value.includes(candidate.toLowerCase()),
  );
  const officer = transcript.match(
    /\b(?:officer\s+)?(Chen|Davis|Lee|Rivera)\b/i,
  );

  if (category === "Assistance request" && officer?.[1]) {
    return `Officer ${
      officer[1][0].toUpperCase() + officer[1].slice(1).toLowerCase()
    }`;
  }

  if (vehicle) {
    return `${color ? `${color[0].toUpperCase()}${color.slice(1)} ` : ""}${vehicle}`;
  }

  if (category === "Unattended item") {
    return value.includes("mochila") || value.includes("backpack")
      ? "Unattended backpack"
      : "Unattended item";
  }

  if (category === "Medical emergency") {
    return value.includes("delivery driver")
      ? "Delivery driver"
      : "Person requiring medical assistance";
  }

  return "Subject not identified";
}

function recommendationFor(
  category: IncidentCategory,
  severity: Severity,
): string {
  if (severity === "Critical") {
    return "Escalate immediately. Maintain scene safety, keep dispatch updated, and preserve a clear route for emergency response.";
  }

  if (category === "Unattended item") {
    return "Maintain distance, prevent access to the area, and notify the site supervisor for escalation.";
  }

  if (category === "Unauthorized access") {
    return "Keep the subject in view from a safe position, verify credentials, and request supervisor review.";
  }

  if (category === "Safety hazard") {
    return "Isolate the affected area and notify facilities or emergency response according to site policy.";
  }

  if (category === "Suspicious activity") {
    return "Continue observation from a safe distance and document identifying details without confronting the subject.";
  }

  if (category === "Assistance request") {
    return "Route the required officers to the stated location and keep the requesting officer updated.";
  }

  return "Document the observation and continue the assigned patrol unless conditions change.";
}

function policyFor(
  category: IncidentCategory,
  severity: Severity,
): string {
  if (severity === "Critical") return "LIFE-01 · Immediate escalation";
  if (category === "Unauthorized access")
    return "ACCESS-04 · Unverified site entry";
  if (category === "Unattended item")
    return "SITE-07 · Unattended object";
  if (category === "Safety hazard") return "SAFETY-03 · Hazard isolation";
  if (category === "Suspicious activity")
    return "OBS-02 · Suspicious behavior";
  if (category === "Assistance request")
    return "RESP-02 · Officer assistance";
  return "OPS-01 · Routine documentation";
}

function evidenceSnippet(
  transcript: string,
  expression: RegExp,
  fallback: string,
): string {
  const match = transcript.match(expression);
  return match?.[0] ?? fallback;
}

export function analyzeIncident(
  transcript: string,
  now = new Date(),
): IncidentReport {
  return buildIncidentReport(transcript, null, now);
}

function normalizedQuote(
  transcript: string,
  quote: string | null | undefined,
): string | null {
  if (!quote) return null;

  const cleanQuote = quote.trim().replace(/\s+/g, " ");
  return cleanQuote.length > 0 &&
    transcript.toLocaleLowerCase().includes(cleanQuote.toLocaleLowerCase())
    ? cleanQuote
    : null;
}

function normalizedValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleanValue = value.trim().replace(/\s+/g, " ");
  return cleanValue.length > 0 ? cleanValue : null;
}

function buildIncidentReport(
  transcript: string,
  extraction: AiIncidentExtraction | null,
  now: Date,
): IncidentReport {
  const cleanTranscript = transcript.trim().replace(/\s+/g, " ");
  const incidentTypeQuote = normalizedQuote(
    cleanTranscript,
    extraction?.evidence.incidentTypeQuote,
  );
  const locationQuote = normalizedQuote(
    cleanTranscript,
    extraction?.evidence.locationQuote,
  );
  const subjectQuote = normalizedQuote(
    cleanTranscript,
    extraction?.evidence.subjectQuote,
  );
  const timeQuote = normalizedQuote(
    cleanTranscript,
    extraction?.evidence.timeQuote,
  );
  const actionQuote = normalizedQuote(
    cleanTranscript,
    extraction?.evidence.actionQuote,
  );

  const detectedLanguage =
    extraction?.detectedLanguage ?? detectLanguage(cleanTranscript);
  const category =
    extraction && incidentTypeQuote
      ? extraction.category
      : detectCategory(cleanTranscript);
  const severity = detectSeverity(cleanTranscript, category);
  const location =
    extraction && locationQuote
      ? normalizedValue(extraction.location)
      : detectLocation(cleanTranscript);
  const actionTaken =
    extraction && actionQuote
      ? normalizedValue(extraction.actionTaken)
      : detectAction(cleanTranscript);
  const subject =
    extraction && subjectQuote
      ? normalizedValue(extraction.subject) ??
        detectSubject(cleanTranscript, category)
      : detectSubject(cleanTranscript, category);
  const time =
    extraction && timeQuote
      ? normalizedValue(extraction.time) ?? detectTime(cleanTranscript)
      : detectTime(cleanTranscript);
  const missingFields: string[] = [];

  if (!location) missingFields.push("Exact location");
  if (
    ["Critical", "High"].includes(severity) &&
    !actionTaken &&
    !["Routine observation", "Assistance request"].includes(category)
  ) {
    missingFields.push("Immediate action taken");
  }

  const evidence: Evidence[] = [
    {
      field: "Incident type",
      value: category,
      source:
        incidentTypeQuote ??
        evidenceSnippet(
          cleanTranscript,
          /(without authorization|collapsed|not responding|unattended|abandoned|abandonada|suspicious|fire|smoke|spill|need(?:s)? officers?|requesting backup)/i,
          "Overall statement",
        ),
      confidence: category === "Routine observation" ? 0.72 : 0.96,
    },
    {
      field: "Location",
      value: location ?? "Not provided",
      source: location
        ? locationQuote ??
          evidenceSnippet(
            cleanTranscript,
            /(loading gate|loading zone|receiving dock|north perimeter|north gate|east entrance|main entrance|main lobby|south lot|(?:parking\s+)?(?:lot|locked)\s*(?:number|#)?\s*(?:\d+|one|two|three|tree|four|five|six)?|(?:officer\s+)?(?:chen|davis|lee|rivera)|entrada este|muelle de recepción|puerta norte|vestíbulo principal)/i,
            location,
          )
        : "No location language detected",
      confidence: location ? 0.98 : 0,
    },
    {
      field: "Subject",
      value: subject,
      source:
        subject === "Subject not identified"
          ? "No identifying details provided"
          : subjectQuote ??
            evidenceSnippet(
              cleanTranscript,
              /(blue|black|white|red|silver|gray|grey|azul|negro|blanco|rojo)?\s*(Honda|Toyota|Ford|truck|van|SUV|vehicle|delivery driver|backpack|mochila)|(?:officer\s+)?(?:chen|davis|lee|rivera)/i,
              subject,
            ),
      confidence: subject === "Subject not identified" ? 0 : 0.91,
    },
    {
      field: "Action taken",
      value: actionTaken ?? "Not provided",
      source: actionTaken
        ? actionQuote ??
          evidenceSnippet(
            cleanTranscript,
            /(hold position|notified dispatch|called emergency services|cleared space|mantuve .* alejadas|need(?:s)? (?:all |additional )?officers?|requesting backup|needs? (?:immediate )?support)/i,
            actionTaken,
          )
        : "No response action detected",
      confidence: actionTaken ? 0.93 : 0,
    },
  ];

  const supportedFields = evidence.filter((item) => item.confidence > 0).length;
  const confidence = Math.round(
    Math.max(64, 76 + supportedFields * 5 - missingFields.length * 9),
  );

  const locationPhrase = location ? ` at the ${location.toLowerCase()}` : "";
  const summary = `${category}${locationPhrase}. ${subject}. ${
    actionTaken ? `${actionTaken}.` : "Immediate response not yet documented."
  }`;

  return {
    id: `INC-${now.getTime().toString().slice(-6)}`,
    transcript: cleanTranscript,
    analysisMode: extraction ? "OpenAI" : "Deterministic fallback",
    detectedLanguage,
    category,
    severity,
    location,
    subject,
    time,
    actionTaken,
    summary,
    recommendation: recommendationFor(category, severity),
    confidence,
    evidence,
    missingFields,
    policy: policyFor(category, severity),
    createdAt: now.toISOString(),
  };
}

export function analyzeIncidentWithExtraction(
  transcript: string,
  extraction: AiIncidentExtraction,
  now = new Date(),
): IncidentReport {
  return buildIncidentReport(transcript, extraction, now);
}

export type EvaluationResult = {
  name: string;
  checks: Array<{ label: string; passed: boolean }>;
};

const EVALUATION_CASES = [
  {
    name: "Unauthorized vehicle",
    input:
      "A blue Honda entered through the loading gate without authorization. I notified dispatch.",
    expected: {
      category: "Unauthorized access",
      severity: "High",
      location: "Loading gate",
    },
  },
  {
    name: "Spanish unattended item",
    input:
      "Hay una mochila abandonada en la entrada este. Mantuve a las personas alejadas.",
    expected: {
      category: "Unattended item",
      severity: "High",
      language: "Spanish",
    },
  },
  {
    name: "Medical escalation",
    input:
      "A delivery driver collapsed at the receiving dock and is not responding. I called emergency services.",
    expected: {
      category: "Medical emergency",
      severity: "Critical",
      location: "Receiving dock",
    },
  },
  {
    name: "Missing-location restraint",
    input:
      "A suspicious person is taking photos of employee badges. I notified the supervisor.",
    expected: {
      category: "Suspicious activity",
      severity: "Medium",
      missingLocation: true,
    },
  },
  {
    name: "Critical weapon policy",
    input:
      "A person with a knife is threatening a driver at the north gate. I called 911.",
    expected: {
      severity: "Critical",
      location: "North gate",
      policy: "LIFE-01 · Immediate escalation",
    },
  },
  {
    name: "Routine observation",
    input:
      "A delivery was completed at the main lobby. The visitor departed normally.",
    expected: {
      category: "Routine observation",
      severity: "Low",
      location: "Main lobby",
    },
  },
  {
    name: "Lot 3 officer request",
    input: "Needs officers in Lot 3.",
    expected: {
      category: "Assistance request",
      severity: "High",
      location: "Lot 3",
    },
  },
  {
    name: "Named officer support request",
    input: "Officer Chen needs immediate support.",
    expected: {
      category: "Assistance request",
      severity: "High",
      location: "Loading zone",
    },
  },
  {
    name: "Full-roster north perimeter request",
    input: "Need all officers in the north perimeter.",
    expected: {
      category: "Assistance request",
      severity: "High",
      location: "North perimeter",
    },
  },
] as const;

export function runEvaluationSuite(): EvaluationResult[] {
  return EVALUATION_CASES.map((testCase) => {
    const result = analyzeIncident(
      testCase.input,
      new Date("2026-07-26T12:00:00Z"),
    );
    const expected = testCase.expected;
    const checks: Array<{ label: string; passed: boolean }> = [];

    if ("category" in expected) {
      checks.push({
        label: `Classifies ${expected.category}`,
        passed: result.category === expected.category,
      });
    }

    if ("severity" in expected) {
      checks.push({
        label: `Assigns ${expected.severity} severity`,
        passed: result.severity === expected.severity,
      });
    }

    if ("location" in expected) {
      checks.push({
        label: `Extracts ${expected.location}`,
        passed: result.location === expected.location,
      });
    }

    if ("language" in expected) {
      checks.push({
        label: `Detects ${expected.language}`,
        passed: result.detectedLanguage === expected.language,
      });
    }

    if ("missingLocation" in expected) {
      checks.push({
        label: "Does not invent a location",
        passed:
          result.location === null &&
          result.missingFields.includes("Exact location"),
      });
    }

    if ("policy" in expected) {
      checks.push({
        label: "Selects immediate escalation policy",
        passed: result.policy === expected.policy,
      });
    }

    while (checks.length < 3) {
      checks.push({
        label:
          checks.length === 2
            ? "Produces an auditable evidence trail"
            : "Returns a structured incident",
        passed:
          result.evidence.length >= 4 &&
          result.summary.length > 0 &&
          result.id.startsWith("INC-"),
      });
    }

    return { name: testCase.name, checks: checks.slice(0, 3) };
  });
}
