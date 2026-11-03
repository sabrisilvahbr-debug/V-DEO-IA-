"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import type { PublicJob } from "./types";

const ACTIVE = new Set(["queued", "running"]);

/**
 * Acompanha as tarefas do projeto. Consulta a API a cada 2 s enquanto houver
 * tarefas ativas e avisa quando alguma termina (para recarregar mídias).
 */
export function useProjectJobs(projectId: string, initial: PublicJob[], onFinished: (job: PublicJob) => void) {
  const [jobs, setJobs] = useState(initial);
  const [pollError, setPollError] = useState(false);
  const previous = useRef(new Map(initial.map((j) => [j.id, j.status])));
  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  const refresh = useCallback(async () => {
    try {
      const { jobs: next } = await api<{ jobs: PublicJob[] }>(`/api/jobs?projectId=${projectId}&limit=30`);
      setPollError(false);
      for (const job of next) {
        const before = previous.current.get(job.id);
        if (before && ACTIVE.has(before) && !ACTIVE.has(job.status)) onFinishedRef.current(job);
      }
      previous.current = new Map(next.map((j) => [j.id, j.status]));
      setJobs(next);
    } catch {
      setPollError(true);
    }
  }, [projectId]);

  const hasActive = jobs.some((j) => ACTIVE.has(j.status));
  useEffect(() => {
    if (!hasActive) return;
    const interval = setInterval(() => void refresh(), 2000);
    return () => clearInterval(interval);
  }, [hasActive, refresh]);

  const track = useCallback((job: PublicJob) => {
    previous.current.set(job.id, job.status);
    setJobs((current) => [job, ...current.filter((j) => j.id !== job.id)]);
  }, []);

  return { jobs, hasActive, refresh, track, pollError };
}
