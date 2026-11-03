# Segurança e privacidade

## Implementado

- **Isolamento por usuário:** toda consulta filtra por `owner_id` vindo do servidor; no Supabase,
  também há Row Level Security em todas as tabelas e políticas no Storage por pasta do usuário.
- **Fila protegida:** o usuário só insere tarefas com status `queued`; status, saída e lease são
  escritos apenas pelo worker (chave secreta). Cancelamento passa por função `request_job_cancel`.
- **Validação real de arquivos:** tipo detectado pela assinatura binária, depois conferido pelo
  FFprobe (faixa de vídeo/áudio, duração, resolução). Arquivo gravado em disco em streaming com
  limite de tamanho; nada é registrado se a validação falhar.
- **Nomes e caminhos:** nomes exibidos são limpos; chaves de armazenamento só aceitam
  `[A-Za-z0-9._-]` e são geradas pelo servidor. O armazenamento local recusa caminhos fora da pasta.
- **FFmpeg sem shell:** argumentos em array (`spawn`), com tempo limite.
- **Mídia privada:** servida apenas por `/api/media/:id` para o dono, com `nosniff`; no Supabase,
  URLs assinadas de 5 minutos.
- **Segredos:** `SUPABASE_SECRET_KEY` só existe no worker. O navegador recebe apenas valores
  públicos. `.env*` e `.data/` estão no `.gitignore`.
- **Consentimento:** todo upload exige a declaração de direitos/consentimento (`rights=1`) e
  permite informar a origem; vídeo-para-vídeo exige mídia com direitos declarados.
- **Custos:** nenhuma operação paga sem estimativa e confirmação do valor exato; orçamento
  mensal; sem repetição automática de operações pagas.
- **Limites de requisição** por usuário e ação (em memória, por instância).
- **Exclusão:** excluir mídia ou projeto remove os arquivos (originais, miniaturas, exportações).

## Pendente

- Fluxo de denúncia de uso não autorizado de imagem/voz e registro de consentimento detalhado
  (`consent_records`).
- Política de retenção automática e exclusão de conta (LGPD: direito de eliminação).
- Rate limiting compartilhado entre instâncias (Redis ou similar).
- Antivírus / verificação adicional de arquivos.
- Painel administrativo com autorização específica.
- Documentar a retenção de cada provedor externo antes de enviar vídeos a ele.

## LGPD

O modo local não envia dados a terceiros. Ao conectar provedores de IA, a interface deverá
informar que o vídeo será processado externamente e citar a política de retenção verificada do
provedor.
