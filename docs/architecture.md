# Arquitetura — CINEMORPH AI

## Princípios

1. **Nada simulado como real.** Recurso não implementado aparece como estado vazio com
   o selo "Em desenvolvimento · Etapa N". O estado de cada um dos 25 módulos fica em
   `lib/modules.ts` e é exibido na landing page.
2. **Funciona sem credenciais.** Toda integração é opcional e detectada em tempo de
   execução; sem configuração, a interface mostra "não configurado" em vez de quebrar.
3. **Segredos só no servidor.** Somente variáveis `NEXT_PUBLIC_` com valores públicos
   chegam ao navegador.
4. **Módulos pequenos.** Cada arquivo tem uma responsabilidade; páginas compõem
   componentes de `components/`.

## Camadas

```
app/            Rotas. Server Components por padrão.
components/ui   Primitivas visuais sem regra de negócio.
components/*    Composições por área (layout, landing, studio, auth).
lib/            Lógica pura e clientes de serviços externos.
```

Diretórios previstos para as próximas etapas (ainda não criados para evitar código
vazio): `providers/` (adaptadores de IA), `workers/` (fila e FFmpeg), `supabase/`
(migrações).

## Design system

Tokens definidos em `app/globals.css` com `@theme` do Tailwind 4:

| Token                   | Uso                                    |
| ----------------------- | -------------------------------------- |
| `canvas`                | fundo da página                        |
| `surface*`              | painéis em três níveis de elevação     |
| `border`, `border-strong` | divisórias e contornos               |
| `fg`, `fg-muted`, `fg-subtle` | hierarquia de texto              |
| `accent`                | âmbar, cor de ação e de destaque       |
| `info/success/warning/danger` | estados                          |

Fontes Geist (via `next/font`). Foco visível com contorno âmbar. Animações respeitam
`prefers-reduced-motion`.

Os componentes seguem o padrão do shadcn/ui (variantes com `class-variance-authority`,
mesclagem com `tailwind-merge`), escritos diretamente no repositório. O CLI do shadcn
não foi usado porque nenhum componente da biblioteca era necessário além dessas
primitivas; ele pode ser adicionado depois sem conflito.

## Supabase

- `lib/supabase/config.ts` lê e valida URL e chave publicável (HTTPS, ou localhost para
  o Supabase local). Retorna `null` se faltar algo.
- `lib/supabase/client.ts` cria o cliente do navegador com `createBrowserClient`.
- `lib/supabase/server.ts` cria o cliente do servidor com `createServerClient` e o
  adaptador de cookies `getAll`/`setAll` do Next.

Na etapa 3: `proxy.ts` para renovar a sessão por requisição, proteção das rotas de
`(app)`, migrações com RLS.

## Decisões

| Decisão | Motivo |
| --- | --- |
| Rotas em português (`/projetos`, `/configuracoes`) | Público brasileiro |
| Rotas privadas acessíveis sem login nesta etapa | Autenticação ainda não existe; um aviso fixo no topo deixa isso claro |
| Next 16 com `cacheComponents` (padrão do create-next-app) | Mantém o projeto na configuração atual recomendada |
| `next typegen` antes do `tsc` | Os tipos globais `LayoutProps`/`PageProps` são gerados pelo Next |
| Sem Playwright nesta etapa | Testes de componentes cobrem a fundação; E2E entra com a autenticação |
