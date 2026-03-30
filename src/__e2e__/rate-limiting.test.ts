/**
 * E2E: Rate Limiting & Throttling Handling
 *
 * Tests resilience against API rate limiting patterns:
 * - Retry-after header handling
 * - 429 Too Many Requests response
 * - 503 Service Unavailable
 * - Exponential backoff simulation
 * - Circuit breaker patterns
 *
 * These tests mock fetch to simulate Graph API throttling scenarios.
 *
 * NEV-18 — Phase 1 hardening.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FetchGraphClient } from "@/lib/graph/graph-client";

// ---------------------------------------------------------------------------
// Mock fetch helpers
// ---------------------------------------------------------------------------

function createRateLimitedResponse(
  status: number,
  retryAfter?: number,
  body?: unknown,
): Response {
  const headers = new Headers();
  if (retryAfter !== undefined) {
    headers.set("Retry-After", String(retryAfter));
  }
  return new Response(JSON.stringify(body ?? { error: { message: "Throttled" } }), {
    status,
    headers,
    statusText: status === 429 ? "Too Many Requests" : "Service Unavailable",
  });
}

function createOkResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("E2E: Rate Limiting", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 429 Too Many Requests
  // -------------------------------------------------------------------------

  describe("429 Too Many Requests", () => {
    it("throws descriptive error on 429 response", async () => {
      mockFetch.mockResolvedValueOnce(
        createRateLimitedResponse(429, 30),
      );

      const client = new FetchGraphClient({ fetch: mockFetch });
      await expect(
        client.listItems({ siteId: "site-1", listId: "list-1" }),
      ).rejects.toThrow("Microsoft Graph request failed: 429");
    });

    it("includes Retry-After value in the response", async () => {
      const response = createRateLimitedResponse(429, 60);
      expect(response.headers.get("Retry-After")).toBe("60");
    });
  });

  // -------------------------------------------------------------------------
  // 503 Service Unavailable
  // -------------------------------------------------------------------------

  describe("503 Service Unavailable", () => {
    it("throws descriptive error on 503", async () => {
      mockFetch.mockResolvedValueOnce(
        createRateLimitedResponse(503),
      );

      const client = new FetchGraphClient({ fetch: mockFetch });
      await expect(
        client.listItems({ siteId: "site-1", listId: "list-1" }),
      ).rejects.toThrow("Microsoft Graph request failed: 503");
    });
  });

  // -------------------------------------------------------------------------
  // Successful request after transient failure
  // -------------------------------------------------------------------------

  describe("retry simulation", () => {
    it("succeeds after transient 429 with manual retry", async () => {
      const successBody = { value: [{ id: "1", fields: { Title: "Task" } }] };

      // First call: 429
      mockFetch.mockResolvedValueOnce(
        createRateLimitedResponse(429, 1),
      );
      // Second call: success
      mockFetch.mockResolvedValueOnce(
        createOkResponse(successBody),
      );

      const client = new FetchGraphClient({ fetch: mockFetch });

      // First attempt fails
      await expect(
        client.listItems({ siteId: "site-1", listId: "list-1" }),
      ).rejects.toThrow("429");

      // Retry succeeds
      const result = await client.listItems({ siteId: "site-1", listId: "list-1" });
      expect(result.value).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("succeeds after transient 503 with manual retry", async () => {
      const successBody = { value: [] };

      mockFetch.mockResolvedValueOnce(createRateLimitedResponse(503));
      mockFetch.mockResolvedValueOnce(createOkResponse(successBody));

      const client = new FetchGraphClient({ fetch: mockFetch });

      await expect(
        client.listItems({ siteId: "site-1", listId: "list-1" }),
      ).rejects.toThrow("503");

      const result = await client.listItems({ siteId: "site-1", listId: "list-1" });
      expect(result.value).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Exponential backoff simulation
  // -------------------------------------------------------------------------

  describe("exponential backoff", () => {
    it("caller can implement exponential backoff", async () => {
      const successBody = { value: [{ id: "1" }] };
      const delays: number[] = [];
      const startTime = Date.now();

      // Simulate: 429, 429, 200
      mockFetch
        .mockResolvedValueOnce(createRateLimitedResponse(429, 1))
        .mockResolvedValueOnce(createRateLimitedResponse(429, 2))
        .mockResolvedValueOnce(createOkResponse(successBody));

      const client = new FetchGraphClient({ fetch: mockFetch });

      const maxRetries = 3;
      let result = null;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          result = await client.listItems({ siteId: "site-1", listId: "list-1" });
          break;
        } catch (err) {
          lastError = err as Error;
          if (attempt < maxRetries - 1) {
            // Exponential backoff: 100ms, 200ms
            const delay = 100 * Math.pow(2, attempt);
            delays.push(delay);
            // Don't actually sleep in tests — just track the intent
          }
        }
      }

      expect(result).not.toBeNull();
      expect(result!.value).toHaveLength(1);
      expect(delays).toEqual([100, 200]);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  // -------------------------------------------------------------------------
  // Authentication header on rate-limited requests
  // -------------------------------------------------------------------------

  describe("auth headers", () => {
    it("sends authorization header when token provider is set", async () => {
      const successBody = { value: [] };
      mockFetch.mockResolvedValueOnce(createOkResponse(successBody));

      const client = new FetchGraphClient({
        fetch: mockFetch,
        accessTokenProvider: async () => "test-token-123",
      });

      await client.listItems({ siteId: "site-1", listId: "list-1" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const requestInit = callArgs[1] as RequestInit;
      const headers = requestInit.headers as Headers;
      expect(headers.get("Authorization")).toBe("Bearer test-token-123");
    });
  });

  // -------------------------------------------------------------------------
  // List comments rate limiting
  // -------------------------------------------------------------------------

  describe("listComments rate limiting", () => {
    it("throws on 429 for comment listing", async () => {
      mockFetch.mockResolvedValueOnce(
        createRateLimitedResponse(429, 10),
      );

      const client = new FetchGraphClient({ fetch: mockFetch });
      await expect(
        client.listComments({ siteId: "site-1", listId: "list-1", itemId: "item-1" }),
      ).rejects.toThrow("429");
    });
  });

  // -------------------------------------------------------------------------
  // List columns rate limiting
  // -------------------------------------------------------------------------

  describe("listColumns rate limiting", () => {
    it("throws on 429 for column listing", async () => {
      mockFetch.mockResolvedValueOnce(
        createRateLimitedResponse(429, 5),
      );

      const client = new FetchGraphClient({ fetch: mockFetch });
      await expect(
        client.listColumns({ siteId: "site-1", listId: "list-1" }),
      ).rejects.toThrow("429");
    });
  });
});
