import { createRequire } from "node:module";
import path from "node:path";
import { SetupError } from "../setup-error";

/**
 * Interface mínima comum ao `node:sqlite` (Node 22.13+) e ao `better-sqlite3`
 * (Node 20+). As duas têm a mesma forma: prepare().run/get/all, exec, close.
 */
export type SqliteValue = string | number | bigint | null | Uint8Array;

export interface SqliteStatement {
  run(...params: SqliteValue[]): { changes: number | bigint };
  get(...params: SqliteValue[]): unknown;
  all(...params: SqliteValue[]): unknown[];
}

export interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

export type SqliteDriverName = "node:sqlite" | "better-sqlite3";

type Opened = { db: SqliteDatabase; driver: SqliteDriverName };

// createRequire evita que o bundler tente empacotar os módulos (um é nativo do Node, o outro tem binário).
const load = createRequire(path.join(process.cwd(), "package.json"));

function tryNodeSqlite(file: string): Opened | null {
  try {
    const { DatabaseSync } = load("node:sqlite") as { DatabaseSync: new (file: string) => SqliteDatabase };
    return { db: new DatabaseSync(file), driver: "node:sqlite" };
  } catch {
    return null; // Node < 22.13 (ou 22.5–22.12 sem a flag)
  }
}

function tryBetterSqlite(file: string): Opened | null {
  try {
    const Database = load("better-sqlite3") as new (file: string) => SqliteDatabase;
    return { db: new Database(file), driver: "better-sqlite3" };
  } catch {
    return null;
  }
}

/**
 * Abre o banco com o primeiro driver disponível. A variável
 * CINEMORPH_SQLITE_DRIVER força um deles (útil em testes).
 */
export function openSqlite(file: string): Opened {
  const forced = process.env.CINEMORPH_SQLITE_DRIVER;
  const order =
    forced === "better-sqlite3" ? [tryBetterSqlite] : forced === "node:sqlite" ? [tryNodeSqlite] : [tryNodeSqlite, tryBetterSqlite];
  for (const attempt of order) {
    const opened = attempt(file);
    if (opened) return opened;
  }
  throw new SetupError(
    `Não foi possível abrir o banco local com o Node ${process.version}.`,
    "Atualize o Node.js para a versão 22.13 ou superior (recomendado) ou rode `npm install` novamente para instalar o better-sqlite3.",
  );
}

/** Driver disponível neste processo, sem abrir arquivo (para diagnóstico). */
export function detectSqliteDriver(): SqliteDriverName | null {
  try {
    return openSqliteProbe();
  } catch {
    return null;
  }
}

function openSqliteProbe(): SqliteDriverName {
  const { db, driver } = openSqlite(":memory:");
  db.close();
  return driver;
}
