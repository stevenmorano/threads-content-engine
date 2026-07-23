import { describe, expect, it } from "vitest";
import { rankPost, relevanceScore } from "./ranking";

describe("ranking", () => {
  it("scores exact query phrases above partial coverage", () => {
    expect(relevanceScore("A practical guide to product strategy", "product strategy"))
      .toBeGreaterThan(relevanceScore("A practical product guide", "product strategy"));
  });

  it("does not pretend missing public engagement is zero", () => {
    const result = rankPost({
      text: "Product strategy is a series of choices.",
      query: "product strategy",
      publishedAt: "2026-07-22T12:00:00Z",
      apiPosition: 0,
      resultCount: 10,
      now: new Date("2026-07-23T00:00:00Z"),
    });

    expect(result.engagement).toBeNull();
    expect(result.replyLike).toBeNull();
    expect(result.availableSignals).not.toContain("likes");
    expect(result.total).toBeGreaterThan(0.7);
  });

  it("uses engagement and reply ratio when the metrics are available", () => {
    const result = rankPost({
      text: "A thoughtful question",
      query: "question",
      publishedAt: "2026-07-22T12:00:00Z",
      apiPosition: 4,
      resultCount: 10,
      engagement: { likes: 100, replies: 25, reposts: 10, quotes: 5 },
      now: new Date("2026-07-23T00:00:00Z"),
    });

    expect(result.engagement).not.toBeNull();
    expect(result.replyLike).toBe(1);
    expect(result.availableSignals).toContain("reply_like_ratio");
  });
});
