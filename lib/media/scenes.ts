/**
 * Interpreta a saída do filtro `showinfo` após `select='gt(scene,X)'` e
 * devolve os instantes de mudança de cena (segundos), sem cortes muito próximos.
 */
export function parseSceneTimes(stderr: string, minGapSeconds = 0.5): number[] {
  const times: number[] = [];
  for (const match of stderr.matchAll(/pts_time:\s*([0-9.]+)/g)) {
    const t = Number(match[1]);
    if (!Number.isFinite(t) || t <= 0) continue;
    if (times.length === 0 || t - times[times.length - 1] >= minGapSeconds) times.push(Number(t.toFixed(3)));
  }
  return times;
}

/** Transforma os pontos de corte em segmentos [início, fim] do vídeo. */
export function scenesToSegments(cuts: number[], durationSeconds: number, minLength = 0.3): Array<{ in: number; out: number }> {
  const bounds = [0, ...cuts.filter((c) => c > 0 && c < durationSeconds), durationSeconds];
  const segments: Array<{ in: number; out: number }> = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    if (bounds[i + 1] - bounds[i] >= minLength) segments.push({ in: bounds[i], out: bounds[i + 1] });
  }
  return segments;
}
