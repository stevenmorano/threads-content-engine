import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseMetaSignedRequest } from "./signed-request";

function sign(payload: object, secret: string) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  return `${signature}.${encodedPayload}`;
}

describe("parseMetaSignedRequest", () => {
  it("verifies and parses an HMAC-SHA256 request", () => {
    const signedRequest = sign(
      {
        algorithm: "HMAC-SHA256",
        user_id: "threads-user-123",
        issued_at: 1_753_300_000,
      },
      "app-secret",
    );

    expect(parseMetaSignedRequest(signedRequest, "app-secret")).toMatchObject({
      algorithm: "HMAC-SHA256",
      user_id: "threads-user-123",
    });
  });

  it("rejects a request signed with another secret", () => {
    const signedRequest = sign(
      { algorithm: "HMAC-SHA256", user_id: "threads-user-123" },
      "wrong-secret",
    );

    expect(() => parseMetaSignedRequest(signedRequest, "app-secret")).toThrow(
      "invalid signature",
    );
  });

  it("rejects an unsupported signature algorithm", () => {
    const signedRequest = sign(
      { algorithm: "HMAC-SHA1", user_id: "threads-user-123" },
      "app-secret",
    );

    expect(() => parseMetaSignedRequest(signedRequest, "app-secret")).toThrow(
      "unsupported algorithm",
    );
  });
});
