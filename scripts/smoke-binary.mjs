// Teste de fumaça das operações com arquivos binários, contra o app rodando.
//
//   npm run dev:all          (em outro terminal)
//   npm run test:smoke       (BASE_URL=http://localhost:3000 por padrão)
//
// Gera um arquivo de cada formato com o FFmpeg, envia pela API, confere o
// download byte a byte, leitura parcial (Range), miniaturas, rejeições,
// exportação 9:16 pelo worker e transformação MOCK. Cria um projeto
// "Teste binário HTTP" no seu banco (pode excluir depois).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const dir = mkdtempSync(path.join(tmpdir(), "cinemorph-smoke-")) + path.sep;
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));

const ff = (...args) => execFileSync(process.env.FFMPEG_PATH || "ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
const V = ["-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=25:duration=3", "-f", "lavfi", "-i", "sine=frequency=440:duration=3"];
const H264 = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest"];
try {
  ff(...V, ...H264, dir + "video.mp4");
  ff(...V, ...H264, dir + "video.mov");
  ff(...V, "-c:v", "libvpx", "-b:v", "500k", "-c:a", "libvorbis", "-shortest", dir + "video.webm");
  ff(...V, ...H264, dir + "video.mkv");
  ff("-f", "lavfi", "-i", "testsrc2=size=1080x1920", "-frames:v", "1", dir + "vertical.png");
  ff("-f", "lavfi", "-i", "testsrc2=size=800x600", "-frames:v", "1", dir + "foto.jpg");
  ff("-f", "lavfi", "-i", "testsrc2=size=800x600", "-frames:v", "1", "-c:v", "libwebp", dir + "foto.webp");
  ff("-f", "lavfi", "-i", "sine=frequency=330:duration=4", dir + "som.mp3");
  ff("-f", "lavfi", "-i", "sine=frequency=330:duration=4", dir + "som.wav");
  ff("-f", "lavfi", "-i", "sine=frequency=330:duration=4", "-c:a", "aac", dir + "som.m4a");
  ff("-f", "lavfi", "-i", "testsrc2=size=5000x400:rate=1:duration=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", dir + "largo-demais.mp4");
} catch (error) {
  console.error("Não foi possível gerar os arquivos de teste com o FFmpeg:", error.message);
  process.exit(1);
}
writeFileSync(dir + "falso.mp4", "texto qualquer");
writeFileSync(dir + "truncado.mp4", readFileSync(dir + "video.mp4").subarray(0, 700));
writeFileSync(dir + "vazio.mp4", Buffer.alloc(0));

try {
  await fetch(BASE);
} catch {
  console.error(`O app não está respondendo em ${BASE}. Rode "npm run dev:all" em outro terminal.`);
  process.exit(1);
}
let pass = 0;
let fail = 0;
const check = (ok, label, extra = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`);
};
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

const project = await (await fetch(`${BASE}/api/projects`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "Teste binário HTTP", aspectRatio: "16:9" }),
})).json();
const projectId = project.project.id;
check(Boolean(projectId), "projeto criado pela API", projectId);

async function upload(name, { rights = true, role = "source" } = {}) {
  const params = new URLSearchParams({ projectId, role, name });
  if (rights) params.set("rights", "1");
  const res = await fetch(`${BASE}/api/uploads?${params}`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: readFileSync(dir + name),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const accepted = {
  "video.mp4": ["video", "video/mp4"],
  "video.mov": ["video", "video/quicktime"],
  "video.webm": ["video", "video/webm"],
  "video.mkv": ["video", "video/x-matroska"],
  "vertical.png": ["image", "image/png"],
  "foto.jpg": ["image", "image/jpeg"],
  "foto.webp": ["image", "image/webp"],
  "som.mp3": ["audio", "audio/mpeg"],
  "som.wav": ["audio", "audio/wav"],
  "som.m4a": ["audio", "audio/mp4"],
};

for (const [name, [kind, mime]] of Object.entries(accepted)) {
  const original = readFileSync(dir + name);
  const { status, body } = await upload(name);
  const asset = body?.asset;
  check(status === 201 && asset?.kind === kind && asset?.mimeType === mime, `upload ${name}`, `${status} ${asset?.kind} ${asset?.mimeType}`);
  if (!asset) continue;

  // Download completo idêntico ao original
  const full = await fetch(`${BASE}/api/media/${asset.id}?download=1`);
  const downloaded = Buffer.from(await full.arrayBuffer());
  check(
    full.status === 200 && sha(downloaded) === sha(original) && full.headers.get("content-disposition")?.startsWith("attachment"),
    `  download ${name} idêntico (sha256)`,
    `${downloaded.length} bytes`,
  );

  // Leitura parcial (Range) — usada pelo player para avançar no vídeo
  const mid = Math.floor(original.length / 2);
  const ranged = await fetch(`${BASE}/api/media/${asset.id}`, { headers: { Range: `bytes=${mid}-${mid + 1023}` } });
  const part = Buffer.from(await ranged.arrayBuffer());
  check(
    ranged.status === 206 && part.equals(original.subarray(mid, mid + 1024)) && ranged.headers.get("content-range") === `bytes ${mid}-${mid + 1023}/${original.length}`,
    `  range ${name} (bytes do meio)`,
  );

  // Miniatura JPEG para vídeo e imagem
  if (kind !== "audio") {
    const thumb = await fetch(`${BASE}/api/media/${asset.id}?variant=thumb`);
    const t = Buffer.from(await thumb.arrayBuffer());
    check(thumb.status === 200 && t[0] === 0xff && t[1] === 0xd8, `  miniatura ${name} é JPEG`);
  }
}

// Rejeições
const rejected = [
  ["falso.mp4", 422, /Formato não reconhecido/],
  ["truncado.mp4", 422, /não pôde ser lido|faixa de vídeo|duração/],
  ["vazio.mp4", 422, /vazio/],
  ["largo-demais.mp4", 422, /Resolução 5000×400 acima do limite/],
];
for (const [name, expected, message] of rejected) {
  const { status, body } = await upload(name);
  check(status === expected && message.test(body?.error?.message ?? ""), `rejeita ${name}`, `${status} ${body?.error?.message ?? ""}`);
}
{
  const { status, body } = await upload("video.mp4", { rights: false });
  check(status === 400, "rejeita upload sem declaração de direitos", `${status} ${body?.error?.details?.[0]?.message ?? ""}`);
}
{
  // Cabeçalho declara 600 MB: o servidor deve recusar antes de ler o corpo
  const http = await import("node:http");
  const status = await new Promise((resolve) => {
    const req = http.request(`${BASE}/api/uploads?projectId=${projectId}&name=x.mp4&rights=1`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream", "content-length": String(600 * 1024 * 1024) },
    }, (res) => { resolve(res.statusCode); res.resume(); req.destroy(); });
    req.on("error", () => {});
    req.write(Buffer.alloc(64 * 1024));
  });
  check(status === 413, "recusa arquivo de 600 MB pelo cabeçalho, antes de receber", String(status));
}
{
  const res = await fetch(`${BASE}/api/media/ast_00000000000000000000000000000000`);
  check(res.status === 404, "mídia inexistente responde 404");
  const bad = await fetch(`${BASE}/api/media/..%2F..%2Fetc%2Fpasswd`);
  check(bad.status === 400, "id malicioso no caminho é recusado", String(bad.status));
}

// Exportação a partir dos binários enviados: vídeo .mov + imagem .png + trilha .wav, 9:16 alta qualidade
const list = (await (await fetch(`${BASE}/api/assets?projectId=${projectId}`)).json()).assets;
const by = (n) => list.find((a) => a.originalName === n);
const color = { brightness: 0, contrast: 1, saturation: 1 };
const timeline = {
  version: 1,
  clips: [
    { id: "a", assetId: by("video.mov").id, kind: "video", in: 0, out: 2, volume: 1, muted: false, color },
    { id: "b", assetId: by("vertical.png").id, kind: "image", in: 0, out: 1.5, volume: 1, muted: false, color },
    { id: "c", assetId: by("video.webm").id, kind: "video", in: 1, out: 3, volume: 1, muted: true, color: { brightness: 0.1, contrast: 1.2, saturation: 1.5 } },
  ],
  music: { assetId: by("som.wav").id, volume: 0.5 },
  subtitles: [{ id: "s", start: 0.5, end: 2, text: "Legenda de teste" }],
  output: { aspectRatio: "9:16", quality: "high", burnSubtitles: true },
};
const saved = await fetch(`${BASE}/api/projects/${projectId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ timeline }) });
check(saved.status === 200, "timeline salva e validada contra as mídias");

