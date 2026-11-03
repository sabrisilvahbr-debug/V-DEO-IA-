# API interna

Todas as rotas exigem sessão (no modo local, o usuário local é usado). Erros seguem o formato:

```json
{ "error": { "code": "midia_invalida", "message": "…", "details": { "hint": "…" } } }
```

Códigos HTTP: `400` validação, `401` sem sessão, `402` custo não autorizado, `404` não encontrado,
`409` conflito, `413` arquivo grande, `422` mídia inválida / sem provedor, `429` limite de
requisições, `503` FFmpeg indisponível.

## Projetos

| Método e rota | Descrição |
| --- | --- |
| `GET /api/projects?search=` | Lista projetos |
| `POST /api/projects` | `{ name, aspectRatio }` → cria |
| `GET /api/projects/:id` | Projeto, mídias e versões |
| `PATCH /api/projects/:id` | `{ name?, aspectRatio?, timeline? }` — a timeline é validada contra as mídias |
| `DELETE /api/projects/:id` | Exclui projeto, mídias (arquivos inclusive), tarefas e versões |
| `POST /api/projects/:id/duplicate` | Cópia com mídias (sem exportações) |

## Mídias

| Método e rota | Descrição |
| --- | --- |
| `POST /api/uploads?projectId=&role=source\|reference&name=&origin=&rights=1` | Corpo: bytes do arquivo. `rights=1` é obrigatório |
| `GET /api/assets?projectId=&kind=&role=` | Lista mídias |
| `GET /api/media/:id` | Arquivo (suporta `Range`). `?variant=thumb` miniatura, `?download=1` anexo |
| `DELETE /api/media/:id` | Exclui (409 se estiver na timeline) |

## Tarefas

| Método e rota | Descrição |
| --- | --- |
| `POST /api/quotes` | Provedor escolhido e custo estimado, sem criar nada |
| `POST /api/generations` | Enfileira geração. Requer `clientRequestId` (UUID); custo > 0 exige `confirmedCostCents` igual à estimativa |
| `GET /api/generations/:id` · `POST /api/generations/:id/cancel` | Estado / cancelamento |
| `POST /api/renders` | `{ projectId, clientRequestId }` → exporta a timeline salva |
| `GET /api/renders/:id` | Estado |
| `POST /api/scene-detections` | `{ projectId, assetId, threshold, clientRequestId }` |
| `GET /api/jobs?projectId=&active=1` | Lista tarefas |
| `POST /api/jobs/:id/cancel` | Cancela qualquer tarefa |

## Provedores, uso e sistema

| Método e rota | Descrição |
| --- | --- |
| `GET /api/providers` | Provedores implementados, disponibilidade e capacidades; planejados |
| `GET /api/providers/:id/capabilities` | Capacidades de um provedor |
| `GET /api/usage` | Consumo do mês e orçamento operacional |
| `GET /api/system` | Modo, FFmpeg e limites (sem segredos) |

A especificação OpenAPI será gerada quando os contratos se estabilizarem com as integrações reais.
