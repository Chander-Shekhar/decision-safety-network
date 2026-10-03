import Fastify, { type FastifyInstance } from 'fastify';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

/**
 * Dependencies every route installer receives. Kept small and injectable so
 * feature routes (Tasks 2-13) can be unit-tested with fakes and so the model
 * adapter, retention sweep, etc. never depend on wall-clock time directly.
 */
export interface ApiDeps {
  auth: Auth;
  db: Firestore;
  now: () => Date;
}

/**
 * A feature module's route registration function. Each module owns its own
 * routes and can be composed and tested independently of the central router
 * (`buildApi`) and of every other feature module.
 */
export type RouteInstaller = (app: FastifyInstance, deps: ApiDeps) => void;

/** Known domain error messages mapped to HTTP status codes. */
const STATUS_BY_ERROR_MESSAGE: Record<string, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  PLAN_REQUIRED: 400,
  INVALID_IDEMPOTENCY_KEY: 400,
  VERSION_CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  EXPIRED: 410,
};

function statusForError(error: unknown): number {
  if (error instanceof Error && error.message in STATUS_BY_ERROR_MESSAGE) {
    return STATUS_BY_ERROR_MESSAGE[error.message] as number;
  }
  return 500;
}

/**
 * Builds a Fastify instance from a list of feature route installers plus
 * shared dependencies. Composing installers here (rather than hardcoding
 * feature routes in this file) is what lets Task 12 assemble the full public
 * app while every other task's routes are tested in isolation.
 */
export function buildApi(installers: readonly RouteInstaller[], deps: ApiDeps): FastifyInstance {
  const app = Fastify({ logger: false });

  app.setErrorHandler((error, _request, reply) => {
    const status = statusForError(error);
    const message = error instanceof Error ? error.message : 'INTERNAL';
    reply.status(status).send({ error: message });
  });

  for (const installer of installers) {
    installer(app, deps);
  }

  return app;
}
