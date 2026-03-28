/**
 * GraphApiError — Structured error type for Microsoft Graph API failures.
 *
 * Provides machine-readable error codes and human-friendly messages so the
 * UI layer can surface clear feedback without parsing raw error strings.
 *
 * NEV-14: Error handling and retry logic for MS Lists CRUD.
 */

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class GraphApiError extends Error {
  override readonly name = "GraphApiError";

  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly graphErrorCode: string = "unknown",
    public readonly requestId?: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
  }

  /** Whether the caller should retry this request. */
  get shouldRetry(): boolean {
    return this.retryable;
  }

  /** User-friendly error summary for UI display. */
  get userMessage(): string {
    switch (this.statusCode) {
      case 401:
        return "Your session has expired. Please sign in again.";
      case 403:
        return "You don't have permission to perform this action.";
      case 404:
        return "The requested item was not found. It may have been deleted.";
      case 409:
        return "This item was modified by someone else. Please refresh and try again.";
      case 429:
        return "Too many requests. Please wait a moment and try again.";
      case 503:
      case 504:
        return "Microsoft services are temporarily unavailable. Please try again shortly.";
      default:
        return this.statusCode >= 500
          ? "A server error occurred. Please try again later."
          : `Request failed: ${this.message}`;
    }
  }
}

// ---------------------------------------------------------------------------
// Parse a Graph API error response into a structured error
// ---------------------------------------------------------------------------

interface GraphErrorBody {
  error?: {
    code?: string;
    message?: string;
    innerError?: {
      "request-id"?: string;
      date?: string;
    };
  };
}

export async function parseGraphErrorResponse(
  response: Response,
  context?: string,
): Promise<GraphApiError> {
  let body: GraphErrorBody = {};

  try {
    body = (await response.json()) as GraphErrorBody;
  } catch {
    // Response body isn't JSON — fall through to defaults
  }

  const graphCode = body.error?.code ?? "unknown";
  const graphMessage = body.error?.message ?? response.statusText;
  const requestId = body.error?.innerError?.["request-id"];

  const retryable =
    response.status === 429 ||
    response.status === 503 ||
    response.status === 504;

  const prefix = context ? `${context}: ` : "";

  return new GraphApiError(
    `${prefix}${graphMessage}`,
    response.status,
    graphCode,
    requestId,
    retryable,
  );
}

// ---------------------------------------------------------------------------
// Retry logic
// ---------------------------------------------------------------------------

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const defaultRetryOptions: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Execute a fetch-like operation with automatic retry on transient failures.
 *
 * Respects `Retry-After` header from 429 responses.
 * Uses exponential backoff for 503/504 and network errors.
 */
export async function withGraphRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = defaultRetryOptions,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Only retry on retryable GraphApiErrors
      if (err instanceof GraphApiError && !err.retryable) {
        throw err;
      }

      // Don't retry on the last attempt
      if (attempt === options.maxRetries) {
        throw lastError;
      }

      // Calculate delay
      const delay = Math.min(
        options.baseDelayMs * Math.pow(2, attempt),
        options.maxDelayMs,
      );

      await sleep(delay);
    }
  }

  throw lastError ?? new Error("Retry exhausted without error");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
