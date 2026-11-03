@AGENTS.md

# CINEMORPH AI — instruções para o Claude

- Leia `README.md` e `docs/architecture.md` antes de mudar a estrutura.
- Next.js 16: consulte `node_modules/next/dist/docs/` antes de usar uma API do Next.
  Com `cacheComponents`, leituras de dados ficam em componentes dentro de `<Suspense>` que usam
  `requirePageContext()` (chama `connection()`).
- Não simule recursos: o que não existe aparece com `EmptyState`/`plannedStage` ou com aviso;
  resultados do MOCK sempre levam `isDemo`.
- Ao concluir ou avançar um módulo, atualize `status`/`note` em `lib/modules.ts`.
- Dados sempre via `ctx.store` com `ctx.user.id`; nunca aceite `ownerId` do navegador.
- Mudou o esquema? Atualize `lib/server/store/sqlite-schema.ts` (nova entrada no array) **e**
  crie uma migração em `supabase/migrations/`.
- Novo provedor: siga `docs/providers.md`. Nunca invente endpoints, modelos ou preços.
- Nunca coloque segredos em variáveis `NEXT_PUBLIC_` nem no repositório.
- Não chame APIs pagas sem estimativa de custo e confirmação do usuário.
- Antes de entregar, rode `npm run check` (lint, tipos, testes — inclusive integração com
  FFmpeg — e build).
