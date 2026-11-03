import type { SceneFields } from "@/lib/api/schemas";

/**
 * Diretor de prompts (sem IA): organiza a descrição livre e os campos de
 * cena em uma instrução estruturada, preservando o texto original do usuário.
 * O resultado é exibido e pode ser editado antes do envio.
 */
export const sceneFieldLabels: Record<keyof SceneFields, string> = {
  subject: "Personagem/assunto",
  action: "Ação",
  environment: "Ambiente",
  camera: "Câmera",
  lighting: "Iluminação",
  style: "Estilo",
  movement: "Movimento",
};

const ORDER: (keyof SceneFields)[] = ["subject", "action", "environment", "camera", "movement", "lighting", "style"];

export function composePrompt(description: string, scene: Partial<SceneFields> = {}): string {
  const base = description.trim().replace(/\s+/g, " ");
  const lines = ORDER.flatMap((key) => {
    const value = scene[key]?.trim();
    return value ? [`${sceneFieldLabels[key]}: ${value}`] : [];
  });
  if (lines.length === 0) return base;
  return [base, ...lines].filter(Boolean).join("\n");
}
