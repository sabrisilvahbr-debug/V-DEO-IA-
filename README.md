# CINEMORPH AI

Plataforma web de criação, transformação e edição de vídeos com inteligência artificial.

> **Estado atual: etapa 1 de 5 (fundação).** A interface é navegável, mas autenticação,
> banco de dados, upload e geração de vídeo **ainda não existem**. Telas desses recursos
> mostram estados vazios identificados com "Em desenvolvimento · Etapa N".

## Stack

| Camada        | Tecnologia                                                     |
| ------------- | -------------------------------------------------------------- |
| Framework     | Next.js 16 (App Router, Turbopack, Cache Components)           |
| UI            | React 19, TypeScript estrito, Tailwind CSS 4                   |
| Componentes   | Padrão shadcn/ui (cva + tailwind-merge) escrito no repositório |
| Ícones        | lucide-react                                                   |
| Dados/Auth    | Supabase (`@supabase/ssr`) — preparado, ativado na etapa 3     |
| Testes        | Vitest + Testing Library + jsdom                               |

## Requisitos

- Node.js 20.9 ou superior (testado com Node 22)
- npm 10 ou superior

## Instalação e execução local

```bash
git clone https://github.com/sabrisilvahbr-debug/V-DEO-IA-.git
cd V-DEO-IA-
npm install
npm run dev
```

Abra <http://localhost:3000>.

Nenhuma variável de ambiente é obrigatória nesta etapa. Para preparar o Supabase:

```bash
cp .env.example .env.local   # depois preencha os valores públicos do seu projeto
```

## Comandos

| Comando             | O que faz                                              |
| ------------------- | ------------------------------------------------------ |
| `npm run dev`       | Servidor de desenvolvimento                            |
| `npm run build`     | Build de produção                                      |
| `npm start`         | Servidor de produção (após o build)                    |
| `npm run lint`      | ESLint                                                 |
| `npm run typecheck` | Gera os tipos de rota do Next e roda `tsc --noEmit`    |
| `npm test`          | Testes unitários e de componentes (Vitest)             |
| `npm run check`     | Lint + tipos + testes + build, em sequência            |

## Rotas

| Rota             | Estado                                                    |
| ---------------- | --------------------------------------------------------- |
| `/`              | Landing page                                              |
| `/login`         | Formulário desabilitado, aviso de autenticação inativa   |
| `/cadastro`      | Formulário desabilitado, aviso de autenticação inativa   |
| `/dashboard`     | Painéis com estados vazios                                |
| `/projetos`      | Estado vazio (etapa 3)                                    |
| `/biblioteca`    | Estado vazio (etapa 3)                                    |
| `/editor`        | Layout do estúdio: mídia, preview, inspetor e timeline    |
| `/configuracoes` | Mostra se as variáveis do Supabase estão definidas        |

## Estrutura

```
app/                 rotas (App Router)
  (app)/             área do estúdio, com barra lateral
  (auth)/            login e cadastro
components/
  ui/                botões, badges, cards, painéis, inputs, estados vazios
  layout/            logo, cabeçalho, rodapé, navegação, shell do app
  landing/           seções da landing page
  studio/            layout do editor
  auth/              formulário de autenticação
lib/
  supabase/          config pública, clientes browser e server
  modules.ts         roteiro dos 25 módulos e seu estado real
  navigation.ts      itens da navegação privada
tests/               testes Vitest
docs/                arquitetura e decisões
```

## Segurança

- `.env*` está no `.gitignore`; apenas `.env.example` (sem valores) é versionado.
- O código do navegador lê somente `NEXT_PUBLIC_SUPABASE_URL` e
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, que são públicas por design quando o Row
  Level Security está ativo. Chaves secretas nunca devem receber o prefixo `NEXT_PUBLIC_`.
- `lib/supabase/server.ts` importa `server-only` e não pode ser incluído no bundle do cliente.
- Não há pagamentos, créditos internos nem chamadas a APIs de IA nesta etapa.

## Próximas etapas

1. **Fundação** — concluída nesta entrega.
2. **Design refinado e conclusão da landing page.**
3. Autenticação Supabase, migrações com RLS, upload validado, biblioteca de projetos.
4. Contratos de provedores, adaptador MOCK (identificado como demonstração) e fila de tarefas.
5. Pipeline FFmpeg, timeline, renderização e exportação.

Detalhes em [`docs/architecture.md`](docs/architecture.md).
