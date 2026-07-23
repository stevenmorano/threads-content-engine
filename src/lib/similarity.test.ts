import { describe, expect, it } from "vitest";
import { calculateSimilarity, compareAgainstSources } from "./similarity";

describe("similarity", () => {
  it("flags identical text", () => {
    expect(calculateSimilarity("Build trust before reach.", "Build trust before reach.").score)
      .toBe(1);
  });

  it("allows unrelated original text", () => {
    expect(
      calculateSimilarity(
        "A useful question can turn a quiet audience into a conversation.",
        "Most teams overcomplicate their product strategy with endless roadmaps.",
      ).score,
    ).toBeLessThan(0.3);
  });

  it("reports the closest source", () => {
    const result = compareAgainstSources("Clear writing earns trust.", [
      "A recipe for sourdough starter.",
      "Clear writing earns trust.",
    ]);
    expect(result.maxScore).toBe(1);
  });
});
