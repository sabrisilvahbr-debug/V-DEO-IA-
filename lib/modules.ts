/**
 * Roteiro dos 25 módulos do CINEMORPH AI.
 *
 * Fonte única de verdade para o estado real de cada módulo. Atualize o
 * `status` somente quando o módulo estiver implementado e testado.
 */
export type ModuleStatus = "fundacao" | "planejado";

export type ProductModule = {
  id: number;
  name: string;
  stage: number;
  status: ModuleStatus;
};

export const moduleStatusLabel: Record<ModuleStatus, string> = {
  fundacao: "Estrutura criada",
  planejado: "Planejado",
};

export const productModules: ProductModule[] = [
  { id: 1, name: "Landing page", stage: 1, status: "fundacao" },
  { id: 2, name: "Autenticação", stage: 3, status: "planejado" },
  { id: 3, name: "Dashboard", stage: 1, status: "fundacao" },
  { id: 4, name: "Upload de mídia", stage: 3, status: "planejado" },
  { id: 5, name: "Galeria de referências", stage: 3, status: "planejado" },
  { id: 6, name: "Diretor de prompts", stage: 4, status: "planejado" },
  { id: 7, name: "Transformação visual", stage: 6, status: "planejado" },
  { id: 8, name: "Geração cinematográfica", stage: 6, status: "planejado" },
  { id: 9, name: "Preservação de movimento", stage: 6, status: "planejado" },
  { id: 10, name: "Continuidade visual", stage: 6, status: "planejado" },
  { id: 11, name: "Editor de timeline", stage: 5, status: "planejado" },
  { id: 12, name: "Cortes inteligentes", stage: 5, status: "planejado" },
  { id: 13, name: "Áudio e voz", stage: 5, status: "planejado" },
  { id: 14, name: "Legendas", stage: 5, status: "planejado" },
  { id: 15, name: "Cor e efeitos", stage: 5, status: "planejado" },
  { id: 16, name: "Renderização", stage: 5, status: "planejado" },
  { id: 17, name: "Roteador de modelos", stage: 4, status: "planejado" },
  { id: 18, name: "Fila de tarefas", stage: 4, status: "planejado" },
  { id: 19, name: "Controle de custos", stage: 7, status: "planejado" },
  { id: 20, name: "Armazenamento", stage: 3, status: "planejado" },
  { id: 21, name: "Biblioteca de projetos", stage: 3, status: "planejado" },
  { id: 22, name: "Painel administrativo", stage: 7, status: "planejado" },
  { id: 23, name: "Segurança e consentimento", stage: 7, status: "planejado" },
  { id: 24, name: "Observabilidade", stage: 7, status: "planejado" },
  { id: 25, name: "Planos e pagamentos", stage: 7, status: "planejado" },
];
