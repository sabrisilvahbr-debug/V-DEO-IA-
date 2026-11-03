import { LogOut } from "lucide-react";
import { connection } from "next/server";
import { signOut } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { getRequestContext } from "@/lib/server/context";
import { serverConfig } from "@/lib/server/config";

/** Faixa no topo do app: modo de execução e sessão. */
export async function ModeBanner() {
  await connection();
  const config = serverConfig();
  if (config.backend === "local") {
    return (
      <>
        <Badge tone="info">Modo local</Badge>
        <span>Sem login · projetos e arquivos ficam neste computador.</span>
      </>
    );
  }
  const ctx = await getRequestContext().catch(() => null);
  return (
    <>
      <Badge tone="success">Supabase</Badge>
      <span className="truncate">{ctx?.user.email ?? "Sessão não encontrada"}</span>
      {ctx ? (
        <form action={signOut} className="ml-auto">
          <button type="submit" className="flex items-center gap-1 text-fg-muted hover:text-fg">
            <LogOut aria-hidden="true" className="size-3.5" />
            Sair
          </button>
        </form>
      ) : null}
    </>
  );
}