const requestId = crypto.randomUUID();
const r1 = await (await fetch(`${BASE}/api/renders`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId, clientRequestId: requestId }) })).json();
const r2 = await (await fetch(`${BASE}/api/renders`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId, clientRequestId: requestId }) })).json();
check(r1.job.id === r2.job.id && r2.created === false, "reenvio da mesma exportação não duplica a tarefa");

let job = r1.job;
const started = Date.now();
while (["queued", "running"].includes(job.status) && Date.now() - started < 180_000) {
  await new Promise((r) => setTimeout(r, 1500));
  job = (await (await fetch(`${BASE}/api/renders/${job.id}`)).json()).job;
}
check(job.status === "succeeded", "exportação concluída pelo worker", `${job.status} ${job.error ?? ""} ${Math.round((Date.now() - started) / 1000)} s`);
if (job.status === "succeeded") {
  const out = await fetch(`${BASE}/api/media/${job.output.assetId}?download=1`);
  const buf = Buffer.from(await out.arrayBuffer());
  check(buf.subarray(4, 8).toString() === "ftyp", "arquivo exportado é MP4", `${(buf.length / 1024).toFixed(0)} KB, ${job.output.width}×${job.output.height}, ${job.output.durationSeconds} s`);
}

// Geração MOCK vídeo→vídeo a partir do .mkv enviado
const gen = await (await fetch(`${BASE}/api/generations`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ projectId, mode: "video_to_video", providerId: "auto", prompt: "estilo vintage", sourceAssetId: by("video.mkv").id, aspectRatio: "16:9", durationSeconds: 2, clientRequestId: crypto.randomUUID() }),
})).json();
let g = gen.job;
while (g && ["queued", "running"].includes(g.status)) {
  await new Promise((r) => setTimeout(r, 1000));
  g = (await (await fetch(`${BASE}/api/generations/${g.id}`)).json()).job;
}
check(g?.status === "succeeded" && g.output?.isDemo === true, "transformação MOCK vídeo→vídeo a partir do .mkv (marcada como demonstração)", g?.status);

console.log(`\nResultado: ${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
