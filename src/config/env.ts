import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  MONGO_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  BOOKS_DEFAULT_LIMIT: z.coerce.number().int().positive().default(20),
  BOOKS_MAX_LIMIT: z.coerce.number().int().positive().default(100),
  FEED_LIMIT: z.coerce.number().int().positive().default(50),
  FEED_MAX_PAGES: z.coerce.number().int().positive().default(2000),
  FEED_MAX_AGE_DAYS: z.coerce.number().int().positive().default(36500)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ');

  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsedEnv.data;
