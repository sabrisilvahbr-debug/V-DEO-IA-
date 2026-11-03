// Verifica o ambiente antes de iniciar (npm run dev / start / worker).
// Para com uma mensagem clara quando algo impede o app de funcionar.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

if (process.env.CINEMORPH_SKIP_DOCTOR === "1") process.exit(0);

const require = createRequire(path.join(process.cwd(), "package.json"));
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const errors = [];
const warnings = [];

// 1. Node.js
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 9)) {
  errors.push(`Node.js ${process.version} é antigo demais. Instale o Node.js 22 LTS em https://nodejs.org e rode "npm install" de novo.`);
}

// 2. Dependências instaladas
const required = ["next", "react", "zod", "lucide-react", "@supabase/ssr", "tsx", "class-variance-authority"];
const missing = required.filter((name) => {
  try {
    require.resolve(`${name}/package.json`);
    return false;
  } catch {
    return !existsSync(path.join(process.cwd(), "node_modules", name));
  }
});
if (missing.length) {
  errors.push(`Dependências não instaladas (${missing.join(", ")}). Rode "npm install" nesta pasta.`);
}

// 3. Banco local
if ((process.env.CINEMORPH_BACKEND ?? "local") === "local") {
  let driver = null;
  try {
    require("node:sqlite");
    driver = "node:sqlite";
  } catch {
    try {
      const Database = require("better-sqlite3");
      new Database(":memory:").close();
      driver = "better-sqlite3";
    } catch {
      driver = null;
    }
  }
  if (!driver) {
    errors.push(
      `Nenhum banco SQLite disponível no Node ${process.version}. Atualize o Node.js para 22.13+ (recomendado) ou rode "npm install" para instalar o better-sqlite3.`,
    );
  }
}

// 4. FFmpeg (não bloqueia: as páginas abrem, mas upload/exportação não)
for (const [bin, envVar] of [["ffmpeg", "FFMPEG_PATH"], ["ffprobe", "FFPROBE_PATH"]]) {
  const exe = process.env[envVar] || bin;
  const result = spawnSync(exe, ["-version"], { stdio: "ignore" });
  if (result.error || result.status !== 0) {
    warnings.push(
      `${bin} não encontrado. Upload e exportação não vão funcionar. Instale: Windows "winget install Gyan.FFmpeg" · macOS "brew install ffmpeg" · Linux "sudo apt install ffmpeg" (depois feche e abra o terminal).`,
    );
  }
}

for (const w of warnings) console.warn(yellow(`⚠ ${w}`));
if (errors.length) {
  console.error(red("\n✖ O CINEMORPH AI não pode iniciar:\n"));
  for (const e of errors) console.error(red(`  • ${e}`));
  console.error("");
  process.exit(1);
}
console.log(green(`✓ Ambiente ok (Node ${process.version})`));
