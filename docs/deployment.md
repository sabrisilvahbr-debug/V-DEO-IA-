# Implantação

O CINEMORPH precisa de **dois processos** e do **FFmpeg** no mesmo ambiente:

- `npm start` — servidor Next.js
- `npm run worker` — fila de tarefas (FFmpeg e provedores)

Por isso, plataformas apenas serverless (sem processo contínuo e sem FFmpeg) não servem para o
worker.

## Opção recomendada: servidor ou contêiner próprio

1. Node.js 22.13+ (ou 20.9+ com `better-sqlite3`), FFmpeg 5+ instalados.
2. `npm ci && npm run build`
3. Rodar `npm start` e `npm run worker` sob um supervisor (systemd, pm2, Docker Compose).
4. Modo local: manter `CINEMORPH_DATA_DIR` num disco persistente e fazer backup dele.
   Modo Supabase: os dados ficam no Supabase; o disco só guarda temporários.
5. Colocar um proxy reverso (Nginx, Caddy) com HTTPS e limite de corpo compatível com
   `MAX_UPLOAD_MB`.

## Checklist de produção

- [ ] `CINEMORPH_BACKEND=supabase` (o modo local não tem login)
- [ ] Migração aplicada e teste de isolamento entre duas contas feito (docs/supabase.md)
- [ ] `SUPABASE_SECRET_KEY` só no ambiente do worker
- [ ] `MOCK_PROVIDER_ENABLED=false` se não quiser exibir demonstrações
- [ ] `OPERATIONAL_BUDGET_CENTS` definido antes de ativar provedores pagos
- [ ] HTTPS e limite de upload no proxy reverso
- [ ] Monitoramento dos logs do worker
