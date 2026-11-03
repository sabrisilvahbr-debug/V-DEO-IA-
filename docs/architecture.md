# Arquitetura — CINEMORPH AI

## Princípios

1. **Nada simulado como real.** O MOCK é o único provedor ativo e tudo que ele produz leva a
   marca "Demonstração" (no arquivo, no banco e na interface). Módulos incompletos têm o estado
   real em `lib/modules.ts`.
2. **Funciona sem contratar nada.** Modo local com SQLite, pasta de arquivos e FFmpeg.
3. **Segredos só no servidor.** O navegador recebe apenas a URL e a chave publicável do Supabase.
4. **Trabalho pesado fora da requisição HTTP.** Gerações, detecção de cenas e exportações são
   tarefas persistentes processadas por um worker separado.

## Camadas

```
app/                       Rotas (páginas e /api). Páginas leem dados dentro de <Suspense>.
components/ui              Primitivas visuais.
components/studio          Estúdio do projeto (cliente): mídia, geração, tarefas, preview,
                           inspetor, legendas, exportação, timeline.
lib/domain                 Tipos, esquema da timeline (Zod) e operações puras (reducer).
lib/media                  Funções puras de mídia: plano de render, SRT, cenas.
lib/server/config.ts       Variáveis de ambiente validadas.
lib/server/context.ts      Usuário + dados + armazenamento por requisição; contexto do worker.
lib/server/store/          Interface DataStore e implementações SQLite e Supabase.
lib/server/storage/        Armazenamento de arquivos: pasta local e Supabase Storage.
lib/server/media/          FFmpeg/FFprobe, validação, ingestão de arquivos.
lib/server/jobs/           Criação de tarefas, executor com retry e handlers.
providers/                 Contrato VideoProvider, MOCK, registro e roteador.
workers/worker.ts          Processo da fila.
supabase/migrations/       Esquema PostgreSQL com RLS (espelha o SQLite).
proxy.ts                   Sessão Supabase e redirecionamento (inativo no modo local).
```

## Dados

Tabelas (SQLite e PostgreSQL): `projects` (com a timeline em JSON), `media_assets`, `jobs`,
`project_versions`, `usage_events` e, no Supabase, `profiles`.

Decisão: **uma tabela `jobs`** com coluna `type` (`generation`, `render`, `scene_detect`) em vez
de tabelas separadas por tipo. O ciclo de vida (fila, lease, tentativas, cancelamento) é o
mesmo, e um único worker atende tudo.

Toda operação recebe o `ownerId` do servidor. O navegador nunca define o dono de um registro.

## Fluxo de uma tarefa

1. A rota valida a entrada (Zod), o projeto e as mídias do usuário.
2. Para geração: o roteador escolhe o provedor por **capacidade e custo** e a guarda de custos
   exige confirmação do valor exato (ou aceite explícito se for desconhecido) e respeita o
   orçamento mensal (`OPERATIONAL_BUDGET_CENTS`).
3. A tarefa é criada com uma **chave de idempotência** (`clientRequestId`): reenviar a mesma
   requisição devolve a mesma tarefa.
4. O worker reserva a tarefa com **lease** (2 min, renovado por heartbeat). Se o worker cair,
   o lease expira e a tarefa volta à fila (ou falha ao esgotar as tentativas).
5. Erros temporários são repetidos com atraso exponencial (5 s, 10 s, 20 s… até 5 min).
   Erros definitivos (`NonRetryableError`) falham na hora.
6. **Provedores pagos nunca são repetidos automaticamente** (`maxAttempts = 1`). Se a tarefa já
   tem `providerJobId`, uma nova tentativa só acompanha o job existente — não inicia outro.
7. Cancelamento: na fila, cancela na hora; em execução, o heartbeat detecta e interrompe o FFmpeg.

## Renderização

`lib/media/render-plan.ts` monta o comando do FFmpeg como função pura (testada):

- cada clipe: corte (`-ss`/`-t`), escala com barras pretas para a proporção de saída, 30 fps,
  `eq` para brilho/contraste/saturação;
- áudio do clipe com volume, ou silêncio (`anullsrc`) quando o clipe não tem áudio ou está mudo;
- `concat` de todos os clipes; legendas com o filtro `subtitles` (libass), quando pedido;
- trilha de fundo em loop, mixada com `amix`;
- presets: rascunho 720p (CRF 28), padrão 1080p (CRF 23), alta 1080p (CRF 18); H.264 + AAC,
  `+faststart`.

O progresso vem de `-progress pipe:1`. Ao terminar, o arquivo é validado e registrado como mídia
`render`, e o projeto ganha uma nova versão.

## Preview

O preview reproduz os clipes em sequência no navegador respeitando entrada e saída, com
legendas sobrepostas. A cor usa filtros CSS como **aproximação**. A trilha de fundo e a mixagem
só existem no arquivo exportado.

## Next.js 16

- `cacheComponents` está ativo: leituras por requisição ficam em componentes dentro de
  `<Suspense>` que chamam `connection()` (`lib/server/page-context.ts`).
- `usePathname()` na navegação também fica em `<Suspense>` (rotas com parâmetros dinâmicos).
- `proxy.ts` substitui o antigo middleware. Ele **não** roda em `/api`: o proxy guarda o corpo da
  requisição em memória (limite padrão de 10 MB), o que quebraria uploads grandes.
- Erros internos do Next (`redirect`, renderização dinâmica) são repassados com `unstable_rethrow`.

## Decisões

| Decisão | Motivo |
| --- | --- |
| SQLite nativo (`node:sqlite`) no modo local | Sem dependência nativa para compilar; arquivo único |
| Worker em processo separado (`tsx --conditions=react-server`) | Sobrevive a reinícios do servidor; não prende requisições |
| Upload com o arquivo bruto no corpo (`application/octet-stream`) | Grava em disco em streaming com limite, sem carregar na memória |
| Diretor de prompts sem IA | Organiza os campos de cena de forma previsível; o usuário edita o texto final |
| Cópia física dos arquivos ao duplicar projeto | Excluir o original não quebra a cópia |
