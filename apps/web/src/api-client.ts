// Typed fetch client for the single-origin `/api/v1/**` API (plan Task 12).
// All case reads and commands go through here; the browser never talks to
// Firestore or Gemini, so this module imports neither (nor any Firebase SDK).
// The Firebase ID token is supplied by an injected `getIdToken` provider.

export type GetIdToken = () => Promise<string>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

/** RFC 4122 version-4 UUID, as the API's `z.uuid()` idempotency check requires. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  /** Sends a command with an `Idempotency-Key` header. Routes that also require `idempotencyKey` in the body take it from `withKey`. */
  command<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown, idempotencyKey?: string): Promise<T>;
  /** Downloads a binary response (evidence ZIP) with its server-suggested filename. */
  download(method: 'POST', path: string, idempotencyKey?: string): Promise<{ blob: Blob; filename: string }>;
}

/** Adds a fresh idempotency key to a command body. Reuse the same key when retrying the same user action. */
export function withKey<B extends object>(body: B, key: string = newIdempotencyKey()): B & { idempotencyKey: string } {
  return { ...body, idempotencyKey: key };
}

export function createApiClient(getIdToken: GetIdToken, baseUrl = '/api/v1/'): ApiClient {
  async function request(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<Response> {
    const headers: Record<string, string> = { Authorization: `Bearer ${await getIdToken()}` };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (method !== 'GET') {
      headers['Idempotency-Key'] = idempotencyKey ?? newIdempotencyKey();
    }
    const response = await fetch(`${baseUrl}${path.replace(/^\//, '')}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new ApiError(response.status, payload.error ?? `API_${response.status}`);
    }
    return response;
  }

  async function json<T>(response: Response): Promise<T> {
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  }

  return {
    async get<T>(path: string) {
      return json<T>(await request('GET', path));
    },
    async command<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown, idempotencyKey?: string) {
      return json<T>(await request(method, path, body, idempotencyKey));
    },
    async download(method: 'POST', path: string, idempotencyKey?: string) {
      const response = await request(method, path, undefined, idempotencyKey);
      const disposition = response.headers.get('content-disposition') ?? '';
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'evidence.zip';
      return { blob: await response.blob(), filename };
    },
  };
}
