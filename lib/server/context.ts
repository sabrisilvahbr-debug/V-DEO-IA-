import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/domain/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { configProblems, serverConfig } from "./config";
import { SetupError } from "./setup-error";
import { LocalBlobStorage } from "./storage/local";
import { SupabaseBlobStorage } from "./storage/supabase";
import type { BlobStorage } from "./storage/types";
import { LocalDataStore } from "./store/local";
import { SupabaseDataStore } from "./store/supabase";
import type { DataStore, UserDataStore } from "./store/types";

/** Usuário fixo do modo local (sem login). */
export const LOCAL_USER: CurrentUser = { id: "local-user", email: null };

export type RequestContext = {
  user: CurrentUser;
  store: UserDataStore;
  storage: BlobStorage;
};

type Singletons = { store?: LocalDataStore; storage?: LocalBlobStorage };
const globalForLocal = globalThis as unknown as { __cinemorphLocal?: Singletons };

function openLocalStore(dbPath: string): LocalDataStore {
  try {
    return new LocalDataStore(dbPath);
  } catch (error) {
    if (error instanceof SetupError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
      throw new SetupError(
        `Sem permissão para gravar os dados locais em ${serverConfig().dataDir}.`,
        "Defina CINEMORPH_DATA_DIR para uma pasta com permissão de escrita. Em hospedagens sem disco gravável (ex.: Vercel), use o modo Supabase.",
      );
    }
    throw error;
  }
}

function localSingletons() {
  const config = serverConfig();
  const cache = (globalForLocal.__cinemorphLocal ??= {});
  cache.store ??= openLocalStore(config.dbPath);
  cache.storage ??= new LocalBlobStorage(config.storageDir);
  return { store: cache.store, storage: cache.storage };
}

/**
 * Resolve o usuário e os serviços da requisição atual.
 * Retorna `null` quando não há sessão (modo Supabase sem login).
 */
export async function getRequestContext(): Promise<RequestContext | null> {
  const config = serverConfig();
  const problems = configProblems(config);
  if (problems.length) throw new SetupError(problems.join(" "), "Ajuste o arquivo .env.local e reinicie o servidor.");

  if (config.backend === "local") {
    const { store, storage } = localSingletons();
    return { user: LOCAL_USER, store, storage };
  }

  const client = await createSupabaseServerClient();
  if (!client) return null;
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return {
    user: { id: String(data.claims.sub), email: typeof data.claims.email === "string" ? data.claims.email : null },
    store: new SupabaseDataStore(client),
    storage: new SupabaseBlobStorage(client, config.storageBucket, config.tmpDir),
  };
}

/**
 * Serviços do worker. Em modo Supabase exige SUPABASE_SECRET_KEY, que só
 * existe no servidor/worker e nunca recebe o prefixo NEXT_PUBLIC_.
 */
export function getWorkerContext(): { store: DataStore; storage: BlobStorage } {
  const config = serverConfig();
  if (config.backend === "local") return localSingletons();

  if (!config.supabase || !config.supabaseSecretKey) {
    throw new Error("Worker em modo Supabase exige NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY.");
  }
  const client = createClient(config.supabase.url, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    store: new SupabaseDataStore(client),
    storage: new SupabaseBlobStorage(client, config.storageBucket, config.tmpDir),
  };
}

export function isLocalMode(): boolean {
  return serverConfig().backend === "local";
}
