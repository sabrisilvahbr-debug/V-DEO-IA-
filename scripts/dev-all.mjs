// Inicia o servidor Next (desenvolvimento) e o worker da fila juntos.
// Ctrl+C encerra os dois.
import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [
  spawn(npm, ["run", "dev"], { stdio: "inherit", shell: process.platform === "win32" }),
  spawn(npm, ["run", "worker"], { stdio: "inherit", shell: process.platform === "win32" }),
];

let exiting = false;
function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  for (const child of children) if (!child.killed) child.kill("SIGINT");
  setTimeout(() => process.exit(code), 3000).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
for (const child of children) child.on("exit", (code) => shutdown(code ?? 0));
