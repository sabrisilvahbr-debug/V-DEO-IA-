@AGENTS.md

# CINEMORPH AI — instruções para o Claude

- Leia `README.md` e `docs/architecture.md` antes de mudar a estrutura.
- Next.js 16: consulte `node_modules/next/dist/docs/` antes de usar uma API do Next.
- Não simule recursos: o que não existe aparece com `EmptyState` e `plannedStage`.
- Ao concluir um módulo, atualize o `status` em `lib/modules.ts`.
- Nunca coloque segredos em variáveis `NEXT_PUBLIC_` nem no repositório.
- Não chame APIs pagas sem estimativa de custo e confirmação do usuário.
- Antes de entregar, rode `npm run check` (lint, tipos, testes e build).
