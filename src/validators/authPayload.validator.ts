import { z } from 'zod';
import { objectId } from './common';

export const authPayloadSchema = z.object({
  id: objectId,
  username: z.string().min(1),
  country: z.string().min(1),
  libraries: z.array(objectId),
  role: z.enum(['admin', 'user'])
});
