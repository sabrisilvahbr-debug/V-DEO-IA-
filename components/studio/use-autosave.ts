"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import type { Timeline } from "@/lib/domain/timeline";

export type SaveState = { status: "saved" | "pending" | "saving" | "error"; error: string | null };

/**
 * Salva a timeline automaticamente 1,2 s após a última alteração.
 * `flush()` salva imediatamente (usado antes de exportar).
 */
export function useAutosave(projectId: string, timeline: Timeline) {
  const [state, setState] = useState<SaveState>({ status: "saved", error: null });
  const lastSaved = useRef(JSON.stringify(timeline));
  const latest = useRef(timeline);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);

  const save = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) await inFlight.current;
    const snapshot = latest.current;
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSaved.current) {
      setState({ status: "saved", error: null });
      return true;
    }
    setState({ status: "saving", error: null });
    const request = api(`/api/projects/${projectId}`, { method: "PATCH", json: { timeline: snapshot } })
      .then(() => {
        lastSaved.current = serialized;
        setState(JSON.stringify(latest.current) === serialized ? { status: "saved", error: null } : { status: "pending", error: null });
        return true;
      })
      .catch((error) => {
        setState({ status: "error", error: errorMessage(error) });
        return false;
      })
      .finally(() => {
        inFlight.current = null;
      });
    inFlight.current = request;
    return request;
  }, [projectId]);

  useEffect(() => {
    latest.current = timeline;
    if (JSON.stringify(timeline) === lastSaved.current) return;
    setState((s) => (s.status === "saving" ? s : { status: "pending", error: null }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 1200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [timeline, save]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== lastSaved.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    return save();
  }, [save]);

  return { state, flush };
}
