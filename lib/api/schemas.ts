import { z } from "zod";
import { timelineSchema } from "@/lib/domain/timeline";

export const aspectRatioSchema = z.enum(["16:9", "9:16", "1:1"]);
export const idSchema = z.string().regex(/^[a-z]{3}_[a-f0-9]{32}$/, "Identificador inválido.");

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome.").max(120, "Use até 120 caracteres."),
  aspectRatio: aspectRatioSchema.default("16:9"),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    aspectRatio: aspectRatioSchema.optional(),
    timeline: timelineSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.aspectRatio !== undefined || v.timeline !== undefined, {
    message: "Nada para atualizar.",
  });

export const uploadQuerySchema = z.object({
  projectId: idSchema.nullable().default(null),
  role: z.enum(["source", "reference"]).default("source"),
  name: z.string().min(1).max(300),
  origin: z.string().trim().max(200).nullable().default(null),
  rights: z.literal("1", { message: "Confirme que você tem direitos ou consentimento sobre esta mídia." }),
});

export const generationModeSchema = z.enum(["text_to_video", "video_to_video"]);

export const sceneSchema = z.object({
  subject: z.string().trim().max(300).default(""),
  action: z.string().trim().max(300).default(""),
  environment: z.string().trim().max(300).default(""),
  camera: z.string().trim().max(200).default(""),
  lighting: z.string().trim().max(200).default(""),
  style: z.string().trim().max(200).default(""),
  movement: z.string().trim().max(200).default(""),
});

export const generationRequestSchema = z.object({
  projectId: idSchema,
  mode: generationModeSchema,
  /** "auto" deixa o roteador escolher entre os provedores compatíveis. */
  providerId: z.string().min(1).max(64).default("auto"),
  prompt: z.string().trim().min(3, "Descreva a cena.").max(2000),
  scene: sceneSchema.optional(),
  sourceAssetId: idSchema.optional(),
  referenceAssetIds: z.array(idSchema).max(4).default([]),
  aspectRatio: aspectRatioSchema,
  durationSeconds: z.number().int().min(1).max(30),
  /** Valor exato do orçamento exibido ao usuário; exigido quando o custo > 0. */
  confirmedCostCents: z.number().int().min(0).optional(),
  /** Confirmação explícita quando o custo é desconhecido. */
  acceptUnknownCost: z.boolean().default(false),
  clientRequestId: z.string().uuid(),
});

export const quoteRequestSchema = generationRequestSchema.omit({
  confirmedCostCents: true,
  acceptUnknownCost: true,
  clientRequestId: true,
});

export const renderRequestSchema = z.object({
  projectId: idSchema,
  clientRequestId: z.string().uuid(),
});

export const sceneDetectRequestSchema = z.object({
  projectId: idSchema,
  assetId: idSchema,
  threshold: z.number().min(0.1).max(0.9).default(0.35),
  clientRequestId: z.string().uuid(),
});

export type GenerationRequest = z.infer<typeof generationRequestSchema>;
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
export type SceneFields = z.infer<typeof sceneSchema>;
