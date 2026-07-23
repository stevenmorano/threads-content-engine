import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const signedRequestPayloadSchema = z.object({
  algorithm: z.string(),
  user_id: z.union([z.string(), z.number()]).transform(String),
  issued_at: z.number().optional(),
}).passthrough();

export type MetaSignedRequestPayload = z.infer<typeof signedRequestPayloadSchema>;

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

export function parseMetaSignedRequest(
  signedRequest: string,
  appSecret: string,
): MetaSignedRequestPayload {
  if (signedRequest.length > 4096) {
    throw new Error("Meta signed request is too large.");
  }

  const parts = signedRequest.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Meta signed request has an invalid format.");
  }

  const [encodedSignature, encodedPayload] = parts;
  const signature = decodeBase64Url(encodedSignature);
  const expectedSignature = createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest();

  if (
    signature.length !== expectedSignature.length ||
    !timingSafeEqual(signature, expectedSignature)
  ) {
    throw new Error("Meta signed request has an invalid signature.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload).toString("utf8"));
  } catch {
    throw new Error("Meta signed request has an invalid payload.");
  }

  const parsed = signedRequestPayloadSchema.parse(payload);
  if (parsed.algorithm.toUpperCase() !== "HMAC-SHA256") {
    throw new Error("Meta signed request uses an unsupported algorithm.");
  }

  return parsed;
}
