# Provedores de vídeo

## Contrato

`providers/types.ts` define `VideoProvider`:

```ts
interface VideoProvider {
  id: string;
  info(): ProviderInfo;                       // nome, isDemo, paid, docsUrl, verifiedAt
  availability(): Promise<ProviderAvailability>;
  getCapabilities(): Promise<ProviderCapabilities>;
  estimateCost(input): Promise<CostEstimate>; // { known, cents, basis }
  startJob(input, { idempotencyKey, signal }): Promise<{ providerJobId }>;
  getJobStatus(providerJobId): Promise<ProviderJobStatus>;
  getResult(providerJobId): Promise<{ filePath, cleanup }>;
  cancelJob?(providerJobId): Promise<void>;
}
```

O roteador (`providers/router.ts`) filtra por modalidade, proporção, duração, imagens de
referência e duração do vídeo de origem, e escolhe o menor custo conhecido. Ele **nunca**
substitui vídeo-para-vídeo por texto-para-vídeo.

## Implementados

### MOCK (`providers/mock.ts`) — demonstração

| Item | Valor |
| --- | --- |
| Autenticação | Nenhuma |
| Modalidades | Texto→vídeo (padrão de teste `testsrc2`), vídeo→vídeo (filtro de cor) |
| Duração | 1–10 s; 1280×720, 720×1280 ou 720×720 |
| Custo | US$ 0,00 |
| Marcação | Texto "DEMONSTRAÇÃO · MOCK" no vídeo (se o FFmpeg tiver `drawtext`), `isDemo` no banco, selo na interface |
| Desativar | `MOCK_PROVIDER_ENABLED=false` |

## Planejados (etapa 6) — ainda não implementados

- Google Gemini API (modelos de vídeo)
- Runway API (incluindo vídeo para vídeo, se o modelo oferecer)
- Hugging Face Inference Providers

Nenhum endpoint, identificador de modelo ou preço desses serviços foi assumido no código.
Antes de implementar cada um, registrar aqui, a partir da documentação oficial:

1. Nome do provedor e URL da documentação oficial
2. Método de autenticação
3. Endpoint confirmado
4. Identificadores de modelos confirmados
5. Modalidades de entrada e saída
6. Limites de tamanho, duração e resolução
7. Como acompanhar a tarefa
8. Como obter o resultado
9. Modelo de cobrança e preço verificado
10. Tratamento de falhas
11. Testes de integração
12. Data da última verificação

Se algum item não puder ser confirmado, a integração fica desabilitada (`availability()`
devolve `available: false` com o motivo).

## Como adicionar um provedor

1. Criar `providers/<nome>.ts` implementando `VideoProvider`. A chave da API fica em variável de
   ambiente **sem** `NEXT_PUBLIC_`, lida apenas no servidor/worker.
2. `info().paid = true` e `estimateCost()` com o preço verificado (ou `known: false`).
3. Registrar em `providers/registry.ts`.
4. Testes: capacidades, estimativa, mapeamento de estados e falhas (com respostas gravadas).
5. Preencher a ficha acima.
