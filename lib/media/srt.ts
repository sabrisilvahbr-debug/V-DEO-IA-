import type { Subtitle } from "@/lib/domain/timeline";

function srtTime(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number, size = 2) => String(n).padStart(size, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/** Gera um arquivo SRT ordenado, limitando as legendas à duração do vídeo. */
export function buildSrt(subtitles: Subtitle[], maxDurationSeconds = Infinity): string {
  return subtitles
    .filter((s) => s.start < maxDurationSeconds)
    .sort((a, b) => a.start - b.start)
    .map((s, index) => {
      const end = Math.min(s.end, maxDurationSeconds);
      const text = s.text.replace(/\r/g, "").trim();
      return `${index + 1}\n${srtTime(s.start)} --> ${srtTime(end)}\n${text}\n`;
    })
    .join("\n");
}
