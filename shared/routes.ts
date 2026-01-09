import { z } from 'zod';
import { insertGameSchema, games } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  illegalMove: z.object({
    message: z.string(),
  })
};

export const api = {
  games: {
    create: {
      method: 'POST' as const,
      path: '/api/games',
      responses: {
        201: z.custom<typeof games.$inferSelect>(),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/games/:id',
      responses: {
        200: z.custom<typeof games.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    move: {
      method: 'POST' as const,
      path: '/api/games/:id/move',
      input: z.object({
        from: z.object({ r: z.number(), c: z.number() }),
        to: z.object({ r: z.number(), c: z.number() }),
      }),
      responses: {
        200: z.custom<typeof games.$inferSelect>(), // Returns updated game state (after AI move)
        400: errorSchemas.illegalMove,
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
