// Port of app.js api() + http-response.js: 10s timeout, 401 → /auth/,
// JSON error extraction.

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(path, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.headers || {}),
        Accept: "application/json",
      },
    });
    if (response.status === 401) {
      window.location.href = "/auth/";
      throw new ApiError(401, "Signed out");
    }
    const type = response.headers.get("Content-Type") || "";
    const body = type.includes("application/json")
      ? await response.json()
      : await response.text();
    if (!response.ok) {
      const message =
        typeof body === "object" && body && "error" in (body as Record<string, unknown>)
          ? String((body as Record<string, unknown>).error)
          : `Request failed (${response.status})`;
      throw new ApiError(response.status, message);
    }
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

// ── Shared server shapes ───────────────────────────────────────────

export interface DashboardStateResponse {
  latest: import("./model").Telemetry | null;
  history: import("./model").HistoryPoint[];
  source: "local" | "thingspeak";
  cloudConfigured?: boolean;
  cloudAvailable?: boolean;
  cloudError?: string;
  pendingUpload?: boolean;
  deviceReportedRecently?: boolean;
}
export interface FarmResponse {
  farm: import("./model").Farm | null;
  report: import("./model").ReportEligibility;
}
export interface CommandStatus {
  commandId: string;
  deviceId: string;
  action: string;
  createdAt: string;
  applied?: boolean;
  acknowledgedAt?: string | null;
  error?: string | null;
}
export interface ServerEvent {
  event: string;
  payload: unknown;
}

export async function sendCommand(
  deviceId: string,
  action: string,
): Promise<CommandStatus> {
  return api("/api/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, action }),
  });
}
