# Ativar o Supabase

> **Atenção:** o driver Supabase (dados, Storage, Auth e fila) foi escrito e compila, mas ainda
> **não foi executado contra um projeto Supabase real**. Faça o teste abaixo antes de usar com
> dados importantes.

## 1. Criar o projeto

1. Crie um projeto em <https://supabase.com>.
2. Em **SQL Editor**, rode o conteúdo de `supabase/migrations/20261103000000_initial_schema.sql`
   (ou use a CLI: `supabase db push`). A migração cria as tabelas, as políticas de RLS, as
   funções da fila e o bucket privado `media`.
3. Em **Project Settings → API**, copie a URL, a chave **publicável** e a chave **secreta**.

## 2. Variáveis

`.env.local`:

```bash
CINEMORPH_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=https://<seu-projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<chave publicável>
SUPABASE_SECRET_KEY=<chave secreta — só para o worker>
```

## 3. Verificar

1. `npm run dev:all`
2. Acesse `/cadastro`, crie uma conta e confirme o e-mail (se a confirmação estiver ativa).
3. Crie um projeto, envie um vídeo, exporte. Confira no painel do Supabase as linhas em
   `projects`, `media_assets`, `jobs` e os arquivos no bucket `media/<seu-user-id>/`.
4. Crie uma segunda conta e confirme que ela não vê os projetos da primeira.

## Observações

- O worker usa a chave secreta (ignora RLS) e filtra por `owner_id` no código.
- O upload passa pelo servidor Next (validação com FFprobe) antes de ir ao Storage. O limite de
  tamanho do plano do Supabase também se aplica.
- `proxy.ts` renova a sessão e redireciona visitantes sem login das páginas privadas.
