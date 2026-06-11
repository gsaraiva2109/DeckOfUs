import { z } from 'zod';

export const createSessionBody = z.object({
  secret: z.string().min(4),
  config: z.unknown().optional(),
});

export const codeParam = z.object({
  code: z.string().min(1),
});

export const idParam = z.object({
  id: z.string().min(1),
});

export const ousadoBody = z.object({
  secret: z.string().min(1),
});
