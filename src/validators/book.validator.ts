import { z } from 'zod';
import { env } from '../config/env';
import { objectId } from './common';

const bookBody = z.object({
  title: z.string().trim().min(1),
  author: z.string().trim().min(1),
  authorCountry: z.string().trim().min(1),
  publishedDate: z.coerce.date().max(new Date(), { message: 'publishedDate cannot be in the future' }),
  pages: z.coerce.number().int().positive(),
  library: objectId
});

export const createBookSchema = z.object({
  body: bookBody
});

export const updateBookSchema = z.object({
  params: z.object({
    id: objectId
  }),
  body: bookBody.partial().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  })
});

export const bookIdSchema = z.object({
  params: z.object({
    id: objectId
  })
});

export const listBooksSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .default(env.BOOKS_DEFAULT_LIMIT)
      .transform((limit) => Math.min(limit, env.BOOKS_MAX_LIMIT))
  })
});
