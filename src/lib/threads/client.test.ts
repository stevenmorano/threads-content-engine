import { afterEach, describe, expect, it, vi } from "vitest";
import { exchangeCodeForLongLivedToken } from "./client";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("exchangeCodeForLongLivedToken", () => {
  it("passes the short-lived token in Meta's required access_token parameter", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("THREADS_APP_ID", "threads-app-id");
    vi.stubEnv("THREADS_APP_SECRET", "threads-app-secret");
    vi.stubEnv(
      "THREADS_TOKEN_ENCRYPTION_KEY",
      Buffer.alloc(32, 1).toString("base64"),
    );

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ access_token: "short-lived-token", user_id: "123" }),
      )
      .mockResolvedValueOnce(
        Response.json({
          access_token: "long-lived-token",
          token_type: "bearer",
          expires_in: 5_183_944,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ id: "123", username: "adhdsteve", name: "ADHD Steve" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await exchangeCodeForLongLivedToken("authorization-code");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [longTokenUrl, longTokenInit] = fetchMock.mock.calls[1];
    const parsedUrl = new URL(String(longTokenUrl));
    expect(parsedUrl.pathname).toBe("/access_token");
    expect(parsedUrl.searchParams.get("grant_type")).toBe("th_exchange_token");
    expect(parsedUrl.searchParams.get("client_secret")).toBe("threads-app-secret");
    expect(parsedUrl.searchParams.get("access_token")).toBe("short-lived-token");
    expect(longTokenInit).not.toHaveProperty("headers");
    expect(result).toMatchObject({
      access_token: "long-lived-token",
      userId: "123",
      profile: { username: "adhdsteve" },
    });
  });
});
