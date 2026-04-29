import { z } from 'zod';
import { env } from '../config/env';
import { objectId } from './common';

const publishedDate = z.coerce
  .date()
  .refine((date) => date <= new Date(), { message: 'publishedDate cannot be in the future' });

const country = z.string().trim().min(1).transform((value) => value.toUpperCase());

const bookBody = z.object({
  title: z.string().trim().min(1),
  author: z.string().trim().min(1),
  authorCountry: country,
  publishedDate,
  pages: z.coerce.number().int().positive().max(50_000),
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
