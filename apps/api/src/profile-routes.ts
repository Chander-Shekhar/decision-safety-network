import { z } from 'zod';
import type { ApiDeps, RouteInstaller } from './app.js';
import { requireUser } from './auth.js';
import { PROFILE_NAME_MAX } from '../../../packages/contracts/src/profile.js';
import { getProfile, saveProfile } from './profile.js';

const PutProfileSchema = z.object({
  displayName: z.string().trim().max(PROFILE_NAME_MAX).optional(),
  mobile: z
    .string()
    .trim()
    .max(20)
    .regex(/^[+\d][\d\s()-]*$/)
    .optional()
    .or(z.literal('')),
});

/** Self-only profile (name + mobile) for owners and allies. */
export const profileRoutes: RouteInstaller = (app, deps: ApiDeps) => {
  app.get('/api/v1/profile', async (request) => {
    const uid = await requireUser(request, deps.auth);
    return getProfile(deps.db, uid);
  });

  app.put('/api/v1/profile', async (request, reply) => {
    const uid = await requireUser(request, deps.auth);
    const parsed = PutProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'INVALID_PROFILE' });
      return undefined;
    }
    return saveProfile(deps.db, uid, parsed.data);
  });
};
