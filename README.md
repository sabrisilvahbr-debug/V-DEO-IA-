# CINEMORPH AI

Plataforma web de criação, transformação e edição de vídeos com inteligência artificial.

> **Estado atual: etapas 1, 3, 4 e 5 implementadas.** Você já pode criar projetos, enviar
> vídeos, editar na timeline (cortes, ordem, cor, volume, trilha, legendas), detectar cenas e
> exportar MP4 em 16:9, 9:16 ou 1:1. A **geração por IA ainda não está conectada**: o único
> provedor ativo é o **MOCK**, que produz demonstrações com FFmpeg, claramente marcadas.
> A etapa 2 (refinamento visual da landing) ficou para depois.

## Requisitos

- **Node.js 20.9 ou superior** — recomendado **22.13+**. No Node 22.13+ o banco local usa o
  SQLite nativo; em versões anteriores, usa o `better-sqlite3` (instalado pelo `npm install`).
- **FFmpeg e FFprobe** no PATH (versão 5 ou superior), com `libx264` e `aac`.
  Para gravar legendas no vídeo, o FFmpeg precisa do `libass` (as builds comuns já trazem).
  - Windows: `winget install Gyan.FFmpeg`
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `sudo apt install ffmpeg`

## Instalação e execução

```bash
git clone https://github.com/sabrisilvahbr-debug/V-DEO-IA-.git
cd V-DEO-IA-
npm install
npm run dev:all        # servidor (http://localhost:3000) + worker da fila
```

Também dá para rodar separado, em dois terminais: `npm run dev` e `npm run worker`.
**Sem o worker, gerações, detecção de cenas e exportações ficam paradas "Na fila".**

Os dados ficam em `.data/` (banco SQLite, vídeos enviados, exportações). A pasta está no
`.gitignore`. Para começar do zero, apague-a com o servidor parado.

## Se uma página não abrir

1. Rode `npm install` de novo (sempre que baixar uma versão nova do projeto).
2. Rode `npm run doctor`: ele verifica Node.js, dependências, banco local e FFmpeg e diz o que corrigir.
3. Com o servidor rodando, abra **http://localhost:3000/diagnostico** para ver a mesma verificação no navegador.
4. Se instalou o FFmpeg agora, feche e abra o terminal antes de iniciar de novo.

O `npm run dev`, o `npm start` e o `npm run worker` já fazem essa verificação antes de iniciar.

## Como usar

1. **Projetos → Criar projeto.** O estúdio abre em seguida.
2. **Mídia:** marque a declaração de direitos/consentimento e envie vídeos, imagens ou áudios.
   O arquivo é validado pelo conteúdo (não pela extensão) e pelo FFprobe.
3. **+ Timeline** adiciona o clipe; **+ Trilha** define o áudio de fundo.
4. **Clipe:** ajuste entrada/saída, volume, brilho, contraste e saturação; use
   **Detectar mudanças de cena** e depois **Dividir o clipe nesses cortes**.
5. **Legendas:** adicione no cursor, edite, baixe o `.srt` ou grave no vídeo.
6. **Gerar:** descreva a cena (o diretor de cena organiza câmera, luz etc.). Hoje só o MOCK
   responde, e o resultado é marcado como "Demonstração".
7. **Exportar:** escolha proporção e qualidade. Cada exportação vira uma **versão** para download.

A timeline é salva automaticamente.

## Comandos

| Comando             | O que faz                                                   |
| ------------------- | ----------------------------------------------------------- |
| `npm run dev:all`   | Servidor de desenvolvimento + worker                        |
| `npm run dev`       | Só o servidor                                               |
| `npm run worker`    | Só o worker da fila (gerações, cenas, exportações)          |
| `npm run build`     | Build de produção                                           |
| `npm start`         | Servidor de produção (rode o worker junto)                  |
| `npm run lint`      | ESLint                                                      |
| `npm run typecheck` | Tipos de rota do Next + `tsc --noEmit`                      |
| `npm test`          | Testes (unitários, componentes e integração com FFmpeg)     |
| `npm run check`     | Lint + tipos + testes + build                               |
| `npm run doctor`    | Verifica o ambiente (Node, dependências, banco, FFmpeg)     |

## Arquitetura em uma página

```
Navegador ──► Next.js (páginas + /api) ──► Camada de dados ──► SQLite local | Supabase
                     │                            │
                     │ cria tarefa                └► Armazenamento ──► pasta .data | Supabase Storage
                     ▼
                Fila (tabela jobs) ◄── Worker (npm run worker)
                                          ├─ geração ──► Roteador ──► Provedores (MOCK hoje)
                                          ├─ detecção de cenas ──► FFmpeg
                                          └─ exportação ──► FFmpeg ──► nova versão do projeto
```

Detalhes: [`docs/architecture.md`](docs/architecture.md) · API: [`docs/api.md`](docs/api.md) ·
Provedores: [`docs/providers.md`](docs/providers.md) · Segurança: [`docs/security.md`](docs/security.md) ·
Supabase: [`docs/supabase.md`](docs/supabase.md) · Implantação: [`docs/deployment.md`](docs/deployment.md)

## O que é real e o que é demonstração

| Recurso                                   | Estado                                                        |
| ----------------------------------------- | ------------------------------------------------------------- |
| Projetos, upload, biblioteca, versões     | Funcionando (modo local)                                      |
| Timeline, cortes, cor, volume, trilha     | Funcionando, renderizado pelo FFmpeg                          |
| Detecção de cenas                         | Funcionando (FFmpeg `select=scene`)                           |
| Legendas                                  | Edição manual, SRT e gravação no vídeo; sem transcrição       |
| Fila, novas tentativas, recuperação       | Funcionando (lease, backoff, idempotência)                    |
| Geração / transformação por IA            | **Somente MOCK** (sem IA). Integrações reais: etapa 6         |
| Login e Supabase                          | Implementado, **não verificado** com um projeto Supabase real |
| Pagamentos                                | Não implementado (sem créditos internos)                      |

O estado de cada um dos 25 módulos está em `lib/modules.ts` e na landing page.
