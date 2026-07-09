import { afterEach, describe, expect, it, vi } from "vitest";
import { BACKEND_BASE_URL } from "./config";
import { getTokenCache } from "./token-cache";

afterEach(() => {
  getTokenCache().reset();
  vi.unstubAllGlobals();
});

describe("TokenCache", () => {
  it("requests Groq tokens from the configured backend with the shared secret", async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ api_key: "gsk_test_token", expires_at: expiresAt }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getTokenCache().get("groq")).resolves.toBe("gsk_test_token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BACKEND_BASE_URL}/api/get-groq-key`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "0xDEADBEEF",
        },
      },
    );
  });
});
