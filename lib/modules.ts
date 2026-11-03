/**
 * Roteiro dos 25 módulos do CINEMORPH AI.
 *
 * Fonte única de verdade para o estado real de cada módulo. Atualize o
 * `status` somente quando o módulo estiver implementado e testado.
 */
export type ModuleStatus = "concluido" | "parcial" | "planejado";

export type ProductModule = {
  id: number;
  name: string;
  stage: number;
  status: ModuleStatus;
  /** O que falta, para módulos parciais. */
  note?: string;
};

export const moduleStatusLabel: Record<ModuleStatus, string> = {
  concluido: "Funcionando",
  parcial: "Parcial",
  planejado: "Planejado",
};

export const productModules: ProductModule[] = [
  { id: 1, name: "Landing page", stage: 2, status: "parcial", note: "Refinamento de design pendente (etapa 2)." },
  { id: 2, name: "Autenticação", stage: 3, status: "parcial", note: "Modo local sem login; Supabase Auth implementado, não verificado com projeto real." },
  { id: 3, name: "Dashboard", stage: 3, status: "concluido" },
  { id: 4, name: "Upload de mídia", stage: 3, status: "concluido" },
  { id: 5, name: "Galeria de referências", stage: 3, status: "parcial", note: "Referências ainda não são enviadas aos provedores." },
  { id: 6, name: "Diretor de prompts", stage: 4, status: "parcial", note: "Estruturação por campos, sem IA." },
  { id: 7, name: "Transformação visual", stage: 6, status: "parcial", note: "Fluxo pronto; apenas o MOCK (demonstração) está conectado." },
  { id: 8, name: "Geração cinematográfica", stage: 6, status: "parcial", note: "Fluxo pronto; apenas o MOCK (demonstração) está conectado." },
  { id: 9, name: "Preservação de movimento", stage: 6, status: "planejado" },
  { id: 10, name: "Continuidade visual", stage: 6, status: "planejado" },
  { id: 11, name: "Editor de timeline", stage: 5, status: "concluido" },
  { id: 12, name: "Cortes inteligentes", stage: 5, status: "concluido" },
  { id: 13, name: "Áudio e voz", stage: 5, status: "parcial", note: "Volume, mudo e trilha; sem processamento avançado." },
  { id: 14, name: "Legendas", stage: 5, status: "parcial", note: "Edição manual, SRT e gravação no vídeo; sem transcrição." },
  { id: 15, name: "Cor e efeitos", stage: 5, status: "parcial", note: "Brilho, contraste e saturação; sem estabilização e efeitos." },
  { id: 16, name: "Renderização", stage: 5, status: "concluido" },
  { id: 17, name: "Roteador de modelos", stage: 4, status: "concluido" },
  { id: 18, name: "Fila de tarefas", stage: 4, status: "concluido" },
  { id: 19, name: "Controle de custos", stage: 4, status: "parcial", note: "Estimativa, confirmação e orçamento; sem alertas." },
  { id: 20, name: "Armazenamento", stage: 3, status: "parcial", note: "Local funcionando; Supabase Storage não verificado; sem política de retenção automática." },
  { id: 21, name: "Biblioteca de projetos", stage: 3, status: "concluido" },
  { id: 22, name: "Painel administrativo", stage: 7, status: "planejado" },
  { id: 23, name: "Segurança e consentimento", stage: 7, status: "parcial", note: "Validação de arquivos, RLS, declaração de direitos; sem fluxo de denúncia." },
  { id: 24, name: "Observabilidade", stage: 7, status: "planejado" },
  { id: 25, name: "Planos e pagamentos", stage: 7, status: "planejado" },
];
