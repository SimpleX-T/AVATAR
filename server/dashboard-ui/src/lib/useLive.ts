// Port of app.js state sync: WS /ws/dashboard with 5 s retry, telemetry
// dedupe (cap 120), command-status resolution incl. the early-ack race,
// 20 s full refresh, 5 s tick, visibility refresh.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  DashboardStateResponse,
  FarmResponse,
  ServerEvent,
} from "./api";
import {
  FieldState,
  HistoryPoint,
  Telemetry,
  fieldState,
  activationState,
  Farm,
} from "./model";

export interface FeedEntry {
  at: number;
  text: string;
}

export interface PendingCommand {
  action: string;
  at: number;
}

export interface LiveState {
  latest: Telemetry | null;
  history: HistoryPoint[];
  source: "local" | "thingspeak" | null;
  cloudAvailable: boolean | undefined;
  cloudError?: string;
  farm: Farm | null;
  report: Record<string, unknown> | null;
  fs: FieldState;
  activation: ReturnType<typeof activationState>;
  connected: boolean;
  feed: FeedEntry[];
  pending: Map<string, PendingCommand>;
  now: number;
  refresh: () => Promise<void>;
  setFeed: (text: string) => void;
  commandResult: { status: import("./api").CommandStatus; at: number } | null;
  enqueue: (commandId: string, action: string) => void;
}

const HISTORY_CAP = 120;
const FEED_CAP = 80;
const PENDING_TTL_MS = 70_000;

export function useLive(): LiveState {
  const [latest, setLatest] = useState<Telemetry | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [source, setSource] = useState<"local" | "thingspeak" | null>(null);
  const [cloudAvailable, setCloudAvailable] = useState<boolean | undefined>(
    undefined,
  );
  const [cloudError, setCloudError] = useState<string | undefined>();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [connected, setConnected] = useState(false);
  const [feed, setFeedEntries] = useState<FeedEntry[]>([]);
  const [pending, setPending] = useState<Map<string, PendingCommand>>(
    new Map(),
  );
  const [now, setNow] = useState(Date.now());

  const lastEventRef = useRef<string | null>(null);
  const lastSocketAt = useRef(0);
  const requestBusy = useRef(false);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const setFeed = useCallback((text: string) => {
    setFeedEntries((prev) => {
      const at = Date.now();
      if (prev[0]?.text === text) return prev;
      return [{ at, text }, ...prev].slice(0, FEED_CAP);
    });
  }, []);

  const acceptTelemetry = useCallback(
    (record: Telemetry) => {
      setLatest(record);
      setSource("local");
      setHistory((prev) => {
        if (prev.some((t) => t.receivedAt === record.receivedAt)) return prev;
        return [...prev, record as HistoryPoint].slice(-HISTORY_CAP);
      });
      const event = record.outputs?.lastEvent;
      if (event && event !== "BOOT" && event !== lastEventRef.current) {
        lastEventRef.current = event;
        setFeed(`Field event: ${event.replaceAll("_", " ").toLowerCase()}`);
      } else if (!event) {
        lastEventRef.current = null;
      }
    },
    [setFeed],
  );

  const refresh = useCallback(async () => {
    if (requestBusy.current) return;
    requestBusy.current = true;
    try {
      const [state, farmResp] = await Promise.all([
        api<DashboardStateResponse>("/api/state"),
        api<FarmResponse>("/api/farm"),
      ]);
      if (state.latest) {
        setLatest(state.latest);
        setSource(state.source);
        setCloudAvailable(state.cloudAvailable);
        setCloudError(state.cloudError);
        const freshHistory = state.history || [];
        if (freshHistory.length > 0) setHistory(freshHistory);
        const event = state.latest.outputs?.lastEvent;
        if (event && event !== "BOOT") lastEventRef.current ??= event;
      } else {
        setCloudAvailable(state.cloudAvailable);
        setCloudError(state.cloudError);
      }
      setFarm(farmResp.farm);
      setReport(farmResp.report);
    } catch {
      /* surfaced through api() / offline banner */
    } finally {
      requestBusy.current = false;
    }
  }, []);

  // Bootstrap + polling intervals.
  useEffect(() => {
    void refresh();
    const tick = setInterval(() => {
      setNow(Date.now());
      // Expire pending commands older than 70 s.
      const stale: string[] = [];
      for (const [id, p] of pendingRef.current) {
        if (Date.now() - p.at > PENDING_TTL_MS) stale.push(id);
      }
      if (stale.length) {
        setPending((prev) => {
          const next = new Map(prev);
          for (const id of stale) next.delete(id);
          return next;
        });
        setFeed("Command timed out without a field acknowledgement");
      }
    }, 5_000);
    const poll = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 20_000);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    window.addEventListener("offline", onVisible);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      window.removeEventListener("offline", onVisible);
    };
  }, [refresh, setFeed]);

  // Dashboard WebSocket with early-ack race handling.
  useEffect(() => {
    let socket: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (closed) return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${proto}://${location.host}/ws/dashboard`);
      socket.onopen = () => {
        setConnected(true);
        lastSocketAt.current = Date.now();
      };
      socket.onmessage = (message) => {
        lastSocketAt.current = Date.now();
        let parsed: ServerEvent;
        try {
          parsed = JSON.parse(message.data) as ServerEvent;
        } catch {
          return;
        }
        if (parsed.event === "telemetry") {
          acceptTelemetry(parsed.payload as Telemetry);
        } else if (parsed.event === "farm-updated") {
          void refresh();
        } else if (parsed.event === "command-status") {
          const status = parsed.payload as import("./api").CommandStatus;
          const pendingCommand = pendingRef.current.get(status.commandId);
          if (pendingCommand || status.action === "PING") {
            resolveStatus(status);
          }
        } else if (parsed.event === "alert") {
          const payload = parsed.payload as { alert?: string };
          setFeed(`Field alert: ${payload.alert?.replaceAll("_", " ").toLowerCase()}`);
        } else if (parsed.event === "alert-clear") {
          setFeed("Field alert cleared");
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 5_000);
      };
      socket.onerror = () => socket?.close();
    };

    const resolveStatus = (status: import("./api").CommandStatus) => {
      setPending((prev) => {
        if (!prev.has(status.commandId)) return prev;
        const next = new Map(prev);
        next.delete(status.commandId);
        return next;
      });
      if (status.action === "SET_PROFILE") void refresh();
      setFeed(
        status.applied
          ? `Field unit applied ${status.action.replaceAll("_", " ").toLowerCase()}`
          : status.error || "Field unit rejected the command",
      );
      setCommandResult({
        status,
        at: Date.now(),
      });
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [acceptTelemetry, refresh, setFeed]);

  const [commandResult, setCommandResult] = useState<{
    status: import("./api").CommandStatus;
    at: number;
  } | null>(null);

  const enqueue = useCallback(
    (commandId: string, action: string) => {
      setPending((prev) =>
        new Map(prev).set(commandId, { action, at: Date.now() }),
      );
    },
    [],
  );

  const fs = fieldState(latest, now);
  const activation = activationState(farm, latest, now);

  return {
    latest,
    history,
    source,
    cloudAvailable,
    cloudError,
    farm,
    report,
    fs,
    activation,
    connected: connected && Date.now() - lastSocketAt.current < 150_000,
    feed,
    pending,
    now,
    refresh,
    setFeed,
    commandResult,
    enqueue,
  };
}
