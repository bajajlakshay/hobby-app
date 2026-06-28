import { API_BASE_URL } from '@/constants/config';

/** Error thrown for any non-2xx API response, carrying the server's messages. */
export class ApiError extends Error {
  readonly status: number;
  readonly errors: string[];

  constructor(status: number, errors: string[]) {
    super(errors[0] ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

/**
 * Low-level JSON request helper. Attaches the bearer token when provided,
 * parses the response, and throws {@link ApiError} on failure.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrors(response));
  }

  // 204 No Content (e.g. logout) has no body to parse.
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** Normalizes the various error shapes the backend can return into a flat list. */
async function parseErrors(response: Response): Promise<string[]> {
  try {
    const data = await response.json();

    // Our controllers: { errors: ["..."] }
    if (Array.isArray(data?.errors)) {
      return data.errors as string[];
    }

    // ASP.NET model validation: { errors: { Field: ["..."] } }
    if (data?.errors && typeof data.errors === 'object') {
      return Object.values(data.errors as Record<string, string[]>).flat();
    }

    if (typeof data?.title === 'string') {
      return [data.title];
    }
  } catch {
    // Body was empty or not JSON; fall through to the generic message.
  }

  return [`Request failed with status ${response.status}`];
}
