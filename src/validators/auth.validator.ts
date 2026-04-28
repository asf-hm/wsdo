import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    username: z.string().trim().min(1),
    password: z.string().min(1)
  })
});
